import { useEffect, useRef } from 'react';
import {
  BarController, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineController, LineElement,
  PointElement, Tooltip, type ChartConfiguration,
} from 'chart.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

/* Paleta validada (scripts/validate_palette.js del skill dataviz): pasa contraste, banda de luminosidad y daltonismo. */
export const COLOR = {
  serie1: '#2a78d6',   // azul: atendidas / serie única
  serie2: '#eb6834',   // naranja: pendientes
  texto: '#1b2533',
  textoSec: '#4a5568',
  rejilla: '#e6ebf3',
  superficie: '#ffffff',
};

Chart.defaults.font.family = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
Chart.defaults.color = COLOR.textoSec;

/** Lienzo de Chart.js. El gráfico se recrea cuando cambia `clave` (datos o filtros). */
export function Grafico({ config, clave, etiqueta }: { config: ChartConfiguration; clave: string; etiqueta: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const chart = new Chart(lienzo.current!, config);
    return () => chart.destroy();
    // La configuración se arma en cada render; `clave` resume lo que realmente cambió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return <canvas ref={lienzo} role="img" aria-label={etiqueta} />;
}
