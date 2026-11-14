import { useState, type FormEvent, type ReactNode } from 'react';

const PREGUNTAS: { id: string; pregunta: string; respuesta: ReactNode }[] = [
  { id: 'q1', pregunta: '¿Esta plataforma envía ayuda real?',
    respuesta: 'No. Es un prototipo académico: las alertas se guardan en la base de datos del proyecto, pero no llegan a ninguna institución. Usa siempre los canales oficiales.' },
  { id: 'q2', pregunta: '¿Qué datos debo dar al llamar a una línea de emergencia?',
    respuesta: 'Qué ocurre, dirección exacta con referencias, número de personas afectadas y si hay heridos. Mantén la calma y no cuelgues hasta que el operador lo indique.' },
  { id: 'q3', pregunta: '¿Cómo consulto el estado de mi alerta?',
    respuesta: <>En la sección <a href="#estado">Estado de alerta</a> ingresa el código (formato INC-AAAA-NNNNNN) que recibiste al registrarla.</> },
  { id: 'q4', pregunta: '¿La plataforma es accesible?',
    respuesta: 'Se diseñó tomando como referencia WCAG 2.1 AA: contraste adecuado, etiquetas en todos los campos, navegación completa por teclado y mensajes anunciados a lectores de pantalla.' },
];

export function Ayuda() {
  return (
    <section id="ayuda" className="section-pad">
      <div className="container">
        <div className="row g-4 g-lg-5">
          <div className="col-lg-7">
            <span className="eyebrow">Ayuda</span>
            <h2 className="section-title">Preguntas frecuentes</h2>
            <Acordeon />
          </div>
          <div className="col-lg-5">
            <span className="eyebrow">Orientación</span>
            <h2 className="section-title">Contacto</h2>
            <Contacto />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Acordeón: solo una pregunta abierta a la vez (igual que data-bs-parent). */
function Acordeon() {
  const [abierta, setAbierta] = useState<string | null>('q1');

  return (
    <div className="accordion" id="faq">
      {PREGUNTAS.map((p) => {
        const abiertaAhora = abierta === p.id;
        return (
          <div className="accordion-item" key={p.id}>
            <h3 className="accordion-header">
              <button
                className={`accordion-button${abiertaAhora ? '' : ' collapsed'}`}
                type="button"
                aria-expanded={abiertaAhora}
                aria-controls={p.id}
                id={`${p.id}-titulo`}
                onClick={() => setAbierta(abiertaAhora ? null : p.id)}
              >
                {p.pregunta}
              </button>
            </h3>
            <div id={p.id} className={`accordion-collapse collapse${abiertaAhora ? ' show' : ''}`}
              role="region" aria-labelledby={`${p.id}-titulo`}>
              <div className="accordion-body">{p.respuesta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Contacto() {
  const [mensaje, setMensaje] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const invalido = mensaje.trim().length < 5;

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (invalido) return;
    setEnviado(true);
    setMensaje('');
    setIntentado(false);
  }

  return (
    <div className="card card-ac p-4">
      <p className="mb-2"><i className="bi bi-mortarboard-fill" aria-hidden="true"></i> <strong>Grupo 6</strong> – Interacción Humano Computador (COMP1302)</p>
      <p className="mb-3 small text-muted-ac">Consultas sobre el prototipo (no emergencias).</p>
      <form noValidate onSubmit={alEnviar}>
        <label htmlFor="cMensaje" className="form-label fw-semibold">Mensaje</label>
        <textarea
          id="cMensaje"
          className={`form-control mb-2${intentado && invalido ? ' is-invalid' : ''}`}
          rows={3}
          value={mensaje}
          onChange={(e) => { setMensaje(e.target.value); setEnviado(false); }}
          aria-invalid={intentado && invalido}
          aria-describedby="cMensajeError"
          required
          minLength={5}
        />
        <div id="cMensajeError" className="invalid-feedback mb-2">Escribe tu consulta (mínimo 5 caracteres).</div>
        <button className="btn btn-ac-outline" type="submit">Enviar consulta</button>
      </form>
      <div aria-live="polite">
        {enviado && <p className="alert alert-success small mt-3 mb-0">¡Gracias! Tu consulta fue registrada (simulación).</p>}
      </div>
    </div>
  );
}
