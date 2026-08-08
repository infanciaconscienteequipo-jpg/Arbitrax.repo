/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export interface UserProfile extends User {
  subscription_status?: string;
}

const SESSION_KEY = 'arbitrax_session';

export const authService = {
  /**
   * Obtener la sesión almacenada en localStorage
   */
  getCurrentSession(): User | null {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const user = JSON.parse(stored) as User;
      if (!user || !user.id || !user.role) return null;

      // Normalizar rol
      const rawRole = (user.role || '').toUpperCase();
      let normalizedRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
      if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
      else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

      return {
        ...user,
        role: normalizedRole,
      };
    } catch {
      return null;
    }
  },

  /**
   * Guardar la sesión activa en localStorage (NUNCA almacena contraseña ni hash)
   */
  setSession(user: User): void {
    const rawRole = (user.role || '').toUpperCase();
    let normalizedRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    const sessionData: User = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: normalizedRole,
      organization_id: user.organization_id,
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
    localStorage.removeItem(SESSION_KEY);
  },

  /**
   * Iniciar sesión directamente contra public.users usando bcrypt
   */
  async login(identifier: string, pass: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('Por favor, ingresa tu usuario/correo y contraseña.');
    }

    // Buscar en public.users por username o email o name
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${cleanId},email.ilike.${cleanId},name.ilike.${cleanId}`);

    if (error) {
      console.error('Error al consultar public.users durante login:', error.message);
      throw new Error('Error al conectar con la base de datos.');
    }

    if (!users || users.length === 0) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const userData = users[0];

    // Verificar si el usuario está activo
    if (userData.active === false || userData.status === 'disabled' || userData.status === 'suspended') {
      throw new Error('El usuario está desactivado o suspendido. Contacta al administrador.');
    }

    // Hash/password almacenado en la DB
    const storedHash = userData.password_hash || '';

    // Comparar usando bcrypt. Si el hash guardado previamente fuera texto plano, permitir coincidencia exacta como resguardo
    let isPasswordValid = false;
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      isPasswordValid = bcrypt.compareSync(cleanPass, storedHash);
    } else {
      // Resguardo para cuentas existentes en texto plano
      isPasswordValid = (cleanPass === storedHash);
    }

    if (!isPasswordValid) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    // Normalizar rol
    const rawRole = (userData.role || '').toUpperCase();
    let normalizedRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
    if (rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN') normalizedRole = 'SUPER_ADMIN';
    else if (rawRole === 'ADMIN' || rawRole === 'ADMINISTRADOR') normalizedRole = 'ADMIN';

    const userObj: User = {
      id: userData.id,
      username: userData.username || cleanId,
      name: userData.name || userData.username || 'Usuario',
      email: userData.email || '',
      role: normalizedRole,
      organization_id: userData.organization_id || null,
      status: userData.status || 'active',
      active: true,
      lastLogin: new Date().toISOString(),
    };

    // Guardar sesión en localStorage
    this.setSession(userObj);

    // Actualizar last_login en public.users (opcional en segundo plano)
    try {
      await supabase.from('users').update({ updated_at: new Date().toISOString() }).eq('id', userData.id);
    } catch {
      // Ignorar errores de tracking
    }

    return userObj;
  },

  /**
   * Cerrar sesión del usuario
   */
  async logout(): Promise<void> {
    this.clearSession();
  },

  /**
   * Crear usuario (SUPER_ADMIN, ADMIN o VENDEDOR) directamente en public.users usando bcrypt
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

    // Generar hash bcrypt de la contraseña
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
      .select()
      .single();

    if (error) {
      console.error('Error al insertar usuario en public.users:', error.message);
      throw new Error(`Error al crear usuario: ${error.message}`);
    }

    return {
      id: data.id || newUserId,
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
   * Listar usuarios desde public.users
   */
  async listUsers(role?: string, organizationId?: string): Promise<User[]> {
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });

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
      };
    });
  },

  /**
   * Actualizar usuario directamente en public.users
   */
  async updateUser(userId: string, data: Partial<User & { password?: string }>): Promise<boolean> {
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
      let normRole: 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' = 'VENDEDOR';
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
