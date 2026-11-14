-- =====================================================================
-- Borra los datos de demostración del Dashboard (ciudadanos demo y sus alertas).
-- No toca tus cuentas reales ni las alertas reales.
-- =====================================================================
begin;

-- Alertas de los ciudadanos demo (su historial, evidencias y notificaciones se borran en cascada)
delete from public.alertas a
using public.perfiles p
where p.id = a.ciudadano_id and p.correo like '%@demo.alertaciudadana.pe';

-- Ciudadanos demo (el perfil y sus preferencias se borran en cascada)
delete from auth.users where email like '%@demo.alertaciudadana.pe';

commit;
