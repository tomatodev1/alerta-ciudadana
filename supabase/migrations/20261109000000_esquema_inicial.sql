-- =====================================================================
-- AlertaCiudadana · Esquema inicial (Supabase / PostgreSQL + PostGIS)
-- Grupo 6 · IHC · MININTER / PNP
-- =====================================================================

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
create type public.rol_usuario         as enum ('ciudadano', 'operador', 'admin');
create type public.estado_verificacion as enum ('pendiente', 'verificada', 'rechazada', 'revision_manual');
create type public.estado_alerta       as enum ('enviada', 'recibida', 'en_evaluacion', 'en_atencion', 'finalizada', 'cancelada');
create type public.canal_envio         as enum ('web', 'reintento_sin_conexion', 'sms_asistido');
create type public.tipo_evidencia      as enum ('foto', 'video', 'audio');
create type public.estado_unidad       as enum ('disponible', 'en_ruta', 'en_atencion', 'fuera_de_servicio');

-- ---------------------------------------------------------------------
-- 2. Usuarios e identidad (RF-01, RF-13, RF-16)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  dni                   char(8)     not null unique check (dni ~ '^[0-9]{8}$'),
  nombres               text        not null,
  apellidos             text        not null,
  fecha_nacimiento      date,
  celular               text        not null,
  correo                text        not null,
  rol                   public.rol_usuario         not null default 'ciudadano',
  estado_verificacion   public.estado_verificacion not null default 'pendiente',
  verificado_en         timestamptz,
  intentos_verificacion smallint    not null default 0,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

-- Historial de intentos de verificación biométrica (auditoría RF-16)
create table public.verificaciones_identidad (
  id                 bigint generated always as identity primary key,
  usuario_id         uuid not null references public.perfiles (id) on delete cascade,
  dni_validado       boolean not null,          -- RENIEC / API de DNI
  celular_confirmado boolean not null,          -- código SMS
  prueba_vida        boolean not null,          -- gestos: parpadeo, giro
  distancia_facial   numeric(5,4),              -- face-api.js: < 0.50 = coincide
  resultado          public.estado_verificacion not null,
  motivo             text,
  creado_en          timestamptz not null default now()
);

create table public.contactos_confianza (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  nombre      text not null,
  parentesco  text,
  telefono    text not null,
  creado_en   timestamptz not null default now()
);

create table public.preferencias (
  usuario_id         uuid primary key references public.perfiles (id) on delete cascade,
  comando_voz        boolean not null default true,
  texto_grande       boolean not null default false,
  notif_navegador    boolean not null default true,
  notif_sms          boolean not null default true,
  notif_correo       boolean not null default false
);

-- ---------------------------------------------------------------------
-- 3. Catálogos y recursos policiales
-- ---------------------------------------------------------------------
create table public.tipos_incidente (
  id        smallint primary key,
  nombre    text not null unique,
  icono     text not null,                       -- nombre del ícono en el frontend
  prioridad smallint not null default 2 check (prioridad between 1 and 3)  -- 1 = más urgente
);

create table public.comisarias (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  distrito  text not null,
  telefono  text,
  latitud   double precision not null,
  longitud  double precision not null,
  ubicacion extensions.geography(point, 4326)
            generated always as (extensions.st_setsrid(extensions.st_makepoint(longitud, latitud), 4326)::extensions.geography) stored
);

create table public.unidades (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,            -- p. ej. Delta-105
  placa           text not null unique,            -- p. ej. PL-123
  comisaria_id    bigint not null references public.comisarias (id),
  efectivo_cargo  text not null,                   -- p. ej. S.O. Ramírez
  telefono        text,
  estado          public.estado_unidad not null default 'disponible',
  latitud         double precision,
  longitud        double precision,
  ubicacion       extensions.geography(point, 4326)
                  generated always as (extensions.st_setsrid(extensions.st_makepoint(longitud, latitud), 4326)::extensions.geography) stored,
  actualizado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Alertas (RF-03 a RF-12)
-- ---------------------------------------------------------------------
create sequence public.alertas_correlativo;

create table public.alertas (
  id                uuid primary key default gen_random_uuid(),
  codigo            text unique,                         -- INC-2026-000123 (lo pone el trigger)
  ciudadano_id      uuid not null references public.perfiles (id),
  tipo_id           smallint not null references public.tipos_incidente (id),
  estado            public.estado_alerta not null default 'enviada',
  latitud           double precision not null,
  longitud          double precision not null,
  ubicacion         extensions.geography(point, 4326)
                    generated always as (extensions.st_setsrid(extensions.st_makepoint(longitud, latitud), 4326)::extensions.geography) stored,
  precision_m       real,                                -- GPS ±8 m
  direccion         text,
  ubicacion_manual  boolean not null default false,      -- RNF-06
  canal             public.canal_envio not null default 'web',  -- RNF-09
  activada_por_voz  boolean not null default false,      -- RF-04
  generada_en       timestamptz not null default now(),  -- hora en el dispositivo (sirve si se envió sin conexión)
  recibida_en       timestamptz not null default now(),  -- hora en el servidor
  unidad_id         bigint references public.unidades (id),
  operador_id       uuid references public.perfiles (id),
  finalizada_en     timestamptz,
  constraint lat_valida check (latitud between -90 and 90),
  constraint lng_valida check (longitud between -180 and 180)
);

-- Línea de tiempo del estado (RF-10)
create table public.alerta_estados (
  id           bigint generated always as identity primary key,
  alerta_id    uuid not null references public.alertas (id) on delete cascade,
  estado       public.estado_alerta not null,
  nota         text,                                   -- "Patrullero PL-123 en camino"
  cambiado_por uuid references public.perfiles (id),
  creado_en    timestamptz not null default now()
);

-- Evidencia multimedia (RF-06, RNF-05)
create table public.evidencias (
  id            bigint generated always as identity primary key,
  alerta_id     uuid not null references public.alertas (id) on delete cascade,
  subido_por    uuid not null references public.perfiles (id),
  tipo          public.tipo_evidencia not null,
  ruta_storage  text not null unique,                 -- evidencias/<usuario>/<alerta>/<archivo>
  tamano_bytes  integer check (tamano_bytes <= 52428800),
  creado_en     timestamptz not null default now()
);

-- Notificaciones al ciudadano
create table public.notificaciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  alerta_id   uuid references public.alertas (id) on delete cascade,
  titulo      text not null,
  mensaje     text not null,
  leida       boolean not null default false,
  creado_en   timestamptz not null default now()
);

