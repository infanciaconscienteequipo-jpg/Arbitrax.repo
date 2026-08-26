# ArbitraX Pro — Corrección de edición V3

## Qué cambia

La edición de movimientos y fondos deja de modificar saldos directamente desde TypeScript.

Ahora ambas ediciones llaman RPC de Supabase y toda la operación financiera ocurre dentro de una única transacción SQL:

- `rpc_transaction_update_v3`
- `rpc_income_expense_update_v3`

## Regla de edición de COMPRA / VENTA

Siempre:

1. Se toma el registro original.
2. Se revierte su efecto financiero.
3. Se aplica el nuevo efecto financiero.
4. Se actualiza el registro.
5. Se registra auditoría.
6. Si cualquier paso falla, Supabase hace rollback de todo.

### Compra

Original:
- wallet: `- pesos`
- exchange: `+ crypto`

Al editar:
- primero devuelve los pesos a la wallet original.
- primero quita la crypto del exchange original.
- después descuenta los nuevos pesos de la wallet seleccionada.
- después agrega la nueva cantidad al exchange seleccionado.

### Venta

Original:
- exchange: `- crypto`
- wallet: `+ pesos`

Al editar:
- primero devuelve la crypto al exchange original.
- primero quita los pesos de la wallet original.
- después descuenta la crypto del exchange seleccionado.
- después agrega los nuevos pesos a la wallet seleccionada.

Esto cubre cambios de:
- monto
- cantidad
- wallet
- exchange
- tipo compra/venta

## Regla de edición de FONDOS

Ingreso:
- original: `+ monto` en el destino viejo
- edición: primero `- monto original` del destino viejo
- después `+ monto nuevo` en el destino nuevo

Egreso:
- original: `- monto` en el destino viejo
- edición: primero `+ monto original` al destino viejo
- después `- monto nuevo` del destino nuevo

También permite cambiar:
- ingreso ↔ egreso
- monto
- wallet ↔ wallet
- exchange ↔ exchange
- pesos ↔ exchange

## Importante sobre SOL / BNB / otros activos

La base entregada en este ZIP tiene:

`exchange_accounts.balance_crypto`

Eso significa que cada cuenta de exchange tiene un único saldo crypto, sin una columna de activo.

Por lo tanto, si una misma cuenta de exchange debe contener simultáneamente SOL, BNB, USDT, etc., el esquema actual no puede separar esos stocks.

La corrección V3 sí mueve correctamente el stock cuando se cambia de una cuenta de exchange a otra. Si se necesita que una misma cuenta tenga saldos separados por crypto, hay que agregar una tabla de saldos por activo y modificar también las RPC de alta de compra/venta.

## Instalación

1. Ejecutar en Supabase SQL Editor:
   `ARBITRAX-FIX-EDICION-V3.sql`

2. Reemplazar el frontend con este ZIP.

3. Probar:
   - Fondo ingreso: wallet A -> wallet B con cambio de monto.
   - Fondo egreso: wallet A -> wallet B con cambio de monto.
   - Compra: wallet A -> wallet B.
   - Compra: exchange A -> exchange B.
   - Venta: exchange A -> exchange B.
   - Venta: wallet A -> wallet B.
   - Cambio de tipo compra ↔ venta.
   - Intento de dejar saldo negativo.

4. Verificar que al producirse un error ningún saldo quede parcialmente modificado.
