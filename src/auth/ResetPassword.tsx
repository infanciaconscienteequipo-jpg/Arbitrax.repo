/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { authService } from '../services/auth.service';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface ResetPasswordProps {
  userId?: string;
  onSuccess?: () => void;
}

export default function ResetPassword({ userId, onSuccess }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      if (userId) {
        await authService.updateUser(userId, { password });
      }
      setSuccess(true);
      if (onSuccess) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 font-mono">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-binance-yellow via-amber-500 to-amber-600 rounded-2xl shadow-xl border border-binance-yellow/50 text-binance-black font-extrabold text-xl font-display mb-1">
          ARX
        </div>
        <h2 className="text-2xl font-black text-white font-display tracking-tight">
          Nueva Contraseña
        </h2>
        <p className="text-xs text-binance-gray">
          Ingresa la nueva contraseña para tu cuenta de ArbitraX Pro.
        </p>
      </div>

      <div className="bg-binance-card border border-binance-border p-6 sm:p-8 rounded-2xl shadow-2xl space-y-5">
        {errorMsg && (
          <div className="p-3.5 bg-binance-red/10 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Error</span>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <span className="font-bold text-sm text-white">¡Contraseña actualizada!</span>
            <p className="text-[11px] text-emerald-300">
              Tu clave ha sido cambiada correctamente. Redirigiendo a la plataforma...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block mb-1.5">
                Nueva Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-binance-gray">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-10 py-2.5 bg-binance-black border border-binance-border focus:border-binance-yellow rounded-xl text-xs text-white outline-hidden font-mono transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-binance-gray hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block mb-1.5">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-binance-gray">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full pl-10 pr-10 py-2.5 bg-binance-black border border-binance-border focus:border-binance-yellow rounded-xl text-xs text-white outline-hidden font-mono transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-binance-yellow to-amber-500 hover:from-amber-400 hover:to-binance-yellow text-binance-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse flex items-center gap-2">Actualizando...</span>
              ) : (
                <>
                  Actualizar Contraseña
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
