import { supabase } from '../lib/supabase';
import { Organization } from '../types';

export const organizationService = {
  async list(): Promise<Organization[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    try {
      // Intentar RPC rpc_list_companies primero
      const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_list_companies');
      if (!rpcErr && Array.isArray(rpcData)) {
        return rpcData.map(mapOrgFromDB);
      }
    } catch (err) {
      console.warn('RPC rpc_list_companies no disponible, usando fallback directo.');
    }

    // Fallback a select directo
    const { data, error } = await supabase.from('organizations').select('*');
    if (error) {
      console.error('Error al listar organizaciones:', error.message);
      return [];
    }
    return (data || []).map(mapOrgFromDB);
  },

  async getById(id: string): Promise<Organization | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

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

  async create(org: Organization): Promise<Organization> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return org;

    const dbOrg = mapOrgToDB(org);

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_create_company', {
        p_name: org.name,
        p_tax_id: org.taxId || null,
        p_country: org.country || 'Argentina',
        p_status: org.status || 'active',
        p_monthly_fee: org.monthlyFee || 0,
      });
      if (!rpcErr && rpcRes) {
        return typeof rpcRes === 'object' ? mapOrgFromDB(rpcRes) : org;
      }
    } catch (err) {
      console.warn('RPC rpc_create_company no disponible, realizando upsert directo.');
    }

    const { error } = await supabase.from('organizations').upsert(dbOrg);
    if (error) {
      console.error('Error al crear organización:', error.message);
      throw error;
    }
    return org;
  },

  async update(org: Organization): Promise<Organization> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return org;

    const dbOrg = mapOrgToDB(org);

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
      console.warn('RPC rpc_update_company no disponible, usando upsert directo.');
    }

    const { error } = await supabase.from('organizations').upsert(dbOrg);
    if (error) {
      console.error('Error al actualizar organización:', error.message);
      throw error;
    }
    return org;
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

function mapOrgToDB(org: Organization) {
  return {
    id: org.id,
    name: org.name,
    tax_id: org.taxId || null,
    country: org.country || 'Argentina',
    status: org.status || 'active',
    active: org.status === 'active',
    monthly_fee: org.monthlyFee || 0,
    subscription_expires_at: org.subscriptionExpiresAt || null,
    feature_flags: org.featureFlags || {
      p2pCalculator: true,
      shiftClosing: true,
      advancedReports: true,
      customCryptos: true,
      auditLogs: true,
    },
    created_at: org.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
