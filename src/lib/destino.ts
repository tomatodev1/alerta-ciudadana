import type { Perfil } from '@/types/database.types';

/** A dónde va cada usuario después de iniciar sesión. */
export function rutaInicio(perfil: Pick<Perfil, 'rol' | 'estado_verificacion'>, desde?: string) {
  if (perfil.rol === 'operador' || perfil.rol === 'admin') {
    return desde?.startsWith('/central') ? desde : '/central';
  }
  if (perfil.estado_verificacion !== 'verificada') return '/registro';
  return desde?.startsWith('/app') ? desde : '/app';
}
