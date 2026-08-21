# DEMO.md — Guion de 5 minutos

**ENVY Marketplace** — Reto 2: Identidad y datos seguros

## Preparación antes de empezar

1. Abrir el navegador en `http://localhost:8080/tienda`
2. Tener una pestaña aparte con el SQL Editor de Supabase (para mostrar la política de `cost_price` si queda tiempo)
3. Cronómetro visible

---

## 0:00–0:30 — El problema (30 s)

> "Un marketplace de barrio donde varias tiendas publican productos. La pregunta
> no es si hay login — la pregunta es: ¿puede la Tienda B ver el margen de la
> Tienda A? ¿Puede un comprador abrir el apartado de otro? Hoy lo demostramos
> en vivo."

**No tocar nada.** Solo hablar.

---

## 0:30–1:30 — Vitrina pública (60 s)

### Qué se muestra

Abrir `http://localhost:8080/tienda`. La vitrina carga **sin sesión**.

### Pasos

1. **Scroll por la grilla.** Productos de cuatro tiendas distintas: cervezas, panes, taladros, bananos. Todos con imagen y precio.
2. **Click en una tienda** (ej. "Panadería La Espiga"). Se filtran solo sus 10 productos.
3. **Quitar el filtro** ("Todas"). Vuelve la grilla completa.
4. **Escribir "cerveza"** en la búsqueda. Aparecen las dos cervezas de El Faro.
5. **Borrar la búsqueda.**

### Qué decir

> "Cuatro tiendas, cuarenta productos, todo visible sin cuenta. La imagen viene
> de Supabase Storage, subida por la tiendadueña."

---

## 1:30–2:15 — El muro de login y el apartado (45 s)

### Pasos

1. **Click en "Me interesa"** en cualquier producto (o en el botón de un producto). Aparece el formulario de login.
2. **Iniciar sesión** con `ana@demo.com` / `Secreta123`.
3. **Crear un apartado**: seleccionar cantidad, escribir una nota (ej. "Paso a recogerlo mañana"), enviar.
4. **Aparece confirmación** con el apartado creado.

### Qué decir

> "El catálogo es anónimo. La sesión aparece justo cuando alguien quiere actuar.
> El apartado se crea en la tabla `reservations` con `buyer_id = auth.uid()`:
> el servidor ignora lo que el cliente declare y usa el token."

---

## 2:15–3:30 — Panel de seguridad: los cinco ataques (75 s)

### Pasos

1. **Navegar a `/seguridad`** (desde el menú lateral).
2. **Click "Ejecutar pruebas".** Las cinco pruebas corren en vivo.

### Qué se ve (uno por uno)

| # | Prueba | Resultado esperado | Qué explicar |
|---|---|---|---|
| 1 | `cost_price oculto` | PASS: `Bloqueado: permission denied` | "El GRANT por columna bloquea `cost_price` aunque la tabla esté abierta." |
| 2 | `Tiendas aisladas` | PASS: `X apartados, todos de la misma tienda` | "RLS por fila: cada tienda solo ve las suyas." |
| 3 | `Compradores aislados` | PASS: `X apartados, todos propios` | "El comprador B no ve los del comprador A, aunque ambos compraron en la misma tienda." |
| 4 | `Storage por carpeta` | PASS: `Bloqueado: new row violates` | "La política de Storage exige que el primer segmento del path sea una tienda donde tengas membresía." |
| 5 | `audit_log inmutable` | PASS: `X entradas visibles` | "El trigger bloquea UPDATE, DELETE y TRUNCATE. Ni la clave de servicio puede borrar una línea." |

### Si el jurado pregunta

> "¿Por qué no un `if` en el frontend?"
> "Porque el `if` se salta con curl. Lo que no se salta es el motor de Postgres."

---

## 3:30–4:15 — La tienda rival (45 s)

### Pasos (si queda tiempo, hacer al menos el paso 1)

1. **Cerrar sesión** (botón "Cerrar sesión" en el menú).
2. **Iniciar sesión** con `faro@demo.com` / `Secreta123` (vendedor de El Faro).
3. **Ir a `/mis-apartados`** o `/seguridad` y ejecutar las pruebas de nuevo.
4. Verificar que El Faro solo ve sus apartados, no los de La Espiga o la Ferretería.

### Qué decir

> "El Faro ve sus tres apartados. Los de La Espiga, la Ferretería y la
> Verdulería no existen para él. Misma tabla, misma consulta, RLS filtra por
> `organization_id`."

---

## 4:15–5:00 — Auditoría y cierre (45 s)

### Pasos

1. **Ir a `/seguridad`** si no se están viendo los resultados.
2. **En la pestaña del SQL Editor** (o describir): mostrar la tabla `audit_log` con los intentos denegados.
3. **Explicar el trigger**: `audit_log_reject_mutation()` se ejecuta BEFORE UPDATE, BEFORE DELETE y BEFORE TRUNCATE.

### Qué decir

> "Cada intento fallido quedó registrado: quién, cuándo, qué intentó, y que fue
> rechazado. El registro es append-only. Ni siquiera la `service_role_key`, que
> salta RLS por diseño, puede borrar una línea."

### Cierre

> "Cinco denegaciones reales de Postgres, no cinco `if` del frontend. La base
> de datos es la que decide, y lo decide bien."

---

## Resumen para el jurado

| Capa | Qué protege |
|---|---|
| `GRANT` por columna | `cost_price` invisible a anónimos y compradores |
| RLS por fila (buyer) | Comprador B no ve apartados de comprador A |
| RLS por fila (seller) | Tienda B no ve apartados de Tienda A |
| Storage por carpeta | Tienda B no sube a la carpeta de Tienda A |
| Trigger append-only | `audit_log` inmutable, incluso con service key |

---

## Credenciales rápidas

| Cuenta | Contraseña | Rol |
|---|---|---|
| `admin@demo.com` | `Secreta123` | platform_admin |
| `ana@demo.com` | `Secreta123` | comprador |
| `faro@demo.com` | `Secreta123` | vendedor (El Faro) |
