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
   * Iniciar sesión directamente en PostgreSQL vía RPC rpc_login_user.
   * La verificación de contraseña se realiza EN LA BASE DE DATOS. NUNCA se envía password_hash al cliente.
   */
  async login(identifier: string, pass: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    let userObj: User | null = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_login_user', {
        p_identifier: cleanId,
        p_password: cleanPass,
      });

      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('USER_INACTIVE')) {
          throw new Error('El usuario está desactivado o suspendido. Contacta al administrador.');
        }
        if (msg.includes('USER_NOT_FOUND') || msg.includes('INVALID_PASSWORD')) {
          throw new Error('Usuario o contraseña incorrectos.');
        }
        if (msg.includes('IDENTIFIER_AND_PASSWORD_REQUIRED')) {
          throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
        }

        // Si la RPC no existe aún en Supabase, ejecutar el fallback directo
        if (rpcError.code === '42883' || msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('function')) {
          console.warn('RPC rpc_login_user no encontrada en Supabase, ejecutando autenticación alternativa.');
          userObj = await this.fallbackLogin(cleanId, cleanPass);
        } else {
          console.error('Error en rpc_login_user:', msg);
          throw new Error('Error al conectar con la base de datos.');
        }
      } else {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!row) {
          throw new Error('Usuario o contraseña incorrectos.');
        }

        const rawRole = (row.role || '').toUpperCase();
        let normalizedRole: UserRole = 'VENDEDOR';
        if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
        else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

        userObj = {
          id: row.id,
          username: row.username,
          name: row.name,
          email: row.email || '',
          role: normalizedRole,
          organization_id: normalizedRole === 'SUPER_ADMIN' ? null : (row.organization_id || null),
          status: row.status || 'active',
          active: true,
          lastLogin: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('incorrectos') || err.message.includes('desactivado') || err.message.includes('ingresa') || err.message.includes('conectar'))) {
        throw err;
      }
      userObj = await this.fallbackLogin(cleanId, cleanPass);
    }

    if (!userObj) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    // Guardar sesión limpia en localStorage (sin password ni password_hash)
    this.setSession(userObj);

    return userObj;
  },

  /**
   * Fallback de autenticación por si la RPC rpc_login_user no ha sido desplegada en Supabase aún.
   * Elimina password_hash inmediatamente antes de retornar el objeto de usuario.
   */
  async fallbackLogin(cleanId: string, cleanPass: string): Promise<User> {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, name, email, role, organization_id, status, active, password_hash')
      .or(`username.ilike.${cleanId},email.ilike.${cleanId},name.ilike.${cleanId}`);

    if (error || !users || users.length === 0) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const userData = users[0];

    if (userData.active === false || userData.status === 'disabled' || userData.status === 'suspended') {
      throw new Error('El usuario está desactivado o suspendido. Contacta al administrador.');
    }

    const storedHash = userData.password_hash || '';
    let isPasswordValid = false;

    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      isPasswordValid = bcrypt.compareSync(cleanPass, storedHash);
    }

    if (!isPasswordValid) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const rawRole = (userData.role || '').toUpperCase();
    let normalizedRole: UserRole = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    return {
      id: userData.id,
      username: userData.username || cleanId,
      name: userData.name || userData.username || 'Usuario',
      email: userData.email || '',
      role: normalizedRole,
      organization_id: normalizedRole === 'SUPER_ADMIN' ? null : (userData.organization_id || null),
      status: userData.status || 'active',
      active: true,
      lastLogin: new Date().toISOString(),
    };
  },

  /**
   * Cerrar sesión del usuario
   */
  async logout(): Promise<void> {
    this.clearSession();
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
