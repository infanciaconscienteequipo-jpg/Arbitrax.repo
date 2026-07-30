-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 004
-- Movements, Wallet Movements, Exchange Balances y Daily Closures
-- =============================================================================

-- 1. Tabla: movements (Operaciones P2P, Trades, Compras y Ventas)
CREATE TABLE IF NOT EXISTS public.movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL 
        CHECK (type IN ('compra', 'venta', 'ingreso_fondos', 'egreso_fondos', 'transferencia_interna')),
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    exchange_id UUID REFERENCES public.exchanges(id) ON DELETE SET NULL,
    crypto VARCHAR(20) NOT NULL DEFAULT 'USDT',
    quantity_crypto NUMERIC(18,8) NOT NULL DEFAULT 0.00000000 CHECK (quantity_crypto >= 0),
    unit_price NUMERIC(18,4) NOT NULL DEFAULT 0.0000 CHECK (unit_price >= 0),
    total_ars NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_ars >= 0),
    net_profit_ars NUMERIC(18,2) DEFAULT 0.00,
    net_profit_crypto NUMERIC(18,8) DEFAULT 0.00000000,
    margin_percent NUMERIC(8,4) DEFAULT 0.0000,
    counterparty_name VARCHAR(200),
    notes TEXT,
    receipt_url TEXT,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed' 
        CHECK (status IN ('pending', 'completed', 'cancelled', 'audited')),
    operation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger updated_at para movements
CREATE TRIGGER set_movements_updated_at
    BEFORE UPDATE ON public.movements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Tabla: wallet_movements (Trazabilidad de Ajustes e Ingresos/Egresos en Billeteras)
CREATE TABLE IF NOT EXISTS public.wallet_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL 
        CHECK (type IN ('inflow', 'outflow', 'adjustment', 'trade_settlement')),
    asset VARCHAR(20) NOT NULL DEFAULT 'ARS',
    amount NUMERIC(18,8) NOT NULL,
    previous_balance NUMERIC(18,8) NOT NULL DEFAULT 0.00000000,
    new_balance NUMERIC(18,8) NOT NULL DEFAULT 0.00000000,
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Tabla: exchange_balances (Saldos Multi-Asset por Exchange)
CREATE TABLE IF NOT EXISTS public.exchange_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
    asset VARCHAR(20) NOT NULL DEFAULT 'USDT',
    balance NUMERIC(18,8) NOT NULL DEFAULT 0.00000000 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_exchange_asset UNIQUE(exchange_id, asset)
);

-- Trigger updated_at para exchange_balances
CREATE TRIGGER set_exchange_balances_updated_at
    BEFORE UPDATE ON public.exchange_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Tabla: daily_closures (Cierre de Jornada / Rendición de Turnos)
CREATE TABLE IF NOT EXISTS public.daily_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
    shift_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_operations_count INT NOT NULL DEFAULT 0 CHECK (total_operations_count >= 0),
    capital_operated_ars NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (capital_operated_ars >= 0),
    total_profit_ars NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    wallet_schedules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    exchange_schedules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review' 
        CHECK (status IN ('pending_review', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    review_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger updated_at para daily_closures
CREATE TRIGGER set_daily_closures_updated_at
    BEFORE UPDATE ON public.daily_closures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
