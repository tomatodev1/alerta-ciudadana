import { supabase } from './supabase';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const CLAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface Subida {
  promesa: Promise<void>;
  cancelar: () => void;
}

/**
 * Sube un archivo a Supabase Storage mostrando el progreso.
 * (supabase-js no expone el progreso, por eso se usa XMLHttpRequest con la API REST de Storage.)
 */
export function subirConProgreso(bucket: string, ruta: string, archivo: Blob, tipo: string, onProgreso: (fraccion: number) => void): Subida {
  const xhr = new XMLHttpRequest();
  let cancelado = false;
  const promesa = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
    if (cancelado) throw new DOMException('Cancelado', 'AbortError');

    await new Promise<void>((ok, mal) => {
      xhr.open('POST', `${URL_BASE}/storage/v1/object/${bucket}/${ruta.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', CLAVE);
      xhr.setRequestHeader('Content-Type', tipo);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgreso(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgreso(1); ok(); return; }
        let msg = 'No se pudo subir el archivo.';
        try {
          const r = JSON.parse(xhr.responseText);
          if (/size|large/i.test(r.message ?? r.error ?? '')) msg = 'El archivo supera el límite de 50 MB.';
          else if (/mime|type/i.test(r.message ?? r.error ?? '')) msg = 'Ese tipo de archivo no está permitido.';
        } catch { /* respuesta sin JSON */ }
        mal(new Error(msg));
      };
      xhr.onerror = () => mal(new Error('Se perdió la conexión durante la subida.'));
      xhr.onabort = () => mal(new DOMException('Cancelado', 'AbortError'));
      xhr.send(archivo);
    });
  })();
  return { promesa, cancelar: () => { cancelado = true; xhr.abort(); } };
}
