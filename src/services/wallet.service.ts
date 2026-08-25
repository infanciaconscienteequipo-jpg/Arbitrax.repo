import { supabase } from '../lib/supabase';
import { Wallet, CryptoAdminTransfer } from '../types';

export const walletService = {
  async list(organizationId?: string): Promise<Wallet[]> {
    try {
      if (organizationId) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_wallet_list', {
          p_organization_id: organizationId,
        });
        if (!rpcErr && Array.isArray(rpcData)) {
          return rpcData.map(mapWalletFromDB);
        }
      }
    } catch (err) {
      console.warn('RPC rpc_wallet_list no disponible, usando fallback directo.');
    }

    let query = supabase.from('wallets').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener billeteras:', error.message);
      return [];
    }
    return (data || []).map(mapWalletFromDB);
  },

  async create(wallet: Wallet): Promise<Wallet> {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_wallet_create', {
      p_name: wallet.name,
      p_saldo_pesos: wallet.saldoPesos,
      p_saldo_usdt: wallet.saldoUsdt,
      p_color: wallet.color,
      p_provider_type: wallet.providerType,
      p_titular: wallet.titular,
      p_vendor_id: wallet.vendorId,
      p_organization_id: wallet.organization_id,
    });
    if (rpcErr) {
      console.error('Error in rpc_wallet_create:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al crear billetera');
    }
    if (rpcRes) {
      if (typeof rpcRes === 'object' && rpcRes !== null) {
        return mapWalletFromDB(Array.isArray(rpcRes) ? rpcRes[0] : rpcRes);
      }
      if (typeof rpcRes === 'string') {
        return { ...wallet, id: rpcRes };
      }
    }
    return wallet;
  },

  async update(wallet: Wallet): Promise<Wallet> {
    const rpcParams = {
      p_id: wallet.id,
      p_name: wallet.name,
      p_limit_ars: wallet.limitARS,
      p_titular: wallet.titular || null,
      p_color: wallet.color || null,
      p_provider_type: wallet.providerType || null,
    };
    const { data: rpcRes, error: rpcV2Err } = await supabase.rpc('rpc_wallet_update_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_wallet_update_v2 (update)', {
      rpc: 'rpc_wallet_update_v2',
      parametros: rpcParams,
      errorCompleto: rpcV2Err,
      respuestaRecibida: rpcRes,
    });

    if (rpcV2Err) {
      console.error('Error in rpc_wallet_update_v2:', rpcV2Err.message);
      throw new Error(rpcV2Err.message || 'Error al actualizar billetera');
    }

    const { data: dbW, error: getErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', wallet.id)
      .single();

    if (getErr || !dbW) {
      throw new Error(getErr?.message || 'Error al consultar billetera actualizada');
    }
    return mapWalletFromDB(dbW);
  },

  async updateWalletLimit(walletId: string, limitARS: number): Promise<Wallet> {
    if (typeof limitARS !== 'number' || isNaN(limitARS) || limitARS < 0) {
      throw new Error('El límite debe ser un monto válido mayor o igual a 0.');
    }

    const { data: currentW, error: findErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (findErr || !currentW) {
      throw new Error(findErr?.message || 'Billetera no encontrada');
    }

    return this.update({
      ...mapWalletFromDB(currentW),
      limitARS,
    });
  },

  async transferBetweenWallets(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    notes?: string;
    operator?: string;
    organizationId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (params.fromWalletId === params.toWalletId) {
      return { success: false, error: 'La billetera de origen y destino deben ser distintas.' };
    }
    if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount <= 0) {
      return { success: false, error: 'El monto a transferir debe ser mayor a 0.' };
    }

    // Intento 1: RPC rpc_wallet_transfer_v2
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_wallet_transfer_v2', {
        p_from_wallet_id: params.fromWalletId,
        p_to_wallet_id: params.toWalletId,
        p_amount: params.amount,
        p_notes: params.notes || 'Transferencia entre billeteras',
        p_operator: params.operator || 'Operador',
        p_organization_id: params.organizationId || null,
      });

      if (!rpcErr && (rpcRes === true || (typeof rpcRes === 'object' && rpcRes?.success !== false))) {
        return { success: true };
      }
      if (rpcErr) {
        console.warn('rpc_wallet_transfer_v2 error:', rpcErr.message);
      }
    } catch (err) {
      console.warn('rpc_wallet_transfer_v2 fallo, usando fallback atómico:', err);
    }

    // Intento 2: Fallback controlado con fundWallet
    try {
      // 1. Descontar de origen
      await this.fundWallet({
        walletId: params.fromWalletId,
        amount: params.amount,
        type: 'egreso_fondos',
        organizationId: params.organizationId,
      });

      // 2. Acreditar en destino
      await this.fundWallet({
        walletId: params.toWalletId,
        amount: params.amount,
        type: 'ingreso_fondos',
        organizationId: params.organizationId,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al procesar la transferencia entre billeteras.' };
    }
  },

  async fundWallet(params: {
    walletId: string;
    amount: number;
    type: 'ingreso_fondos' | 'egreso_fondos';
    organizationId?: string;
    notes?: string;
    shiftId?: string;
  }): Promise<Wallet> {
    if (typeof params.amount !== 'number' || isNaN(params.amount) || params.amount <= 0) {
      throw new Error('El monto debe ser un número positivo.');
    }

    const mappedType = params.type === 'ingreso_fondos' ? 'ingreso' : 'egreso';
    const rpcParams = {
      p_type: mappedType,
      p_asset_type: 'pesos',
      p_wallet_or_exchange_id: params.walletId,
      p_amount: params.amount,
      p_timestamp: new Date().toISOString(),
      p_transfer_person: null,
      p_reason: params.notes || (params.type === 'ingreso_fondos' ? 'Ingreso de fondos' : 'Egreso de fondos'),
      p_proof_url: null,
      p_shift_id: params.shiftId || null,
    };

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_income_expense_create_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_income_expense_create_v2 (fundWallet)', {
      rpc: 'rpc_income_expense_create_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_income_expense_create_v2 (fundWallet):', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al procesar movimiento de fondos.');
    }

    const { data: dbW, error: getErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', params.walletId)
      .single();

    if (getErr || !dbW) {
      throw new Error(getErr?.message || 'Error al consultar billetera actualizada');
    }

    return mapWalletFromDB(dbW);
  },

  async block(walletId: string, note: string = ''): Promise<boolean> {
    const { data, error } = await supabase.rpc('rpc_block_wallet', {
      p_wallet_id: walletId,
      p_confirm: true,
      p_note: note,
    });
    if (error) {
      console.error('RPC rpc_block_wallet error:', error.message);
      throw new Error(error.message || 'Error al bloquear billetera');
    }
    if (data !== true) {
      throw new Error('La billetera no pudo ser bloqueada.');
    }
    return true;
  },

  async unblock(walletId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('rpc_unblock_wallet', {
      p_wallet_id: walletId,
    });
    if (error) {
      console.error('RPC rpc_unblock_wallet error:', error.message);
      throw new Error(error.message || 'Error al desbloquear billetera');
    }
    if (data !== true) {
      throw new Error('La billetera no pudo ser desbloqueada.');
    }
    return true;
  },

  async transferCryptoToAdmin(params: {
    exchangeId: string;
    amount: number;
    asset?: string;
    notes?: string;
    vendorId?: string;
    vendorName?: string;
    organizationId?: string;
  }): Promise<{ success: boolean; error?: string; remaining_balance?: number }> {
    try {
      const { data, error } = await supabase.rpc('rpc_transfer_crypto_to_admin', {
        p_exchange_id: params.exchangeId,
        p_amount: params.amount,
        p_asset: params.asset || 'USDT',
        p_notes: params.notes || '',
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (!data || data.success !== true) {
        return { success: false, error: 'Supabase no confirmó la transferencia.' };
      }
      return {
        success: true,
        remaining_balance: Number(data.remaining_balance ?? 0),
      };
    } catch (err: any) {
      console.error('Error in rpc_transfer_crypto_to_admin:', err);
      return { success: false, error: err?.message || 'Error al procesar transferencia' };
    }
  },

  async listCryptoAdminTransfers(organizationId?: string): Promise<CryptoAdminTransfer[]> {
    try {
      let query = supabase.from('crypto_admin_transfers').select('*').order('created_at', { ascending: false });
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching crypto_admin_transfers:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        id: row.id,
        vendorId: row.vendor_id || '',
        vendorName: row.vendor_name || 'Vendedor',
        fromExchangeId: row.from_exchange_id || '',
        fromExchangeName: row.from_exchange_name || 'Exchange',
        amount: Number(row.amount || 0),
        asset: row.asset || 'USDT',
        status: row.status || 'COMPLETED',
        notes: row.notes || '',
        organization_id: row.organization_id,
        createdAt: row.created_at || new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('Error in listCryptoAdminTransfers:', err);
      return [];
    }
  },

  async delete(id: string): Promise<boolean> {
    const { error: rpcErr } = await supabase.rpc('rpc_wallet_delete', { p_id: id });
    if (rpcErr) {
      console.error('Error in rpc_wallet_delete:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al eliminar billetera');
    }
    return true;
  },

  async balance(walletId: string): Promise<{ pesos: number; usdt: number } | null> {
    try {
      const { data, error } = await supabase.rpc('rpc_wallet_balance', { p_wallet_id: walletId });
      if (!error && data) {
        return {
          pesos: Number(data.saldo_pesos || 0),
          usdt: Number(data.saldo_usdt || 0),
        };
      }
    } catch (err) {
      console.warn('RPC rpc_wallet_balance no disponible.');
    }
    return null;
  },

  async transfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amountPesos?: number;
    amountUsdt?: number;
    organizationId: string;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('rpc_wallet_transfer', {
        p_from_id: params.fromWalletId,
        p_to_id: params.toWalletId,
        p_amount_pesos: params.amountPesos || 0,
        p_amount_usdt: params.amountUsdt || 0,
        p_organization_id: params.organizationId,
      });
      if (!error) return true;
    } catch (err) {
      console.warn('RPC rpc_wallet_transfer no disponible.');
    }
    return false;
  },

  async archiveWallet(id: string): Promise<boolean> {
    const rpcParams = { p_id: id };
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_wallet_archive_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_wallet_archive_v2', {
      rpc: 'rpc_wallet_archive_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_wallet_archive_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'No se pudo archivar la billetera.');
    }
    return true;
  },

  async unarchiveWallet(id: string): Promise<boolean> {
    const rpcParams = { p_id: id };
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_wallet_unarchive_v2', rpcParams);

    console.error('[DIAGNOSTICO RPC] rpc_wallet_unarchive_v2', {
      rpc: 'rpc_wallet_unarchive_v2',
      parametros: rpcParams,
      errorCompleto: rpcErr,
      respuestaRecibida: rpcRes,
    });

    if (rpcErr) {
      console.error('Error in rpc_wallet_unarchive_v2:', rpcErr.message);
      throw new Error(rpcErr.message || 'No se pudo desarchivar la billetera.');
    }
    return true;
  },

  async sync(wallet: Wallet): Promise<void> {
    await this.update(wallet);
  },
};

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
    organization_id: row.organization_id,
    limitARS: Number(row.limit_ars || row.limitARS || 3000000),
    blocked: Boolean(row.blocked),
    archived: Boolean(row.archived || row.status === 'ARCHIVED' || row.status === 'archived'),
    status: row.status || (row.archived ? 'ARCHIVED' : 'ACTIVE'),
  };
}

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
    organization_id: w.organization_id || null,
    limit_ars: w.limitARS,
    blocked: w.blocked,
    archived: w.archived,
    status: w.status,
    updated_at: new Date().toISOString(),
  };
}
