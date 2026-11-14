import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="landing-footer py-4">
      <div className="container d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 small">
        <span>© 2026 AlertaCiudadana · Prototipo académico – Grupo 6. No sustituye los canales oficiales de emergencia.</span>
        <span className="d-flex flex-wrap gap-3">
          <Link to="/ingresar">Ingresar al sistema →</Link>
          <Link to="/registro">Crear cuenta</Link>
        </span>
      </div>
    </footer>
  );
}

/** Botón flotante "volver arriba": aparece tras bajar 400 px. */
export function BotonArriba() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alDesplazar = () => setVisible(window.scrollY > 400);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, []);

  function subir() {
    window.scrollTo({ top: 0 });
    document.querySelector<HTMLElement>('.navbar-brand')?.focus({ preventScroll: true });
  }

  return (
    <button
      type="button"
      className={`btn-arriba${visible ? ' mostrar' : ''}`}
      aria-label="Volver arriba"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={subir}
    >
      <i className="bi bi-arrow-up" aria-hidden="true"></i>
    </button>
  );
}
