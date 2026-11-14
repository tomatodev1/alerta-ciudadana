import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/Field';
import { CampoContrasena } from '@/components/ui/CampoContrasena';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { supabase } from '@/lib/supabase';
import { invocar, mensajeAuth, normalizarCelular } from '@/lib/funciones';
import { esCorreo, formatearFecha, validarContrasena } from './validaciones';

interface RespuestaDni {
  valido: true;
  encontrado: boolean;
  nombres?: string;
  apellidos?: string;
  fecha_nacimiento?: string;
}

type EstadoDni =
  | { tipo: 'vacio' }
  | { tipo: 'validando' }
  | { tipo: 'ok'; datos: RespuestaDni; clave: string }
  | { tipo: 'error'; mensaje: string; clave: string };

type Errores = Partial<Record<'dni' | 'emision' | 'nombres' | 'apellidos' | 'correo' | 'celular' | 'password' | 'repetir' | 'acepto' | 'general', string>>;

/** Paso 1 de 4 · Tus datos y tu DNI (E04 / C04). Crea la cuenta con signUp. */
export function PasoDatos({ onConfirmacionCorreo }: { onConfirmacionCorreo: (correo: string) => void }) {
  const [dni, setDni] = useState('');
  const [emision, setEmision] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [estadoDni, setEstadoDni] = useState<EstadoDni>({ tipo: 'vacio' });
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const ultimaClave = useRef('');

  const clave = `${dni}|${emision}`;
  const listoParaValidar = /^\d{8}$/.test(dni) && /^\d{4}-\d{2}-\d{2}$/.test(emision);

  /** Devuelve los datos del DNI o un mensaje de error. */
  async function validarDni(): Promise<RespuestaDni | string> {
    if (!listoParaValidar) return 'Completa el DNI y su fecha de emisión.';
    if (estadoDni.tipo === 'ok' && estadoDni.clave === clave) return estadoDni.datos;
    ultimaClave.current = clave;
    setEstadoDni({ tipo: 'validando' });
    try {
      const datos = await invocar<RespuestaDni>('validar-dni', { dni, fecha_emision: emision });
      if (ultimaClave.current === clave) setEstadoDni({ tipo: 'ok', datos, clave });
      return datos;
    } catch (e) {
      const mensaje = (e as Error).message;
      if (ultimaClave.current === clave) setEstadoDni({ tipo: 'error', mensaje, clave });
      return mensaje;
    }
  }

  // Valida automáticamente cuando el DNI y la fecha están completos (con una pequeña espera).
  useEffect(() => {
    if (!listoParaValidar) { setEstadoDni({ tipo: 'vacio' }); return; }
    const t = setTimeout(() => { void validarDni(); }, 400);
    return () => clearTimeout(t);
  }, [clave]);

  const datosDni = estadoDni.tipo === 'ok' ? estadoDni.datos : null;
  const escribeNombres = datosDni?.encontrado === false;

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    const n: Errores = {};
    if (!/^\d{8}$/.test(dni)) n.dni = 'El DNI tiene 8 dígitos.';
    if (!emision) n.emision = 'Ingresa la fecha de emisión que figura en tu DNI.';
    if (!esCorreo(correo)) n.correo = 'Ingresa un correo electrónico válido.';
    const cel = normalizarCelular(celular);
    if (!cel) n.celular = 'Ingresa un celular de 9 dígitos que empiece con 9.';
    const errPass = validarContrasena(password);
    if (errPass) n.password = errPass;
    if (repetir !== password) n.repetir = 'Las contraseñas no coinciden.';
    if (!acepto) n.acepto = 'Debes aceptar para continuar.';

    let datos: RespuestaDni | null = null;
    if (!n.dni && !n.emision) {
      const r = await validarDni();
      if (typeof r === 'string') n.dni = r; else datos = r;
    }
    if (datos && !datos.encontrado) {
      if (nombres.trim().length < 2) n.nombres = 'Escribe tus nombres como figuran en tu DNI.';
      if (apellidos.trim().length < 2) n.apellidos = 'Escribe tus apellidos como figuran en tu DNI.';
    }
    setErrores(n);
    if (Object.keys(n).length || !datos || !cel) return;

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: correo.trim().toLowerCase(),
      password,
      options: {
        // Si "Confirm email" está activo, el enlace del correo trae de vuelta al registro (paso 2).
        emailRedirectTo: `${window.location.origin}/registro`,
        data: {
          dni,
          nombres: (datos.nombres ?? nombres).trim().toUpperCase(),
          apellidos: (datos.apellidos ?? apellidos).trim().toUpperCase(),
          fecha_nacimiento: datos.fecha_nacimiento ?? '',
          celular: cel,
        },
      },
    });
    setEnviando(false);
    if (error) { setErrores({ general: mensajeAuth(error.message) }); return; }
    // Con "Confirm email" desactivado hay sesión inmediata y RegistroPage pasa al paso 2.
    if (!data.session) onConfirmacionCorreo(correo.trim().toLowerCase());
  }

  return (
    <>
      <p className="lbl solo-escritorio">PASO 1 DE 4</p>
      <h1>Tus datos y tu DNI</h1>
      <p className="muted">
        Ingresa tu DNI y su fecha de emisión. Consultamos tus nombres en RENIEC para que no tengas que escribirlos.
      </p>

      <form onSubmit={alEnviar} noValidate>
        <div className="grilla-2">
          <Field
            label="Número de DNI"
            icono="id"
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={(e) => { setDni(e.target.value.replace(/\D/g, '').slice(0, 8)); setErrores((x) => ({ ...x, dni: undefined })); }}
            error={errores.dni ?? (estadoDni.tipo === 'error' && estadoDni.clave === clave ? estadoDni.mensaje : undefined)}
            accion={
              estadoDni.tipo === 'validando' ? <span className="valido-icono"><span className="spinner spinner-sm" /></span>
              : datosDni ? <span className="valido-icono" title="DNI válido"><Icon name="check" /></span> : null
            }
            autoComplete="off"
            required
          />
          <Field
            label="Fecha de emisión del DNI"
            icono="calendar"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={emision}
            onChange={(e) => { setEmision(e.target.value); setErrores((x) => ({ ...x, dni: undefined, emision: undefined })); }}
            error={errores.emision}
            required
          />
        </div>

        <div aria-live="polite">
          {estadoDni.tipo === 'validando' && <p className="texto-chico">Consultando el DNI…</p>}
          {datosDni?.encontrado && (
            <div className="caja caja-ok">
              <Icon name="check-circle" />
              <div>
                <strong>DNI válido · datos obtenidos de RENIEC</strong>
                <p>Nombres: <b>{datosDni.nombres} {datosDni.apellidos}</b>
                  {datosDni.fecha_nacimiento && <> · Fecha de nacimiento: {formatearFecha(datosDni.fecha_nacimiento)}</>}</p>
              </div>
            </div>
          )}
          {escribeNombres && (
            <div className="caja caja-demo">
              <Icon name="info" />
              <div>
                <strong>DNI con formato válido</strong>
                <p>No está en el padrón de demostración: escribe tus nombres tal como figuran en tu DNI.</p>
              </div>
            </div>
          )}
        </div>

        {escribeNombres && (
          <div className="grilla-2">
            <Field label="Nombres" value={nombres} onChange={(e) => setNombres(e.target.value)}
              autoComplete="given-name" error={errores.nombres} required />
            <Field label="Apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)}
              autoComplete="family-name" error={errores.apellidos} required />
          </div>
        )}

        <div className="grilla-2">
          <Field label="Correo electrónico" type="email" icono="mail" value={correo}
            onChange={(e) => setCorreo(e.target.value)} autoComplete="email" error={errores.correo} required />
          <Field label="Celular" type="tel" icono="phone" inputMode="tel" placeholder="9XX XXX XXX" value={celular}
            onChange={(e) => setCelular(e.target.value)} autoComplete="tel-national" error={errores.celular} required />
        </div>
        <div className="grilla-2">
          <CampoContrasena label="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" error={errores.password} ayuda="Mínimo 8 caracteres, con letras y números." required />
          <CampoContrasena label="Repetir contraseña" value={repetir} onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password" error={errores.repetir} required />
        </div>

        <div>
          <label className="casilla">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)}
              aria-invalid={!!errores.acepto} aria-describedby={errores.acepto ? 'acepto-error' : undefined} />
            <span>
              Acepto la verificación biométrica de mi identidad y el tratamiento de mis datos personales
              conforme a la Ley N.° 29733.
            </span>
          </label>
          {errores.acepto && <p id="acepto-error" className="field-msg error" role="alert">{errores.acepto}</p>}
        </div>

        {errores.general && <p className="alerta-form" role="alert">{errores.general}</p>}

        <Button type="submit" cargando={enviando} className="btn-bloque">
          Continuar <Icon name="arrow-right" />
        </Button>
      </form>
    </>
  );
}
