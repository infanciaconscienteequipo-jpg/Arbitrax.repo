/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../lib/supabase';
import { User, Organization } from '../types';

export interface UserProfile extends User {
  auth_user_id?: string;
  subscription_status?: string;
}

export const authService = {
  /**
   * Iniciar sesión utilizando Supabase Auth.
   * Busca el correo electrónico en public.users si se ingresó un nombre de usuario.
   */
  async login(identifier: string, pass: string) {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    let targetEmail = cleanId;

    const defaultUserMap: Record<string, string> = {
      'superadmin': 'arbitrax19@gmail.com',
      'admin': 'admiarbitrax1@gmail.com',
      'roberto.g': 'roberto.g@arbitrax.com',
      'carla.b': 'carla.b@arbitrax.com',
    };

    if (defaultUserMap[cleanId]) {
      targetEmail = defaultUserMap[cleanId];
    } else if (!cleanId.includes('@')) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('email, username')
          .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
          .maybeSingle();

        if (userData && userData.email) {
          targetEmail = userData.email;
        } else {
          targetEmail = `${cleanId}@arbitrax.local`;
        }
      } catch (err) {
        console.warn('Búsqueda de usuario por username falló:', err);
        targetEmail = `${cleanId}@arbitrax.local`;
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: cleanPass,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err: any) {
      console.error('Error de autenticación en login:', err);
      throw err;
    }
  },

  /**
   * Cerrar sesión mediante Supabase Auth.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      throw new Error(error.message);
    }
  },

  /**
   * Enviar correo de recuperación de contraseña.
   */
  async resetPasswordForEmail(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Por favor, ingresa tu correo electrónico.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${import.meta.env.VITE_SUPABASE_URL}/reset-password`,
    });

    if (error) {
      console.error('Error al solicitar recuperación de contraseña:', error.message);
      throw new Error(error.message);
    }
  },

  /**
   * Actualizar contraseña del usuario autenticado.
   */
  async updatePassword(newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Error al actualizar contraseña:', error.message);
      throw new Error(error.message);
    }
  },

  /**
   * Consultar perfil del usuario en public.users mediante auth_user_id = auth.uid()
   * NUNCA asigna ni genera un rol por defecto si el registro no existe en public.users.
   */
  async getUserProfile(authUserId: string, email?: string): Promise<UserProfile | null> {
    try {
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`)
        .maybeSingle();

      if ((!data || error) && email) {
        const emailSearch = await supabase
          .from('users')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (emailSearch.data) {
          data = emailSearch.data;
          error = null;
        }
      }

      if (data) {
        if (!data.auth_user_id && authUserId) {
          await supabase.from('users').update({ auth_user_id: authUserId }).eq('id', data.id);
        }

        const rawRole = (data.role || '').toUpperCase();
        let userRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR';

        if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') {
          userRole = 'SUPER_ADMIN';
        } else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') {
          userRole = 'ADMIN';
        } else {
          userRole = 'VENDEDOR';
        }

        return {
          id: data.id,
          auth_user_id: data.auth_user_id || authUserId,
          username: data.username || email?.split('@')[0] || 'usuario',
          name: data.name || data.username || 'Usuario',
          email: data.email || email,
          role: userRole,
          organization_id: data.organization_id || null,
          status: data.status || 'active',
          active: data.active !== false && data.status === 'active',
          lastLogin: new Date().toISOString(),
        };
      }

      // Si no existe perfil en public.users, retornar null (NUNCA asignar rol por defecto)
      return null;
    } catch (err) {
      console.error('Error al obtener perfil de usuario de public.users:', err);
      return null;
    }
  },

  /**
   * Consultar lista de usuarios desde public.users en Supabase
   */
  async listUsers(role?: string, organizationId?: string): Promise<User[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    if (role) {
      const r = role.toUpperCase();
      if (r === 'VENDEDOR' || r === 'VENDEDOR') {
        query = query.or('role.ilike.VENDEDOR,role.ilike.SELLER,role.ilike.vendedor,role.ilike.operator');
      } else {
        query = query.ilike('role', role);
      }
    }
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al listar usuarios desde Supabase:', error.message);
      return [];
    }

    return (data || []).map((u: any) => {
      const rawRole = (u.role || '').toUpperCase();
      let normRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';

      return {
        id: u.id,
        username: u.username || u.email?.split('@')[0] || 'usuario',
        name: u.name || u.username || 'Usuario',
        email: u.email,
        role: normRole,
        organization_id: u.organization_id || '',
        status: u.status || 'active',
        active: u.active !== false && u.status === 'active',
        password: u.password,
      };
    });
  },

  /**
   * Crear usuario (VENDEDOR o ADMIN) utilizando EXCLUSIVAMENTE la Edge Function `create-user`.
   * Garantiza la ejecución con SERVICE_ROLE_KEY sin alterar ni cambiar la sesión activa en el cliente.
   */
  async createUser(params: {
    email: string;
    password?: string;
    name: string;
    username: string;
    role: 'ADMIN' | 'VENDEDOR' | 'SUPER_ADMIN' | string;
    organization_id: string;
  }): Promise<UserProfile> {
    const rawRole = (params.role || '').toUpperCase();
    let normalizedRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPassword = params.password ? params.password.trim() : 'Arbitrax.2006';
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanName = params.name.trim();

    if (!params.organization_id && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('El usuario debe pertenecer a una organización válida.');
    }

    // Invocación a la Edge Function `create-user` que ejecuta createUser vía Admin API (SERVICE_ROLE_KEY)
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-user', {
      body: {
        email: cleanEmail,
        password: cleanPassword,
        username: cleanUsername,
        name: cleanName,
        organization_id: params.organization_id,
        role: normalizedRole,
      },
    });

    if (edgeErr) {
      console.error('Error al invocar Edge Function create-user:', edgeErr);
      throw new Error(edgeErr.message || 'Error de conexión con la Edge Function create-user');
    }

    if (edgeData?.error) {
      console.error('Error devuelto por la Edge Function create-user:', edgeData.error);
      throw new Error(edgeData.error);
    }

    if (!edgeData || !edgeData.auth_user_id) {
      throw new Error('La Edge Function create-user no devolvió el ID del usuario creado.');
    }

    return {
      id: edgeData.auth_user_id,
      auth_user_id: edgeData.auth_user_id,
      username: cleanUsername,
      name: cleanName,
      email: cleanEmail,
      role: normalizedRole,
      organization_id: edgeData.organization_id || params.organization_id,
      status: 'active',
      active: true,
      password: cleanPassword,
    };
  },

  /**
   * Crear Vendedor para la organización del Administrador.
   */
  async createSeller(params: {
    email: string;
    password?: string;
    name: string;
    username: string;
    organization_id: string;
  }): Promise<UserProfile> {
    return this.createUser({
      ...params,
      role: 'VENDEDOR',
    });
  },

  /**
   * Crear Administrador vinculado a una Organización real en Supabase.
   */
  async createAdmin(params: {
    email: string;
    password?: string;
    name: string;
    username?: string;
    organization_id: string;
  }): Promise<UserProfile> {
    return this.createUser({
      ...params,
      username: params.username || params.email.trim().toLowerCase().split('@')[0],
      role: 'ADMIN',
    });
  },

  /**
   * Actualizar datos del vendedor utilizando EXCLUSIVAMENTE la RPC rpc_update_seller.
   */
  async updateSeller(seller: {
    id: string;
    name: string;
    username: string;
    email: string;
    active: boolean;
  }): Promise<boolean> {
    const { error } = await supabase.rpc('rpc_update_seller', {
      p_user_id: seller.id,
      p_name: seller.name,
      p_username: seller.username,
      p_email: seller.email,
      p_active: seller.active,
    });

    if (error) {
      console.error('Error al ejecutar rpc_update_seller en Supabase:', error.message);
      throw new Error(`Error rpc_update_seller: ${error.message}`);
    }

    return true;
  },

  /**
   * Archivar/Desactivar vendedor (Soft Delete) ejecutando EXCLUSIVAMENTE la RPC rpc_delete_seller.
   */
  async deleteSeller(userId: string): Promise<boolean> {
    const { error } = await supabase.rpc('rpc_delete_seller', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error al ejecutar rpc_delete_seller en Supabase:', error.message);
      throw new Error(error.message);
    }

    return true;
  },

  /**
   * Actualizar usuario en public.users en Supabase.
   */
  async updateUser(userId: string, data: Partial<User>): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.email !== undefined) updatePayload.email = data.email.trim().toLowerCase();
    if (data.username !== undefined) updatePayload.username = data.username.trim().toLowerCase();
    if (data.role !== undefined) updatePayload.role = data.role;
    if (data.organization_id !== undefined) updatePayload.organization_id = data.organization_id;
    if (data.status !== undefined) {
      updatePayload.status = data.status;
      updatePayload.active = data.status === 'active';
    }
    if (data.active !== undefined) {
      updatePayload.active = data.active;
      if (!data.status) updatePayload.status = data.active ? 'active' : 'disabled';
    }

    const { error } = await supabase
      .from('users')
      .update(updatePayload)
      .or(`id.eq.${userId},auth_user_id.eq.${userId},username.eq.${userId}`);

    if (error) {
      console.error('Error al actualizar usuario en Supabase:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Eliminar usuario de public.users en Supabase.
   */
  async deleteUser(userId: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { error } = await supabase
      .from('users')
      .delete()
      .or(`id.eq.${userId},auth_user_id.eq.${userId},username.eq.${userId}`);

    if (error) {
      console.error('Error al eliminar usuario en Supabase:', error.message);
      return false;
    }
    return true;
  },
};

