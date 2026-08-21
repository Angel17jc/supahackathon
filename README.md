# ENVY Marketplace

Marketplace de barrio donde varias tiendas publican su catálogo, cualquiera navega sin cuenta y la sesión solo aparece cuando alguien quiere apartar un producto. Reto 2 del hackathon de Supabase: *Identidad y datos seguros*.

---

## En una frase

Una vitrina pública con aislamiento real por fila, por columna y por carpeta de Storage, demostrado con cinco ataques en vivo contra la propia base de datos.

---

## Cómo se cumple el reto

| Lo que pide el enunciado | Cómo se cumple |
|---|---|
| Al menos dos roles | Tres: `comprador`, `vendedor` (owner/manager de una tienda), `platform_admin` |
| Políticas RLS **por fila** | `reservations`: el comprador ve las suyas (`buyer_id = auth.uid()`), el vendedor ve las de sus tiendas (`is_active_organization_member(organization_id)`) |
| Prueba en vivo de acceso denegado | Panel `/seguridad` con cinco ataques reales contra la base de datos |
| Auth sirve al producto | Catálogo anónimo; la sesión se exige solo para apartar |
| Storage sirve al producto | Sin imagen no hay publicación; cada tienda solo escribe en su carpeta |
| Auditoría | `audit_log` append-only: ni la clave de servicio puede reescribirlo |

### El argumento técnico: proteger una columna

Un marketplace tiene cuatro tipos de dato ajeno a la vez:

| Dato | Quién **no** debe verlo |
|---|---|
| El margen de una tienda (`cost_price`) | Anónimos, compradores y tiendas rivales |
| Un apartado | Cualquiera salvo su comprador y la tienda dueña del producto |
| Los apartados de una tienda | Las otras tiendas |
| La carpeta de imágenes de una tienda | Las otras tiendas |

`cost_price` es el precio al que la tienda compró. Si se filtra, un rival sabe cuánto bajar para hundirla.

RLS protege filas, no columnas. Postgres protege columnas con `GRANT` por columna:

```sql
GRANT SELECT (id, name, description, selling_price, image_url, organization_id)
  ON products TO anon, authenticated;
```

Desde el navegador con la clave pública:

```js
await supabase.from('products').select('name, selling_price')  // 40 filas
await supabase.from('products').select('cost_price')           // permission denied
```

Misma tabla, misma consulta, filas sí y columna no.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite 7, Tailwind CSS 3, wouter, TanStack Query |
| Componentes | shadcn/ui sobre Radix, lucide-react |
| Backend | Express 5 sobre Node, desplegado como función serverless |
| Datos | Supabase (PostgreSQL) con Row Level Security |
| Autenticación | Supabase Auth (JWT), validado en el servidor |
| Validación | Zod, con esquemas compartidos entre cliente y servidor |
| Despliegue | Vercel — estáticos y API en el mismo proyecto |

---

## Arquitectura

El frontend y el backend se organizan por **módulo de negocio**. Cada módulo agrupa rutas, esquemas y consultas.

```
backend/
  app.ts                    Express app (servidor local y Vercel)
  auth.ts                   Autenticación y contexto de organización
  authorization.ts          Guardas por rol
  db.ts                     Cliente Supabase con clave secreta
  errors.ts                 Traducción de errores a HTTP
  storage.ts                Acceso a datos acotado a organización
  audit.ts                  Middleware y función de registro
  modules/
    marketplace/            Catálogo público, apartados, auditoría
    inventory/              Productos, movimientos, imágenes
    platform/               Administración de la plataforma

frontend/src/
  App.tsx                   Rutas y guardas de sesión
  lib/                      Cliente Supabase, sesión, HTTP
  pages/                    Login, panel, 404
  modules/marketplace/      ShopPage (vitrina), SecurityPage (ataques)
  modules/inventory/        Inventario del vendedor
  components/layout/        Barra lateral

database/
  migrations/               Migraciones numeradas
    009_marketplace.sql      Drops, tablas nuevas, RLS, Storage
    010_product_image_limits.sql  Límites de Storage

shared/
  schema.ts                 Tablas, esquemas Zod, reglas compartidas
  tenancy.ts                Tipos de rol
```

---

## Modelo de datos

### Se crea para el marketplace

| Tabla | Propósito |
|---|---|
| `profiles` | Identidad del comprador (no pertenece a ninguna tienda) |
| `reservations` | Apartados con RLS por fila: dos titulares sobre la misma fila |
| `audit_log` | Append-only con trigger que bloquea UPDATE, DELETE y TRUNCATE |

