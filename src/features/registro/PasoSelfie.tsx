import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { supabase } from '@/lib/supabase';
import { invocar } from '@/lib/funciones';
import { aJpeg, cargarModelos, descriptorRobusto, distancia, giroCabeza, leerRostro } from '@/lib/rostro';
import { useCamara } from './useCamara';
import type { FotoDni } from './PasoFotoDni';
import type { ResultadoVerificacion } from './Resultados';

const INSTRUCCIONES = ['Mira al frente', 'Gira lentamente la cabeza a un lado', 'Vuelve a mirar al frente'];
const TOTAL_GESTOS = 2;
/** Fotos de frente que se comparan con el DNI: se usa la que más se parece (más tolerante a una mala toma). */
const TOMAS = 3;

interface Props {
  usuarioId: string;
  fotoDni: FotoDni;
  onResultado: (r: ResultadoVerificacion) => void;
}

/** Paso 4 de 4 · Selfie con prueba de vida y comparación con el DNI (E07 / C07). */
export function PasoSelfie({ usuarioId, fotoDni, onResultado }: Props) {
  const [intento, setIntento] = useState(0);              // cambia para reiniciar la prueba
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [modelos, setModelos] = useState<'cargando' | 'listos' | 'error'>('cargando');
  const [presencial, setPresencial] = useState(false);
  const { videoRef, estado, error: errorCamara } = useCamara('user', !enviando);
  const ultimoAviso = useRef('');
  // Modo diagnóstico: agrega ?depurar a la URL para ver las medidas de la prueba de vida.
  const depurar = new URLSearchParams(window.location.search).has('depurar');
  const [diagnostico, setDiagnostico] = useState('');

  useEffect(() => {
    cargarModelos().then(() => setModelos('listos')).catch(() => setModelos('error'));
  }, []);

  // Prueba de vida: mirar al frente → girar la cabeza → volver al frente (se toman varias fotos).
  useEffect(() => {
    if (estado !== 'lista' || modelos !== 'listos' || enviando) return;
    let activo = true;
    let etapa = 0, frente = 0;
    const tomas: { blob: Blob; d: Float32Array }[] = [];
    setPaso(0);

    const avisar = (t: string) => { if (t !== ultimoAviso.current) { ultimoAviso.current = t; setAviso(t); } };
    const avanzar = (n: number) => { etapa = n; setPaso(n); };

    (async () => {
      while (activo) {
        const video = videoRef.current;
        if (!video || video.readyState < 2) { await new Promise((ok) => setTimeout(ok, 100)); continue; }
        const r = await leerRostro(video, 224).catch(() => null);
        if (!activo) return;

        if (!r || r.cantidad === 0) { avisar('Ubica tu rostro dentro del óvalo'); frente = 0; }
        else if (r.cantidad > 1) { avisar('Solo debe haber una persona en cámara'); frente = 0; }
        else if (r.caja && r.caja.ancho < 0.18) { avisar('Acércate un poco más a la cámara'); frente = 0; }
        else if (r.caja && Math.abs(r.caja.x + r.caja.ancho / 2 - 0.5) > 0.25) { avisar('Centra tu rostro en el óvalo'); frente = 0; }
        else if (r.puntos) {
          avisar('');
          const giro = Math.abs(giroCabeza(r.puntos) - 0.5);

          if (etapa === 0) {
            frente = giro < 0.12 ? frente + 1 : 0;
            if (frente >= 4) avanzar(1);
          } else if (etapa === 1) {
            if (giro > 0.13) avanzar(2);
          } else if (etapa === 2 && giro < 0.1) {
            // De frente otra vez: se guardan varias tomas para compararlas con el DNI.
            const { blob, canvas } = await aJpeg(video);
            const d = await descriptorRobusto(canvas);
            if (d && activo) tomas.push({ blob, d });
            if (tomas.length >= TOMAS && activo) {
              activo = false;
              // La toma que más se parece al DNI es la que cuenta.
              const mejor = tomas.map((t) => ({ ...t, dist: distancia(fotoDni.descriptor, t.d) })).sort((a, b) => a.dist - b.dist)[0];
              void finalizar(mejor.blob, mejor.dist);
              return;
            }
          }
          if (depurar) setDiagnostico(`etapa ${etapa} · giro ${giro.toFixed(2)} · tomas ${tomas.length}/${TOMAS}`);
        }
        await new Promise((ok) => setTimeout(ok, etapa === 2 ? 200 : 60));
      }
    })();
    return () => { activo = false; };
  }, [estado, modelos, intento, enviando]);

  async function finalizar(blob: Blob, dist: number) {
    setEnviando(true);
    setError('');
    if (depurar) setDiagnostico(`distancia con el DNI: ${dist.toFixed(3)} (coincide si es menor a 0.62)`);
    try {
      const ruta = `${usuarioId}/selfie-${Date.now()}.jpg`;
      const { error: e } = await supabase.storage.from('verificacion').upload(ruta, blob, { contentType: 'image/jpeg' });
      if (e) throw new Error('No pudimos subir la selfie. Revisa tu conexión e inténtalo de nuevo.');
      const r = await invocar<ResultadoVerificacion>('verificar-identidad', {
        accion: 'verificar',
        distancia: dist,
        prueba_vida: true,
        fotos: [fotoDni.ruta, ruta],
      });
      onResultado(r);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  const completados = Math.min(paso, TOTAL_GESTOS);
  const instruccion = enviando ? 'Comparando con tu DNI…' : INSTRUCCIONES[paso];

  return (
    <>
      <p className="lbl solo-escritorio">PASO 4 DE 4</p>
      <h1>Selfie con prueba de vida</h1>
      <p className="muted">Ubica tu rostro en el óvalo y sigue las instrucciones. Compararemos tu rostro con la foto de tu DNI.</p>

      <div className="camara selfie">
        <video ref={videoRef} className="espejo" playsInline muted aria-label="Vista de la cámara frontal" />
        {estado === 'lista' && <div className={`ovalo${paso >= 2 ? ' listo' : ''}`} aria-hidden="true" />}
        {estado === 'iniciando' && !enviando && <div className="camara-msg"><span className="spinner" />Abriendo la cámara…</div>}
        {enviando && <div className="camara-msg"><span className="spinner" />Comparando con tu DNI…</div>}
        {estado === 'error' && !enviando && <div className="camara-msg"><Icon name="camera" size={32} />{errorCamara}</div>}
        {estado === 'lista' && !enviando && (
          <span className="chip-camara arriba">
            {modelos === 'cargando' ? <><span className="spinner spinner-sm" />Preparando verificación…</>
              : <><Icon name="arrow-right" size={16} />{instruccion}</>}
          </span>
        )}
        {aviso && estado === 'lista' && !enviando && <span className="chip-camara abajo">{aviso}</span>}
      </div>

      {/* Anuncio para lectores de pantalla */}
      <p className="oculto-visual" aria-live="assertive">{modelos === 'listos' && estado === 'lista' ? instruccion : ''}</p>

      {depurar && diagnostico && <p className="texto-chico" style={{ fontFamily: 'monospace' }}>{diagnostico}</p>}

      <div className="barra-gestos">
        <span className="pista"><span style={{ width: `${(completados / TOTAL_GESTOS) * 100}%` }} /></span>
        {completados} de {TOTAL_GESTOS} gestos
      </div>

      {error && (
        <>
          <p className="alerta-form" role="alert">{error}</p>
          <Button onClick={() => { setError(''); setIntento((n) => n + 1); }}><Icon name="refresh" /> Reintentar</Button>
        </>
      )}
      {modelos === 'error' && <p className="alerta-form" role="alert">No pudimos cargar el verificador facial. Recarga la página.</p>}

      <ul className="consejos">
        <li><Icon name="glasses" size={18} />Quítate lentes oscuros o gorra</li>
        <li><Icon name="sun" size={18} />Rostro iluminado de frente</li>
        <li><Icon name="user" size={18} />Solo una persona en cámara</li>
      </ul>

      <p className="texto-chico">
        <Icon name="info" size={16} /> ¿No puedes usar la cámara?
        <button type="button" className="enlace" style={{ background: 'none', border: 0, padding: 0 }}
          aria-expanded={presencial} onClick={() => setPresencial((v) => !v)}>Verificar en una comisaría</button>
      </p>
      {presencial && (
        <div className="caja">
          <Icon name="shield" />
          <div>
            <strong>Verificación presencial</strong>
            <p>Acércate a cualquier comisaría con tu DNI. Un efectivo confirmará tu identidad y activará tu cuenta.</p>
          </div>
        </div>
      )}
    </>
  );
}
