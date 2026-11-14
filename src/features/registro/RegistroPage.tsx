import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Cargando } from '@/components/ui/Cargando';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import type { Perfil } from '@/types/database.types';
import { PasoDatos } from './PasoDatos';
import { PasoCelular } from './PasoCelular';
import { PasoFotoDni, type FotoDni } from './PasoFotoDni';
import { PasoSelfie } from './PasoSelfie';
import { EnRevision, Exito, Rechazo, type ResultadoVerificacion } from './Resultados';

const PASOS = [
  { titulo: 'Datos y DNI', texto: 'Validación con RENIEC' },
  { titulo: 'Código SMS', texto: 'Confirma tu celular' },
  { titulo: 'Foto del DNI', texto: 'Anverso del documento' },
  { titulo: 'Selfie', texto: 'Prueba de vida y comparación' },
];

/**
 * E04–E09 / C04–C09 · Registro con verificación de identidad (RF-16).
 * El paso se deduce del estado de la cuenta, así el ciudadano puede retomar donde lo dejó.
 */
export default function RegistroPage() {
  const { session, perfil, cargando, recargarPerfil, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [fotoDni, setFotoDni] = useState<FotoDni | null>(null);
  const [pasoLocal, setPasoLocal] = useState<3 | 4 | null>(null);
  const [resultado, setResultado] = useState<ResultadoVerificacion | null>(null);
  const [correoPendiente, setCorreoPendiente] = useState('');

  async function salir() {
    await cerrarSesion();
    navigate('/', { replace: true });
  }

  if (cargando) return <Cargando />;
  if (session && perfil && perfil.rol !== 'ciudadano') return <Navigate to="/central" replace />;
  if (session && perfil?.estado_verificacion === 'verificada' && resultado?.estado !== 'verificada') {
    return <Navigate to="/app" replace />;
  }
  if (session && !perfil) return <Cargando texto="Cargando tu perfil…" />;

  // ----- Qué mostrar -----
  let paso = 1;
  let contenido: React.ReactNode;

  if (correoPendiente) {
    contenido = <ConfirmaCorreo correo={correoPendiente} />;
  } else if (!session || !perfil) {
    contenido = <PasoDatos onConfirmacionCorreo={setCorreoPendiente} />;
  } else if (resultado?.estado === 'verificada') {
    paso = 5;
    contenido = <Exito perfil={perfil} onIrInicio={() => navigate('/app', { replace: true })} />;
  } else if (perfil.estado_verificacion === 'revision_manual') {
    paso = 5;
    contenido = <EnRevision onSalir={salir} />;
  } else if (resultado?.estado === 'rechazada' || (perfil.estado_verificacion === 'rechazada' && pasoLocal === null)) {
    paso = 4;
    contenido = (
      <Rechazo
        perfil={perfil}
        resultado={resultado}
        onReintentar={() => { setResultado(null); setFotoDni(null); setPasoLocal(3); }}
        onRevision={() => { setResultado(null); void recargarPerfil(); }}
      />
    );
  } else if (!perfil.celular_confirmado_en) {
    paso = 2;
    contenido = <PasoCelular celular={perfil.celular} onConfirmado={recargarPerfil} />;
  } else if (pasoLocal === 4 && fotoDni) {
    paso = 4;
    contenido = (
      <PasoSelfie
        usuarioId={perfil.id}
        fotoDni={fotoDni}
        onResultado={(r) => { setResultado(r); setPasoLocal(null); void recargarPerfil(); }}
      />
    );
  } else {
    paso = 3;
    contenido = <PasoFotoDni usuarioId={perfil.id} onListo={(f) => { setFotoDni(f); setPasoLocal(4); }} />;
  }

  const pasoVisible = Math.min(paso, 4);
  return (
    <AuthLayout
      amplio={paso === 1 && !correoPendiente}
      lado={<LadoRegistro paso={paso} perfil={perfil} />}
      esquina={session
        ? <button type="button" className="btn-texto" onClick={salir}>Cerrar sesión</button>
        : <>¿Ya tienes cuenta? <Link to="/ingresar">Iniciar sesión</Link></>}
      movil={{
        titulo: 'Crear cuenta',
        subtitulo: paso > 4 ? 'Verificación de identidad' : `Verificación · paso ${pasoVisible} de 4`,
        volver: paso === 4 && pasoLocal === 4 ? () => setPasoLocal(3) : '/',
      }}
      progreso={paso <= 4 ? { actual: pasoVisible, total: 4 } : undefined}
    >
      {contenido}
    </AuthLayout>
  );
}

function LadoRegistro({ paso, perfil }: { paso: number; perfil: Perfil | null }) {
  return (
    <div>
      <p className="lbl">REGISTRO · CUENTA VERIFICADA</p>
      <h1>Crea tu cuenta verificada</h1>
      <p>
        Verificamos que eres el titular del DNI para evitar suplantaciones y alertas falsas.
        Se hace una sola vez y toma unos 2 minutos.
      </p>
      <ol className="pasos">
        {PASOS.map((p, i) => {
          const n = i + 1;
          const estado = n < paso ? 'hecho' : n === paso ? 'actual' : '';
          return (
            <li key={p.titulo} className={estado} aria-current={estado === 'actual' ? 'step' : undefined}>
              <span className="num" aria-hidden="true">{estado === 'hecho' ? <Icon name="check" size={14} /> : n}</span>
              <span>
                <strong>{p.titulo}</strong>
                <small>{p.texto}</small>
                <span className="oculto-visual">{estado === 'hecho' ? '(completado)' : estado === 'actual' ? '(paso actual)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="caja nota-privacidad">
        <Icon name="lock" />
        <p style={{ margin: 0 }}>
          Tus fotos viajan cifradas, se usan solo para esta verificación y se eliminan al terminar.
          {perfil && <> Cuenta: {perfil.correo}</>}
        </p>
      </div>
    </div>
  );
}

function ConfirmaCorreo({ correo }: { correo: string }) {
  return (
    <div className="resultado centrado">
      <span className="icono-grande"><Icon name="mail" size={28} /></span>
      <h1>Confirma tu correo</h1>
      <p className="muted">
        Enviamos un enlace a <strong>{correo}</strong>. Ábrelo y luego inicia sesión para continuar con la verificación.
      </p>
      <Link to="/ingresar" className="btn btn-primario btn-bloque">Ir a iniciar sesión</Link>
    </div>
  );
}
