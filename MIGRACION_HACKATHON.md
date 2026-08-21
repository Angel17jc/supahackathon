# Migración a la base de datos del hackathon

Guía para apuntar esta copia del proyecto a un proyecto **nuevo** de Supabase, sin
tocar la base de datos de la aplicación de inventario que ya está en producción.

La separación es total: este repositorio es una copia independiente y lee su
configuración de su propio `.env`. Mientras no escribas las claves antiguas en
ese archivo, la base original no recibe ninguna conexión desde aquí.

---

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear el archivo `.env`

En la raíz del proyecto, junto a `package.json`:

```env
# Solo servidor. Supabase la llama "secret key" (sb_secret_...).
# Salta RLS por completo: nunca debe aparecer en una variable VITE_*.
SUPABASE_URL=https://TU-PROYECTO-NUEVO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# Navegador. Supabase la llama "publishable key" (sb_publishable_...).
# Se incorpora al bundle a propósito; RLS es lo que la vuelve inofensiva.
VITE_SUPABASE_URL=https://TU-PROYECTO-NUEVO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Dónde encontrarlas: **Project Settings → API Keys** en el panel de Supabase.
`.env` ya está en `.gitignore`, así que no se sube al repositorio.

Las **cuatro** variables son obligatorias. Sin las dos `VITE_*` el servidor
Express arranca igual y todo parece correcto, pero el navegador no puede iniciar
sesión: el cliente de Supabase del frontend se construye con ellas.

La URL va **sin sufijo**: `https://<proyecto>.supabase.co`. El panel la muestra
en algunas vistas como `.../rest/v1/`, y con esa ruta incluida supabase-js
compone `/rest/v1/rest/v1/...` y responde `Invalid path specified in request
URL`. Los scripts la normalizan y avisan, pero es mejor guardarla limpia.

`DATABASE_URL` no hace falta: solo la usa `drizzle-kit`, y el esquema se aplica
por SQL (ver paso 3). No ejecutes `npm run db:push`: crea las tablas pero no las
políticas RLS, ni las funciones atómicas, ni las claves foráneas compuestas.

## 3. Crear el esquema

1. Panel de Supabase → **SQL Editor** → **New query**.
2. Pega el contenido completo de [`database/bootstrap.sql`](database/bootstrap.sql).
3. **Run**.

Ese archivo une, en el orden correcto, el esquema base, el módulo de fiados, los
datos de demostración y las siete migraciones. Está pensado para **una sola
ejecución sobre una base vacía**: varias migraciones usan `ADD CONSTRAINT` sin
guarda, así que reintentar a mitad falla. Si algo se rompe, resetea la base y
vuelve a correrlo entero.

Si no quieres los datos de ejemplo, borra el bloque marcado como `PASO 3` antes
de ejecutar.

La consulta final del archivo debe devolver 8 tablas, todas con
`rowsecurity = true`.

## 4. Crear el primer usuario

Una base nueva no tiene usuarios, y todos los endpoints de `/api/platform/*`
exigen un administrador de plataforma. El rol vive en `app_metadata`, que solo
la clave de servicio puede escribir:

```bash
npm run db:admin -- --email admin@demo.com --password Secreta123 --platform-admin
```

Para la demostración de acceso denegado conviene un segundo usuario en **otra**
organización:

```bash
npm run db:admin -- --email cajero@demo.com --password Secreta123 \
  --org-name "Tienda Norte" --org-slug tienda-norte --role cashier
```

El script es idempotente: si el correo ya existe, actualiza la contraseña y el
rol en lugar de fallar.

En PowerShell no hace falta pelear con las comillas: `npm run db:admin --
--org-name "Tienda Norte"` llega a Node como dos argumentos sueltos porque
PowerShell consume las comillas antes de reenviar la línea, y el script vuelve a
unir los valores sucesivos de cada bandera.

## 5. Verificar

```bash
npm run db:verify
```

Comprueba cinco cosas:

| Bloque | Qué valida |
| --- | --- |
| Variables de entorno | Las cuatro existen y la publicable no es la secreta |
| Esquema | Las 8 tablas responden con la clave de servicio |
| Funciones atómicas | `create_inventory_movement`, `create_credit_sale`, `register_credit_payment` |
| **Acceso denegado** | Ninguna tabla devuelve filas con la clave pública |
| Cuentas | Usuarios existentes y su rol de plataforma |

El cuarto bloque es la prueba que pide el reto: si alguna tabla aparece como
`EXPUESTA`, cualquiera que abra la aplicación puede leerla desde la consola del
navegador.

## 6. Arrancar

```bash
npm run dev
```

En [http://localhost:5000](http://localhost:5000), inicia sesión con la cuenta
del paso 4.

---

## Lo que ya trae el proyecto para el reto 2

| Eje del reto | Estado |
| --- | --- |
| **Auth** | Supabase Auth con JWT; la sesión vive en `sessionStorage` porque la caja es una máquina compartida |
| **RLS** | Activo en las 8 tablas, con políticas por organización y `security_invoker` en la vista `customer_debts` |
| **Roles** | Cuatro niveles: `platform_admin`, `owner`, `manager`, `cashier` |
| **Auditoría** | Parcial: `movements` registra qué pasó, quién y cuándo, pero solo del inventario |
| **Storage** | No implementado; `products.image_url` es texto libre |

Las dos brechas frente al enunciado son **Storage** (el reto pide que sirva al
producto, no que decore) y una **auditoría transversal** con tabla append-only.
Ambas son adiciones limpias sobre lo que ya existe.

## Qué no se toca de la app de inventario

- Este repositorio es una copia con su propio `.env` y su propio historial de git.
- `database/bootstrap.sql` solo se ejecuta donde tú lo pegues.
- La aplicación original sigue apuntando a su base porque su `.env` no cambia.
