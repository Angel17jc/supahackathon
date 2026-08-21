# Arquitectura SaaS multiempresa

## Orden de migraciones

Ejecuta las migraciones en orden numérico. Después de `003_scope_legacy_data_to_organization.sql`, ejecuta `004_apply_tenant_data_rls.sql` para limitar las lecturas directas de Supabase a la organización correspondiente. Las escrituras siguen siendo exclusivamente de la API, donde se aplican los permisos de rol.

## Modelo de acceso

- `platform_admin`: administrador de la plataforma. Es el único rol global y se guarda en `auth.users.raw_app_meta_data` como `platform_role`.
- `organizations`: representa una licorería cliente.
- `organization_memberships`: relaciona un usuario de Supabase Auth con una licorería y un rol local: `owner`, `manager` o `cashier`.

Los roles de empresa no se guardan en el JWT. La API resolverá la membresía activa en cada petición, de modo que un cambio de permisos toma efecto inmediatamente y un usuario puede pertenecer a varias licorerías.

## Aislamiento

Todas las tablas de negocio recibirán un `organization_id` obligatorio en la siguiente migración. Las consultas y mutaciones de la API filtrarán por esa organización y las políticas RLS harán cumplir el mismo límite en PostgreSQL.

El usuario de plataforma no debe ser miembro de cada cliente: puede administrar las empresas mediante `platform_role = platform_admin`.

## Migración de datos actuales

La migración de fundación (`002_saas_foundation.sql`) no toca los datos existentes. La siguiente migración hará lo siguiente dentro de una transacción:

1. Ejecutar `003_scope_legacy_data_to_organization.sql` después de la fundación.
2. Crear la organización `legacy-inventory` si aún no existe.
3. Añadir `organization_id` a las tablas de negocio y asignar todos los registros actuales a esa organización.
4. Convertir `organization_id` en obligatorio, crear índices únicos por organización y añadir claves foráneas compuestas entre entidades del mismo cliente.

## Operación de administración

El panel de plataforma permitirá crear una organización y su propietario. El backend creará el usuario con Supabase Admin API, le asignará una membresía `owner` y nunca expondrá la clave de servicio al navegador.
