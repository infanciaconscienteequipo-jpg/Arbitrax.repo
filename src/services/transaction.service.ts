import { supabase } from '../lib/supabase';
import { Transaction, IncomeExpenseRecord } from '../types';

// Helper functions to find and adjust wallet and exchange balances reliably by ID or Name
async function findAndAdjustWalletBalance(idOrName: string | undefined | null, nameFallback: string | undefined | null, delta: number) {
  if (delta === 0) return;
  if (!idOrName && !nameFallback) return;

  // 1. Try finding by ID
  let targetRow: any = null;
  if (idOrName) {
    const { data: byId } = await supabase.from('wallets').select('id, name, saldo_pesos').eq('id', idOrName).maybeSingle();
    if (byId) targetRow = byId;
  }

  // 2. If not found, try by name
  if (!targetRow && nameFallback) {
    const { data: byName } = await supabase.from('wallets').select('id, name, saldo_pesos').ilike('name', nameFallback.trim()).maybeSingle();
    if (byName) targetRow = byName;
  }

  // 3. If still not found, try idOrName as name
  if (!targetRow && idOrName) {
    const { data: byIdAsName } = await supabase.from('wallets').select('id, name, saldo_pesos').ilike('name', idOrName.trim()).maybeSingle();
    if (byIdAsName) targetRow = byIdAsName;
  }

  // 4. Fallback search across all wallets
  if (!targetRow) {
    const { data: allWallets } = await supabase.from('wallets').select('id, name, saldo_pesos');
    if (allWallets && allWallets.length > 0) {
      const searchTerms = [idOrName, nameFallback].filter(Boolean).map(s => String(s).trim().toLowerCase());
      targetRow = allWallets.find(w => 
        searchTerms.includes(w.id.toLowerCase()) || 
        searchTerms.includes(w.name.trim().toLowerCase())
      ) || null;
    }
  }

  if (targetRow) {
    const currentBal = Number(targetRow.saldo_pesos || 0);
    const updatedBal = Math.max(0, currentBal + delta);
    const { error: updErr } = await supabase
      .from('wallets')
      .update({ saldo_pesos: updatedBal, updated_at: new Date().toISOString() })
      .eq('id', targetRow.id);

    if (updErr) {
      console.error(`[Error actualizando billetera ${targetRow.name} (${targetRow.id})]:`, updErr.message);
      throw new Error(`Error al actualizar saldo de la billetera ${targetRow.name}: ${updErr.message}`);
    }
  } else {
    console.warn(`[findAndAdjustWalletBalance] No se encontró billetera para ID: "${idOrName}", Nombre: "${nameFallback}"`);
  }
}

