-- =============================================================================
-- ARBITRAX ENTERPRISE SaaS - MIGRACIÓN 006
-- Índices, Triggers Automáticos, Funciones de Seguridad y Políticas RLS
-- =============================================================================

-- =============================================================================
-- 1. ÍNDICES DE ALTO RENDIMIENTO PARA CONSULTAS MULTI-TENANT
-- =============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Wallets
CREATE INDEX IF NOT EXISTS idx_wallets_org ON public.wallets(organization_id);
CREATE INDEX IF NOT EXISTS idx_wallets_assigned ON public.wallets(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON public.wallets(type);

-- Exchanges
CREATE INDEX IF NOT EXISTS idx_exchanges_org ON public.exchanges(organization_id);

-- Vendors
CREATE INDEX IF NOT EXISTS idx_vendors_org ON public.vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_profile ON public.vendors(profile_id);

-- Movements
CREATE INDEX IF NOT EXISTS idx_movements_org ON public.movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_movements_org_date ON public.movements(organization_id, operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_wallet ON public.movements(wallet_id);
CREATE INDEX IF NOT EXISTS idx_movements_operator ON public.movements(operator_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.movements(type);

-- Wallet Movements
CREATE INDEX IF NOT EXISTS idx_wallet_mov_org ON public.wallet_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_wallet_mov_wallet ON public.wallet_movements(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_mov_created ON public.wallet_movements(created_at DESC);

-- Exchange Balances
CREATE INDEX IF NOT EXISTS idx_exchange_balances_org ON public.exchange_balances(organization_id);
CREATE INDEX IF NOT EXISTS idx_exchange_balances_ex ON public.exchange_balances(exchange_id);

-- Daily Closures
CREATE INDEX IF NOT EXISTS idx_daily_closures_org ON public.daily_closures(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_closures_operator ON public.daily_closures(operator_id);
CREATE INDEX IF NOT EXISTS idx_daily_closures_status ON public.daily_closures(status);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- Subscriptions & Settings
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_settings_org ON public.settings(organization_id);


-- =============================================================================
-- 2. FUNCIONES AUXILIARES DE SEGURIDAD PARA EVALUACIÓN RLS
-- =============================================================================

-- Obtener el ID del usuario autenticado
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Obtener el organization_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL;
    
    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Obtener el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS public.app_role AS $$
DECLARE
    v_role public.app_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL;
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar si es SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.auth_user_role() = 'SUPER_ADMIN');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verificar si es ADMIN de la organización
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.auth_user_role() = 'ADMIN');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- =============================================================================
-- 3. TRIGGER AUTOMÁTICO DE CREACIÓN DE PERFIL TRAS REGISTRO EN AUTH.USERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_role public.app_role;
    v_full_name TEXT;
BEGIN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
    
    IF NEW.raw_user_meta_data->>'role' = 'SUPER_ADMIN' THEN
        v_role := 'SUPER_ADMIN';
    ELSIF NEW.raw_user_meta_data->>'role' = 'ADMIN' THEN
        v_role := 'ADMIN';
    ELSE
        v_role := 'VENDEDOR';
    END IF;

    INSERT INTO public.profiles (id, organization_id, role, full_name, email, is_active)
    VALUES (
        NEW.id,
        v_org_id,
        v_role,
        v_full_name,
        NEW.email,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- 4. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS
-- =============================================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 5. POLÍTICAS DE SEGURIDAD RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla: plans
-- -----------------------------------------------------------------------------
CREATE POLICY "plans_select_all" ON public.plans
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "plans_super_admin_all" ON public.plans
    FOR ALL TO authenticated USING (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Tabla: organizations
-- -----------------------------------------------------------------------------
CREATE POLICY "org_super_admin_all" ON public.organizations
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "org_member_select" ON public.organizations
    FOR SELECT TO authenticated 
    USING (id = public.auth_org_id());

CREATE POLICY "org_admin_update" ON public.organizations
    FOR UPDATE TO authenticated 
    USING (id = public.auth_org_id() AND public.is_org_admin())
    WITH CHECK (id = public.auth_org_id() AND public.is_org_admin());

-- -----------------------------------------------------------------------------
-- Tabla: subscriptions
-- -----------------------------------------------------------------------------
CREATE POLICY "sub_super_admin_all" ON public.subscriptions
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "sub_admin_select" ON public.subscriptions
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

-- -----------------------------------------------------------------------------
-- Tabla: profiles
-- -----------------------------------------------------------------------------
CREATE POLICY "profiles_super_admin_all" ON public.profiles
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "profiles_self_select" ON public.profiles
    FOR SELECT TO authenticated 
    USING (id = public.auth_user_id());

CREATE POLICY "profiles_self_update" ON public.profiles
    FOR UPDATE TO authenticated 
    USING (id = public.auth_user_id())
    WITH CHECK (id = public.auth_user_id());

CREATE POLICY "profiles_org_admin_manage" ON public.profiles
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "profiles_vendedor_org_select" ON public.profiles
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id());

-- -----------------------------------------------------------------------------
-- Tabla: wallets
-- -----------------------------------------------------------------------------
CREATE POLICY "wallets_super_admin_all" ON public.wallets
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "wallets_org_member_select" ON public.wallets
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "wallets_org_admin_manage" ON public.wallets
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

-- -----------------------------------------------------------------------------
-- Tabla: exchanges
-- -----------------------------------------------------------------------------
CREATE POLICY "exchanges_super_admin_all" ON public.exchanges
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "exchanges_org_member_select" ON public.exchanges
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND deleted_at IS NULL);

CREATE POLICY "exchanges_org_admin_manage" ON public.exchanges
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

-- -----------------------------------------------------------------------------
-- Tabla: vendors
-- -----------------------------------------------------------------------------
CREATE POLICY "vendors_super_admin_all" ON public.vendors
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "vendors_org_admin_manage" ON public.vendors
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "vendors_vendedor_self_select" ON public.vendors
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND profile_id = public.auth_user_id());

-- -----------------------------------------------------------------------------
-- Tabla: movements
-- -----------------------------------------------------------------------------
CREATE POLICY "movements_super_admin_all" ON public.movements
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "movements_org_admin_manage" ON public.movements
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "movements_vendedor_insert" ON public.movements
    FOR INSERT TO authenticated 
    WITH CHECK (
        organization_id = public.auth_org_id() AND 
        operator_id = public.auth_user_id()
    );

CREATE POLICY "movements_vendedor_select" ON public.movements
    FOR SELECT TO authenticated 
    USING (
        organization_id = public.auth_org_id() AND 
        (public.is_org_admin() OR operator_id = public.auth_user_id())
    );

-- -----------------------------------------------------------------------------
-- Tabla: wallet_movements
-- -----------------------------------------------------------------------------
CREATE POLICY "wallet_mov_super_admin_all" ON public.wallet_movements
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "wallet_mov_org_admin_manage" ON public.wallet_movements
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "wallet_mov_vendedor_insert" ON public.wallet_movements
    FOR INSERT TO authenticated 
    WITH CHECK (
        organization_id = public.auth_org_id() AND 
        operator_id = public.auth_user_id()
    );

CREATE POLICY "wallet_mov_vendedor_select" ON public.wallet_movements
    FOR SELECT TO authenticated 
    USING (
        organization_id = public.auth_org_id() AND 
        (public.is_org_admin() OR operator_id = public.auth_user_id())
    );

-- -----------------------------------------------------------------------------
-- Tabla: exchange_balances
-- -----------------------------------------------------------------------------
CREATE POLICY "ex_balances_super_admin_all" ON public.exchange_balances
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "ex_balances_org_member_select" ON public.exchange_balances
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id());

CREATE POLICY "ex_balances_org_admin_manage" ON public.exchange_balances
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

-- -----------------------------------------------------------------------------
-- Tabla: daily_closures
-- -----------------------------------------------------------------------------
CREATE POLICY "daily_closures_super_admin_all" ON public.daily_closures
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "daily_closures_org_admin_manage" ON public.daily_closures
    FOR ALL TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "daily_closures_vendedor_insert" ON public.daily_closures
    FOR INSERT TO authenticated 
    WITH CHECK (
        organization_id = public.auth_org_id() AND 
        operator_id = public.auth_user_id()
    );

CREATE POLICY "daily_closures_vendedor_select" ON public.daily_closures
    FOR SELECT TO authenticated 
    USING (
        organization_id = public.auth_org_id() AND 
        (public.is_org_admin() OR operator_id = public.auth_user_id())
    );

-- -----------------------------------------------------------------------------
-- Tabla: audit_logs
-- -----------------------------------------------------------------------------
CREATE POLICY "audit_logs_super_admin_all" ON public.audit_logs
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "audit_logs_org_admin_select" ON public.audit_logs
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin());

