const PASOS = [
  { titulo: 'Identifica la emergencia', texto: 'Elige el tipo y conoce qué hacer y a qué línea oficial llamar.' },
  { titulo: 'Registra la alerta', texto: 'Completa el formulario y obtén un código de seguimiento.' },
  { titulo: 'Sigue su estado', texto: 'Consulta si tu alerta está registrada, en atención o atendida.' },
];

export function ComoFunciona() {
  return (
    <section id="como" className="section-pad bg-white pt-0">
      <div className="container">
        <div className="text-center"><span className="eyebrow">Cómo funciona</span></div>
        <h2 className="section-title text-center mb-5">Tres pasos para orientarte</h2>
        <ol className="row g-4 list-unstyled mb-0">
          {PASOS.map((p, i) => (
            <li className="col-md-4 reveal" key={p.titulo}>
              <div className="d-flex gap-3">
                <span className="paso-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className="h6 fw-bold">{p.titulo}</h3>
                  <p className="small text-muted-ac mb-0">{p.texto}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
