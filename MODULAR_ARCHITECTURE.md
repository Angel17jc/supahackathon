# Arquitectura modular

## Objetivo

El sistema separa la interfaz, la API y el acceso a datos por dominio de negocio. Cada módulo debe poder evolucionar sin acoplarse a las vistas o rutas de otros dominios.

## Frontend

`frontend/src/modules` contiene los módulos funcionales:

- `catalog`: categorías y proveedores.
- `inventory`: productos y movimientos.
- `credits`: fiados y pagos.
- `platform`: administración de clientes SaaS, propietarios y personal.

Cada módulo es responsable de su página, componentes internos y acceso a su API. `frontend/src/App.tsx` solo registra rutas de pantalla. Las reexportaciones en `frontend/src/pages` y `frontend/src/hooks` son adaptadores temporales de compatibilidad; el código nuevo debe importar desde el módulo dueño.

`frontend/src/components` y `frontend/src/lib` contienen únicamente elementos reutilizables, infraestructura de autenticación, manejo de errores y utilidades compartidas. No deben contener reglas de negocio específicas de inventario, catálogo, fiados o plataforma.

## Backend

`backend/modules` agrupa las rutas HTTP por dominio:

- `catalog/catalog-routes.ts`
- `inventory/inventory-routes.ts`
- `credits/credit-routes.ts`
- `platform/platform-routes.ts`

`backend/routes.ts` es el ensamblador: configura salud, autenticación, contexto de organización y registra cada módulo. No debe acumular reglas de negocio.

`backend/platform-service.ts` implementa los flujos que requieren Supabase Admin API, como crear propietarios, gestionar personal y restablecer contraseñas. La clave de servicio permanece exclusivamente en el servidor.

## Seguridad y tenencia

1. La API exige un JWT de Supabase para `/api`.
2. Las operaciones de negocio exigen `X-Organization-Id` y validan la membresía activa.
3. El acceso a datos se realiza con el contexto de la organización seleccionada.
4. Las políticas RLS de Supabase refuerzan el aislamiento en la base de datos.
5. Solo `platform_admin` puede usar las rutas de `/api/platform`.

Las operaciones de inventario y fiados que modifican existencias o saldos se ejecutan mediante funciones SQL atómicas. El frontend nunca modifica tablas de negocio directamente.

## Convenciones para cambios nuevos

- Crear primero el contrato y validación de entrada.
- Implementar rutas del módulo con autorización explícita.
- Mantener las llamadas HTTP del frontend en el módulo propietario.
- Invalidar las consultas de TanStack Query afectadas después de una mutación.
- Devolver errores seguros y traducibles; no exponer errores internos o de Supabase.
- Añadir pruebas de reglas de negocio antes de modificar operaciones críticas.
- Mantener los commits pequeños, convencionales y con el motivo del cambio.
