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
    // 1. Obtener la transacción original de Supabase para calcular la diferencia financiera exacta
    const { data: dbOldTx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', tx.id)
      .single();

    if (fetchErr || !dbOldTx) {
      throw new Error(fetchErr?.message || 'No se encontró la transacción original.');
    }

    const oldType = dbOldTx.type as 'compra' | 'venta';
    const oldPesos = Number(dbOldTx.total_pesos || 0);
    const oldQty = Number(dbOldTx.quantity || 0);
    const oldWalletId = dbOldTx.wallet_id;
    const oldExchangeId = dbOldTx.exchange_id || null;

    const newType = tx.type;
    const newPesos = Number(tx.totalPesos || 0);
    const newQty = Number(tx.quantity || 0);
    const newWalletId = tx.walletId;
    const newExchangeId = tx.exchangeId || null;

    // 2. Calcular los deltas para cada billetera (Pesos ARS)
    const walletDeltas: Record<string, number> = {};

    // Revertir efecto de la transacción anterior en la billetera vieja
    if (oldWalletId) {
      // Si fue compra, se descontaron pesos -> Al revertir se devuelven (+oldPesos)
      // Si fue venta, se ingresaron pesos -> Al revertir se restan (-oldPesos)
      const revertPesos = oldType === 'compra' ? oldPesos : -oldPesos;
      walletDeltas[oldWalletId] = (walletDeltas[oldWalletId] || 0) + revertPesos;
    }

    // Aplicar efecto de la nueva transacción en la billetera nueva
    if (newWalletId) {
      // Si es compra, se descuentan pesos (-newPesos)
      // Si es venta, se ingresan pesos (+newPesos)
      const applyPesos = newType === 'compra' ? -newPesos : newPesos;
      walletDeltas[newWalletId] = (walletDeltas[newWalletId] || 0) + applyPesos;
    }

    // 3. Calcular los deltas para cada exchange (Cripto)
    const exchangeDeltas: Record<string, number> = {};

    // Revertir efecto de la transacción anterior en el exchange viejo
    if (oldExchangeId) {
      // Si fue compra, se sumaron criptos al stock -> Al revertir se descuentan (-oldQty)
      // Si fue venta, se restaron criptos del stock -> Al revertir se devuelven (+oldQty)
      const revertCrypto = oldType === 'compra' ? -oldQty : oldQty;
      exchangeDeltas[oldExchangeId] = (exchangeDeltas[oldExchangeId] || 0) + revertCrypto;
    }

    // Aplicar efecto de la nueva transacción en el exchange nuevo
    if (newExchangeId) {
      // Si es compra, se suman criptos al stock (+newQty)
      // Si es venta, se descuentan criptos del stock (-newQty)
      const applyCrypto = newType === 'compra' ? newQty : -newQty;
      exchangeDeltas[newExchangeId] = (exchangeDeltas[newExchangeId] || 0) + applyCrypto;
    }

    // 4. Aplicar cambios a las billeteras en la base de datos
    for (const [wId, delta] of Object.entries(walletDeltas)) {
      if (delta === 0) continue;
      const { data: wRow } = await supabase.from('wallets').select('saldo_pesos').eq('id', wId).single();
      if (wRow) {
        const currentBal = Number(wRow.saldo_pesos || 0);
        const updatedBal = Math.max(0, currentBal + delta);
        const { error: wErr } = await supabase
          .from('wallets')
          .update({ saldo_pesos: updatedBal, updated_at: new Date().toISOString() })
          .eq('id', wId);
        if (wErr) {
          console.error(`Error actualizando saldo de billetera ${wId}:`, wErr.message);
        }
      }
    }

    // 5. Aplicar cambios a los exchanges en la base de datos
    for (const [exId, delta] of Object.entries(exchangeDeltas)) {
      if (delta === 0) continue;
      const { data: exRow } = await supabase.from('exchange_accounts').select('balance_crypto').eq('id', exId).single();
      if (exRow) {
        const currentBal = Number(exRow.balance_crypto || 0);
        const updatedBal = Math.max(0, currentBal + delta);
        const { error: exErr } = await supabase
          .from('exchange_accounts')
          .update({ balance_crypto: updatedBal, updated_at: new Date().toISOString() })
          .eq('id', exId);
        if (exErr) {
          console.error(`Error actualizando balance de exchange ${exId}:`, exErr.message);
        }
      }
    }

    // 6. Actualizar el registro en la tabla transactions
    const { data: updatedTxRow, error: txUpdateErr } = await supabase
      .from('transactions')
      .update({
        type: tx.type,
        timestamp: tx.timestamp || dbOldTx.timestamp,
        crypto: tx.crypto || 'USDT',
        quantity: tx.quantity,
        unit_price: tx.unitPrice,
        total_pesos: tx.totalPesos,
        wallet_id: tx.walletId,
        wallet_name: tx.walletName,
        exchange_id: tx.exchangeId || null,
        supplier: tx.supplier || null,
        client: tx.client || null,
        gain: tx.gain || 0,
        commission_binance: tx.commissionBinance || 0,
        notes: tx.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id)
      .select()
      .single();

    if (txUpdateErr) {
      console.error('Error in updateTransaction direct table update:', txUpdateErr.message);
      throw new Error(txUpdateErr.message || 'Error al actualizar la transacción.');
    }

    return mapTransactionFromDB(updatedTxRow);
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
    // 1. Obtener el registro de fondos original de Supabase
    const { data: dbOldRec, error: fetchErr } = await supabase
      .from('income_expenses')
      .select('*')
      .eq('id', record.id)
      .single();

    if (fetchErr || !dbOldRec) {
      throw new Error(fetchErr?.message || 'No se encontró el registro de fondos original.');
    }

    const oldType = dbOldRec.type as 'ingreso' | 'egreso';
    const oldAssetType = (dbOldRec.asset_type || 'pesos') as 'pesos' | 'exchange';
    const oldTargetId = dbOldRec.wallet_or_exchange_id;
    const oldAmount = Number(dbOldRec.amount || 0);

    const newType = record.type;
    const newAssetType = record.assetType || 'pesos';
    const newTargetId = record.walletOrExchangeId;
    const newAmount = Number(record.amount || 0);

    // 2. Calcular los deltas para billeteras (pesos) y exchanges (cripto)
    const walletDeltas: Record<string, number> = {};
    const exchangeDeltas: Record<string, number> = {};

    // Revertir efecto del registro anterior
    if (oldTargetId) {
      if (oldAssetType === 'pesos') {
        // Si fue ingreso, se sumó dinero -> al revertir se resta (-oldAmount)
        // Si fue egreso, se restó dinero -> al revertir se devuelve (+oldAmount)
        const revert = oldType === 'ingreso' ? -oldAmount : oldAmount;
        walletDeltas[oldTargetId] = (walletDeltas[oldTargetId] || 0) + revert;
      } else {
        const revert = oldType === 'ingreso' ? -oldAmount : oldAmount;
        exchangeDeltas[oldTargetId] = (exchangeDeltas[oldTargetId] || 0) + revert;
      }
    }

    // Aplicar efecto del nuevo registro
    if (newTargetId) {
      if (newAssetType === 'pesos') {
        // Si es ingreso, se suma dinero (+newAmount)
        // Si es egreso, se resta dinero (-newAmount)
        const apply = newType === 'ingreso' ? newAmount : -newAmount;
        walletDeltas[newTargetId] = (walletDeltas[newTargetId] || 0) + apply;
      } else {
        const apply = newType === 'ingreso' ? newAmount : -newAmount;
        exchangeDeltas[newTargetId] = (exchangeDeltas[newTargetId] || 0) + apply;
      }
    }

    // 3. Aplicar cambios a las billeteras
    for (const [wId, delta] of Object.entries(walletDeltas)) {
      if (delta === 0) continue;
      const { data: wRow } = await supabase.from('wallets').select('saldo_pesos').eq('id', wId).single();
      if (wRow) {
        const currentBal = Number(wRow.saldo_pesos || 0);
        const updatedBal = Math.max(0, currentBal + delta);
        const { error: wErr } = await supabase
          .from('wallets')
          .update({ saldo_pesos: updatedBal, updated_at: new Date().toISOString() })
          .eq('id', wId);
        if (wErr) console.error(`Error actualizando saldo de billetera ${wId}:`, wErr.message);
      }
    }

    // 4. Aplicar cambios a los exchanges
    for (const [exId, delta] of Object.entries(exchangeDeltas)) {
      if (delta === 0) continue;
      const { data: exRow } = await supabase.from('exchange_accounts').select('balance_crypto').eq('id', exId).single();
      if (exRow) {
        const currentBal = Number(exRow.balance_crypto || 0);
        const updatedBal = Math.max(0, currentBal + delta);
        const { error: exErr } = await supabase
          .from('exchange_accounts')
          .update({ balance_crypto: updatedBal, updated_at: new Date().toISOString() })
          .eq('id', exId);
        if (exErr) console.error(`Error actualizando balance de exchange ${exId}:`, exErr.message);
      }
    }

    // 5. Actualizar la fila en income_expenses
    const { data: updatedRec, error: recErr } = await supabase
      .from('income_expenses')
      .update({
        type: record.type,
        asset_type: record.assetType,
        wallet_or_exchange_id: record.walletOrExchangeId,
        wallet_or_exchange_name: record.walletOrExchangeName,
        amount: record.amount,
        transfer_person: record.transferPerson || null,
        reason: record.reason || null,
        proof_url: record.proofUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (recErr) {
      console.error('Error al actualizar registro de fondos:', recErr.message);
      throw new Error(recErr.message || 'Error al actualizar el registro de fondos.');
    }

    return updatedRec || record;
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
