import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { RolUsuario } from '@/types/database.types';
import { Cargando } from '@/components/ui/Cargando';

interface Props {
  /** Roles permitidos. Si se omite, basta con tener sesión. */
  roles?: RolUsuario[];
  /** Exige que la identidad esté verificada (RF-16). */
  verificado?: boolean;
}

export function ProtectedRoute({ roles, verificado = false }: Props) {
  const { session, perfil, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Cargando />;
  if (!session) return <Navigate to="/ingresar" replace state={{ desde: location.pathname }} />;
  if (!perfil) return <Cargando texto="Cargando tu perfil…" />;
  if (roles && !roles.includes(perfil.rol)) return <Navigate to="/" replace />;
  if (verificado && perfil.estado_verificacion !== 'verificada') return <Navigate to="/registro" replace />;
  return <Outlet />;
}
