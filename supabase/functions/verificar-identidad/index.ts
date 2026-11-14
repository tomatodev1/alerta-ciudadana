// verificar-identidad · Pasos 3 y 4 del registro (RF-16).
// Es la ÚNICA vía para cambiar perfiles.estado_verificacion (usa service_role).
//
// accion "verificar":       recibe la distancia facial (face-api.js, calculada en el navegador),
//                           el resultado de la prueba de vida y las rutas de las fotos subidas.
// accion "revision_manual": tras un rechazo, el ciudadano pide que un operador revise sus fotos.
//
// Nota (prototipo): la comparación facial se hace en el navegador, así que la distancia la
// informa el cliente. En producción la comparación debe hacerse en el servidor (p. ej. RENIEC).
import { clienteAdmin, ErrorUsuario, json, PADRON_DEMO, servir, usuarioDeLaPeticion } from '../_shared/comun.ts';

// Distancia euclidiana entre descriptores de face-api.js. 0.6 es el valor de referencia de la
// librería; se usa 0.62 (algo tolerante) porque la foto del DNI suele salir pequeña o con reflejos.
const UMBRAL = 0.62;
const MAX_INTENTOS = 5;
const BUCKET = 'verificacion';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

servir(async (req, { accion, distancia, prueba_vida, fotos }) => {
  const admin = clienteAdmin();
  const usuario = await usuarioDeLaPeticion(req, admin);

  const { data: perfil, error } = await admin.from('perfiles').select('*').eq('id', usuario.id).single();
  if (error || !perfil) throw new ErrorUsuario('No encontramos tu perfil.', 404);
  if (perfil.rol !== 'ciudadano') throw new ErrorUsuario('Esta cuenta no requiere verificación.');

  const restantes = (intentos: number) => Math.max(0, MAX_INTENTOS - intentos);

  if (accion === 'revision_manual') {
    if (perfil.estado_verificacion !== 'rechazada') throw new ErrorUsuario('Solo puedes pedir revisión manual tras un rechazo.');
    const { error: e } = await admin.from('perfiles').update({ estado_verificacion: 'revision_manual' }).eq('id', usuario.id);
    if (e) throw e;
    return json({ estado: 'revision_manual' });
  }

  if (accion !== 'verificar') throw new ErrorUsuario('Acción no válida.');

  if (perfil.estado_verificacion === 'verificada') return json({ estado: 'verificada', intentos_restantes: 0 });
  if (perfil.estado_verificacion === 'revision_manual') throw new ErrorUsuario('Tu verificación está en revisión manual.', 409);
  if (perfil.intentos_verificacion >= MAX_INTENTOS) {
    throw new ErrorUsuario('Agotaste los intentos. Acércate a una comisaría para verificarte de forma presencial.', 429);
  }

  // Validación de datos recibidos
  if (typeof distancia !== 'number' || !Number.isFinite(distancia) || distancia < 0 || distancia > 2) {
    throw new ErrorUsuario('No recibimos una comparación facial válida.');
  }
  if (!Array.isArray(fotos) || fotos.length !== 2 || !fotos.every((f) => typeof f === 'string')) {
    throw new ErrorUsuario('Faltan las fotos de verificación.');
  }
  const prefijo = `${usuario.id}/`;
  const nombres = (fotos as string[]).map((f) => (f.startsWith(prefijo) ? f.slice(prefijo.length) : ''));
  if (!nombres.some((n) => /^dni-\d+\.jpg$/.test(n)) || !nombres.some((n) => /^selfie-\d+\.jpg$/.test(n))) {
    throw new ErrorUsuario('Las fotos no corresponden a tu cuenta.');
  }
  const { data: archivos } = await admin.storage.from(BUCKET).list(usuario.id, { limit: 100 });
  const existentes = new Set((archivos ?? []).map((a) => a.name));
  if (!nombres.every((n) => existentes.has(n))) throw new ErrorUsuario('No encontramos las fotos subidas. Vuelve a tomarlas.');

  // Comprobaciones
  const enPadron = PADRON_DEMO[perfil.dni];
  const dniValidado = !enPadron || (
    normalizar(enPadron.nombres) === normalizar(perfil.nombres) &&
    normalizar(enPadron.apellidos) === normalizar(perfil.apellidos)
  );
  const celularConfirmado = !!perfil.celular_confirmado_en;
  const vida = prueba_vida === true;
  const rostro = distancia < UMBRAL;

  const verificada = dniValidado && celularConfirmado && vida && rostro;
  const motivos = [
    !dniValidado && 'Los nombres no coinciden con el DNI',
    !celularConfirmado && 'Celular sin confirmar',
    !vida && 'Prueba de vida incompleta',
    !rostro && 'El rostro no coincide con la foto del DNI',
  ].filter(Boolean).join('; ');

  const intentos = perfil.intentos_verificacion + 1;
  const estado = verificada ? 'verificada' : 'rechazada';

  const { error: e1 } = await admin.from('verificaciones_identidad').insert({
    usuario_id: usuario.id,
    dni_validado: dniValidado,
    celular_confirmado: celularConfirmado,
    prueba_vida: vida,
    distancia_facial: Number(distancia.toFixed(4)),
    resultado: estado,
    motivo: motivos || null,
  });
  if (e1) throw e1;

  const { error: e2 } = await admin.from('perfiles').update({
    estado_verificacion: estado,
    verificado_en: verificada ? new Date().toISOString() : null,
    intentos_verificacion: intentos,
  }).eq('id', usuario.id);
  if (e2) throw e2;

  // Limpieza de fotos: si se verificó se borran todas; si no, se conservan solo las del
  // último intento (por si el ciudadano pide revisión manual).
  const borrar = [...existentes].filter((n) => verificada || !nombres.includes(n)).map((n) => prefijo + n);
  if (borrar.length) await admin.storage.from(BUCKET).remove(borrar);

  return json({
    estado,
    intentos_restantes: verificada ? 0 : restantes(intentos),
    checks: { dni: dniValidado, celular: celularConfirmado, prueba_vida: vida, rostro },
  });
});
