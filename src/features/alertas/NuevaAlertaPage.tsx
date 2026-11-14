import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUbicacion } from '@/hooks/useUbicacion';
import { useColaSinConexion, insertarAlerta, type DatosAlerta } from '@/hooks/useColaSinConexion';
import { buscarDireccion, direccionDe, type Direccion, type ResultadoBusqueda } from '@/lib/geocodificar';
import { Mapa, type Punto } from '@/components/map/Mapa';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { TipoIncidente } from '@/types/database.types';
import { hora, iconoTipo, useTipos } from './comun';

/** Centro de Lima: punto de partida del pin si no hay GPS. */
const LIMA: Punto = { lat: -12.0464, lng: -77.0428 };

type Fase = 'formulario' | 'enviando' | 'error';

/**
 * E11–E12 / C11–C13 · Toque 2 (tipo) y toque 3 (confirmar ubicación y enviar).
 * En escritorio ambos paneles se ven juntos; en el celular son dos pantallas.
 */
export default function NuevaAlertaPage() {
  const { perfil } = useAuth();
  const gps = useUbicacion();
  const navigate = useNavigate();
  const estadoRuta = useLocation().state as { iniciada?: string; porVoz?: boolean } | null;
  const iniciada = useRef<string>(estadoRuta?.iniciada ?? new Date().toISOString());
  const porVoz = !!estadoRuta?.porVoz;
  const { tipos, error: errorTipos } = useTipos();
  const cola = useColaSinConexion();

  const [tipo, setTipo] = useState<TipoIncidente | null>(null);
  const [pantallaMovil, setPantallaMovil] = useState<'tipo' | 'ubicacion'>('tipo');
  // Ubicación elegida a mano (pin arrastrado o dirección buscada). null = se usa el GPS.
  const [manual, setManual] = useState<{ punto: Punto; direccion: Direccion | null } | null>(null);
  const [fase, setFase] = useState<Fase>('formulario');
  const [error, setError] = useState('');

  const tieneGps = gps.estado === 'ok' && !!gps.posicion;
  const punto: Punto = manual?.punto ?? (tieneGps ? gps.posicion! : LIMA);
  const direccion = manual ? manual.direccion : gps.direccion;
  const ubicacionLista = !!manual || tieneGps;
  const listo = !!tipo && ubicacionLista && fase !== 'enviando';

  function elegirTipo(t: TipoIncidente) {
    setTipo(t);
    setPantallaMovil('ubicacion');
  }

  async function moverPin(p: Punto) {
    setManual({ punto: p, direccion: null });
    const d = await direccionDe(p.lat, p.lng);
    setManual((m) => (m && m.punto.lat === p.lat && m.punto.lng === p.lng ? { punto: p, direccion: d } : m));
  }

  async function enviar() {
    if (!perfil || !tipo || !ubicacionLista) return;
    setFase('enviando');
    setError('');
    const textoDireccion = direccion ? [direccion.linea1, direccion.linea2].filter(Boolean).join(', ') : null;
    const datos: DatosAlerta = {
      id: crypto.randomUUID(),   // generado aquí: si se reintenta, no se duplica
      ciudadano_id: perfil.id,
      tipo_id: tipo.id,
      latitud: punto.lat,
      longitud: punto.lng,
      precision_m: manual ? null : gps.posicion?.precision ?? null,
      direccion: textoDireccion,
      ubicacion_manual: !!manual,
      canal: 'web',
      activada_por_voz: porVoz,
      generada_en: iniciada.current,
    };

    // Sin señal: la alerta se guarda en el dispositivo y se envía sola al volver la conexión.
    const aCola = () => {
      cola.guardar(datos, tipo.nombre);
      navigate('/app/sin-conexion', { replace: true, state: { id: datos.id } });
    };
    if (!navigator.onLine) { aCola(); return; }

    const r = await insertarAlerta(datos);
    if (r.ok) {
      navigate(`/app/alertas/${datos.id}`, { replace: true, state: { recienEnviada: true } });
      return;
    }
    if (r.red) { aCola(); return; }
    setError(r.mensaje.includes('row-level security')
      ? 'Tu cuenta no está habilitada para enviar alertas. Verifica tu identidad.'
      : 'No pudimos enviar la alerta. Inténtalo de nuevo o llama al 105.');
    setFase('error');
  }

  if (fase === 'enviando') {
    return <Enviando tipo={tipo!} punto={punto} iniciada={iniciada.current} />;
  }

  return (
    <div className={`contenedor nueva-alerta pantalla-${pantallaMovil}`}>
      {/* ----- Toque 2: tipo de incidente ----- */}
      <section className="panel-tipo" aria-labelledby="titulo-tipo">
        <div className="encabezado-flujo">
          <p className="lbl">ALERTA INICIADA · {hora(iniciada.current, true)}</p>
          <p className="texto-chico paso-toque">Toque 2 de 3 <span className="solo-escritorio">· Elige el tipo y envía</span></p>
        </div>
        <ProgresoToques actual={2} />
        <h1 id="titulo-tipo">¿Qué está ocurriendo?</h1>
        <p className="muted solo-movil">Toca una opción. Tu ubicación se envía automáticamente.</p>

        {errorTipos && <p className="alerta-form" role="alert">No pudimos cargar los tipos de incidente. Recarga la página o llama al 105.</p>}
        <div className="grilla-tipos" role="radiogroup" aria-labelledby="titulo-tipo">
          {(tipos ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tipo?.id === t.id}
              className={`opcion-tipo${tipo?.id === t.id ? ' elegido' : ''}`}
              onClick={() => elegirTipo(t)}
            >
              <span className="icono-tipo" aria-hidden="true"><Icon name={iconoTipo(t.icono)} size={22} /></span>
              {t.nombre}
            </button>
          ))}
          {!tipos && !errorTipos && <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando tipos…</p>}
        </div>

        <p className="texto-chico solo-movil estado-gps-fondo" role="status">
          {tieneGps ? <><Icon name="check" size={16} /> Ubicación GPS lista (±{gps.posicion!.precision} m)</>
            : gps.estado === 'buscando' ? <><span className="spinner spinner-sm" /> Obteniendo tu ubicación GPS en segundo plano…</>
            : <><Icon name="alert" size={16} /> Sin GPS: podrás marcar tu ubicación en el mapa.</>}
        </p>
        <button type="button" className="btn btn-texto solo-movil" onClick={() => navigate('/app')}>Cancelar</button>
      </section>

      {/* ----- Toque 3: confirmar ubicación y enviar ----- */}
      <section className="panel-ubicacion card" aria-labelledby="titulo-ubicacion">
        <div className="solo-movil encabezado-movil">
          <button type="button" className="btn-icono" onClick={() => setPantallaMovil('tipo')} aria-label="Volver al tipo de incidente">
            <Icon name="arrow-left" size={22} />
          </button>
          <div>
            <h1 id="titulo-ubicacion" className="h-medio">Confirmar ubicación</h1>
            <p className="texto-chico">{tipo?.nombre ?? 'Elige el tipo de incidente'} · Toque 3 de 3</p>
          </div>
        </div>
        <div className="solo-movil"><ProgresoToques actual={3} /></div>
        <h2 className="oculto-visual solo-escritorio">Confirmar ubicación</h2>

        {!tieneGps && !manual && (
          <div className="caja caja-error" role="alert">
            <Icon name="alert" />
            <div>
              <strong>No pudimos obtener tu ubicación exacta.</strong>
              <p>Arrastra el pin hasta el lugar donde estás o busca una dirección.</p>
            </div>
          </div>
        )}
        {(!tieneGps || manual) && <BuscarDireccion onElegir={(r) => setManual({ punto: r, direccion: r })} />}

        <div className="mapa-envoltura">
          <Mapa pin={punto} arrastrable onMover={moverPin} precision={manual ? null : gps.posicion?.precision}
            etiqueta="Mapa para confirmar tu ubicación. Arrastra el pin si no es exacto." className="mapa-alerta" />
          <span className="chip-mapa"><Icon name="crosshair" size={14} /> Arrastra el pin si no es exacto</span>
        </div>

        <div className="fila-icono">
          <Icon name="map-pin" />
          <div>
            <strong>{direccion?.linea1 ?? (ubicacionLista ? `${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}` : 'Ubicación sin confirmar')}</strong>
            <p className="texto-chico">
              {direccion?.linea2 ? `${direccion.linea2} · ` : ''}
              {manual ? 'Ubicación ajustada manualmente' : tieneGps ? `GPS ±${gps.posicion!.precision} m` : 'Mueve el pin a tu ubicación'}
              {' · '}{hora(iniciada.current, true)}
            </p>
          </div>
          {manual && tieneGps && (
            <button type="button" className="btn btn-texto" onClick={() => setManual(null)}>Usar GPS</button>
          )}
        </div>

        {fase === 'error' && (
          <div className="caja caja-error" role="alert">
            <Icon name="alert" />
            <div>
              <strong>{error}</strong>
              <p><a href="tel:105">Llamar al 105</a></p>
            </div>
          </div>
        )}

        {!tipo && <p className="texto-chico solo-escritorio">Elige el tipo de incidente para enviar.</p>}
        <Button className="btn-bloque" onClick={enviar} disabled={!listo}>
          <Icon name="send" /> Enviar alerta
        </Button>
        <button type="button" className="btn btn-texto" onClick={() => navigate('/app')}>Cancelar</button>
      </section>
    </div>
  );
}

