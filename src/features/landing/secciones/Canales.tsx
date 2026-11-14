const CANALES = [
  { numero: '105', nombre: 'Policía Nacional', detalle: 'Robos, violencia, seguridad', aria: 'Llamar al 105, Policía Nacional' },
  { numero: '116', nombre: 'Bomberos', detalle: 'Incendios, rescates, fugas', aria: 'Llamar al 116, Bomberos' },
  { numero: '106', nombre: 'SAMU', detalle: 'Urgencias médicas', aria: 'Llamar al 106, SAMU' },
  { numero: '100', nombre: 'Línea 100', detalle: 'Violencia familiar y de género', aria: 'Llamar a la Línea 100' },
];

export function Canales() {
  return (
    <section id="canales" className="section-pad bg-white">
      <div className="container">
        <div className="text-center"><span className="eyebrow">Líneas gratuitas</span></div>
        <h2 className="section-title text-center">Canales oficiales de emergencia</h2>
        <p className="text-center text-muted-ac mb-5">Ante una emergencia real, comunícate directamente con estas líneas gratuitas.</p>
        <div className="row g-4 text-center">
          {CANALES.map((c) => (
            <div className="col-6 col-lg" key={c.numero}>
              <div className="card card-ac canal-card p-3 h-100 reveal">
                <div className="canal-numero">{c.numero}</div>
                <div className="fw-semibold">{c.nombre}</div>
                <small className="text-muted-ac">{c.detalle}</small>
                <a href={`tel:${c.numero}`} className="btn btn-ac-outline btn-sm mt-2" aria-label={c.aria}>Llamar</a>
              </div>
            </div>
          ))}
          <div className="col-12 col-lg">
            <div className="card card-ac canal-card p-3 h-100 reveal">
              <div className="canal-numero">911</div>
              <div className="fw-semibold">Central única</div>
              <small className="text-muted-ac">En implementación en Lima y Callao (unifica 105, 106, 116 y 100)</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
