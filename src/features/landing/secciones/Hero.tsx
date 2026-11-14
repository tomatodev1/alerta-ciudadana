import { useContador } from '../hooks';
import { INDICADORES } from '../datos';

/** Hero / propuesta de valor + franja de estadísticas con contadores animados. */
export function Hero() {
  return (
    <>
      <section id="inicio" className="hero">
        <div className="container">
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-lg-7">
              <span className="badge bg-light text-dark mb-3">MININTER · PNP · Prototipo académico</span>
              <h1 className="display-5 fw-bold">Sistema Ciudadano de <span>Alertas de Emergencia</span></h1>
              <p className="lead mt-3">
                Orientamos al ciudadano para identificar su emergencia, saber a qué canal oficial acudir y registrar
                una alerta de forma rápida y clara. Las autoridades monitorean las alertas en un panel centralizado.
              </p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <a href="#alerta" className="btn btn-ac btn-lg"><i className="bi bi-megaphone-fill" aria-hidden="true"></i> Registrar alerta</a>
                <a href="#estado" className="btn btn-outline-light btn-lg"><i className="bi bi-search" aria-hidden="true"></i> Consultar estado</a>
              </div>
              <ul className="list-unstyled d-flex flex-wrap gap-4 mt-4 mb-0 small">
                <li><i className="bi bi-lightning-charge-fill" aria-hidden="true"></i> <strong>Rapidez:</strong> registro en &lt; 1 min</li>
                <li><i className="bi bi-signpost-split-fill" aria-hidden="true"></i> <strong>Orientación:</strong> canal oficial correcto</li>
                <li><i className="bi bi-eye-fill" aria-hidden="true"></i> <strong>Transparencia:</strong> seguimiento con código</li>
              </ul>
            </div>
            <div className="col-lg-5 d-none d-md-block" aria-hidden="true">
              <div className="radar">
                <span className="anillo"></span><span className="anillo"></span><span className="anillo"></span>
                <div className="centro"><i className="bi bi-broadcast"></i></div>
                <div className="chip c1"><i className="bi bi-fire text-danger"></i> Incendio · Callao</div>
                <div className="chip c2"><i className="bi bi-heart-pulse text-success"></i> Emergencia médica</div>
                <div className="chip c3"><i className="bi bi-check-circle-fill text-success"></i> Alerta atendida · 18 min</div>
              </div>
            </div>
          </div>
        </div>
        <svg className="hero-ola" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#ffffff" d="M0,40 C240,80 480,0 720,30 C960,60 1200,10 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>

      <div className="bg-white">
        <div className="container stats-strip">
          <div className="row g-3">
            <Indicador icono="bi-inbox-fill" valor={INDICADORES.total} texto="alertas monitoreadas (12 meses)" />
            <Indicador icono="bi-check2-circle" valor={INDICADORES.pct} texto="% de alertas atendidas"
              estilo={{ background: '#d9f4ea', color: '#047857' }} />
            <Indicador icono="bi-stopwatch" valor={INDICADORES.tiempo} texto="minutos de respuesta promedio"
              estilo={{ background: '#ece4fd', color: '#6d28d9' }} />
          </div>
          <p className="small text-muted-ac text-end mt-2 mb-0">Datos de ejemplo del prototipo.</p>
        </div>
      </div>
    </>
  );
}

function Indicador({ icono, valor, texto, estilo }: {
  icono: string; valor: number; texto: string; estilo?: React.CSSProperties;
}) {
  const { ref, valor: actual } = useContador(valor);
  return (
    <div className="col-md-4">
      <div className="card card-ac h-100 d-flex flex-row align-items-center gap-3">
        <span className="kpi-icono" style={estilo}><i className={`bi ${icono}`} aria-hidden="true"></i></span>
        <div>
          <div className="stat-num" ref={ref} aria-hidden="true">{actual.toLocaleString('es-PE')}</div>
          <span className="visually-hidden">{valor.toLocaleString('es-PE')}</span>
          <div className="small text-muted-ac">{texto}</div>
        </div>
      </div>
    </div>
  );
}