-- Índices
create index alertas_ciudadano_idx   on public.alertas (ciudadano_id, recibida_en desc);
create index alertas_estado_idx      on public.alertas (estado) where estado not in ('finalizada', 'cancelada');
create index alertas_ubicacion_idx   on public.alertas using gist (ubicacion);
create index unidades_ubicacion_idx  on public.unidades using gist (ubicacion);
create index alerta_estados_idx      on public.alerta_estados (alerta_id, creado_en);
create index notificaciones_idx      on public.notificaciones (usuario_id, leida, creado_en desc);
create index evidencias_alerta_idx   on public.evidencias (alerta_id);

-- ---------------------------------------------------------------------
-- 5. Funciones auxiliares
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid();
$$;

create or replace function public.es_operador()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('operador', 'admin'), false);
$$;

create or replace function public.esta_verificado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and estado_verificacion = 'verificada');
$$;

-- Unidades disponibles más cercanas a una alerta (panel de la central)
create or replace function public.unidades_cercanas(p_alerta uuid, p_limite int default 5)
returns table (unidad_id bigint, codigo text, placa text, comisaria text, distancia_m double precision)
language sql stable security definer set search_path = public, extensions as $$
  select u.id, u.codigo, u.placa, c.nombre, st_distance(u.ubicacion, a.ubicacion)
  from public.alertas a
  join public.unidades u on u.estado = 'disponible' and u.ubicacion is not null
  join public.comisarias c on c.id = u.comisaria_id
  where a.id = p_alerta and public.es_operador()
  order by u.ubicacion <-> a.ubicacion
  limit p_limite;
