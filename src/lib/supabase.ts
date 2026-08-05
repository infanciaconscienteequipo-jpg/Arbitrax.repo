/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import {
  AppState,
  Wallet,
  Transaction,
  Shift,
  IncomeExpenseRecord,
  ExchangeAccount,
  User,
  Organization,
  P2PArbitrage
} from '../types';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://avukgqasfnwjomzgmtbk.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dWtncWFzZm53am9temdtdGJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NTk5NDAsImV4cCI6MjEwMTAzNTk0MH0.6Zit_iWg2IqkchPb5Hfoox7Hsglh0xtVkXcTaOMpRbk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Checks connection to Supabase and returns status and database stats
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  tableCounts?: Record<string, number>;
  error?: string;
}> {
  try {
    const { data: orgs, error: orgsErr, count: orgsCount } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    if (orgsErr) {
      // Table might not exist yet
      if (orgsErr.code === '42P01') {
        return {
          connected: true,
          message: 'Conectado a Supabase, pero las tablas aún no se han creado en la base de datos.',
          error: 'Tablas pendientes de creación. Ejecuta el Script SQL proporcionado en el SQL Editor de Supabase.'
        };
      }
      return {
        connected: false,
        message: 'Error al consultar Supabase',
        error: orgsErr.message
      };
    }

    // Query counts for other tables
    const tableNames = ['users', 'wallets', 'exchange_accounts', 'shifts', 'transactions', 'income_expenses', 'p2p_arbitrages'];
    const tableCounts: Record<string, number> = { organizations: orgsCount || 0 };

    for (const tbl of tableNames) {
      const { count } = await supabase.from(tbl).select('id', { count: 'exact', head: true });
      tableCounts[tbl] = count || 0;
    }

    return {
      connected: true,
      message: 'Conexión exitosa a Supabase y tablas listas.',
      tableCounts
    };
  } catch (err: any) {
    return {
      connected: false,
      message: 'Error de red o configuración al conectar a Supabase.',
      error: err?.message || String(err)
    };
  }
}

/**
 * Map DB row (snake_case) to Wallet (camelCase)
 */
function mapWalletFromDB(row: any): Wallet {
  return {
    id: row.id,
    name: row.name,
    saldoPesos: Number(row.saldo_pesos || row.saldoPesos || 0),
    saldoUsdt: Number(row.saldo_usdt || row.saldoUsdt || 0),
    color: row.color || 'blue',
    providerType: row.provider_type || row.providerType || 'Fintech',
    titular: row.titular || '',
    vendorId: row.vendor_id || row.vendorId || '',
    vendorName: row.vendor_name || row.vendorName || '',
    organization_id: row.organization_id || 'org-1',
    limitARS: Number(row.limit_ars || row.limitARS || 3000000),
    blocked: Boolean(row.blocked)
  };
}

/**
 * Map Wallet to DB row
 */
function mapWalletToDB(w: Wallet) {
  return {
    id: w.id,
    name: w.name,
    saldo_pesos: w.saldoPesos,
    saldo_usdt: w.saldoUsdt,
    color: w.color,
    provider_type: w.providerType,
    titular: w.titular,
    vendor_id: w.vendorId,
    vendor_name: w.vendorName,
    organization_id: w.organization_id || 'org-1',
    limit_ars: w.limitARS,
    blocked: w.blocked,
    updated_at: new Date().toISOString()
  };
}

/**
 * Map DB row to Transaction
 */
function mapTransactionFromDB(row: any): Transaction {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.timestamp || new Date().toISOString(),
    dateString: row.date_string || row.dateString || new Date().toISOString().split('T')[0],
    timeString: row.time_string || row.timeString || '00:00:00',
    crypto: row.crypto || 'USDT',
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || row.unitPrice || 0),
    totalPesos: Number(row.total_pesos || row.totalPesos || 0),
    walletId: row.wallet_id || row.walletId || '',
    walletName: row.wallet_name || row.walletName || '',
    operator: row.operator || '',
    supplier: row.supplier || '',
    client: row.client || '',
    gain: Number(row.gain || 0),
    commissionBinance: Number(row.commission_binance || row.commissionBinance || 0),
    notes: row.notes || '',
    shiftId: row.shift_id || row.shiftId || undefined,
    organization_id: row.organization_id || 'org-1'
  };
}

/**
 * Map Transaction to DB row
 */
