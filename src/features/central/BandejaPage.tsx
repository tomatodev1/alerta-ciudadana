import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cargando } from '@/components/ui/Cargando';
import { Icon } from '@/components/ui/Icon';
import { MapaBandeja } from '@/components/map/MapaBandeja';
import { transcurrido, useAhora } from '@/hooks/useAhora';
import type { EstadoAlerta } from '@/types/database.types';
import { ETIQUETA_CORTA, esActiva, iconoTipo, useTipos } from '@/features/alertas/comun';
import { PRIORIDAD, useBandeja, type AlertaBandeja } from './datos';

type Filtro = 'activas' | 'cerradas' | 'todas';

/** Panel de la Central 105: bandeja de alertas en tiempo real. */
export default function BandejaPage() {
  const [sonido, setSonido] = useState(() => { try { return localStorage.getItem('ac-sonido') !== 'no'; } catch { return true; } });
  const { alertas, unidades, enVivo, nuevas } = useBandeja({ sonido });
  const { tipos } = useTipos();
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const ahora = useAhora(15_000);
  const navigate = useNavigate();

  const prioridadDe = (a: AlertaBandeja) => tipos?.find((t) => t.id === a.tipo_id)?.prioridad ?? 2;

  const conteo = useMemo(() => {
    const c: Partial<Record<EstadoAlerta, number>> = {};
    alertas?.forEach((a) => { c[a.estado] = (c[a.estado] ?? 0) + 1; });
    return c;
  }, [alertas]);
  const activas = (alertas ?? []).filter((a) => esActiva(a.estado));

  const lista = useMemo(() => {
    const base = (alertas ?? []).filter((a) => filtro === 'todas' || (filtro === 'activas') === esActiva(a.estado));
    // Activas: primero las más urgentes y, entre ellas, las que llevan más tiempo esperando.
    return filtro === 'activas'
      ? [...base].sort((a, b) => prioridadDe(a) - prioridadDe(b) || a.recibida_en.localeCompare(b.recibida_en))
      : base;
  }, [alertas, filtro, tipos]);

  // Pendientes de atender en el título de la pestaña
  useEffect(() => {
    const pendientes = (conteo.enviada ?? 0) + (conteo.recibida ?? 0);
    document.title = pendientes ? `(${pendientes}) Central 105 · AlertaCiudadana` : 'Central 105 · AlertaCiudadana';
    return () => { document.title = 'AlertaCiudadana · MININTER / PNP'; };
  }, [conteo]);

  function cambiarSonido() {
    setSonido((v) => {
      try { localStorage.setItem('ac-sonido', v ? 'no' : 'si'); } catch { /* sin almacenamiento */ }
      return !v;
    });
  }

  if (!alertas) return <Cargando texto="Cargando la bandeja…" />;

  const disponibles = unidades.filter((u) => u.estado === 'disponible').length;

  return (
    <div className="contenedor bandeja">
      <div className="bandeja-cabecera">
        <div>
          <h1>Bandeja de alertas</h1>
          <p className="texto-chico">
            <span className={`chip-vivo${enVivo ? ' on' : ''}`}><span className="punto-gps" aria-hidden="true" />{enVivo ? 'En vivo' : 'Conectando…'}</span>
            · Unidades disponibles: {disponibles} de {unidades.length}
          </p>
        </div>
        <button type="button" className="btn btn-contorno btn-chico" onClick={cambiarSonido} aria-pressed={sonido}>
          <Icon name="bell" size={18} /> Sonido {sonido ? 'activado' : 'desactivado'}
        </button>
      </div>

      <ul className="contadores" aria-label="Resumen de alertas">
        <li><strong>{(conteo.enviada ?? 0) + (conteo.recibida ?? 0)}</strong><span>Por atender</span></li>
        <li><strong>{conteo.en_evaluacion ?? 0}</strong><span>En evaluación</span></li>
        <li><strong>{conteo.en_atencion ?? 0}</strong><span>En atención</span></li>
        <li><strong>{conteo.finalizada ?? 0}</strong><span>Finalizadas</span></li>
      </ul>

      <div className="bandeja-cuerpo">
        <section aria-labelledby="titulo-lista">
          <h2 id="titulo-lista" className="oculto-visual">Lista de alertas</h2>
          <div className="filtros" role="group" aria-label="Filtrar alertas">
            {(['activas', 'cerradas', 'todas'] as Filtro[]).map((f) => (
              <button key={f} type="button" aria-pressed={filtro === f} className={filtro === f ? 'on' : ''} onClick={() => setFiltro(f)}>
                {f === 'activas' ? `Activas (${activas.length})` : f === 'cerradas' ? 'Cerradas' : 'Todas'}
              </button>
            ))}
          </div>

          {lista.length === 0 ? (
            <div className="card vacio">
              <Icon name="check-circle" size={28} />
              <p>{filtro === 'activas' ? 'No hay alertas activas. Las nuevas aparecerán aquí automáticamente.' : 'No hay alertas para mostrar.'}</p>
            </div>
          ) : (
            <ul className="items-bandeja" aria-live="polite">
              {lista.map((a) => {
                const tipo = tipos?.find((t) => t.id === a.tipo_id);
                const p = prioridadDe(a);
                return (
                  <li key={a.id}>
                    <Link to={`/central/alertas/${a.id}`} className={`item-bandeja p${p}${nuevas.has(a.id) ? ' nueva' : ''}`}>
                      <span className="icono-tipo" aria-hidden="true"><Icon name={iconoTipo(tipo?.icono ?? '')} size={20} /></span>
                      <span className="item-cuerpo">
                        <span className="item-linea">
                          <strong>{tipo?.nombre ?? 'Alerta'}</strong>
                          {nuevas.has(a.id) && <span className="insignia nueva">Nueva</span>}
                          <span className={`insignia prioridad p${p}`}>Prioridad {PRIORIDAD[p].toLowerCase()}</span>
                        </span>
                        <small>{a.codigo} · {a.ciudadano ? `${a.ciudadano.nombres} ${a.ciudadano.apellidos}` : 'Ciudadano'}</small>
                        <small>{a.direccion ?? `${a.latitud.toFixed(4)}, ${a.longitud.toFixed(4)}`}{a.ubicacion_manual ? ' · ubicación manual' : ''}</small>
                      </span>
                      <span className="item-lado">
                        <span className={`insignia estado-${a.estado}`}>{ETIQUETA_CORTA[a.estado]}</span>
                        <small>{transcurrido(a.recibida_en, ahora)}</small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card tarjeta-mapa bandeja-mapa" aria-label="Mapa de alertas activas y unidades">
          <MapaBandeja
            alertas={activas.map((a) => ({ id: a.id, lat: a.latitud, lng: a.longitud, prioridad: prioridadDe(a), titulo: `${a.codigo} · ${tipos?.find((t) => t.id === a.tipo_id)?.nombre ?? ''}` }))}
            unidades={unidades.filter((u) => u.latitud != null && u.longitud != null).map((u) => ({
              id: u.id, lat: u.latitud!, lng: u.longitud!, disponible: u.estado === 'disponible', titulo: `${u.codigo} · ${u.estado.replace(/_/g, ' ')}`,
            }))}
            onElegir={(id) => navigate(`/central/alertas/${id}`)}
            etiqueta="Mapa con las alertas activas y las unidades policiales"
            className="mapa-bandeja"
          />
          <p className="leyenda texto-chico">
            <span className="mk-alerta p1" aria-hidden="true" /> Alta
            <span className="mk-alerta p2" aria-hidden="true" /> Media
            <span className="mk-alerta p3" aria-hidden="true" /> Baja
            <span className="mk-unidad" aria-hidden="true" /> Unidad disponible
            <span className="mk-unidad ocupada" aria-hidden="true" /> Ocupada
          </p>
        </section>
      </div>
    </div>
  );
}
