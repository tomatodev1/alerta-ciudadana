import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'contorno' | 'sos' | 'texto';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  cargando?: boolean;
}

/** Botón según la guía de estilos: rojo solo para SOS (sección 8.2). */
export function Button({ variante = 'primario', cargando, children, className = '', disabled, ...rest }: Props) {
  return (
    <button className={`btn btn-${variante} ${className}`} disabled={disabled || cargando} {...rest}>
      {cargando ? <span className="spinner spinner-sm" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
