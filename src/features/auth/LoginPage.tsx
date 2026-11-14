import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout, AvisoEmergencia } from '@/components/layout/AuthLayout';
import { Field } from '@/components/ui/Field';
import { CampoContrasena } from '@/components/ui/CampoContrasena';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ReenviarConfirmacion } from '@/components/ui/ReenviarConfirmacion';
import { useAuth } from '@/hooks/useAuth';
import { setRecordarSesion, supabase } from '@/lib/supabase';
import { invocar, mensajeAuth } from '@/lib/funciones';
import { rutaInicio } from '@/lib/destino';
import { LadoAcceso } from './LadoAcceso';

/** E02 / C01 · Iniciar sesión con DNI o correo. */
export default function LoginPage() {
  const { session, perfil, cargando } = useAuth();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [recordar, setRecordar] = useState(true);
  const [errores, setErrores] = useState<{ usuario?: string; password?: string; general?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [sinConfirmar, setSinConfirmar] = useState('');   // correo pendiente de confirmar

  // Con sesión y perfil cargado, cada rol va a su pantalla.
  if (!cargando && session && perfil) return <Navigate to={rutaInicio(perfil, desde)} replace />;

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    const valor = usuario.trim();
    const esCorreo = valor.includes('@');
    setSinConfirmar('');
    const nuevos: typeof errores = {};
    if (!valor) nuevos.usuario = 'Ingresa tu DNI o tu correo electrónico.';
    else if (!esCorreo && !/^\d{8}$/.test(valor)) nuevos.usuario = 'El DNI tiene 8 dígitos. Si usas correo, revisa que tenga @.';
    if (!password) nuevos.password = 'Ingresa tu contraseña.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    setRecordarSesion(recordar);
    try {
      let userId: string;
      if (esCorreo) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: valor, password });
        if (error?.code === 'email_not_confirmed' || /not confirmed/i.test(error?.message ?? '')) {
          setSinConfirmar(valor.toLowerCase());
          throw new Error('Tu correo aún no está confirmado. Abre el enlace que te enviamos o pide uno nuevo.');
        }
        if (error) throw new Error(mensajeAuth(error.message));
        userId = data.user.id;
      } else {
        const tokens = await invocar<{ access_token: string; refresh_token: string }>('ingresar-dni', { dni: valor, password });
        const { data, error } = await supabase.auth.setSession(tokens);
        if (error || !data.user) throw new Error('No pudimos iniciar la sesión. Inténtalo de nuevo.');
        userId = data.user.id;
      }
      // Cuentas sin perfil (p. ej. creadas a mano en el panel) no pueden usar el sistema.
      const { data: p } = await supabase.from('perfiles').select('id').eq('id', userId).maybeSingle();
      if (!p) {
        await supabase.auth.signOut();
        throw new Error('Tu cuenta no tiene un perfil asociado. Comunícate con el administrador.');
      }
      // La redirección la hace el <Navigate> de arriba cuando useAuth carga el perfil.
    } catch (err) {
      setErrores({ general: (err as Error).message });
      setEnviando(false);
    }
  }

  return (
    <AuthLayout
      lado={<LadoAcceso />}
      esquina={<>¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link></>}
    >
      <p className="lbl solo-escritorio">INICIAR SESIÓN</p>
      <h1><span className="solo-escritorio">Bienvenido de nuevo</span><span className="solo-movil">Bienvenido</span></h1>
      <p className="muted">Tu sesión queda activa en este dispositivo para pedir ayuda sin demoras.</p>

      <form onSubmit={alEnviar} noValidate>
        <Field
          label="DNI o correo electrónico"
          icono="id"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errores.usuario}
          required
        />
        <CampoContrasena
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={errores.password}
          required
        />
        <div className="fila-entre">
          <label className="casilla">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            Mantener sesión iniciada
          </label>
          <Link to="/recuperar" className="enlace">¿Olvidaste tu contraseña?</Link>
        </div>

        {errores.general && <p className="alerta-form" role="alert">{errores.general}</p>}
        {sinConfirmar && <ReenviarConfirmacion correo={sinConfirmar} />}

        <Button type="submit" cargando={enviando} className="btn-bloque">Ingresar</Button>
      </form>

      <p className="separador">¿No tienes cuenta?</p>
      <Link to="/registro" className="btn btn-contorno btn-bloque">
        <Icon name="user-plus" /> Crear cuenta verificada
      </Link>
      <AvisoEmergencia />
    </AuthLayout>
  );
}
