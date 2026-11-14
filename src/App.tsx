import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { Cargando } from '@/components/ui/Cargando';
import { router } from '@/router';

export default function App() {
  return (
    <AuthProvider>
      {/* fallbackElement: se muestra mientras carga una ruta diferida (la landing). */}
      <RouterProvider router={router} fallbackElement={<Cargando />} />
    </AuthProvider>
  );
}
