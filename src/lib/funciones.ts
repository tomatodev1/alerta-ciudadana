import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Llama a una Edge Function y devuelve su respuesta. Si la función responde con
 * { error: "..." }, lanza un Error con ese mensaje (pensado para mostrarse al usuario).
 */
export async function invocar<T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nombre, { body: cuerpo });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detalle = await (error.context as Response).json().catch(() => null);
      throw new Error(detalle?.error ?? 'El servicio no respondió correctamente.');
    }
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión.');
  }
  return data as T;
}

/** Mensajes de Supabase Auth traducidos al español. */
export function mensajeAuth(mensaje: string) {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con este correo.';
  if (m.includes('database error saving new user')) return 'No pudimos crear la cuenta: el DNI ya está registrado.';
  if (m.includes('password should be')) return 'La contraseña no cumple los requisitos mínimos.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de ingresar.';
  if (m.includes('same password') || m.includes('different from the old')) return 'La nueva contraseña debe ser distinta de la anterior.';
  if (m.includes('fetch')) return 'No pudimos conectar con el servidor. Revisa tu conexión.';
  return mensaje;
}

export function enmascararCorreo(correo: string) {
  const [u, d] = correo.split('@');
  if (!d) return correo;
  return `${u[0]}${'•'.repeat(Math.max(3, u.length - 1))}@${d}`;
}

/** "987654321" o "+51 987 654 321" → "+51987654321" (o null si no es un celular peruano). */
export function normalizarCelular(v: string) {
  const dig = v.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  return /^9\d{8}$/.test(dig) ? `+51${dig}` : null;
}
