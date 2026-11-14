import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { direccionDe, distanciaMetros, type Direccion } from '@/lib/geocodificar';

export type EstadoGps = 'buscando' | 'ok' | 'denegado' | 'no-disponible';

export interface Posicion { lat: number; lng: number; precision: number; hora: number }

interface UbicacionState {
  estado: EstadoGps;
  posicion: Posicion | null;
  direccion: Direccion | null;
  reintentar: () => void;
}

const Contexto = createContext<UbicacionState | null>(null);

/**
 * Sigue la ubicación GPS mientras el ciudadano está en /app, para que al pulsar SOS
 * la ubicación ya esté lista ("Tu ubicación GPS va automáticamente").
 */
export function UbicacionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoGps>('buscando');
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [intento, setIntento] = useState(0);
  const geocodificada = useRef<Posicion | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    if (!('geolocation' in navigator)) { setEstado('no-disponible'); return; }
    setEstado((e) => (e === 'ok' ? e : 'buscando'));
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPosicion({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy), hora: p.timestamp });
        setEstado('ok');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setEstado('denegado');
        else setEstado((e) => (e === 'ok' ? e : 'no-disponible'));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [intento]);

  // Dirección aproximada: se vuelve a pedir solo si te moviste más de 30 m.
  useEffect(() => {
    if (!posicion) return;
    const previa = geocodificada.current;
    if (previa && distanciaMetros(previa, posicion) < 30) return;
    geocodificada.current = posicion;
    const pedida = posicion;
    direccionDe(pedida.lat, pedida.lng).then((d) => {
      // Solo se aplica si sigue siendo la última posición geocodificada.
      if (d && montado.current && geocodificada.current === pedida) setDireccion(d);
    });
  }, [posicion]);

  useEffect(() => {
    montado.current = true;   // (StrictMode monta dos veces en desarrollo)
    return () => { montado.current = false; };
  }, []);

  return (
    <Contexto.Provider value={{ estado, posicion, direccion, reintentar: () => setIntento((n) => n + 1) }}>
      {children}
    </Contexto.Provider>
  );
}

export function useUbicacion() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useUbicacion debe usarse dentro de <UbicacionProvider>');
  return ctx;
}