function mapTransactionToDB(t: Transaction) {
  return {
    id: t.id,
    type: t.type,
    timestamp: t.timestamp,
    date_string: t.dateString,
    time_string: t.timeString,
    crypto: t.crypto,
    quantity: t.quantity,
    unit_price: t.unitPrice,
    total_pesos: t.totalPesos,
    wallet_id: t.walletId,
    wallet_name: t.walletName,
    operator: t.operator,
    supplier: t.supplier,
    client: t.client,
    gain: t.gain || 0,
    commission_binance: t.commissionBinance || 0,
    notes: t.notes || '',
    shift_id: t.shiftId || null,
    organization_id: t.organization_id || 'org-1',
    updated_at: new Date().toISOString()
  };
}

/**
 * Fetch complete AppState from Supabase
 */
export async function fetchAppStateFromSupabase(): Promise<Partial<AppState> | null> {
  try {
    const [
      orgsRes,
      usersRes,
      walletsRes,
      exchangesRes,
      shiftsRes,
      incExpRes,
      txsRes,
      p2pRes
    ] = await Promise.all([
      supabase.from('organizations').select('*'),
      supabase.from('users').select('*'),
      supabase.from('wallets').select('*'),
      supabase.from('exchange_accounts').select('*'),
      supabase.from('shifts').select('*').order('start_time', { ascending: false }),
      supabase.from('income_expenses').select('*').order('timestamp', { ascending: false }),
      supabase.from('transactions').select('*').order('timestamp', { ascending: false }),
      supabase.from('p2p_arbitrages').select('*').order('timestamp', { ascending: false })
    ]);

    if (orgsRes.error) {
      console.warn('Supabase orgs fetch error:', orgsRes.error.message);
      return null;
    }

    const organizations: Organization[] = (orgsRes.data || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      taxId: o.tax_id,
      country: o.country,
      status: o.status,
      active: o.active,
      plan: o.plan,
      maxUsers: o.max_users,
      monthlyFee: Number(o.monthly_fee || 0),
      createdAt: o.created_at,
      subscriptionExpiresAt: o.subscription_expires_at,
      featureFlags: o.feature_flags || { p2pCalculator: true, shiftClosing: true, advancedReports: true, customCryptos: true, auditLogs: true }
    }));

    const users: User[] = (usersRes.data || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      password: u.password_hash || u.password,
      role: u.role,
      organization_id: u.organization_id,
      status: u.status,
      active: u.active
    }));

    const wallets: Wallet[] = (walletsRes.data || []).map(mapWalletFromDB);

    const exchanges: ExchangeAccount[] = (exchangesRes.data || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      balanceCrypto: Number(e.balance_crypto || e.balanceCrypto || 0),
      vendorId: e.vendor_id || e.vendorId,
      vendorName: e.vendor_name || e.vendorName,
      organization_id: e.organization_id || 'org-1'
    }));

    const shifts: Shift[] = (shiftsRes.data || []).map((s: any) => ({
      id: s.id,
      operatorName: s.operator_name || s.operatorName,
      startTime: s.start_time || s.startTime,
      endTime: s.end_time || s.endTime,
      initialBalances: s.initial_balances || s.initialBalances || {},
      finalBalances: s.final_balances || s.finalBalances || {},
      totalPurchasesPesos: Number(s.total_purchases_pesos || s.totalPurchasesPesos || 0),
      totalSalesPesos: Number(s.total_sales_pesos || s.totalSalesPesos || 0),
      totalGainsPesos: Number(s.total_gains_pesos || s.totalGainsPesos || 0),
      operationsCount: Number(s.operations_count || s.operationsCount || 0),
      organization_id: s.organization_id || 'org-1'
    }));

    const activeShift = shifts.find(s => !s.endTime);

    const incomeExpenses: IncomeExpenseRecord[] = (incExpRes.data || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      assetType: r.asset_type || r.assetType || 'pesos',
      walletOrExchangeId: r.wallet_or_exchange_id || r.walletOrExchangeId,
      walletOrExchangeName: r.wallet_or_exchange_name || r.walletOrExchangeName,
      timestamp: r.timestamp,
      dateString: r.date_string || r.dateString,
      timeString: r.time_string || r.timeString,
      amount: Number(r.amount || 0),
      transferPerson: r.transfer_person || r.transferPerson || '',
      reason: r.reason || '',
      proofUrl: r.proof_url || r.proofUrl,
      operator: r.operator || '',
      vendorId: r.vendor_id || r.vendorId,
      organization_id: r.organization_id || 'org-1',
      shiftId: r.shift_id || r.shiftId
    }));

    const transactions: Transaction[] = (txsRes.data || []).map(mapTransactionFromDB);

    const p2pCalcs: P2PArbitrage[] = (p2pRes.data || []).map((p: any) => ({
      id: p.id,
      timestamp: p.timestamp,
      pesosUsed: Number(p.pesos_used || p.pesosUsed || 0),
      usdtBought: Number(p.usdt_bought || p.usdtBought || 0),
      commissionPercent: Number(p.commission_percent || p.commissionPercent || 0),
      commissionAmount: Number(p.commission_amount || p.commissionAmount || 0),
      netUsdt: Number(p.net_usdt || p.netUsdt || 0),
      averagePrice: Number(p.average_price || p.averagePrice || 0),
      targetSalePrice: Number(p.target_sale_price || p.targetSalePrice || 0),
      grossRevenue: Number(p.gross_revenue || p.grossRevenue || 0),
      netProfit: Number(p.net_profit || p.netProfit || 0),
      profitabilityPercent: Number(p.profitability_percent || p.profitabilityPercent || 0),
      notes: p.notes,
      organization_id: p.organization_id || 'org-1'
    }));

    return {
      organizations,
      users,
      wallets,
      exchanges,
      shifts,
      activeShiftId: activeShift ? activeShift.id : null,
      incomeExpenses,
      transactions,
      p2pCalcs
    };
  } catch (err) {
    console.error('Error fetching state from Supabase:', err);
    return null;
  }
}

