# Despliegue de Vitrina Local

Pasos para publicar el proyecto en Vercel contra el proyecto de Supabase del
hackathon. Pensado para que otra persona pueda ejecutarlos sin contexto previo.

> **Estado al escribir esto:** la base de datos, la API y Storage están
> terminados y probados. La vitrina pública (`/tienda`) y el panel `/seguridad`
> son la fase 4 y **todavía no existen**: al desplegar hoy, la interfaz sigue
> siendo el panel de la tienda. La API pública ya responde y se puede comprobar
> con `curl`.

---

## 1. Antes de empezar

Comprueba que la base está lista. Desde la raíz del proyecto, con el `.env`
apuntando al proyecto de Supabase correcto:

```bash
npm install
npm run db:verify   # esquema, privilegios y cuentas
npm run db:prove    # 15 comprobaciones de acceso denegado
npm test            # 19 pruebas unitarias
npm run check       # TypeScript
npx vite build      # build del navegador
```

Los cinco tienen que pasar antes de desplegar. Si `db:prove` falla, no despliegues:
significa que algo de RLS dejó de proteger lo que decía proteger.

Las migraciones `001` a `010` deben estar aplicadas en el SQL Editor de Supabase.
Para una base nueva desde cero: `database/bootstrap.sql`, luego
`009_marketplace.sql`, luego `010_product_image_limits.sql`.

## 2. Variables de entorno en Vercel

**Settings → Environment Variables**, las cinco en *Production* y *Preview*:

| Variable | Valor | Ámbito |
|---|---|---|
| `NODE_ENV` | `production` | Servidor |
| `SUPABASE_URL` | `https://<proyecto>.supabase.co` | Servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | **Solo servidor** |
| `VITE_SUPABASE_URL` | `https://<proyecto>.supabase.co` | Navegador |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` | Navegador |

Tres cosas que se rompen aquí y cuestan media hora encontrar:

- **La URL va sin sufijo.** `https://<proyecto>.supabase.co`, nunca terminada en
  `/rest/v1`. Con el sufijo, cada petición sale duplicada y Supabase responde
  `Invalid path specified in request URL`.
- **La clave secreta jamás en una variable `VITE_*`.** Vite las incrusta en el
  bundle del navegador. El build está preparado para abortar si detecta una
  `sb_secret_` ahí, pero no confíes en la red de seguridad.
- **Las cuatro claves, no dos.** Sin las `VITE_*` el servidor arranca sin
  quejarse y el navegador no puede iniciar sesión.

## 3. Importar el repositorio

**Add New → Project → Import** desde `Angel17jc/supahackathon`.

No cambies nada en la pantalla de configuración: `vercel.json` ya declara el
comando de build (`vite build`), el directorio de salida (`dist/public`), las
reescrituras que mandan `/api/*` a la función serverless y las cabeceras de
seguridad. Deja *Framework Preset* en **Other**.

## 4. Configurar Auth con el dominio de producción

**Este paso se olvida siempre.** En el panel de Supabase, **Authentication → URL
Configuration**:

- **Site URL**: `https://<tu-dominio>.vercel.app`
- **Redirect URLs**: añade `https://<tu-dominio>.vercel.app/**`

Sin esto, los enlaces de recuperación de contraseña apuntan a `localhost` y el
inicio de sesión funciona en tu máquina pero no en producción.

## 5. Comprobar el despliegue

```bash
DOMINIO=https://<tu-dominio>.vercel.app

curl -s $DOMINIO/api/health
curl -s $DOMINIO/api/health/database
curl -s $DOMINIO/api/catalog/shops          # 4 tiendas, sin sesión
curl -s $DOMINIO/api/catalog | head -c 300  # 40 productos, sin sesión
curl -s $DOMINIO/api/reservations           # 401, así debe ser
```

La cuarta comprobación es la importante: el catálogo tiene que responder **sin
ninguna cabecera de autorización**, y en su respuesta **no puede aparecer
`cost_price`** por ninguna parte.

Después, abre la aplicación e inicia sesión con `faro@demo.com` / `Secreta123`.
Si las portadas de los productos se ven rotas, la causa está en la sección 7.

## 6. Cuentas de la demo

Todas usan la contraseña `Secreta123`:

| Cuenta | Rol |
|---|---|
| `faro@demo.com` | Dueño de Licorería El Faro |
| `espiga@demo.com` | Dueño de Panadería La Espiga |
| `donluis@demo.com` | Dueño de Ferretería Don Luis |
| `sol@demo.com` | Dueño de Verdulería Sol |
| `ana@demo.com` · `diego@demo.com` | Compradores |
| `admin@demo.com` | Administrador de plataforma |

Para recrearlas: `npm run db:seed` (vacía el catálogo y lo vuelve a sembrar).

## 7. Lo que ya se rompió una vez

**Las portadas no cargan en producción.** La cabecera `Content-Security-Policy`
de `vercel.json` limita de dónde se pueden traer imágenes. Las portadas viven en
Supabase Storage, así que `img-src` tiene que incluir `https://*.supabase.co`. Ya
está corregido; si alguien toca esa cabecera, es lo primero que hay que revisar.

**La subida de portadas falla.** Va directa del navegador a Storage, así que
`connect-src` necesita `https://*.supabase.co`. También está ya en `vercel.json`.

**La función `/api` devuelve 500 sin explicación.** `api/index.ts` importa el
backend de forma perezosa precisamente para que la causa llegue a los logs.
Míralos en **Vercel → Deployments → Functions**; casi siempre es una variable de
entorno que falta.

**El proyecto de Supabase se pausa.** El plan Free pausa proyectos inactivos y la
demo se cae. El workflow `.github/workflows/supabase-keepalive.yml` lo consulta a
diario; necesita los secretos `SUPABASE_URL` y `SUPABASE_ANON_KEY` en
**GitHub → Settings → Secrets and variables → Actions**. Usa la clave
**publicable**, nunca la secreta.

## 8. Si hay que revocar una clave

Las claves nuevas de Supabase (`sb_secret_` / `sb_publishable_`) son
independientes del JWT secret: revocar una **no** cierra las sesiones abiertas de
los usuarios. Si la secreta se filtra, revócala en **Project Settings → API
Keys**, actualiza la variable en Vercel y vuelve a desplegar.
