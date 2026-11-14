# AlertaCiudadana – Sistema web de alertas (MININTER / PNP)
Proyecto universitario (IHC, Grupo 6). Sistema web responsive para que ciudadanos con cuenta verificada envíen alertas policiales en 3 toques.

## Stack (no cambiar sin preguntar)
- React 18 + Vite + TypeScript, React Router 6, CSS propio con tokens (src/styles/tokens.css)
- Supabase: Auth, PostgreSQL + PostGIS, RLS, Realtime, Storage, Edge Functions
- Leaflet + OpenStreetMap, face-api.js (navegador), PWA con vite-plugin-pwa
- Despliegue: GitHub + Vercel. Variables: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

## Base de datos
Ya creada en Supabase. Esquema en supabase/migrations/20261109000000_esquema_inicial.sql (no modificar
lo ya ejecutado; cambios = nueva migración). Tipos en src/types/database.types.ts.
- El código INC-AAAA-NNNNNN lo genera un trigger; el historial y las notificaciones también.
- Solo cuentas con estado_verificacion = 'verificada' pueden crear alertas (RLS).
- rol y estado_verificacion solo los cambia la Edge Function verificar-identidad (service_role).

## Estructura
src/features/<módulo> por pantalla, src/components/{ui,layout,map}, src/lib, src/hooks.
Rutas: públicas (/, /ingresar, /recuperar, /registro), ciudadano (/app/...), central (/central/...).

## Diseño
- Sistema: tema oscuro de la guía 8.2 (BG #0F2027, SURF #18303B, TEXT #F1F5F9, MUTED #A9BAC3,
  LINK #8FD3FF). Rojo #E63946 SOLO para SOS; verde #2A9D8F SOLO para la confirmación final. Roboto.
- Landing: conserva su estilo propio (azul #0b3a6e, rojo #c8102e, Plus Jakarta Sans, Bootstrap 5).
- Mockups de referencia en referencias/mockups (E = escritorio, C = celular).
- Accesibilidad WCAG 2.1 AA: áreas táctiles de 48 px o más, etiquetas visibles, foco visible.

## Plan
1. Proyecto base ✅  2. Landing en React ✅  3. Login + registro verificado (RF-16) + Edge Functions ✅
4. Flujo SOS + estado en tiempo real ✅  5. Evidencias, historial, notificaciones, perfil, voz, sin conexión
6. Panel central 105 ✅  7. Despliegue en Vercel

## Reglas
- Responde en español. Trabaja un paso a la vez y muéstrame cómo probarlo antes de seguir.
- Nunca pongas la secret key de Supabase en el frontend.
- Antes de terminar: npm run build sin errores.