-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 005
-- Audit Logs, Notifications y Settings
-- =============================================================================

-- 1. Tabla: audit_logs (Bitácora Inmutable de Auditoría para Seguridad y Compliance)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    old_values JSONB DEFAULT NULL,
    new_values JSONB DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Tabla: notifications (Alertas del Sistema y Reglas Automáticas)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info' 
        CHECK (type IN ('info', 'warning', 'alert', 'success')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Tabla: settings (Configuraciones Operativas por Empresa)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    currency_base VARCHAR(10) NOT NULL DEFAULT 'ARS',
    p2p_default_crypto VARCHAR(20) NOT NULL DEFAULT 'USDT',
    auto_scan_alerts BOOLEAN NOT NULL DEFAULT true,
    risk_threshold_ars NUMERIC(18,2) DEFAULT 5000000.00,
    security_config JSONB NOT NULL DEFAULT '{"require_mfa": false, "session_timeout_minutes": 120}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger updated_at para settings
CREATE TRIGGER set_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
