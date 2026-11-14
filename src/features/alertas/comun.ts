import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { IconName } from '@/components/ui/Icon';
import type { EstadoAlerta, TipoIncidente } from '@/types/database.types';

/** Ícono guardado en tipos_incidente.icono → ícono del sistema. */
export function iconoTipo(icono: string): IconName {
  const mapa: Record<string, IconName> = {
    wallet: 'wallet', 'user-x': 'user-x', car: 'car', alert: 'alert', megaphone: 'megaphone', more: 'more',
  };
  return mapa[icono] ?? 'alert';
}

/** Orden de la línea de tiempo (RF-10). "cancelada" se muestra aparte. */
export const ORDEN_ESTADOS: EstadoAlerta[] = ['enviada', 'recibida', 'en_evaluacion', 'en_atencion', 'finalizada'];

export const ETIQUETA_ESTADO: Record<EstadoAlerta, string> = {
  enviada: 'Enviada',
  recibida: 'Recibida por la central',
  en_evaluacion: 'En evaluación',
  en_atencion: 'En atención',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

/** Etiqueta corta para listas e insignias. */
export const ETIQUETA_CORTA: Record<EstadoAlerta, string> = { ...ETIQUETA_ESTADO, recibida: 'Recibida' };

export const esActiva = (e: EstadoAlerta) => e !== 'finalizada' && e !== 'cancelada';

const ZONA = 'America/Lima';
export const hora = (iso: string, segundos = false) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', ...(segundos ? { second: '2-digit' } : {}), hour12: false, timeZone: ZONA });
export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', timeZone: ZONA });
export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: ZONA });

/* Catálogo de tipos: se lee una vez por sesión y se guarda en el navegador para usarlo sin conexión. */
const CLAVE_TIPOS = 'ac-tipos-incidente';
let cacheTipos: TipoIncidente[] | null = null;

function tiposGuardados(): TipoIncidente[] | null {
  try { return JSON.parse(localStorage.getItem(CLAVE_TIPOS) ?? 'null'); } catch { return null; }
}

export function useTipos() {
  const [tipos, setTipos] = useState<TipoIncidente[] | null>(cacheTipos ?? tiposGuardados());
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cacheTipos) return;
    supabase.from('tipos_incidente').select('*').order('id').then(({ data, error: e }) => {
      if (e || !data?.length) {
        const guardados = tiposGuardados();
        if (guardados?.length) setTipos(guardados); else setError(true);
        return;
      }
      cacheTipos = data;
      try { localStorage.setItem(CLAVE_TIPOS, JSON.stringify(data)); } catch { /* sin almacenamiento */ }
      setTipos(data);
    });
  }, []);

  return { tipos, error };
}