/**
 * Upsert Wallet in Supabase
 */
export async function syncWalletToSupabase(wallet: Wallet) {
  try {
    const dbWallet = mapWalletToDB(wallet);
    await supabase.from('wallets').upsert(dbWallet);
  } catch (err) {
    console.error('Failed to sync wallet to Supabase:', err);
  }
}

/**
 * Upsert Transaction in Supabase
 */
export async function syncTransactionToSupabase(transaction: Transaction) {
  try {
    const dbTx = mapTransactionToDB(transaction);
    await supabase.from('transactions').upsert(dbTx);
  } catch (err) {
    console.error('Failed to sync transaction to Supabase:', err);
  }
}

/**
 * Upsert Shift in Supabase
 */
export async function syncShiftToSupabase(shift: Shift) {
  try {
    const dbShift = {
      id: shift.id,
      operator_name: shift.operatorName,
      start_time: shift.startTime,
      end_time: shift.endTime || null,
      initial_balances: shift.initialBalances,
      final_balances: shift.finalBalances || null,
      total_purchases_pesos: shift.totalPurchasesPesos,
      total_sales_pesos: shift.totalSalesPesos,
      total_gains_pesos: shift.totalGainsPesos,
      operations_count: shift.operationsCount,
      organization_id: shift.organization_id || 'org-1',
      updated_at: new Date().toISOString()
    };
    await supabase.from('shifts').upsert(dbShift);
  } catch (err) {
    console.error('Failed to sync shift to Supabase:', err);
  }
}

/**
 * Upsert IncomeExpense in Supabase
 */
export async function syncIncomeExpenseToSupabase(record: IncomeExpenseRecord) {
  try {
    const dbRecord = {
      id: record.id,
      type: record.type,
      asset_type: record.assetType,
      wallet_or_exchange_id: record.walletOrExchangeId,
      wallet_or_exchange_name: record.walletOrExchangeName,
      timestamp: record.timestamp,
      date_string: record.dateString,
      time_string: record.timeString,
      amount: record.amount,
      transfer_person: record.transferPerson,
      reason: record.reason,
      proof_url: record.proofUrl || null,
      operator: record.operator,
      vendor_id: record.vendorId || null,
      organization_id: record.organization_id || 'org-1',
      shift_id: record.shiftId || null,
      updated_at: new Date().toISOString()
    };
    await supabase.from('income_expenses').upsert(dbRecord);
  } catch (err) {
    console.error('Failed to sync income/expense record to Supabase:', err);
  }
}

/**
 * Upsert Exchange Account in Supabase
 */
export async function syncExchangeToSupabase(exchange: ExchangeAccount) {
  try {
    const dbExchange = {
      id: exchange.id,
      name: exchange.name,
      balance_crypto: exchange.balanceCrypto,
      vendor_id: exchange.vendorId || null,
      vendor_name: exchange.vendorName || null,
      organization_id: exchange.organization_id || 'org-1',
      updated_at: new Date().toISOString()
    };
    await supabase.from('exchange_accounts').upsert(dbExchange);
  } catch (err) {
    console.error('Failed to sync exchange to Supabase:', err);
  }
}

