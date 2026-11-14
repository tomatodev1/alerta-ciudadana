# AlertaCiudadana · Sistema web de alertas (MININTER / PNP)

React + Vite + TypeScript · Supabase · desplegado en Vercel.

## Requisitos
- Node.js 20 o superior

## Puesta en marcha
```bash
npm install
npm run dev        # http://localhost:5173
```
Las claves de Supabase están en `.env.local` (no se sube a GitHub). Usa `.env.example` como modelo.

## Scripts
| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila para producción (`dist/`) |
| `npm run preview` | Prueba la versión compilada |

## Base de datos
- `supabase/migrations/` – esquema, RLS, triggers y Storage (ejecutar en orden en el SQL Editor)
- `supabase/seed.sql` – datos de prueba

## Edge Functions (registro verificado, RF-16)
| Función | Uso | Sesión |
|---|---|---|
| `validar-dni` | Paso 1: valida el DNI (padrón de demostración que simula RENIEC) | No |
| `ingresar-dni` | Login con DNI (resuelve el correo en el servidor) | No |
| `confirmar-celular` | Paso 2: código de 6 dígitos (SMS simulado, se muestra en pantalla) | Sí |
| `verificar-identidad` | Pasos 3–4: registra la verificación y cambia `estado_verificacion` | Sí |

Todas validan la sesión por dentro, así que se despliegan con `--no-verify-jwt`
(las claves `sb_publishable_…` no son JWT):
```bash
npx supabase login
npx supabase functions deploy validar-dni         --no-verify-jwt --remote=<REF>
npx supabase functions deploy ingresar-dni        --no-verify-jwt --remote=<REF>
npx supabase functions deploy confirmar-celular   --no-verify-jwt --remote=<REF>
npx supabase functions deploy verificar-identidad --no-verify-jwt --remote=<REF>
```
`<REF>` es el identificador del proyecto (lo que va antes de `.supabase.co`).
El aviso "Docker is not running" es normal: sin Docker la CLI sube el código directamente.
Las funciones usan `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta solo en el servidor.

DNIs del padrón de demostración (cualquier otro DNI de 8 dígitos también se acepta escribiendo los nombres):

| DNI | Fecha de emisión | Nombres |
|---|---|---|
| 12345678 | 14/03/2019 | JUAN CARLOS PÉREZ RAMOS |
| 87654321 | 02/07/2021 | MARÍA ELENA QUISPE HUAMÁN |
| 45678912 | 20/05/2017 | ROSA TORRES VILLANUEVA |

Configuración en Supabase → Authentication:
- *Sign In / Providers → Email*: desactivar **Confirm email**.
- *URL Configuration → Redirect URLs*: agregar `http://localhost:5173/recuperar` (y la URL de Vercel + `/recuperar`).

Los modelos de face-api.js están en `public/modelos` (~7 MB) y solo se descargan en la verificación facial.

## Panel de la Central 105 (`/central`)
1. Ejecuta la migración `20261113000000_central_105.sql` en el SQL Editor.
2. En Supabase → *Authentication → Users → Add user → Create new user*: correo `central105@demo.pe`,
   una contraseña y marca **Auto Confirm User**.
3. Dale el rol de operador (SQL Editor):
   ```sql
   insert into public.perfiles (id, dni, nombres, apellidos, celular, correo, rol, estado_verificacion, verificado_en)
   select id, '00000105', 'Central', '105', '105', email, 'operador', 'verificada', now()
   from auth.users where email = 'central105@demo.pe';
   ```
4. Ingresa con ese correo: el sistema lleva a los operadores a `/central`.

Las alertas pasan a "Recibida" solas cuando aparecen en la bandeja de un operador conectado.
Si nadie las recibe en 2 minutos, el ciudadano ve un aviso para llamar al 105.

## Despliegue en Vercel
1. Sube el repositorio a GitHub.
2. En Vercel: *Add New → Project* e importa el repositorio (Vite se detecta solo).
3. En *Environment Variables* agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. En Supabase → Authentication → URL Configuration agrega la URL de Vercel como *Site URL*.
