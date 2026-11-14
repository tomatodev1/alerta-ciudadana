import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UbicacionProvider, useUbicacion, type EstadoGps } from '@/hooks/useUbicacion';
import { PreferenciasProvider } from '@/hooks/usePreferencias';
import { NotificacionesProvider, useNotificaciones } from '@/hooks/useNotificaciones';
import { EvidenciasProvider } from '@/hooks/useEvidencias';
import { ColaSinConexionProvider, useColaSinConexion } from '@/hooks/useColaSinConexion';
import { Icon, type IconName } from '@/components/ui/Icon';

const LINKS: { to: string; label: string; icono: IconName; end: boolean }[] = [
  { to: '/app', label: 'Inicio', icono: 'home', end: true },
  { to: '/app/alertas', label: 'Mis alertas', icono: 'list', end: false },
  { to: '/app/notificaciones', label: 'Notificaciones', icono: 'bell', end: false },
  { to: '/app/perfil', label: 'Perfil', icono: 'user', end: false },
];

const TEXTO_GPS: Record<EstadoGps, string> = {
  ok: 'GPS activo',
  buscando: 'Buscando GPS…',
  denegado: 'GPS sin permiso',
  'no-disponible': 'GPS no disponible',
};

/** Barra superior en escritorio y barra inferior en celular (sitio responsive). */
export function AppLayout() {
  return (
    <PreferenciasProvider>
      <NotificacionesProvider>
        <UbicacionProvider>
          <EvidenciasProvider>
            <ColaSinConexionProvider>
              <Estructura />
            </ColaSinConexionProvider>
          </EvidenciasProvider>
        </UbicacionProvider>
      </NotificacionesProvider>
    </PreferenciasProvider>
  );
}

function Estructura() {
  const { perfil } = useAuth();
  const { estado } = useUbicacion();
  const { noLeidas } = useNotificaciones();
  const { enLinea, pendientes } = useColaSinConexion();
  const { pathname } = useLocation();
  const etiqueta = (l: (typeof LINKS)[number]) => (
    <>
      {l.label}
      {l.to === '/app/notificaciones' && noLeidas > 0 && (
        <span className="contador-nav" aria-label={`${noLeidas} sin leer`}>{noLeidas > 9 ? '9+' : noLeidas}</span>
      )}
    </>
  );
  const iniciales = perfil ? (perfil.nombres[0] ?? '') + (perfil.apellidos[0] ?? '') : '';
  const nombreCorto = perfil ? `${titulo(perfil.nombres.split(' ')[0])} ${titulo(perfil.apellidos.split(' ')[0])}` : '';

  return (
    <div className="app">
      <a href="#contenido" className="skip-link-app">Saltar al contenido</a>
      <header className="topbar">
        <Link to="/app" className="brand"><span className="brand-logo"><Icon name="shield" size={18} /></span>AlertaCiudadana</Link>
        <nav className="topnav" aria-label="Secciones">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'on' : '')}>{etiqueta(l)}</NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <span className={`chip-estado gps-${estado}`} role="status">
            <span className="punto-gps" aria-hidden="true" />{TEXTO_GPS[estado]}
          </span>
          <Link to="/app/perfil" className="cuenta" aria-label={`Tu cuenta: ${nombreCorto}`}>
            <span className="avatar" aria-hidden="true">{iniciales.toUpperCase()}</span>
            <span className="cuenta-texto">
              <strong>{nombreCorto}</strong>
              <small>{perfil?.estado_verificacion === 'verificada' ? 'Cuenta verificada' : 'Sin verificar'}</small>
            </span>
          </Link>
        </div>
      </header>
      {(!enLinea || (pendientes.length > 0 && pathname !== '/app/sin-conexion')) && (
        <div className={`banner-conexion${enLinea ? '' : ' sin-red'}`} role="status">
          <Icon name={enLinea ? 'refresh' : 'wifi-off'} size={18} />
          <span>
            {!enLinea && 'Sin conexión. '}
            {pendientes.length > 0
              ? `${pendientes.length === 1 ? 'Tienes 1 alerta guardada' : `Tienes ${pendientes.length} alertas guardadas`} que se enviará${pendientes.length === 1 ? '' : 'n'} al volver la señal.`
              : 'Si envías una alerta, se guardará y se enviará sola al volver la señal.'}
          </span>
          {pendientes.length > 0 && pathname !== '/app/sin-conexion' && <Link to="/app/sin-conexion">Ver</Link>}
        </div>
      )}
      <main className="app-main" id="contenido"><Outlet /></main>
      <nav className="bottomnav" aria-label="Navegación principal">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="icono-nav"><Icon name={l.icono} />{l.to === '/app/notificaciones' && noLeidas > 0 && <span className="punto-nav" aria-hidden="true" />}</span>
            {l.label}{l.to === '/app/notificaciones' && noLeidas > 0 && <span className="oculto-visual"> ({noLeidas} sin leer)</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const titulo = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
