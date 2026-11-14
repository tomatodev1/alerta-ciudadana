import { ListaChecks } from '@/components/layout/AuthLayout';

/** Panel izquierdo de login y recuperar (E02 / E03). */
export function LadoAcceso() {
  return (
    <div>
      <p className="lbl">SISTEMA DE ALERTAS · MININTER / PNP</p>
      <h1>Pide ayuda policial en 3 toques</h1>
      <p>Funciona en tu computadora y en tu celular, desde el navegador. No necesitas instalar nada.</p>
      <ListaChecks items={[
        { titulo: 'Envía tu alerta en 3 toques', texto: 'Tu ubicación GPS va automáticamente.' },
        { titulo: 'Sigue la atención en tiempo real', texto: 'Estado, unidad asignada y tiempo de llegada.' },
        { titulo: 'Cuenta verificada con tu DNI', texto: 'Evita suplantaciones y alertas falsas.' },
      ]} />
    </div>
  );
}
