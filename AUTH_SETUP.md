# Autenticación y roles

La aplicación usa Supabase Auth con tokens JWT. La base de datos no acepta accesos directos desde el navegador: las peticiones pasan por la API Express, que valida el token y el rol del usuario.

## Variables de entorno

Configura las cuatro variables de [`.env.example`](.env.example):

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: solo para el servidor.
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: públicas, necesarias para iniciar sesión desde el navegador.

No expongas nunca `SUPABASE_SERVICE_ROLE_KEY` ni la incluyas en variables `VITE_*`.

## Crear usuarios

1. En Supabase, abre **Authentication → Users** y crea el usuario con correo y contraseña.
2. En la edición del usuario, añade el rol en **App metadata**. Usa uno de estos valores:

```json
{ "role": "admin" }
```

```json
{ "role": "cashier" }
```

3. Pide al usuario cerrar e iniciar sesión de nuevo para que reciba un JWT actualizado.

Los roles se guardan en `app_metadata`, no en `user_metadata`, porque solo los administradores de Supabase pueden modificarlos.

## Permisos

| Acción | admin | cashier |
| --- | --- | --- |
| Consultar inventario, movimientos y fiados | Sí | Sí |
| Crear, editar o eliminar productos, categorías y proveedores | Sí | No |
| Registrar movimientos, fiados y pagos | Sí | Sí |

## Activar RLS

Ejecuta `database/migrations/001_enable_rls.sql` una sola vez en el SQL Editor de Supabase, después de haber creado las tablas principales y las de fiados. RLS bloquea todo acceso directo desde clientes; el servidor usa la clave de servicio exclusivamente en el entorno backend y aplica los permisos por JWT.
