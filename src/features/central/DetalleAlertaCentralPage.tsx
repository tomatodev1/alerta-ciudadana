import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Mapa } from '@/components/map/Mapa';
import { Button } from '@/components/ui/Button';
import { Cargando } from '@/components/ui/Cargando';
import { Icon } from '@/components/ui/Icon';
import { transcurrido, useAhora } from '@/hooks/useAhora';
import type { Alerta, AlertaEstado, Unidad } from '@/types/database.types';
import { ETIQUETA_CORTA, ETIQUETA_ESTADO, esActiva, fechaHora, iconoTipo, useTipos } from '@/features/alertas/comun';
import { Dato, LineaTiempo } from '@/features/alertas/componentes';
import { acusarRecibo, ciudadanosDe, PRIORIDAD, type Ciudadano } from './datos';
import { ListaEvidencias } from '@/features/evidencias/ListaEvidencias';

interface Cercana { unidad_id: number; codigo: string; placa: string; comisaria: string; distancia_m: number }

/** Detalle de una alerta para el operador: datos, ciudadano, unidades cercanas y cambio de estado. */
export default function DetalleAlertaCentralPage() {
  const { id = '' } = useParams();
  const { tipos } = useTipos();
  const ahora = useAhora(15_000);

  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [historial, setHistorial] = useState<AlertaEstado[]>([]);
  const [ciudadano, setCiudadano] = useState<Ciudadano | null>(null);
  const [unidad, setUnidad] = useState<Unidad | null>(null);
  const [cercanas, setCercanas] = useState<Cercana[] | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-encontrada'>('cargando');
  const [ocupado, setOcupado] = useState<string | null>(null);   // acción en curso
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const cargarUnidades = useCallback(async (a: Alerta) => {
    if (a.unidad_id) {
      const { data } = await supabase.from('unidades').select('*').eq('id', a.unidad_id).maybeSingle();
      setUnidad(data);
    } else setUnidad(null);
    if (esActiva(a.estado)) {
      const { data } = await supabase.rpc('unidades_cercanas', { p_alerta: a.id, p_limite: 5 });
      setCercanas(data ?? []);
    } else setCercanas([]);
  }, []);

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: h }] = await Promise.all([
      supabase.from('alertas').select('*').eq('id', id).maybeSingle(),
      supabase.from('alerta_estados').select('*').eq('alerta_id', id).order('creado_en'),
    ]);
    if (!a) { setEstado('no-encontrada'); return; }
    setAlerta(a);
    setHistorial(h ?? []);
    const c = await ciudadanosDe([a.ciudadano_id]);
    setCiudadano(c.get(a.ciudadano_id) ?? null);
    await cargarUnidades(a);
    setEstado('ok');
    if (a.estado === 'enviada') void acusarRecibo(a.id);
  }, [id, cargarUnidades]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Tiempo real: otro operador (o el sistema) puede cambiar la alerta
  useEffect(() => {
    if (!id) return;
    const canal = supabase
      .channel(`central-alerta-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas', filter: `id=eq.${id}` }, (p) => {
        const a = p.new as Alerta;
        setAlerta(a);
        void cargarUnidades(a);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerta_estados', filter: `alerta_id=eq.${id}` }, (p) => {
        const fila = p.new as AlertaEstado;
        setHistorial((h) => (h.some((x) => x.id === fila.id) ? h : [...h, fila]));
      })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [id, cargarUnidades]);

  async function cambiar(accion: string, cambios: Partial<Pick<Alerta, 'estado' | 'unidad_id'>>, mensaje: string) {
    if (!alerta) return;
    setOcupado(accion);
    setError('');
    setAviso('');
    const { data, error: e } = await supabase.from('alertas').update(cambios).eq('id', alerta.id).select('*').maybeSingle();
    setOcupado(null);
    setConfirmarCancelar(false);
    if (e || !data) {
      setError(e?.message.includes('cerrada') || e?.message.includes('disponible') ? e.message : 'No se pudo actualizar la alerta. Inténtalo de nuevo.');
      if (e?.message.includes('disponible')) void cargarUnidades(alerta);
      return;
    }
    setAlerta(data);
    void cargarUnidades(data);
    setAviso(mensaje);
  }

  if (estado === 'cargando') return <Cargando texto="Cargando la alerta…" />;
  if (estado === 'no-encontrada' || !alerta) {
    return (
      <div className="contenedor">
        <div className="card"><h1>No encontramos esta alerta</h1><Link to="/central" className="btn btn-primario">Volver a la bandeja</Link></div>
      </div>
    );
  }

  const tipo = tipos?.find((t) => t.id === alerta.tipo_id);
  const p = tipo?.prioridad ?? 2;
  const activa = esActiva(alerta.estado);
  const posUnidad = unidad?.latitud != null && unidad.longitud != null ? { lat: unidad.latitud, lng: unidad.longitud } : null;

  return (
    <div className="contenedor detalle-central">
      <div className="detalle-cabecera">
        <Link to="/central" className="enlace"><Icon name="arrow-left" size={16} />&nbsp;Bandeja</Link>
        <div className="fila-entre">
          <div className="fila-icono">
            <span className="icono-tipo" aria-hidden="true"><Icon name={iconoTipo(tipo?.icono ?? '')} size={22} /></span>
            <div>
              <h1 className="h-titulo">{tipo?.nombre ?? 'Alerta'} <span className="codigo-chico">{alerta.codigo}</span></h1>
              <p className="texto-chico">
                <span className={`insignia prioridad p${p}`}>Prioridad {PRIORIDAD[p].toLowerCase()}</span>
                {' '}Recibida {transcurrido(alerta.recibida_en, ahora)} · {fechaHora(alerta.recibida_en)}
                {alerta.activada_por_voz && ' · activada por voz'}
              </p>
            </div>
          </div>
          <span className={`insignia grande estado-${alerta.estado}`}>{ETIQUETA_CORTA[alerta.estado]}</span>
        </div>
      </div>

      <div aria-live="polite">
        {aviso && <p className="caja caja-ok" role="status"><Icon name="check-circle" /> {aviso}</p>}
        {error && <p className="alerta-form" role="alert">{error}</p>}
      </div>

      <div className="detalle-grilla">
        <div className="detalle-col">
          <section className="card" aria-labelledby="t-ciudadano">
            <h2 id="t-ciudadano" className="lbl">CIUDADANO</h2>
            {ciudadano ? (
              <dl className="detalle">
                <Dato icono="user" etiqueta="Nombre" valor={`${ciudadano.nombres} ${ciudadano.apellidos}`}
                  extra={ciudadano.estado_verificacion === 'verificada' ? 'Identidad verificada (DNI, SMS y selfie)' : 'Sin verificar'} />
                <Dato icono="id" etiqueta="DNI" valor={ciudadano.dni} />
                <Dato icono="phone" etiqueta="Celular" valor={ciudadano.celular.replace(/^\+51(\d{3})(\d{3})(\d{3})$/, '+51 $1 $2 $3')} />
              </dl>
            ) : <p className="texto-chico">Sin datos del ciudadano.</p>}
            {ciudadano && <a href={`tel:${ciudadano.celular}`} className="btn btn-contorno btn-bloque"><Icon name="phone" /> Llamar al ciudadano</a>}
          </section>

          <section className="card" aria-labelledby="t-ubicacion">
            <h2 id="t-ubicacion" className="lbl">UBICACIÓN</h2>
            <dl className="detalle">
              <Dato icono="map-pin" etiqueta="Dirección aproximada" valor={alerta.direccion ?? 'Sin dirección'}
                extra={`${alerta.latitud.toFixed(5)}, ${alerta.longitud.toFixed(5)} · ${alerta.ubicacion_manual ? 'ajustada manualmente por el ciudadano' : alerta.precision_m ? `GPS ±${Math.round(alerta.precision_m)} m` : 'GPS'}`} />
              <Dato icono="clock" etiqueta="Generada en el dispositivo" valor={fechaHora(alerta.generada_en)} />
            </dl>
          </section>

          <section className="card" aria-labelledby="t-evidencias">
            <h2 id="t-evidencias" className="lbl">EVIDENCIAS DEL CIUDADANO</h2>
            <ListaEvidencias alertaId={alerta.id} vacio="El ciudadano aún no adjuntó evidencias." />
          </section>

          <section className="card" aria-labelledby="t-historial">
            <h2 id="t-historial" className="lbl">HISTORIAL</h2>
            <LineaTiempo alerta={alerta} historial={historial} />
          </section>
        </div>

        <div className="detalle-col">
          <section className="card tarjeta-mapa" aria-label="Mapa de la alerta">
            <Mapa pin={{ lat: alerta.latitud, lng: alerta.longitud }} unidad={posUnidad}
              precision={alerta.ubicacion_manual ? null : alerta.precision_m}
              etiqueta="Mapa con la ubicación de la alerta y la unidad asignada" className="mapa-estado" />
          </section>

          {activa ? (
            <section className="card acciones-central" aria-labelledby="t-acciones">
              <h2 id="t-acciones" className="lbl">GESTIONAR ALERTA</h2>

              {unidad && (
                <div className="caja">
                  <Icon name="car" />
                  <div>
                    <strong>Unidad {unidad.codigo} · Patrullero {unidad.placa}</strong>
                    <p>{unidad.efectivo_cargo} · {unidad.estado.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              )}

              {(alerta.estado === 'enviada' || alerta.estado === 'recibida') && (
                <Button variante="contorno" className="btn-bloque" cargando={ocupado === 'evaluar'}
                  onClick={() => cambiar('evaluar', { estado: 'en_evaluacion' }, 'La alerta pasó a "En evaluación".')}>
                  <Icon name="search" /> Pasar a evaluación
                </Button>
              )}

              <div>
                <h3 className="h-chico">{unidad ? 'Cambiar unidad' : 'Asignar unidad'} <small className="texto-chico">(disponibles más cercanas)</small></h3>
                {!cercanas ? <p className="texto-chico"><span className="spinner spinner-sm" /> Buscando unidades…</p>
                  : cercanas.length === 0 ? <p className="texto-chico">No hay unidades disponibles en este momento.</p>
                  : (
                    <ul className="lista-unidades">
                      {cercanas.map((u) => (
                        <li key={u.unidad_id}>
                          <span>
                            <strong>{u.codigo} · {u.placa}</strong>
                            <small>{u.comisaria} · a {(u.distancia_m / 1000).toFixed(1)} km</small>
                          </span>
                          <Button className="btn-chico" cargando={ocupado === `unidad-${u.unidad_id}`} disabled={!!ocupado}
                            onClick={() => cambiar(`unidad-${u.unidad_id}`, { unidad_id: u.unidad_id, estado: 'en_atencion' }, `Unidad ${u.codigo} asignada. El ciudadano ya lo ve en su pantalla.`)}>
                            Asignar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {alerta.estado === 'en_atencion' && (
                <Button className="btn-bloque" cargando={ocupado === 'finalizar'} disabled={!!ocupado}
                  onClick={() => cambiar('finalizar', { estado: 'finalizada' }, 'Atención finalizada. La unidad quedó disponible.')}>
                  <Icon name="check-circle" /> Finalizar atención
                </Button>
              )}

              {!confirmarCancelar ? (
                <Button variante="texto" onClick={() => setConfirmarCancelar(true)} disabled={!!ocupado}>
                  Cancelar alerta (falsa o duplicada)
                </Button>
              ) : (
                <div className="caja caja-error" role="alertdialog" aria-labelledby="t-cancelar">
                  <Icon name="alert" />
                  <div>
                    <strong id="t-cancelar">¿Cancelar la alerta {alerta.codigo}?</strong>
                    <p>El ciudadano verá que fue cancelada. Esta acción no se puede deshacer.</p>
                    <div className="acciones-fila" style={{ marginTop: 12 }}>
                      <Button variante="contorno" className="btn-chico" cargando={ocupado === 'cancelar'} autoFocus
                        onClick={() => cambiar('cancelar', { estado: 'cancelada' }, 'La alerta fue cancelada.')}>Sí, cancelar</Button>
                      <Button variante="texto" className="btn-chico" onClick={() => setConfirmarCancelar(false)}>No</Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="card">
              <p className="lbl">ALERTA CERRADA</p>
              <p className="muted" style={{ margin: 0 }}>
                {ETIQUETA_ESTADO[alerta.estado]}{alerta.finalizada_en ? ` · ${fechaHora(alerta.finalizada_en)}` : ''}. Ya no se puede modificar.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
