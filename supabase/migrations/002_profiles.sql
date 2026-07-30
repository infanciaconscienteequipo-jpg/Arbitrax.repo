-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 002
-- Profiles, Integración con Supabase Auth y Roles
-- =============================================================================

-- 1. Tipo ENUM de Roles de la plataforma ArbitraX
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla: profiles (Perfiles de usuario extendidos de Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    role public.app_role NOT NULL DEFAULT 'VENDEDOR',
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) UNIQUE,
    avatar_url TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- Restricción: SUPER_ADMIN no requiere organization_id, pero ADMIN y VENDEDOR sí
    CONSTRAINT check_org_requirement CHECK (
        role = 'SUPER_ADMIN' OR organization_id IS NOT NULL
    )
);

-- Trigger updated_at para profiles
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