$$;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
-- 6.1 Crear el perfil al registrarse (datos enviados en options.data del signUp)
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Usuarios creados desde el panel de Supabase (p. ej. operadores) no traen DNI: se omiten.
  if new.raw_user_meta_data ->> 'dni' is null then
    return new;
  end if;
  insert into public.perfiles (id, dni, nombres, apellidos, fecha_nacimiento, celular, correo)
  values (new.id,
          new.raw_user_meta_data ->> 'dni',
          new.raw_user_meta_data ->> 'nombres',
          new.raw_user_meta_data ->> 'apellidos',
          nullif(new.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
          new.raw_user_meta_data ->> 'celular',
          new.email);
  insert into public.preferencias (usuario_id) values (new.id);
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- 6.2 Código de incidencia INC-AAAA-NNNNNN y datos que no puede fijar el cliente
create or replace function public.preparar_alerta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.codigo      := 'INC-' || to_char(now() at time zone 'America/Lima', 'YYYY') || '-' ||
                     lpad(nextval('public.alertas_correlativo')::text, 6, '0');
  new.estado      := 'enviada';
  new.recibida_en := now();
  new.unidad_id   := null;
  new.operador_id := null;
  return new;
end $$;

create trigger antes_de_insertar_alerta
  before insert on public.alertas
  for each row execute function public.preparar_alerta();

-- 6.3 Historial de estados + notificación al ciudadano
create or replace function public.registrar_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_titulo text;
  v_msg    text;
  v_unidad text;
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado
     and new.unidad_id is not distinct from old.unidad_id then
    return new;
  end if;

  select u.codigo || ' · Patrullero ' || u.placa into v_unidad from public.unidades u where u.id = new.unidad_id;

  insert into public.alerta_estados (alerta_id, estado, nota, cambiado_por)
  values (new.id, new.estado,
          case when new.estado = 'en_atencion' and v_unidad is not null then v_unidad || ' en camino' end,
          auth.uid());

  v_titulo := case new.estado
    when 'enviada'       then 'Alerta enviada'
    when 'recibida'      then 'Alerta recibida'
    when 'en_evaluacion' then 'Cambio de estado'
    when 'en_atencion'   then 'Unidad asignada'
    when 'finalizada'    then 'Fin de la atención'
    when 'cancelada'     then 'Alerta cancelada' end;
  v_msg := case new.estado
    when 'enviada'       then 'Tu alerta ' || new.codigo || ' fue registrada.'
    when 'recibida'      then 'La central recibió tu alerta correctamente.'
    when 'en_evaluacion' then 'Tu alerta pasó a "En evaluación".'
    when 'en_atencion'   then coalesce(v_unidad, 'Una unidad') || ' va en camino a tu ubicación.'
    when 'finalizada'    then new.codigo || ' fue finalizada.'
    when 'cancelada'     then new.codigo || ' fue cancelada.' end;

  insert into public.notificaciones (usuario_id, alerta_id, titulo, mensaje)
  values (new.ciudadano_id, new.id, v_titulo, v_msg);

  if new.estado = 'finalizada' and new.finalizada_en is null then
    update public.alertas set finalizada_en = now() where id = new.id;
  end if;
  return new;
end $$;

create trigger despues_de_cambiar_alerta
  after insert or update of estado, unidad_id on public.alertas
  for each row execute function public.registrar_estado();

-- 6.4 Fecha de actualización del perfil
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------
-- 7. Seguridad: Row Level Security
-- ---------------------------------------------------------------------
alter table public.perfiles                 enable row level security;
alter table public.verificaciones_identidad enable row level security;
alter table public.contactos_confianza      enable row level security;
alter table public.preferencias             enable row level security;
alter table public.tipos_incidente          enable row level security;
alter table public.comisarias               enable row level security;
alter table public.unidades                 enable row level security;
alter table public.alertas                  enable row level security;
alter table public.alerta_estados           enable row level security;
alter table public.evidencias               enable row level security;
alter table public.notificaciones           enable row level security;

-- Perfiles: cada uno ve el suyo; la central ve todos.
create policy "perfil propio o central" on public.perfiles for select
  using (id = auth.uid() or public.es_operador());
create policy "editar perfil propio" on public.perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- El ciudadano solo puede cambiar sus datos de contacto; rol y verificación
-- solo los cambia la Edge Function verificar-identidad (service_role).
revoke update on public.perfiles from authenticated;
grant  update (celular, correo) on public.perfiles to authenticated;

create policy "ver mis verificaciones" on public.verificaciones_identidad for select
  using (usuario_id = auth.uid() or public.es_operador());

create policy "mis contactos" on public.contactos_confianza for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "mis preferencias" on public.preferencias for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Catálogos: lectura para usuarios con sesión.
create policy "leer tipos"      on public.tipos_incidente for select to authenticated using (true);
create policy "leer comisarias" on public.comisarias      for select to authenticated using (true);
create policy "leer unidades"   on public.unidades        for select to authenticated using (true);
create policy "central gestiona unidades" on public.unidades for update
  using (public.es_operador()) with check (public.es_operador());

-- Alertas: solo una cuenta verificada puede crear; cada uno ve las suyas; la central gestiona.
create policy "crear alerta verificada" on public.alertas for insert to authenticated
  with check (ciudadano_id = auth.uid() and public.esta_verificado());
create policy "ver mis alertas o central" on public.alertas for select
  using (ciudadano_id = auth.uid() or public.es_operador());
create policy "central actualiza alertas" on public.alertas for update
  using (public.es_operador()) with check (public.es_operador());

create policy "ver historial" on public.alerta_estados for select
  using (public.es_operador() or exists (
    select 1 from public.alertas a where a.id = alerta_id and a.ciudadano_id = auth.uid()));

create policy "ver evidencias" on public.evidencias for select
  using (public.es_operador() or exists (
    select 1 from public.alertas a where a.id = alerta_id and a.ciudadano_id = auth.uid()));
create policy "subir evidencia propia" on public.evidencias for insert to authenticated
  with check (subido_por = auth.uid() and exists (
    select 1 from public.alertas a where a.id = alerta_id and a.ciudadano_id = auth.uid()));

create policy "mis notificaciones" on public.notificaciones for select using (usuario_id = auth.uid());
create policy "marcar leida" on public.notificaciones for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Tiempo real (RF-10, RF-11 y bandeja de la central)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.alertas, public.alerta_estados, public.notificaciones;

-- ---------------------------------------------------------------------
-- 9. Storage: buckets privados
--    verificacion/<usuario>/dni.jpg y selfie.jpg  (se borran tras verificar)
--    evidencias/<usuario>/<alerta>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('verificacion', 'verificacion', false, 2097152),
       ('evidencias',   'evidencias',   false, 52428800)
on conflict (id) do nothing;

create policy "subir mis fotos de verificacion" on storage.objects for insert to authenticated
  with check (bucket_id = 'verificacion' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "subir mis evidencias" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "ver evidencias propias o central" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_operador()));
