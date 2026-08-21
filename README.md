# Licorería Manager

Sistema de gestión de inventario y fiados para licorerías, multi-empresa y desplegado como una sola aplicación en Vercel.

Cada negocio (organización) ve únicamente sus propios datos. Un administrador de plataforma da de alta las empresas y sus usuarios; dentro de cada empresa los permisos se reparten entre propietario, encargado y cajero.

---

## Qué hace

- **Inventario** — productos con costo, precio de venta, categoría, proveedor y nivel mínimo de stock, con alertas cuando algo baja del mínimo.
- **Movimientos** — entradas, salidas y ajustes. Cada movimiento ajusta el stock y queda registrado con su motivo y su fecha.
- **Fiados** — cuentas de crédito por cliente. Cada abono descuenta del saldo y la cuenta pasa a `partial` o `paid` sola.
- **Catálogo** — categorías y proveedores, propios de cada empresa.
- **Panel** — total de productos, valor del inventario, alertas de stock bajo y actividad de los últimos 7 días.
- **Clientes** — alta de empresas y usuarios, reservado al administrador de plataforma.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite 7, Tailwind CSS 3, wouter, TanStack Query |
| Componentes | shadcn/ui sobre Radix, lucide-react, Recharts |
| Backend | Express 5 sobre Node, desplegado como función serverless |
| Datos | Supabase (PostgreSQL) con Row Level Security |
| Autenticación | Supabase Auth (JWT), validado en el servidor |
| Validación | Zod, con esquemas compartidos entre cliente y servidor |
| Despliegue | Vercel — estáticos y API en el mismo proyecto |
| CI/CD | GitHub Actions |

---

## Arquitectura

El frontend y el backend se organizan por **módulo de negocio**, no por tipo de archivo. Cada módulo agrupa lo suyo: rutas, esquemas y consultas.

```
api/
  index.ts                  Punto de entrada serverless en Vercel

backend/
  app.ts                    Construye la app Express (compartida por el servidor local y Vercel)
  index.ts                  Servidor local con Vite en desarrollo
  auth.ts                   Autenticación y contexto de organización
  authorization.ts          Guardas por rol
  db.ts                     Cliente Supabase con la clave secreta
  errors.ts                 Traducción de errores a respuestas HTTP
  storage.ts                Acceso a datos, siempre acotado a una organización
  platform-service.ts       Alta de empresas y usuarios
  modules/
    catalog/                Categorías y proveedores
    credits/                Fiados
    inventory/              Productos y movimientos
    platform/               Administración de la plataforma

frontend/src/
  App.tsx                   Rutas y guardas de sesión
  lib/                      Cliente Supabase, sesión, cliente HTTP
  pages/                    Login (landing), nueva contraseña, panel, 404
  modules/                  Una carpeta por módulo, con su página y sus consultas
  components/ui/            Componentes de interfaz
  components/layout/        Barra lateral

shared/
  schema.ts                 Tablas, esquemas Zod y reglas compartidas
  routes.ts                 Contrato de la API
  tenancy.ts                Tipos de rol

database/
  schema.sql                Tablas base
  credits.sql               Tablas de fiados
  migrations/               Migraciones numeradas, se aplican en orden
```

### Un solo despliegue

Vercel sirve el frontend compilado como estáticos y ejecuta la misma app Express como función serverless en `/api/*`. No hace falta alojar el backend aparte.

Dos detalles que conviene conocer antes de tocar el backend:

- Vercel ejecuta la función con el **resolvedor ESM nativo de Node**. Todo import relativo necesita extensión `.js` y los alias de `tsconfig` no se resuelven. El CI falla si aparece un import relativo sin extensión.
- Las variables `VITE_*` se **incrustan en el bundle del navegador** al compilar. El build aborta si `VITE_SUPABASE_ANON_KEY` contiene una clave secreta.

---

## Seguridad

El modelo parte de una idea: **el navegador no toca la base de datos**. El bundle solo usa Supabase para autenticarse; cualquier lectura o escritura pasa por la API de Express, que valida el token, resuelve la organización y aplica el rol.

**Aislamiento entre empresas.** Cada tabla lleva `organization_id`. `storage.ts` acota todas las consultas a la organización del contexto, y claves foráneas compuestas `(id, organization_id)` impiden a nivel de base de datos que una fila apunte a otra de una empresa distinta.

**Row Level Security.** Activo en las nueve tablas y vistas. Los privilegios de tabla están revocados para `anon` y `authenticated`, así que la clave publicable no puede leer nada aunque quede expuesta — que es su naturaleza, va dentro del bundle.

**Autenticación.** El token se valida en el servidor contra Supabase en cada petición. La pertenencia a la organización se comprueba en la base de datos, nunca a partir de un claim del token. Una organización suspendida queda sin acceso a la API.

**Roles.**

| Rol | Puede |
|---|---|
| `platform_admin` | Todo, en cualquier empresa |
| `owner` / `manager` | Leer y escribir productos, categorías, proveedores, movimientos y fiados |
| `cashier` | Leer, registrar movimientos y cobrar fiados |

**Operaciones atómicas.** Crear un movimiento, vender fiado y registrar un abono se ejecutan en funciones PostgreSQL con bloqueo de fila, así que dos cajas simultáneas no pueden dejar el stock inconsistente. Esas funciones solo son ejecutables por el rol de servicio.

