import { useEffect, useState, type FormEvent } from 'react';
import { buscarAlerta, CODIGOS_EJEMPLO, ESTADOS, formatearFecha, infoEstado, type AlertaEjemplo } from '../datos';

type Resultado = { tipo: 'vacio' } | { tipo: 'no-encontrada'; codigo: string } | { tipo: 'ok'; alerta: AlertaEjemplo };

/** Consulta del estado de una alerta (datos de ejemplo). `solicitud` permite consultar desde otra sección. */
export function Estado({ solicitud }: { solicitud: { codigo: string; n: number } | null }) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(false);
  const [resultado, setResultado] = useState<Resultado>({ tipo: 'vacio' });

  function consultar(valor: string) {
    const limpio = valor.trim().toUpperCase();
    setCodigo(limpio);
    if (!limpio) { setError(true); return; }
    setError(false);
    const alerta = buscarAlerta(limpio);
    setResultado(alerta ? { tipo: 'ok', alerta } : { tipo: 'no-encontrada', codigo: limpio });
  }

  useEffect(() => {
    if (solicitud) consultar(solicitud.codigo);
  }, [solicitud]);

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    consultar(codigo);
  }

  return (
    <section id="estado" className="section-pad">
      <div className="container">
        <div className="row g-4 g-lg-5">
          <div className="col-lg-5">
            <span className="eyebrow">Seguimiento</span>
            <h2 className="section-title">Estado de una alerta</h2>
            <p className="text-muted-ac">Ingresa el código obtenido al registrar tu alerta, o prueba con un código de ejemplo.</p>
            <form className="d-flex gap-2" role="search" noValidate onSubmit={alEnviar}>
              <label htmlFor="codigoEstado" className="visually-hidden">Código de seguimiento</label>
              <input
                id="codigoEstado"
                className={`form-control${error ? ' is-invalid' : ''}`}
                placeholder="Ej.: INC-2026-000125"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                aria-invalid={error}
                aria-describedby={error ? 'codigoError' : undefined}
                required
              />
              <button className="btn btn-ac" type="submit">Consultar</button>
            </form>
            {error && <div id="codigoError" className="text-danger small mt-1">Ingresa un código de seguimiento.</div>}
            <p className="small mt-2 mb-4">
              Códigos de ejemplo:{' '}
              {CODIGOS_EJEMPLO.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <button type="button" className="btn btn-link btn-sm align-baseline ejemplo-codigo"
                    onClick={() => consultar(c)}>{c}</button>
                </span>
              ))}
            </p>
            <h3 className="h6 fw-bold">Significado de los estados</h3>
            <dl className="small mb-0">
              {ESTADOS.map((e) => (
                <div key={e.valor}>
                  <dt><span className={`badge ${e.badge}`}>{e.etiqueta}</span></dt>
                  <dd>{e.significado}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="col-lg-7">
            <div className="card card-ac p-4 h-100" aria-live="polite">
              <ResultadoConsulta resultado={resultado} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResultadoConsulta({ resultado }: { resultado: Resultado }) {
  if (resultado.tipo === 'vacio') {
    return <p className="text-muted-ac mb-0"><i className="bi bi-search" aria-hidden="true"></i> El resultado de la consulta aparecerá aquí.</p>;
  }
  if (resultado.tipo === 'no-encontrada') {
    return (
      <div className="alert alert-danger mb-0" role="alert">
        No encontramos la alerta <strong>{resultado.codigo}</strong>. Verifica el código (formato INC-AAAA-NNNNNN).
      </div>
    );
  }

  const a = resultado.alerta;
  const est = infoEstado(a.estado);
  const indiceActual = ESTADOS.findIndex((e) => e.valor === a.estado);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <div className="small text-muted-ac">Código</div>
          <h3 className="h5 fw-bold codigo-btn mb-0">{a.codigo}</h3>
        </div>
        <span className={`badge fs-6 ${est.badge}`}>{est.etiqueta}</span>
      </div>
      <dl className="row small mb-4">
        <dt className="col-4 col-sm-3">Tipo</dt><dd className="col-8 col-sm-9">{a.tipo}</dd>
        <dt className="col-4 col-sm-3">Zona</dt><dd className="col-8 col-sm-9">{a.zona}</dd>
        <dt className="col-4 col-sm-3">Fecha</dt><dd className="col-8 col-sm-9">{formatearFecha(a.fecha)}</dd>
        {a.unidad && <><dt className="col-4 col-sm-3">Unidad</dt><dd className="col-8 col-sm-9">{a.unidad}</dd></>}
      </dl>
      <h4 className="h6 fw-bold">Historial</h4>
      <ol className="timeline">
        {ESTADOS.map((e, i) => {
          const clase = i < indiceActual || a.estado === 'finalizada' ? 'hecho' : i === indiceActual ? 'actual' : '';
          return (
            <li key={e.valor} className={clase}>
              <span className="punto" aria-hidden="true"></span>
              <span className="fw-semibold">{e.etiqueta}</span>
              <span className="text-muted-ac small ms-2">{a.horas[e.valor] ?? 'Pendiente'}</span>
            </li>
          );
        })}
      </ol>
      <p className="small text-muted-ac mb-0">Datos de ejemplo del prototipo.</p>
    </>
  );
}