async function findAndAdjustExchangeBalance(idOrName: string | undefined | null, nameFallback: string | undefined | null, delta: number) {
  if (delta === 0) return;
  if (!idOrName && !nameFallback) return;

  // 1. Try finding by ID
  let targetRow: any = null;
  if (idOrName) {
    const { data: byId } = await supabase.from('exchange_accounts').select('id, name, balance_crypto').eq('id', idOrName).maybeSingle();
    if (byId) targetRow = byId;
  }

  // 2. If not found, try by name
  if (!targetRow && nameFallback) {
    const { data: byName } = await supabase.from('exchange_accounts').select('id, name, balance_crypto').ilike('name', nameFallback.trim()).maybeSingle();
    if (byName) targetRow = byName;
  }

  // 3. If still not found, try idOrName as name
  if (!targetRow && idOrName) {
    const { data: byIdAsName } = await supabase.from('exchange_accounts').select('id, name, balance_crypto').ilike('name', idOrName.trim()).maybeSingle();
    if (byIdAsName) targetRow = byIdAsName;
  }

  // 4. Fallback search across all exchanges
  if (!targetRow) {
    const { data: allExchanges } = await supabase.from('exchange_accounts').select('id, name, balance_crypto');
    if (allExchanges && allExchanges.length > 0) {
      const searchTerms = [idOrName, nameFallback].filter(Boolean).map(s => String(s).trim().toLowerCase());
      targetRow = allExchanges.find(e => 
        searchTerms.includes(e.id.toLowerCase()) || 
        searchTerms.includes(e.name.trim().toLowerCase())
      ) || null;
    }
  }

  if (targetRow) {
    const currentBal = Number(targetRow.balance_crypto || 0);
    const updatedBal = Math.max(0, currentBal + delta);
    const { error: updErr } = await supabase
      .from('exchange_accounts')
      .update({ balance_crypto: updatedBal, updated_at: new Date().toISOString() })
      .eq('id', targetRow.id);

    if (updErr) {
      console.error(`[Error actualizando exchange ${targetRow.name} (${targetRow.id})]:`, updErr.message);
      throw new Error(`Error al actualizar balance de exchange ${targetRow.name}: ${updErr.message}`);
    }
  } else {
    console.warn(`[findAndAdjustExchangeBalance] No se encontró exchange para ID: "${idOrName}", Nombre: "${nameFallback}"`);
  }
}

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
    // La edición financiera se ejecuta 100% en Supabase mediante una RPC atómica.
    // Esto evita que wallet/exchange queden desincronizados si una de las etapas falla.
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_transaction_update_v3', {
      p_transaction_id: tx.id,
      p_type: tx.type,
      p_crypto: tx.crypto || 'USDT',
      p_quantity: Number(tx.quantity || 0),
      p_unit_price: Number(tx.unitPrice || 0),
      p_total_pesos: Number(tx.totalPesos || 0),
      p_wallet_id: tx.walletId,
      p_wallet_name: tx.walletName,
      p_exchange_id: tx.exchangeId || null,
      p_supplier: tx.supplier || null,
      p_client: tx.client || null,
      p_gain: Number(tx.gain || 0),
      p_commission_binance: Number(tx.commissionBinance || 0),
      p_notes: tx.notes || null,
    });

    if (rpcErr) {
      console.error('Error en rpc_transaction_update_v3:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al actualizar la transacción.');
    }

    if (!rpcRes) {
      throw new Error('Supabase no devolvió la transacción actualizada.');
    }

    return mapTransactionFromDB(rpcRes);
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
    // La edición de fondos también se ejecuta como una única transacción SQL.
    // Regla: primero se revierte el movimiento original y luego se aplica
    // exactamente el movimiento nuevo, incluyendo cambio de wallet/exchange,
    // tipo y monto.
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_income_expense_update_v3', {
      p_income_expense_id: record.id,
      p_type: record.type,
      p_asset_type: record.assetType,
      p_wallet_or_exchange_id: record.walletOrExchangeId,
      p_wallet_or_exchange_name: record.walletOrExchangeName,
      p_amount: Number(record.amount || 0),
      p_transfer_person: record.transferPerson || null,
      p_reason: record.reason || null,
      p_proof_url: record.proofUrl || null,
    });

    if (rpcErr) {
      console.error('Error en rpc_income_expense_update_v3:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al actualizar el registro de fondos.');
    }

    if (!rpcRes) {
      throw new Error('Supabase no devolvió el registro de fondos actualizado.');
    }

    return mapIncomeExpenseFromDB(rpcRes);
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

function mapIncomeExpenseFromDB(row: any): IncomeExpenseRecord {
  return {
    id: row.id,
    type: row.type,
    assetType: row.asset_type || row.assetType || 'pesos',
    walletOrExchangeId: row.wallet_or_exchange_id || row.walletOrExchangeId || '',
    walletOrExchangeName: row.wallet_or_exchange_name || row.walletOrExchangeName || '',
    timestamp: row.timestamp || new Date().toISOString(),
    dateString: row.date_string || row.dateString || '',
    timeString: row.time_string || row.timeString || '',
    amount: Number(row.amount || 0),
    transferPerson: row.transfer_person || row.transferPerson || '',
    reason: row.reason || '',
    proofUrl: row.proof_url || row.proofUrl || undefined,
    operator: row.operator || '',
    vendorId: row.vendor_id || row.vendorId || undefined,
    organization_id: row.organization_id,
    shiftId: row.shift_id || row.shiftId || undefined,
  };
}

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
    exchange_id: t.exchangeId || null,
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
