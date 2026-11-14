import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface Punto { lat: number; lng: number }

interface Props {
  /** Ubicación del ciudadano / de la alerta. */
  pin: Punto;
  /** Permite arrastrar el pin para corregir la ubicación (RNF-06). */
  arrastrable?: boolean;
  onMover?: (p: Punto) => void;
  /** Radio de precisión del GPS en metros (círculo alrededor del pin). */
  precision?: number | null;
  /** Unidad policial asignada: se dibuja con una línea punteada hasta el pin. */
  unidad?: Punto | null;
  /** false = mapa de solo lectura (miniatura). */
  interactivo?: boolean;
  zoom?: number;
  etiqueta: string;
  className?: string;
}

const svgPin = `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 22s8-6 8-12a8 8 0 0 0-16 0c0 6 8 12 8 12z" fill="#F1F5F9" stroke="#0F2027" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="#0F2027"/></svg>`;
const svgAuto = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0F2027" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17H3v-4l2-5h14l2 5v4h-2M5 17h14M7 17v2M17 17v2"/></svg>`;

const iconoPunto = L.divIcon({ className: 'mapa-icono', html: '<span class="mapa-yo"></span>', iconSize: [26, 26], iconAnchor: [13, 13] });
const iconoPin = L.divIcon({ className: 'mapa-icono', html: svgPin, iconSize: [36, 36], iconAnchor: [18, 34] });
const iconoUnidad = L.divIcon({ className: 'mapa-icono', html: `<span class="mapa-unidad">${svgAuto}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });

/** Mapa de Leaflet + OpenStreetMap. Las teselas se oscurecen por CSS para el tema del sistema. */
export function Mapa({ pin, arrastrable = false, onMover, precision, unidad, interactivo = true, zoom = 16, etiqueta, className = '' }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capas = useRef<{ pin?: L.Marker; circulo?: L.Circle; unidad?: L.Marker; linea?: L.Polyline }>({});
  const alMover = useRef(onMover);
  alMover.current = onMover;

  // Crear el mapa una sola vez
  useEffect(() => {
    const m = L.map(div.current!, {
      center: [pin.lat, pin.lng],
      zoom,
      zoomControl: interactivo,
      dragging: interactivo,
      scrollWheelZoom: interactivo,
      doubleClickZoom: interactivo,
      touchZoom: interactivo,
      boxZoom: interactivo,
      keyboard: interactivo,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    mapa.current = m;

    // El contenedor puede cambiar de tamaño (p. ej. al pasar de paso en el celular).
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(div.current!);
    return () => { ro.disconnect(); m.remove(); mapa.current = null; capas.current = {}; };
  }, []);

  // Pin del ciudadano + círculo de precisión
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const c = capas.current;
    const pos: L.LatLngExpression = [pin.lat, pin.lng];

    if (!c.pin) {
      c.pin = L.marker(pos, {
        icon: arrastrable ? iconoPin : iconoPunto,
        draggable: arrastrable,
        keyboard: arrastrable,
        title: arrastrable ? 'Tu ubicación (arrastra para corregirla)' : 'Ubicación',
        alt: 'Ubicación',
      }).addTo(m);
      c.pin.on('dragend', () => {
        const p = c.pin!.getLatLng();
        alMover.current?.({ lat: p.lat, lng: p.lng });
      });
    } else {
      c.pin.setLatLng(pos);
      c.pin.setIcon(arrastrable ? iconoPin : iconoPunto);
      if (arrastrable) c.pin.dragging?.enable(); else c.pin.dragging?.disable();
    }

    if (precision && precision > 0) {
      if (!c.circulo) c.circulo = L.circle(pos, { radius: precision, color: '#8FD3FF', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(m);
      else c.circulo.setLatLng(pos).setRadius(precision);
    } else if (c.circulo) {
      c.circulo.remove();
      c.circulo = undefined;
    }

    if (!unidad) m.panTo(pos, { animate: true });
  }, [pin.lat, pin.lng, precision, arrastrable, !!unidad]);

  // Unidad asignada + línea punteada
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const c = capas.current;
    if (!unidad) {
      c.unidad?.remove(); c.linea?.remove();
      c.unidad = undefined; c.linea = undefined;
      return;
    }
    const u: L.LatLngExpression = [unidad.lat, unidad.lng];
    const p: L.LatLngExpression = [pin.lat, pin.lng];
    if (!c.unidad) c.unidad = L.marker(u, { icon: iconoUnidad, title: 'Unidad policial', alt: 'Unidad policial', keyboard: false }).addTo(m);
    else c.unidad.setLatLng(u);
    if (!c.linea) c.linea = L.polyline([u, p], { color: '#8FD3FF', weight: 3, dashArray: '2 8', interactive: false }).addTo(m);
    else c.linea.setLatLngs([u, p]);
    m.fitBounds(L.latLngBounds([u, p]), { padding: [48, 48], maxZoom: 17 });
  }, [unidad?.lat, unidad?.lng, pin.lat, pin.lng]);

  return <div ref={div} className={`mapa ${className}`} role="region" aria-label={etiqueta} />;
}
