import { supabase } from '../lib/supabase';
import { Transaction, IncomeExpenseRecord } from '../types';

export const reportService = {
  async getTransactionsReport(organizationId?: string, startDate?: string, endDate?: string): Promise<Transaction[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase.from('transactions').select('*').order('timestamp', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    if (startDate) {
      query = query.gte('date_string', startDate);
    }
    if (endDate) {
      query = query.lte('date_string', endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al generar reporte de transacciones:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      timestamp: row.timestamp || new Date().toISOString(),
      dateString: row.date_string || row.dateString,
      timeString: row.time_string || row.timeString,
      crypto: row.crypto || 'USDT',
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unit_price || 0),
      totalPesos: Number(row.total_pesos || 0),
      walletId: row.wallet_id || '',
      walletName: row.wallet_name || '',
      operator: row.operator || '',
      supplier: row.supplier || '',
      client: row.client || '',
      gain: Number(row.gain || 0),
      commissionBinance: Number(row.commission_binance || 0),
      notes: row.notes || '',
      shiftId: row.shift_id,
      organization_id: row.organization_id,
    }));
  },

  async getIncomeExpensesReport(organizationId?: string): Promise<IncomeExpenseRecord[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase.from('income_expenses').select('*').order('timestamp', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error al generar reporte de ingresos/egresos:', error.message);
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      type: r.type,
      assetType: r.asset_type || 'pesos',
      walletOrExchangeId: r.wallet_or_exchange_id,
      walletOrExchangeName: r.wallet_or_exchange_name,
      timestamp: r.timestamp,
      dateString: r.date_string,
      timeString: r.time_string,
      amount: Number(r.amount || 0),
      transferPerson: r.transfer_person || '',
      reason: r.reason || '',
      proofUrl: r.proof_url,
      operator: r.operator || '',
      vendorId: r.vendor_id,
      organization_id: r.organization_id,
      shiftId: r.shift_id,
    }));
  },
};
