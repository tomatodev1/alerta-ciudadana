import type { EstadoAlerta, TipoIncidente } from '@/types/database.types';

/* ---------------------------------------------------------------------------
   Tipos de emergencia
   La tabla tipos_incidente solo guarda id, nombre, icono y prioridad. La guía
   (qué hacer, canal oficial, color) vive en el frontend y se cruza por id.
--------------------------------------------------------------------------- */

/** Respaldo cuando no hay sesión (RLS solo permite leer el catálogo a usuarios autenticados). */
export const TIPOS_RESPALDO: TipoIncidente[] = [
  { id: 1, nombre: 'Robo / Asalto', icono: 'wallet', prioridad: 1 },
  { id: 2, nombre: 'Violencia', icono: 'user-x', prioridad: 1 },
  { id: 3, nombre: 'Accidente', icono: 'car', prioridad: 2 },
  { id: 4, nombre: 'Persona en peligro', icono: 'alert', prioridad: 1 },
  { id: 5, nombre: 'Perturbación pública', icono: 'megaphone', prioridad: 3 },
  { id: 6, nombre: 'Otro', icono: 'more', prioridad: 3 },
];

/** Nombre de ícono guardado en la BD → clase de Bootstrap Icons. */
const ICONOS: Record<string, string> = {
  wallet: 'bi-wallet2',
  'user-x': 'bi-person-x-fill',
  car: 'bi-car-front-fill',
  alert: 'bi-exclamation-triangle-fill',
  megaphone: 'bi-megaphone-fill',
  more: 'bi-three-dots',
};

export interface Canal { numero: string; nombre: string }

export interface GuiaTipo {
  color: string;
  descripcion: string;
  canal: Canal;
  pasos: string[];
}

const POLICIA: Canal = { numero: '105', nombre: 'Policía Nacional' };

const GUIAS: Record<number, GuiaTipo> = {
  1: {
    color: '#c8102e',
    descripcion: 'Robo en la vía pública, asalto a mano armada o arrebato.',
    canal: POLICIA,
    pasos: [
      'Ponte a salvo; no persigas ni enfrentes al agresor.',
      'Memoriza rasgos, ropa, vehículo y dirección de huida.',
      'Llama al 105 y luego registra la alerta con la ubicación exacta.',
    ],
  },
  2: {
    color: '#7c3aed',
    descripcion: 'Agresiones físicas, peleas o violencia familiar y de género.',
    canal: POLICIA,
    pasos: [
      'Busca un lugar seguro y aléjate del agresor.',
      'Si es violencia familiar o de género, también puedes llamar a la Línea 100.',
      'No borres mensajes ni fotos: sirven como evidencia.',
    ],
  },
  3: {
    color: '#d97706',
    descripcion: 'Choques, atropellos o vehículos que bloquean la vía.',
    canal: POLICIA,
    pasos: [
      'Señaliza la zona y no muevas a los heridos.',
      'Si hay heridos, llama también al SAMU (106).',
      'Anota placas y toma fotos solo si es seguro.',
    ],
  },
  4: {
    color: '#b91c1c',
    descripcion: 'Una persona amenazada, desaparecida o en riesgo inmediato.',
    canal: POLICIA,
    pasos: [
      'Llama al 105 de inmediato y describe a la persona.',
      'Indica la ubicación con referencias claras.',
      'No te expongas: espera a la unidad en un lugar seguro.',
    ],
  },
  5: {
    color: '#0b3a6e',
    descripcion: 'Ruidos molestos, disturbios o personas en estado de ebriedad.',
    canal: POLICIA,
    pasos: [
      'Mantén la distancia y evita confrontaciones.',
      'Indica la dirección y desde qué hora ocurre.',
      'Registra la alerta para que la comisaría de tu zona la atienda.',
    ],
  },
  6: {
    color: '#4a5568',
    descripcion: 'Cualquier otra situación que requiera presencia policial.',
    canal: POLICIA,
    pasos: [
      'Describe la situación de forma breve y clara.',
      'Incluye la ubicación exacta y si hay personas en riesgo.',
      'Ante incendios llama al 116; ante urgencias médicas, al 106.',
    ],
  },
};

const GUIA_GENERICA: GuiaTipo = GUIAS[6];

export interface TipoConGuia extends TipoIncidente, GuiaTipo { iconoBi: string }

export function conGuia(tipo: TipoIncidente): TipoConGuia {
  return {
    ...tipo,
    ...(GUIAS[tipo.id] ?? GUIA_GENERICA),
    iconoBi: ICONOS[tipo.icono] ?? 'bi-exclamation-circle-fill',
  };
}

/* ---------------------------------------------------------------------------
   Alertas de ejemplo (RLS no permite leer alertas sin sesión)
--------------------------------------------------------------------------- */

