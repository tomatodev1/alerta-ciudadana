import { useCallback, useEffect, useRef, useState } from 'react';
import { useEstilosLanding, useReveal } from './hooks';
import { Navegacion } from './secciones/Navegacion';
import { Hero } from './secciones/Hero';
import { Beneficiarios } from './secciones/Beneficiarios';
import { ComoFunciona } from './secciones/ComoFunciona';
import { Tipos } from './secciones/Tipos';
import { Recientes } from './secciones/Recientes';
import { SistemaPrincipal } from './secciones/SistemaPrincipal';
import { Verificacion } from './secciones/Verificacion';
import { Estado } from './secciones/Estado';
import { Canales } from './secciones/Canales';
import { Ayuda } from './secciones/Ayuda';
import { Footer, BotonArriba } from './secciones/Footer';

/**
 * Landing pública (convertida de referencias/landing). Usa Bootstrap 5 y su
 * estilo propio; los estilos se cargan solo mientras esta página está montada.
 */
export default function LandingPage() {
  useEstilosLanding();
  const raiz = useRef<HTMLDivElement>(null);
  useReveal(raiz);

  // "Alertas recientes" → consulta en "Estado de alerta".
  const [solicitud, setSolicitud] = useState<{ codigo: string; n: number } | null>(null);
  const verEstado = useCallback((codigo: string) => {
    setSolicitud((s) => ({ codigo, n: (s?.n ?? 0) + 1 }));
    document.getElementById('estado')?.scrollIntoView();
  }, []);

  useEffect(() => {
    const titulo = document.title;
    document.title = 'AlertaCiudadana – Sistema Ciudadano de Alertas de Emergencia (Prototipo académico)';
    return () => { document.title = titulo; };
  }, []);

  return (
    <div className="landing" ref={raiz}>
      <a href="#contenido" className="skip-link">Saltar al contenido principal</a>
      <Navegacion />
      <main id="contenido">
        <Hero />
        <Beneficiarios />
        <ComoFunciona />
        <Tipos />
        <Recientes onVerEstado={verEstado} />
        <SistemaPrincipal />
        <Verificacion />
        <Estado solicitud={solicitud} />
        <Canales />
        <Ayuda />
      </main>
      <Footer />
      <BotonArriba />
    </div>
  );
}
