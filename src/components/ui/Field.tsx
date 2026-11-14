import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  ayuda?: ReactNode;
  /** Ícono decorativo a la izquierda del campo. */
  icono?: IconName;
  /** Elemento a la derecha (p. ej. botón mostrar contraseña o un check de validado). */
  accion?: ReactNode;
}

/** Campo con etiqueta visible y mensaje de error accesible. */
export function Field({ label, error, ayuda, icono, accion, className = '', ...rest }: Props) {
  const id = useId();
  const desc = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className={`field ${error ? 'field-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`field-control${icono ? ' con-icono' : ''}${accion ? ' con-accion' : ''}`}>
        {icono && <Icon name={icono} className="field-icono" />}
        <input id={id} aria-invalid={!!error} aria-describedby={desc} {...rest} />
        {accion && <span className="field-accion">{accion}</span>}
      </div>
      {error ? <p id={desc} className="field-msg error" role="alert">{error}</p>
        : ayuda ? <p id={desc} className="field-msg">{ayuda}</p> : null}
    </div>
  );
}
