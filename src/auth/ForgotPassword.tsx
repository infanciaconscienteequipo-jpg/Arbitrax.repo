/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccess(false);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar el correo de recuperación.');
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
          Recuperar Contraseña
        </h2>
        <p className="text-xs text-binance-gray">
          Ingresa tu correo para recibir un enlace de restablecimiento seguro.
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
          <div className="space-y-4 text-center">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="font-bold text-sm text-white">¡Correo enviado!</span>
              <p className="text-[11px] text-emerald-300">
                Hemos enviado las instrucciones para restablecer tu contraseña a <strong className="text-white">{email}</strong>. Por favor revisa tu bandeja de entrada o spam.
              </p>
            </div>

            <button
              onClick={onBackToLogin}
              className="w-full py-2.5 bg-binance-border hover:bg-binance-border/80 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-binance-gray">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-binance-black border border-binance-border focus:border-binance-yellow rounded-xl text-xs text-white outline-hidden font-mono transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-binance-yellow to-amber-500 hover:from-amber-400 hover:to-binance-yellow text-binance-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse flex items-center gap-2">Enviando enlace...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Enviar Enlace de Recuperación
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-2 text-binance-gray hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
