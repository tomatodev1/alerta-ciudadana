import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Alerta, Perfil, Unidad } from '@/types/database.types';

export type Ciudadano = Pick<Perfil, 'id' | 'nombres' | 'apellidos' | 'dni' | 'celular' | 'estado_verificacion'>;
export type AlertaBandeja = Alerta & { ciudadano: Ciudadano | null };

const CAMPOS_CIUDADANO = 'id, nombres, apellidos, dni, celular, estado_verificacion';

export const PRIORIDAD: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' };

/**
 * Acuse de recibo: cuando la alerta llega a la pantalla de un operador conectado pasa a
 * "recibida". El filtro estado = 'enviada' evita pisar cambios si dos operadores la ven a la vez.
 */
export async function acusarRecibo(id: string) {
  await supabase.from('alertas').update({ estado: 'recibida' }).eq('id', id).eq('estado', 'enviada');
}

export async function ciudadanosDe(ids: string[]): Promise<Map<string, Ciudadano>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return new Map();
  const { data } = await supabase.from('perfiles').select(CAMPOS_CIUDADANO).in('id', unicos);
  return new Map((data ?? []).map((c) => [c.id, c as Ciudadano]));
}

/** Pitido corto con Web Audio (sin archivos). El navegador lo permite tras la primera interacción. */
export function sonarAviso() {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 660 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch { /* sin audio */ }
}

/** Bandeja en tiempo real: alertas (con su ciudadano) y unidades. */
export function useBandeja({ sonido }: { sonido: boolean }) {
  const [alertas, setAlertas] = useState<AlertaBandeja[] | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [enVivo, setEnVivo] = useState(false);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: u }] = await Promise.all([
      supabase.from('alertas').select('*').order('recibida_en', { ascending: false }).limit(200),
      supabase.from('unidades').select('*').order('codigo'),
    ]);
    const lista = a ?? [];
    const ciudadanos = await ciudadanosDe(lista.map((x) => x.ciudadano_id));
    setAlertas(lista.map((x) => ({ ...x, ciudadano: ciudadanos.get(x.ciudadano_id) ?? null })));
    setUnidades(u ?? []);
    lista.filter((x) => x.estado === 'enviada').forEach((x) => void acusarRecibo(x.id));
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => {
    const canal = supabase
      .channel('central-bandeja')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, async (p) => {
        const nueva = p.new as Alerta;
        const ciudadanos = await ciudadanosDe([nueva.ciudadano_id]);
        setAlertas((prev) => (prev?.some((x) => x.id === nueva.id) ? prev
          : [{ ...nueva, ciudadano: ciudadanos.get(nueva.ciudadano_id) ?? null }, ...(prev ?? [])]));
        setNuevas((s) => new Set(s).add(nueva.id));
        if (sonidoRef.current) sonarAviso();
        void acusarRecibo(nueva.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alertas' }, (p) => {
        const act = p.new as Alerta;
        setAlertas((prev) => prev?.map((x) => (x.id === act.id ? { ...x, ...act } : x)) ?? prev);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'unidades' }, (p) => {
        const act = p.new as Unidad;
        setUnidades((prev) => prev.map((x) => (x.id === act.id ? act : x)));
      })
      .subscribe((s) => setEnVivo(s === 'SUBSCRIBED'));
    return () => { void supabase.removeChannel(canal); };
  }, []);

  const marcarVista = useCallback((id: string) => {
    setNuevas((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });
  }, []);

  return { alertas, unidades, enVivo, nuevas, marcarVista, recargar: cargar };
}
