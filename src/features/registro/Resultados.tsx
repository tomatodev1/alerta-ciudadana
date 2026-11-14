import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { invocar } from '@/lib/funciones';
import type { Perfil } from '@/types/database.types';
import { mascaraCelular, mascaraDni } from './validaciones';

export interface ResultadoVerificacion {
  estado: 'verificada' | 'rechazada';
  intentos_restantes: number;
  checks?: { dni: boolean; celular: boolean; prueba_vida: boolean; rostro: boolean };
}

function Fila({ ok, texto, detalle }: { ok: boolean; texto: string; detalle?: string }) {
  return (
    <li>
      <span className={`check-circulo${ok ? '' : ' no'}`} aria-hidden="true"><Icon name={ok ? 'check' : 'alert'} size={14} /></span>
      <span>{texto}<span className="oculto-visual">{ok ? ': correcto' : ': no superado'}</span></span>
      {detalle && <small>{detalle}</small>}
    </li>
  );
}

/** E08 / C08 · ¡Identidad verificada! (verde solo en esta confirmación final). */
export function Exito({ perfil, onIrInicio }: { perfil: Perfil; onIrInicio: () => void }) {
  return (
    <div className="resultado centrado">
      <span className="icono-grande ok"><Icon name="user-check" size={36} /></span>
      <h1>¡Identidad verificada!</h1>
      <p className="muted">
        Tu rostro coincide con la foto de tu DNI y la prueba de vida fue exitosa. Ya puedes enviar alertas desde cualquier dispositivo.
      </p>
      <ul className="resumen">
        <Fila ok texto="DNI validado con RENIEC" detalle={mascaraDni(perfil.dni)} />
        <Fila ok texto="Celular confirmado por SMS" detalle={mascaraCelular(perfil.celular)} />
        <Fila ok texto="Rostro coincide con el DNI" detalle="Coincidencia alta" />
      </ul>
      <Button className="btn-bloque" onClick={onIrInicio} autoFocus>Ir al inicio <Icon name="arrow-right" /></Button>
    </div>
  );
}

/** E09 / C09 · No pudimos verificar tu identidad. */
export function Rechazo({ perfil, resultado, onReintentar, onRevision }: {
  perfil: Perfil;
  resultado: ResultadoVerificacion | null;
  onReintentar: () => void;
  onRevision: () => void;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState('');
  const restantes = resultado?.intentos_restantes ?? Math.max(0, 5 - perfil.intentos_verificacion);
  const c = resultado?.checks;

  const motivo = !c || !c.rostro
    ? `El rostro de la selfie no coincide con la foto del DNI ${mascaraDni(perfil.dni)}.`
    : !c.celular ? 'Tu celular aún no está confirmado.'
    : !c.dni ? 'Tus nombres no coinciden con los registrados para tu DNI.'
    : 'La prueba de vida no se completó.';

  async function pedirRevision() {
    setPidiendo(true);
    setError('');
    try {
      await invocar('verificar-identidad', { accion: 'revision_manual' });
      onRevision();
    } catch (e) {
      setError((e as Error).message);
      setPidiendo(false);
    }
  }

  return (
    <div className="resultado centrado">
      <span className="icono-grande warn"><Icon name="alert" size={30} /></span>
      <h1>No pudimos verificar tu identidad</h1>
      <p className="muted">
        {motivo} Por seguridad, tu cuenta aún no puede enviar alertas. Esto evita que alguien use el DNI de otra persona.
      </p>
      <div className="caja">
        <Icon name="info" />
        <div>
          <strong>Posibles causas</strong>
          <ul>
            <li>Poca luz o reflejos en el DNI</li>
            <li>Lentes oscuros, gorra o mascarilla</li>
            <li>El DNI no pertenece a la persona frente a la cámara</li>
          </ul>
        </div>
      </div>
      <p className="texto-chico">
        <Icon name="refresh" size={16} />
        {restantes > 0
          ? <>Te quedan <strong>{restantes} {restantes === 1 ? 'intento' : 'intentos'}</strong>. Después, la verificación deberá hacerse de forma presencial.</>
          : <>Agotaste los intentos. Acércate a una comisaría con tu DNI o pide una revisión manual.</>}
      </p>
      {error && <p className="alerta-form" role="alert">{error}</p>}
      <div className="acciones-fila" style={{ width: '100%' }}>
        {restantes > 0 && <Button onClick={onReintentar}><Icon name="refresh" /> Intentar de nuevo</Button>}
        <Button variante="contorno" onClick={pedirRevision} cargando={pidiendo}><Icon name="message" /> Solicitar revisión manual</Button>
      </div>
      <div className="caja">
        <Icon name="phone" />
        <p style={{ margin: 0 }}>Si estás en una emergencia ahora, llama al <a href="tel:105"><strong>105</strong></a>. No necesitas cuenta para llamar.</p>
      </div>
    </div>
  );
}

/** Verificación en revisión manual por un operador. */
export function EnRevision({ onSalir }: { onSalir: () => void }) {
  return (
    <div className="resultado centrado">
      <span className="icono-grande"><Icon name="clock" size={30} /></span>
      <h1>Tu verificación está en revisión</h1>
      <p className="muted">
        Un operador revisará tus fotos y te avisaremos por correo cuando tu cuenta esté activa.
        Mientras tanto no podrás enviar alertas desde el sistema.
      </p>
      <div className="caja">
        <Icon name="phone" />
        <p style={{ margin: 0 }}>Ante una emergencia, llama al <a href="tel:105"><strong>105</strong></a>. No necesitas cuenta para llamar.</p>
      </div>
      <Button variante="contorno" className="btn-bloque" onClick={onSalir}><Icon name="logout" /> Cerrar sesión</Button>
    </div>
  );
}
