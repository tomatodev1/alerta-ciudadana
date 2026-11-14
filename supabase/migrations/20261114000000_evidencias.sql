-- =====================================================================
-- Paso 5b · Evidencias multimedia (RF-06, RNF-05)
-- =====================================================================

-- El bucket de evidencias solo acepta fotos, videos y audios (máx. 50 MB, ya definido).
update storage.buckets
set allowed_mime_types = array['image/*', 'video/*', 'audio/*']
where id = 'evidencias';

-- Las fotos de verificación son siempre JPEG.
update storage.buckets
set allowed_mime_types = array['image/jpeg']
where id = 'verificacion';

-- La central (y el ciudadano en su pantalla de estado) reciben las evidencias en tiempo real.
alter publication supabase_realtime add table public.evidencias;
