// validar-dni · Paso 1 del registro (RF-16).
// Simula la consulta a RENIEC: comprueba el formato, que el DNI no tenga cuenta y,
// si está en el padrón de demostración, devuelve los nombres y valida la fecha de emisión.
// Se despliega con --no-verify-jwt: se llama antes de que exista una sesión.
import { clienteAdmin, esDni, ErrorUsuario, json, PADRON_DEMO, servir } from '../_shared/comun.ts';

servir(async (_req, { dni, fecha_emision }) => {
  if (!esDni(dni)) throw new ErrorUsuario('El DNI debe tener 8 dígitos.');
  if (typeof fecha_emision !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_emision)) {
    throw new ErrorUsuario('Ingresa la fecha de emisión que figura en tu DNI.');
  }
  if (new Date(fecha_emision) > new Date()) throw new ErrorUsuario('La fecha de emisión no puede ser futura.');

  const admin = clienteAdmin();
  const { count, error } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('dni', dni);
  if (error) throw error;
  if (count) throw new ErrorUsuario('Este DNI ya tiene una cuenta. Inicia sesión o recupera tu contraseña.', 409);

  const ciudadano = PADRON_DEMO[dni];
  if (!ciudadano) return json({ valido: true, encontrado: false });

  if (ciudadano.fecha_emision !== fecha_emision) {
    throw new ErrorUsuario('La fecha de emisión no coincide con la del DNI.');
  }
  return json({
    valido: true,
    encontrado: true,
    nombres: ciudadano.nombres,
    apellidos: ciudadano.apellidos,
    fecha_nacimiento: ciudadano.fecha_nacimiento,
  });
});
