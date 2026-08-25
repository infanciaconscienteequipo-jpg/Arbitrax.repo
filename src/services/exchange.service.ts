import { supabase } from '../lib/supabase';
import { ExchangeAccount } from '../types';

export const exchangeService = {
  async list(organizationId?: string): Promise<ExchangeAccount[]> {
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
    const dbRow = mapExchangeToDB(exchange);
    if (!dbRow.id) {
      delete dbRow.id;
    }
    const { data, error } = await supabase.from('exchange_accounts').insert(dbRow).select();
    if (error) {
      console.error('Error al crear exchange:', error.message);
      throw error;
    }
    if (data && data.length > 0) {
      return mapExchangeFromDB(data[0]);
    }
    return exchange;
  },

  async update(exchange: ExchangeAccount): Promise<ExchangeAccount> {
    const dbRow = mapExchangeToDB(exchange);
    const { data, error } = await supabase
      .from('exchange_accounts')
      .update(dbRow)
      .eq('id', exchange.id)
      .select();
    if (error) {
      console.error('Error al actualizar exchange:', error.message);
      throw error;
    }
    if (data && data.length > 0) {
      return mapExchangeFromDB(data[0]);
    }
    return exchange;
  },

  async archiveExchange(id: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('rpc_exchange_archive_v2', {
        p_exchange_id: id,
      });
      if (!error && (data === true || (typeof data === 'object' && data?.success !== false))) {
        return true;
      }
    } catch (err) {
      console.warn('rpc_exchange_archive_v2 error, fallback to table update:', err);
    }

    const { error: directErr } = await supabase
      .from('exchange_accounts')
      .update({ archived: true, status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (directErr) {
      console.error('Error al archivar exchange:', directErr.message);
      throw new Error(directErr.message || 'No se pudo archivar el exchange.');
    }
    return true;
  },

  async unarchiveExchange(id: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('rpc_exchange_unarchive_v2', {
        p_exchange_id: id,
      });
      if (!error && (data === true || (typeof data === 'object' && data?.success !== false))) {
        return true;
      }
    } catch (err) {
      console.warn('rpc_exchange_unarchive_v2 error, fallback to table update:', err);
    }

    const { error: directErr } = await supabase
      .from('exchange_accounts')
      .update({ archived: false, status: 'ACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (directErr) {
      console.error('Error al desarchivar exchange:', directErr.message);
      throw new Error(directErr.message || 'No se pudo desarchivar el exchange.');
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
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
    archived: Boolean(e.archived || e.status === 'ARCHIVED'),
    status: e.status || (e.archived ? 'ARCHIVED' : 'ACTIVE'),
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
    status: e.status || (e.archived ? 'ARCHIVED' : 'ACTIVE'),
    archived: Boolean(e.archived || e.status === 'ARCHIVED'),
    updated_at: new Date().toISOString(),
  };
}
