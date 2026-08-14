import { supabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success' | 'danger' | string;
  read: boolean;
  createdAt: string;
  organization_id?: string;
  metadata?: any;
  wallet_name?: string;
  wallet_id?: string;
  note?: string;
  reason?: string;
  motivo?: string;
  block_reason?: string;
  [key: string]: any;
}

export function mapNotificationFromDB(n: any): AppNotification {
  return {
    id: String(n.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
    title: n.title || '',
    message: n.message || '',
    type: n.type || 'info',
    read: Boolean(n.read),
    createdAt: n.created_at || n.createdAt || new Date().toISOString(),
    organization_id: n.organization_id || undefined,
    metadata: n.metadata || n.meta || n.data || undefined,
    wallet_name: n.wallet_name || n.walletName,
    wallet_id: n.wallet_id || n.walletId,
    note: n.note || n.notes,
    reason: n.reason || n.motivo,
    motivo: n.motivo || n.reason,
    block_reason: n.block_reason || n.blockReason,
  };
}

export const notificationService = {
  async list(organizationId?: string): Promise<AppNotification[]> {
    try {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Error al consultar notifications:', error.message);
        return [];
      }
      return (data || []).map(mapNotificationFromDB);
    } catch (err) {
      console.warn('Error en notificationService.list:', err);
      return [];
    }
  },

  async markAsRead(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },

  async markAllAsRead(organizationId?: string): Promise<boolean> {
    try {
      let query = supabase.from('notifications').update({ read: true }).eq('read', false);
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      const { error } = await query;
      return !error;
    } catch {
      return false;
    }
  },

  async send(notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): Promise<boolean> {
    try {
      const { error } = await supabase.from('notifications').insert({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: false,
        organization_id: notification.organization_id || null,
        created_at: new Date().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  },
};

