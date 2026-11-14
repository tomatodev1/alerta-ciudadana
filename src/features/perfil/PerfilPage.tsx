import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePreferencias } from '@/hooks/usePreferencias';
import { supabase } from '@/lib/supabase';
import { invocar, mensajeAuth, normalizarCelular } from '@/lib/funciones';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Interruptor } from '@/components/ui/Interruptor';
import { fechaLarga } from '@/features/alertas/comun';
import { mascaraCelular, mascaraDni, esCorreo } from '@/features/registro/validaciones';
import type { ContactoConfianza } from '@/types/database.types';

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const verCelular = (c: string) => c.replace(/^\+51(\d{3})(\d{3})(\d{3})$/, '+51 $1 $2 $3');

/** E (perfil) / C20 · Mi perfil: identidad verificada, contacto, contacto de confianza y accesibilidad. */
export default function PerfilPage() {
  const { perfil, session, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  if (!perfil) return null;

  const nombre = `${titulo(perfil.nombres)} ${titulo(perfil.apellidos)}`;
  const iniciales = (perfil.nombres[0] ?? '') + (perfil.apellidos[0] ?? '');

  async function salir() {
    await cerrarSesion();
    navigate('/', { replace: true });
  }

  return (
    <div className="contenedor perfil">
      <aside className="card perfil-identidad" aria-labelledby="nombre-perfil">
        <span className="avatar-grande" aria-hidden="true">{iniciales.toUpperCase()}</span>
        <h1 id="nombre-perfil" className="h-medio">{nombre}</h1>
        <p className="texto-chico">DNI {mascaraDni(perfil.dni)}</p>

        <h2 className="lbl">IDENTIDAD VERIFICADA</h2>
        <ul className="resumen">
          <ItemIdentidad ok={perfil.estado_verificacion === 'verificada'} texto="DNI validado con RENIEC" fecha={perfil.verificado_en} />
          <ItemIdentidad ok={!!perfil.celular_confirmado_en} texto="Celular confirmado por SMS" fecha={perfil.celular_confirmado_en} />
          <ItemIdentidad ok={perfil.estado_verificacion === 'verificada'} texto="Rostro coincide con el DNI" fecha={perfil.verificado_en} />
        </ul>

        <button type="button" className="btn btn-texto" onClick={salir}><Icon name="logout" /> Cerrar sesión</button>
      </aside>

      <div className="perfil-principal">
        <h2 className="h-titulo solo-escritorio">Mi perfil</h2>

        <section className="card" aria-labelledby="t-contacto">
          <h3 id="t-contacto" className="lbl">DATOS DE CONTACTO</h3>
          <EditarCorreo correoActual={session?.user.email ?? perfil.correo} />
          <EditarCelular celular={perfil.celular} confirmado={!!perfil.celular_confirmado_en} />
        </section>

        <section className="card" aria-labelledby="t-confianza">
          <h3 id="t-confianza" className="lbl">CONTACTO DE CONFIANZA</h3>
          <ContactosConfianza usuarioId={perfil.id} />
        </section>

        <section className="card" aria-labelledby="t-accesibilidad">
          <h3 id="t-accesibilidad" className="lbl">PREFERENCIAS DE ACCESIBILIDAD</h3>
          <Accesibilidad />
        </section>
      </div>
    </div>
  );
}

function ItemIdentidad({ ok, texto, fecha }: { ok: boolean; texto: string; fecha: string | null }) {
  return (
    <li>
      <span className={`check-circulo${ok ? '' : ' no'}`} aria-hidden="true"><Icon name={ok ? 'check' : 'alert'} size={14} /></span>
      <span>{texto}<span className="oculto-visual">{ok ? ': sí' : ': pendiente'}</span></span>
      <small>{ok && fecha ? fechaLarga(fecha) : 'Pendiente'}</small>
    </li>
  );
}

/** Fila con etiqueta, valor y botón de editar; al editar muestra el formulario. */
function FilaEditable({ icono, etiqueta, valor, extra, editando, onEditar, children }: {
  icono: IconName; etiqueta: string; valor: string; extra?: ReactNode; editando: boolean; onEditar: () => void; children: ReactNode;
}) {
  if (editando) return <div className="fila-edicion">{children}</div>;
  return (
    <div className="fila-dato">
      <Icon name={icono} />
      <div>
        <small>{etiqueta}</small>
        <strong>{valor}</strong>
        {extra}
      </div>
      <button type="button" className="btn-icono" onClick={onEditar} aria-label={`Editar ${etiqueta.toLowerCase()}`}>
        <Icon name="pencil" size={18} />
      </button>
    </div>
  );
}

function EditarCorreo({ correoActual }: { correoActual: string }) {
  const { recargarPerfil, perfil } = useAuth();
  const [editando, setEditando] = useState(false);
  const [correo, setCorreo] = useState(correoActual);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const nuevo = correo.trim().toLowerCase();
    if (!esCorreo(nuevo)) { setError('Ingresa un correo electrónico válido.'); return; }
    if (nuevo === correoActual) { setEditando(false); return; }
    setGuardando(true);
    setError('');
    const { data, error: err } = await supabase.auth.updateUser({ email: nuevo }, { emailRedirectTo: `${window.location.origin}/app/perfil` });
    if (err) { setGuardando(false); setError(mensajeAuth(err.message)); return; }
    if (data.user.email === nuevo && perfil) {
      // Cambio inmediato (sin confirmación por correo): se copia al perfil.
      await supabase.from('perfiles').update({ correo: nuevo }).eq('id', perfil.id);
      await recargarPerfil();
      setAviso('Correo actualizado.');
    } else {
      setAviso(`Te enviamos un enlace de confirmación a ${nuevo}. El cambio se aplica al abrirlo.`);
    }
    setGuardando(false);
    setEditando(false);
  }

  return (
    <>
      <FilaEditable icono="mail" etiqueta="Correo" valor={correoActual} editando={editando}
        onEditar={() => { setCorreo(correoActual); setEditando(true); setAviso(''); }}>
        <form onSubmit={guardar} noValidate className="form-edicion">
          <Field label="Nuevo correo" type="email" icono="mail" value={correo} onChange={(e) => setCorreo(e.target.value)}
            error={error} autoComplete="email" autoFocus />
          <div className="acciones-fila">
            <Button type="submit" cargando={guardando}>Guardar</Button>
            <Button type="button" variante="contorno" onClick={() => { setEditando(false); setError(''); }}>Cancelar</Button>
          </div>
        </form>
      </FilaEditable>
      {aviso && <p className="texto-chico" role="status">{aviso}</p>}
    </>
  );
}

