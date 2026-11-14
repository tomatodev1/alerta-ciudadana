export function validarContrasena(v: string) {
  if (v.length < 8) return 'Usa al menos 8 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) || !/\d/.test(v)) return 'Combina letras y números.';
  return '';
}

export const esCorreo = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** "+51987654321" → "+51 987 ••• 321" */
export const mascaraCelular = (cel: string) => cel.replace(/^\+51(\d{3})\d{3}(\d{3})$/, '+51 $1 ••• $2');

/** "12345678" → "1234••78" */
export const mascaraDni = (dni: string) => `${dni.slice(0, 4)}••${dni.slice(6)}`;

export function formatearFecha(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
