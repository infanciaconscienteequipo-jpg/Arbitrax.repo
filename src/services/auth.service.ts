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
   * Si se provee usuario en lugar de email, busca el correo correspondiente en public.users.
   */
  async login(identifier: string, pass: string) {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    let targetEmail = cleanId;

    // Mapa de respaldo para nombres de usuario predeterminados
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
        console.warn('Busqueda de usuario por username fallo:', err);
        targetEmail = `${cleanId}@arbitrax.local`;
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: cleanPass,
      });

      console.log("LOGIN DATA:", data);
      console.log("LOGIN ERROR:", error);

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error("AUTH ERROR COMPLETO:", err);
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
   * Consultar perfil del usuario en public.users
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
          supabase.from('users').update({ auth_user_id: authUserId }).eq('id', data.id).then();
        }

        let userRole = (data.role || 'VENDEDOR').toUpperCase();
        if (userRole === 'OPERATOR') userRole = 'VENDEDOR';
        if (userRole === 'ADMINISTRADOR' || userRole === 'SUPERADMIN') {
          userRole = userRole.replace('ADMINISTRADOR', 'ADMIN').replace('SUPERADMIN', 'SUPER_ADMIN');
        }

        return {
          id: data.id,
          auth_user_id: data.auth_user_id || authUserId,
          username: data.username || email?.split('@')[0] || 'usuario',
          name: data.name || data.username || 'Usuario',
          email: data.email || email,
          role: userRole as any,
          organization_id: data.organization_id || null,
          status: data.status || 'active',
          active: data.active !== false && data.status === 'active',
          lastLogin: new Date().toISOString()
        };
      }

      const usernameFromEmail = email ? email.split('@')[0] : 'admin';
      const defaultRole = 'SUPER_ADMIN';

      const newProfile: UserProfile = {
        id: authUserId,
        auth_user_id: authUserId,
        username: usernameFromEmail,
        name: usernameFromEmail.toUpperCase(),
        email: email || `${usernameFromEmail}@arbitrax.local`,
        role: defaultRole as any,
        organization_id: null,
        status: 'active',
        active: true,
        lastLogin: new Date().toISOString()
      };

      try {
        await supabase.from('users').upsert({
          id: authUserId,
          auth_user_id: authUserId,
          username: newProfile.username,
          name: newProfile.name,
          email: newProfile.email,
          role: defaultRole,
          status: 'active',
          active: true,
          created_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('Upsert de usuario automático en public.users aviso:', upsertErr);
      }

      return newProfile;
    } catch (err) {
      console.error('Error fetching user profile:', err);
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
      query = query.ilike('role', role);
    }
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al listar usuarios desde Supabase:', error.message);
      return [];
    }

    return (data || []).map((u: any) => ({
      id: u.id,
      username: u.username || u.email?.split('@')[0] || 'usuario',
      name: u.name || u.username || 'Usuario',
      email: u.email,
      role: (u.role || 'VENDEDOR').toUpperCase(),
      organization_id: u.organization_id || '',
      status: u.status || 'active',
      active: u.active !== false && u.status === 'active',
      password: u.password,
    }));
  },

  /**
   * Crear Administrador vinculado a una Organización real en Supabase (auth.users y public.users).
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
   * Crear un nuevo usuario (Administrador o Vendedor) en Supabase.
   */
  async createUser(params: {
    email: string;
    password?: string;
    name: string;
    username: string;
    role: 'ADMIN' | 'VENDEDOR' | 'SUPER_ADMIN' | string;
    organization_id: string;
  }): Promise<UserProfile> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPassword = params.password || 'Arbitrax.2006';
    const cleanUsername = params.username.trim().toLowerCase();
    let authUserId: string | null = null;

    // 1. Crear usuario en auth.users vía signUp de Supabase Auth
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            name: params.name,
            username: cleanUsername,
            role: params.role,
            organization_id: params.organization_id,
          },
        },
      });

      if (signUpData?.user?.id) {
        authUserId = signUpData.user.id;
      } else if (signUpErr) {
        console.warn('Registro por signUp en Supabase Auth:', signUpErr.message);
      }
    } catch (err) {
      console.warn('Excepción al registrar usuario en Supabase Auth:', err);
    }

    // 2. Invocación de RPCs de Supabase (rpc_create_admin, create_user_profile, create_user)
    try {
      if (params.role === 'ADMIN') {
        await supabase.rpc('rpc_create_admin', {
          p_email: cleanEmail,
          p_password: cleanPassword,
          p_name: params.name,
          p_username: cleanUsername,
          p_organization_id: params.organization_id,
        });
      } else {
        await supabase.rpc('create_user_profile', {
          p_auth_id: authUserId || undefined,
          p_email: cleanEmail,
          p_username: cleanUsername,
          p_name: params.name,
          p_role: params.role,
          p_organization_id: params.organization_id,
          p_password: cleanPassword,
        });
      }
    } catch (rpcErr) {
      console.warn('Excepción al ejecutar RPCs de Supabase:', rpcErr);
    }

    // 3. Crear o actualizar en public.users de Supabase
    const userPayload: any = {
      username: cleanUsername,
      name: params.name,
      email: cleanEmail,
      role: params.role,
      organization_id: params.organization_id,
      status: 'active',
      active: true,
      updated_at: new Date().toISOString(),
    };

    if (authUserId) {
      userPayload.id = authUserId;
      userPayload.auth_user_id = authUserId;
    }

    const { data: insertedUser, error: upsertErr } = await supabase.from('users').upsert(userPayload).select().maybeSingle();

    if (upsertErr) {
      console.warn('Upsert en public.users:', upsertErr.message);
    }

    const finalId = insertedUser?.id || authUserId || `usr-${Date.now()}`;

    return {
      id: finalId,
      auth_user_id: authUserId || finalId,
      username: cleanUsername,
      name: params.name,
      email: cleanEmail,
      role: params.role as any,
      organization_id: params.organization_id,
      status: 'active',
      active: true,
      password: cleanPassword,
    };
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

    const { error } = await supabase.from('users').update(updatePayload).eq('id', userId);
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

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      console.error('Error al eliminar usuario en Supabase:', error.message);
      return false;
    }
    return true;
  }
};
