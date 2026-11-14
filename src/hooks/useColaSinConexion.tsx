import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { NuevaAlerta } from '@/types/database.types';

/** Alerta lista para insertar. El id lo genera el dispositivo: si un reintento llega dos veces, no se duplica. */
export type DatosAlerta = NuevaAlerta & { id: string };

export interface AlertaPendiente {
  datos: DatosAlerta;
  tipoNombre: string;
  guardadaEn: string;
  intentos: number;
  error?: string;
}

interface Estado {
  pendientes: AlertaPendiente[];
  /** id local → id en el servidor de las alertas que ya se enviaron desde la cola */
  enviadas: Record<string, string>;
  enLinea: boolean;
  guardar: (datos: DatosAlerta, tipoNombre: string) => void;
  reintentarAhora: () => void;
}

const Contexto = createContext<Estado | null>(null);
const clave = (uid: string) => `ac-cola-alertas-${uid}`;
const INTERVALO_MS = 15_000;

/** ¿El error es de conexión (vale la pena reintentar) y no de permisos o datos? */
export function esErrorDeRed(mensaje?: string) {
  return !navigator.onLine || /fetch|network|failed|timeout|load failed/i.test(mensaje ?? '');
}

/** Inserta la alerta. Un id repetido (23505) significa que ya había llegado antes: cuenta como enviada. */
export async function insertarAlerta(datos: DatosAlerta): Promise<{ ok: true } | { ok: false; red: boolean; mensaje: string }> {
  const { error } = await supabase.from('alertas').insert(datos);
  if (!error || error.code === '23505') return { ok: true };
  return { ok: false, red: esErrorDeRed(error.message), mensaje: error.message };
}

/**
 * Cola de alertas que no se pudieron enviar por falta de conexión (RNF-09).
 * Se guarda en el navegador y se reintenta al volver la señal y cada 15 s.
 * Mientras la pestaña esté abierta: un service worker no puede reenviar con la sesión del usuario.
 */
export function ColaSinConexionProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [pendientes, setPendientes] = useState<AlertaPendiente[]>([]);
  const [enviadas, setEnviadas] = useState<Record<string, string>>({});
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const enCurso = useRef(false);

  // Cargar la cola guardada de este usuario
  useEffect(() => {
    if (!perfil) return;
    try { setPendientes(JSON.parse(localStorage.getItem(clave(perfil.id)) ?? '[]')); } catch { setPendientes([]); }
  }, [perfil]);

  const persistir = useCallback((lista: AlertaPendiente[]) => {
    if (!perfil) return;
    try { localStorage.setItem(clave(perfil.id), JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  }, [perfil]);

  const procesar = useCallback(async () => {
    if (enCurso.current || !navigator.onLine || !perfil) return;
    const actuales: AlertaPendiente[] = (() => {
      try { return JSON.parse(localStorage.getItem(clave(perfil.id)) ?? '[]'); } catch { return []; }
    })();
    if (!actuales.some((p) => !p.error)) return;
    enCurso.current = true;
    const restantes: AlertaPendiente[] = [];
    const nuevasEnviadas: Record<string, string> = {};
    for (const p of actuales) {
      if (p.error) { restantes.push(p); continue; }
      const r = await insertarAlerta({ ...p.datos, canal: 'reintento_sin_conexion' });
      if (r.ok) nuevasEnviadas[p.datos.id] = p.datos.id;
      else restantes.push({ ...p, intentos: p.intentos + 1, ...(r.red ? {} : { error: 'No se pudo enviar. Llama al 105.' }) });
    }
    persistir(restantes);
    setPendientes(restantes);
    if (Object.keys(nuevasEnviadas).length) setEnviadas((e) => ({ ...e, ...nuevasEnviadas }));
    enCurso.current = false;
  }, [perfil, persistir]);

  // Reintentos: al volver la conexión y cada 15 s mientras haya pendientes
  useEffect(() => {
    const online = () => { setEnLinea(true); void procesar(); };
    const offline = () => setEnLinea(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [procesar]);

  // Al abrir la app con alertas guardadas de antes, se intenta enviarlas de inmediato.
  useEffect(() => { void procesar(); }, [procesar]);

  const hayPorEnviar = pendientes.some((p) => !p.error);
  useEffect(() => {
    if (!hayPorEnviar) return;
    const t = setInterval(() => void procesar(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [hayPorEnviar, procesar]);

  const guardar = useCallback((datos: DatosAlerta, tipoNombre: string) => {
    setPendientes((prev) => {
      const lista = [...prev.filter((p) => p.datos.id !== datos.id), { datos, tipoNombre, guardadaEn: new Date().toISOString(), intentos: 1 }];
      persistir(lista);
      return lista;
    });
  }, [persistir]);

  return (
    <Contexto.Provider value={{ pendientes, enviadas, enLinea, guardar, reintentarAhora: () => void procesar() }}>
      {children}
    </Contexto.Provider>
  );
}

export function useColaSinConexion() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useColaSinConexion debe usarse dentro de <ColaSinConexionProvider>');
  return ctx;
}
