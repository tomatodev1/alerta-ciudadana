import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  etiqueta: string;
  descripcion?: ReactNode;
  icono?: IconName;
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  deshabilitado?: boolean;
}

/** Interruptor (role="switch") con etiqueta visible; toda la fila es el área táctil. */
export function Interruptor({ etiqueta, descripcion, icono, activo, onCambiar, deshabilitado }: Props) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-labelledby={`${id}-e`}
      aria-describedby={descripcion ? `${id}-d` : undefined}
      className="interruptor"
      onClick={() => onCambiar(!activo)}
      disabled={deshabilitado}
    >
      {icono && <Icon name={icono} className="interruptor-icono" />}
      <span className="interruptor-texto">
        <span id={`${id}-e`}>{etiqueta}</span>
        {descripcion && <small id={`${id}-d`}>{descripcion}</small>}
      </span>
      <span className={`interruptor-pista${activo ? ' on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
}
