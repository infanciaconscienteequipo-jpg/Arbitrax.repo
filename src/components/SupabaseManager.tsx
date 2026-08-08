/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { supabase } from '../lib/supabase';
import { dashboardService } from '../services/dashboard.service';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Server,
  Code2,
  Table,
  Lock,
  Download,
  Upload,
  ArrowRight
} from 'lucide-react';

interface SupabaseManagerProps {
  state: AppState;
  onUpdateState: (newState: Partial<AppState>) => void;
}

export default function SupabaseManager({ state, onUpdateState }: SupabaseManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'sql' | 'erd' | 'rollback'>('status');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
    tableCounts?: Record<string, number>;
    error?: string;
  } | null>(null);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCheckConnection = async () => {
    setLoading(true);
    const res = await dashboardService.checkConnection();
    setConnectionStatus(res);
    setLoading(false);
  };

  useEffect(() => {
    handleCheckConnection();
  }, []);

  const handleSeedSupabase = async () => {
    setLoading(true);
    const ok = await dashboardService.seedInitialData(state);
    if (ok) {
      alert('¡Datos sincronizados e insertados exitosamente en Supabase!');
      await handleCheckConnection();
    } else {
      alert('Hubo un error al guardar datos en Supabase. Revisa si ejecutaste primero el Script SQL de creación de tablas en Supabase.');
    }
    setLoading(false);
  };

  const handleFetchFromSupabase = async () => {
    setLoading(true);
    const fetched = await dashboardService.fetchAppState();
    if (fetched) {
      onUpdateState(fetched);
      alert('¡Estado actualizado desde Supabase con éxito!');
      await handleCheckConnection();
    } else {
      alert('No se pudieron obtener datos de Supabase. Asegúrate de ejecutar el Script SQL en Supabase primero.');
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const FULL_SQL_SCRIPT = `-- =====================================================================
-- ARQUITECTURA DE BASE DE DATOS PROFESIONAL POSTGRESQL PARA SUPABASE
-- Proyecto: ArbitraX - P2P Binance & Crypto OTC Management System
-- URL Supabase: ${SUPABASE_URL || 'Configurada vía VITE_SUPABASE_URL'}
-- =====================================================================

-- 0. HABILITAR EXTENSIONES UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. FUNCIÓN Y TRIGGER AUTOMÁTICO PARA UPDATED_AT
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================================
-- 2. TABLA: ORGANIZATIONS (Empresas / Organizaciones SaaS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id TEXT PRIMARY KEY DEFAULT 'org-' || gen_random_uuid()::text,
    name TEXT NOT NULL,
    tax_id TEXT,
    country TEXT DEFAULT 'Argentina',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
    active BOOLEAN DEFAULT true,
    monthly_fee NUMERIC(15, 2) NOT NULL DEFAULT 120000.00,
    subscription_expires_at TIMESTAMPTZ,
    feature_flags JSONB DEFAULT '{"p2pCalculator": true, "shiftClosing": true, "advancedReports": true, "customCryptos": true, "auditLogs": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migración / Edición en caso de que la tabla ya exista en Supabase
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(15, 2) DEFAULT 120000;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS max_users;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS plan;

-- Trigger updated_at organizations
DROP TRIGGER IF EXISTS set_updated_at_organizations ON public.organizations;
CREATE TRIGGER set_updated_at_organizations
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 3. TABLA: USERS (Vendedores, Administradores y SuperAdmins)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT 'u-' || gen_random_uuid()::text,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL DEFAULT 'Arbitrax.2006',
    role TEXT NOT NULL DEFAULT 'VENDEDOR' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'VENDEDOR', 'operator', 'admin', 'vendedor')),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at users
DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 4. TABLA: WALLETS (Billeteras / Bancos / Fintechs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT 'w-' || gen_random_uuid()::text,
    name TEXT NOT NULL,
    saldo_pesos NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (saldo_pesos >= 0),
    saldo_usdt NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (saldo_usdt >= 0),
    color TEXT DEFAULT 'blue',
    provider_type TEXT DEFAULT 'Fintech',
    titular TEXT,
    vendor_id TEXT,
    vendor_name TEXT,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    limit_ars NUMERIC(18, 2) DEFAULT 3000000,
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at wallets
DROP TRIGGER IF EXISTS set_updated_at_wallets ON public.wallets;
CREATE TRIGGER set_updated_at_wallets
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 5. TABLA: EXCHANGE_ACCOUNTS (Cuentas P2P Binance, Bybit, OKX)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.exchange_accounts (
    id TEXT PRIMARY KEY DEFAULT 'ex-' || gen_random_uuid()::text,
    name TEXT NOT NULL,
    balance_crypto NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (balance_crypto >= 0),
    vendor_id TEXT,
    vendor_name TEXT,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at exchange_accounts
DROP TRIGGER IF EXISTS set_updated_at_exchange_accounts ON public.exchange_accounts;
CREATE TRIGGER set_updated_at_exchange_accounts
    BEFORE UPDATE ON public.exchange_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 6. TABLA: SHIFTS (Control de Turnos e Informes de Operador)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
    id TEXT PRIMARY KEY DEFAULT 'shift-' || gen_random_uuid()::text,
    operator_name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    initial_balances JSONB NOT NULL DEFAULT '{}'::jsonb,
    final_balances JSONB DEFAULT '{}'::jsonb,
    total_purchases_pesos NUMERIC(18, 2) DEFAULT 0,
    total_sales_pesos NUMERIC(18, 2) DEFAULT 0,
    total_gains_pesos NUMERIC(18, 2) DEFAULT 0,
    operations_count INTEGER DEFAULT 0,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at shifts
DROP TRIGGER IF EXISTS set_updated_at_shifts ON public.shifts;
CREATE TRIGGER set_updated_at_shifts
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 7. TABLA: TRANSACTIONS (Operaciones P2P Compra / Venta / Fondos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT 'tx-' || gen_random_uuid()::text,
    type TEXT NOT NULL CHECK (type IN ('compra', 'venta', 'ingreso_fondos', 'egreso_fondos')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_string TEXT NOT NULL,
    time_string TEXT NOT NULL,
    crypto TEXT NOT NULL DEFAULT 'USDT',
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_pesos NUMERIC(18, 2) NOT NULL DEFAULT 0,
    wallet_id TEXT NOT NULL,
    wallet_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    supplier TEXT,
    client TEXT,
    gain NUMERIC(18, 2) DEFAULT 0,
    commission_binance NUMERIC(18, 4) DEFAULT 0,
    notes TEXT,
    shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at transactions
DROP TRIGGER IF EXISTS set_updated_at_transactions ON public.transactions;
CREATE TRIGGER set_updated_at_transactions
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 8. TABLA: INCOME_EXPENSES (Ingresos y Egresos de Fondos)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.income_expenses (
    id TEXT PRIMARY KEY DEFAULT 'ie-' || gen_random_uuid()::text,
    type TEXT NOT NULL CHECK (type IN ('ingreso', 'egreso')),
    asset_type TEXT NOT NULL DEFAULT 'pesos' CHECK (asset_type IN ('pesos', 'exchange')),
    wallet_or_exchange_id TEXT NOT NULL,
    wallet_or_exchange_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_string TEXT NOT NULL,
    time_string TEXT NOT NULL,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    transfer_person TEXT,
    reason TEXT,
    proof_url TEXT,
    operator TEXT NOT NULL,
    vendor_id TEXT,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at income_expenses
DROP TRIGGER IF EXISTS set_updated_at_income_expenses ON public.income_expenses;
CREATE TRIGGER set_updated_at_income_expenses
    BEFORE UPDATE ON public.income_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 9. TABLA: P2P_ARBITRAGES (Simulaciones y Cálculos P2P)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.p2p_arbitrages (
    id TEXT PRIMARY KEY DEFAULT 'p2p-' || gen_random_uuid()::text,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pesos_used NUMERIC(18, 2) NOT NULL DEFAULT 0,
    usdt_bought NUMERIC(18, 4) NOT NULL DEFAULT 0,
    commission_percent NUMERIC(8, 4) DEFAULT 0.1,
    commission_amount NUMERIC(18, 2) DEFAULT 0,
    net_usdt NUMERIC(18, 4) NOT NULL DEFAULT 0,
    average_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    target_sale_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
    gross_revenue NUMERIC(18, 2) NOT NULL DEFAULT 0,
    net_profit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    profitability_percent NUMERIC(8, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at p2p_arbitrages
DROP TRIGGER IF EXISTS set_updated_at_p2p_arbitrages ON public.p2p_arbitrages;
CREATE TRIGGER set_updated_at_p2p_arbitrages
    BEFORE UPDATE ON public.p2p_arbitrages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- 10. ÍNDICES DE RENDIMIENTO (PERFORMANCE INDEXES)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_wallets_org ON public.wallets(organization_id);
CREATE INDEX IF NOT EXISTS idx_wallets_vendor ON public.wallets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_org ON public.exchange_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org ON public.shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON public.transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON public.transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_income_expenses_shift ON public.income_expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_income_expenses_org ON public.income_expenses(organization_id);

-- =====================================================================
-- 11. SEGURIDAD Y POLÍTICAS ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_arbitrages ENABLE ROW LEVEL SECURITY;

-- Políticas Permisivas para Anon/Public Key de Frontend
CREATE POLICY "Permitir select para anon" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Permitir insert/update para anon" ON public.organizations FOR ALL USING (true);

CREATE POLICY "Permitir todo en users" ON public.users FOR ALL USING (true);
CREATE POLICY "Permitir todo en wallets" ON public.wallets FOR ALL USING (true);
CREATE POLICY "Permitir todo en exchange_accounts" ON public.exchange_accounts FOR ALL USING (true);
CREATE POLICY "Permitir todo en shifts" ON public.shifts FOR ALL USING (true);
CREATE POLICY "Permitir todo en transactions" ON public.transactions FOR ALL USING (true);
CREATE POLICY "Permitir todo en income_expenses" ON public.income_expenses FOR ALL USING (true);
CREATE POLICY "Permitir todo en p2p_arbitrages" ON public.p2p_arbitrages FOR ALL USING (true);

-- =====================================================================
-- 12. DATOS DE PRUEBA Y SEMILLA (SEED DATA INICIAL)
-- =====================================================================
INSERT INTO public.organizations (id, name, tax_id, country, status, monthly_fee)
VALUES 
  ('org-1', 'ArbitraX Capital Partners S.A.', '30-71628391-4', 'Argentina', 'active', 250000),
  ('org-2', 'CriptoGlobal P2P SRL', '30-88492019-2', 'Argentina', 'active', 120000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, name, email, password_hash, role, organization_id)
VALUES
  ('u-super-1', 'superadmin', 'Super Admin ArbitraX', 'arbitrax19@gmail.com', 'Arbitrax.2006', 'SUPER_ADMIN', NULL),
  ('u-1', 'admin', 'Administrador Principal', 'admiarbitrax1@gmail.com', 'Arbitrax.2006', 'ADMIN', 'org-1'),
  ('u-2', 'roberto.g', 'Roberto Gómez (Vendedor)', 'roberto.g@arbitrax.com', 'Arbitrax.2006', 'VENDEDOR', 'org-1'),
  ('u-3', 'carla.b', 'Carla Benítez (Vendedor)', 'carla.b@arbitrax.com', 'Arbitrax.2006', 'VENDEDOR', 'org-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallets (id, name, saldo_pesos, saldo_usdt, color, provider_type, titular, vendor_id, vendor_name, organization_id, limit_ars)
VALUES
  ('mercado_pago', 'Mercado Pago', 1250000, 300, 'blue', 'Fintech', 'Roberto Gómez', 'u-2', 'Roberto Gómez', 'org-1', 3000000),
  ('lemon', 'Lemon Cash', 450000, 120, 'green', 'Crypto Card', 'Roberto Gómez', 'u-2', 'Roberto Gómez', 'org-1', 2000000),
  ('naranja_x', 'Naranja X', 310000, 50, 'orange', 'Fintech', 'Carla Benítez', 'u-3', 'Carla Benítez', 'org-1', 1500000),
  ('brubank', 'Brubank', 600000, 210, 'teal', 'Digital Bank', 'Carla Benítez', 'u-3', 'Carla Benítez', 'org-1', 5000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exchange_accounts (id, name, balance_crypto, vendor_id, vendor_name, organization_id)
VALUES
  ('binance-main', 'Binance P2P', 1450, 'u-2', 'Roberto Gómez', 'org-1'),
  ('bybit-main', 'Bybit Official', 820, 'u-2', 'Roberto Gómez', 'org-1'),
  ('lemon-ex', 'Lemon Exchange', 310, 'u-3', 'Carla Benítez', 'org-1'),
  ('okx-main', 'OKX Pro', 600, 'u-3', 'Carla Benítez', 'org-1')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 13. FUNCIONES DE AUTENTICACIÓN Y VALIDACIÓN DE SESIÓN (RPC)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.rpc_login_user(
  p_identifier text,
  p_password text
)
RETURNS TABLE (
  id text,
  username text,
  name text,
  email text,
  role text,
  organization_id text,
  active boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_clean_id text;
  v_clean_pass text;
  v_is_valid boolean := false;
BEGIN
  v_clean_id := lower(trim(p_identifier));
  v_clean_pass := trim(p_password);

  IF v_clean_id IS NULL OR v_clean_id = '' OR v_clean_pass IS NULL OR v_clean_pass = '' THEN
    RAISE EXCEPTION 'IDENTIFIER_AND_PASSWORD_REQUIRED';
  END IF;

  SELECT u.* INTO v_user
  FROM public.users u
  WHERE lower(trim(u.username)) = v_clean_id
     OR lower(trim(u.email)) = v_clean_id
     OR lower(trim(u.name)) = v_clean_id
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF v_user.active = false OR v_user.status = 'disabled' OR v_user.status = 'suspended' THEN
    RAISE EXCEPTION 'USER_INACTIVE';
  END IF;

  IF v_user.password_hash LIKE '$2a$%' OR v_user.password_hash LIKE '$2b$%' OR v_user.password_hash LIKE '$2y$%' THEN
    IF crypt(v_clean_pass, v_user.password_hash) = v_user.password_hash THEN
      v_is_valid := true;
    END IF;
  END IF;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'INVALID_PASSWORD';
  END IF;

  UPDATE public.users SET updated_at = NOW() WHERE public.users.id = v_user.id;

  RETURN QUERY
  SELECT 
    v_user.id::text,
    v_user.username::text,
    v_user.name::text,
    COALESCE(v_user.email, '')::text,
    v_user.role::text,
    v_user.organization_id::text,
    v_user.active,
    v_user.status::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_validate_session(
  p_user_id text
)
RETURNS TABLE (
  id text,
  username text,
  name text,
  email text,
  role text,
  organization_id text,
  active boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id::text,
    u.username::text,
    u.name::text,
    COALESCE(u.email, '')::text,
    u.role::text,
    u.organization_id::text,
    u.active,
    u.status::text
  FROM public.users u
  WHERE u.id = p_user_id
    AND u.active = true
    AND u.status = 'active'
  LIMIT 1;
END;
$$;
`;

  const ROLLBACK_SQL_SCRIPT = `-- =====================================================================
-- SCRIPT DE ROLLBACK / ELIMINACIÓN COMPLETA DE BASE DE DATOS
-- ATENCIÓN: Eliminará todas las tablas e información guardada.
-- =====================================================================

DROP TABLE IF EXISTS public.p2p_arbitrages CASCADE;
DROP TABLE IF EXISTS public.income_expenses CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.exchange_accounts CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-binance-black via-binance-card to-binance-black border border-binance-yellow/40 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-64 h-64 text-binance-yellow" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-binance-yellow/10 border border-binance-yellow/30 text-binance-yellow text-xs font-bold font-mono">
              <Zap className="w-3.5 h-3.5" /> Arquitectura PostgreSQL & Supabase Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight flex items-center gap-3">
              <Server className="w-8 h-8 text-binance-yellow" />
              Gestor & Arquitecto de Base de Datos Supabase
            </h1>
            <p className="text-xs sm:text-sm text-binance-gray max-w-2xl">
              Configuración profesional de PostgreSQL para la plataforma de gestión P2P Binance y Mesa Crypto OTC.
              Sincronización en tiempo real con Supabase Cloud.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCheckConnection}
              disabled={loading}
              className="px-4 py-2.5 bg-binance-card hover:bg-binance-border border border-binance-border text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-binance-yellow ${loading ? 'animate-spin' : ''}`} />
              Probar Conexión
            </button>
            <button
              onClick={handleSeedSupabase}
              disabled={loading}
              className="px-4 py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black text-xs font-black rounded-xl flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Sincronizar Datos a Supabase
            </button>
            <button
              onClick={handleFetchFromSupabase}
              disabled={loading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Cargar de Supabase
            </button>
          </div>
        </div>
      </div>

      {/* Connection Info Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-binance-card border border-binance-border p-5 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-binance-yellow" />
            Credenciales de Proyecto
          </h3>
          <div className="space-y-3 text-xs font-mono">
            <div>
              <span className="text-binance-gray block text-[10px] uppercase font-bold">URL Supabase:</span>
              <div className="p-2 bg-binance-black border border-binance-border/50 rounded-lg text-emerald-400 font-bold truncate">
                {SUPABASE_URL}
              </div>
            </div>
            <div>
              <span className="text-binance-gray block text-[10px] uppercase font-bold">Anon Public Key:</span>
              <div className="p-2 bg-binance-black border border-binance-border/50 rounded-lg text-binance-gray text-[10px] truncate">
                {SUPABASE_ANON_KEY.substring(0, 30)}...
              </div>
            </div>
          </div>
        </div>

        {/* Live Status Card */}
        <div className="lg:col-span-2 bg-binance-card border border-binance-border p-5 rounded-2xl space-y-4 shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Estado de la Base de Datos Cloud
            </h3>
            {connectionStatus && (
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                  connectionStatus.connected && !connectionStatus.error
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {connectionStatus.connected ? 'ONLINE' : 'OFFLINE / FALLBACK'}
              </span>
            )}
          </div>

          {connectionStatus ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-white flex items-center gap-2">
                {connectionStatus.error ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                {connectionStatus.message}
              </p>

              {connectionStatus.error && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono space-y-1">
                  <span className="font-bold block">⚠️ Diagnóstico:</span>
                  <p>{connectionStatus.error}</p>
                </div>
              )}

              {connectionStatus.tableCounts && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {Object.entries(connectionStatus.tableCounts).map(([tbl, count]) => (
                    <div key={tbl} className="p-2.5 bg-binance-black border border-binance-border/60 rounded-xl text-center">
                      <span className="text-[10px] text-binance-gray uppercase font-bold block truncate">{tbl}</span>
                      <span className="text-sm font-black text-binance-yellow font-mono">{count} filas</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-binance-gray text-xs">Comprobando estado de Supabase...</div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-binance-border gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('status')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'status'
              ? 'bg-binance-card text-binance-yellow border-t-2 border-binance-yellow'
              : 'text-binance-gray hover:text-white'
          }`}
        >
          <Table className="w-4 h-4" /> Tablas y Documentación
        </button>
        <button
          onClick={() => setActiveSubTab('sql')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'sql'
              ? 'bg-binance-card text-binance-yellow border-t-2 border-binance-yellow'
              : 'text-binance-gray hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4 text-emerald-400" /> Script SQL Completo (PostgreSQL)
        </button>
        <button
          onClick={() => setActiveSubTab('erd')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'erd'
              ? 'bg-binance-card text-binance-yellow border-t-2 border-binance-yellow'
              : 'text-binance-gray hover:text-white'
          }`}
        >
          <Database className="w-4 h-4 text-blue-400" /> Diagrama ERD & Relaciones
        </button>
        <button
          onClick={() => setActiveSubTab('rollback')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'rollback'
              ? 'bg-binance-card text-binance-yellow border-t-2 border-binance-yellow'
              : 'text-binance-gray hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-red-400" /> Script Rollback / Reset
        </button>
      </div>

      {/* TAB CONTENT: TABLAS Y ESTRUCTURA */}
      {activeSubTab === 'status' && (
        <div className="space-y-6">
          <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Table className="w-5 h-5 text-binance-yellow" />
              Resumen de Tablas Diseñadas (Normalización 3FN)
            </h3>
            <p className="text-xs text-binance-gray">
              A continuación se listan las 8 entidades relacionales principales diseñadas para la arquitectura P2P OTC:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">1. organizations</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Organizaciones y empresas clientes del SaaS.</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">2. users</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Usuarios, vendedores, administradores y permisos.</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">3. wallets</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Billeteras de pesos (Mercado Pago, Lemon, Brubank).</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">4. exchange_accounts</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Cuentas crypto P2P (Binance, Bybit, OKX, Lemon).</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">5. shifts</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Jornadas laborales y arqueo de caja de operadores.</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">6. transactions</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Operaciones de Compra/Venta de USDT y ganancias.</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">7. income_expenses</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Inyecciones y retiros de capital o gastos de caja.</p>
              </div>

              <div className="p-4 bg-binance-black border border-binance-border/60 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">8. p2p_arbitrages</span>
                  <span className="text-[10px] text-binance-yellow font-mono">PK: id</span>
                </div>
                <p className="text-[11px] text-binance-gray">Calculadora y simulaciones de brecha de arbitraje P2P.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SQL SCRIPT */}
      {activeSubTab === 'sql' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-binance-card p-4 rounded-xl border border-binance-border">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                Script SQL de Creación (PostgreSQL / Supabase Editor)
              </h3>
              <p className="text-xs text-binance-gray">
                Copia este script completo y pégalo en la pestaña <strong>SQL Editor</strong> de tu panel de Supabase.
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(FULL_SQL_SCRIPT, 'sql')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              {copiedSection === 'sql' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'sql' ? '¡Copiado!' : 'Copiar SQL Completo'}
            </button>
          </div>

          <pre className="p-4 bg-binance-black border border-binance-border rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[600px] leading-relaxed">
            {FULL_SQL_SCRIPT}
          </pre>
        </div>
      )}

      {/* TAB CONTENT: ERD DIAGRAM */}
      {activeSubTab === 'erd' && (
        <div className="space-y-6">
          <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              Diagrama Entidad-Relación (ERD) en Texto
            </h3>

            <pre className="p-4 bg-binance-black border border-binance-border rounded-xl font-mono text-[11px] text-binance-yellow overflow-x-auto leading-relaxed">
{`+-----------------------+          +-----------------------+
|     ORGANIZATIONS     | 1      N |         USERS         |
+-----------------------+----------+-----------------------+
| PK: id                |          | PK: id                |
| name                  |          | username (UNIQUE)     |
| tax_id                |          | email (UNIQUE)        |
| status, plan          |          | role (ENUM)           |
+-----------------------+          | FK: organization_id   |
      | 1                          +-----------------------+
      |                                  |
      +-------------------+--------------+
      |                   | 
      v N                 v N
+-----------------------+ +-----------------------+
|        WALLETS        | |   EXCHANGE_ACCOUNTS   |
+-----------------------+ +-----------------------+
| PK: id                | | PK: id                |
| name, saldo_pesos     | | name, balance_crypto  |
| FK: organization_id   | | FK: organization_id   |
| FK: vendor_id         | | FK: vendor_id         |
+-----------------------+ +-----------------------+
      |
      | 1
      v N
+-----------------------+ 1      N +-----------------------+
|        SHIFTS         |----------|     TRANSACTIONS      |
+-----------------------+          +-----------------------+
| PK: id                |          | PK: id                |
| operator_name         |          | type (compra/venta)   |
| start_time, end_time  |          | crypto, quantity      |
| initial/final_balances|          | total_pesos, gain     |
| FK: organization_id   |          | FK: wallet_id         |
+-----------------------+          | FK: shift_id          |
      | 1                          | FK: organization_id   |
      v N                          +-----------------------+
+-----------------------+
|    INCOME_EXPENSES    |
+-----------------------+
| PK: id                |
| type (ingreso/egreso) |
| amount, transfer_pers |
| FK: shift_id          |
| FK: organization_id   |
+-----------------------+`}
            </pre>

            <div className="space-y-3 pt-2 text-xs text-binance-gray">
              <h4 className="font-bold text-white">Explicación de Relaciones Key:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">ORGANIZATIONS &rarr; USERS, WALLETS, SHIFTS:</strong> Estructura Multi-tenant SaaS aislada mediante <code className="text-amber-400">organization_id</code>.</li>
                <li><strong className="text-white">SHIFTS &rarr; TRANSACTIONS & INCOME_EXPENSES:</strong> Cada turno agrupa las compras, ventas e ingresos/egresos de fondos ejecutados durante esa jornada para cuadre automático.</li>
                <li><strong className="text-white">WALLETS & EXCHANGE_ACCOUNTS &rarr; VENDEDOR:</strong> Las billeteras físicas y cuentas P2P pertenecen a titulares o vendedores asignados para control de límites de bancarización.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ROLLBACK SCRIPT */}
      {activeSubTab === 'rollback' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-binance-card p-4 rounded-xl border border-red-500/30">
            <div>
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Script de Rollback / Limpieza
              </h3>
              <p className="text-xs text-binance-gray">
                Utilízalo en Supabase si necesitas eliminar todas las tablas creadas y volver a empezar desde cero.
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(ROLLBACK_SQL_SCRIPT, 'rollback')}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              {copiedSection === 'rollback' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'rollback' ? '¡Copiado!' : 'Copiar Rollback'}
            </button>
          </div>

          <pre className="p-4 bg-binance-black border border-binance-border rounded-xl font-mono text-[11px] text-red-400 overflow-x-auto leading-relaxed">
            {ROLLBACK_SQL_SCRIPT}
          </pre>
        </div>
      )}
    </div>
  );
}
