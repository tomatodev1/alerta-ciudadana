const USUARIOS = [
  { icono: 'bi-people-fill', titulo: 'Ciudadanos',
    texto: 'Personas que presencian o sufren una emergencia y necesitan orientación inmediata.' },
  { icono: 'bi-universal-access-circle', titulo: 'Personas con discapacidad y adultos mayores',
    texto: 'Interfaz con alto contraste, navegación por teclado y textos claros.' },
  { icono: 'bi-shield-fill-check', titulo: 'Operadores PNP',
    texto: 'Personal que recibe, prioriza y atiende las alertas registradas.' },
  { icono: 'bi-building-fill', titulo: 'Gestores MININTER',
    texto: 'Autoridades que monitorean indicadores para la toma de decisiones.' },
];

export function Beneficiarios() {
  return (
    <section id="beneficiarios" className="section-pad bg-white">
      <div className="container">
        <div className="text-center"><span className="eyebrow">Usuarios</span></div>
        <h2 className="section-title text-center">¿A quién beneficia?</h2>
        <p className="text-center text-muted-ac mb-5">Usuarios identificados en las etapas previas del proyecto.</p>
        <div className="row g-4">
          {USUARIOS.map((u) => (
            <div className="col-md-6 col-lg-3" key={u.titulo}>
              <div className="card card-ac h-100 p-4 text-center reveal">
                <span className="benef-icono" aria-hidden="true"><i className={`bi ${u.icono}`}></i></span>
                <h3 className="h6 mt-3 fw-bold">{u.titulo}</h3>
                <p className="small text-muted-ac mb-0">{u.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
