# ENVY marketplace — plan de construcción

Plan de transformación de **Licorería Manager** (panel de inventario de una sola tienda) en **ENVY marketplace**, un marketplace de barrio para el reto 2 del hackathon de Supabase: *Identidad y datos seguros*.

> **Documento de ejecución.** El README que leerá el jurado se escribe en la fase 5. La versión anterior de ese README, que describe el inventario con proveedores y fiados, queda en el historial de git en el commit `73b6a5b`.

---

## 1. El producto en una frase

**Una vitrina pública donde varias tiendas del barrio publican su catálogo; cualquiera navega sin cuenta, y el login aparece justo cuando alguien quiere contactar con el vendedor o gestionar su tienda.**

El jurado ve el muro aparecer en el momento en que tiene sentido, no en la pantalla de bienvenida.

## 2. Cómo se cumple el reto

| Lo que pide el enunciado | Cómo se cumple |
|---|---|
| Al menos dos roles | Tres: `comprador`, `vendedor` (owner/manager de una tienda) y `platform_admin` |
| Políticas RLS **por fila** | `organizations` / catálogos: el vendedor gestiona sus tiendas, los compradores leen el catálogo publicado |
| Prueba en vivo de acceso denegado | Panel `/seguridad` con ataques reales contra el propio backend |
| Auth sirve al producto | El catálogo es anónimo; la sesión solo se exige para interactuar o administrar |
| Storage sirve al producto | Sin imagen no hay publicación, y cada tienda solo escribe en su carpeta |
| Auditoría | `audit_log` append-only: ni la clave de servicio puede reescribirlo |

### El argumento técnico más fuerte: aislamiento de datos entre tiendas

Un marketplace de barrio agrupa múltiples negocios independientes. El aislamiento estricto garantiza que una tienda no pueda modificar, ver información interna o manipular los productos de otra, asegurando la privacidad y seguridad de cada comerciante.

## 3. Modelo de datos

### Se elimina

| Objeto | Motivo |
|---|---|
| `suppliers` y su módulo | No existe en un marketplace: la tienda *es* el proveedor |
| `credit_accounts`, `credit_payments` | El fiado es de tienda de barrio, no de marketplace |
| `reservations` y su lógica | En un marketplace local no se puede reservar ya que la mayoría de productos manejan stock único o limitado de barrio |
| Vista `customer_debts` | Depende de las anteriores |
| `create_credit_sale`, `register_credit_payment` | Quedan huérfanas |

### Se crea

| Objeto | Para qué |
|---|---|
| `profiles` | El comprador no pertenece a ninguna tienda |
| `audit_log` | Append-only, con trigger que bloquea `UPDATE` y `DELETE` |
| `products.is_published` | Separa el borrador de la vitrina pública |
| Bucket `productos` | Lectura pública, escritura restringida a la carpeta propia |

### Se conserva

`organizations` (ahora son tiendas en ENVY marketplace), `organization_memberships`, `products`, `movements` y `categories`.

---

## 4. La columna vertebral de la demo: denegaciones clave

Cada una es un fallo real de Postgres, no un `if` del frontend.

| # | Ataque | Resultado esperado |
|---|---|---|
| 1 | Tienda B intenta modificar productos de Tienda A | Denegado por política RLS |
| 2 | Tienda B sube una imagen a la carpeta de Tienda A | Denegado por política de Storage |
| 3 | Alguien borra una línea del `audit_log` | Excepción del trigger, **incluso con la clave de servicio** |

Las caídas de seguridad se registran en el log de auditoría mientras el jurado evalúa.

---

## 5. Fases

| | Fase | Duración | Contenido |
|---|---|---|---|
| 1 | Migración `009_marketplace` | 45 min | Drops, tablas nuevas, RLS por fila, bucket y políticas |
| 2 | Seed de ENVY marketplace | 25 min | 4 tiendas, ~40 productos con imagen, 2 compradores |
| 3 | Backend | 35 min | Fuera proveedores, fiados y reservas; catálogo público sin auth; middleware de auditoría |
| 4 | Frontend | 40 min | Vitrina `/tienda` sin login, adaptación a ENVY marketplace, panel `/seguridad` |
| 5 | Guion y README | 20 min | Los cinco minutos cronometrados y la documentación del jurado |

