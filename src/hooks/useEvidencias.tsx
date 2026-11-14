import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { subirConProgreso } from '@/lib/subirArchivo';
import { comprimirImagen, extension, MAX_BYTES, mimeBase, tipoDeMime } from '@/lib/medios';
import type { TipoEvidencia } from '@/types/database.types';

export type EstadoSubida = 'comprimiendo' | 'subiendo' | 'listo' | 'error' | 'cancelado';

export interface ItemSubida {
  id: string;
  alertaId: string;
  nombre: string;
  tipo: TipoEvidencia;
  tamanoOriginal: number;
  tamanoFinal?: number;
  progreso: number;          // 0–1
  estado: EstadoSubida;
  error?: string;
}

interface Estado {
  cola: ItemSubida[];
  agregar: (alertaId: string, archivo: Blob, nombre: string) => void;
  cancelar: (id: string) => void;
  reintentar: (id: string) => void;
  quitar: (id: string) => void;
}

const Contexto = createContext<Estado | null>(null);

/** Cola de subida de evidencias (RF-06). Comprime fotos, sube con progreso y registra la evidencia. */
export function EvidenciasProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [cola, setCola] = useState<ItemSubida[]>([]);
  const archivos = useRef(new Map<string, Blob>());
  const cancelaciones = useRef(new Map<string, () => void>());

  const actualizar = (id: string, cambios: Partial<ItemSubida>) =>
    setCola((c) => c.map((x) => (x.id === id ? { ...x, ...cambios } : x)));

  const procesar = useCallback(async (item: ItemSubida) => {
    if (!perfil) return;
    const original = archivos.current.get(item.id);
    if (!original) return;
    try {
      actualizar(item.id, { estado: 'comprimiendo', progreso: 0, error: undefined });
      const archivo = item.tipo === 'foto' ? await comprimirImagen(original) : original;
      if (archivo.size > MAX_BYTES) throw new Error('El archivo supera el límite de 50 MB.');
      const mime = mimeBase(archivo.type) || 'application/octet-stream';
      const ruta = `${perfil.id}/${item.alertaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension(mime)}`;

      actualizar(item.id, { estado: 'subiendo', tamanoFinal: archivo.size });
      const subida = subirConProgreso('evidencias', ruta, archivo, mime, (p) => actualizar(item.id, { progreso: p }));
      cancelaciones.current.set(item.id, subida.cancelar);
      await subida.promesa;
      cancelaciones.current.delete(item.id);

      const { error } = await supabase.from('evidencias').insert({
        alerta_id: item.alertaId, subido_por: perfil.id, tipo: item.tipo, ruta_storage: ruta, tamano_bytes: archivo.size,
      });
      if (error) {
        await supabase.storage.from('evidencias').remove([ruta]).catch(() => undefined);
        throw new Error('No se pudo registrar la evidencia.');
      }
      actualizar(item.id, { estado: 'listo', progreso: 1 });
      archivos.current.delete(item.id);
    } catch (e) {
      cancelaciones.current.delete(item.id);
      if ((e as DOMException).name === 'AbortError') actualizar(item.id, { estado: 'cancelado' });
      else actualizar(item.id, { estado: 'error', error: (e as Error).message });
    }
  }, [perfil]);

  const agregar = useCallback((alertaId: string, archivo: Blob, nombre: string) => {
    const tipo = tipoDeMime(archivo.type);
    const id = crypto.randomUUID();
    const base: ItemSubida = { id, alertaId, nombre, tipo: tipo ?? 'foto', tamanoOriginal: archivo.size, progreso: 0, estado: 'comprimiendo' };
    if (!tipo) {
      setCola((c) => [...c, { ...base, estado: 'error', error: 'Solo se aceptan fotos, videos o audios.' }]);
      return;
    }
    archivos.current.set(id, archivo);
    setCola((c) => [...c, base]);
    void procesar(base);
  }, [procesar]);

  const cancelar = useCallback((id: string) => cancelaciones.current.get(id)?.(), []);
  const reintentar = useCallback((id: string) => {
    const item = cola.find((x) => x.id === id);
    if (item && archivos.current.has(id)) void procesar(item);
  }, [cola, procesar]);
  const quitar = useCallback((id: string) => {
    archivos.current.delete(id);
    setCola((c) => c.filter((x) => x.id !== id));
  }, []);

  return <Contexto.Provider value={{ cola, agregar, cancelar, reintentar, quitar }}>{children}</Contexto.Provider>;
}

export function useEvidencias() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useEvidencias debe usarse dentro de <EvidenciasProvider>');
  return ctx;
}
