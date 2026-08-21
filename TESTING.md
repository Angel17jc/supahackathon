# Pruebas

## Pruebas automáticas

Ejecuta antes de cada entrega:

```bash
npm test
npm run check
npm run build
```

Las pruebas unitarias cubren contratos de validación y el mapeo seguro de errores de API.

## Prueba de operaciones atómicas

Después de aplicar la migración `005_atomic_inventory_operations.sql`, ejecuta [atomic_operations_smoke_test.sql](database/tests/atomic_operations_smoke_test.sql) en Supabase SQL Editor.

El script verifica una entrada atómica y el rechazo de una salida con stock insuficiente. Usa `BEGIN` y `ROLLBACK`, así que no conserva cambios en inventario ni historial.
