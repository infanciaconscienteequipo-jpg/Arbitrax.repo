import { supabase } from '../lib/supabase';
import { Wallet } from '../types';

export const walletService = {
  async list(organizationId?: string): Promise<Wallet[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return wallet;

    const dbWallet = mapWalletToDB(wallet);

    try {
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
      if (!rpcErr && rpcRes) {
        return typeof rpcRes === 'object' ? mapWalletFromDB(rpcRes) : wallet;
      }
    } catch (err) {
      console.warn('RPC rpc_wallet_create no disponible, realizando upsert directo.');
    }

    const { error } = await supabase.from('wallets').upsert(dbWallet);
    if (error) {
      console.error('Error al crear billetera:', error.message);
      throw error;
    }
    return wallet;
  },

  async update(wallet: Wallet): Promise<Wallet> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return wallet;

    const dbWallet = mapWalletToDB(wallet);

    try {
      const { error: rpcErr } = await supabase.rpc('rpc_wallet_update', {
        p_id: wallet.id,
        p_name: wallet.name,
        p_saldo_pesos: wallet.saldoPesos,
        p_saldo_usdt: wallet.saldoUsdt,
        p_blocked: wallet.blocked,
      });
      if (!rpcErr) {
        return wallet;
      }
    } catch (err) {
      console.warn('RPC rpc_wallet_update no disponible, realizando upsert directo.');
    }

    const { error } = await supabase.from('wallets').upsert(dbWallet);
    if (error) {
      console.error('Error al actualizar billetera:', error.message);
      throw error;
    }
    return wallet;
  },

  async delete(id: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    try {
      const { error: rpcErr } = await supabase.rpc('rpc_wallet_delete', { p_id: id });
      if (!rpcErr) return true;
    } catch (err) {
      console.warn('RPC rpc_wallet_delete no disponible, usando delete directo.');
    }

    const { error } = await supabase.from('wallets').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar billetera:', error.message);
      return false;
    }
    return true;
  },

  async balance(walletId: string): Promise<{ pesos: number; usdt: number } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

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