**Total ≈ 2 h 45.**

### Detalle por fase

**Fase 1 — Migración**
- [ ] `DROP` de fiados, proveedores, reservas y funciones huérfanas
- [ ] `profiles`, `audit_log` con su trigger append-only
- [ ] `products.is_published`
- [ ] Política anon sobre `products` (`USING (is_published)`)
- [ ] Lectura pública de `categories` y del nombre de `organizations`
- [ ] Bucket `productos` y políticas por primer segmento del path

**Fase 2 — Seed**
- [ ] 4 tiendas con nombre visible bajo la marca **ENVY marketplace**
- [ ] ~40 productos repartidos, todos con imagen y `is_published`
- [ ] 2 compradores con perfil

**Fase 3 — Backend**
- [ ] Eliminar rutas y esquemas de proveedores, fiados y reservas
- [ ] `GET /api/catalog` y `GET /api/catalog/:id` sin autenticación
- [ ] Middleware que registra cada 401/403 y cada mutación en `audit_log`
- [ ] Reescribir el bloque de verificación en `script/verify-db.ts`

**Fase 4 — Frontend**
- [ ] Vitrina `/tienda` pública de **ENVY marketplace**, productos de todas las tiendas
- [ ] Panel `/seguridad` con las pruebas de aislamiento
- [ ] Quitar Proveedores, Fiados y Reservas del menú; añadir el interruptor "publicar"

**Fase 5 — Entrega**
- [ ] Guion de cinco minutos adaptado a ENVY marketplace
- [ ] README para el jurado

---

## 6. Recortes deliberados

**No se reconstruye el panel del vendedor.** `/inventario` ya lista productos filtrados por organización: eso *es* el panel del vendedor. Solo se quitan Proveedores, Fiados y Reservas del menú y se añade el interruptor de publicación.

**Orden de sacrificio si el reloj aprieta:** primero el seed rico (baja a 15 productos), después la denegación de Storage, y de último paneles secundarios. La vitrina pública y el aislamiento básico **no se tocan**.

**Fuera del alcance, a propósito:** pagos, carrito multi-tienda, envíos y calificaciones. No puntúan en un reto de identidad y datos seguros.

---

## 7. Guion de demo (5 minutos)

| Tiempo | Qué se muestra |
|---|---|
| 0:00–0:30 | Presentación de **ENVY marketplace**: el marketplace local del barrio. Sin diapositivas. |
| 0:30–1:30 | Vitrina pública sin sesión. Productos de cuatro tiendas distintas operando en la plataforma. |
| 1:30–2:30 | Panel de seguridad: aislamiento de datos entre tiendas rivales y permisos de Storage. |
| 2:30–3:30 | Demostración de roles (`comprador` vs `vendedor` vs `platform_admin`). |
| 3:30–5:00 | El log de auditoría inmutable (`audit_log`) registrando accesos y bloqueando borrados con claves de servicio. |

---

## 8. Credenciales

| Cuenta | Contraseña | Rol |
|---|---|---|
| `admin@envymarketplace.com` | `Secreta123` | `platform_admin` + owner de tienda principal |
| `cajero@envymarketplace.com` | `Secreta123` | `cashier` de "ENVY Tienda Norte" |

Las cuentas de comprador y las tiendas adicionales se crean en la fase 2.

---

## 9. Riesgos

**La migración es destructiva.** Borra fiados, proveedores y reservas. Solo debe correr contra el proyecto del `.env`, nunca contra bases de producción antiguas.

**Abrir el catálogo modifica la comprobación actual.** `script/verify-db.ts` dejará de exigir que todas las tablas estén cerradas herméticamente, pasando a validar que `products` expone únicamente los elementos publicados de forma pública y anónima.