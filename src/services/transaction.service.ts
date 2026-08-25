import { supabase } from '../lib/supabase';
import { Transaction, IncomeExpenseRecord } from '../types';

export const transactionService = {
  async list(organizationId?: string): Promise<Transaction[]> {
    try {
      if (organizationId) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_transaction_list', {
          p_organization_id: organizationId,
        });
        if (!rpcErr && Array.isArray(rpcData)) {
          return rpcData.map(mapTransactionFromDB);
        }
      }
    } catch (err) {
      console.warn('RPC rpc_transaction_list no disponible, usando fallback directo.');
    }

    let query = supabase.from('transactions').select('*').order('timestamp', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener transacciones:', error.message);
      return [];
    }
    return (data || []).map(mapTransactionFromDB);
  },

  async updateTransaction(tx: Transaction): Promise<Transaction> {
    const rpcParams = {
      p_id: tx.id,
      p_type: tx.type,
      p_timestamp: tx.timestamp || new Date().toISOString(),
      p_crypto: tx.crypto || 'USDT',
      p_quantity: tx.quantity,
      p_unit_price: tx.unitPrice,
      p_total_pesos: tx.totalPesos,
      p_wallet_id: tx.walletId,
      p_exchange_id: tx.exchangeId || null,
      p_supplier: tx.supplier || null,
      p_client: tx.client || null,
      p_gain: tx.gain || 0,
      p_commission_binance: tx.commissionBinance || 0,
      p_notes: tx.notes || null,
    };

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_transaction_update_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_transaction_update_v2', {
      rpc: 'rpc_transaction_update_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_transaction_update_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al actualizar la transacción.');
    }

    if (rpcRes && typeof rpcRes === 'object') {
      return mapTransactionFromDB(rpcRes);
    }
    return tx;
  },

  async fetchTransactionsPage(params: {
    page: number;
    pageSize: number;
    search?: string;
    type?: string;
    walletId?: string;
    exchangeId?: string;
    sellerId?: string;
    crypto?: string;
    from?: string;
    to?: string;
    hourFrom?: string;
    hourTo?: string;
  }): Promise<{ data: Transaction[]; totalCount: number; totalPages: number }> {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_transactions_page_v2', {
      p_page: params.page,
      p_page_size: params.pageSize,
      p_type: params.type && params.type !== 'all' ? params.type : null,
      p_wallet_id: params.walletId && params.walletId !== 'all' ? params.walletId : null,
      p_exchange_id: params.exchangeId && params.exchangeId !== 'all' ? params.exchangeId : null,
      p_seller_id: params.sellerId && params.sellerId !== 'all' ? params.sellerId : null,
      p_crypto: params.crypto && params.crypto !== 'all' ? params.crypto : null,
      p_search: params.search || null,
      p_from: params.from || null,
      p_to: params.to || null,
      p_hour_from: params.hourFrom || null,
      p_hour_to: params.hourTo || null,
    });

    if (rpcErr) {
      console.error('Error in rpc_transactions_page_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al obtener página de transacciones');
    }

    const records = Array.isArray(rpcData?.records) ? rpcData.records.map(mapTransactionFromDB) : [];
    const totalCount = Number(rpcData?.total_count || rpcData?.totalCount || records.length || 0);
    const totalPages = Number(rpcData?.total_pages || rpcData?.totalPages || Math.max(1, Math.ceil(totalCount / params.pageSize)));

    return {
      data: records,
      totalCount,
      totalPages,
    };
  },

  async createIncomeExpense(record: {
    type: 'ingreso' | 'egreso';
    assetType: 'pesos' | 'exchange';
    walletOrExchangeId: string;
    amount: number;
    timestamp?: string;
    transferPerson?: string;
    reason?: string;
    proofUrl?: string;
    shiftId?: string;
  }): Promise<any> {
    const rpcParams = {
      p_type: record.type,
      p_asset_type: record.assetType,
      p_wallet_or_exchange_id: record.walletOrExchangeId,
      p_amount: record.amount,
      p_timestamp: record.timestamp || new Date().toISOString(),
      p_transfer_person: record.transferPerson || null,
      p_reason: record.reason || null,
      p_proof_url: record.proofUrl || null,
      p_shift_id: record.shiftId || null,
    };

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_income_expense_create_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_income_expense_create_v2', {
      rpc: 'rpc_income_expense_create_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_income_expense_create_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al registrar el movimiento de fondos.');
    }

    return rpcRes;
  },

  async updateIncomeExpense(record: IncomeExpenseRecord): Promise<IncomeExpenseRecord> {
    const rpcParams = {
      p_id: record.id,
      p_type: record.type,
      p_asset_type: record.assetType,
      p_wallet_or_exchange_id: record.walletOrExchangeId,
      p_amount: record.amount,
      p_timestamp: record.timestamp || new Date().toISOString(),
      p_transfer_person: record.transferPerson || null,
      p_reason: record.reason || null,
      p_proof_url: record.proofUrl || null,
    };

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_income_expense_update_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_income_expense_update_v2', {
      rpc: 'rpc_income_expense_update_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_income_expense_update_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al actualizar el registro de fondos.');
    }

    if (rpcRes && typeof rpcRes === 'object') {
      return rpcRes;
    }
    return record;
  },

  async buy(params: {
    crypto: string;
    quantity: number;
    unitPrice: number;
    totalPesos: number;
    walletId: string;
    walletName: string;
    operator: string;
    supplier?: string;
    notes?: string;
    shiftId?: string;
    organization_id: string;
    exchangeId?: string;
    exchangeName?: string;
    sellerId?: string;
  }): Promise<Transaction> {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_buy', {
        p_crypto: params.crypto,
        p_quantity: params.quantity,
        p_unit_price: params.unitPrice,
        p_total_pesos: params.totalPesos,
        p_wallet_id: params.walletId,
        p_wallet_name: params.walletName,
        p_operator: params.operator,
        p_supplier: params.supplier || null,
        p_notes: params.notes || null,
        p_shift_id: params.shiftId || null,
        p_organization_id: params.organization_id,
        p_exchange_id: params.exchangeId || null,
      });
      if (rpcErr) {
        throw new Error(rpcErr.message || 'No se pudo registrar la compra.');
      }
      if (!rpcRes) {
        throw new Error('Supabase no devolvió la compra registrada.');
      }
      return typeof rpcRes === 'object' ? mapTransactionFromDB(rpcRes) : null as any;
    } catch (err: any) {
      console.error('Error en rpc_buy:', err);
      throw err instanceof Error ? err : new Error(err?.message || 'No se pudo registrar la compra.');
    }

  },

  async sell(params: {
    crypto: string;
    quantity: number;
    unitPrice: number;
    totalPesos: number;
    walletId: string;
    walletName: string;
    operator: string;
    client?: string;
    gain?: number;
    notes?: string;
    shiftId?: string;
    organization_id: string;
    exchangeId?: string;
    exchangeName?: string;
    sellerId?: string;
  }): Promise<Transaction> {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_sell', {
        p_crypto: params.crypto,
        p_quantity: params.quantity,
        p_unit_price: params.unitPrice,
        p_total_pesos: params.totalPesos,
        p_wallet_id: params.walletId,
        p_wallet_name: params.walletName,
        p_operator: params.operator,
        p_client: params.client || null,
        p_gain: params.gain || 0,
        p_notes: params.notes || null,
        p_shift_id: params.shiftId || null,
        p_organization_id: params.organization_id,
        p_exchange_id: params.exchangeId || null,
      });
      if (rpcErr) {
        throw new Error(rpcErr.message || 'No se pudo registrar la venta.');
      }
      if (!rpcRes) {
        throw new Error('Supabase no devolvió la venta registrada.');
      }
      return typeof rpcRes === 'object' ? mapTransactionFromDB(rpcRes) : null as any;
    } catch (err: any) {
      console.error('Error en rpc_sell:', err);
      throw err instanceof Error ? err : new Error(err?.message || 'No se pudo registrar la venta.');
    }

  },

  async create(tx: Transaction): Promise<Transaction> {
    const dbTx = mapTransactionToDB(tx);
    const { error } = await supabase.from('transactions').upsert(dbTx);
    if (error) {
      console.error('Error al guardar transacción:', error.message);
      throw error;
    }
    return tx;
  },

  async sync(tx: Transaction): Promise<void> {
    await this.create(tx);
  },
};

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
    organization_id: row.organization_id,
    sellerId: row.seller_id || row.sellerId || undefined,
    exchangeId: row.exchange_id || row.exchangeId || undefined,
    exchangeName: row.exchange_name || row.exchangeName || (
      row.notes?.split('|').find((p: string) => p.includes('Exchange:'))?.split('Exchange:')[1]?.trim() || ''
    ),
  };
}

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
    supplier: t.supplier || null,
    client: t.client || null,
    gain: t.gain || 0,
    commission_binance: t.commissionBinance || 0,
    notes: t.notes || '',
    shift_id: t.shiftId || null,
    organization_id: t.organization_id || null,
    seller_id: t.sellerId || null,
    updated_at: new Date().toISOString(),
  };
}
