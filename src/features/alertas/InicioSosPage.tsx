import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferencias } from '@/hooks/usePreferencias';
import { useComandoVoz } from '@/hooks/useComandoVoz';
import { Button } from '@/components/ui/Button';
import { useUbicacion } from '@/hooks/useUbicacion';
import { supabase } from '@/lib/supabase';
import { Mapa } from '@/components/map/Mapa';
import { Icon } from '@/components/ui/Icon';
import type { Alerta } from '@/types/database.types';
import { ETIQUETA_CORTA, esActiva, fechaCorta, fechaLarga, hora, iconoTipo, useTipos } from './comun';

type Resumen = Pick<Alerta, 'id' | 'codigo' | 'tipo_id' | 'estado' | 'recibida_en'>;

/** E10 / C10 · Inicio con el botón SOS (toque 1 de 3). */
export default function InicioSosPage() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [recientes, setRecientes] = useState<Resumen[] | null>(null);

  const iniciarSos = (porVoz = false) => navigate('/app/alerta/nueva', { state: { iniciada: new Date().toISOString(), porVoz } });
  const [comandoOido, setComandoOido] = useState<string | null>(null);

  // Atajo de teclado Alt + S (mockup E10)
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); iniciarSos(); }
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  });

  useEffect(() => {
    if (!perfil) return;
    supabase.from('alertas').select('id, codigo, tipo_id, estado, recibida_en')
      .eq('ciudadano_id', perfil.id).order('recibida_en', { ascending: false }).limit(3)
      .then(({ data }) => setRecientes(data ?? []));
  }, [perfil]);

  const nombre = perfil ? perfil.nombres.split(' ')[0].charAt(0) + perfil.nombres.split(' ')[0].slice(1).toLowerCase() : '';
  const enCurso = recientes?.find((a) => esActiva(a.estado));

  return (
    <div className="contenedor inicio">
      <section className="card inicio-sos" aria-labelledby="titulo-inicio">
        {enCurso && (
          <Link to={`/app/alertas/${enCurso.id}`} className="aviso-en-curso">
            <Icon name="clock" />
            <span>Tienes una alerta en curso <strong>{enCurso.codigo}</strong> · {ETIQUETA_CORTA[enCurso.estado]}</span>
            <Icon name="chevron-right" />
          </Link>
        )}
        <h1 id="titulo-inicio">Bienvenido, {nombre}</h1>
        <p className="muted">Presiona el botón para pedir ayuda policial. Tu ubicación se envía automáticamente.</p>

        <button type="button" className="boton-sos" onClick={() => iniciarSos()} aria-describedby="sos-ayuda">
          <span className="boton-sos-texto">SOS</span>
          <span className="boton-sos-sub">EMERGENCIA</span>
        </button>
        <p id="sos-ayuda" className="texto-chico centro">
          Envío silencioso: no realiza llamadas · Atajo <kbd>Alt</kbd> + <kbd>S</kbd>
        </p>

        <TarjetaVoz pausada={comandoOido !== null} onComando={setComandoOido} />
        {comandoOido !== null && (
          <ConfirmarVoz frase={comandoOido} onActivar={() => iniciarSos(true)} onCancelar={() => setComandoOido(null)} />
        )}

        <Link to="/app/alertas" className="btn btn-contorno solo-movil btn-bloque"><Icon name="list" /> Mis alertas</Link>
      </section>

      <div className="inicio-lateral">
        <TarjetaUbicacion />

        <section className="card" aria-labelledby="titulo-recientes">
          <div className="fila-entre">
            <h2 id="titulo-recientes" className="h-chico">Mis alertas recientes</h2>
            <Link to="/app/alertas" className="enlace">Ver todas</Link>
          </div>
          <ListaRecientes alertas={recientes} />
        </section>

        {perfil?.verificado_en && (
          <section className="card fila-icono">
            <span className="check-circulo" aria-hidden="true"><Icon name="check" size={14} /></span>
            <div>
              <strong>Cuenta verificada</strong>
              <p className="texto-chico">Identidad validada con DNI, SMS y selfie el {fechaLarga(perfil.verificado_en)}.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TarjetaUbicacion() {
  const { estado, posicion, direccion, reintentar } = useUbicacion();

  return (
    <section className="card tarjeta-ubicacion" aria-labelledby="titulo-ubicacion">
      <h2 id="titulo-ubicacion" className="oculto-visual">Tu ubicación</h2>
      {estado === 'ok' && posicion ? (
        <>
          <Mapa pin={posicion} precision={posicion.precision} interactivo={false} zoom={16}
            etiqueta="Mapa con tu ubicación actual" className="mapa-mini" />
          <div className="fila-icono">
            <Icon name="map-pin" />
            <div>
              <strong>{direccion?.linea1 ?? `${posicion.lat.toFixed(4)}, ${posicion.lng.toFixed(4)}`}</strong>
              <p className="texto-chico">{direccion?.linea2 ? `${direccion.linea2} · ` : ''}GPS ±{posicion.precision} m</p>
            </div>
          </div>
        </>
      ) : estado === 'buscando' ? (
        <p className="fila-icono texto-chico"><span className="spinner spinner-sm" /> Obteniendo tu ubicación GPS…</p>
      ) : (
        <div className="fila-icono">
          <Icon name="alert" className="color-warn" />
          <div>
            <strong>{estado === 'denegado' ? 'Sin permiso de ubicación' : 'No pudimos obtener tu ubicación'}</strong>
            <p className="texto-chico">
              {estado === 'denegado'
                ? 'Actívalo en el candado de la barra de direcciones. Igual puedes enviar la alerta marcando tu ubicación en el mapa.'
                : 'Revisa que el GPS esté encendido. Igual puedes marcar tu ubicación en el mapa al enviar.'}
            </p>
            <button type="button" className="btn btn-contorno btn-chico" onClick={reintentar}><Icon name="refresh" /> Reintentar</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ListaRecientes({ alertas }: { alertas: Resumen[] | null }) {
  const { tipos } = useTipos();
  if (!alertas) return <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando…</p>;
  if (!alertas.length) return <p className="texto-chico">Aún no has enviado alertas.</p>;
  return (
    <ul className="lista-alertas">
      {alertas.map((a) => {
        const tipo = tipos?.find((t) => t.id === a.tipo_id);
        return (
          <li key={a.id}>
            <Link to={`/app/alertas/${a.id}`}>
              <span className="icono-tipo" aria-hidden="true"><Icon name={iconoTipo(tipo?.icono ?? '')} size={18} /></span>
              <span className="lista-alertas-texto">
                <strong>{tipo?.nombre ?? 'Alerta'}</strong>
                <small>{a.codigo} · {fechaCorta(a.recibida_en)} {hora(a.recibida_en)}</small>
              </span>
              <span className={`insignia estado-${a.estado}`}>{ETIQUETA_CORTA[a.estado]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Tarjeta "También puedes decir: Emergencia policial" (RF-04). Escucha solo si el ciudadano la activa. */
function TarjetaVoz({ pausada, onComando }: { pausada: boolean; onComando: (frase: string) => void }) {
  const { prefs } = usePreferencias();
  const [escuchar, setEscuchar] = useState(() => {
    try { return sessionStorage.getItem('ac-voz') === 'si'; } catch { return false; }
  });
  const { estado, oido } = useComandoVoz(prefs.comando_voz && escuchar && !pausada, onComando);

  function alternar() {
    const nuevo = !escuchar;
    setEscuchar(nuevo);
    try { sessionStorage.setItem('ac-voz', nuevo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  }

  if (!prefs.comando_voz) return null;

  const detalle =
    estado === 'no-soportado' ? 'Tu navegador no permite comandos de voz. Usa Chrome o Edge.'
    : estado === 'sin-permiso' ? 'Permite el uso del micrófono en el candado de la barra de direcciones.'
    : estado === 'sin-red' ? 'El reconocimiento de voz necesita conexión a internet.'
    : estado === 'escuchando' ? (oido ? `Escuchando… "${oido}"` : 'Escuchando…')
    : 'Toca el micrófono para activar el comando de voz.';

  return (
    <div className={`tarjeta-voz${estado === 'escuchando' ? ' activa' : ''}`}>
      <div>
        <small>También puedes decir:</small>
        <strong>"Emergencia policial"</strong>
        <small className="voz-estado" aria-live="polite">{detalle}</small>
      </div>
      <button type="button" className="boton-mic" onClick={alternar} disabled={estado === 'no-soportado'}
        aria-pressed={escuchar} aria-label={escuchar ? 'Dejar de escuchar el comando de voz' : 'Activar el comando de voz'}>
        <Icon name="mic" size={22} />
      </button>
    </div>
  );
}

/** Ventana de confirmación del comando de voz: se activa sola a los 3 s salvo que se cancele. */
function ConfirmarVoz({ frase, onActivar, onCancelar }: { frase: string; onActivar: () => void; onCancelar: () => void }) {
  const [segundos, setSegundos] = useState(3);
  const activar = useRef(onActivar);
  activar.current = onActivar;

  useEffect(() => {
    if (segundos <= 0) { activar.current(); return; }
    const t = setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [segundos]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCancelar]);

  return (
    <div className="fondo-modal">
      <div className="card modal-voz" role="alertdialog" aria-modal="true" aria-labelledby="voz-titulo" aria-describedby="voz-desc">
        <button type="button" className="btn-icono cerrar-modal" onClick={onCancelar} aria-label="Cancelar"><Icon name="x" /></button>
        <p className="lbl" id="voz-titulo">COMANDO DE VOZ</p>
        <span className="icono-grande" aria-hidden="true"><Icon name="mic" size={30} /></span>
        <p className="frase-voz">"{frase.charAt(0).toUpperCase() + frase.slice(1)}"</p>
        <p className="texto-chico centro"><Icon name="check" size={14} /> Comando reconocido</p>
        <p id="voz-desc" className="oculto-visual" aria-live="assertive">Se activará el SOS en {segundos} segundos. Pulsa Cancelar para detenerlo.</p>
        <Button className="btn-bloque" onClick={onActivar} autoFocus>Activar SOS ahora · {segundos} s</Button>
        <Button variante="texto" onClick={onCancelar}>Cancelar</Button>
        <p className="texto-chico centro">Usa el micrófono del navegador · compatible con lectores de pantalla</p>
      </div>
    </div>
  );
}