CREATE POLICY "audit_logs_member_insert" ON public.audit_logs
    FOR INSERT TO authenticated 
    WITH CHECK (organization_id = public.auth_org_id());

-- -----------------------------------------------------------------------------
-- Tabla: notifications
-- -----------------------------------------------------------------------------
CREATE POLICY "notifications_super_admin_all" ON public.notifications
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "notifications_user_select" ON public.notifications
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id() AND user_id = public.auth_user_id());

CREATE POLICY "notifications_user_update" ON public.notifications
    FOR UPDATE TO authenticated 
    USING (organization_id = public.auth_org_id() AND user_id = public.auth_user_id())
    WITH CHECK (organization_id = public.auth_org_id() AND user_id = public.auth_user_id());

-- -----------------------------------------------------------------------------
-- Tabla: settings
-- -----------------------------------------------------------------------------
CREATE POLICY "settings_super_admin_all" ON public.settings
    FOR ALL TO authenticated USING (public.is_super_admin());

CREATE POLICY "settings_org_member_select" ON public.settings
    FOR SELECT TO authenticated 
    USING (organization_id = public.auth_org_id());

CREATE POLICY "settings_org_admin_update" ON public.settings
    FOR UPDATE TO authenticated 
    USING (organization_id = public.auth_org_id() AND public.is_org_admin())
    WITH CHECK (organization_id = public.auth_org_id() AND public.is_org_admin());
