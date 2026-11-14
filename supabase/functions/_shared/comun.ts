// Utilidades compartidas por las Edge Functions (Deno).
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.45.4';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Error con mensaje pensado para mostrarse al usuario. */
export class ErrorUsuario extends Error {
  constructor(mensaje: string, public status = 400) { super(mensaje); }
}

const URL = Deno.env.get('SUPABASE_URL')!;
// Supabase inyecta estas variables en todas las Edge Functions; la secret key nunca sale del servidor.
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Cliente con service_role: ignora RLS. Solo para el servidor. */
export function clienteAdmin(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cliente público (como el navegador), útil para iniciar sesión en nombre del usuario. */
export function clientePublico(): SupabaseClient {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Devuelve el usuario dueño del token Authorization o lanza 401. */
export async function usuarioDeLaPeticion(req: Request, admin: SupabaseClient): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new ErrorUsuario('Inicia sesión para continuar.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ErrorUsuario('Tu sesión expiró. Vuelve a iniciar sesión.', 401);
  return data.user;
}

/** Envuelve el handler: CORS, solo POST, JSON y manejo de errores. */
export function servir(handler: (req: Request, cuerpo: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
    try {
      const cuerpo = await req.json().catch(() => ({}));
      return await handler(req, cuerpo as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ErrorUsuario) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Ocurrió un error inesperado. Inténtalo de nuevo.' }, 500);
    }
  });
}

export async function sha256(texto: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const esDni = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{8}$/.test(v);

/* ---------------------------------------------------------------------------
   Padrón de demostración (simula la consulta a RENIEC).
   Los DNIs que no están aquí se aceptan si el formato es válido y el usuario
   escribe sus nombres a mano. Datos ficticios.
--------------------------------------------------------------------------- */
export interface Ciudadano { nombres: string; apellidos: string; fecha_nacimiento: string; fecha_emision: string }

export const PADRON_DEMO: Record<string, Ciudadano> = {
  '12345678': { nombres: 'JUAN CARLOS', apellidos: 'PÉREZ RAMOS', fecha_nacimiento: '1995-08-12', fecha_emision: '2019-03-14' },
  '87654321': { nombres: 'MARÍA ELENA', apellidos: 'QUISPE HUAMÁN', fecha_nacimiento: '1988-02-25', fecha_emision: '2021-07-02' },
  '45678912': { nombres: 'ROSA', apellidos: 'TORRES VILLANUEVA', fecha_nacimiento: '1957-11-03', fecha_emision: '2017-05-20' },
};