function ProgresoToques({ actual }: { actual: number }) {
  return (
    <div className="progreso-toques" aria-hidden="true">
      {[1, 2, 3].map((n) => <span key={n} className={n <= actual ? 'on' : ''} />)}
    </div>
  );
}

function BuscarDireccion({ onElegir }: { onElegir: (r: ResultadoBusqueda) => void }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setResultados(await buscarDireccion(texto));
    setBuscando(false);
  }

  return (
    <div className="buscador">
      <form onSubmit={buscar} role="search" className="buscador-form">
        <label htmlFor="buscar-dir" className="oculto-visual">Buscar dirección o referencia</label>
        <Icon name="search" className="field-icono" />
        <input id="buscar-dir" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar dirección o referencia" />
        <Button type="submit" variante="contorno" className="btn-chico" cargando={buscando}>Buscar</Button>
      </form>
      <div aria-live="polite">
        {resultados && !resultados.length && <p className="texto-chico">Sin resultados. Prueba con otra referencia o arrastra el pin.</p>}
        {!!resultados?.length && (
          <ul className="resultados-busqueda">
            {resultados.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => { onElegir(r); setResultados(null); setTexto(r.linea1); }}>
                  <Icon name="map-pin" size={16} />
                  <span><strong>{r.linea1}</strong><small>{r.linea2}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** E12 / C13 · Enviando alerta… */
function Enviando({ tipo, punto, iniciada }: { tipo: TipoIncidente; punto: Punto; iniciada: string }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titulo.current?.focus(); }, []);
  return (
    <div className="pantalla-centro">
      <div className="card enviando" role="status" aria-live="polite">
        <span className="icono-enviando" aria-hidden="true"><Icon name="send" size={40} /></span>
        <h1 ref={titulo} tabIndex={-1}>Enviando alerta…</h1>
        <p className="muted">{tipo.nombre} · No cierres esta pestaña</p>
        <ul className="resumen">
          <li><span className="check-circulo" aria-hidden="true"><Icon name="check" size={14} /></span><span>Ubicación GPS</span><small>{punto.lat.toFixed(4)}, {punto.lng.toFixed(4)}</small></li>
          <li><span className="check-circulo" aria-hidden="true"><Icon name="check" size={14} /></span><span>Fecha y hora</span><small>{new Date(iniciada).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</small></li>
          <li><span className="spinner spinner-sm" aria-hidden="true" /><span>Enviando a la Central 105</span></li>
        </ul>
        <p className="texto-chico centro"><Icon name="lock" size={14} /> Datos cifrados hacia MININTER / PNP</p>
      </div>
    </div>
  );
}