export const ESTADOS: { valor: EstadoAlerta; etiqueta: string; badge: string; significado: string }[] = [
  { valor: 'enviada', etiqueta: 'Enviada', badge: 'text-bg-secondary', significado: 'La alerta salió del dispositivo del ciudadano.' },
  { valor: 'recibida', etiqueta: 'Recibida', badge: 'text-bg-info', significado: 'La Central 105 recibió la alerta.' },
  { valor: 'en_evaluacion', etiqueta: 'En evaluación', badge: 'text-bg-primary', significado: 'Un operador revisa la alerta y la prioriza.' },
  { valor: 'en_atencion', etiqueta: 'En atención', badge: 'text-bg-warning', significado: 'Se asignó una unidad policial que se dirige al lugar.' },
  { valor: 'finalizada', etiqueta: 'Finalizada', badge: 'text-bg-success', significado: 'La unidad llegó al lugar y cerró la intervención.' },
];

export function infoEstado(valor: EstadoAlerta) {
  return ESTADOS.find((e) => e.valor === valor)
    ?? { valor, etiqueta: 'Cancelada', badge: 'text-bg-dark', significado: 'La alerta fue cancelada.' };
}

export interface AlertaEjemplo {
  codigo: string;
  fecha: string;      // ISO
  tipo: string;
  zona: string;
  estado: EstadoAlerta;
  unidad?: string;
  /** Hora (HH:MM) en que se alcanzó cada estado. */
  horas: Partial<Record<EstadoAlerta, string>>;
}

export const ALERTAS_EJEMPLO: AlertaEjemplo[] = [
  { codigo: 'INC-2026-000207', fecha: '2026-11-10T21:42:00', tipo: 'Robo / Asalto', zona: 'San Isidro', estado: 'en_evaluacion',
    horas: { enviada: '21:42', recibida: '21:42', en_evaluacion: '21:43' } },
  { codigo: 'INC-2026-000206', fecha: '2026-11-10T21:15:00', tipo: 'Accidente', zona: 'Miraflores', estado: 'en_atencion', unidad: 'Alfa-201',
    horas: { enviada: '21:15', recibida: '21:15', en_evaluacion: '21:16', en_atencion: '21:19' } },
  { codigo: 'INC-2026-000205', fecha: '2026-11-10T20:58:00', tipo: 'Perturbación pública', zona: 'Surquillo', estado: 'recibida',
    horas: { enviada: '20:58', recibida: '20:58' } },
  { codigo: 'INC-2026-000200', fecha: '2026-11-10T19:30:00', tipo: 'Violencia', zona: 'Lince', estado: 'en_atencion', unidad: 'Delta-110',
    horas: { enviada: '19:30', recibida: '19:30', en_evaluacion: '19:31', en_atencion: '19:35' } },
  { codigo: 'INC-2026-000188', fecha: '2026-11-10T17:05:00', tipo: 'Persona en peligro', zona: 'San Isidro', estado: 'finalizada', unidad: 'Delta-105',
    horas: { enviada: '17:05', recibida: '17:05', en_evaluacion: '17:06', en_atencion: '17:09', finalizada: '17:23' } },
  { codigo: 'INC-2026-000171', fecha: '2026-11-09T23:12:00', tipo: 'Robo / Asalto', zona: 'Miraflores', estado: 'finalizada', unidad: 'Alfa-202',
    horas: { enviada: '23:12', recibida: '23:12', en_evaluacion: '23:13', en_atencion: '23:17', finalizada: '23:40' } },
  { codigo: 'INC-2026-000150', fecha: '2026-11-09T14:48:00', tipo: 'Accidente', zona: 'Surquillo', estado: 'finalizada', unidad: 'Alfa-201',
    horas: { enviada: '14:48', recibida: '14:48', en_evaluacion: '14:49', en_atencion: '14:52', finalizada: '15:10' } },
  { codigo: 'INC-2026-000125', fecha: '2026-11-08T10:20:00', tipo: 'Robo / Asalto', zona: 'Lince', estado: 'finalizada', unidad: 'Delta-105',
    horas: { enviada: '10:20', recibida: '10:20', en_evaluacion: '10:21', en_atencion: '10:24', finalizada: '10:38' } },
];

export const CODIGOS_EJEMPLO = ['INC-2026-000125', 'INC-2026-000200'];

export function buscarAlerta(codigo: string) {
  const c = codigo.trim().toUpperCase();
  return ALERTAS_EJEMPLO.find((a) => a.codigo === c);
}

export function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Indicadores de la franja de estadísticas (ejemplo). */
export const INDICADORES = { total: 1248, pct: 87, tiempo: 18 };
