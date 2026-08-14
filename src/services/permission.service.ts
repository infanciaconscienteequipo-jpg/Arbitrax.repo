/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Wallet } from '../types';

export const permissionService = {
  /**
   * Comprobar si el usuario es SUPER_ADMIN
   */
  isSuperAdmin(user?: User | null): boolean {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return role === 'SUPER_ADMIN';
  },

  /**
   * Comprobar si el usuario es ADMIN (o SUPER_ADMIN)
   */
  isAdmin(user?: User | null): boolean {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  },

  /**
   * Comprobar si el usuario es VENDEDOR
   */
  isVendedor(user?: User | null): boolean {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return role === 'VENDEDOR';
  },

  /**
   * Comprobar si el usuario es VENDEDOR (alias isSeller para compatibilidad)
   */
  isSeller(user?: User | null): boolean {
    return this.isVendedor(user);
  },

  /**
   * Comprobar si el usuario es CONTADORA
   */
  isContadora(user?: User | null): boolean {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    return role === 'CONTADORA';
  },

  /**
   * Solo SUPER_ADMIN puede crear administradores
   */
  canCreateAdmin(user?: User | null): boolean {
    return this.isSuperAdmin(user);
  },

  /**
   * ADMIN o SUPER_ADMIN pueden crear vendedores
   */
  canCreateSeller(user?: User | null): boolean {
    return this.isAdmin(user);
  },

  /**
   * Permisos para editar billeteras:
   * SUPER_ADMIN: todas
   * ADMIN: billeteras de su organización
   * VENDEDOR: solo sus propias billeteras dentro de su organización
   */
  canEditWallet(user?: User | null, wallet?: Wallet): boolean {
    if (!user) return false;
    if (this.isSuperAdmin(user)) return true;

    if (this.isAdmin(user)) {
      if (!wallet) return true;
      return wallet.organization_id === user.organization_id;
    }

    if (this.isVendedor(user)) {
      if (!wallet) return false;
      return wallet.organization_id === user.organization_id && wallet.vendorId === user.id;
    }

    return false;
  },

  /**
   * Permisos para ver una organización:
   * SUPER_ADMIN: todas las organizaciones
   * ADMIN o VENDEDOR: solo su propia organización
   */
  canViewOrganization(user?: User | null, orgId?: string): boolean {
    if (!user) return false;
    if (this.isSuperAdmin(user)) return true;
    if (!orgId) return false;
    return user.organization_id === orgId;
  },

  /**
   * Permisos para ver un vendedor:
   * SUPER_ADMIN: todos
   * ADMIN: vendedores de su organización
   * VENDEDOR: solo él mismo
   */
  canViewSeller(user?: User | null, sellerId?: string): boolean {
    if (!user) return false;
    if (this.isSuperAdmin(user)) return true;
    if (this.isAdmin(user)) return true; // los admins ven todos los vendedores de su org
    if (!sellerId) return false;
    return user.id === sellerId;
  },
};
