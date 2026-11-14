-- =====================================================================
-- Paso 6 · Panel de la Central 105
-- Reglas en el servidor para que la gestión de alertas sea consistente
-- aunque la haga cualquier operador (o varios a la vez).
-- =====================================================================

-- 1. Antes de actualizar una alerta:
--    - una alerta finalizada o cancelada ya no puede cambiar de estado ni de unidad;
--    - solo se puede asignar una unidad disponible;
--    - se registra qué operador la atendió.
create or replace function public.validar_cambio_alerta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado_unidad public.estado_unidad;
begin
  if old.estado in ('finalizada', 'cancelada')
     and (new.estado is distinct from old.estado or new.unidad_id is distinct from old.unidad_id) then
    raise exception 'La alerta % ya está cerrada', old.codigo using errcode = 'P0001';
  end if;

  if new.unidad_id is not null and new.unidad_id is distinct from old.unidad_id then
    select estado into v_estado_unidad from public.unidades where id = new.unidad_id;
    if v_estado_unidad is distinct from 'disponible' then
      raise exception 'La unidad no está disponible' using errcode = 'P0001';
    end if;
  end if;

  if auth.uid() is not null and new.operador_id is null then
    new.operador_id := auth.uid();
  end if;
  return new;
end $$;

create trigger antes_de_cambiar_alerta
  before update of estado, unidad_id on public.alertas
  for each row execute function public.validar_cambio_alerta();

-- 2. Después del cambio: sincroniza el estado de las unidades.
--    Unidad asignada → en_ruta. Al cerrar la alerta o cambiar de unidad, la anterior vuelve a disponible.
create or replace function public.sincronizar_unidad()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.unidad_id is not null
     and (new.unidad_id is distinct from old.unidad_id or new.estado in ('finalizada', 'cancelada')) then
    update public.unidades set estado = 'disponible', actualizado_en = now() where id = old.unidad_id;
  end if;

  if new.unidad_id is not null and new.estado = 'en_atencion'
     and (new.unidad_id is distinct from old.unidad_id or old.estado is distinct from 'en_atencion') then
    update public.unidades set estado = 'en_ruta', actualizado_en = now() where id = new.unidad_id;
  end if;
  return null;
end $$;

create trigger despues_de_cambiar_unidad
  after update of estado, unidad_id on public.alertas
  for each row execute function public.sincronizar_unidad();

-- 3. La bandeja de la central escucha también los cambios de las unidades.
alter publication supabase_realtime add table public.unidades;
