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
      redirectTo: `${window.location.origin}/reset-password`,
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
      // 1. Intentar por auth_user_id o id
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`)
        .maybeSingle();

      // 2. Si no se encontró y tenemos email, buscar por email
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

      // 3. Si se encontró en public.users
      if (data) {
        // Asegurar que auth_user_id esté vinculado en la base de datos
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

      // 4. Si NO existe aún en public.users pero está autenticado en Supabase Auth:
      // Crear un perfil predeterminado (o Super Admin si su correo/meta lo indica o por defecto)
      const usernameFromEmail = email ? email.split('@')[0] : 'admin';
      const defaultRole = 'SUPER_ADMIN'; // Si ingresó por Supabase Auth sin registro en public.users, le otorgamos SUPER_ADMIN
      
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

      // Intentar insertar en public.users
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
   * Consultar organización del usuario en public.organizations
   */
  async getOrganization(organizationId: string): Promise<Organization | null> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle();

      if (error || !data) {
        console.warn('Error consultando la organización:', error?.message);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        taxId: data.tax_id,
        country: data.country,
        status: data.status || 'active',
        active: data.active !== false && data.status === 'active',
        monthlyFee: Number(data.monthly_fee || 0),
        createdAt: data.created_at,
        subscriptionExpiresAt: data.subscription_expires_at,
        featureFlags: data.feature_flags || { p2pCalculator: true, shiftClosing: true, advancedReports: true, customCryptos: true, auditLogs: true }
      };
    } catch (err) {
      console.error('Error fetching organization:', err);
      return null;
    }
  },

  /**
   * Crear un nuevo usuario (Administrador o Vendedor) llamando a la RPC o signUp de Supabase.
   * Sin exponer ni utilizar Service Role desde React.
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

    // 1. Usar signUp de Supabase Auth
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

    const assignedId = authUserId || `u-${Date.now()}`;

    // 2. Invocación de RPCs de Supabase
    try {
      const { error: rpcProfileErr } = await supabase.rpc('create_user_profile', {
        p_auth_id: assignedId,
        p_email: cleanEmail,
        p_username: cleanUsername,
        p_name: params.name,
        p_role: params.role,
        p_organization_id: params.organization_id,
        p_password: cleanPassword,
      });

      if (rpcProfileErr) {
        await supabase.rpc('create_user', {
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

    // 3. Registrar o actualizar en la tabla public.users de Supabase
    const dbUserRow = {
      id: assignedId,
      auth_user_id: assignedId,
      username: cleanUsername,
      name: params.name,
      email: cleanEmail,
      role: params.role,
      organization_id: params.organization_id,
      status: 'active',
      active: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase.from('users').upsert(dbUserRow);
    if (upsertErr) {
      console.warn('Upsert en public.users:', upsertErr.message);
    }

    return {
      id: assignedId,
      auth_user_id: assignedId,
      username: cleanUsername,
      name: params.name,
      email: cleanEmail,
      role: params.role as any,
      organization_id: params.organization_id,
      status: 'active',
      active: true,
      password: cleanPassword,
    };
  }
};
