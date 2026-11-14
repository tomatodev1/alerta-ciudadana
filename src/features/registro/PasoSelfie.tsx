import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { supabase } from '@/lib/supabase';
import { invocar } from '@/lib/funciones';
import { aJpeg, aperturaOjos, cargarModelos, descriptor, distancia, giroCabeza, leerRostro } from '@/lib/rostro';
import { useCamara } from './useCamara';
import type { FotoDni } from './PasoFotoDni';
import type { ResultadoVerificacion } from './Resultados';

const INSTRUCCIONES = ['Mira al frente', 'Parpadea dos veces', 'Gira lentamente la cabeza a un lado', 'Vuelve a mirar al frente'];
const TOTAL_GESTOS = 3;

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
  const [parpadeos, setParpadeos] = useState(0);
  // Modo diagnóstico: agrega ?depurar a la URL para ver las medidas de la prueba de vida.
  const depurar = new URLSearchParams(window.location.search).has('depurar');
  const [diagnostico, setDiagnostico] = useState('');

  useEffect(() => {
    cargarModelos().then(() => setModelos('listos')).catch(() => setModelos('error'));
  }, []);

  useEffect(() => {
    if (estado !== 'lista' || modelos !== 'listos' || enviando) return;
    let activo = true;
    let etapa = 0, frente = 0, parpadeos = 0, cerrado = false;
    let inicioParpadeo = 0;
    const recientes: number[] = [];   // apertura de ojos de los últimos cuadros
    setPaso(0);
    setParpadeos(0);

    const avisar = (t: string) => { if (t !== ultimoAviso.current) { ultimoAviso.current = t; setAviso(t); } };
    const avanzar = (n: number) => { etapa = n; setPaso(n); if (n === 1) inicioParpadeo = performance.now(); };
    /** Apertura "normal" (ojos abiertos): percentil 80 de los cuadros recientes. Se adapta a cada persona y cámara. */
    const nivelAbierto = () => [...recientes].sort((a, b) => a - b)[Math.floor(recientes.length * 0.8)] ?? 0;

    (async () => {
      while (activo) {
        const video = videoRef.current;
        if (!video || video.readyState < 2) { await new Promise((ok) => setTimeout(ok, 100)); continue; }
        const t0 = performance.now();
        // Durante el parpadeo se usa una entrada más chica para leer más cuadros por segundo.
        const r = await leerRostro(video, etapa === 1 ? 160 : 224).catch(() => null);
        if (!activo) return;
        const ms = performance.now() - t0;

        if (!r || r.cantidad === 0) { avisar('Ubica tu rostro dentro del óvalo'); frente = 0; }
        else if (r.cantidad > 1) { avisar('Solo debe haber una persona en cámara'); frente = 0; }
        else if (r.caja && r.caja.ancho < 0.2) { avisar('Acércate un poco más a la cámara'); frente = 0; }
        else if (r.caja && Math.abs(r.caja.x + r.caja.ancho / 2 - 0.5) > 0.2) { avisar('Centra tu rostro en el óvalo'); frente = 0; }
        else if (r.puntos) {
          const ojos = aperturaOjos(r.puntos);
          const giro = Math.abs(giroCabeza(r.puntos) - 0.5);
          recientes.push(ojos);
          if (recientes.length > 20) recientes.shift();
          const nivel = nivelAbierto();

          if (etapa === 0) {
            avisar('');
            frente = giro < 0.1 ? frente + 1 : 0;
            if (frente >= 6) avanzar(1);
          } else if (etapa === 1) {
            // Parpadeo = la apertura cae al menos 20 % bajo lo normal y luego se recupera.
            if (!cerrado && ojos < nivel * 0.8) cerrado = true;
            else if (cerrado && ojos > nivel * 0.9) {
              cerrado = false;
              parpadeos++;
              setParpadeos(parpadeos);
              inicioParpadeo = performance.now();
            }
            avisar(performance.now() - inicioParpadeo > 6000 ? 'Parpadea despacio: cierra bien los ojos un momento y ábrelos' : '');
            if (parpadeos >= 2) { avisar(''); avanzar(2); }
          } else if (etapa === 2) {
            avisar('');
            if (giro > 0.16) avanzar(3);
          } else if (etapa === 3 && giro < 0.08 && ojos > nivel * 0.85) {
            const { blob, canvas } = await aJpeg(video);
            const d = await descriptor(canvas, 416);
            if (d && activo) { activo = false; void finalizar(blob, d); return; }
          }
          if (depurar) {
            setDiagnostico(`ojos ${ojos.toFixed(3)} · normal ${nivel.toFixed(3)} · umbral ${(nivel * 0.8).toFixed(3)} · ` +
              `cerrado ${cerrado ? 'sí' : 'no'} · parpadeos ${parpadeos} · giro ${giro.toFixed(2)} · ${Math.round(ms)} ms/cuadro`);
          }
        }
        // En el parpadeo no se espera entre cuadros (un parpadeo dura ~150 ms).
        await new Promise((ok) => setTimeout(ok, etapa === 1 ? 0 : 60));
      }
    })();
    return () => { activo = false; };
  }, [estado, modelos, intento, enviando]);

  async function finalizar(blob: Blob, d: Float32Array) {
    setEnviando(true);
    setError('');
    try {
      const ruta = `${usuarioId}/selfie-${Date.now()}.jpg`;
      const { error: e } = await supabase.storage.from('verificacion').upload(ruta, blob, { contentType: 'image/jpeg' });
      if (e) throw new Error('No pudimos subir la selfie. Revisa tu conexión e inténtalo de nuevo.');
      const r = await invocar<ResultadoVerificacion>('verificar-identidad', {
        accion: 'verificar',
        distancia: distancia(fotoDni.descriptor, d),
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
  const instruccion = enviando ? 'Comparando con tu DNI…'
    : paso === 1 ? `${INSTRUCCIONES[1]} (${parpadeos} de 2)`
    : INSTRUCCIONES[paso];

  return (
    <>
      <p className="lbl solo-escritorio">PASO 4 DE 4</p>
      <h1>Selfie con prueba de vida</h1>
      <p className="muted">Ubica tu rostro en el óvalo y sigue las instrucciones. Compararemos tu rostro con la foto de tu DNI.</p>

      <div className="camara selfie">
        <video ref={videoRef} className="espejo" playsInline muted aria-label="Vista de la cámara frontal" />
        {estado === 'lista' && <div className={`ovalo${paso >= 3 ? ' listo' : ''}`} aria-hidden="true" />}
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
