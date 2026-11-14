import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatoBytes } from '@/lib/medios';
import { Icon } from '@/components/ui/Icon';
import { hora } from '@/features/alertas/comun';
import type { Evidencia } from '@/types/database.types';

type ConUrl = Evidencia & { url: string | null };

/**
 * Evidencias de una alerta con enlaces firmados (1 h): el bucket es privado.
 * La ve el ciudadano dueño y la central (políticas de Storage). Se actualiza en tiempo real.
 */
export function ListaEvidencias({ alertaId, vacio }: { alertaId: string; vacio?: string }) {
  const [evidencias, setEvidencias] = useState<ConUrl[] | null>(null);

  useEffect(() => {
    let vigente = true;
    const firmar = async (filas: Evidencia[]): Promise<ConUrl[]> => {
      if (!filas.length) return [];
      const { data } = await supabase.storage.from('evidencias').createSignedUrls(filas.map((f) => f.ruta_storage), 3600);
      return filas.map((f) => ({ ...f, url: data?.find((d) => d.path === f.ruta_storage)?.signedUrl ?? null }));
    };

    supabase.from('evidencias').select('*').eq('alerta_id', alertaId).order('creado_en').then(async ({ data }) => {
      const lista = await firmar(data ?? []);
      if (vigente) setEvidencias(lista);
    });

    const canal = supabase
      .channel(`evidencias-${alertaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evidencias', filter: `alerta_id=eq.${alertaId}` }, async (p) => {
        const [nueva] = await firmar([p.new as Evidencia]);
        if (vigente) setEvidencias((prev) => (prev?.some((x) => x.id === nueva.id) ? prev : [...(prev ?? []), nueva]));
      })
      .subscribe();
    return () => { vigente = false; void supabase.removeChannel(canal); };
  }, [alertaId]);

  if (!evidencias) return <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando evidencias…</p>;
  if (!evidencias.length) return vacio ? <p className="texto-chico">{vacio}</p> : null;

  return (
    <ul className="galeria-evidencias">
      {evidencias.map((e) => (
        <li key={e.id} className={e.tipo === 'audio' ? 'es-audio' : undefined}>
          {!e.url ? <span className="texto-chico">No disponible</span>
            : e.tipo === 'foto' ? (
              <a href={e.url} target="_blank" rel="noreferrer" aria-label={`Abrir foto de las ${hora(e.creado_en)} en una pestaña nueva`}>
                <img src={e.url} alt={`Foto enviada a las ${hora(e.creado_en)}`} loading="lazy" />
              </a>
            ) : e.tipo === 'video' ? (
              <video src={e.url} controls preload="metadata" aria-label={`Video enviado a las ${hora(e.creado_en)}`} />
            ) : (
              <audio src={e.url} controls preload="metadata" aria-label={`Audio enviado a las ${hora(e.creado_en)}`} />
            )}
          <small>
            <Icon name={e.tipo === 'audio' ? 'mic' : 'camera'} size={14} />
            {e.tipo === 'foto' ? 'Foto' : e.tipo === 'video' ? 'Video' : 'Audio'} · {hora(e.creado_en)}{e.tamano_bytes ? ` · ${formatoBytes(e.tamano_bytes)}` : ''}
          </small>
        </li>
      ))}
    </ul>
  );
}
