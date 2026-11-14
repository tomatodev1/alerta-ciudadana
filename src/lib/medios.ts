import type { TipoEvidencia } from '@/types/database.types';

export const MAX_BYTES = 50 * 1024 * 1024;   // límite del bucket "evidencias"

export function tipoDeMime(mime: string): TipoEvidencia | null {
  if (mime.startsWith('image/')) return 'foto';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

/** "audio/webm;codecs=opus" → "audio/webm" */
export const mimeBase = (mime: string) => mime.split(';')[0].trim();

export function extension(mime: string) {
  const base = mimeBase(mime);
  const mapa: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
    'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  };
  return mapa[base] ?? base.split('/')[1] ?? 'bin';
}

export function formatoBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Reduce una foto a máx. 1600 px y JPEG 80 % (una foto de celular de ~3 MB queda en ~300–500 KB).
 * Respeta la orientación EXIF. Si el navegador no puede leerla (p. ej. HEIC), se sube tal cual.
 */
export async function comprimirImagen(archivo: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    return blob && blob.size < archivo.size ? blob : archivo;
  } catch {
    return archivo;
  }
}

/** Formato de grabación soportado por el navegador (Chrome: webm; Safari: mp4). */
export function formatoGrabacion(tipo: 'audio' | 'video') {
  const opciones = tipo === 'audio'
    ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return opciones.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

/** En celulares es mejor abrir la cámara nativa (input capture) que una cámara en la página. */
export const esTactil = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
