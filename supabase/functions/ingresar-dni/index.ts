// ingresar-dni · Inicio de sesión con DNI (E02 / C02).
// Busca el correo de la cuenta en el servidor e inicia sesión allí, para no exponer
// el correo de nadie al navegador. Devuelve los tokens; el cliente llama a setSession.
// Se despliega con --no-verify-jwt: se llama sin sesión.
import { clienteAdmin, clientePublico, esDni, ErrorUsuario, json, servir } from '../_shared/comun.ts';

const CREDENCIALES_INVALIDAS = 'DNI o contraseña incorrectos.';

servir(async (_req, { dni, password }) => {
  if (!esDni(dni) || typeof password !== 'string' || !password) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const admin = clienteAdmin();
  const { data: perfil } = await admin.from('perfiles').select('id').eq('dni', dni).maybeSingle();
  if (!perfil) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const { data: usuario } = await admin.auth.admin.getUserById(perfil.id);
  const correo = usuario?.user?.email;
  if (!correo) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  const { data, error } = await clientePublico().auth.signInWithPassword({ email: correo, password });
  if (error || !data.session) throw new ErrorUsuario(CREDENCIALES_INVALIDAS, 401);

  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
