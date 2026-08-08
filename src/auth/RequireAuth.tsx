/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import Login from './Login';
import { ShieldAlert, LogOut, AlertTriangle } from 'lucide-react';

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const {
    user,
    organization,
    session,
    loading,
    error,
    subscriptionWarning,
    logout
  } = useAuth();

  // 1. Cargando sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-binance-black flex flex-col items-center justify-center p-4 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-binance-yellow/20 border-t-binance-yellow rounded-full animate-spin" />
          <p className="text-xs text-binance-gray font-bold tracking-wider uppercase animate-pulse">
            Cargando sesión de usuario...
          </p>
        </div>
      </div>
    );
  }

  // 2. Sin sesión o sin usuario cargado
  if (!session || !user) {
    return <Login />;
  }

  // 3. Usuario desactivado o inactivo
  if (!user.active || user.status !== 'active') {
    return (
      <div className="min-h-screen bg-binance-black flex items-center justify-center p-4 font-mono">
        <div className="max-w-md w-full bg-binance-card border border-binance-red/50 p-6 rounded-2xl space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-binance-red/10 rounded-xl flex items-center justify-center text-binance-red">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Acceso Bloqueado</h2>
          <p className="text-xs text-binance-gray">
            {error || 'Tu cuenta de usuario se encuentra desactivada o inactiva.'}
          </p>
          <button
            onClick={() => logout()}
            className="px-4 py-2 bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border border-binance-red/40 rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // 4. Organización desactivada/suspendida (para roles que no son SUPER_ADMIN)
  if (user.role !== 'SUPER_ADMIN' && user.organization_id) {
    if (!organization || !organization.active || organization.status !== 'active') {
      return (
        <div className="min-h-screen bg-binance-black flex items-center justify-center p-4 font-mono">
          <div className="max-w-md w-full bg-binance-card border border-binance-red/50 p-6 rounded-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-binance-red/10 rounded-xl flex items-center justify-center text-binance-red">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Empresa Inactiva o Suspendida</h2>
            <p className="text-xs text-binance-gray">
              {error || 'La empresa u organización a la que perteneces se encuentra inactiva o suspendida.'}
            </p>
            <button
              onClick={() => logout()}
              className="px-4 py-2 bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border border-binance-red/40 rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      );
    }
  }

  // 5. Advertencia de suscripción vencida
  return (
    <div className="min-h-screen bg-binance-black flex flex-col">
      {subscriptionWarning && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-amber-300 text-xs font-mono font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{subscriptionWarning} Contacta al Administrador para renovar el servicio.</span>
        </div>
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
