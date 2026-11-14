import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { usePreferencias } from './usePreferencias';
import type { Notificacion } from '@/types/database.types';

interface Estado {
  notificaciones: Notificacion[] | null;
  noLeidas: number;
  marcarLeida: (id: number) => Promise<void>;
  marcarTodas: () => Promise<void>;
}

const Contexto = createContext<Estado | null>(null);

export const navegadorPermiteAvisos = () => typeof window !== 'undefined' && 'Notification' in window;

/**
 * Notificaciones del ciudadano. Las crea el trigger registrar_estado en cada cambio de estado
 * de sus alertas; aquí se reciben en tiempo real y, si el ciudadano lo permite, también como
 * notificación del navegador.
 */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const { prefs } = usePreferencias();
  const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null);
  const avisarNavegador = useRef(prefs.notif_navegador);
  avisarNavegador.current = prefs.notif_navegador;

  useEffect(() => {
    if (!perfil) return;
    supabase.from('notificaciones').select('*').eq('usuario_id', perfil.id)
      .order('creado_en', { ascending: false }).limit(50)
      .then(({ data }) => setNotificaciones(data ?? []));

    const canal = supabase
      .channel(`notificaciones-${perfil.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${perfil.id}` }, (p) => {
        const n = p.new as Notificacion;
        setNotificaciones((prev) => (prev?.some((x) => x.id === n.id) ? prev : [n, ...(prev ?? [])]));
        if (avisarNavegador.current && navegadorPermiteAvisos() && Notification.permission === 'granted' && document.hidden) {
          try {
            const aviso = new Notification(n.titulo, { body: n.mensaje, tag: `notif-${n.id}` });
            aviso.onclick = () => { window.focus(); if (n.alerta_id) window.location.assign(`/app/alertas/${n.alerta_id}`); };
          } catch { /* algunos navegadores móviles solo permiten avisos desde un service worker */ }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${perfil.id}` }, (p) => {
        const n = p.new as Notificacion;
        setNotificaciones((prev) => prev?.map((x) => (x.id === n.id ? n : x)) ?? prev);
      })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [perfil]);

  const marcarLeida = useCallback(async (id: number) => {
    setNotificaciones((prev) => prev?.map((x) => (x.id === id ? { ...x, leida: true } : x)) ?? prev);
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
  }, []);

  const marcarTodas = useCallback(async () => {
    if (!perfil) return;
    setNotificaciones((prev) => prev?.map((x) => ({ ...x, leida: true })) ?? prev);
    await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', perfil.id).eq('leida', false);
  }, [perfil]);

  const noLeidas = notificaciones?.filter((n) => !n.leida).length ?? 0;
  return (
    <Contexto.Provider value={{ notificaciones, noLeidas, marcarLeida, marcarTodas }}>
      {children}
    </Contexto.Provider>
  );
}

export function useNotificaciones() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useNotificaciones debe usarse dentro de <NotificacionesProvider>');
  return ctx;
}
