# Vitrina Local — plan de construcción

Plan de transformación de **Licorería Manager** (panel de inventario de una sola
tienda) en **Vitrina Local**, un marketplace de barrio, para el reto 2 del
hackathon de Supabase: *Identidad y datos seguros*.

> **Documento de ejecución.** El README que leerá el jurado se escribe en la
> fase 5. La versión anterior de ese README, que describe el inventario con
> proveedores y fiados, queda en el historial de git en el commit `73b6a5b`.

---

## 1. El producto en una frase

**Una vitrina pública donde varias tiendas del barrio publican su catálogo;
cualquiera navega sin cuenta, y el login aparece justo cuando alguien quiere
apartar un producto.**

Ese *justo cuando* es lo que convierte a Auth en parte del producto en lugar de
un portero decorativo. El jurado ve el muro aparecer en el momento en que tiene
sentido, no en la pantalla de bienvenida.

## 2. Cómo se cumple el reto

| Lo que pide el enunciado | Cómo se cumple |
|---|---|
| Al menos dos roles | Tres: `comprador`, `vendedor` (owner/manager de una tienda) y `platform_admin` |
| Políticas RLS **por fila** | `reservations`: el comprador ve `buyer_id = auth.uid()`, el vendedor ve las de sus tiendas |
| Prueba en vivo de acceso denegado | Panel `/seguridad` con cinco ataques reales contra el propio backend |
| Auth sirve al producto | El catálogo es anónimo; la sesión solo se exige para apartar |
| Storage sirve al producto | Sin imagen no hay publicación, y cada tienda solo escribe en su carpeta |
| Auditoría | `audit_log` append-only: ni la clave de servicio puede reescribirlo |

### El argumento técnico más fuerte: proteger una columna

Un marketplace tiene cuatro tipos de dato ajeno a la vez:

| Dato | Quién **no** debe verlo |
|---|---|
| El margen de una tienda (`cost_price`) | Anónimos, compradores y **tiendas rivales** |
| Un apartado | Cualquiera salvo su comprador y la tienda dueña del producto |
| Los apartados de una tienda | Las otras tiendas |
| La carpeta de imágenes de una tienda | Las otras tiendas |

El de `cost_price` es el que merece explicación en voz alta: es el precio al que
la tienda compró. Si se filtra, un rival sabe exactamente cuánto bajar para
hundirla.

**RLS protege filas, no columnas.** Postgres sí protege columnas, con un
mecanismo que casi nadie usa:

```sql
GRANT SELECT (id, name, description, selling_price, image_url, organization_id)
  ON products TO anon, authenticated;
```

En vivo, desde la consola del navegador con la clave pública:

```js
await supabase.from('products').select('name, selling_price')  // 40 filas
await supabase.from('products').select('cost_price')           // permission denied for column cost_price
```

Misma tabla, misma consulta, filas sí y columna no.

## 3. Modelo de datos

### Se elimina

| Objeto | Motivo |
|---|---|
| `suppliers` y su módulo | No existe en un marketplace: la tienda *es* el proveedor |
| `credit_accounts`, `credit_payments` | El fiado es de tienda de barrio, no de marketplace |
| Vista `customer_debts` | Depende de las anteriores |
| `create_credit_sale`, `register_credit_payment` | Quedan huérfanas |

### Se crea

| Objeto | Para qué |
|---|---|
| `profiles` | El comprador no pertenece a ninguna tienda; el modelo actual asume que todo usuario es miembro de una organización |
| `reservations` | El RLS por fila de verdad: dos titulares distintos sobre la misma fila |
| `audit_log` | Append-only, con trigger que bloquea `UPDATE` y `DELETE` |
| `products.is_published` | Separa el borrador de la vitrina pública |
| Bucket `productos` | Lectura pública, escritura restringida a la carpeta propia |

### Se conserva

`organizations` (ahora son tiendas), `organization_memberships`, `products`,
`movements` (el stock baja al confirmar un apartado) y `categories`.

### La tabla que sostiene la demo

```sql
CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      INTEGER NOT NULL,
  organization_id UUID    NOT NULL,   -- la tienda dueña del producto
  buyer_id        UUID    NOT NULL REFERENCES auth.users(id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Dos políticas, dos titulares sobre la misma fila:

```sql
-- El comprador ve las suyas, sin importar de qué tienda sean.
CREATE POLICY reservations_select_buyer ON reservations
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- La tienda ve las de sus productos, sin importar quién las hizo.
CREATE POLICY reservations_select_seller ON reservations
  FOR SELECT TO authenticated
  USING (is_active_organization_member(organization_id));
