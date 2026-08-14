import { supabase } from '../lib/supabase';
import { Transaction } from '../types';

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
