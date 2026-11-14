import { Link } from 'react-router-dom';

export default function NoEncontradaPage() {
  return (
    <div className="pantalla-centro">
      <h1>Página no encontrada</h1>
      <Link className="btn btn-contorno" to="/">Volver al inicio</Link>
    </div>
  );
}
