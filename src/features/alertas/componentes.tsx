import { Icon, type IconName } from '@/components/ui/Icon';
import type { Alerta, AlertaEstado } from '@/types/database.types';
import { ETIQUETA_ESTADO, ORDEN_ESTADOS, hora } from './comun';

/** Línea de tiempo del estado de una alerta (RF-10). La usan el ciudadano y la central. */
export function LineaTiempo({ alerta, historial }: { alerta: Alerta; historial: AlertaEstado[] }) {
  if (alerta.estado === 'cancelada') {
    const h = historial.find((x) => x.estado === 'cancelada');
    return <p className="caja caja-error" style={{ margin: 0 }}>Esta alerta fue cancelada{h ? ` a las ${hora(h.creado_en)}` : ''}.</p>;
  }
  const actual = ORDEN_ESTADOS.indexOf(alerta.estado);
  return (
    <ol className="linea-tiempo">
      {ORDEN_ESTADOS.map((e, i) => {
        const registro = historial.find((x) => x.estado === e);
        const clase = i < actual || (i === actual && e === 'finalizada') ? 'hecho' : i === actual ? 'actual' : 'pendiente';
        return (
          <li key={e} className={clase} aria-current={clase === 'actual' ? 'step' : undefined}>
            <span className="punto" aria-hidden="true">{clase === 'hecho' && <Icon name="check" size={12} />}</span>
            <span className="linea-texto">
              <strong>{ETIQUETA_ESTADO[e]}</strong>
              {registro?.nota && <small>{registro.nota}</small>}
              <span className="oculto-visual">{clase === 'hecho' ? '(completado)' : clase === 'actual' ? '(estado actual)' : '(pendiente)'}</span>
            </span>
            <span className="linea-hora">{registro ? hora(registro.creado_en) : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Dato({ icono, etiqueta, valor, extra }: { icono: IconName; etiqueta: string; valor: string; extra?: string }) {
  return (
    <div className="dato">
      <Icon name={icono} size={18} />
      <div>
        <dt>{etiqueta}</dt>
        <dd>{valor}{extra && <small>{extra}</small>}</dd>
      </div>
    </div>
  );
}
