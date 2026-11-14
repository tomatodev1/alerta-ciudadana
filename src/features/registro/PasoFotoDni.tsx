import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { supabase } from '@/lib/supabase';
import { aJpeg, cargarModelos, descriptorRobusto, leerRostro } from '@/lib/rostro';
import { useCamara } from './useCamara';

export interface FotoDni { ruta: string; descriptor: Float32Array }

type Fase = 'camara' | 'procesando' | 'revisar';

/** Paso 3 de 4 · Foto del anverso del DNI (E06 / C06). Extrae el rostro del DNI con face-api.js. */
export function PasoFotoDni({ usuarioId, onListo }: { usuarioId: string; onListo: (f: FotoDni) => void }) {
  const [fase, setFase] = useState<Fase>('camara');
  const [modelos, setModelos] = useState<'cargando' | 'listos' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [vista, setVista] = useState<{ url: string; blob: Blob; descriptor: Float32Array } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const { videoRef, estado, error: errorCamara } = useCamara('environment', fase !== 'revisar');
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarModelos().then(() => setModelos('listos')).catch(() => setModelos('error'));
  }, []);

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista.url); }, [vista]);

  async function procesar(fuente: HTMLVideoElement | HTMLImageElement) {
    setFase('procesando');
    setError('');
    try {
      // Se guarda en mayor resolución (1920 px): el rostro del DNI es pequeño.
      const { blob, canvas } = await aJpeg(fuente, false, 1920);
      const d = await descriptorRobusto(canvas);
      if (!d) {
        setError('No encontramos el rostro en la foto del DNI. Acerca el documento, evita reflejos y vuelve a intentarlo.');
        setFase('camara');
        return;
      }
      setVista({ url: URL.createObjectURL(blob), blob, descriptor: d });
      setFase('revisar');
    } catch {
      setError('No pudimos procesar la imagen. Inténtalo de nuevo.');
      setFase('camara');
    }
  }

  // Captura automática: cuando se detecta el rostro del DNI en 2 lecturas seguidas.
  useEffect(() => {
    if (fase !== 'camara' || estado !== 'lista' || modelos !== 'listos') return;
    let activo = true;
    let seguidas = 0;
    (async () => {
      while (activo) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const r = await leerRostro(video, 416).catch(() => null);
          seguidas = r && r.cantidad > 0 ? seguidas + 1 : 0;
          if (seguidas >= 2 && activo) { void procesar(video); return; }
        }
        await new Promise((ok) => setTimeout(ok, 600));
      }
    })();
    return () => { activo = false; };
  }, [fase, estado, modelos]);

  async function alElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Elige una imagen (JPG o PNG).'); return; }
    if (f.size > 15 * 1024 * 1024) { setError('La imagen es muy pesada (máximo 15 MB).'); return; }
    await cargarModelos();
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => { URL.revokeObjectURL(url); void procesar(img); };
    img.onerror = () => { URL.revokeObjectURL(url); setError('No pudimos abrir la imagen.'); };
    img.src = url;
  }

  async function continuar() {
    if (!vista) return;
    setSubiendo(true);
    setError('');
    const ruta = `${usuarioId}/dni-${Date.now()}.jpg`;
    const { error: e } = await supabase.storage.from('verificacion').upload(ruta, vista.blob, { contentType: 'image/jpeg' });
    setSubiendo(false);
    if (e) { setError('No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.'); return; }
    onListo({ ruta, descriptor: vista.descriptor });
  }

  const chip =
    modelos === 'cargando' ? 'Preparando verificación…'
    : modelos === 'error' ? 'No se pudo cargar el verificador'
    : fase === 'procesando' ? 'Leyendo el documento…'
    : 'Detectando documento… mantén quieta la cámara';

  return (
    <>
      <p className="lbl solo-escritorio">PASO 3 DE 4</p>
      <h1>Toma una foto del anverso de tu DNI</h1>
      <p className="muted">Acerca el DNI hasta que llene el marco. La foto se toma sola cuando se lee bien. También puedes subir una foto o escaneo.</p>

      <div className="camara">
        {fase === 'revisar' && vista ? (
          <img src={vista.url} alt="Foto tomada del anverso de tu DNI" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted aria-label="Vista de la cámara" />
            {estado === 'lista' && <div className="marco-dni" aria-hidden="true" />}
            {estado === 'iniciando' && <div className="camara-msg"><span className="spinner" />Abriendo la cámara…</div>}
            {estado === 'error' && (
              <div className="camara-msg"><Icon name="camera" size={32} />{errorCamara}<span>Puedes subir una foto de tu DNI.</span></div>
            )}
            {estado === 'lista' && (
              <span className="chip-camara abajo" role="status">
                {(modelos === 'cargando' || fase === 'procesando') ? <span className="spinner spinner-sm" /> : <Icon name="scan" size={16} />}
                {chip}
              </span>
            )}
          </>
        )}
      </div>

      <div aria-live="assertive">{error && <p className="alerta-form" role="alert">{error}</p>}</div>

      {fase === 'revisar' ? (
        <>
          <div className="caja caja-ok">
            <Icon name="check-circle" />
            <div><strong>Detectamos el rostro del DNI</strong><p>Revisa que la foto se vea nítida y completa.</p></div>
          </div>
          <div className="acciones-fila">
            <Button onClick={continuar} cargando={subiendo}>Usar esta foto <Icon name="arrow-right" /></Button>
            <Button variante="contorno" onClick={() => { setVista(null); setFase('camara'); }} disabled={subiendo}>
              <Icon name="refresh" /> Tomar otra
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="consejos">
            <li><Icon name="sun" size={18} />Buena iluminación, sin reflejos</li>
            <li><Icon name="id" size={18} />DNI completo dentro del marco</li>
            <li><Icon name="eye" size={18} />Datos legibles, sin cubrir</li>
          </ul>
          <div className="acciones-fila">
            <Button onClick={() => videoRef.current && procesar(videoRef.current)}
              disabled={estado !== 'lista' || modelos !== 'listos'} cargando={fase === 'procesando'}>
              <Icon name="camera" /> Tomar foto
            </Button>
            <Button variante="contorno" onClick={() => archivo.current?.click()} disabled={fase === 'procesando' || modelos === 'error'}>
              <Icon name="upload" /> Subir imagen
            </Button>
          </div>
          <input ref={archivo} type="file" accept="image/*" hidden onChange={alElegirArchivo} />
        </>
      )}
      {modelos === 'error' && (
        <p className="alerta-form" role="alert">No pudimos cargar el verificador facial. Revisa tu conexión y recarga la página.</p>
      )}
    </>
  );
}
