import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { distanciaMetros } from '@/lib/geocodificar';
import { useAhora } from '@/hooks/useAhora';
import { Mapa } from '@/components/map/Mapa';
import { Button } from '@/components/ui/Button';
import { Cargando } from '@/components/ui/Cargando';
import { Icon } from '@/components/ui/Icon';
import type { Alerta, AlertaEstado, Comisaria, Unidad } from '@/types/database.types';
import { ETIQUETA_CORTA, ETIQUETA_ESTADO, esActiva, fechaHora, iconoTipo, useTipos } from './comun';
import { Dato, LineaTiempo } from './componentes';
import { ListaEvidencias } from '@/features/evidencias/ListaEvidencias';
import { useEvidencias } from '@/hooks/useEvidencias';

type UnidadConComisaria = Unidad & { comisaria: Pick<Comisaria, 'nombre'> | null };

/** Velocidad promedio supuesta de un patrullero en ciudad (para "Llega en ~N min"). */
const KMH = 25;
/** Si la central no confirma en este plazo, se ofrece llamar al 105. */
const PLAZO_CONFIRMACION_MS = 2 * 60_000;

/**
 * E13 / C14–C17 · ¡Alerta enviada! + estado de la alerta en tiempo real (RF-10).
 * Escucha cambios de la alerta y de su historial con Supabase Realtime.
 */
