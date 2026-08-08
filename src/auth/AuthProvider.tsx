/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, Organization } from '../types';
import { authService } from '../services/auth.service';
import { organizationService } from '../services/organization.service';

export interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  session: any | null;
  loading: boolean;
  error: string | null;
  subscriptionWarning: string | null;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionWarning, setSubscriptionWarning] = useState<string | null>(null);

  const loadUserSession = async () => {
    setLoading(true);
    setSubscriptionWarning(null);

    const activeUser = authService.getCurrentSession();

    if (!activeUser) {
      setUser(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    try {
      if (activeUser.role !== 'SUPER_ADMIN') {
        if (!activeUser.organization_id) {
          console.warn('Usuario sin organización asignada');
          authService.clearSession();
          setUser(null);
          setOrganization(null);
          setError('Su cuenta no tiene asignada una organización válida.');
          setLoading(false);
          return;
        }

        const orgData = await organizationService.getById(activeUser.organization_id);

        if (!orgData || orgData.active === false || orgData.status !== 'active') {
          console.warn('Organización inactiva o suspendida');
          authService.clearSession();
          setUser(null);
          setOrganization(null);
          setError('La empresa u organización a la que perteneces se encuentra inactiva o suspendida.');
          setLoading(false);
          return;
        }

        setOrganization(orgData);

        if (orgData.subscriptionExpiresAt) {
          const expiryDate = new Date(orgData.subscriptionExpiresAt);
          if (expiryDate < new Date()) {
            setSubscriptionWarning('La suscripción de la empresa se encuentra vencida.');
          }
        }
      } else {
        setOrganization(null);
      }

      setUser(activeUser);
    } catch (err: any) {
      console.error('Error al procesar la sesión de usuario:', err);
      setError('Ocurrió un error al validar la sesión de usuario.');
      setUser(null);
      setOrganization(null);
      authService.clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserSession();
  }, []);

  const login = async (identifier: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const loggedUser = await authService.login(identifier, pass);
      await loadUserSession();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      setUser(null);
      setOrganization(null);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (err: any) {
      console.error('Error durante logout:', err);
    } finally {
      setUser(null);
      setOrganization(null);
      setError(null);
      setSubscriptionWarning(null);
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        session: user,
        loading,
        error,
        subscriptionWarning,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
