import { supabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  read: boolean;
  createdAt: string;
  organization_id?: string;
}

export const notificationService = {
  async list(organizationId?: string): Promise<AppNotification[]> {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      return [];
    }
    return (data || []).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type || 'info',
      read: Boolean(n.read),
      createdAt: n.created_at,
      organization_id: n.organization_id,
    }));
  },

  async markAsRead(id: string): Promise<boolean> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    return !error;
  },

  async send(notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): Promise<boolean> {
    const { error } = await supabase.from('notifications').insert({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: false,
      organization_id: notification.organization_id || null,
      created_at: new Date().toISOString(),
    });
    return !error;
  },
};