export default function EstadoAlertaPage() {
  const { id = '' } = useParams();
  const recienEnviada = !!(useLocation().state as { recienEnviada?: boolean } | null)?.recienEnviada;
  const { tipos } = useTipos();

  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [historial, setHistorial] = useState<AlertaEstado[]>([]);
  const [unidad, setUnidad] = useState<UnidadConComisaria | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-encontrada'>('cargando');
  const [enVivo, setEnVivo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [cambio, setCambio] = useState('');   // anuncio para lectores de pantalla
  const ultimoEstado = useRef<string | null>(null);
  const ahora = useAhora(10_000);
  const { cola } = useEvidencias();
  const subiendo = cola.filter((x) => x.alertaId === id && (x.estado === 'subiendo' || x.estado === 'comprimiendo')).length;

  const cargarUnidad = useCallback(async (unidadId: number | null) => {
    if (!unidadId) { setUnidad(null); return; }
    const { data: u } = await supabase.from('unidades').select('*').eq('id', unidadId).maybeSingle();
    if (!u) { setUnidad(null); return; }
    const { data: c } = await supabase.from('comisarias').select('nombre').eq('id', u.comisaria_id).maybeSingle();
    setUnidad({ ...u, comisaria: c });
  }, []);

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: h }] = await Promise.all([
      supabase.from('alertas').select('*').eq('id', id).maybeSingle(),
      supabase.from('alerta_estados').select('*').eq('alerta_id', id).order('creado_en'),
    ]);
    if (!a) { setEstado('no-encontrada'); return; }
    setAlerta(a);
    setHistorial(h ?? []);
    await cargarUnidad(a.unidad_id);
    setEstado('ok');
  }, [id, cargarUnidad]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Tiempo real: cambios en la alerta y nuevas entradas del historial
  useEffect(() => {
    if (!id) return;
    const canal = supabase
      .channel(`alerta-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas', filter: `id=eq.${id}` }, (p) => {
        const nueva = p.new as Alerta;
        setAlerta((prev) => {
          if (prev?.unidad_id !== nueva.unidad_id) void cargarUnidad(nueva.unidad_id);
          return nueva;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerta_estados', filter: `alerta_id=eq.${id}` }, (p) => {
        const fila = p.new as AlertaEstado;
        setHistorial((h) => (h.some((x) => x.id === fila.id) ? h : [...h, fila]));
      })
      .subscribe((s) => setEnVivo(s === 'SUBSCRIBED'));
    return () => { void supabase.removeChannel(canal); };
  }, [id, cargarUnidad]);

  // Anuncia los cambios de estado
  useEffect(() => {
    if (!alerta) return;
    if (ultimoEstado.current && ultimoEstado.current !== alerta.estado) setCambio(`Tu alerta cambió a: ${ETIQUETA_ESTADO[alerta.estado]}`);
    ultimoEstado.current = alerta.estado;
  }, [alerta?.estado]);

  async function actualizar() {
    setActualizando(true);
    await cargar();
    setActualizando(false);
  }

  if (estado === 'cargando') return <Cargando texto="Cargando tu alerta…" />;
  if (estado === 'no-encontrada' || !alerta) {
    return (
      <div className="contenedor">
        <div className="card">
          <h1>No encontramos esta alerta</h1>
          <p className="muted">Puede que el enlace no sea correcto o que la alerta no te pertenezca.</p>
          <Link to="/app" className="btn btn-primario">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const tipo = tipos?.find((t) => t.id === alerta.tipo_id);
  const pin = { lat: alerta.latitud, lng: alerta.longitud };
  const posUnidad = unidad?.latitud != null && unidad.longitud != null ? { lat: unidad.latitud, lng: unidad.longitud } : null;
  const metros = posUnidad ? distanciaMetros(posUnidad, pin) : null;
  const minutos = metros != null ? Math.max(1, Math.round((metros / 1000 / KMH) * 60)) : null;
  const activa = esActiva(alerta.estado);
  const sinConfirmar = alerta.estado === 'enviada' && ahora - new Date(alerta.recibida_en).getTime() > PLAZO_CONFIRMACION_MS;

  return (
    <div className="contenedor estado-alerta">
      <p className="oculto-visual" aria-live="assertive">{cambio}</p>

      <div className="estado-col-izq">
        {recienEnviada ? (
          <section className="card enviada" aria-labelledby="titulo-estado">
            <span className="icono-grande ok" aria-hidden="true"><Icon name="check" size={36} /></span>
            <div>
              <h1 id="titulo-estado">¡Alerta enviada!</h1>
              <p className="muted">La Central 105 recibió tu alerta. La ayuda está en camino.</p>
            </div>
          </section>
        ) : (
          <div className="encabezado-estado">
            <Link to="/app/alertas" className="enlace"><Icon name="arrow-left" size={16} />&nbsp;Mis alertas</Link>
            <h1 id="titulo-estado">Estado de mi alerta</h1>
            <p className="muted">{tipo?.nombre}</p>
          </div>
        )}

        <section className="card">
          <p className="lbl">CÓDIGO DE INCIDENCIA</p>
          <div className="fila-entre">
            <p className="codigo-incidencia">{alerta.codigo}</p>
            <BotonCopiar texto={alerta.codigo ?? ''} />
          </div>
        </section>

        {sinConfirmar && (
          <div className="caja caja-error" role="alert">
            <Icon name="alert" />
            <div>
              <strong>La central aún no confirma tu alerta</strong>
              <p>Tu alerta está registrada, pero nadie la ha recibido todavía. Si necesitas ayuda ahora, llama.</p>
              <a href="tel:105" className="btn btn-primario btn-bloque" style={{ marginTop: 12 }}><Icon name="phone" /> Llamar al 105</a>
            </div>
          </div>
        )}

        {recienEnviada && !sinConfirmar && (
          <div className="caja">
            <Icon name="shield" />
            <div>
              <strong>Recomendación de seguridad</strong>
              <p>Busca un lugar seguro y mantén tu celular contigo. Si la situación empeora, llama al <a href="tel:105">105</a>.</p>
            </div>
          </div>
        )}

        <section className="card" aria-labelledby="titulo-linea">
          <div className="fila-entre">
            <h2 id="titulo-linea" className="lbl">ESTADO ACTUAL</h2>
            <span className={`chip-vivo${enVivo ? ' on' : ''}`}>
              <span className="punto-gps" aria-hidden="true" />{enVivo ? 'En vivo' : 'Conectando…'}
            </span>
          </div>
          <LineaTiempo alerta={alerta} historial={historial} />
        </section>

        <section className="card" aria-labelledby="titulo-evidencias">
          <div className="fila-entre">
            <h2 id="titulo-evidencias" className="lbl">EVIDENCIAS</h2>
            {subiendo > 0 && <span className="texto-chico"><span className="spinner spinner-sm" /> Subiendo {subiendo}…</span>}
          </div>
          <ListaEvidencias alertaId={alerta.id} vacio="Puedes agregar fotos, videos o audios si es seguro hacerlo." />
          {activa && (
            <Link to={`/app/alertas/${alerta.id}/evidencia`} className="btn btn-contorno btn-bloque">
              <Icon name="camera" /> Agregar evidencia (opcional)
            </Link>
          )}
        </section>

        <div className="acciones-fila">
          <Button variante="contorno" onClick={actualizar} cargando={actualizando}><Icon name="refresh" /> Actualizar</Button>
          <Link to="/app" className="btn btn-contorno"><Icon name="home" /> Ir al inicio</Link>
        </div>
      </div>

      <div className="estado-col-der">
        <section className="card tarjeta-mapa" aria-label="Ubicación de la alerta y de la unidad">
          <div className="mapa-envoltura">
            <Mapa pin={pin} unidad={posUnidad} interactivo etiqueta="Mapa con la ubicación de tu alerta y de la unidad asignada" className="mapa-estado" />
            {minutos != null && activa && (
              <span className="chip-mapa"><Icon name="clock" size={14} /> Llega en ~{minutos} min · {(metros! / 1000).toFixed(1)} km</span>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="titulo-detalle">
          <h2 id="titulo-detalle" className="lbl">DETALLE DE LA ATENCIÓN</h2>
          <dl className="detalle">
            {unidad ? (
              <>
                <Dato icono="car" etiqueta="Unidad asignada" valor={`Unidad ${unidad.codigo} · Patrullero ${unidad.placa}`} />
                <Dato icono="user" etiqueta="Efectivo a cargo" valor={`${unidad.efectivo_cargo}${unidad.comisaria ? ` · ${unidad.comisaria.nombre}` : ''}`} />
              </>
            ) : (
              <Dato icono="clock" etiqueta="Unidad asignada" valor={activa ? 'Pendiente: la central está evaluando tu alerta' : 'Sin unidad asignada'} />
            )}
            <Dato icono={iconoTipo(tipo?.icono ?? '')} etiqueta="Tipo de incidente" valor={tipo?.nombre ?? '—'} />
            <Dato icono="map-pin" etiqueta="Ubicación" valor={alerta.direccion ?? `${alerta.latitud.toFixed(5)}, ${alerta.longitud.toFixed(5)}`}
              extra={alerta.ubicacion_manual ? 'Ubicación ajustada manualmente' : alerta.precision_m ? `GPS ±${Math.round(alerta.precision_m)} m` : undefined} />
            <Dato icono="info" etiqueta="Estado actual" valor={ETIQUETA_CORTA[alerta.estado]} />
            <Dato icono="clock" etiqueta="Enviada" valor={fechaHora(alerta.generada_en)} />
          </dl>
          {unidad?.telefono && activa && (
            <a href={`tel:${unidad.telefono.replace(/\s/g, '')}`} className="btn btn-primario btn-bloque">
              <Icon name="phone" /> Contactar a la unidad
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  }
  return (
    <button type="button" className="btn-icono" onClick={copiar} aria-label={copiado ? 'Código copiado' : 'Copiar código'}>
      <Icon name={copiado ? 'check' : 'copy'} />
    </button>
  );
}
