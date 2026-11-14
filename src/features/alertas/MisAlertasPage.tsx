import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import type { Alerta } from '@/types/database.types';
import { ETIQUETA_CORTA, esActiva, fechaCorta, hora, iconoTipo, useTipos } from './comun';

type Fila = Pick<Alerta, 'id' | 'codigo' | 'tipo_id' | 'estado' | 'recibida_en' | 'direccion' | 'latitud' | 'longitud'>;
type Filtro = 'todas' | 'en-curso' | 'finalizadas';

/** E16 / C18 · Mis alertas: historial de las alertas del ciudadano. */
export default function MisAlertasPage() {
  const { perfil } = useAuth();
  const { tipos } = useTipos();
  const [alertas, setAlertas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    if (!perfil) return;
    supabase.from('alertas').select('id, codigo, tipo_id, estado, recibida_en, direccion, latitud, longitud')
      .eq('ciudadano_id', perfil.id).order('recibida_en', { ascending: false }).limit(100)
      .then(({ data, error: e }) => { if (e) setError(true); else setAlertas(data ?? []); });
  }, [perfil]);

  const visibles = useMemo(() => (alertas ?? []).filter((a) =>
    filtro === 'todas' || (filtro === 'en-curso' ? esActiva(a.estado) : !esActiva(a.estado))), [alertas, filtro]);

  return (
    <div className="contenedor pagina-lista">
      <div className="fila-entre cabecera-pagina">
        <div>
          <h1>Mis alertas</h1>
          <p className="muted">
            {alertas ? `${alertas.length} ${alertas.length === 1 ? 'alerta reportada' : 'alertas reportadas'} desde tu cuenta` : 'Cargando…'}
          </p>
        </div>
        <div className="filtros" role="group" aria-label="Filtrar alertas">
          {([['todas', 'Todas'], ['en-curso', 'En curso'], ['finalizadas', 'Finalizadas']] as [Filtro, string][]).map(([f, t]) => (
            <button key={f} type="button" aria-pressed={filtro === f} className={filtro === f ? 'on' : ''} onClick={() => setFiltro(f)}>
              {filtro === f && <Icon name="check" size={16} />} {t}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alerta-form" role="alert">No pudimos cargar tus alertas. Revisa tu conexión.</p>}
      {!alertas && !error && <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando tus alertas…</p>}

      {alertas && visibles.length === 0 && (
        <div className="card vacio">
          <Icon name="list" size={28} />
          <p>{alertas.length === 0 ? 'Aún no has enviado alertas.' : 'No hay alertas con este filtro.'}</p>
          {alertas.length === 0 && <Link to="/app" className="btn btn-primario">Ir al inicio</Link>}
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="lista-historial">
          {visibles.map((a) => {
            const tipo = tipos?.find((t) => t.id === a.tipo_id);
            return (
              <li key={a.id}>
                <Link to={`/app/alertas/${a.id}`} className="fila-historial">
                  <span className="icono-tipo" aria-hidden="true"><Icon name={iconoTipo(tipo?.icono ?? '')} size={20} /></span>
                  <span className="historial-principal">
                    <strong>{tipo?.nombre ?? 'Alerta'}</strong>
                    <small>{a.codigo}</small>
                  </span>
                  <span className="historial-fecha">{fechaCorta(a.recibida_en)} · {hora(a.recibida_en)}</span>
                  <span className="historial-dir">
                    <Icon name="map-pin" size={14} />
                    {a.direccion ?? `${a.latitud.toFixed(4)}, ${a.longitud.toFixed(4)}`}
                  </span>
                  <span className={`insignia estado-${a.estado}`}>{ETIQUETA_CORTA[a.estado]}</span>
                  <Icon name="chevron-right" className="historial-flecha" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
