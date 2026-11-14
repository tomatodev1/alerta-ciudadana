import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { invocar, normalizarCelular } from '@/lib/funciones';
import { mascaraCelular } from './validaciones';

interface RespuestaEnvio { enviado?: true; confirmado?: true; celular_mascara?: string; espera_s?: number; codigo_demo?: string }

/** Paso 2 de 4 · Confirma tu celular (E05 / C05). */
export function PasoCelular({ celular, onConfirmado }: { celular: string; onConfirmado: () => Promise<void> }) {
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(''));
  const [espera, setEspera] = useState(0);
  const [mascara, setMascara] = useState(mascaraCelular(celular));
  const [codigoDemo, setCodigoDemo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [errorNumero, setErrorNumero] = useState('');
  const cajas = useRef<(HTMLInputElement | null)[]>([]);
  const pedidoInicial = useRef(false);

  async function enviar(numero?: string) {
    setEnviando(true);
    setError('');
    setAviso('');
    try {
      const r = await invocar<RespuestaEnvio>('confirmar-celular', { accion: 'enviar', ...(numero ? { celular: numero } : {}) });
      if (r.confirmado) { await onConfirmado(); return; }
      if (r.celular_mascara) setMascara(r.celular_mascara);
      setEspera(r.espera_s ?? 60);
      setCodigoDemo(r.codigo_demo ?? '');
      setDigitos(Array(6).fill(''));
      setCambiando(false);
      setAviso(numero ? 'Enviamos el código a tu nuevo número.' : 'Código enviado.');
      cajas.current[0]?.focus();
    } catch (e) {
      const msg = (e as Error).message;
      // Si ya se envió hace poco (p. ej. al recargar), solo se informa la espera.
      const m = msg.match(/Espera (\d+) s/);
      if (m) setEspera(Number(m[1])); else setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  // Envía el primer código al llegar al paso.
  useEffect(() => {
    if (pedidoInicial.current) return;
    pedidoInicial.current = true;
    void enviar();
  }, []);

  // Cuenta regresiva para pedir otro código.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function verificar(codigo: string) {
    setVerificando(true);
    setError('');
    try {
      await invocar('confirmar-celular', { accion: 'verificar', codigo });
      await onConfirmado();
    } catch (e) {
      setError((e as Error).message);
      setDigitos(Array(6).fill(''));
      cajas.current[0]?.focus();
    } finally {
      setVerificando(false);
    }
  }

  function escribir(i: number, valor: string) {
    const v = valor.replace(/\D/g, '');
    if (v.length > 1) { pegar(v, i); return; }
    const nuevos = [...digitos];
    nuevos[i] = v;
    setDigitos(nuevos);
    if (v && i < 5) cajas.current[i + 1]?.focus();
    if (nuevos.every(Boolean)) void verificar(nuevos.join(''));
  }

  function pegar(texto: string, desde = 0) {
    const v = texto.replace(/\D/g, '').slice(0, 6 - desde).split('');
    const nuevos = [...digitos];
    v.forEach((d, k) => { nuevos[desde + k] = d; });
    setDigitos(nuevos);
    cajas.current[Math.min(desde + v.length, 5)]?.focus();
    if (nuevos.every(Boolean)) void verificar(nuevos.join(''));
  }

  function tecla(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digitos[i] && i > 0) cajas.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) cajas.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) cajas.current[i + 1]?.focus();
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (!digitos.every(Boolean)) { setError('Ingresa los 6 dígitos del código.'); return; }
    void verificar(digitos.join(''));
  }

  function cambiarNumero(e: FormEvent) {
    e.preventDefault();
    const cel = normalizarCelular(nuevoNumero);
    if (!cel) { setErrorNumero('Ingresa un celular de 9 dígitos que empiece con 9.'); return; }
    setErrorNumero('');
    void enviar(cel);
  }

  const mmss = `${Math.floor(espera / 60)}:${String(espera % 60).padStart(2, '0')}`;

  if (cambiando) {
    return (
      <>
        <span className="icono-grande"><Icon name="smartphone" size={28} /></span>
        <h1>Cambiar número</h1>
        <p className="muted">Te enviaremos un código nuevo al número que ingreses.</p>
        <form onSubmit={cambiarNumero} noValidate>
          <Field label="Nuevo celular" type="tel" icono="phone" inputMode="tel" placeholder="9XX XXX XXX"
            value={nuevoNumero} onChange={(e) => setNuevoNumero(e.target.value)} error={errorNumero || error} autoFocus />
          <Button type="submit" cargando={enviando} className="btn-bloque">Enviar código</Button>
          <Button type="button" variante="texto" onClick={() => { setCambiando(false); setError(''); }}>Cancelar</Button>
        </form>
      </>
    );
  }

  return (
    <>
      <span className="icono-grande solo-escritorio"><Icon name="smartphone" size={28} /></span>
      <p className="lbl solo-escritorio">PASO 2 DE 4</p>
      <h1>Confirma tu celular</h1>
      <p className="muted">
        Enviamos un código de 6 dígitos por SMS al <strong style={{ color: 'var(--text)' }}>{mascara}</strong>.
        Así comprobamos que el número es tuyo y que la Policía podrá contactarte.
      </p>

      {codigoDemo && (
        <div className="caja caja-demo" role="note">
          <Icon name="info" />
          <div>
            <strong>Modo demostración: el SMS es simulado</strong>
            <p>Tu código es <span className="codigo-demo">{codigoDemo}</span></p>
          </div>
        </div>
      )}

      <form onSubmit={alEnviar} noValidate>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="oculto-visual">Código de verificación de 6 dígitos</legend>
          <div className={`otp${error ? ' otp-error' : ''}`} onPaste={(e: ClipboardEvent) => { e.preventDefault(); pegar(e.clipboardData.getData('text')); }}>
            {digitos.map((d, i) => (
              <input
                key={i}
                ref={(el) => { cajas.current[i] = el; }}
                value={d}
                onChange={(e) => escribir(i, e.target.value)}
                onKeyDown={(e) => tecla(i, e)}
                onFocus={(e) => e.target.select()}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={i === 0 ? 6 : 1}
                aria-label={`Dígito ${i + 1} de 6`}
                aria-invalid={!!error}
                disabled={verificando}
                autoFocus={i === 0}
              />
            ))}
          </div>
        </fieldset>

        <div aria-live="polite">
          {error && <p className="field-msg error" role="alert">{error}</p>}
          {!error && aviso && <p className="texto-chico">{aviso}</p>}
        </div>

        <p className="texto-chico">
          <Icon name="clock" size={16} />
          {espera > 0 ? <>Puedes pedir otro código en {mmss}</> : (
            <button type="button" className="enlace" style={{ background: 'none', border: 0, padding: 0 }}
              onClick={() => void enviar()} disabled={enviando}>Pedir otro código</button>
          )}
          ·
          <button type="button" className="enlace" style={{ background: 'none', border: 0, padding: 0 }}
            onClick={() => { setCambiando(true); setError(''); }}>Cambiar número</button>
        </p>

        <Button type="submit" cargando={verificando} className="btn-bloque">Verificar código</Button>
      </form>
    </>
  );
}
