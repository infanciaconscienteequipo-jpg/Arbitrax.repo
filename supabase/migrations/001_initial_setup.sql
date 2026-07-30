-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 001
-- Extensiones, Funciones Base, Organizaciones, Planes y Suscripciones
-- =============================================================================

-- 1. Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Función genérica para actualización automática de la columna updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Tabla: plans (Planes de Suscripción del SaaS)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    max_users INT NOT NULL DEFAULT 5,
    max_wallets INT NOT NULL DEFAULT 10,
    max_exchanges INT NOT NULL DEFAULT 5,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger updated_at para plans
CREATE TRIGGER set_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Tabla: organizations (Organizaciones / Tenants del SaaS)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    tax_id VARCHAR(50),
    logo_url TEXT,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'trial' 
        CHECK (status IN ('trial', 'active', 'suspended', 'canceled')),
    max_vendors INT NOT NULL DEFAULT 5,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Trigger updated_at para organizations
CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Tabla: subscriptions (Suscripciones Facturables por Organización)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger updated_at para subscriptions
CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
