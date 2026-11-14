-- =====================================================================
-- Cuenta predefinida para el Dashboard de monitoreo (gestor MININTER, rol admin)
--
-- 1) Supabase → Authentication → Users → Add user → Create new user
--      Email:    gestor@alertaciudadana.pe
--      Password: Gestor2026!
--      [x] Auto Confirm User
-- 2) Ejecuta este script en el SQL Editor.
--
-- Con esa cuenta, /ingresar lleva directo a /dashboard. También puede abrir /central.
-- =====================================================================
insert into public.perfiles (id, dni, nombres, apellidos, celular, correo, rol, estado_verificacion, verificado_en)
select id, '00000100', 'Gestor', 'MININTER', '100', email, 'admin', 'verificada', now()
from auth.users
where email = 'gestor@alertaciudadana.pe'
on conflict (id) do update set rol = 'admin', estado_verificacion = 'verificada';

-- Debe devolver una fila con rol = admin
select correo, rol, estado_verificacion from public.perfiles where correo = 'gestor@alertaciudadana.pe';
