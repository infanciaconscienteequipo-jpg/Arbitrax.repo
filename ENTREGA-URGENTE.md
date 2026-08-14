# ArbitraX Pro — Entrega urgente

## 1. Base de datos
Ejecutar en Supabase SQL Editor, en este orden:

1. `ARBITRAX-FIX-COMPRA-VENTA.sql`
2. `ARBITRAX-FIX-STORAGE-COMPROBANTES.sql`

El primer script crea los RPC `rpc_buy` y `rpc_sell` que el frontend actual necesita para que Compra/Venta sean operaciones atómicas y actualicen wallet + exchange + transaction.

El segundo deja `comprobantes` público para que los comprobantes puedan visualizarse después de recargar.

## 2. Frontend
Usar este proyecto para Vercel.

Cambios principales:
- No hay falsos mensajes de éxito en operaciones P2P.
- Compra/Venta esperan realmente al RPC.
- Wallet bloquear/desbloquear exige respuesta `true`.
- Wallet y fondos refrescan desde Supabase después de operar.
- Filtros de vendedor usan únicamente vendedores activos de la organización.
- Reportes arranca en Hoy para mostrar operaciones del día.
- Se agrega ErrorBoundary para evitar pantalla negra total.
- Exchanges guardan `status=ACTIVE` y `archived=false`.
- Transferencia Crypto al Admin nunca se marca como exitosa si el RPC falla.

## 3. Contadora
El ZIP contiene la Edge Function `supabase/functions/create-user/index.ts` con el mapeo correcto de `CONTADORA`.

Si en Supabase todavía está desplegada una versión vieja de `create-user`, hay que desplegar esta versión antes de probar nuevamente la creación de contadora.

## 4. Transferencia Crypto
La base actual debe tener `public.is_authenticated()` y `rpc_transfer_crypto_to_admin`.

Si Vercel sigue mostrando exactamente:
`function public.is_authenticated() does not exist`

verificar que las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de Vercel apunten al mismo proyecto Supabase donde se ejecutaron los SQL.

## 5. Prueba final
Después de ejecutar los SQL y desplegar:

### Admin
- crear wallet
- bloquear
- desbloquear
- crear exchange
- crear vendedor
- crear contadora
- registrar compra
- registrar venta
- abrir Reportes
- abrir Cierre de Jornada
- ver comprobante

### Vendedor
- ver solo sus wallets
- ver solo sus movimientos
- operar con wallet activa
- no operar con wallet bloqueada
- crear wallet propia
- crear exchange propio
- enviar crypto al Admin

No ejecutar scripts de limpieza o reset sobre la base.
