import { Card } from './Card';

interface Props {
  titulo: string;
  mockup: string;
  paso: number;
}

/** Marcador temporal: cada pantalla se reemplaza en su paso del plan. */
export function Pendiente({ titulo, mockup, paso }: Props) {
  return (
    <div className="contenedor">
      <Card className="pendiente">
        <p className="lbl">MOCKUP {mockup}</p>
        <h1>{titulo}</h1>
        <p className="muted">Esta pantalla se construye en el paso {paso} del plan de desarrollo.</p>
      </Card>
    </div>
  );
}
