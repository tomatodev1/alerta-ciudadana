import { useCallback, useEffect, useRef, useState } from 'react';
import { useTiposIncidente } from '../hooks';
import { conGuia, type TipoConGuia } from '../datos';

/** Tipos de emergencia: se leen de tipos_incidente (o datos de respaldo sin sesión). */
export function Tipos() {
  const { tipos } = useTiposIncidente();
  const [seleccionado, setSeleccionado] = useState<TipoConGuia | null>(null);
  const cerrar = useCallback(() => setSeleccionado(null), []);

  return (
    <section id="tipos" className="section-pad">
      <div className="container">
        <div className="text-center"><span className="eyebrow">Servicios</span></div>
        <h2 className="section-title text-center">Tipos de emergencia</h2>
        <p className="text-center text-muted-ac mb-5">Selecciona un tipo para ver qué hacer y a qué canal oficial acudir.</p>
        <div className="row g-4">
          {tipos.map(conGuia).map((t) => (
            <div className="col-md-6 col-lg-4" key={t.id}>
              <button
                type="button"
                className="card card-ac tipo-card p-4 h-100 w-100 text-start"
                style={{ '--tc': t.color } as React.CSSProperties}
                onClick={() => setSeleccionado(t)}
                aria-haspopup="dialog"
              >
                <span className="d-flex align-items-center gap-3 mb-3">
                  <span className="icono-circulo" style={{ background: t.color }} aria-hidden="true">
                    <i className={`bi ${t.iconoBi}`}></i>
                  </span>
                  <span>
                    <span className="h6 fw-bold d-block mb-1">{t.nombre}</span>
                    {t.prioridad === 1 && <span className="badge prioridad-alta">Prioridad alta</span>}
                  </span>
                </span>
                <span className="small text-muted-ac d-block mb-3">{t.descripcion}</span>
                <span className="ver-mas mt-auto">Ver qué hacer <i className="bi bi-arrow-right" aria-hidden="true"></i></span>
              </button>
            </div>
          ))}
        </div>
      </div>
      {seleccionado && <ModalTipo tipo={seleccionado} onCerrar={cerrar} />}
    </section>
  );
}

function ModalTipo({ tipo, onCerrar }: { tipo: TipoConGuia; onCerrar: () => void }) {
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogo.current?.querySelector<HTMLElement>('.btn-close')?.focus();

    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (e.key !== 'Tab' || !dialogo.current) return;
      // Mantiene el foco dentro del modal.
      const focables = dialogo.current.querySelectorAll<HTMLElement>('button, a[href]');
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflow;
      anterior?.focus({ preventScroll: true });
    };
  }, [onCerrar]);

  return (
    <>
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalTipoTitulo"
        onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      >
        <div className="modal-dialog modal-dialog-centered" ref={dialogo}>
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5 d-flex align-items-center gap-2" id="modalTipoTitulo">
                <i className={`bi ${tipo.iconoBi}`} style={{ color: tipo.color }} aria-hidden="true"></i>
                {tipo.nombre}
              </h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted-ac">{tipo.descripcion}</p>
              <h3 className="h6 fw-bold">Qué hacer</h3>
              <ol className="small ps-3">
                {tipo.pasos.map((p) => <li key={p} className="mb-1">{p}</li>)}
              </ol>
              <div className="alert alert-light border d-flex align-items-center gap-3 mb-0">
                <span className="canal-numero lh-1">{tipo.canal.numero}</span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">Canal oficial: {tipo.canal.nombre}</div>
                  <a href={`tel:${tipo.canal.numero}`} className="small">Llamar al {tipo.canal.numero}</a>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ac-outline" onClick={onCerrar}>Cerrar</button>
              <a href="#alerta" className="btn btn-ac" onClick={onCerrar}>Registrar este tipo de alerta</a>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}
