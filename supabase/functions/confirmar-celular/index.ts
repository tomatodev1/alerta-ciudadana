// confirmar-celular · Paso 2 del registro (RF-16).
// accion "enviar":    genera un código de 6 dígitos (opcionalmente cambia el número antes).
// accion "verificar": comprueba el código y marca perfiles.celular_confirmado_en.
// SMS simulado: mientras SMS_MODO no sea "real", el código se devuelve en la respuesta
// para mostrarlo en pantalla. El código se guarda solo como hash.
import { clienteAdmin, ErrorUsuario, json, servir, sha256, usuarioDeLaPeticion } from '../_shared/comun.ts';

const VIGENCIA_MIN = 10;
const ESPERA_REENVIO_S = 60;
const MAX_INTENTOS = 5;
const MODO_DEMO = Deno.env.get('SMS_MODO') !== 'real';

const enmascarar = (cel: string) => cel.replace(/^\+51(\d{3})\d{3}(\d{3})$/, '+51 $1 ••• $2');

servir(async (req, { accion, celular, codigo }) => {
  const admin = clienteAdmin();
  const usuario = await usuarioDeLaPeticion(req, admin);

  const { data: perfil, error } = await admin.from('perfiles')
    .select('celular, celular_confirmado_en').eq('id', usuario.id).single();
  if (error || !perfil) throw new ErrorUsuario('No encontramos tu perfil.', 404);

  if (accion === 'enviar') {
    let numero: string = perfil.celular;

    if (celular !== undefined && celular !== perfil.celular) {
      if (typeof celular !== 'string' || !/^\+519\d{8}$/.test(celular)) {
        throw new ErrorUsuario('Ingresa un celular válido de 9 dígitos que empiece con 9.');
      }
      // El trigger reinicia celular_confirmado_en al cambiar el número.
      const { error: e } = await admin.from('perfiles').update({ celular }).eq('id', usuario.id);
      if (e) throw e;
      numero = celular;
    } else if (perfil.celular_confirmado_en) {
      return json({ confirmado: true });
    }

    const { data: previo } = await admin.from('codigos_celular').select('enviado_en, celular').eq('usuario_id', usuario.id).maybeSingle();
    if (previo && previo.celular === numero) {
      const pasados = (Date.now() - new Date(previo.enviado_en).getTime()) / 1000;
      if (pasados < ESPERA_REENVIO_S) {
        throw new ErrorUsuario(`Espera ${Math.ceil(ESPERA_REENVIO_S - pasados)} s para pedir otro código.`, 429);
      }
    }

    const nuevo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const { error: e2 } = await admin.from('codigos_celular').upsert({
      usuario_id: usuario.id,
      celular: numero,
      codigo_hash: await sha256(`${usuario.id}:${nuevo}`),
      expira_en: new Date(Date.now() + VIGENCIA_MIN * 60_000).toISOString(),
      intentos: 0,
      enviado_en: new Date().toISOString(),
    });
    if (e2) throw e2;

    // Aquí iría el envío real del SMS (p. ej. Twilio) cuando SMS_MODO = "real".
    return json({
      enviado: true,
      celular_mascara: enmascarar(numero),
      espera_s: ESPERA_REENVIO_S,
      ...(MODO_DEMO ? { codigo_demo: nuevo } : {}),
    });
  }

  if (accion === 'verificar') {
    if (perfil.celular_confirmado_en) return json({ confirmado: true });
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) throw new ErrorUsuario('El código tiene 6 dígitos.');

    const { data: fila } = await admin.from('codigos_celular').select('*').eq('usuario_id', usuario.id).maybeSingle();
    if (!fila || fila.celular !== perfil.celular) throw new ErrorUsuario('Pide un código nuevo.');
    if (new Date(fila.expira_en) < new Date()) throw new ErrorUsuario('El código venció. Pide uno nuevo.');
    if (fila.intentos >= MAX_INTENTOS) throw new ErrorUsuario('Demasiados intentos. Pide un código nuevo.', 429);

    if (fila.codigo_hash !== await sha256(`${usuario.id}:${codigo}`)) {
      const intentos = fila.intentos + 1;
      await admin.from('codigos_celular').update({ intentos }).eq('usuario_id', usuario.id);
      const quedan = MAX_INTENTOS - intentos;
      throw new ErrorUsuario(quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intentos.` : 'Demasiados intentos. Pide un código nuevo.');
    }

    const { error: e3 } = await admin.from('perfiles')
      .update({ celular_confirmado_en: new Date().toISOString() }).eq('id', usuario.id);
    if (e3) throw e3;
    await admin.from('codigos_celular').delete().eq('usuario_id', usuario.id);
    return json({ confirmado: true });
  }

  throw new ErrorUsuario('Acción no válida.');
});
