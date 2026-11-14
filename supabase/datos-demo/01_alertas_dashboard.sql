-- =====================================================================
-- Datos de demostración para el Dashboard de monitoreo
-- Crea 12 ciudadanos demo verificados y 240 alertas de los últimos 12 meses
-- (con su historial de estados) en distritos de Lima Metropolitana y Callao.
--
-- Cómo usarlo: pega todo en Supabase → SQL Editor → Run. Tarda unos segundos.
-- Para borrar estos datos: 02_limpiar_datos_demo.sql
--
-- Notas:
--  · Los triggers de "alertas" se desactivan SOLO durante la carga (dentro de la
--    misma transacción) para poder fijar fechas pasadas, estados y tiempos de
--    respuesta; al final se vuelven a activar. No se crean notificaciones.
--  · Los ciudadanos demo no pueden iniciar sesión (no tienen contraseña).
--  · setseed hace que los datos salgan iguales cada vez que se carguen.
-- =====================================================================

do $$
declare
  -- distrito, zona, ciudad, latitud, longitud
  distritos text[][] := array[
    ['Cercado de Lima','Lima Centro','Lima','-12.0464','-77.0428'],
    ['Breña','Lima Centro','Lima','-12.0597','-77.0510'],
    ['La Victoria','Lima Centro','Lima','-12.0730','-77.0160'],
    ['Rímac','Lima Centro','Lima','-12.0290','-77.0300'],
    ['San Luis','Lima Centro','Lima','-12.0750','-76.9970'],
    ['San Isidro','Lima Moderna','Lima','-12.0972','-77.0363'],
    ['Miraflores','Lima Moderna','Lima','-12.1219','-77.0297'],
    ['Surquillo','Lima Moderna','Lima','-12.1128','-77.0186'],
    ['San Borja','Lima Moderna','Lima','-12.1000','-76.9990'],
    ['Lince','Lima Moderna','Lima','-12.0850','-77.0350'],
    ['Jesús María','Lima Moderna','Lima','-12.0700','-77.0450'],
    ['Santiago de Surco','Lima Moderna','Lima','-12.1450','-76.9930'],
    ['Pueblo Libre','Lima Moderna','Lima','-12.0750','-77.0630'],
    ['San Miguel','Lima Moderna','Lima','-12.0780','-77.0900'],
    ['Barranco','Lima Moderna','Lima','-12.1490','-77.0210'],
    ['Los Olivos','Lima Norte','Lima','-11.9700','-77.0730'],
    ['San Martín de Porres','Lima Norte','Lima','-12.0000','-77.0600'],
    ['Comas','Lima Norte','Lima','-11.9400','-77.0500'],
    ['Independencia','Lima Norte','Lima','-11.9900','-77.0500'],
    ['Puente Piedra','Lima Norte','Lima','-11.8600','-77.0730'],
    ['Carabayllo','Lima Norte','Lima','-11.8500','-77.0300'],
    ['San Juan de Lurigancho','Lima Este','Lima','-11.9800','-77.0000'],
    ['Ate','Lima Este','Lima','-12.0300','-76.9200'],
    ['Santa Anita','Lima Este','Lima','-12.0430','-76.9700'],
    ['El Agustino','Lima Este','Lima','-12.0420','-76.9950'],
    ['La Molina','Lima Este','Lima','-12.0800','-76.9400'],
    ['Chorrillos','Lima Sur','Lima','-12.1700','-77.0150'],
    ['San Juan de Miraflores','Lima Sur','Lima','-12.1600','-76.9700'],
    ['Villa El Salvador','Lima Sur','Lima','-12.2130','-76.9370'],
    ['Villa María del Triunfo','Lima Sur','Lima','-12.1600','-76.9300'],
    ['Callao','Callao','Callao','-12.0500','-77.1300'],
    ['Bellavista','Callao','Callao','-12.0600','-77.1100'],
    ['Ventanilla','Callao','Callao','-11.8750','-77.1300']
  ];
  -- Peso de cada distrito (más alertas en los distritos más poblados)
  pesos int[] := array[9,3,6,4,2, 4,5,3,3,2,2,5,2,3,2, 6,7,5,3,4,3, 10,6,3,3,2, 4,5,6,5, 6,3,3];
  calles text[] := array['Av. Arequipa','Av. Javier Prado','Jr. de la Unión','Av. Brasil','Av. Túpac Amaru',
    'Av. Universitaria','Av. Próceres de la Independencia','Av. Colonial','Av. Angamos','Av. Benavides',
    'Av. Venezuela','Av. Abancay','Av. Grau','Av. Pachacútec','Calle Los Pinos','Av. Los Héroes',
    'Av. Naranjal','Av. Huaylas','Av. La Marina','Av. Faucett'];
  nombres text[] := array['LUIS','MARÍA','CARLOS','ANA','JORGE','ROSA','MIGUEL','CARMEN','PEDRO','LUCÍA','JOSÉ','ELENA'];
  apellidos text[] := array['QUISPE ROJAS','FLORES MENDOZA','GARCÍA TORRES','HUAMÁN CRUZ','RAMOS VEGA','CHÁVEZ DÍAZ',
    'MENDOZA SOTO','TORRES RÍOS','VARGAS LEÓN','CASTILLO PAZ','ROJAS LUNA','SALAZAR NIETO'];

  v_total_pesos int;
  v_ciudadanos uuid[] := '{}';
  v_unidades bigint[];
  v_operador uuid;
  v_id uuid;
  v_i int;
  v_r numeric;
  v_acum int;
  v_d int;
  v_tipo smallint;
  v_prio smallint;
  v_recibida timestamptz;
  v_fin timestamptz;
  v_estado public.estado_alerta;
  v_min numeric;
  v_unidad bigint;
  v_unidad_txt text;
  v_lat double precision;
  v_lng double precision;
