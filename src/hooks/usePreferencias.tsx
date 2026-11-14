import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Preferencias } from '@/types/database.types';

type Valores = Omit<Preferencias, 'usuario_id'>;

const POR_DEFECTO: Valores = { comando_voz: true, texto_grande: false, notif_navegador: true, notif_sms: true, notif_correo: false };
const CLAVE_LOCAL = 'ac-texto-grande';

interface Estado {
  prefs: Valores;
  cambiar: (cambios: Partial<Valores>) => Promise<boolean>;
}

const Contexto = createContext<Estado | null>(null);

function aplicarTextoGrande(activo: boolean) {
  document.documentElement.classList.toggle('texto-grande', activo);
  try { localStorage.setItem(CLAVE_LOCAL, activo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
}

/** Preferencias del ciudadano (tabla preferencias). Aplica "texto grande" a toda la interfaz. */
export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [prefs, setPrefs] = useState<Valores>(() => {
    let grande = false;
    try { grande = localStorage.getItem(CLAVE_LOCAL) === 'si'; } catch { /* sin almacenamiento */ }
    return { ...POR_DEFECTO, texto_grande: grande };
  });

  useEffect(() => {
    if (!perfil) return;
    supabase.from('preferencias').select('*').eq('usuario_id', perfil.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const { usuario_id: _id, ...valores } = data;
      setPrefs(valores);
    });
  }, [perfil]);

  // Se aplica mientras el ciudadano está en /app y se quita al salir (la landing tiene su propio estilo).
  useEffect(() => {
    aplicarTextoGrande(prefs.texto_grande);
    return () => document.documentElement.classList.remove('texto-grande');
  }, [prefs.texto_grande]);

  const cambiar = useCallback(async (cambios: Partial<Valores>) => {
    if (!perfil) return false;
    const previas = prefs;
    const nuevas = { ...prefs, ...cambios };
    setPrefs(nuevas);   // respuesta inmediata en pantalla
    const { error } = await supabase.from('preferencias').upsert({ usuario_id: perfil.id, ...nuevas });
    if (error) { setPrefs(previas); return false; }
    return true;
  }, [perfil, prefs]);

  return <Contexto.Provider value={{ prefs, cambiar }}>{children}</Contexto.Provider>;
}

export function usePreferencias() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('usePreferencias debe usarse dentro de <PreferenciasProvider>');
  return ctx;
}
