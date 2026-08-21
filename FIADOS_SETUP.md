# Guía de Configuración del Módulo de Fiados

## 1. Crear Tablas en Supabase

Ve al **SQL Editor** de Supabase y ejecuta el archivo [database/credits.sql](../database/credits.sql):

```sql
-- Copiar y ejecutar todo el contenido de database/credits.sql
```

Esto creará:
- ✅ Tabla `credit_accounts` (cuentas de crédito)
- ✅ Tabla `credit_payments` (pagos)
- ✅ Índices para mejor performance
- ✅ Triggers para actualizar timestamps
- ✅ Vista `customer_debts` (resumen por cliente)

## 2. Lógica del Sistema de Fiados

### Flujo de Fiado (Crédito):
1. **Cliente pide fiado** → Se crea cuenta de crédito
2. **Sistema verifica stock** → Similar a movimiento OUT
3. **Crea movimiento OUT** → Descuenta del inventario
4. **Registra deuda**:
   - `total_amount` = precio_venta × cantidad
   - `paid_amount` = 0
   - `remaining_amount` = total_amount
   - `status` = "pending"

### Flujo de Pago:
1. **Cliente paga** → Se registra pago
2. **Actualiza cuenta**:
   - `paid_amount` += monto_pago
   - `remaining_amount` -= monto_pago
   - `status` = "partial" (si quedan deudas) o "paid" (si está completo)

### Validaciones:
- ✅ Stock suficiente antes de fiar
- ✅ Pago no puede exceder deuda restante
- ✅ Cantidades y montos positivos
- ✅ `total_amount = unit_price × quantity`

## 3. Estructura de Datos

### Tabla: credit_accounts
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | SERIAL | ID único |
| customer_name | TEXT | Nombre del cliente |
| product_id | INTEGER | Producto fiado |
| movement_id | INTEGER | Movimiento OUT asociado |
| quantity | INTEGER | Cantidad fiada |
| unit_price | DECIMAL | Precio unitario |
| total_amount | DECIMAL | Monto total (unitario × cantidad) |
| paid_amount | DECIMAL | Monto pagado |
| remaining_amount | DECIMAL | Deuda restante |
| status | VARCHAR | pending/partial/paid |
| notes | TEXT | Notas opcionales |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Última actualización |

### Tabla: credit_payments
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | SERIAL | ID único |
| credit_account_id | INTEGER | Cuenta de crédito |
| amount | DECIMAL | Monto del pago |
| payment_method | VARCHAR | Método (Efectivo, Transferencia, etc.) |
| notes | TEXT | Notas opcionales |
| created_at | TIMESTAMP | Fecha del pago |

## 4. Funcionalidades Implementadas

### Frontend:
- ✅ Página `/credits` en el sidebar
- ✅ Estadísticas: Deuda total, Total clientes, Cuentas pendientes
- ✅ Lista agrupada por cliente
- ✅ Modal para registrar nuevo fiado
- ✅ Modal para registrar pagos
- ✅ Badges de estado (Pendiente/Parcial/Pagado)
- ✅ Validación de stock en tiempo real

### Backend:
- ✅ `GET /api/credits` - Lista todas las cuentas
- ✅ `GET /api/credits/customer/:name` - Cuentas por cliente
- ✅ `GET /api/credits/stats` - Estadísticas
- ✅ `POST /api/credits` - Crear fiado (con movimiento OUT automático)
- ✅ `POST /api/credits/payment` - Registrar pago

## 5. Ejemplo de Uso

### Fiar un producto:
```typescript
POST /api/credits
{
  "customerName": "Juan Pérez",
  "productId": 1,
  "quantity": 5,
  "notes": "Cliente frecuente"
}
```

**El sistema automáticamente:**
1. Verifica stock disponible
2. Crea movimiento OUT
3. Actualiza inventario
4. Calcula montos (usando precio de venta)
5. Crea cuenta de crédito

### Registrar pago:
```typescript
POST /api/credits/payment
{
  "creditAccountId": 123,
  "amount": "50.00",
  "paymentMethod": "Efectivo",
  "notes": "Pago parcial"
}
```

**El sistema automáticamente:**
1. Valida que el pago no exceda la deuda
2. Registra el pago
3. Actualiza `paid_amount` y `remaining_amount`
4. Cambia status a "partial" o "paid"

## 6. Vista en la Interfaz

La página de Fiados muestra:
- **Cards de estadísticas** en la parte superior
- **Sección por cliente** con tabla de cuentas
- **Total de deuda por cliente** destacado en rojo
- **Botón "Registrar Pago"** solo en cuentas no pagadas
- **Estado visual** con badges de colores

## 7. Consideraciones de Seguridad

- ✅ Validación de stock antes de operaciones
- ✅ Constraints de base de datos (CHECK)
- ✅ Foreign keys con acciones ON DELETE apropiadas
- ✅ Manejo de errores en frontend y backend
- ✅ Transacciones implícitas en Supabase

## 8. Próximos Pasos

Para usar el módulo:
1. ✅ Ejecutar `database/credits.sql` en Supabase
2. ✅ Reiniciar el servidor (ya está corriendo)
3. ✅ Ir a http://localhost:5000/credits
4. Probar creando un fiado
5. Probar registrando un pago

¡El sistema está listo para gestionar fiados! 🎉
