/**
 * Zonas de Lima Metropolitana y Callao (agrupación usual: Lima Centro, Moderna, Norte, Este, Sur y Callao).
 * La zona de una alerta se deduce del distrito que aparece en su dirección
 * (la dirección viene de OpenStreetMap o de los datos demo: "Calle 123, Distrito, Ciudad").
 */
const DISTRITOS: Record<string, string> = {
  'Cercado de Lima': 'Lima Centro', 'Breña': 'Lima Centro', 'La Victoria': 'Lima Centro', 'Rímac': 'Lima Centro', 'San Luis': 'Lima Centro',
  'San Isidro': 'Lima Moderna', 'Miraflores': 'Lima Moderna', 'Surquillo': 'Lima Moderna', 'San Borja': 'Lima Moderna',
  'Lince': 'Lima Moderna', 'Jesús María': 'Lima Moderna', 'Santiago de Surco': 'Lima Moderna', 'Surco': 'Lima Moderna',
  'Pueblo Libre': 'Lima Moderna', 'San Miguel': 'Lima Moderna', 'Barranco': 'Lima Moderna', 'Magdalena del Mar': 'Lima Moderna',
  'Los Olivos': 'Lima Norte', 'San Martín de Porres': 'Lima Norte', 'Comas': 'Lima Norte', 'Independencia': 'Lima Norte',
  'Puente Piedra': 'Lima Norte', 'Carabayllo': 'Lima Norte', 'Ancón': 'Lima Norte', 'Santa Rosa': 'Lima Norte',
  'San Juan de Lurigancho': 'Lima Este', 'Ate': 'Lima Este', 'Santa Anita': 'Lima Este', 'El Agustino': 'Lima Este',
  'La Molina': 'Lima Este', 'Lurigancho': 'Lima Este', 'Chaclacayo': 'Lima Este', 'Cieneguilla': 'Lima Este',
  'Chorrillos': 'Lima Sur', 'San Juan de Miraflores': 'Lima Sur', 'Villa El Salvador': 'Lima Sur',
  'Villa María del Triunfo': 'Lima Sur', 'Lurín': 'Lima Sur', 'Pachacámac': 'Lima Sur',
  'Callao': 'Callao', 'Bellavista': 'Callao', 'Ventanilla': 'Callao', 'La Perla': 'Callao', 'Carmen de la Legua': 'Callao', 'La Punta': 'Callao',
};

export const ZONAS = ['Lima Centro', 'Lima Moderna', 'Lima Norte', 'Lima Este', 'Lima Sur', 'Callao'];
export const OTRAS = 'Otras zonas';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Los nombres más largos primero: "San Juan de Miraflores" antes que "Miraflores".
const ORDENADOS = Object.keys(DISTRITOS)
  .sort((a, b) => b.length - a.length)
  .map((d) => ({ distrito: d, zona: DISTRITOS[d], patron: new RegExp(`(^|[\\s,])${normalizar(d)}($|[\\s,])`) }));

const cache = new Map<string, { distrito: string; zona: string }>();

export function zonaDe(direccion: string | null): { distrito: string; zona: string } {
  if (!direccion) return { distrito: '—', zona: OTRAS };
  const guardada = cache.get(direccion);
  if (guardada) return guardada;
  const texto = normalizar(direccion);
  // "Callao" también es ciudad: se busca primero un distrito más específico.
  const encontrada = ORDENADOS.find((d) => d.distrito !== 'Callao' && d.patron.test(texto))
    ?? ORDENADOS.find((d) => d.patron.test(texto));
  const r = encontrada ? { distrito: encontrada.distrito, zona: encontrada.zona } : { distrito: '—', zona: OTRAS };
  cache.set(direccion, r);
  return r;
}
