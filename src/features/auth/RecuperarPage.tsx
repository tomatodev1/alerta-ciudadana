import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Field } from '@/components/ui/Field';
import { CampoContrasena } from '@/components/ui/CampoContrasena';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Cargando } from '@/components/ui/Cargando';
import { useAuth } from '@/hooks/useAuth';
import { llegoDeRecuperacion, supabase } from '@/lib/supabase';
import { enmascararCorreo, mensajeAuth } from '@/lib/funciones';
import { rutaInicio } from '@/lib/destino';
import { validarContrasena } from '@/features/registro/validaciones';
import { LadoAcceso } from './LadoAcceso';

/** E03 / C03 · Recuperar acceso. Si se abre desde el enlace del correo, permite crear la nueva contraseña. */
export default function RecuperarPage() {
  const [modoNueva, setModoNueva] = useState(llegoDeRecuperacion);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setModoNueva(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthLayout
      lado={<LadoAcceso />}
      esquina={<>¿Recordaste tu contraseña? <Link to="/ingresar">Iniciar sesión</Link></>}
      movil={{ titulo: 'Recuperar acceso', volver: '/ingresar' }}
    >
      {modoNueva ? <NuevaContrasena onPedirOtro={() => setModoNueva(false)} /> : <PedirEnlace />}
    </AuthLayout>
  );
}

function PedirEnlace() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [enviadoA, setEnviadoA] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    const valor = correo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) { setError('Ingresa un correo electrónico válido.'); return; }
    setError('');
    setEnviando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(valor, {
      redirectTo: `${window.location.origin}/recuperar`,
    });
    setEnviando(false);
    // Por privacidad se muestra el mismo mensaje exista o no la cuenta.
    if (err && !/user|not found/i.test(err.message)) { setError(mensajeAuth(err.message)); return; }
    setEnviadoA(valor);
  }

  return (
    <>
      <span className="icono-grande"><Icon name="mail" size={28} /></span>
      <h1>¿Olvidaste tu contraseña?</h1>
      <p className="muted">Escribe el correo de tu cuenta. Te enviaremos un enlace seguro para crear una nueva contraseña.</p>
      <form onSubmit={alEnviar} noValidate>
        <Field label="Correo electrónico" type="email" icono="mail" value={correo}
          onChange={(e) => setCorreo(e.target.value)} autoComplete="email" error={error} required />
        <Button type="submit" cargando={enviando} className="btn-bloque">Enviar enlace</Button>
      </form>
      <div aria-live="polite">
        {enviadoA && (
          <div className="caja caja-ok">
            <Icon name="check-circle" />
            <div>
              <strong>Enlace enviado</strong>
              <p>Si existe una cuenta con {enmascararCorreo(enviadoA)}, recibirás el enlace en tu bandeja. Vence en 1 hora.</p>
            </div>
          </div>
        )}
      </div>
      <Link to="/ingresar" className="enlace"><Icon name="arrow-left" size={16} />&nbsp;Volver a iniciar sesión</Link>
    </>
  );
}

function NuevaContrasena({ onPedirOtro }: { onPedirOtro: () => void }) {
  const { session, perfil, cargando } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errores, setErrores] = useState<{ password?: string; repetir?: string; general?: string }>({});
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  if (cargando) return <Cargando texto="Validando el enlace…" />;
  if (!session) {
    return (
      <>
        <span className="icono-grande warn"><Icon name="alert" size={28} /></span>
        <h1>El enlace ya no es válido</h1>
        <p className="muted">Venció o ya fue usado. Pide uno nuevo para crear tu contraseña.</p>
        <Button className="btn-bloque" onClick={onPedirOtro}>Pedir otro enlace</Button>
      </>
    );
  }

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    const errPass = validarContrasena(password);
    if (errPass) nuevos.password = errPass;
    if (repetir !== password) nuevos.repetir = 'Las contraseñas no coinciden.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password });
    setGuardando(false);
    if (error) { setErrores({ general: mensajeAuth(error.message) }); return; }
    setListo(true);
  }

  if (listo) {
    return (
      <>
        <span className="icono-grande"><Icon name="check-circle" size={28} /></span>
        <h1>Contraseña actualizada</h1>
        <p className="muted">Ya puedes usar tu nueva contraseña. Tu sesión quedó iniciada en este dispositivo.</p>
        <Button className="btn-bloque" onClick={() => navigate(perfil ? rutaInicio(perfil) : '/ingresar', { replace: true })}>
          Continuar <Icon name="arrow-right" />
        </Button>
      </>
    );
  }

  return (
    <>
      <span className="icono-grande"><Icon name="lock" size={28} /></span>
      <h1>Crea una nueva contraseña</h1>
      <p className="muted">Usa al menos 8 caracteres, con letras y números.</p>
      <form onSubmit={alEnviar} noValidate>
        <CampoContrasena label="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password" error={errores.password} required />
        <CampoContrasena label="Repetir contraseña" value={repetir} onChange={(e) => setRepetir(e.target.value)}
          autoComplete="new-password" error={errores.repetir} required />
        {errores.general && <p className="alerta-form" role="alert">{errores.general}</p>}
        <Button type="submit" cargando={guardando} className="btn-bloque">Guardar contraseña</Button>
      </form>
    </>
  );
}