**Sesiones.** Viven en `sessionStorage`: se cierran al cerrar la pestaña y tras 30 minutos sin actividad. La caja suele ser una máquina compartida.

**Respuestas y registros.** Los errores internos no se devuelven al cliente. Los registros contienen la línea de la petición, nunca el cuerpo de la respuesta. Las respuestas de la API llevan `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Cache-Control: no-store`; el HTML añade una Content Security Policy desde `vercel.json`.

**Claves.** `SUPABASE_SERVICE_ROLE_KEY` es una clave secreta (`sb_secret_…`) y solo existe en el servidor. `VITE_SUPABASE_ANON_KEY` es publicable (`sb_publishable_…`) y es pública por diseño.

---

## Puesta en marcha

Necesitas Node 20 o superior y un proyecto de Supabase.

```bash
npm install
cp .env.example .env      # y rellena los cuatro valores
npm run dev               # http://localhost:5000
```

### Variables de entorno

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...        # solo servidor
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...      # va al navegador
```

Las encuentras en Supabase → Settings → API Keys.

### Base de datos

En el SQL Editor de Supabase, en este orden:

1. `database/schema.sql`
2. `database/credits.sql`
3. `database/migrations/001` … `007`, por número

Las migraciones asumen la anterior aplicada. Haz copia de seguridad antes de las que mueven datos.

### Autenticación en Supabase

En **Authentication → URL Configuration**:

- **Site URL** — la URL de tu despliegue
- **Redirect URLs** — esa misma URL con `/**`

Sin esto, el enlace de recuperación de contraseña lleva al sitio equivocado y Supabase **no avisa**: acepta el `redirect_to` y cae en silencio al Site URL.

El servicio de correo integrado de Supabase está limitado a unos pocos envíos por hora y es para pruebas. Para producción, configura SMTP propio en **Authentication → SMTP Settings**.

---

## Scripts

```bash
npm run dev       # Servidor de desarrollo con Vite, puerto 5000
npm run build     # Compila frontend y backend a dist/
npm start         # Ejecuta el build de producción
npm run check     # Comprueba tipos
npm test          # Ejecuta los tests
npm run db:push   # Sincroniza el esquema con Drizzle
```

---

## API

Todas las rutas bajo `/api` exigen `Authorization: Bearer <token>`, salvo las de salud. Las que operan sobre datos de una empresa exigen además la cabecera `X-Organization-Id`.

| Método | Ruta | Rol mínimo |
|---|---|---|
| GET | `/api/health`, `/api/health/database` | público |
| GET | `/api/organizations/me` | autenticado |
| POST | `/api/account/password` | autenticado |
| GET | `/api/products`, `/api/products/:id` | miembro |
| POST, PUT, DELETE | `/api/products`, `/api/products/:id` | encargado |
| GET | `/api/movements` | miembro |
| POST | `/api/movements` | cajero |
| GET | `/api/categories`, `/api/suppliers` (y `/:id`) | miembro |
| POST, PUT, DELETE | `/api/categories`, `/api/suppliers` | encargado |
| GET | `/api/credits`, `/api/credits/stats`, `/api/credits/customer/:nombre` | miembro |
| POST | `/api/credits`, `/api/credits/payment` | cajero |
| GET | `/api/stats` | miembro |
| — | `/api/platform/*` | administrador de plataforma |

---

## Despliegue

El proyecto está configurado para Vercel mediante `vercel.json`:

- **Build** `vite build` · **Salida** `dist/public` · **Framework** Other
- `/api/*` se reescribe a la función serverless; el resto sirve el SPA

Configura las cuatro variables de entorno en el proyecto de Vercel **antes** del primer build: las `VITE_*` se incrustan al compilar, no se leen en tiempo de ejecución.

### Integración continua

`.github/workflows/ci-cd.yml` ejecuta en cada push y cada pull request: instalación, comprobación de tipos, tests y build. Además falla si:

- la hoja de estilos generada baja de 20 kB, señal de que Tailwind no encuentra los archivos fuente;
- aparece un import relativo sin extensión `.js`, que rompería la función en Vercel.

Los tres guards nacieron de fallos reales que pasaban tipos, tests y build sin quejarse y solo se manifestaban en producción.

El job de despliegue está inactivo salvo que definas la variable de repositorio `DEPLOY_VIA_ACTIONS` a `true`. Por defecto despliega la integración de Git de Vercel; activar ambos duplicaría los despliegues.

`.github/workflows/supabase-keepalive.yml` llama a diario al endpoint de salud para que el proyecto de Supabase no se pause por inactividad. Usa la variable `APP_URL` y no necesita credenciales.

---

## Documentación adicional

| Archivo | Contenido |
|---|---|
| `MODULAR_ARCHITECTURE.md` | Límites entre módulos |
| `SAAS_ARCHITECTURE.md` | Modelo multi-empresa |
| `SUPABASE_SETUP.md` | Configuración de Supabase paso a paso |
| `SCHEMAS.md` | Esquemas de datos |
| `AUTH_SETUP.md` | Autenticación y roles |
| `FIADOS_SETUP.md` | Sistema de fiados |
| `DEPLOYMENT.md` | Notas de despliegue |
| `TESTING.md` | Estrategia de pruebas |

---

## Licencia

MIT
