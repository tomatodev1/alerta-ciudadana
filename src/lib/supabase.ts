import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local');
}

/* "Mantener sesión iniciada": si está activo la sesión se guarda en localStorage
   (sobrevive al cerrar el navegador); si no, en sessionStorage. */
const CLAVE_RECORDAR = 'ac-recordar-sesion';

function leerRecordar() {
  try { return localStorage.getItem(CLAVE_RECORDAR) !== 'no'; } catch { return true; }
}

export function setRecordarSesion(recordar: boolean) {
  try { localStorage.setItem(CLAVE_RECORDAR, recordar ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
}

const almacen: SupportedStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try {
      if (leerRecordar()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
      else { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
    } catch { /* sin almacenamiento */ }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* sin almacenamiento */ }
  },
};

/** true si la página se abrió desde el enlace "restablecer contraseña" del correo.
 *  Se lee antes de crear el cliente, porque el cliente limpia la URL al procesarla. */
export const llegoDeRecuperacion =
  typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search);

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: almacen },
});
