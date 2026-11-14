import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';

/** Layout del panel de la Central 105 (rol operador / admin). Pensado para escritorio, usable en tablet. */
export function CentralLayout() {
  const { perfil, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const nombre = perfil ? `${perfil.nombres} ${perfil.apellidos}` : '';

  async function salir() {
    await cerrarSesion();
    navigate('/ingresar', { replace: true });
  }

  return (
    <div className="app central">
      <a href="#contenido" className="skip-link-app">Saltar al contenido</a>
      <header className="topbar">
        <Link to="/central" className="brand">
          <span className="brand-logo"><Icon name="shield" size={18} /></span>
          <span className="brand-central">AlertaCiudadana<small>Central 105 · PNP</small></span>
        </Link>
        <nav className="topnav" aria-label="Secciones de la central">
          <NavLink to="/central" end className={({ isActive }) => (isActive ? 'on' : '')}>Bandeja</NavLink>
        </nav>
        <div className="topbar-right">
          <span className="cuenta">
            <span className="avatar" aria-hidden="true"><Icon name="user" size={18} /></span>
            <span className="cuenta-texto">
              <strong>{nombre}</strong>
              <small>{perfil?.rol === 'admin' ? 'Administrador' : 'Operador'}</small>
            </span>
          </span>
          <button type="button" className="btn btn-contorno btn-chico" onClick={salir} aria-label="Cerrar sesión">
            <Icon name="logout" size={18} /> <span className="solo-escritorio">Cerrar sesión</span>
          </button>
        </div>
      </header>
      <main className="app-main" id="contenido"><Outlet /></main>
    </div>
  );
}
