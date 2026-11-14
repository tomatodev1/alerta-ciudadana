// ingresar-dni · Inicio de sesión con DNI (E02 / C02).
// Busca el correo de la cuenta en el servidor e inicia sesión allí, para no exponer
// el correo de nadie al navegador. Devuelve los tokens; el cliente llama a setSession.
// Se despliega con --no-verify-jwt: se llama sin sesión.
import { clienteAdmin, clientePublico, esDni, ErrorUsuario, json, servir } from '../_shared/comun.ts';

const CREDENCIALES_INVALIDAS = 'DNI o contraseña incorrectos.';

const enmascarar = (correo: string) => correo.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => a + '•'.repeat(Math.max(3, b.length)) + c);

servir(async (req, { dni, password }) => {
  if (!esDni(dni) || typeof password !== 'string' || !password) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const admin = clienteAdmin();
  const { data: perfil } = await admin.from('perfiles').select('id').eq('dni', dni).maybeSingle();
  if (!perfil) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const { data: usuario } = await admin.auth.admin.getUserById(perfil.id);
  const correo = usuario?.user?.email;
  if (!correo) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const publico = clientePublico();
  const { data, error } = await publico.auth.signInWithPassword({ email: correo, password });

  // Supabase solo responde "email_not_confirmed" si la contraseña es correcta:
  // en ese caso se reenvía el enlace de confirmación y se avisa al ciudadano.
  if (error?.code === 'email_not_confirmed') {
    const origen = req.headers.get('origin');
    await publico.auth.resend({
      type: 'signup',
      email: correo,
      ...(origen ? { options: { emailRedirectTo: `${origen}/registro` } } : {}),
    });
    throw new ErrorUsuario(`Tu correo aún no está confirmado. Te reenviamos el enlace a ${enmascarar(correo)} (revisa también spam).`, 403);
  }
  if (error || !data.session) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
