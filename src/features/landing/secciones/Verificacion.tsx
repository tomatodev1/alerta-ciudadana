import { Link } from 'react-router-dom';

const PASOS = [
  { icono: 'bi-person-vcard-fill', titulo: 'Crea tu cuenta',
    texto: 'Regístrate con tu DNI, celular y correo electrónico.' },
  { icono: 'bi-patch-check-fill', titulo: 'Validamos tu DNI',
    texto: 'Comprobamos que el DNI exista y coincida con tus nombres.' },
  { icono: 'bi-person-bounding-box', titulo: 'Verificación facial',
    texto: 'Tómate una selfie: la comparación con tu foto se hace en tu navegador.' },
  { icono: 'bi-shield-fill-check', titulo: 'Cuenta verificada',
    texto: 'Listo: ya puedes enviar alertas a la Central 105.' },
];

/** RF-16: solo cuentas verificadas pueden enviar alertas (evita alertas falsas). */
export function Verificacion() {
  return (
    <section id="verificacion" className="section-pad bg-white">
      <div className="container">
        <div className="text-center"><span className="eyebrow">Cuenta verificada</span></div>
        <h2 className="section-title text-center">¿Por qué verificamos tu identidad?</h2>
        <p className="text-center text-muted-ac mb-5 mx-auto" style={{ maxWidth: 640 }}>
          Para reducir las alertas falsas, solo las cuentas con identidad verificada pueden enviar alertas.
          La verificación se hace una sola vez.
        </p>
        <ol className="row g-4 list-unstyled mb-4">
          {PASOS.map((p, i) => (
            <li className="col-sm-6 col-lg-3 reveal" key={p.titulo}>
              <div className="card card-ac h-100 p-4 verif-paso">
                <span className="verif-icono mb-3" aria-hidden="true"><i className={`bi ${p.icono}`}></i></span>
                <span className="verif-num">PASO {i + 1}</span>
                <h3 className="h6 fw-bold mt-1">{p.titulo}</h3>
                <p className="small text-muted-ac mb-0">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="text-center">
          <Link to="/registro" className="btn btn-ac btn-lg">
            <i className="bi bi-person-plus-fill" aria-hidden="true"></i> Crear cuenta verificada
          </Link>
        </div>
      </div>
    </section>
  );
}
