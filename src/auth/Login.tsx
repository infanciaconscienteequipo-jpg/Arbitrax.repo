/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import ForgotPassword from './ForgotPassword';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Server,
  KeyRound,
  X
} from 'lucide-react';

interface LoginProps {
  onCloseModal?: () => void;
  isModal?: boolean;
}

export default function Login({ onCloseModal, isModal = false }: LoginProps) {
  const { login, error: contextError, clearError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'forgot'>('login');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setLocalError('Por favor, ingresa tu usuario o correo electrónico.');
      return;
    }

    if (!cleanPass) {
      setLocalError('Por favor, ingresa tu contraseña.');
      return;
    }

    setLoading(true);

    try {
      await login(cleanId, cleanPass);
      if (onCloseModal) onCloseModal();
    } catch (err: any) {
      setLocalError(err.message || 'Error al iniciar sesión con Supabase Auth.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'forgot') {
    return (
      <div className={isModal ? "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" : "min-h-screen bg-binance-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono"}>
        <ForgotPassword onBackToLogin={() => setView('login')} />
      </div>
    );
  }

  const errorMessage = localError || contextError;

  const formContent = (
    <div className="w-full max-w-md space-y-6 font-mono">
      {/* BRANDING HEADER */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-binance-yellow via-amber-500 to-amber-600 rounded-2xl shadow-xl border border-binance-yellow/50 text-binance-black font-extrabold text-xl font-display mb-1">
          ARX
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
          Arbitra<span className="text-binance-yellow">X</span> Pro
        </h2>
        <p className="text-xs text-binance-gray">
          Acceso Seguro al Terminal de Gestión P2P & OTC Multi-Tenant
        </p>
      </div>

      {/* LOGIN CARD */}
      <div className="bg-binance-card border border-binance-border p-6 sm:p-8 rounded-2xl shadow-2xl relative space-y-5">
        {isModal && onCloseModal && (
          <button
            onClick={onCloseModal}
            className="absolute top-4 right-4 p-1.5 text-binance-gray hover:text-white bg-binance-black/60 hover:bg-binance-border rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ERROR ALERT */}
        {errorMessage && (
          <div className="p-3.5 bg-binance-red/10 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Error de Acceso</span>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {/* USERNAME / EMAIL INPUT */}
          <div>
            <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block mb-1.5">
              Usuario o Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-binance-gray">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="ejemplo@empresa.com o usuario"
                className="w-full pl-10 pr-4 py-2.5 bg-binance-black border border-binance-border focus:border-binance-yellow rounded-xl text-xs text-white outline-hidden transition"
              />
            </div>
          </div>

          {/* PASSWORD INPUT */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-[10px] text-binance-yellow hover:underline cursor-pointer font-bold"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-binance-gray">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-binance-black border border-binance-border focus:border-binance-yellow rounded-xl text-xs text-white outline-hidden transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-binance-gray hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-binance-yellow to-amber-500 hover:from-amber-400 hover:to-binance-yellow text-binance-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse flex items-center gap-2">Autenticando en Supabase...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Ingresar a ArbitraX
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* FOOTER METADATA */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-binance-gray">
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" /> Supabase Auth Enabled
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Server className="w-3.5 h-3.5" /> PostgreSQL Multi-Tenant
        </span>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        {formContent}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-binance-black flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono">
      {/* BACKGROUND GLOW EFFECTS */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-binance-yellow/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

      {formContent}
    </div>
  );
}
