/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

export interface UserProfile extends User {
  subscription_status?: string;
}

const SESSION_KEY = 'arbitrax_session';
const LEGACY_KEYS = [
  'auth_session',
  'user',
  'currentUser',
  'arbitrax_user',
  'supabase.auth.token',
  'sb-token',
  'supabase.auth',
];

export const authService = {
  /**
   * Limpiar sesiones legacy o incompatibles en localStorage
   */
  clearLegacySessions(): void {
    try {
      for (const key of LEGACY_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignorar errores de acceso a localStorage
    }
  },

  /**
   * Obtener la sesión activa en localStorage
   */
  getCurrentSession(): User | null {
    this.clearLegacySessions();
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const user = JSON.parse(stored) as User;
      if (!user || !user.id || !user.role) return null;

      // Normalizar rol estrictamente
      const rawRole = (user.role || '').toUpperCase();
      let normalizedRole: UserRole = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email || '',
        role: normalizedRole,
        organization_id: normalizedRole === 'SUPER_ADMIN' ? null : (user.organization_id || null),
        status: user.status || 'active',
        active: user.active !== false,
        lastLogin: user.lastLogin,
      };
    } catch {
      return null;
    }
  },

  /**
   * Guardar la sesión activa en localStorage (NUNCA almacena contraseña ni hash)
   */
  setSession(user: User): void {
    this.clearLegacySessions();
    const rawRole = (user.role || '').toUpperCase();
    let normalizedRole: UserRole = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    const sessionData: User = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email || '',
      role: normalizedRole,
      organization_id: normalizedRole === 'SUPER_ADMIN' ? null : (user.organization_id || null),
      status: user.status || 'active',
      active: user.active !== false,
      lastLogin: new Date().toISOString(),
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  },

  /**
   * Limpiar sesión local
   */
  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
      this.clearLegacySessions();
    } catch {
      // Ignorar
    }
  },

  /**
   * Validar sesión activa contra la base de datos PostgreSQL mediante RPC
   */
  async validateSession(userId: string): Promise<User | null> {
    if (!userId) return null;
    try {
      const { data, error } = await supabase.rpc('rpc_validate_session', { p_user_id: userId });

      if (error) {
        // Fallback de consulta directa si la RPC aún no existe en Supabase
        const { data: userData, error: queryErr } = await supabase
          .from('users')
          .select('id, username, name, email, role, organization_id, status, active')
          .eq('id', userId)
          .maybeSingle();

        if (queryErr || !userData || userData.active === false || userData.status === 'disabled' || userData.status === 'suspended') {
          return null;
        }

        const rawRole = (userData.role || '').toUpperCase();
        let normRole: UserRole = 'VENDEDOR';
        if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
        else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';

        return {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          email: userData.email || '',
          role: normRole,
          organization_id: normRole === 'SUPER_ADMIN' ? null : (userData.organization_id || null),
          status: userData.status || 'active',
          active: userData.active !== false,
        };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.active === false || row.status === 'disabled' || row.status === 'suspended') {
        return null;
      }

      const rawRole = (row.role || '').toUpperCase();
      let normRole: UserRole = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';

      return {
        id: row.id,
        username: row.username,
        name: row.name,
        email: row.email || '',
        role: normRole,
        organization_id: normRole === 'SUPER_ADMIN' ? null : (row.organization_id || null),
        status: row.status || 'active',
        active: row.active !== false,
      };
    } catch (err) {
      console.error('Error al validar sesión contra la base de datos:', err);
      return null;
    }
  },

  /**
   * Resolver username o email a un email registrado vía RPC rpc_resolve_login_email
   */
  async resolveEmail(identifier: string): Promise<string> {
    const cleanId = identifier.trim();
    if (!cleanId) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    const { data: resolvedEmail, error } = await supabase.rpc('rpc_resolve_login_email', {
      p_identifier: cleanId,
    });

    if (error) {
      console.error('Error en rpc_resolve_login_email:', error.message);
      throw new Error('No se pudo verificar la cuenta. Intenta nuevamente.');
    }

    if (!resolvedEmail) {
      throw new Error('Usuario o correo electrónico no encontrado.');
    }

    return resolvedEmail;
  },

  /**
   * Obtener perfil de public.users exclusivamente por auth_user_id
   */
  async getProfileByAuthUserId(authUserId: string): Promise<User | null> {
    if (!authUserId) return null;

    try {
      // Buscar coincidencia exclusivamente por auth_user_id
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, username, name, email, role, organization_id, status, active, auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('Error al consultar usuario por auth_user_id:', error);
        return null;
      }

      if (!userData) {
        return null;
      }

      if (userData.active === false || userData.status === 'disabled' || userData.status === 'suspended') {
        throw new Error('El usuario está desactivado o suspendido. Contacta al administrador.');
      }

      const rawRole = (userData.role || '').toUpperCase();
      let normRole: UserRole = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';

      return {
        id: userData.id,
        username: userData.username || userData.email?.split('@')[0] || 'usuario',
        name: userData.name || userData.username || 'Usuario',
        email: userData.email || '',
        role: normRole,
        organization_id: normRole === 'SUPER_ADMIN' ? null : (userData.organization_id || null),
        status: userData.status || 'active',
        active: userData.active !== false && userData.status === 'active',
        lastLogin: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err.message && err.message.includes('desactivado')) {
        throw err;
      }
      console.error('Error al obtener perfil del usuario:', err);
      return null;
    }
  },

  /**
   * Iniciar sesión utilizando Supabase Auth (signInWithPassword).
   */
  async login(identifier: string, pass: string): Promise<User> {
    if (!identifier || !pass) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    const cleanIdentifier = identifier.trim();

    // 1. Resolver username o email a email de autenticación Supabase Auth
    const resolvedEmail = await this.resolveEmail(cleanIdentifier);

    // 2. Autenticar directamente contra Supabase Auth (SIN trim en la contraseña)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: pass,
    });

    if (authError || !authData?.user) {
      console.error('Error en Supabase Auth signInWithPassword:', authError?.message);
      throw new Error('Usuario o contraseña incorrectos.');
    }

    // 3. Obtener el perfil correspondiente en public.users exclusivamente por auth_user_id
    const userObj = await this.getProfileByAuthUserId(authData.user.id);
    if (!userObj) {
      throw new Error('La cuenta de autenticación no está vinculada a ArbitraX.');
    }

    return userObj;
  },

  /**
   * Cerrar sesión del usuario en Supabase Auth
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error cerrando sesión en Supabase Auth:', err);
    } finally {
      this.clearSession();
    }
  },

  /**
   * Crear usuario (SUPER_ADMIN, ADMIN o VENDEDOR) directamente en public.users utilizando bcrypt.hashSync
   */
  async createUser(params: {
    email: string;
    password?: string;
    name: string;
    username: string;
    role: 'ADMIN' | 'VENDEDOR' | 'SUPER_ADMIN' | string;
    organization_id: string | null;
  }): Promise<User> {
    const rawRole = (params.role || '').toUpperCase();
    let normalizedRole: UserRole = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    const cleanEmail = params.email.trim().toLowerCase();
    const cleanPassword = params.password ? params.password.trim() : 'Arbitrax.2006';
    const cleanUsername = params.username.trim().toLowerCase();
    const cleanName = params.name.trim();

    if (!params.organization_id && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('El usuario debe pertenecer a una organización válida.');
    }

    // Verificar si el username o email ya existen
    const { data: existing } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.ilike.${cleanUsername},email.ilike.${cleanEmail}`);

    if (existing && existing.length > 0) {
      const match = existing[0];
      if (match.username?.toLowerCase() === cleanUsername) {
        throw new Error(`El nombre de usuario '${cleanUsername}' ya está registrado.`);
      }
      if (match.email?.toLowerCase() === cleanEmail) {
        throw new Error(`El correo electrónico '${cleanEmail}' ya está registrado.`);
      }
    }

    // Generar hash bcrypt de la contraseña (NUNCA texto plano)
    const passwordHash = bcrypt.hashSync(cleanPassword, 10);
    const newUserId = crypto.randomUUID();

    const newUserPayload = {
      id: newUserId,
      username: cleanUsername,
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      role: normalizedRole,
      organization_id: normalizedRole === 'SUPER_ADMIN' ? null : params.organization_id,
      status: 'active',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('users')
      .insert(newUserPayload)
      .select('id, username, name, email, role, organization_id, status, active')
      .single();

    if (error) {
      console.error('Error al insertar usuario en public.users:', error.message);
      throw new Error(`Error al crear usuario: ${error.message}`);
    }

    return {
      id: data?.id || newUserId,
      username: cleanUsername,
      name: cleanName,
      email: cleanEmail,
      role: normalizedRole,
      organization_id: normalizedRole === 'SUPER_ADMIN' ? null : params.organization_id,
      status: 'active',
      active: true,
    };
  },

  /**
   * Crear Vendedor para la organización del Administrador
   */
  async createSeller(params: {
    email: string;
    password?: string;
    name: string;
    username: string;
    organization_id: string;
  }): Promise<User> {
    return this.createUser({
      ...params,
      role: 'VENDEDOR',
    });
  },

  /**
   * Crear Administrador vinculado a una Organización
   */
  async createAdmin(params: {
    email: string;
    password?: string;
    name: string;
    username?: string;
    organization_id: string;
  }): Promise<User> {
    return this.createUser({
      ...params,
      username: params.username || params.email.trim().toLowerCase().split('@')[0],
      role: 'ADMIN',
    });
  },

  /**
   * Listar usuarios desde public.users sin exponer password_hash
   */
  async listUsers(role?: string, organizationId?: string): Promise<User[]> {
    let query = supabase
      .from('users')
      .select('id, username, name, email, role, organization_id, status, active')
      .order('created_at', { ascending: false });

    if (role) {
      const r = role.toUpperCase();
      if (r === 'VENDEDOR' || r === 'SELLER') {
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
      console.error('Error al listar usuarios desde public.users:', error.message);
      return [];
    }

    return (data || []).map((u: any) => {
      const rawRole = (u.role || '').toUpperCase();
      let normRole: UserRole = 'VENDEDOR';
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
      };
    });
  },

  /**
   * Actualizar usuario directamente en public.users
   */
  async updateUser(userId: string, data: Partial<User & { password?: string; password_hash?: string }>): Promise<boolean> {
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.email !== undefined) updatePayload.email = data.email.trim().toLowerCase();
    if (data.username !== undefined) updatePayload.username = data.username.trim().toLowerCase();
    
    if (data.password || data.password_hash) {
      const passStr = (data.password || data.password_hash || '').trim();
      if (passStr) {
        const hash = bcrypt.hashSync(passStr, 10);
        updatePayload.password_hash = hash;
      }
    }
    if (data.role !== undefined) {
      const rawRole = data.role.toUpperCase();
      let normRole: UserRole = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normRole = 'ADMIN';
      updatePayload.role = normRole;
    }
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
      .eq('id', userId);

    if (error) {
      console.error('Error al actualizar usuario en public.users:', error.message);
      return false;
    }
    return true;
  },

  /**
   * Actualizar vendedor
   */
  async updateSeller(seller: {
    id: string;
    name: string;
    username: string;
    email: string;
    active: boolean;
  }): Promise<boolean> {
    return this.updateUser(seller.id, seller);
  },

  /**
   * Desactivar o eliminar vendedor
   */
  async deleteSeller(userId: string): Promise<boolean> {
    return this.updateUser(userId, { active: false, status: 'disabled' });
  },

  /**
   * Eliminar usuario
   */
  async deleteUser(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Error al eliminar usuario en public.users:', error.message);
      return false;
    }
    return true;
  },
};