/**
 * Upsert User in Supabase
 */
export async function syncUserToSupabase(user: User) {
  try {
    const dbUser = {
      id: user.id || `u-${Date.now()}`,
      username: user.username,
      name: user.name,
      email: user.email || null,
      password_hash: user.password || 'Arbitrax.2006',
      role: user.role,
      organization_id: user.organization_id || null,
      status: user.status || 'active',
      active: user.active !== false,
      updated_at: new Date().toISOString()
    };
    await supabase.from('users').upsert(dbUser);
  } catch (err) {
    console.error('Failed to sync user to Supabase:', err);
  }
}

/**
 * Seed Supabase with initial data if empty
 */
export async function seedSupabaseWithInitialData(state: AppState): Promise<boolean> {
  try {
    // 1. Orgs
    if (state.organizations.length > 0) {
      const dbOrgs = state.organizations.map(o => ({
        id: o.id,
        name: o.name,
        tax_id: o.taxId,
        country: o.country || 'Argentina',
        status: o.status,
        active: o.active !== false,
        plan: o.plan,
        max_users: o.maxUsers,
        monthly_fee: o.monthlyFee,
        subscription_expires_at: o.subscriptionExpiresAt,
        feature_flags: o.featureFlags
      }));
      await supabase.from('organizations').upsert(dbOrgs);
    }

    // 2. Users
    if (state.users.length > 0) {
      const dbUsers = state.users.map(u => ({
        id: u.id || `u-${Date.now()}`,
        username: u.username,
        name: u.name,
        email: u.email || null,
        password_hash: u.password || 'Arbitrax.2006',
        role: u.role,
        organization_id: u.organization_id,
        status: u.status || 'active',
        active: u.active !== false
      }));
      await supabase.from('users').upsert(dbUsers);
    }

    // 3. Wallets
    if (state.wallets.length > 0) {
      const dbWallets = state.wallets.map(mapWalletToDB);
      await supabase.from('wallets').upsert(dbWallets);
    }

    // 4. Exchanges
    if (state.exchanges.length > 0) {
      const dbExchanges = state.exchanges.map(e => ({
        id: e.id,
        name: e.name,
        balance_crypto: e.balanceCrypto,
        vendor_id: e.vendorId || null,
        vendor_name: e.vendorName || null,
        organization_id: e.organization_id || 'org-1'
      }));
      await supabase.from('exchange_accounts').upsert(dbExchanges);
    }

    // 5. Shifts
    if (state.shifts.length > 0) {
      const dbShifts = state.shifts.map(s => ({
        id: s.id,
        operator_name: s.operatorName,
        start_time: s.startTime,
        end_time: s.endTime || null,
        initial_balances: s.initialBalances,
        final_balances: s.finalBalances || null,
        total_purchases_pesos: s.totalPurchasesPesos,
        total_sales_pesos: s.totalSalesPesos,
        total_gains_pesos: s.totalGainsPesos,
        operations_count: s.operationsCount,
        organization_id: s.organization_id || 'org-1'
      }));
      await supabase.from('shifts').upsert(dbShifts);
    }

    // 6. Transactions
    if (state.transactions.length > 0) {
      const dbTxs = state.transactions.map(mapTransactionToDB);
      await supabase.from('transactions').upsert(dbTxs);
    }

    // 7. Income Expenses
    if (state.incomeExpenses.length > 0) {
      const dbIncExp = state.incomeExpenses.map(r => ({
        id: r.id,
        type: r.type,
        asset_type: r.assetType,
        wallet_or_exchange_id: r.walletOrExchangeId,
        wallet_or_exchange_name: r.walletOrExchangeName,
        timestamp: r.timestamp,
        date_string: r.dateString,
        time_string: r.timeString,
        amount: r.amount,
        transfer_person: r.transferPerson,
        reason: r.reason,
        proof_url: r.proofUrl || null,
        operator: r.operator,
        vendor_id: r.vendorId || null,
        organization_id: r.organization_id || 'org-1',
        shift_id: r.shiftId || null
      }));
      await supabase.from('income_expenses').upsert(dbIncExp);
    }

    return true;
  } catch (err) {
    console.error('Error seeding Supabase:', err);
    return false;
  }
}
