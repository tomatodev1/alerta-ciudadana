import { useCallback, useEffect, useRef, useState } from 'react';

/* Tipos mínimos de la Web Speech API (no vienen en lib.dom de TypeScript). */
interface ResultadoVoz { isFinal: boolean; length: number; [i: number]: { transcript: string } }
interface EventoVoz { resultIndex: number; results: { length: number; [i: number]: ResultadoVoz } }
interface Reconocedor {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type ConstructorVoz = new () => Reconocedor;

function constructorVoz(): ConstructorVoz | null {
  const w = window as unknown as { SpeechRecognition?: ConstructorVoz; webkitSpeechRecognition?: ConstructorVoz };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const vozSoportada = () => typeof window !== 'undefined' && !!constructorVoz();

export type EstadoVoz = 'apagado' | 'escuchando' | 'sin-permiso' | 'sin-red' | 'no-soportado';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿La frase contiene el comando? Tolera "policía" en vez de "policial" y errores de puntuación. */
export function esComando(texto: string) {
  const t = normalizar(texto);
  return /emergencia/.test(t) && /polic/.test(t);
}

/**
 * Escucha el comando "Emergencia policial" (RF-04) mientras `activo` sea true.
 * Chrome detiene el reconocimiento tras unos segundos de silencio: aquí se reinicia solo.
 * Nota: en Chrome el audio se procesa en los servidores de Google (requiere internet).
 */
export function useComandoVoz(activo: boolean, onComando: (frase: string) => void) {
  const [estado, setEstado] = useState<EstadoVoz>(() => (vozSoportada() ? 'apagado' : 'no-soportado'));
  const [oido, setOido] = useState('');
  const callback = useRef(onComando);
  callback.current = onComando;

  useEffect(() => {
    const Ctor = constructorVoz();
    if (!Ctor) { setEstado('no-soportado'); return; }
    if (!activo) { setEstado((e) => (e === 'sin-permiso' ? e : 'apagado')); setOido(''); return; }

    let vigente = true;
    let reinicio: ReturnType<typeof setTimeout> | undefined;
    const rec = new Ctor();
    rec.lang = 'es-PE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        for (let a = 0; a < r.length; a++) {
          const frase = r[a].transcript;
          if (esComando(frase)) {
            vigente = false;
            rec.abort();
            setOido(frase.trim());
            setEstado('apagado');
            callback.current(frase.trim());
            return;
          }
        }
        setOido(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { vigente = false; setEstado('sin-permiso'); }
      else if (e.error === 'network') { vigente = false; setEstado('sin-red'); }
      // "no-speech" y "aborted" son normales: se reinicia en onend.
    };
    rec.onend = () => {
      if (vigente) reinicio = setTimeout(() => { try { rec.start(); } catch { /* ya iniciado */ } }, 300);
    };

    try { rec.start(); setEstado('escuchando'); } catch { setEstado('apagado'); }
    return () => { vigente = false; clearTimeout(reinicio); rec.onend = null; rec.abort(); };
  }, [activo]);

  const reiniciar = useCallback(() => setEstado('apagado'), []);
  return { estado, oido, reiniciar };
}
