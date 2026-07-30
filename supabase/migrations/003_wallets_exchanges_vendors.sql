-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 003
-- Wallets, Exchanges y Vendors
-- =============================================================================

-- 1. Tabla: wallets (Billeteras / Cuentas Bancarias / FinTech / Cajas)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('fiat_bank', 'fiat_fintech', 'crypto_wallet', 'cash_vault')),
    asset VARCHAR(20) NOT NULL DEFAULT 'ARS',
    titular VARCHAR(150),
    account_number_cbu VARCHAR(100),
    balance_ars NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    balance_crypto NUMERIC(18,8) NOT NULL DEFAULT 0.00000000,
    assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    block_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger updated_at para wallets
CREATE TRIGGER set_wallets_updated_at
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Tabla: exchanges (Cuentas en Exchanges Centralizados)
CREATE TABLE IF NOT EXISTS public.exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    account_identifier VARCHAR(150),
    assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger updated_at para exchanges
CREATE TRIGGER set_exchanges_updated_at
    BEFORE UPDATE ON public.exchanges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Tabla: vendors (Configuración de Operadores / Vendedores por Organización)
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
    daily_limit_ars NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (daily_limit_ars >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_vendor_per_org UNIQUE(organization_id, profile_id)
);

-- Trigger updated_at para vendors
CREATE TRIGGER set_vendors_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
