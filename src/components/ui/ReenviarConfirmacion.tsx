import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mensajeAuth } from '@/lib/funciones';
import { Button } from './Button';
import { Icon } from './Icon';

const ESPERA_S = 60;

/** Reenvía el correo "Confirma tu registro" de Supabase. El enlace vuelve a /registro. */
export function ReenviarConfirmacion({ correo, esperaInicial = 0 }: { correo: string; esperaInicial?: number }) {
  const [espera, setEspera] = useState(esperaInicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function reenviar() {
    setEnviando(true);
    setMensaje('');
    const { error: e } = await supabase.auth.resend({
      type: 'signup',
      email: correo,
      options: { emailRedirectTo: `${window.location.origin}/registro` },
    });
    setEnviando(false);
    setError(!!e);
    setMensaje(e ? mensajeAuth(e.message) : 'Te enviamos un nuevo enlace. Revisa también la carpeta de spam.');
    setEspera(ESPERA_S);
  }

  return (
    <div className="reenviar-confirmacion">
      <Button variante="contorno" className="btn-bloque" onClick={reenviar} cargando={enviando} disabled={espera > 0}>
        <Icon name="mail" /> {espera > 0 ? `Reenviar correo en ${espera} s` : 'Reenviar correo de confirmación'}
      </Button>
      <p className={`texto-chico${error ? ' color-warn' : ''}`} role="status">{mensaje}</p>
    </div>
  );
}
