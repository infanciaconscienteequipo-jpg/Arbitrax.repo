import { supabase } from '../lib/supabase';
import { Organization } from '../types';

export const organizationService = {
  async list(): Promise<Organization[]> {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_list_companies');
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData.map(mapOrgFromDB);
      }
    } catch (err) {
      console.warn('RPC rpc_list_companies no disponible, usando fallback directo.');
    }

    const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error al listar organizaciones:', error.message);
      return [];
    }
    return (data || []).map(mapOrgFromDB);
  },

  async getById(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapOrgFromDB(data);
  },

  async create(org: Partial<Organization>): Promise<Organization> {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_create_company', {
        p_name: org.name,
        p_tax_id: org.taxId || null,
        p_country: org.country || 'Argentina',
        p_monthly_fee: org.monthlyFee || 0,
        p_subscription_status: org.status || 'active',
        p_subscription_expires_at: org.subscriptionExpiresAt || null,
        p_max_users: org.maxUsers || 10,
        p_max_wallets: (org as any).maxWallets || 10,
        p_max_exchanges: (org as any).maxExchanges || 10,
        p_storage_limit_mb: (org as any).storageLimitMb || 1024,
      });

      if (!rpcErr && rpcRes) {
        if (Array.isArray(rpcRes) && rpcRes.length > 0) {
          return mapOrgFromDB(rpcRes[0]);
        } else if (typeof rpcRes === 'object' && rpcRes.id) {
          return mapOrgFromDB(rpcRes);
        } else if (typeof rpcRes === 'string') {
          const fetched = await this.getById(rpcRes);
          if (fetched) return fetched;
        }
      }
    } catch (e) {
      console.warn('RPC rpc_create_company falló, intentando inserción directa:', e);
    }

    // Direct insertion fallback into organizations table
    const newOrgPayload = {
      id: crypto.randomUUID(),
      name: org.name,
      tax_id: org.taxId || null,
      country: org.country || 'Argentina',
      status: org.status || 'active',
      active: org.status === 'active',
      monthly_fee: org.monthlyFee || 0,
      subscription_expires_at: org.subscriptionExpiresAt || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('organizations').insert(newOrgPayload).select().single();
    if (error) {
      console.error('Error al crear organización directamente:', error.message);
      throw new Error(error.message);
    }
    return mapOrgFromDB(data);
  },

  async update(org: Organization): Promise<Organization> {
    try {
      const { error: rpcErr } = await supabase.rpc('rpc_update_company', {
        p_org_id: org.id,
        p_name: org.name,
        p_tax_id: org.taxId || null,
        p_status: org.status,
        p_monthly_fee: org.monthlyFee,
      });
      if (!rpcErr) {
        return org;
      }
    } catch (err) {
      console.warn('RPC rpc_update_company no disponible, usando update directo.');
    }

    const { error } = await supabase
      .from('organizations')
      .update({
        name: org.name,
        tax_id: org.taxId || null,
        status: org.status,
        active: org.status === 'active',
        monthly_fee: org.monthlyFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (error) {
      console.error('Error al actualizar organización en Supabase:', error.message);
      throw error;
    }
    return org;
  },

  async delete(orgId: string): Promise<boolean> {
    try {
      const { error: rpcErr } = await supabase.rpc('rpc_delete_company', { p_org_id: orgId });
      if (!rpcErr) {
        return true;
      }
    } catch (err) {
      console.warn('RPC rpc_delete_company no disponible, eliminando directamente.');
    }

    await supabase.from('users').delete().eq('organization_id', orgId);

    const { error } = await supabase.from('organizations').delete().eq('id', orgId);
    if (error) {
      console.error('Error al eliminar organización:', error.message);
      return false;
    }
    return true;
  },

  async sync(org: Organization): Promise<void> {
    await this.update(org);
  },
};

function mapOrgFromDB(o: any): Organization {
  return {
    id: o.id,
    name: o.name,
    taxId: o.tax_id || o.taxId,
    country: o.country || 'Argentina',
    status: o.status || 'active',
    active: o.active !== false && o.status === 'active',
    plan: o.plan || 'Pro SaaS',
    maxUsers: o.max_users || o.maxUsers || 10,
    monthlyFee: Number(o.monthly_fee || o.monthlyFee || 0),
    createdAt: o.created_at || o.createdAt || new Date().toISOString(),
    subscriptionExpiresAt: o.subscription_expires_at || o.subscriptionExpiresAt,
    featureFlags: o.feature_flags || o.featureFlags || {
      p2pCalculator: true,
      shiftClosing: true,
      advancedReports: true,
      customCryptos: true,
      auditLogs: true,
    },
  };
}
