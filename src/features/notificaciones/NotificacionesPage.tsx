import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificaciones, navegadorPermiteAvisos } from '@/hooks/useNotificaciones';
import { usePreferencias } from '@/hooks/usePreferencias';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Interruptor } from '@/components/ui/Interruptor';
import { fechaCorta, hora } from '@/features/alertas/comun';
import type { Notificacion } from '@/types/database.types';

/** Ícono según el título que pone el trigger registrar_estado. */
function iconoDe(titulo: string): IconName {
  if (titulo.startsWith('Unidad')) return 'car';
  if (titulo.startsWith('Fin')) return 'check-circle';
  if (titulo.startsWith('Alerta recibida')) return 'mail';
  if (titulo.startsWith('Alerta enviada')) return 'send';
  if (titulo.startsWith('Alerta cancelada')) return 'x';
  if (titulo.startsWith('Cambio')) return 'list';
  return 'message';
}

function cuando(iso: string) {
  const esHoy = fechaCorta(iso) === fechaCorta(new Date().toISOString());
  return esHoy ? hora(iso) : fechaCorta(iso);
}

/** E (notificaciones) / C19 · Novedades de las alertas del ciudadano. */
export default function NotificacionesPage() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodas } = useNotificaciones();
  const navigate = useNavigate();

  function abrir(n: Notificacion) {
    if (!n.leida) void marcarLeida(n.id);
    if (n.alerta_id) navigate(`/app/alertas/${n.alerta_id}`);
  }

  return (
    <div className="contenedor pagina-notificaciones">
      <section aria-labelledby="titulo-notif">
        <div className="fila-entre cabecera-pagina">
          <div>
            <h1 id="titulo-notif">Notificaciones</h1>
            <p className="muted">{noLeidas ? `${noLeidas} sin leer · novedades de tus alertas` : 'Novedades de tus alertas'}</p>
          </div>
          {noLeidas > 0 && (
            <button type="button" className="btn btn-texto" onClick={() => void marcarTodas()}>Marcar todo como leído</button>
          )}
        </div>

        {!notificaciones ? (
          <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando…</p>
        ) : notificaciones.length === 0 ? (
          <div className="card vacio"><Icon name="bell" size={28} /><p>Aún no tienes notificaciones. Aquí verás cada cambio de estado de tus alertas.</p></div>
        ) : (
          <ul className="lista-notificaciones">
            {notificaciones.map((n) => (
              <li key={n.id}>
                <button type="button" className={`notificacion${n.leida ? '' : ' no-leida'}`} onClick={() => abrir(n)}>
                  <span className="icono-tipo" aria-hidden="true"><Icon name={iconoDe(n.titulo)} size={18} /></span>
                  <span className="notificacion-texto">
                    <strong>{n.titulo}{!n.leida && <span className="oculto-visual"> (sin leer)</span>}</strong>
                    <small>{n.mensaje}</small>
                  </span>
                  <span className="notificacion-lado">
                    <small>{cuando(n.creado_en)}</small>
                    {!n.leida && <span className="punto-nav" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ComoTeAvisamos />
    </div>
  );
}

function ComoTeAvisamos() {
  const { prefs, cambiar } = usePreferencias();
  const [aviso, setAviso] = useState('');
  const soportado = navegadorPermiteAvisos();
  const permiso = soportado ? Notification.permission : 'denied';

  async function cambiarNavegador(activo: boolean) {
    setAviso('');
    if (activo && soportado && Notification.permission === 'default') {
      const r = await Notification.requestPermission();
      if (r !== 'granted') {
        setAviso('No diste permiso para mostrar notificaciones. Puedes activarlo en el candado de la barra de direcciones.');
        return;
      }
    } else if (activo && permiso === 'denied') {
      setAviso(soportado
        ? 'El navegador tiene bloqueadas las notificaciones de este sitio. Actívalas en el candado de la barra de direcciones.'
        : 'Tu navegador no permite notificaciones.');
      return;
    }
    if (!(await cambiar({ notif_navegador: activo }))) setAviso('No se pudo guardar. Inténtalo de nuevo.');
  }

  return (
    <aside className="card como-avisamos" aria-labelledby="titulo-avisos">
      <h2 id="titulo-avisos" className="h-chico">Cómo te avisamos</h2>
      <Interruptor etiqueta="Notificaciones del navegador" icono="bell"
        descripcion={prefs.notif_navegador && permiso !== 'granted' ? 'Falta el permiso del navegador' : 'Cuando la pestaña no está a la vista'}
        activo={prefs.notif_navegador && permiso === 'granted'} onCambiar={(v) => void cambiarNavegador(v)} />
      <Interruptor etiqueta="SMS al celular" icono="smartphone" descripcion="Simulado en el prototipo"
        activo={prefs.notif_sms} onCambiar={(v) => void cambiar({ notif_sms: v })} />
      <Interruptor etiqueta="Correo electrónico" icono="mail" descripcion="Simulado en el prototipo"
        activo={prefs.notif_correo} onCambiar={(v) => void cambiar({ notif_correo: v })} />
      <div aria-live="polite">{aviso && <p className="texto-chico color-warn">{aviso}</p>}</div>
    </aside>
  );
}
