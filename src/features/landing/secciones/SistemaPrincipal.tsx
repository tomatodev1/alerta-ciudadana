import { Link } from 'react-router-dom';

/** Reemplaza el formulario simulado de la landing original: el registro real se hace dentro del sistema. */
export function SistemaPrincipal() {
  return (
    <section id="alerta" className="section-pad">
      <div className="container">
        <div className="row g-4 g-lg-5 align-items-center">
          <div className="col-lg-5">
            <span className="eyebrow">Sistema principal</span>
            <h2 className="section-title">Registrar alerta</h2>
            <p className="text-muted-ac">
              Las alertas se envían desde el sistema, con tu <strong>cuenta verificada</strong>, en solo 3 toques.
              Al enviarla obtendrás un <strong>código de seguimiento</strong> para consultar su estado.
            </p>
            <div className="alert alert-warning d-flex gap-2" role="note">
              <i className="bi bi-info-circle-fill" aria-hidden="true"></i>
              <div>
                Esta alerta <strong>no se envía a ninguna autoridad real</strong>. Si estás en peligro real,
                llama al <a href="tel:105" className="alert-link">105</a>.
              </div>
            </div>
          </div>
          <div className="col-lg-7">
            <div className="sistema-panel">
              <ul className="list-unstyled lista-check mb-4">
                <li><i className="bi bi-1-circle-fill" aria-hidden="true"></i><span><strong>Toca SOS</strong> y elige el tipo de emergencia.</span></li>
                <li><i className="bi bi-2-circle-fill" aria-hidden="true"></i><span><strong>Confirma tu ubicación</strong>: se toma del GPS y puedes ajustarla en el mapa.</span></li>
                <li><i className="bi bi-3-circle-fill" aria-hidden="true"></i><span><strong>Envía</strong> y sigue el estado en tiempo real.</span></li>
              </ul>
              <p className="text-muted-ac small mb-4">
                Puedes adjuntar fotos, video o audio, activar la alerta por voz y, si te quedas sin conexión,
                se reintenta automáticamente.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/ingresar" className="btn btn-ac btn-lg">
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true"></i> Ingresar al sistema
                </Link>
                <Link to="/registro" className="btn btn-outline-light btn-lg">
                  <i className="bi bi-person-plus-fill" aria-hidden="true"></i> Crear cuenta
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
