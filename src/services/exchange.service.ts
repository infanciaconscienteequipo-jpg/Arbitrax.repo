import { supabase } from '../lib/supabase';
import { ExchangeAccount } from '../types';

export const exchangeService = {
  async list(organizationId?: string): Promise<ExchangeAccount[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase.from('exchange_accounts').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error al listar exchanges:', error.message);
      return [];
    }
    return (data || []).map(mapExchangeFromDB);
  },

  async create(exchange: ExchangeAccount): Promise<ExchangeAccount> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return exchange;

    const dbRow = mapExchangeToDB(exchange);
    const { error } = await supabase.from('exchange_accounts').upsert(dbRow);
    if (error) {
      console.error('Error al crear exchange:', error.message);
      throw error;
    }
    return exchange;
  },

  async update(exchange: ExchangeAccount): Promise<ExchangeAccount> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return exchange;

    const dbRow = mapExchangeToDB(exchange);
    const { error } = await supabase.from('exchange_accounts').upsert(dbRow);
    if (error) {
      console.error('Error al actualizar exchange:', error.message);
      throw error;
    }
    return exchange;
  },

  async delete(id: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await supabase.from('exchange_accounts').delete().eq('id', id);
    if (error) {
      console.error('Error al eliminar exchange:', error.message);
      return false;
    }
    return true;
  },

  async sync(exchange: ExchangeAccount): Promise<void> {
    await this.update(exchange);
  },
};

function mapExchangeFromDB(e: any): ExchangeAccount {
  return {
    id: e.id,
    name: e.name,
    balanceCrypto: Number(e.balance_crypto || e.balanceCrypto || 0),
    vendorId: e.vendor_id || e.vendorId,
    vendorName: e.vendor_name || e.vendorName,
    organization_id: e.organization_id,
  };
}

function mapExchangeToDB(e: ExchangeAccount) {
  return {
    id: e.id,
    name: e.name,
    balance_crypto: e.balanceCrypto,
    vendor_id: e.vendorId || null,
    vendor_name: e.vendorName || null,
    organization_id: e.organization_id || null,
    updated_at: new Date().toISOString(),
  };
}
