
-- ============================================================
-- ARBITRAX PRO - EDICION ATOMICA DE MOVIMIENTOS Y FONDOS V3
-- ============================================================
-- Reemplaza la edición directa desde el frontend por RPC atómicas.
--
-- MOVIMIENTOS:
--   1) Revierte exactamente el efecto financiero anterior.
--   2) Aplica exactamente el efecto financiero nuevo.
--   3) Permite cambiar tipo, monto, wallet y exchange.
--   4) Mantiene stock y pesos sincronizados.
--
-- FONDOS:
--   1) Revierte el ingreso/egreso original en su wallet/exchange.
--   2) Aplica el nuevo ingreso/egreso en el destino seleccionado.
--   3) Permite cambiar tipo, monto, activo y destino.
--
-- IMPORTANTE:
-- exchange_accounts actualmente tiene UN SOLO balance_crypto por cuenta.
-- Por eso un cambio de ticker (ej. SOL -> BNB) no puede separar stock
-- dentro de la misma cuenta. Para mover stock entre SOL y BNB, deben ser
-- cuentas de exchange distintas o debe existir una tabla de saldos por activo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_transaction_update_v3(
    p_transaction_id text,
    p_type text,
    p_crypto text,
    p_quantity numeric,
    p_unit_price numeric,
    p_total_pesos numeric,
    p_wallet_id text,
    p_wallet_name text DEFAULT NULL,
    p_exchange_id text DEFAULT NULL,
    p_supplier text DEFAULT NULL,
    p_client text DEFAULT NULL,
    p_gain numeric DEFAULT 0,
    p_commission_binance numeric DEFAULT 0,
    p_notes text DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_actor_id text;
    v_actor_name text;
    v_actor_role text;
    v_actor_org text;

    v_old_tx public.transactions;
    v_new_tx public.transactions;

    v_old_wallet public.wallets;
    v_new_wallet public.wallets;
    v_old_exchange public.exchange_accounts;
    v_new_exchange public.exchange_accounts;

    v_wallet_delta numeric;
    v_exchange_delta numeric;
    v_rows integer;
    v_final_unit_price numeric;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    SELECT u.id, u.name, upper(u.role), u.organization_id
    INTO v_actor_id, v_actor_name, v_actor_role, v_actor_org
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el perfil del usuario autenticado';
    END IF;

    IF v_actor_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR') THEN
        RAISE EXCEPTION 'El usuario no tiene permisos para editar movimientos';
    END IF;

    IF p_type NOT IN ('compra', 'venta') THEN
        RAISE EXCEPTION 'Tipo de movimiento inválido';
    END IF;

    IF NULLIF(trim(coalesce(p_crypto, '')), '') IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la criptomoneda';
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'La cantidad de crypto debe ser mayor a cero';
    END IF;

    IF p_total_pesos IS NULL OR p_total_pesos <= 0 THEN
        RAISE EXCEPTION 'El monto en pesos debe ser mayor a cero';
    END IF;

    IF p_wallet_id IS NULL OR trim(p_wallet_id) = '' THEN
        RAISE EXCEPTION 'Debe seleccionar una billetera';
    END IF;

    -- Bloqueamos primero la transacción para evitar dos ediciones simultáneas.
    SELECT *
    INTO v_old_tx
    FROM public.transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la transacción original';
    END IF;

    -- Aislamiento por organización y vendedor.
    IF v_actor_role <> 'SUPER_ADMIN' THEN
        IF v_old_tx.organization_id IS DISTINCT FROM v_actor_org THEN
            RAISE EXCEPTION 'La transacción no pertenece a su organización';
        END IF;

        IF v_actor_role = 'VENDEDOR'
           AND v_old_tx.seller_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'No está autorizado para editar esta transacción';
        END IF;
    END IF;

    -- La transacción original debe ser una compra/venta.
    IF v_old_tx.type NOT IN ('compra', 'venta') THEN
        RAISE EXCEPTION 'Solo se pueden editar movimientos de compra o venta';
    END IF;

    -- Validamos que la nueva wallet pertenezca a la misma organización.
    SELECT *
    INTO v_new_wallet
    FROM public.wallets
    WHERE id = p_wallet_id
      AND organization_id = v_old_tx.organization_id
      AND coalesce(archived, false) = false
      AND coalesce(status, 'ACTIVE') <> 'ARCHIVED'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La nueva billetera no existe, está archivada o no pertenece a la organización';
    END IF;

    IF coalesce(v_new_wallet.blocked, false) = true
       OR coalesce(v_new_wallet.status, '') = 'BLOCKED' THEN
        RAISE EXCEPTION 'La nueva billetera está bloqueada';
    END IF;

    IF v_actor_role = 'VENDEDOR'
       AND v_new_wallet.vendor_id IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION 'La nueva billetera no pertenece al vendedor autenticado';
    END IF;

    -- Bloqueamos la wallet vieja si es distinta.
    IF v_old_tx.wallet_id IS DISTINCT FROM p_wallet_id THEN
        SELECT *
        INTO v_old_wallet
        FROM public.wallets
        WHERE id = v_old_tx.wallet_id
          AND organization_id = v_old_tx.organization_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se encontró la billetera original de la transacción';
        END IF;

        -- Si el vendedor está editando, la wallet histórica también debe ser suya.
        IF v_actor_role = 'VENDEDOR'
           AND v_old_wallet.vendor_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'La billetera original no pertenece al vendedor autenticado';
        END IF;
    ELSE
        v_old_wallet := v_new_wallet;
    END IF;

    -- Exchange original.
    IF v_old_tx.exchange_id IS NOT NULL THEN
        IF p_exchange_id IS DISTINCT FROM v_old_tx.exchange_id THEN
            SELECT *
            INTO v_old_exchange
            FROM public.exchange_accounts
            WHERE id = v_old_tx.exchange_id
              AND organization_id = v_old_tx.organization_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No se encontró el Exchange original de la transacción';
            END IF;

            IF v_actor_role = 'VENDEDOR'
               AND v_old_exchange.vendor_id IS DISTINCT FROM v_actor_id THEN
                RAISE EXCEPTION 'El Exchange original no pertenece al vendedor autenticado';
            END IF;
        END IF;
    END IF;

    -- Nuevo exchange.
    IF p_exchange_id IS NOT NULL AND trim(p_exchange_id) <> '' THEN
        SELECT *
        INTO v_new_exchange
        FROM public.exchange_accounts
        WHERE id = p_exchange_id
          AND organization_id = v_old_tx.organization_id
          AND coalesce(archived, false) = false
          AND coalesce(status, 'ACTIVE') = 'ACTIVE'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El nuevo Exchange no existe, está archivado o está inactivo';
        END IF;

        IF v_actor_role = 'VENDEDOR'
           AND v_new_exchange.vendor_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'El nuevo Exchange no pertenece al vendedor autenticado';
        END IF;
    ELSE
        p_exchange_id := NULL;
    END IF;

    -- ========================================================
    -- 1. REVERTIR EL EFECTO DE LA OPERACION ORIGINAL
    -- ========================================================
    -- Compra: wallet -pesos / exchange +crypto
    -- Venta:  wallet +pesos / exchange -crypto
    IF v_old_tx.type = 'compra' THEN
        v_wallet_delta := v_old_tx.total_pesos;
        v_exchange_delta := -v_old_tx.quantity;
    ELSE
        v_wallet_delta := -v_old_tx.total_pesos;
        v_exchange_delta := v_old_tx.quantity;
    END IF;

    UPDATE public.wallets
    SET saldo_pesos = coalesce(saldo_pesos, 0) + v_wallet_delta,
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = v_old_tx.wallet_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'No se pudo revertir el saldo de la billetera original';
    END IF;

    IF v_old_tx.exchange_id IS NOT NULL THEN
        UPDATE public.exchange_accounts
        SET balance_crypto = coalesce(balance_crypto, 0) + v_exchange_delta,
            updated_at = now()
        WHERE id = v_old_tx.exchange_id;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'No se pudo revertir el stock del Exchange original';
        END IF;
    END IF;

    -- ========================================================
    -- 2. APLICAR EL EFECTO DE LA OPERACION NUEVA
    -- ========================================================
    -- Compra: wallet -pesos / exchange +crypto
    -- Venta:  wallet +pesos / exchange -crypto
    IF p_type = 'compra' THEN
        v_wallet_delta := -p_total_pesos;
        v_exchange_delta := p_quantity;
    ELSE
        v_wallet_delta := p_total_pesos;
        v_exchange_delta := -p_quantity;
    END IF;

    -- La condición garantiza que una edición nunca deje saldo negativo.
    UPDATE public.wallets
    SET saldo_pesos = coalesce(saldo_pesos, 0) + v_wallet_delta,
        updated_at = now(),
        updated_by = v_actor_id
    WHERE id = p_wallet_id
      AND coalesce(saldo_pesos, 0) + v_wallet_delta >= 0;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Saldo insuficiente en la billetera seleccionada para la edición';
    END IF;

    IF p_exchange_id IS NOT NULL THEN
        UPDATE public.exchange_accounts
        SET balance_crypto = coalesce(balance_crypto, 0) + v_exchange_delta
        WHERE id = p_exchange_id
          AND coalesce(balance_crypto, 0) + v_exchange_delta >= 0;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'Stock crypto insuficiente en el Exchange seleccionado para la edición';
        END IF;
    END IF;

    v_final_unit_price :=
        CASE
            WHEN p_unit_price IS NULL OR p_unit_price <= 0
            THEN p_total_pesos / p_quantity
            ELSE p_unit_price
        END;

    -- ========================================================
    -- 3. ACTUALIZAR REGISTRO Y AUDITORIA
    -- ========================================================
    UPDATE public.transactions
    SET type = p_type,
        crypto = upper(trim(p_crypto)),
        quantity = p_quantity,
        unit_price = v_final_unit_price,
        total_pesos = p_total_pesos,
        wallet_id = p_wallet_id,
        wallet_name = v_new_wallet.name,
        exchange_id = p_exchange_id,
        supplier = NULLIF(trim(coalesce(p_supplier, '')), ''),
        client = NULLIF(trim(coalesce(p_client, '')), ''),
        gain = coalesce(p_gain, 0),
        commission_binance = coalesce(p_commission_binance, 0),
        notes = NULLIF(trim(coalesce(p_notes, '')), ''),
        updated_at = now(),
        last_edited_at = now(),
        last_edited_by = v_actor_id,
        edit_count = coalesce(edit_count, 0) + 1
    WHERE id = p_transaction_id
    RETURNING *
    INTO v_new_tx;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo guardar la transacción editada';
    END IF;

    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        user_name,
        metadata
    )
    VALUES (
        v_old_tx.organization_id,
        v_actor_id,
        'UPDATE',
        'transactions',
        p_transaction_id,
        to_jsonb(v_old_tx),
        to_jsonb(v_new_tx),
        v_actor_name,
        jsonb_build_object('source', 'rpc_transaction_update_v3')
    );

    RETURN v_new_tx;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_income_expense_update_v3(
    p_income_expense_id text,
    p_type text,
    p_asset_type text,
    p_wallet_or_exchange_id text,
    p_wallet_or_exchange_name text DEFAULT NULL,
    p_amount numeric DEFAULT NULL,
    p_transfer_person text DEFAULT NULL,
    p_reason text DEFAULT NULL,
    p_proof_url text DEFAULT NULL
)
RETURNS public.income_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_actor_id text;
    v_actor_name text;
    v_actor_role text;
    v_actor_org text;

    v_old_rec public.income_expenses;
    v_new_rec public.income_expenses;

    v_old_wallet public.wallets;
    v_new_wallet public.wallets;
    v_old_exchange public.exchange_accounts;
    v_new_exchange public.exchange_accounts;

    v_old_delta numeric;
    v_new_delta numeric;
    v_rows integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    SELECT u.id, u.name, upper(u.role), u.organization_id
    INTO v_actor_id, v_actor_name, v_actor_role, v_actor_org
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    LIMIT 1;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el perfil del usuario autenticado';
    END IF;

    IF v_actor_role NOT IN ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR') THEN
        RAISE EXCEPTION 'El usuario no tiene permisos para editar fondos';
    END IF;

    IF p_type NOT IN ('ingreso', 'egreso') THEN
        RAISE EXCEPTION 'Tipo de fondo inválido';
    END IF;

    IF p_asset_type NOT IN ('pesos', 'exchange') THEN
        RAISE EXCEPTION 'Tipo de activo inválido';
    END IF;

    IF p_amount IS NULL OR p_amount < 0 THEN
        RAISE EXCEPTION 'El monto no puede ser negativo';
    END IF;

    IF p_wallet_or_exchange_id IS NULL OR trim(p_wallet_or_exchange_id) = '' THEN
        RAISE EXCEPTION 'Debe seleccionar una billetera o Exchange';
    END IF;

    -- Bloqueamos el registro original.
    SELECT *
    INTO v_old_rec
    FROM public.income_expenses
    WHERE id = p_income_expense_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el registro de fondos original';
    END IF;

    IF v_actor_role <> 'SUPER_ADMIN' THEN
        IF v_old_rec.organization_id IS DISTINCT FROM v_actor_org THEN
            RAISE EXCEPTION 'El registro no pertenece a su organización';
        END IF;

        IF v_actor_role = 'VENDEDOR'
           AND v_old_rec.seller_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'No está autorizado para editar este registro de fondos';
        END IF;
    END IF;

    -- ========================================================
    -- 1. BLOQUEAR EL DESTINO NUEVO
    -- ========================================================
    IF p_asset_type = 'pesos' THEN
        SELECT *
        INTO v_new_wallet
        FROM public.wallets
        WHERE id = p_wallet_or_exchange_id
          AND organization_id = v_old_rec.organization_id
          AND coalesce(archived, false) = false
          AND coalesce(status, 'ACTIVE') <> 'ARCHIVED'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La nueva billetera no existe, está archivada o no pertenece a la organización';
        END IF;

        IF coalesce(v_new_wallet.blocked, false) = true
           OR coalesce(v_new_wallet.status, '') = 'BLOCKED' THEN
            RAISE EXCEPTION 'La nueva billetera está bloqueada';
        END IF;

        IF v_actor_role = 'VENDEDOR'
           AND v_new_wallet.vendor_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'La nueva billetera no pertenece al vendedor autenticado';
        END IF;
    ELSE
        SELECT *
        INTO v_new_exchange
        FROM public.exchange_accounts
        WHERE id = p_wallet_or_exchange_id
          AND organization_id = v_old_rec.organization_id
          AND coalesce(archived, false) = false
          AND coalesce(status, 'ACTIVE') = 'ACTIVE'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El nuevo Exchange no existe, está archivado o no pertenece a la organización';
        END IF;

        IF v_actor_role = 'VENDEDOR'
           AND v_new_exchange.vendor_id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'El nuevo Exchange no pertenece al vendedor autenticado';
        END IF;
    END IF;

    -- ========================================================
    -- 2. BLOQUEAR EL DESTINO ORIGINAL SI ES DISTINTO
    -- ========================================================
    IF v_old_rec.asset_type = 'pesos' THEN
        IF p_asset_type = 'pesos'
           AND v_old_rec.wallet_or_exchange_id = p_wallet_or_exchange_id THEN
            v_old_wallet := v_new_wallet;
        ELSE
            SELECT *
            INTO v_old_wallet
            FROM public.wallets
            WHERE id = v_old_rec.wallet_or_exchange_id
              AND organization_id = v_old_rec.organization_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No se encontró la billetera original del fondo';
            END IF;

            IF v_actor_role = 'VENDEDOR'
               AND v_old_wallet.vendor_id IS DISTINCT FROM v_actor_id THEN
                RAISE EXCEPTION 'La billetera original no pertenece al vendedor autenticado';
            END IF;
        END IF;
    ELSE
        IF p_asset_type = 'exchange'
           AND v_old_rec.wallet_or_exchange_id = p_wallet_or_exchange_id THEN
            v_old_exchange := v_new_exchange;
        ELSE
            SELECT *
            INTO v_old_exchange
            FROM public.exchange_accounts
            WHERE id = v_old_rec.wallet_or_exchange_id
              AND organization_id = v_old_rec.organization_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No se encontró el Exchange original del fondo';
            END IF;

            IF v_actor_role = 'VENDEDOR'
               AND v_old_exchange.vendor_id IS DISTINCT FROM v_actor_id THEN
                RAISE EXCEPTION 'El Exchange original no pertenece al vendedor autenticado';
            END IF;
        END IF;
    END IF;

    -- ========================================================
    -- 3. REVERTIR EXACTAMENTE EL MOVIMIENTO ORIGINAL
    -- ========================================================
    -- Ingreso: se resta el monto original.
    -- Egreso:  se devuelve el monto original.
    v_old_delta :=
        CASE
            WHEN v_old_rec.type = 'ingreso' THEN -v_old_rec.amount
            ELSE v_old_rec.amount
        END;

    IF v_old_rec.asset_type = 'pesos' THEN
        UPDATE public.wallets
        SET saldo_pesos = coalesce(saldo_pesos, 0) + v_old_delta,
            updated_at = now(),
            updated_by = v_actor_id
        WHERE id = v_old_rec.wallet_or_exchange_id;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'No se pudo revertir el saldo de la billetera original';
        END IF;
    ELSE
        UPDATE public.exchange_accounts
        SET balance_crypto = coalesce(balance_crypto, 0) + v_old_delta,
            updated_at = now()
        WHERE id = v_old_rec.wallet_or_exchange_id;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'No se pudo revertir el stock del Exchange original';
        END IF;
    END IF;

    -- ========================================================
    -- 4. APLICAR EXACTAMENTE EL MOVIMIENTO NUEVO
    -- ========================================================
    -- Ingreso: suma el monto nuevo.
    -- Egreso:  resta el monto nuevo.
    v_new_delta :=
        CASE
            WHEN p_type = 'ingreso' THEN p_amount
            ELSE -p_amount
        END;

    IF p_asset_type = 'pesos' THEN
        UPDATE public.wallets
        SET saldo_pesos = coalesce(saldo_pesos, 0) + v_new_delta,
            updated_at = now(),
            updated_by = v_actor_id
        WHERE id = p_wallet_or_exchange_id
          AND coalesce(saldo_pesos, 0) + v_new_delta >= 0;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'Saldo insuficiente en la billetera seleccionada para la edición';
        END IF;
    ELSE
        UPDATE public.exchange_accounts
        SET balance_crypto = coalesce(balance_crypto, 0) + v_new_delta,
            updated_at = now()
        WHERE id = p_wallet_or_exchange_id
          AND coalesce(balance_crypto, 0) + v_new_delta >= 0;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            RAISE EXCEPTION 'Stock insuficiente en el Exchange seleccionado para la edición';
        END IF;
    END IF;

    -- ========================================================
    -- 5. ACTUALIZAR REGISTRO Y AUDITORIA
    -- ========================================================
    UPDATE public.income_expenses
    SET type = p_type,
        asset_type = p_asset_type,
        wallet_or_exchange_id = p_wallet_or_exchange_id,
        wallet_or_exchange_name =
            CASE
                WHEN p_asset_type = 'pesos' THEN v_new_wallet.name
                ELSE v_new_exchange.name
            END,
        amount = p_amount,
        transfer_person = NULLIF(trim(coalesce(p_transfer_person, '')), ''),
        reason = NULLIF(trim(coalesce(p_reason, '')), ''),
        proof_url = NULLIF(trim(coalesce(p_proof_url, '')), ''),
        updated_at = now(),
        last_edited_at = now(),
        last_edited_by = v_actor_id,
        edit_count = coalesce(edit_count, 0) + 1
    WHERE id = p_income_expense_id
    RETURNING *
    INTO v_new_rec;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo guardar el registro de fondos editado';
    END IF;

    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        user_name,
        metadata
    )
    VALUES (
        v_old_rec.organization_id,
        v_actor_id,
        'UPDATE',
        'income_expenses',
        p_income_expense_id,
        to_jsonb(v_old_rec),
        to_jsonb(v_new_rec),
        v_actor_name,
        jsonb_build_object('source', 'rpc_income_expense_update_v3')
    );

    RETURN v_new_rec;
END;
$function$;


REVOKE ALL ON FUNCTION public.rpc_transaction_update_v3(
    text, text, text, numeric, numeric, numeric, text, text, text, text, text, numeric, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_transaction_update_v3(
    text, text, text, numeric, numeric, numeric, text, text, text, text, text, numeric, numeric, text
) TO authenticated;


REVOKE ALL ON FUNCTION public.rpc_income_expense_update_v3(
    text, text, text, text, text, numeric, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_income_expense_update_v3(
    text, text, text, text, text, numeric, text, text, text
) TO authenticated;


NOTIFY pgrst, 'reload schema';
