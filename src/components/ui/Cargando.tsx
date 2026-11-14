export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="pantalla-centro" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="muted">{texto}</p>
    </div>
  );
}
