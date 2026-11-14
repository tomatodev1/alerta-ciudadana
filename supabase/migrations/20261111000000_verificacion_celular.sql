-- =====================================================================
-- Paso 3 · Registro verificado (RF-16): confirmación del celular por código
-- =====================================================================

-- 1. Marca de celular confirmado en el perfil (la pone la Edge Function confirmar-celular).
--    El ciudadano no puede cambiarla: solo tiene permiso de UPDATE sobre (celular, correo).
alter table public.perfiles add column celular_confirmado_en timestamptz;

-- Si el ciudadano cambia su número, debe volver a confirmarlo.
create or replace function public.reiniciar_confirmacion_celular()
returns trigger language plpgsql as $$
begin
  if new.celular is distinct from old.celular then
    new.celular_confirmado_en := null;
  end if;
  return new;
end $$;

create trigger perfiles_celular_cambiado before update of celular on public.perfiles
  for each row execute function public.reiniciar_confirmacion_celular();

-- 2. Códigos de confirmación (solo los usa la Edge Function con service_role).
--    El código nunca se guarda en claro: se guarda su hash SHA-256.
create table public.codigos_celular (
  usuario_id   uuid primary key references public.perfiles (id) on delete cascade,
  celular      text        not null,
  codigo_hash  text        not null,
  expira_en    timestamptz not null,
  intentos     smallint    not null default 0,
  enviado_en   timestamptz not null default now()
);

alter table public.codigos_celular enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leerla o escribirla.

-- 3. Permite a la Edge Function borrar las fotos de verificación al terminar
--    (service_role ya ignora RLS; esta política deja que el dueño las liste si hace falta).
create policy "ver mis fotos de verificacion" on storage.objects for select to authenticated
  using (bucket_id = 'verificacion' and (storage.foldername(name))[1] = auth.uid()::text);
