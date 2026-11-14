import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const ENLACES = [
  { href: '#inicio', texto: 'Inicio' },
  { href: '#tipos', texto: 'Tipos de emergencia' },
  { href: '#alerta', texto: 'Registrar alerta' },
  { href: '#estado', texto: 'Estado de alerta' },
  { href: '#canales', texto: 'Canales oficiales' },
  { href: '#ayuda', texto: 'Ayuda' },
];

/** Aviso obligatorio de prototipo + barra de navegación con menú móvil. */
export function Navegacion() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    const alCambiarTamano = () => { if (window.innerWidth >= 992) setAbierto(false); };
    document.addEventListener('keydown', alPresionar);
    window.addEventListener('resize', alCambiarTamano);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      window.removeEventListener('resize', alCambiarTamano);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <>
      <div className="aviso-prototipo py-2" role="note">
        <div className="container d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
          <span>
            <strong>Prototipo académico (IHC – COMP1302).</strong> Esta aplicación{' '}
            <strong>NO sustituye los canales oficiales de emergencia</strong>. Ante una emergencia real llama al{' '}
            <a href="tel:105" className="fw-bold text-reset">105</a>,{' '}
            <a href="tel:116" className="fw-bold text-reset">116</a> o{' '}
            <a href="tel:106" className="fw-bold text-reset">106</a>.
          </span>
        </div>
      </div>

      <nav className="navbar navbar-expand-lg navbar-dark navbar-ac sticky-top" aria-label="Navegación principal">
        <div className="container">
          <a className="navbar-brand d-flex align-items-center gap-2 fw-bold" href="#inicio" onClick={cerrar}>
            <span className="brand-logo" aria-hidden="true"><i className="bi bi-broadcast"></i></span>
            AlertaCiudadana
          </a>
          <button
            className={`navbar-toggler${abierto ? '' : ' collapsed'}`}
            type="button"
            aria-controls="menu"
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setAbierto((v) => !v)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className={`collapse navbar-collapse${abierto ? ' show' : ''}`} id="menu">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
              {ENLACES.map((e) => (
                <li className="nav-item" key={e.href}>
                  <a className="nav-link" href={e.href} onClick={cerrar}>{e.texto}</a>
                </li>
              ))}
              <li className="nav-item ms-lg-2 mt-2 mt-lg-0">
                <Link className="btn btn-light btn-sm fw-semibold" to="/ingresar">
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i> Ingresar al sistema
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  );
}