begin
  if exists (select 1 from public.alertas a join public.perfiles p on p.id = a.ciudadano_id
             where p.correo like '%@demo.alertaciudadana.pe') then
    raise exception 'Ya hay datos demo cargados. Ejecuta primero 02_limpiar_datos_demo.sql.';
  end if;

  perform setseed(0.2026);

  -- 1. Ciudadanos demo (el trigger crear_perfil les crea el perfil)
  for v_i in 1..12 loop
    select id into v_id from auth.users where email = format('ciudadano%s@demo.alertaciudadana.pe', lpad(v_i::text, 2, '0'));
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
              format('ciudadano%s@demo.alertaciudadana.pe', lpad(v_i::text, 2, '0')), '', now() - interval '13 months',
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('dni', '990000' || lpad(v_i::text, 2, '0'), 'nombres', nombres[v_i],
                                 'apellidos', apellidos[v_i], 'celular', '+5190000' || lpad((1000 + v_i)::text, 4, '0')),
              now() - interval '13 months', now(), '', '', '', '');
    end if;
    update public.perfiles
       set estado_verificacion = 'verificada', verificado_en = now() - interval '12 months',
           celular_confirmado_en = now() - interval '12 months', intentos_verificacion = 1
     where id = v_id;
    v_ciudadanos := v_ciudadanos || v_id;
  end loop;

  select array_agg(id order by id) into v_unidades from public.unidades;
  select id into v_operador from public.perfiles where rol in ('operador', 'admin') order by creado_en limit 1;
  select sum(x) into v_total_pesos from unnest(pesos) x;

  -- 2. Alertas: sin triggers mientras se cargan (para fijar fechas y estados del pasado)
  alter table public.alertas disable trigger user;

  for v_i in 1..240 loop
    -- Distrito según su peso
    -- (la variable de un FOR solo existe dentro del ciclo: el elegido se guarda en v_d)
    v_r := floor(random() * v_total_pesos);
    v_acum := 0;
    v_d := array_length(pesos, 1);
    for k in 1..array_length(pesos, 1) loop
      v_acum := v_acum + pesos[k];
      if v_r < v_acum then v_d := k; exit; end if;
    end loop;

    -- Tipo: robo 35 %, accidente 18 %, violencia 15 %, perturbación 15 %, persona en peligro 10 %, otro 7 %
    v_r := random();
    v_tipo := case when v_r < 0.35 then 1 when v_r < 0.53 then 3 when v_r < 0.68 then 2
                   when v_r < 0.83 then 5 when v_r < 0.93 then 4 else 6 end;
    select prioridad into v_prio from public.tipos_incidente where id = v_tipo;

    -- Fecha: más alertas en los meses recientes y en la tarde/noche.
    -- Las 12 últimas son de las últimas 24 horas (algunas siguen en curso).
    if v_i > 228 then
      v_recibida := now() - (random() * interval '23 hours') - interval '20 minutes';
    else
      v_recibida := date_trunc('day', now() - (power(random(), 1.35) * 364 + 1) * interval '1 day')
                    + (case when random() < 0.65 then 14 + random() * 10 else random() * 14 end) * interval '1 hour';
    end if;

    -- Tiempo de respuesta según prioridad (minutos)
    v_min := case v_prio when 1 then 7 + random() * 16 when 2 then 11 + random() * 22 else 15 + random() * 30 end;

    v_estado := case
      when v_i > 236 then 'en_evaluacion'
      when v_i > 232 then 'recibida'
      when random() < 0.06 then 'cancelada'
      else 'finalizada' end;
    v_fin := case when v_estado = 'finalizada' then v_recibida + v_min * interval '1 minute'
                  when v_estado = 'cancelada' then v_recibida + (2 + random() * 6) * interval '1 minute' end;
    v_unidad := case when v_estado = 'finalizada' then v_unidades[1 + floor(random() * array_length(v_unidades, 1))::int] end;

    v_lat := distritos[v_d][4]::double precision + (random() - 0.5) * 0.018;
    v_lng := distritos[v_d][5]::double precision + (random() - 0.5) * 0.018;
    v_id := gen_random_uuid();

    insert into public.alertas (id, codigo, ciudadano_id, tipo_id, estado, latitud, longitud, precision_m, direccion,
                                ubicacion_manual, canal, activada_por_voz, generada_en, recibida_en, unidad_id,
                                operador_id, finalizada_en)
    values (v_id,
            'INC-' || to_char(v_recibida at time zone 'America/Lima', 'YYYY') || '-' || lpad(nextval('public.alertas_correlativo')::text, 6, '0'),
            v_ciudadanos[1 + floor(random() * 12)::int], v_tipo, v_estado, v_lat, v_lng,
            round((5 + random() * 25)::numeric, 1),
            format('%s %s, %s, %s', calles[1 + floor(random() * array_length(calles, 1))::int],
                   (100 + floor(random() * 2900))::int, distritos[v_d][1], distritos[v_d][3]),
            random() < 0.08,
            (case when random() < 0.05 then 'reintento_sin_conexion' else 'web' end)::public.canal_envio,
            random() < 0.07,
            v_recibida - (2 + random() * 20) * interval '1 second', v_recibida, v_unidad,
            case when v_estado in ('finalizada', 'cancelada', 'en_evaluacion') then v_operador end, v_fin);

    -- Historial de estados (lo que normalmente escribe el trigger registrar_estado)
    insert into public.alerta_estados (alerta_id, estado, nota, cambiado_por, creado_en) values
      (v_id, 'enviada', null, null, v_recibida),
      (v_id, 'recibida', null, v_operador, v_recibida + (3 + random() * 10) * interval '1 second');
    if v_estado in ('en_evaluacion', 'finalizada') then
      insert into public.alerta_estados (alerta_id, estado, nota, cambiado_por, creado_en)
      values (v_id, 'en_evaluacion', null, v_operador, v_recibida + (30 + random() * 60) * interval '1 second');
    end if;
    if v_estado = 'finalizada' then
      select codigo || ' · Patrullero ' || placa into v_unidad_txt from public.unidades where id = v_unidad;
      insert into public.alerta_estados (alerta_id, estado, nota, cambiado_por, creado_en) values
        (v_id, 'en_atencion', v_unidad_txt || ' en camino', v_operador, v_recibida + (2 + random() * 3) * interval '1 minute'),
        (v_id, 'finalizada', null, v_operador, v_fin);
    elsif v_estado = 'cancelada' then
      insert into public.alerta_estados (alerta_id, estado, nota, cambiado_por, creado_en)
      values (v_id, 'cancelada', null, v_operador, v_fin);
    end if;
  end loop;

  alter table public.alertas enable trigger user;

  raise notice 'Listo: 12 ciudadanos demo y 240 alertas cargadas.';
end $$;

-- Comprobación rápida
select estado, count(*) from public.alertas a
join public.perfiles p on p.id = a.ciudadano_id
where p.correo like '%@demo.alertaciudadana.pe'
group by estado order by 2 desc;
