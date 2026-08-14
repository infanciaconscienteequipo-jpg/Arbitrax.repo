import { supabase } from '../lib/supabase';
import {
  AppState,
  Organization,
  User,
  Wallet,
  ExchangeAccount,
  Shift,
  IncomeExpenseRecord,
  Transaction,
  P2PArbitrage,
} from '../types';

export const dashboardService = {
  async getDashboardMetrics(organizationId?: string): Promise<any> {
    try {
      if (organizationId) {
        const { data, error } = await supabase.rpc('rpc_dashboard', { p_organization_id: organizationId });
        if (!error && data) {
          return data;
        }
      }
    } catch (err) {
      console.warn('RPC rpc_dashboard no disponible, calculando desde estado.');
    }
    return null;
  },

  async checkConnection(): Promise<{
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
        if (orgsErr.code === '42P01') {
          return {
            connected: true,
            message: 'Conectado a Supabase, pero las tablas aún no se han creado en la base de datos.',
            error: 'Tablas pendientes de creación. Ejecuta el Script SQL proporcionado en el SQL Editor de Supabase.',
          };
        }
        return {
          connected: false,
          message: 'Error al consultar Supabase',
          error: orgsErr.message,
        };
      }

      const tableNames = ['users', 'wallets', 'exchange_accounts', 'shifts', 'transactions', 'income_expenses', 'p2p_arbitrages'];
      const tableCounts: Record<string, number> = { organizations: orgsCount || 0 };

      for (const tbl of tableNames) {
        const { count } = await supabase.from(tbl).select('id', { count: 'exact', head: true });
        tableCounts[tbl] = count || 0;
      }

      return {
        connected: true,
        message: 'Conexión exitosa a Supabase y tablas listas.',
        tableCounts,
      };
    } catch (err: any) {
      return {
        connected: false,
        message: 'Error de red o configuración al conectar a Supabase.',
        error: err?.message || String(err),
      };
    }
  },

  async fetchAppState(organizationId?: string): Promise<Partial<AppState> | null> {
    try {
      let orgsQuery = supabase.from('organizations').select('*');
      let usersQuery = supabase.from('users').select('*');
      let walletsQuery = supabase.from('wallets').select('*');
      let exchangesQuery = supabase.from('exchange_accounts').select('*');
      let shiftsQuery = supabase.from('shifts').select('*').order('start_time', { ascending: false });
      let incExpQuery = supabase.from('income_expenses').select('*').order('timestamp', { ascending: false });
      let txsQuery = supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      let p2pQuery = supabase.from('p2p_arbitrages').select('*').order('timestamp', { ascending: false });
      let notifsQuery = supabase.from('notifications').select('*').order('created_at', { ascending: false });

      if (organizationId) {
        orgsQuery = orgsQuery.eq('id', organizationId);
        usersQuery = usersQuery.eq('organization_id', organizationId);
        walletsQuery = walletsQuery.eq('organization_id', organizationId);
        exchangesQuery = exchangesQuery.eq('organization_id', organizationId);
        shiftsQuery = shiftsQuery.eq('organization_id', organizationId);
        incExpQuery = incExpQuery.eq('organization_id', organizationId);
        txsQuery = txsQuery.eq('organization_id', organizationId);
        p2pQuery = p2pQuery.eq('organization_id', organizationId);
        notifsQuery = notifsQuery.eq('organization_id', organizationId);
      }

      const [
        orgsRes,
        usersRes,
        walletsRes,
        exchangesRes,
        shiftsRes,
        incExpRes,
        txsRes,
        p2pRes,
        notifsRes,
      ] = await Promise.all([
        orgsQuery,
        usersQuery,
        walletsQuery,
        exchangesQuery,
        shiftsQuery,
        incExpQuery,
        txsQuery,
        p2pQuery,
        notifsQuery,
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
        featureFlags: o.feature_flags || { p2pCalculator: true, shiftClosing: true, advancedReports: true, customCryptos: true, auditLogs: true },
      }));

      const users: User[] = (usersRes.data || []).map((u: any) => {
        const rawRole = (u.role || '').toUpperCase();
        let normRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' | 'CONTADORA' = 'VENDEDOR';
        if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
        else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';
        else if (rawRole === 'CONTADORA' || rawRole === 'CONTADOR') normRole = 'CONTADORA';

        return {
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email,
          role: normRole,
          organization_id: u.organization_id,
          status: u.status,
          active: u.active,
        };
      });

      const wallets: Wallet[] = (walletsRes.data || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        saldoPesos: Number(w.saldo_pesos || w.saldoPesos || 0),
        saldoUsdt: Number(w.saldo_usdt || w.saldoUsdt || 0),
        color: w.color || 'blue',
        providerType: w.provider_type || w.providerType || 'Fintech',
        titular: w.titular || '',
        vendorId: w.vendor_id || w.vendorId || '',
        vendorName: w.vendor_name || w.vendorName || '',
        organization_id: w.organization_id,
        limitARS: Number(w.limit_ars || w.limitARS || 3000000),
        blocked: Boolean(w.blocked),
      }));

      const exchanges: ExchangeAccount[] = (exchangesRes.data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        balanceCrypto: Number(e.balance_crypto || e.balanceCrypto || 0),
        vendorId: e.vendor_id || e.vendorId,
        vendorName: e.vendor_name || e.vendorName,
        organization_id: e.organization_id,
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
        organization_id: s.organization_id,
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
        organization_id: r.organization_id,
        shiftId: r.shift_id || r.shiftId,
      }));

      const transactions: Transaction[] = (txsRes.data || []).map((row: any) => ({
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
        organization_id: row.organization_id,
        sellerId: row.seller_id || row.sellerId || undefined,
        exchangeId: row.exchange_id || row.exchangeId || undefined,
        exchangeName: row.exchange_name || row.exchangeName || (
          row.notes?.split('|').find((p: string) => p.includes('Exchange:'))?.split('Exchange:')[1]?.trim() || ''
        ),
      }));

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
        organization_id: p.organization_id,
      }));

      const notifications: any[] = (notifsRes?.data || []).map((n: any) => ({
        id: String(n.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
        title: n.title || '',
        message: n.message || '',
        type: n.type || 'info',
        read: Boolean(n.read),
        createdAt: n.created_at || n.createdAt || new Date().toISOString(),
        organization_id: n.organization_id,
        metadata: n.metadata || n.meta || n.data || undefined,
        wallet_name: n.wallet_name || n.walletName,
        wallet_id: n.wallet_id || n.walletId,
        note: n.note || n.notes,
        reason: n.reason || n.motivo,
        motivo: n.motivo || n.reason,
        block_reason: n.block_reason || n.blockReason,
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
        p2pCalcs,
        notifications,
      };
    } catch (err) {
      console.error('Error fetching state from Supabase:', err);
      return null;
    }
  },

  async seedInitialData(state: AppState): Promise<boolean> {
    try {
      if (state.organizations.length > 0) {
        for (const o of state.organizations) {
          try {
            await supabase.rpc('rpc_create_company', {
              p_name: o.name,
              p_tax_id: o.taxId || null,
              p_country: o.country || 'Argentina',
              p_monthly_fee: o.monthlyFee || 0,
              p_subscription_status: o.status || 'active',
              p_subscription_expires_at: o.subscriptionExpiresAt || null,
              p_max_users: o.maxUsers || 10,
              p_max_wallets: 10,
              p_max_exchanges: 10,
              p_storage_limit_mb: 1024,
            });
          } catch (rpcErr) {
            console.warn('Error al ejecutar rpc_create_company en seed:', rpcErr);
          }
        }
      }

      if (state.users.length > 0) {
        const dbUsers = state.users.map(u => ({
          id: u.id || `u-${Date.now()}`,
          username: u.username,
          name: u.name,
          email: u.email || null,
          role: u.role,
          organization_id: u.organization_id,
          status: u.status || 'active',
          active: u.active !== false,
        }));
        await supabase.from('users').upsert(dbUsers);
      }

      if (state.wallets.length > 0) {
        const dbWallets = state.wallets.map(w => ({
          id: w.id,
          name: w.name,
          saldo_pesos: w.saldoPesos,
          saldo_usdt: w.saldoUsdt,
          color: w.color,
          provider_type: w.providerType,
          titular: w.titular,
          vendor_id: w.vendorId,
          vendor_name: w.vendorName,
          organization_id: w.organization_id || null,
          limit_ars: w.limitARS,
          blocked: w.blocked,
        }));
        await supabase.from('wallets').upsert(dbWallets);
      }

      return true;
    } catch (err) {
      console.error('Error al inicializar datos:', err);
      return false;
    }
  },

  async syncIncomeExpense(record: IncomeExpenseRecord): Promise<void> {
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
      organization_id: record.organization_id || null,
      shift_id: record.shiftId || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('income_expenses').upsert(dbRecord);
    if (error) {
      console.error('Error al guardar ingreso/egreso:', error.message);
      throw new Error(error.message || 'No se pudo guardar el movimiento de fondos.');
    }
  },
};
