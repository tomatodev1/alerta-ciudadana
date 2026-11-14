/**
 * Direcciones con Nominatim (OpenStreetMap). Uso moderado: máximo 1 consulta por segundo,
 * por eso las llamadas se espacian y se guardan en caché.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const BASE = 'https://nominatim.openstreetmap.org';

export interface Direccion {
  /** "Av. Javier Prado Este 1234" */
  linea1: string;
  /** "San Isidro, Lima" */
  linea2: string;
}

export interface ResultadoBusqueda extends Direccion { lat: number; lng: number }

interface Nominatim {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const cache = new Map<string, Direccion | null>();
let ultima = 0;

async function turno() {
  const espera = ultima + 1100 - Date.now();
  if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
  ultima = Date.now();
}

function formatear(r: Nominatim): Direccion {
  const a = r.address ?? {};
  const via = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? a.suburb;
  const linea1 = via ? `${via}${a.house_number ? ` ${a.house_number}` : ''}` : r.display_name.split(',')[0];
  const distrito = a.city_district ?? a.suburb ?? a.town ?? a.village ?? a.municipality;
  const ciudad = a.city ?? a.state ?? a.region;
  const linea2 = [distrito, ciudad].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ');
  return { linea1, linea2 };
}

/** Dirección aproximada de unas coordenadas (o null si no hay conexión). */
export async function direccionDe(lat: number, lng: number): Promise<Direccion | null> {
  const clave = `${lat.toFixed(4)},${lng.toFixed(4)}`;   // ~11 m
  if (cache.has(clave)) return cache.get(clave)!;
  try {
    await turno();
    const res = await fetch(`${BASE}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const d = formatear(await res.json());
    cache.set(clave, d);
    return d;
  } catch {
    return null;
  }
}

/** Busca una dirección escrita por el ciudadano (limitada a Perú). */
export async function buscarDireccion(texto: string): Promise<ResultadoBusqueda[]> {
  if (texto.trim().length < 3) return [];
  try {
    await turno();
    const q = encodeURIComponent(texto.trim());
    const res = await fetch(`${BASE}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=pe&accept-language=es&q=${q}`);
    if (!res.ok) return [];
    const lista: Nominatim[] = await res.json();
    return lista.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), ...formatear(r) }));
  } catch {
    return [];
  }
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
