import { useState, type InputHTMLAttributes } from 'react';
import { Field } from './Field';
import { Icon } from './Icon';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  ayuda?: string;
}

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function CampoContrasena(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      icono="lock"
      accion={
        <button type="button" className="btn-icono" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
          <Icon name={visible ? 'eye-off' : 'eye'} />
        </button>
      }
    />
  );
}
