import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Perfil } from '@/types/database.types';

interface AuthState {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  recargarPerfil: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const CLAVE_PERFIL = (id: string) => `ac-perfil-${id}`;

function leerPerfilGuardado(id: string): Perfil | null {
  try { return JSON.parse(localStorage.getItem(CLAVE_PERFIL(id)) ?? 'null'); } catch { return null; }
}
function guardarPerfil(id: string, perfil: Perfil | null) {
  try {
    if (perfil) localStorage.setItem(CLAVE_PERFIL(id), JSON.stringify(perfil));
    else localStorage.removeItem(CLAVE_PERFIL(id));
  } catch { /* sin almacenamiento */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarPerfil(userId: string | undefined) {
    if (!userId) { setPerfil(null); return; }
    const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      // Sin conexión: se usa la última copia guardada para que la app siga funcionando (RNF-09).
      setPerfil(leerPerfilGuardado(userId));
      return;
    }
    guardarPerfil(userId, data);
    setPerfil(data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarPerfil(data.session?.user.id);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSession(nueva);
      // Se difiere para no llamar a Supabase dentro del callback de auth.
      setTimeout(() => cargarPerfil(nueva?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const valor: AuthState = {
    session,
    perfil,
    cargando,
    recargarPerfil: () => cargarPerfil(session?.user.id),
    cerrarSesion: async () => {
      // En un equipo compartido no deben quedar datos personales guardados.
      if (session) guardarPerfil(session.user.id, null);
      await supabase.auth.signOut();
      setPerfil(null);
    },
  };
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
