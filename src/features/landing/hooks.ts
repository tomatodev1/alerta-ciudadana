import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import bootstrapCss from 'bootstrap/dist/css/bootstrap.min.css?inline';
import iconosCss from 'bootstrap-icons/font/bootstrap-icons.min.css?inline';
import landingCss from './landing.css?inline';
import { supabase } from '@/lib/supabase';
import type { TipoIncidente } from '@/types/database.types';
import { TIPOS_RESPALDO } from './datos';

/**
 * Inserta Bootstrap, Bootstrap Icons y el CSS de la landing solo mientras la
 * landing está montada. Al salir se quitan, así no afectan al tema oscuro del sistema.
 */
export function useEstilosLanding() {
  useLayoutEffect(() => {
    const hojas = [bootstrapCss, iconosCss, landingCss].map((css, i) => {
      const style = document.createElement('style');
      style.dataset.landing = String(i);
      style.textContent = css;
      document.head.appendChild(style);
      return style;
    });
    return () => hojas.forEach((s) => s.remove());
  }, []);
}

/** Lee tipos_incidente; sin sesión RLS devuelve una lista vacía y se usan los datos de respaldo. */
export function useTiposIncidente() {
  const [tipos, setTipos] = useState<TipoIncidente[]>(TIPOS_RESPALDO);
  const [origen, setOrigen] = useState<'bd' | 'respaldo'>('respaldo');

  useEffect(() => {
    let activo = true;
    supabase
      .from('tipos_incidente')
      .select('id, nombre, icono, prioridad')
      .order('prioridad')
      .order('id')
      .then(({ data, error }) => {
        if (!activo || error || !data?.length) return;
        setTipos(data);
        setOrigen('bd');
      });
    return () => { activo = false; };
  }, []);

  return { tipos, origen };
}

function prefiereMenosMovimiento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Agrega la clase "visible" a los elementos .reveal cuando entran en pantalla. */
export function useReveal(raiz: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const elementos = raiz.current?.querySelectorAll<HTMLElement>('.reveal') ?? [];
    if (!('IntersectionObserver' in window) || prefiereMenosMovimiento()) {
      elementos.forEach((el) => el.classList.add('visible'));
      return;
    }
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    elementos.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [raiz]);
}

/** Cuenta de 0 a `destino` cuando el elemento aparece en pantalla. */
export function useContador(destino: number, duracionMs = 1400) {
  const ref = useRef<HTMLDivElement>(null);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefiereMenosMovimiento() || !('IntersectionObserver' in window)) { setValor(destino); return; }

    let frame = 0;
    const animar = () => {
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / duracionMs);
        setValor(Math.round(destino * (1 - Math.pow(1 - t, 3))));   // ease-out
        if (t < 1) frame = requestAnimationFrame(paso);
      };
      frame = requestAnimationFrame(paso);
    };
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { animar(); obs.disconnect(); }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(frame); };
  }, [destino, duracionMs]);

  return { ref, valor };
}
