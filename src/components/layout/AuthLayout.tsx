import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';

interface Props {
  /** Texto + enlace de la esquina superior derecha (escritorio). */
  esquina?: ReactNode;
  /** Panel izquierdo (solo escritorio). */
  lado: ReactNode;
  /** Encabezado propio en celular (C03–C09): título, subtítulo y a dónde vuelve la flecha. */
  movil?: { titulo: string; subtitulo?: string; volver: string | (() => void) };
  /** Barra de progreso del registro (celular). */
  progreso?: { actual: number; total: number };
  /** Formulario más ancho (registro con 2 columnas). */
  amplio?: boolean;
  children: ReactNode;
}

/** Layout de las pantallas públicas del sistema: login, recuperar y registro (E02–E09 / C01–C09). */
export function AuthLayout({ esquina, lado, movil, progreso, amplio, children }: Props) {
  const navigate = useNavigate();
  const volver = () => {
    if (!movil) return;
    if (typeof movil.volver === 'string') navigate(movil.volver);
    else movil.volver();
  };

  return (
    <div className={`auth${amplio ? ' ancho-amplio' : ''}`}>
      <header className={`auth-top${movil ? ' con-movil' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-logo" aria-hidden="true"><Icon name="shield" size={18} /></span>
          <span>AlertaCiudadana<small className="brand-sub">MININTER / PNP</small></span>
        </Link>
        {esquina && <div className="auth-esquina">{esquina}</div>}
      </header>

      {movil && (
        <header className="auth-movil">
          <button type="button" className="btn-icono" onClick={volver} aria-label="Volver">
            <Icon name="arrow-left" size={22} />
          </button>
          <div>
            <p className="auth-movil-titulo">{movil.titulo}</p>
            {movil.subtitulo && <p className="auth-movil-sub">{movil.subtitulo}</p>}
          </div>
        </header>
      )}
      {progreso && (
        <div className="auth-progreso" role="progressbar" aria-label="Progreso del registro"
          aria-valuemin={1} aria-valuemax={progreso.total} aria-valuenow={progreso.actual}>
          {Array.from({ length: progreso.total }, (_, i) => (
            <span key={i} className={i < progreso.actual ? 'on' : ''} />
          ))}
        </div>
      )}

      <div className="auth-cuerpo">
        <aside className="auth-lado">
          <div className="auth-lado-contenido">{lado}</div>
          <p className="auth-peligro">¿Estás en peligro ahora? Llama al <a href="tel:105"><strong>105</strong></a>.</p>
        </aside>
        <main className="auth-main" id="contenido">
          <div className="auth-form">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Lista con checks del panel lateral. */
export function ListaChecks({ items }: { items: { titulo: string; texto: string }[] }) {
  return (
    <ul className="lista-checks">
      {items.map((i) => (
        <li key={i.titulo}>
          <span className="check-circulo" aria-hidden="true"><Icon name="check" size={14} /></span>
          <span><strong>{i.titulo}</strong><small>{i.texto}</small></span>
        </li>
      ))}
    </ul>
  );
}

/** Aviso "¿Emergencia sin cuenta?" con botón para llamar al 105. */
export function AvisoEmergencia({ texto = '¿Emergencia sin cuenta? Llama directamente a la Central 105.' }: { texto?: string }) {
  return (
    <div className="aviso-emergencia">
      <Icon name="phone" />
      <span>{texto}</span>
      <a href="tel:105" className="btn btn-primario btn-chico">Llamar</a>
    </div>
  );
}
