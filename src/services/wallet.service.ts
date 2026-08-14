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
    const { error: rpcErr } = await supabase.rpc('rpc_wallet_update', {
      p_id: wallet.id,
      p_name: wallet.name,
      p_saldo_pesos: wallet.saldoPesos,
      p_saldo_usdt: wallet.saldoUsdt,
      p_blocked: wallet.blocked,
    });
    if (rpcErr) {
      console.error('Error in rpc_wallet_update:', rpcErr.message);
      throw new Error(rpcErr.message || 'Error al actualizar billetera');
    }
    return wallet;
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
    updated_at: new Date().toISOString(),
  };
}
