import { supabase } from '../lib/supabase';
import { Transaction } from '../types';

export const transactionService = {
  async list(organizationId?: string): Promise<Transaction[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

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
  }): Promise<Transaction> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null as any;

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
      });
      if (!rpcErr && rpcRes) {
        return typeof rpcRes === 'object' ? mapTransactionFromDB(rpcRes) : null as any;
      }
    } catch (err) {
      console.warn('RPC rpc_buy no disponible, insertando directamente.');
    }

    const now = new Date();
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'compra',
      timestamp: now.toISOString(),
      dateString: now.toISOString().split('T')[0],
      timeString: now.toTimeString().split(' ')[0],
      crypto: params.crypto,
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      totalPesos: params.totalPesos,
      walletId: params.walletId,
      walletName: params.walletName,
      operator: params.operator,
      supplier: params.supplier,
      notes: params.notes,
      shiftId: params.shiftId,
      organization_id: params.organization_id,
    };

    return this.create(newTx);
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
  }): Promise<Transaction> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null as any;

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
      });
      if (!rpcErr && rpcRes) {
        return typeof rpcRes === 'object' ? mapTransactionFromDB(rpcRes) : null as any;
      }
    } catch (err) {
      console.warn('RPC rpc_sell no disponible, insertando directamente.');
    }

    const now = new Date();
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'venta',
      timestamp: now.toISOString(),
      dateString: now.toISOString().split('T')[0],
      timeString: now.toTimeString().split(' ')[0],
      crypto: params.crypto,
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      totalPesos: params.totalPesos,
      walletId: params.walletId,
      walletName: params.walletName,
      operator: params.operator,
      client: params.client,
      gain: params.gain,
      notes: params.notes,
      shiftId: params.shiftId,
      organization_id: params.organization_id,
    };

    return this.create(newTx);
  },

  async create(tx: Transaction): Promise<Transaction> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return tx;

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
    updated_at: new Date().toISOString(),
  };
}
