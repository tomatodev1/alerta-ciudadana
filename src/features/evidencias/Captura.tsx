import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { aJpeg } from '@/lib/rostro';
import { formatoGrabacion } from '@/lib/medios';
import { useCamara } from '@/features/registro/useCamara';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Foto con la cámara dentro de la página (escritorio). En celular se usa la cámara nativa. */
export function CamaraFoto({ onListo, onCerrar }: { onListo: (b: Blob) => void; onCerrar: () => void }) {
  const { videoRef, estado, error } = useCamara('environment');
  const [tomando, setTomando] = useState(false);

  async function tomar() {
    if (!videoRef.current) return;
    setTomando(true);
    const { blob } = await aJpeg(videoRef.current);
    setTomando(false);
    onListo(blob);
  }

  return (
    <div className="panel-captura">
      <div className="camara">
        <video ref={videoRef} playsInline muted aria-label="Vista de la cámara" />
        {estado === 'iniciando' && <div className="camara-msg"><span className="spinner" />Abriendo la cámara…</div>}
        {estado === 'error' && <div className="camara-msg"><Icon name="camera" size={32} />{error}</div>}
      </div>
      <div className="acciones-fila">
        <Button onClick={tomar} disabled={estado !== 'lista'} cargando={tomando}><Icon name="camera" /> Tomar foto</Button>
        <Button variante="contorno" onClick={onCerrar}>Cerrar</Button>
      </div>
    </div>
  );
}

type Fase = 'preparando' | 'lista' | 'grabando' | 'revisar' | 'error';

/** Grabadora de audio o video con MediaRecorder (bitrate bajo para que el archivo sea liviano). */
export function Grabadora({ tipo, maxSegundos, onListo, onCerrar }: {
  tipo: 'audio' | 'video'; maxSegundos: number; onListo: (b: Blob) => void; onCerrar: () => void;
}) {
  const [fase, setFase] = useState<Fase>('preparando');
  const [error, setError] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [grabacion, setGrabacion] = useState<{ blob: Blob; url: string } | null>(null);
  const vista = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const partes = useRef<Blob[]>([]);

  // Abre micrófono / cámara
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new DOMException('', 'NotSupportedError');
        const s = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: tipo === 'video' ? { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (vista.current) { vista.current.srcObject = s; await vista.current.play().catch(() => undefined); }
        setFase('lista');
      } catch (e) {
        if (cancelado) return;
        const n = (e as DOMException).name;
        setError(n === 'NotAllowedError' ? `No diste permiso para usar ${tipo === 'audio' ? 'el micrófono' : 'la cámara y el micrófono'}.`
          : n === 'NotSupportedError' ? 'Tu navegador no permite grabar desde la página.'
          : `No encontramos ${tipo === 'audio' ? 'un micrófono' : 'una cámara'} disponible.`);
        setFase('error');
      }
    })();
    return () => {
      cancelado = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [tipo]);

  useEffect(() => () => { if (grabacion) URL.revokeObjectURL(grabacion.url); }, [grabacion]);

  // Al volver de la revisión, el <video> en vivo se monta de nuevo: hay que reconectar la cámara.
  useEffect(() => {
    const v = vista.current;
    if (v && stream.current && v.srcObject !== stream.current) {
      v.srcObject = stream.current;
      void v.play().catch(() => undefined);
    }
  }, [fase]);

  // Cronómetro y corte automático
  useEffect(() => {
    if (fase !== 'grabando') return;
    const t = setInterval(() => setSegundos((s) => {
      if (s + 1 >= maxSegundos) recorder.current?.stop();
      return s + 1;
    }), 1000);
    return () => clearInterval(t);
  }, [fase, maxSegundos]);

  function grabar() {
    if (!stream.current) return;
    const mimeType = formatoGrabacion(tipo);
    const r = new MediaRecorder(stream.current, {
      ...(mimeType ? { mimeType } : {}),
      ...(tipo === 'audio' ? { audioBitsPerSecond: 32_000 } : { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 }),
    });
    partes.current = [];
    r.ondataavailable = (e) => { if (e.data.size) partes.current.push(e.data); };
    r.onstop = () => {
      const blob = new Blob(partes.current, { type: r.mimeType || mimeType || (tipo === 'audio' ? 'audio/webm' : 'video/webm') });
      setGrabacion({ blob, url: URL.createObjectURL(blob) });
      setFase('revisar');
    };
    recorder.current = r;
    r.start(1000);
    setSegundos(0);
    setGrabacion(null);
    setFase('grabando');
  }

  return (
    <div className="panel-captura">
      {tipo === 'video' && (
        <div className="camara">
          {fase === 'revisar' && grabacion
            ? <video src={grabacion.url} controls playsInline aria-label="Video grabado" />
            : <video ref={vista} playsInline muted aria-label="Vista de la cámara" />}
          {fase === 'preparando' && <div className="camara-msg"><span className="spinner" />Abriendo la cámara…</div>}
          {fase === 'error' && <div className="camara-msg"><Icon name="camera" size={32} />{error}</div>}
          {fase === 'grabando' && <span className="chip-camara arriba"><span className="punto-grabando" /> Grabando {mmss(segundos)} / {mmss(maxSegundos)}</span>}
        </div>
      )}
      {tipo === 'audio' && (
        <div className="grabadora-audio">
          <span className={`icono-grande${fase === 'grabando' ? ' grabando' : ''}`}><Icon name="mic" size={30} /></span>
          {fase === 'preparando' && <p className="texto-chico">Activando el micrófono…</p>}
          {fase === 'error' && <p className="texto-chico color-warn">{error}</p>}
          {fase === 'lista' && <p className="texto-chico">Listo para grabar (máximo {mmss(maxSegundos)}).</p>}
          {fase === 'grabando' && <p className="cronometro" role="timer"><span className="punto-grabando" /> {mmss(segundos)} / {mmss(maxSegundos)}</p>}
          {fase === 'revisar' && grabacion && <audio src={grabacion.url} controls aria-label="Audio grabado" />}
        </div>
      )}
      <p className="oculto-visual" aria-live="polite">{fase === 'grabando' ? 'Grabando' : fase === 'revisar' ? 'Grabación lista para revisar' : ''}</p>

      <div className="acciones-fila">
        {fase === 'lista' && <Button onClick={grabar}><Icon name={tipo === 'audio' ? 'mic' : 'camera'} /> Empezar a grabar</Button>}
        {fase === 'grabando' && <Button onClick={() => recorder.current?.stop()}>Detener</Button>}
        {fase === 'revisar' && grabacion && (
          <>
            <Button onClick={() => onListo(grabacion.blob)}><Icon name="check" /> Usar grabación</Button>
            <Button variante="contorno" onClick={() => setFase('lista')}><Icon name="refresh" /> Volver a grabar</Button>
          </>
        )}
        {fase !== 'grabando' && <Button variante="contorno" onClick={onCerrar}>Cerrar</Button>}
      </div>
    </div>
  );
}
