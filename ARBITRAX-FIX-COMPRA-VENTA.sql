-- ============================================================
-- ARBITRAX PRO - PATCH FINAL DE OPERACIONES COMPRA / VENTA
-- ============================================================
-- Crea los RPC que el frontend actual consume:
--   rpc_buy
--   rpc_sell
--
-- IMPORTANTE:
--  * No modifica RLS.
--  * No elimina triggers.
--  * La operación es atómica.
--  * El vendedor queda en seller_id.
--  * La wallet bloqueada no puede operar.
--  * Compra: resta ARS de wallet y suma crypto al exchange.
--  * Venta: resta crypto del exchange y suma ARS a wallet.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_buy(
    p_crypto text,
    p_quantity numeric,
    p_unit_price numeric,
    p_total_pesos numeric,
    p_wallet_id text,
    p_wallet_name text,
    p_operator text,
    p_supplier text DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_shift_id text DEFAULT NULL,
    p_organization_id text DEFAULT NULL,
    p_exchange_id text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_wallet public.wallets;
    v_exchange public.exchange_accounts;
    v_tx public.transactions;
    v_org text;
    v_actor text;
    v_seller_id text;
BEGIN
    IF NOT public.is_authenticated() THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad de crypto debe ser mayor a cero';
    END IF;

    IF p_total_pesos IS NULL OR p_total_pesos <= 0 THEN
        RAISE EXCEPTION 'El monto en pesos debe ser mayor a cero';
    END IF;

    v_actor := public.arx_current_user_id();
    v_org := public.arx_current_org_id();

    IF public.arx_is_super_admin() THEN
        v_org := COALESCE(NULLIF(trim(p_organization_id), ''), v_org);
    ELSE
        IF p_organization_id IS DISTINCT FROM v_org THEN
            RAISE EXCEPTION 'Organización inválida';
        END IF;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
      AND organization_id = v_org
      AND COALESCE(archived, false) = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billetera no encontrada';
    END IF;

    IF COALESCE(v_wallet.blocked, false) = true
       OR COALESCE(v_wallet.status, '') = 'BLOCKED' THEN
        RAISE EXCEPTION 'La billetera está bloqueada';
    END IF;

    IF public.arx_is_seller()
       AND v_wallet.vendor_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'La billetera no pertenece al vendedor autenticado';
    END IF;

    IF COALESCE(v_wallet.saldo_pesos, 0) < p_total_pesos THEN
        RAISE EXCEPTION 'Saldo insuficiente en la billetera. Disponible: % ARS',
            COALESCE(v_wallet.saldo_pesos, 0);
    END IF;

    IF p_exchange_id IS NULL OR trim(p_exchange_id) = '' THEN
        RAISE EXCEPTION 'Debe seleccionar un Exchange';
    END IF;

    SELECT *
    INTO v_exchange
    FROM public.exchange_accounts
    WHERE id = p_exchange_id
      AND organization_id = v_org
      AND COALESCE(archived, false) = false
      AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange no encontrado o inactivo';
    END IF;

    IF public.arx_is_seller()
       AND v_exchange.vendor_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'El Exchange no pertenece al vendedor autenticado';
    END IF;

    v_seller_id := CASE
        WHEN public.arx_is_seller() THEN v_actor
        ELSE v_wallet.vendor_id
    END;

    UPDATE public.wallets
    SET saldo_pesos = COALESCE(saldo_pesos, 0) - p_total_pesos,
        updated_by = v_actor,
        updated_at = now()
    WHERE id = v_wallet.id;

    UPDATE public.exchange_accounts
    SET balance_crypto = COALESCE(balance_crypto, 0) + p_quantity,
        updated_at = now()
    WHERE id = v_exchange.id;

    INSERT INTO public.transactions (
        id,
        type,
        timestamp,
        date_string,
        time_string,
        crypto,
        quantity,
        unit_price,
        total_pesos,
        wallet_id,
        wallet_name,
        operator,
        supplier,
        client,
        gain,
        commission_binance,
        notes,
        shift_id,
        organization_id,
        seller_id,
        updated_at
    )
    VALUES (
        'tx-' || gen_random_uuid()::text,
        'compra',
        now(),
        to_char(now(), 'YYYY-MM-DD'),
        to_char(now(), 'HH24:MI:SS'),
        upper(trim(COALESCE(p_crypto, 'USDT'))),
        p_quantity,
        CASE WHEN p_unit_price IS NULL OR p_unit_price <= 0
             THEN p_total_pesos / p_quantity
             ELSE p_unit_price END,
        p_total_pesos,
        v_wallet.id,
        v_wallet.name,
        COALESCE(NULLIF(trim(p_operator), ''), v_actor),
        NULLIF(trim(COALESCE(p_supplier, '')), ''),
        NULL,
        0,
        0,
        concat_ws(
            ' | ',
            NULLIF(trim(COALESCE(p_notes, '')), ''),
            'Exchange: ' || v_exchange.name
        ),
        NULLIF(p_shift_id, ''),
        v_org,
        v_seller_id,
        now()
    )
    RETURNING *
    INTO v_tx;

    RETURN v_tx;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_sell(
    p_crypto text,
    p_quantity numeric,
    p_unit_price numeric,
    p_total_pesos numeric,
    p_wallet_id text,
    p_wallet_name text,
    p_operator text,
    p_client text DEFAULT NULL,
    p_gain numeric DEFAULT 0,
    p_notes text DEFAULT NULL,
    p_shift_id text DEFAULT NULL,
    p_organization_id text DEFAULT NULL,
    p_exchange_id text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_wallet public.wallets;
    v_exchange public.exchange_accounts;
    v_tx public.transactions;
    v_org text;
    v_actor text;
    v_seller_id text;
BEGIN
    IF NOT public.is_authenticated() THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad de crypto debe ser mayor a cero';
    END IF;

    IF p_total_pesos IS NULL OR p_total_pesos <= 0 THEN
        RAISE EXCEPTION 'El monto en pesos debe ser mayor a cero';
    END IF;

    v_actor := public.arx_current_user_id();
    v_org := public.arx_current_org_id();

    IF public.arx_is_super_admin() THEN
        v_org := COALESCE(NULLIF(trim(p_organization_id), ''), v_org);
    ELSE
        IF p_organization_id IS DISTINCT FROM v_org THEN
            RAISE EXCEPTION 'Organización inválida';
        END IF;
    END IF;

    SELECT *
    INTO v_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
      AND organization_id = v_org
      AND COALESCE(archived, false) = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Billetera no encontrada';
    END IF;

    IF COALESCE(v_wallet.blocked, false) = true
       OR COALESCE(v_wallet.status, '') = 'BLOCKED' THEN
        RAISE EXCEPTION 'La billetera está bloqueada';
    END IF;

    IF public.arx_is_seller()
       AND v_wallet.vendor_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'La billetera no pertenece al vendedor autenticado';
    END IF;

    IF p_exchange_id IS NULL OR trim(p_exchange_id) = '' THEN
        RAISE EXCEPTION 'Debe seleccionar un Exchange';
    END IF;

    SELECT *
    INTO v_exchange
    FROM public.exchange_accounts
    WHERE id = p_exchange_id
      AND organization_id = v_org
      AND COALESCE(archived, false) = false
      AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Exchange no encontrado o inactivo';
    END IF;

    IF public.arx_is_seller()
       AND v_exchange.vendor_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'El Exchange no pertenece al vendedor autenticado';
    END IF;

    IF COALESCE(v_exchange.balance_crypto, 0) < p_quantity THEN
        RAISE EXCEPTION 'Saldo crypto insuficiente en el Exchange. Disponible: %',
            COALESCE(v_exchange.balance_crypto, 0);
    END IF;

    v_seller_id := CASE
        WHEN public.arx_is_seller() THEN v_actor
        ELSE v_wallet.vendor_id
    END;

    UPDATE public.exchange_accounts
    SET balance_crypto = COALESCE(balance_crypto, 0) - p_quantity,
        updated_at = now()
    WHERE id = v_exchange.id;

    UPDATE public.wallets
    SET saldo_pesos = COALESCE(saldo_pesos, 0) + p_total_pesos,
        updated_by = v_actor,
        updated_at = now()
    WHERE id = v_wallet.id;

    INSERT INTO public.transactions (
        id,
        type,
        timestamp,
        date_string,
        time_string,
        crypto,
        quantity,
        unit_price,
        total_pesos,
        wallet_id,
        wallet_name,
        operator,
        supplier,
        client,
        gain,
        commission_binance,
        notes,
        shift_id,
        organization_id,
        seller_id,
        updated_at
    )
    VALUES (
        'tx-' || gen_random_uuid()::text,
        'venta',
        now(),
        to_char(now(), 'YYYY-MM-DD'),
        to_char(now(), 'HH24:MI:SS'),
        upper(trim(COALESCE(p_crypto, 'USDT'))),
        p_quantity,
        CASE WHEN p_unit_price IS NULL OR p_unit_price <= 0
             THEN p_total_pesos / p_quantity
             ELSE p_unit_price END,
        p_total_pesos,
        v_wallet.id,
        v_wallet.name,
        COALESCE(NULLIF(trim(p_operator), ''), v_actor),
        NULL,
        NULLIF(trim(COALESCE(p_client, '')), ''),
        COALESCE(p_gain, 0),
        0,
        concat_ws(
            ' | ',
            NULLIF(trim(COALESCE(p_notes, '')), ''),
            'Exchange: ' || v_exchange.name
        ),
        NULLIF(p_shift_id, ''),
        v_org,
        v_seller_id,
        now()
    )
    RETURNING *
    INTO v_tx;

    RETURN v_tx;
END;
$function$;

-- Refresca la cache de PostgREST para que los nuevos RPC sean visibles inmediatamente.
NOTIFY pgrst, 'reload schema';
