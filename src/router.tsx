import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { CentralLayout } from '@/components/layout/CentralLayout';
import LoginPage from '@/features/auth/LoginPage';
import RecuperarPage from '@/features/auth/RecuperarPage';
import RegistroPage from '@/features/registro/RegistroPage';
import InicioSosPage from '@/features/alertas/InicioSosPage';
import NuevaAlertaPage from '@/features/alertas/NuevaAlertaPage';
import EstadoAlertaPage from '@/features/alertas/EstadoAlertaPage';
import AgregarEvidenciaPage from '@/features/evidencias/AgregarEvidenciaPage';
import MisAlertasPage from '@/features/alertas/MisAlertasPage';
import SinConexionPage from '@/features/alertas/SinConexionPage';
import NotificacionesPage from '@/features/notificaciones/NotificacionesPage';
import PerfilPage from '@/features/perfil/PerfilPage';
import BandejaPage from '@/features/central/BandejaPage';
import DetalleAlertaCentralPage from '@/features/central/DetalleAlertaCentralPage';
import NoEncontradaPage from '@/features/NoEncontradaPage';

export const router = createBrowserRouter([
  // Públicas
  // La landing se carga aparte: así Bootstrap no entra en el bundle del sistema.
  { path: '/', lazy: async () => ({ Component: (await import('@/features/landing/LandingPage')).default }) },
  { path: '/ingresar', element: <LoginPage /> },
  { path: '/recuperar', element: <RecuperarPage /> },
  { path: '/registro', element: <RegistroPage /> },

  // Ciudadano con identidad verificada (RF-16)
  {
    element: <ProtectedRoute roles={['ciudadano']} verificado />,
    children: [{
      path: '/app',
      element: <AppLayout />,
      children: [
        { index: true, element: <InicioSosPage /> },
        { path: 'alerta/nueva', element: <NuevaAlertaPage /> },
        { path: 'alertas', element: <MisAlertasPage /> },
        { path: 'alertas/:id', element: <EstadoAlertaPage /> },
        { path: 'alertas/:id/evidencia', element: <AgregarEvidenciaPage /> },
        { path: 'sin-conexion', element: <SinConexionPage /> },
        { path: 'notificaciones', element: <NotificacionesPage /> },
        { path: 'perfil', element: <PerfilPage /> },
      ],
    }],
  },

  // Central 105 (rol operador)
  {
    element: <ProtectedRoute roles={['operador', 'admin']} />,
    children: [{
      path: '/central',
      element: <CentralLayout />,
      children: [
        { index: true, element: <BandejaPage /> },
        { path: 'alertas/:id', element: <DetalleAlertaCentralPage /> },
      ],
    }],
  },

  { path: '*', element: <NoEncontradaPage /> },
]);