```

Ninguna de las dos ve la fila completa del otro lado, y nadie fuera de esas dos
condiciones ve nada. Eso es una política por fila, no por tenant.

## 4. La columna vertebral de la demo: cinco denegaciones

Cada una es un fallo real de Postgres, no un `if` del frontend.

| # | Ataque | Resultado esperado |
|---|---|---|
| 1 | Anónimo pide `cost_price` | `permission denied for column cost_price` |
| 2 | Tienda B lee los apartados de Tienda A | 0 filas |
| 3 | Comprador B abre el apartado de Comprador A | 0 filas |
| 4 | Tienda B sube una imagen a la carpeta de Tienda A | Denegado por política de Storage |
| 5 | Alguien borra una línea del `audit_log` | Excepción del trigger, **incluso con la clave de servicio** |

Las cinco caen en el log de auditoría mientras el jurado mira.

## 5. Fases

| | Fase | Duración | Contenido |
|---|---|---|---|
| 1 | Migración `009_marketplace` | 50 min | Drops, tablas nuevas, RLS por fila, grants por columna, bucket y políticas |
| 2 | Seed de marketplace | 25 min | 4 tiendas, ~40 productos con imagen, 2 compradores, apartados de ejemplo |
| 3 | Backend | 40 min | Fuera proveedores y fiados; catálogo público sin auth; apartados; middleware de auditoría |
| 4 | Frontend | 45 min | Vitrina `/tienda` sin login, muro al apartar, `/mis-apartados`, panel `/seguridad` |
| 5 | Guion y README | 20 min | Los cinco minutos cronometrados y la documentación del jurado |

**Total ≈ 3 h 00.**

### Detalle por fase

**Fase 1 — Migración**
- [ ] `DROP` de fiados, proveedores, vista y funciones huérfanas
- [ ] `profiles`, `reservations`, `audit_log` con su trigger append-only
- [ ] `products.is_published`
- [ ] Política anon sobre `products` (`USING (is_published)`) y `GRANT` por columna
- [ ] Políticas de `reservations` (comprador y vendedor)
- [ ] Lectura pública de `categories` y del nombre de `organizations`
- [ ] Bucket `productos` y políticas por primer segmento del path

**Fase 2 — Seed**
- [ ] 4 tiendas con nombre visible
- [ ] ~40 productos repartidos, todos con imagen y `is_published`
- [ ] 2 compradores con perfil
- [ ] Apartados cruzados que hagan visible el aislamiento

**Fase 3 — Backend**
- [ ] Eliminar rutas y esquemas de proveedores y fiados
- [ ] `GET /api/catalog` y `GET /api/catalog/:id` sin autenticación
- [ ] `POST /api/reservations` con sesión obligatoria
- [ ] `GET /api/reservations` con respuesta según rol
- [ ] Middleware que registra cada 401/403 y cada mutación en `audit_log`
- [ ] Reescribir el bloque 4 de `script/verify-db.ts`

**Fase 4 — Frontend**
- [ ] Vitrina `/tienda` pública, productos de todas las tiendas
- [ ] Ficha de producto con el muro de login al pulsar "Me interesa"
- [ ] `/mis-apartados` para el comprador
- [ ] Panel `/seguridad` con los cinco ataques
- [ ] Quitar Proveedores y Fiados del menú; añadir el interruptor "publicar"

**Fase 5 — Entrega**
- [ ] Guion de cinco minutos
- [ ] README para el jurado

## 6. Recortes deliberados

**No se reconstruye el panel del vendedor.** `/inventario` ya lista productos
filtrados por organización: eso *es* el panel del vendedor. Solo se quitan
Proveedores y Fiados del menú y se añade el interruptor de publicación. Ahorra
unos 40 minutos y no le resta nada a la demo.

**Orden de sacrificio si el reloj aprieta:** primero el seed rico (baja a 15
productos), después la denegación de Storage (la número 4), y de último
`/mis-apartados`. Las denegaciones 1, 2, 3 y 5 y la vitrina pública **no se
tocan**: sin ellas no hay entrega.

**Fuera del alcance, a propósito:** pagos, carrito multi-tienda, envíos y
calificaciones. No puntúan en un reto de identidad y datos seguros. Dicho en la
demo — *"el foco de hoy fue que ninguna tienda vea el margen de otra"* — suena
mejor que un checkout a medias.

**Si sobrara tiempo,** el mejor añadido sería un bucket privado para
comprobantes de pago adjuntos a un apartado, visibles solo para ese comprador y
esa tienda. Es la demostración más pura de Storage con alcance por fila.

## 7. Guion de demo (5 minutos)

| Tiempo | Qué se muestra |
|---|---|
| 0:00–0:30 | El problema en una frase. Sin diapositivas. |
| 0:30–1:30 | Vitrina pública sin sesión. Productos de cuatro tiendas distintas. |
| 1:30–2:15 | "Me interesa" → aparece el muro de login → apartado creado. |
| 2:15–3:30 | Panel de seguridad: los cinco ataques, los cinco fallos. |
| 3:30–4:15 | La tienda rival intenta leer el apartado y el margen. Nada. |
| 4:15–5:00 | El log de auditoría con los intentos, y el intento de borrarlo fallando. |

## 8. Credenciales

| Cuenta | Contraseña | Rol |
|---|---|---|
| `admin@demo.com` | `Secreta123` | `platform_admin` + owner de "Inventario existente" |
| `cajero@demo.com` | `Secreta123` | `cashier` de "Tienda Norte" |

Las cuentas de comprador y las tiendas adicionales se crean en la fase 2.

## 9. Riesgos

**El presupuesto de tiempo no tiene colchón.** Tres horas de plan para tres
horas de reloj. El orden de sacrificio de la sección 6 no es opcional: hay que
aplicarlo en cuanto una fase se pase diez minutos de lo previsto.

**La migración es destructiva.** Borra fiados y proveedores. Solo debe correr
contra el proyecto del `.env` (`lhgvvionctkabjxuhtbw`), nunca contra la base de
la aplicación de inventario en producción.

**Abrir el catálogo invalida la comprobación actual.** `script/verify-db.ts`
exige hoy que las ocho tablas devuelvan cero filas con la clave pública. Con
catálogo público, `products` devolverá filas a propósito. El bloque 4 pasa de
"todo cerrado" a "exactamente lo que debe estar abierto, y `cost_price` nunca".