function EditarCelular({ celular, confirmado }: { celular: string; confirmado: boolean }) {
  const { recargarPerfil } = useAuth();
  const [fase, setFase] = useState<'ver' | 'numero' | 'codigo'>('ver');
  const [numero, setNumero] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoDemo, setCodigoDemo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviarCodigo(e?: FormEvent) {
    e?.preventDefault();
    const cel = fase === 'numero' ? normalizarCelular(numero) : celular;
    if (!cel) { setError('Ingresa un celular de 9 dígitos que empiece con 9.'); return; }
    setCargando(true);
    setError('');
    try {
      const r = await invocar<{ confirmado?: boolean; codigo_demo?: string }>('confirmar-celular', { accion: 'enviar', celular: cel });
      await recargarPerfil();
      if (r.confirmado) { setFase('ver'); return; }
      setCodigoDemo(r.codigo_demo ?? '');
      setCodigo('');
      setFase('codigo');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) { setError('El código tiene 6 dígitos.'); return; }
    setCargando(true);
    setError('');
    try {
      await invocar('confirmar-celular', { accion: 'verificar', codigo });
      await recargarPerfil();
      setFase('ver');
      setAviso('Celular confirmado.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  const cancelar = () => { setFase('ver'); setError(''); };

  return (
    <>
      <FilaEditable icono="phone" etiqueta="Celular" valor={verCelular(celular)} editando={fase !== 'ver'}
        extra={!confirmado && (
          <button type="button" className="enlace" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => { setFase('codigo'); void enviarCodigo(); }}>
            Sin confirmar · confirmar ahora
          </button>
        )}
        onEditar={() => { setNumero(''); setFase('numero'); setAviso(''); }}>
        {fase === 'numero' ? (
          <form onSubmit={enviarCodigo} noValidate className="form-edicion">
            <Field label="Nuevo celular" type="tel" icono="phone" inputMode="tel" placeholder="9XX XXX XXX" value={numero}
              onChange={(e) => setNumero(e.target.value)} error={error} autoFocus
              ayuda="Te enviaremos un código para confirmarlo. La Policía usará este número para contactarte." />
            <div className="acciones-fila">
              <Button type="submit" cargando={cargando}>Enviar código</Button>
              <Button type="button" variante="contorno" onClick={cancelar}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={verificar} noValidate className="form-edicion">
            <p className="texto-chico">Ingresa el código de 6 dígitos que enviamos al {mascaraCelular(celular)}.</p>
            {codigoDemo && (
              <p className="caja caja-demo" role="note"><Icon name="info" /> <span>SMS simulado: tu código es <span className="codigo-demo">{codigoDemo}</span></span></p>
            )}
            <Field label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} error={error} autoFocus />
            <div className="acciones-fila">
              <Button type="submit" cargando={cargando}>Verificar</Button>
              <Button type="button" variante="contorno" onClick={cancelar}>Cancelar</Button>
            </div>
          </form>
        )}
      </FilaEditable>
      {aviso && <p className="texto-chico" role="status">{aviso}</p>}
    </>
  );
}

function ContactosConfianza({ usuarioId }: { usuarioId: string }) {
  const [contactos, setContactos] = useState<ContactoConfianza[] | null>(null);
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<number | null>(null);

  const cargar = () => supabase.from('contactos_confianza').select('*').eq('usuario_id', usuarioId).order('creado_en')
    .then(({ data }) => setContactos(data ?? []));
  useEffect(() => { void cargar(); }, [usuarioId]);

  async function borrar(id: number) {
    await supabase.from('contactos_confianza').delete().eq('id', id);
    setBorrando(null);
    void cargar();
  }

  if (!contactos) return <p className="texto-chico"><span className="spinner spinner-sm" /> Cargando…</p>;

  return (
    <>
      {contactos.length === 0 && editando !== 'nuevo' && (
        <p className="texto-chico">Agrega a alguien a quien la Policía pueda llamar si no te contesta.</p>
      )}
      {contactos.map((c) => editando === c.id ? (
        <FormContacto key={c.id} usuarioId={usuarioId} contacto={c} onListo={() => { setEditando(null); void cargar(); }} onCancelar={() => setEditando(null)} />
      ) : (
        <div key={c.id} className="fila-dato">
          <Icon name="user" />
          <div>
            <small>{c.parentesco ?? 'Contacto'}</small>
            <strong>{c.nombre} · {c.telefono}</strong>
          </div>
          {borrando === c.id ? (
            <span className="acciones-fila confirmar-borrar">
              <Button variante="contorno" className="btn-chico" onClick={() => void borrar(c.id)}>Eliminar</Button>
              <Button variante="texto" className="btn-chico" onClick={() => setBorrando(null)}>No</Button>
            </span>
          ) : (
            <span className="acciones-dato">
              <button type="button" className="btn-icono" onClick={() => setEditando(c.id)} aria-label={`Editar contacto ${c.nombre}`}><Icon name="pencil" size={18} /></button>
              <button type="button" className="btn-icono" onClick={() => setBorrando(c.id)} aria-label={`Eliminar contacto ${c.nombre}`}><Icon name="trash" size={18} /></button>
            </span>
          )}
        </div>
      ))}
      {editando === 'nuevo' ? (
        <FormContacto usuarioId={usuarioId} onListo={() => { setEditando(null); void cargar(); }} onCancelar={() => setEditando(null)} />
      ) : contactos.length < 3 && (
        <button type="button" className="btn btn-contorno btn-chico" onClick={() => setEditando('nuevo')}>
          <Icon name="plus" size={18} /> Agregar contacto
        </button>
      )}
    </>
  );
}

function FormContacto({ usuarioId, contacto, onListo, onCancelar }: {
  usuarioId: string; contacto?: ContactoConfianza; onListo: () => void; onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(contacto?.nombre ?? '');
  const [parentesco, setParentesco] = useState(contacto?.parentesco ?? '');
  const [telefono, setTelefono] = useState(contacto?.telefono ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string; general?: string }>({});
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const n: typeof errores = {};
    if (nombre.trim().length < 2) n.nombre = 'Escribe el nombre del contacto.';
    const tel = telefono.replace(/[^\d+]/g, '');
    if (!/^(\+?51)?9\d{8}$|^0?1\d{7}$/.test(tel)) n.telefono = 'Ingresa un celular (9 dígitos) o un teléfono fijo de Lima.';
    setErrores(n);
    if (Object.keys(n).length) return;
    setGuardando(true);
    const datos = { usuario_id: usuarioId, nombre: nombre.trim(), parentesco: parentesco.trim() || null, telefono: telefono.trim() };
    const { error } = contacto
      ? await supabase.from('contactos_confianza').update(datos).eq('id', contacto.id)
      : await supabase.from('contactos_confianza').insert(datos);
    setGuardando(false);
    if (error) { setErrores({ general: 'No se pudo guardar. Inténtalo de nuevo.' }); return; }
    onListo();
  }

  return (
    <form onSubmit={guardar} noValidate className="form-edicion">
      <div className="grilla-2">
        <Field label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoFocus />
        <Field label="Parentesco (opcional)" value={parentesco} onChange={(e) => setParentesco(e.target.value)} placeholder="Madre, hermano, vecina…" />
      </div>
      <Field label="Teléfono" type="tel" icono="phone" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} error={errores.telefono} />
      {errores.general && <p className="alerta-form" role="alert">{errores.general}</p>}
      <div className="acciones-fila">
        <Button type="submit" cargando={guardando}>Guardar</Button>
        <Button type="button" variante="contorno" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  );
}

function Accesibilidad() {
  const { prefs, cambiar } = usePreferencias();
  return (
    <>
      <Interruptor icono="mic" etiqueta='Comando de voz "Emergencia policial"' descripcion="Activa el SOS con tu voz (disponible en la próxima versión)"
        activo={prefs.comando_voz} onCambiar={(v) => void cambiar({ comando_voz: v })} />
      <Interruptor icono="type" etiqueta="Texto grande" descripcion="Aumenta el tamaño de letra del sistema"
        activo={prefs.texto_grande} onCambiar={(v) => void cambiar({ texto_grande: v })} />
    </>
  );
}
