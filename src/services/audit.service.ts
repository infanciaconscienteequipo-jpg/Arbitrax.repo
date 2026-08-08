import { supabase } from '../lib/supabase';

export interface AuditLog {
  id: string;
  action: string;
  userId?: string;
  userName?: string;
  organizationId?: string;
  metadata?: any;
  createdAt: string;
}

export const auditService = {
  async logEvent(params: {
    action: string;
    userId?: string;
    userName?: string;
    organizationId?: string;
    metadata?: any;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        action: params.action,
        user_id: params.userId || null,
        user_name: params.userName || null,
        organization_id: params.organizationId || null,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      });
      return !error;
    } catch (err) {
      console.warn('Registro de auditoría fallido:', err);
      return false;
    }
  },

  async getAuditLogs(organizationId?: string): Promise<AuditLog[]> {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      return [];
    }
    return (data || []).map((log: any) => ({
      id: log.id,
      action: log.action,
      userId: log.user_id,
      userName: log.user_name,
      organizationId: log.organization_id,
      metadata: log.metadata,
      createdAt: log.created_at,
    }));
  },
};
