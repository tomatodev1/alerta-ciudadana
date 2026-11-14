import { ALERTAS_EJEMPLO, formatearFecha, infoEstado } from '../datos';

/** Alertas recientes (datos de ejemplo: RLS no permite leer alertas sin sesión). */
export function Recientes({ onVerEstado }: { onVerEstado: (codigo: string) => void }) {
  return (
    <section id="recientes" className="section-pad bg-white">
      <div className="container">
        <div className="mb-4">
          <span className="eyebrow">En tiempo real</span>
          <h2 className="section-title mb-1">Alertas recientes</h2>
          <p className="text-muted-ac mb-0">Últimas alertas del sistema. Haz clic en un código para ver su estado.</p>
        </div>
        <div className="card card-ac p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <caption className="visually-hidden">Últimas 8 alertas registradas (datos de ejemplo)</caption>
              <thead className="table-light">
                <tr>
                  <th scope="col">Código</th><th scope="col">Fecha</th><th scope="col">Tipo</th>
                  <th scope="col">Zona</th><th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ALERTAS_EJEMPLO.map((a) => {
                  const est = infoEstado(a.estado);
                  return (
                    <tr key={a.codigo}>
                      <td>
                        <button type="button" className="btn btn-link codigo-btn p-0 px-1"
                          onClick={() => onVerEstado(a.codigo)} aria-label={`Ver estado de ${a.codigo}`}>
                          {a.codigo}
                        </button>
                      </td>
                      <td>{formatearFecha(a.fecha)}</td>
                      <td>{a.tipo}</td>
                      <td>{a.zona}</td>
                      <td><span className={`badge ${est.badge}`}>{est.etiqueta}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="small text-muted-ac mt-2 mb-0">Datos de ejemplo. Las alertas reales solo son visibles para su autor y la Central 105.</p>
      </div>
    </section>
  );
}
