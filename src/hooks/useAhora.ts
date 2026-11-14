import { useEffect, useState } from 'react';

/** Hora actual que se refresca cada `intervaloMs` (para tiempos transcurridos y plazos). */
export function useAhora(intervaloMs = 15_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return ahora;
}

/** "hace 3 min", "hace 1 h 20 min" */
export function transcurrido(desdeIso: string, ahora: number) {
  const min = Math.max(0, Math.floor((ahora - new Date(desdeIso).getTime()) / 60_000));
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}
