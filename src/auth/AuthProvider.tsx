/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { User, Organization } from '../types';
import { authService, UserProfile } from '../services/auth.service';
import { organizationService } from '../services/organization.service';
import { supabase } from '../lib/supabase';

export interface AuthContextType {
  user: UserProfile | null;
  organization: Organization | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  subscriptionWarning: string | null;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionWarning, setSubscriptionWarning] = useState<string | null>(null);

  // Cargar y validar la sesión activa de Supabase
  const handleSessionLoad = async (activeSession: Session | null) => {
    setLoading(true);
    setSubscriptionWarning(null);

    if (!activeSession || !activeSession.user) {
      setSession(null);
      setUser(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    try {
      setSession(activeSession);

      // 1. Obtener perfil de usuario desde public.users
      const userProfile = await authService.getUserProfile(
        activeSession.user.id,
        activeSession.user.email
      );

      if (!userProfile) {
        console.warn('Perfil de usuario no encontrado en public.users');
        await authService.logout();
        setSession(null);
        setUser(null);
        setOrganization(null);
        setError('El usuario no existe o no tiene un perfil registrado en public.users.');
        setLoading(false);
        return;
      }

      // 2. Validación de Estado del Usuario (active = true / status = 'active')
      if (userProfile.active === false || userProfile.status !== 'active') {
        console.warn('Usuario desactivado o inactivo');
        await authService.logout();
        setSession(null);
        setUser(null);
        setOrganization(null);
        setError('Tu cuenta de usuario se encuentra desactivada o inactiva.');
        setLoading(false);
        return;
      }

      setUser(userProfile);

      // 3. Validación de Organización (si no es SUPER_ADMIN)
      if (userProfile.role !== 'SUPER_ADMIN' && userProfile.organization_id) {
        const orgData = await organizationService.getById(userProfile.organization_id);

        if (!orgData || orgData.active === false || orgData.status !== 'active') {
          console.warn('Organización inactiva o suspendida');
          await authService.logout();
          setSession(null);
          setUser(null);
          setOrganization(null);
          setError('La empresa u organización a la que perteneces se encuentra inactiva o suspendida.');
          setLoading(false);
          return;
        }

        setOrganization(orgData);

        // Validar vencimiento de suscripción
        if (orgData.subscriptionExpiresAt) {
          const expiryDate = new Date(orgData.subscriptionExpiresAt);
          if (expiryDate < new Date()) {
            setSubscriptionWarning('La suscripción de la empresa se encuentra vencida.');
          }
        }
      } else {
        setOrganization(null);
      }
    } catch (err: any) {
      console.error('Error al procesar la sesión de Supabase:', err);
      setError('Ocurrió un error al validar la sesión de usuario.');
      setUser(null);
      setOrganization(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionLoad(initialSession);
    });

    // Escuchar cambios de estado en Supabase Auth (Sign In, Sign Out, Refresh Token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        handleSessionLoad(currentSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, pass: string) => {
    setError(null);
    setLoading(true);
    try {
      const authData = await authService.login(identifier, pass);
      if (authData.session) {
        await handleSessionLoad(authData.session);
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
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
      setSession(null);
      setUser(null);
      setOrganization(null);
      setError(null);
      setSubscriptionWarning(null);
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await authService.resetPasswordForEmail(email);
    } catch (err: any) {
      setError(err.message || 'Error al solicitar el restablecimiento de contraseña.');
      throw err;
    }
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);
    try {
      await authService.updatePassword(newPassword);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña.');
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        session,
        loading,
        error,
        subscriptionWarning,
        login,
        logout,
        resetPassword,
        updatePassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
