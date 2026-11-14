import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useColaSinConexion, type AlertaPendiente } from '@/hooks/useColaSinConexion';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { hora } from './comun';

/** Número para el SMS de respaldo. */
const NUMERO_SMS = '105';

/** C23 / E (sin conexión) · La alerta quedó guardada y se reenvía sola al volver la señal (RNF-09). */
export default function SinConexionPage() {
  const { perfil } = useAuth();
  const { pendientes, enviadas, enLinea, reintentarAhora } = useColaSinConexion();
  const navigate = useNavigate();
  const idBuscado = (useLocation().state as { id?: string } | null)?.id;

  // Cuando la alerta de esta pantalla llega a la central, se pasa a su estado.
  useEffect(() => {
    if (idBuscado && enviadas[idBuscado]) {
      navigate(`/app/alertas/${enviadas[idBuscado]}`, { replace: true, state: { recienEnviada: true } });
    }
  }, [idBuscado, enviadas, navigate]);

  const lista = idBuscado ? pendientes.filter((p) => p.datos.id === idBuscado) : pendientes;
  const principal = lista[0];

  if (!principal) {
    return (
      <div className="pantalla-centro">
        <div className="card enviando">
          <span className="icono-grande"><Icon name="check-circle" size={30} /></span>
          <h1>No tienes alertas pendientes</h1>
          <p className="muted">Todas tus alertas fueron enviadas a la central.</p>
          <Link to="/app/alertas" className="btn btn-primario btn-bloque">Ver mis alertas</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-centro">
      <div className="card enviando sin-conexion">
        <span className="icono-grande warn" aria-hidden="true"><Icon name="wifi-off" size={32} /></span>
        <h1>{enLinea ? 'Reenviando tu alerta…' : 'Sin conexión a internet'}</h1>
        <p className="muted">
          Tu alerta no se perdió: quedó guardada en este dispositivo y se enviará sola apenas vuelva la señal.
          No cierres esta pestaña.
        </p>

        <ul className="resumen" aria-live="polite">
          {lista.map((p) => <Fila key={p.datos.id} p={p} />)}
          <li>
            {principal.error ? <span className="check-circulo no" aria-hidden="true"><Icon name="alert" size={14} /></span>
              : <span className="spinner spinner-sm" aria-hidden="true" />}
            <span>{principal.error ? principal.error : 'Reintentando el envío'}</span>
            <small>Intento {principal.intentos} · automático</small>
          </li>
        </ul>

        <a href="tel:105" className="btn btn-primario btn-bloque"><Icon name="phone" /> Llamar al 105</a>
        <a href={enlaceSms(principal, perfil?.dni)} className="btn btn-contorno btn-bloque"><Icon name="message" /> Enviar por SMS</a>
        {enLinea && <Button variante="texto" onClick={reintentarAhora}>Reintentar ahora</Button>}
        <Link to="/app" className="enlace">Volver al inicio</Link>
      </div>
    </div>
  );
}

function Fila({ p }: { p: AlertaPendiente }) {
  return (
    <li>
      <span className="check-circulo" aria-hidden="true"><Icon name="check" size={14} /></span>
      <span>Alerta guardada en este dispositivo<br /><small>{p.tipoNombre} · {hora(p.datos.generada_en ?? p.guardadaEn, true)} · ubicación incluida</small></span>
    </li>
  );
}

/** SMS con los datos esenciales (funciona sin datos móviles, solo con señal de celular). */
function enlaceSms(p: AlertaPendiente, dni?: string) {
  const d = p.datos;
  const texto = [
    `ALERTA ${p.tipoNombre.toUpperCase()}`,
    d.direccion ? `en ${d.direccion}` : '',
    `(${d.latitud.toFixed(5)}, ${d.longitud.toFixed(5)})`,
    dni ? `DNI ${dni}` : '',
    '- enviado desde AlertaCiudadana',
  ].filter(Boolean).join(' ');
  // "?&body=" funciona tanto en Android como en iOS.
  return `sms:${NUMERO_SMS}?&body=${encodeURIComponent(texto)}`;
}
