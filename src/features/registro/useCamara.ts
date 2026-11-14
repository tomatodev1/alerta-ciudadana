import { useEffect, useRef, useState } from 'react';

export type EstadoCamara = 'iniciando' | 'lista' | 'error';

/** Abre la cámara y la conecta a un <video>. Se apaga al desmontar o con activa = false. */
export function useCamara(modo: 'user' | 'environment', activa = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<EstadoCamara>('iniciando');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activa) return;
    let stream: MediaStream | null = null;
    let cancelado = false;
    setEstado('iniciando');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'NotSupportedError');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: modo, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setEstado('lista');
      } catch (e) {
        if (cancelado) return;
        const nombre = (e as DOMException).name;
        setError(
          nombre === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en la barra de direcciones del navegador.'
          : nombre === 'NotFoundError' || nombre === 'OverconstrainedError' ? 'No encontramos una cámara en este dispositivo.'
          : nombre === 'NotReadableError' ? 'La cámara está siendo usada por otra aplicación.'
          : nombre === 'NotSupportedError' ? 'Tu navegador no permite usar la cámara (se necesita HTTPS).'
          : 'No pudimos abrir la cámara.',
        );
        setEstado('error');
      }
    })();

    return () => {
      cancelado = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [modo, activa]);

  return { videoRef, estado, error };
}
