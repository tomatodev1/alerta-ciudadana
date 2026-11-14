import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MarcadorAlerta { id: string; lat: number; lng: number; titulo: string; prioridad: number; seleccionada?: boolean }
export interface MarcadorUnidad { id: number; lat: number; lng: number; titulo: string; disponible: boolean }

interface Props {
  alertas: MarcadorAlerta[];
  unidades: MarcadorUnidad[];
  onElegir: (id: string) => void;
  etiqueta: string;
  className?: string;
}

const LIMA: L.LatLngExpression = [-12.0964, -77.03];

function iconoAlerta(prioridad: number, seleccionada?: boolean) {
  return L.divIcon({
    className: 'mapa-icono',
    html: `<span class="mk-alerta p${prioridad}${seleccionada ? ' sel' : ''}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
const svgAuto = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17H3v-4l2-5h14l2 5v4h-2M5 17h14"/></svg>';
const iconoUnidad = (disponible: boolean) => L.divIcon({
  className: 'mapa-icono',
  html: `<span class="mk-unidad${disponible ? '' : ' ocupada'}">${svgAuto}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Vista general para la central: alertas activas (por prioridad) y unidades. */
export function MapaBandeja({ alertas, unidades, onElegir, etiqueta, className = '' }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const encuadrado = useRef(false);
  const elegir = useRef(onElegir);
  elegir.current = onElegir;

  useEffect(() => {
    const m = L.map(div.current!, { center: LIMA, zoom: 13 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(div.current!);
    return () => { ro.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    unidades.forEach((u) => {
      L.marker([u.lat, u.lng], { icon: iconoUnidad(u.disponible), title: u.titulo, alt: u.titulo, keyboard: false }).addTo(g);
    });
    alertas.forEach((a) => {
      L.marker([a.lat, a.lng], { icon: iconoAlerta(a.prioridad, a.seleccionada), title: a.titulo, alt: a.titulo, zIndexOffset: 1000 })
        .on('click', () => elegir.current(a.id))
        .addTo(g);
    });
    // Encuadra las alertas la primera vez que hay datos.
    if (!encuadrado.current && alertas.length) {
      m.fitBounds(L.latLngBounds(alertas.map((a) => [a.lat, a.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 15 });
      encuadrado.current = true;
    }
  }, [alertas, unidades]);

  return <div ref={div} className={`mapa ${className}`} role="region" aria-label={etiqueta} />;
}
