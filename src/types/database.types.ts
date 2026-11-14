// Tipos de la base de datos (supabase/migrations/20261109000000_esquema_inicial.sql).
// Se pueden regenerar con:
//   npx supabase gen types typescript --project-id ieuprsfoxcbxgxukuwpp > src/types/database.types.ts

export type RolUsuario = 'ciudadano' | 'operador' | 'admin';
export type EstadoVerificacion = 'pendiente' | 'verificada' | 'rechazada' | 'revision_manual';
export type EstadoAlerta = 'enviada' | 'recibida' | 'en_evaluacion' | 'en_atencion' | 'finalizada' | 'cancelada';
export type CanalEnvio = 'web' | 'reintento_sin_conexion' | 'sms_asistido';
export type TipoEvidencia = 'foto' | 'video' | 'audio';
export type EstadoUnidad = 'disponible' | 'en_ruta' | 'en_atencion' | 'fuera_de_servicio';

type Tabla<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Perfil {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  celular: string;
  correo: string;
  rol: RolUsuario;
  estado_verificacion: EstadoVerificacion;
  verificado_en: string | null;
  celular_confirmado_en: string | null;
  intentos_verificacion: number;
  creado_en: string;
  actualizado_en: string;
}

export interface VerificacionIdentidad {
  id: number;
  usuario_id: string;
  dni_validado: boolean;
  celular_confirmado: boolean;
  prueba_vida: boolean;
  distancia_facial: number | null;
  resultado: EstadoVerificacion;
  motivo: string | null;
  creado_en: string;
}

export interface ContactoConfianza {
  id: number;
  usuario_id: string;
  nombre: string;
  parentesco: string | null;
  telefono: string;
  creado_en: string;
}

export interface Preferencias {
  usuario_id: string;
  comando_voz: boolean;
  texto_grande: boolean;
  notif_navegador: boolean;
  notif_sms: boolean;
  notif_correo: boolean;
}

export interface TipoIncidente {
  id: number;
  nombre: string;
  icono: string;
  prioridad: number;
}

export interface Comisaria {
  id: number;
  nombre: string;
  distrito: string;
  telefono: string | null;
  latitud: number;
  longitud: number;
  ubicacion: unknown;
}

export interface Unidad {
  id: number;
  codigo: string;
  placa: string;
  comisaria_id: number;
  efectivo_cargo: string;
  telefono: string | null;
  estado: EstadoUnidad;
  latitud: number | null;
  longitud: number | null;
  ubicacion: unknown;
  actualizado_en: string;
}

export interface Alerta {
  id: string;
  codigo: string | null;
  ciudadano_id: string;
  tipo_id: number;
  estado: EstadoAlerta;
  latitud: number;
  longitud: number;
  ubicacion: unknown;
  precision_m: number | null;
  direccion: string | null;
  ubicacion_manual: boolean;
  canal: CanalEnvio;
  activada_por_voz: boolean;
  generada_en: string;
  recibida_en: string;
  unidad_id: number | null;
  operador_id: string | null;
  finalizada_en: string | null;
}

export type NuevaAlerta = Pick<Alerta, 'ciudadano_id' | 'tipo_id' | 'latitud' | 'longitud'> &
  Partial<Pick<Alerta, 'precision_m' | 'direccion' | 'ubicacion_manual' | 'canal' | 'activada_por_voz' | 'generada_en'>>;

export interface AlertaEstado {
  id: number;
  alerta_id: string;
  estado: EstadoAlerta;
  nota: string | null;
  cambiado_por: string | null;
  creado_en: string;
}

export interface Evidencia {
  id: number;
  alerta_id: string;
  subido_por: string;
  tipo: TipoEvidencia;
  ruta_storage: string;
  tamano_bytes: number | null;
  creado_en: string;
}

export interface Notificacion {
  id: number;
  usuario_id: string;
  alerta_id: string | null;
  titulo: string;
  mensaje: string;
  leida: boolean;
  creado_en: string;
}

export interface Database {
  public: {
    Tables: {
      perfiles: Tabla<Perfil>;
      verificaciones_identidad: Tabla<VerificacionIdentidad>;
      contactos_confianza: Tabla<ContactoConfianza>;
      preferencias: Tabla<Preferencias>;
      tipos_incidente: Tabla<TipoIncidente>;
      comisarias: Tabla<Comisaria>;
      unidades: Tabla<Unidad>;
      alertas: Tabla<Alerta, NuevaAlerta>;
      alerta_estados: Tabla<AlertaEstado>;
      evidencias: Tabla<Evidencia>;
      notificaciones: Tabla<Notificacion>;
    };
    Views: Record<string, never>;
    Functions: {
      mi_rol: { Args: Record<string, never>; Returns: RolUsuario };
      es_operador: { Args: Record<string, never>; Returns: boolean };
      esta_verificado: { Args: Record<string, never>; Returns: boolean };
      unidades_cercanas: {
        Args: { p_alerta: string; p_limite?: number };
        Returns: { unidad_id: number; codigo: string; placa: string; comisaria: string; distancia_m: number }[];
      };
    };
    Enums: {
      rol_usuario: RolUsuario;
      estado_verificacion: EstadoVerificacion;
      estado_alerta: EstadoAlerta;
      canal_envio: CanalEnvio;
      tipo_evidencia: TipoEvidencia;
      estado_unidad: EstadoUnidad;
    };
    CompositeTypes: Record<string, never>;
  };
}
