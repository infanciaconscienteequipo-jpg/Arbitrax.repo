/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, Organization } from '../types';
import { authService } from '../services/auth.service';
import { organizationService } from '../services/organization.service';
import { supabase } from '../lib/supabase';

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
  const [rawSession, setRawSession] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionWarning, setSubscriptionWarning] = useState<string | null>(null);

  const processSessionUser = async (sessionUser: any) => {
    if (!sessionUser || !sessionUser.id) {
      setUser(null);
      setOrganization(null);
      setSubscriptionWarning(null);
      return;
    }

    try {
      // 1. Obtener perfil desde public.users exclusivamente por auth_user_id
      const profile = await authService.getProfileByAuthUserId(sessionUser.id);
      if (!profile) {
        setUser(null);
        setOrganization(null);
        setError('La cuenta de autenticación no está vinculada a ArbitraX.');
        return;
      }

      if (!profile.active || profile.status === 'disabled' || profile.status === 'suspended') {
        setUser(null);
        setOrganization(null);
        setError('El usuario está desactivado o suspendido. Contacta al administrador.');
        return;
      }

      // 2. Validar organización para ADMIN / VENDEDOR
      if (profile.role !== 'SUPER_ADMIN') {
        if (!profile.organization_id) {
          setUser(null);
          setOrganization(null);
          setError('Tu usuario no tiene una organización asignada.');
          return;
        }

        const orgData = await organizationService.getById(profile.organization_id);

        if (!orgData || orgData.active === false || orgData.status !== 'active') {
          setUser(null);
          setOrganization(null);
          setError('La empresa u organización a la que perteneces se encuentra inactiva o suspendida.');
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

      setUser(profile);
      setError(null);
    } catch (err: any) {
      console.error('Error al procesar la sesión de usuario:', err);
      setError(err.message || 'Ocurrió un error al validar la sesión de usuario.');
      setUser(null);
      setOrganization(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Inicializar la sesión con Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setRawSession(session);
      if (session?.user) {
        processSessionUser(session.user).finally(() => {
          if (isMounted) setLoading(false);
        });
      } else {
        setUser(null);
        setOrganization(null);
        setLoading(false);
      }
    });

    // Suscribirse a cambios en el estado de autenticación de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      setRawSession(session);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          await processSessionUser(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setOrganization(null);
        setError(null);
        setSubscriptionWarning(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      await authService.login(identifier, pass);
      // La llamada a signInWithPassword dentro de authService.login
      // dispara el evento 'SIGNED_IN' en onAuthStateChange, el cual
      // obtiene la sesión y carga el perfil de forma unificada.
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      setUser(null);
      setOrganization(null);
      setRawSession(null);
      throw err;
    } finally {
      setLoading(false);
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
      setRawSession(null);
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
        session: rawSession,
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
