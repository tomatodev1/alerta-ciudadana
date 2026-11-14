import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useEvidencias, type ItemSubida } from '@/hooks/useEvidencias';
import { esTactil, formatoBytes } from '@/lib/medios';
import { Button } from '@/components/ui/Button';
import { Cargando } from '@/components/ui/Cargando';
import { Icon, type IconName } from '@/components/ui/Icon';
import { esActiva } from '@/features/alertas/comun';
import type { Alerta } from '@/types/database.types';
import { CamaraFoto, Grabadora } from './Captura';

type Panel = null | 'foto' | 'video' | 'audio';

/** C15 / E (evidencia) · Agregar evidencia a una alerta ya enviada (opcional, RF-06). */
export default function AgregarEvidenciaPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { cola, agregar, cancelar, reintentar, quitar } = useEvidencias();
  const [alerta, setAlerta] = useState<Pick<Alerta, 'id' | 'codigo' | 'estado'> | null | undefined>(undefined);
  const [panel, setPanel] = useState<Panel>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const entradaVideo = useRef<HTMLInputElement>(null);
  const entradaArchivos = useRef<HTMLInputElement>(null);
  const tactil = esTactil();

  useEffect(() => {
    supabase.from('alertas').select('id, codigo, estado').eq('id', id).maybeSingle().then(({ data }) => setAlerta(data));
  }, [id]);

  if (alerta === undefined) return <Cargando />;
  if (!alerta) {
    return <div className="contenedor"><div className="card"><h1>No encontramos esta alerta</h1><Link to="/app/alertas" className="btn btn-primario">Mis alertas</Link></div></div>;
  }

  const items = cola.filter((x) => x.alertaId === alerta.id);
  const subiendo = items.some((x) => x.estado === 'subiendo' || x.estado === 'comprimiendo');

  function agregarArchivos(lista: FileList | File[]) {
    Array.from(lista).forEach((f) => agregar(alerta!.id, f, f.name));
  }
  function alElegir(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) agregarArchivos(e.target.files);
    e.target.value = '';
  }
  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    agregarArchivos(e.dataTransfer.files);
  }
  const nombreCaptura = (tipo: string, ext: string) => `${tipo}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.${ext}`;

  const opciones: { icono: IconName; texto: string; accion: () => void }[] = [
    { icono: 'camera', texto: 'Tomar foto con la cámara', accion: () => (tactil ? entradaFoto.current?.click() : setPanel('foto')) },
    { icono: 'camera', texto: 'Grabar video', accion: () => (tactil ? entradaVideo.current?.click() : setPanel('video')) },
    { icono: 'mic', texto: 'Grabar audio', accion: () => setPanel('audio') },
    { icono: 'upload', texto: 'Subir desde el dispositivo', accion: () => entradaArchivos.current?.click() },
  ];

  return (
    <div className="contenedor agregar-evidencia">
      <div className="evidencia-principal">
        <Link to={`/app/alertas/${alerta.id}`} className="enlace"><Icon name="arrow-left" size={16} />&nbsp;Volver al estado de la alerta</Link>
        <p className="lbl">{alerta.codigo} · OPCIONAL</p>
        <h1>Agregar evidencia</h1>
        <div className="caja">
          <Icon name="info" />
          <p style={{ margin: 0 }}>Tu alerta ya fue enviada. La evidencia se sube en segundo plano y no retrasa la atención.</p>
        </div>
        {!esActiva(alerta.estado) && (
          <p className="texto-chico color-warn">Esta alerta ya está cerrada; la evidencia quedará como registro.</p>
        )}

        <div className="opciones-evidencia">
          {opciones.map((o) => (
            <button key={o.texto} type="button" className="opcion-evidencia" onClick={o.accion}>
              <Icon name={o.icono} /> <span>{o.texto}</span> <Icon name="chevron-right" className="historial-flecha" />
            </button>
          ))}
        </div>

        {panel === 'foto' && <CamaraFoto onCerrar={() => setPanel(null)} onListo={(b) => { agregar(alerta.id, b, nombreCaptura('Foto', 'jpg')); setPanel(null); }} />}
        {panel === 'video' && <Grabadora tipo="video" maxSegundos={60} onCerrar={() => setPanel(null)}
          onListo={(b) => { agregar(alerta.id, b, nombreCaptura('Video', b.type.includes('mp4') ? 'mp4' : 'webm')); setPanel(null); }} />}
        {panel === 'audio' && <Grabadora tipo="audio" maxSegundos={120} onCerrar={() => setPanel(null)}
          onListo={(b) => { agregar(alerta.id, b, nombreCaptura('Audio', b.type.includes('mp4') ? 'm4a' : 'webm')); setPanel(null); }} />}

        {!tactil && !panel && (
          <div
            className={`zona-soltar${arrastrando ? ' activa' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={alSoltar}
          >
            <Icon name="upload" size={28} />
            <strong>Arrastra aquí tus fotos, videos o audios</strong>
            <small>Máximo 50 MB por archivo · las fotos se comprimen antes de subir</small>
          </div>
        )}

        <input ref={entradaFoto} type="file" accept="image/*" capture="environment" hidden onChange={alElegir} />
        <input ref={entradaVideo} type="file" accept="video/*" capture="environment" hidden onChange={alElegir} />
        <input ref={entradaArchivos} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={alElegir} />
      </div>

      <aside className="card evidencia-cola" aria-labelledby="t-agregados">
        <h2 id="t-agregados" className="h-chico">Archivos agregados</h2>
        {items.length === 0 ? <p className="texto-chico">Aún no agregaste archivos.</p> : (
          <ul className="lista-subidas" aria-live="polite">
            {items.map((x) => <FilaSubida key={x.id} item={x} onCancelar={() => cancelar(x.id)} onReintentar={() => reintentar(x.id)} onQuitar={() => quitar(x.id)} />)}
          </ul>
        )}
        <Button className="btn-bloque" onClick={() => navigate(`/app/alertas/${alerta.id}`)}>
          {subiendo ? 'Listo (seguirá subiendo)' : 'Listo'}
        </Button>
      </aside>
    </div>
  );
}

const ICONO_TIPO: Record<ItemSubida['tipo'], IconName> = { foto: 'camera', video: 'camera', audio: 'mic' };

function FilaSubida({ item, onCancelar, onReintentar, onQuitar }: { item: ItemSubida; onCancelar: () => void; onReintentar: () => void; onQuitar: () => void }) {
  const pct = Math.round(item.progreso * 100);
  const tamano = item.tamanoFinal && item.tamanoFinal < item.tamanoOriginal
    ? `${formatoBytes(item.tamanoOriginal)} a ${formatoBytes(item.tamanoFinal)}`
    : formatoBytes(item.tamanoFinal ?? item.tamanoOriginal);
  const detalle = item.estado === 'comprimiendo' ? 'Preparando…'
    : item.estado === 'subiendo' ? `${tamano} · ${pct} %`
    : item.estado === 'listo' ? `${tamano} · subido`
    : item.estado === 'cancelado' ? 'Cancelado'
    : item.error ?? 'Error';

  return (
    <li className={`fila-subida ${item.estado}`}>
      <span className="icono-tipo" aria-hidden="true"><Icon name={ICONO_TIPO[item.tipo]} size={18} /></span>
      <span className="fila-subida-texto">
        <strong>{item.nombre}</strong>
        <small>{detalle}</small>
        {(item.estado === 'subiendo' || item.estado === 'comprimiendo') && (
          <span className="barra" role="progressbar" aria-label={`Subiendo ${item.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      {item.estado === 'subiendo' && <button type="button" className="btn-icono" onClick={onCancelar} aria-label={`Cancelar ${item.nombre}`}><Icon name="x" size={18} /></button>}
      {item.estado === 'listo' && <span className="check-circulo" aria-label="Subido"><Icon name="check" size={14} /></span>}
      {item.estado === 'error' && <button type="button" className="btn-icono" onClick={onReintentar} aria-label={`Reintentar ${item.nombre}`}><Icon name="refresh" size={18} /></button>}
      {(item.estado === 'error' || item.estado === 'cancelado') && <button type="button" className="btn-icono" onClick={onQuitar} aria-label={`Quitar ${item.nombre}`}><Icon name="trash" size={18} /></button>}
    </li>
  );
}