### Se conserva del inventario

`organizations` (ahora son tiendas), `organization_memberships`, `products` (con `is_published`), `movements`, `categories`.

### Se elimina

`suppliers`, `credit_accounts`, `credit_payments`, `customer_debts`, `create_credit_sale`, `register_credit_payment`.

### La tabla clave: `reservations`

```sql
CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      INTEGER NOT NULL,
  organization_id UUID    NOT NULL,
  buyer_id        UUID    NOT NULL REFERENCES auth.users(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservations_product_organization_fkey
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products(id, organization_id)
);
```

Dos políticas, dos titulares sobre la misma fila:

```sql
-- El comprador ve las suyas, de cualquier tienda.
CREATE POLICY reservations_select_buyer ON reservations
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- La tienda ve las de sus productos, de cualquier comprador.
CREATE POLICY reservations_select_seller ON reservations
  FOR SELECT TO authenticated
  USING (is_active_organization_member(organization_id));
```

---

## Las cinco denegaciones

Cada una es un fallo real de Postgres, no un `if` del frontend.

| # | Ataque | Resultado |
|---|---|---|
| 1 | Anónimo pide `cost_price` | `permission denied for table products` |
| 2 | Tienda B lee apartados de Tienda A | 0 filas |
| 3 | Comprador B abre apartado de Comprador A | 0 filas |
| 4 | Tienda B sube imagen a carpeta de Tienda A | Denegado por política de Storage |
| 5 | Alguien borra una línea del `audit_log` | Excepción del trigger, incluso con la clave de servicio |

---

## Datos de la demo

### Tiendas

| Tienda | Productos | Categorías |
|---|---|---|
| Licorería El Faro | 10 | Cervezas, Destilados, Vinos |
| Panadería La Espiga | 10 | Panes, Pastelería, Desayuno |
| Ferretería Don Luis | 10 | Herramientas, Electricidad, Pintura |
| Verdulería Sol | 10 | Frutas, Verduras, Granos |

### Credenciales

| Cuenta | Contraseña | Rol |
|---|---|---|
| `admin@demo.com` | `Secreta123` | `platform_admin` + owner de "Inventario existente" |
| `cajero@demo.com` | `Secreta123` | `cashier` de "Tienda Norte" |
| `ana@demo.com` | `Secreta123` | `comprador` |
| `diego@demo.com` | `Secreta123` | `comprador` |

Las tiendas adicionales usan sus propios correos (`faro@demo.com`, `espiga@demo.com`, etc.).

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # rellena los cuatro valores
npm run db:seed            # puebla la base con la demo
npm run dev                # http://localhost:8080
```

### Variables de entorno

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### Base de datos

En el SQL Editor de Supabase, en orden:

1. `database/schema.sql`
2. `database/migrations/009_marketplace.sql`
3. `database/migrations/010_product_image_limits.sql`

---

## Scripts

```bash
npm run dev         # Servidor de desarrollo, puerto 8080
npm run build       # Compila frontend y backend
npm start           # Build de producción
npm run check       # Comprueba tipos
npm test            # Ejecuta los tests
npm run db:seed     # Puebla la base con datos de demo
npm run db:prove    # Ejecuta las 15 pruebas de aislamiento contra la BD real
```

---

## API

### Públicas (sin autenticación)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/catalog` | Productos publicados (filtro por tienda y búsqueda) |
| GET | `/api/catalog/shops` | Lista de tiendas activas con conteo de productos |
| GET | `/api/catalog/:id` | Producto individual |

### Con autenticación

| Método | Ruta | Rol mínimo |
|---|---|---|
| GET | `/api/reservations` | Comprador o vendedor (RLS decide qué ve) |
| POST | `/api/reservations` | Comprador autenticado |
| PATCH | `/api/reservations/:id` | Comprador (solo cancelar) o vendedor |
| GET | `/api/audit` | Vendedor o platform_admin |

### Gestión de inventario

| Método | Ruta | Rol mínimo |
|---|---|---|
| GET | `/api/products` | Miembro |
| POST, PUT, DELETE | `/api/products` | Encargado |
| POST | `/api/products/:id/image` | Encargado |

---

## Documentación adicional

| Archivo | Contenido |
|---|---|
| `DEMO.md` | Guion de 5 minutos para la demo |
| `PLAN_MARKETPLACE.md` | Plan de construcción completo |
| `MIGRACION_HACKATHON.md` | Puesta en marcha sobre una base nueva |

---

## Licencia

MIT
