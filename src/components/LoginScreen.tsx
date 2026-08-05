/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { ShieldAlert, Key, UserCheck, Eye, EyeOff, Crown, Building2, User as UserIcon } from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLogin: (identifier: string, password?: string) => boolean;
}

export default function LoginScreen({ users, onLogin }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('arbitrax19@gmail.com');
  const [password, setPassword] = useState('Arbitrax.2006');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Por favor ingrese su correo o nombre de usuario.');
      return;
    }

    const success = onLogin(identifier.trim(), password);
    if (!success) {
      setErrorMsg('Correo / usuario o contraseña incorrectos.');
    } else {
      setErrorMsg('');
    }
  };

  const handleSelectQuick = (loginId: string, pass: string) => {
    setIdentifier(loginId);
    setPassword(pass);
    setErrorMsg('');
    const success = onLogin(loginId, pass);
    if (!success) {
      setErrorMsg('Correo / usuario o contraseña incorrectos.');
    }
  };

  return (
    <div className="min-h-screen bg-binance-black text-binance-light flex flex-col justify-center items-center p-4 selection:bg-binance-yellow selection:text-binance-black font-sans">
      <div className="w-full max-w-md bg-binance-dark border border-binance-border rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-binance-yellow to-transparent opacity-80" />

        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-binance-yellow to-amber-500 rounded-2xl flex items-center justify-center text-binance-black font-extrabold tracking-wider text-lg shadow-xl">
            ARX
          </div>
          <div>
            <h1 className="font-extrabold text-white text-xl tracking-tight">
              Arbitra<span className="text-binance-yellow">X</span> PRO SaaS
            </h1>
            <span className="text-[10px] text-binance-gray uppercase tracking-widest font-mono font-semibold block mt-1">
              Sistema Multi-Tenant de Arbitraje P2P
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl flex items-center gap-2.5 text-binance-red text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
              Correo Electrónico o Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ej: arbitrax19@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-semibold"
              />
              <div className="absolute left-3.5 top-3.5 text-binance-gray">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
              />
              <div className="absolute left-3.5 top-3.5 text-binance-gray">
                <Key className="w-4 h-4" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-binance-gray hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold rounded-xl transition-all font-mono text-xs shadow-md cursor-pointer tracking-wider uppercase"
          >
            Ingresar al Sistema
          </button>
        </form>

        <div className="space-y-2.5 pt-2 border-t border-binance-border/60">
          <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block text-center font-mono">
            Acceso Rápido por Rol
          </span>

          <div className="space-y-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleSelectQuick('arbitrax19@gmail.com', 'Arbitrax.2006')}
              className="w-full p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-bold text-amber-300 text-[11px]">SUPER ADMIN SAAS</div>
                  <div className="text-[10px] text-binance-gray">arbitrax19@gmail.com</div>
                </div>
              </div>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">Pass: Arbitrax.2006</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectQuick('admiarbitrax1@gmail.com', 'Arbitrax.2006')}
              className="w-full p-2.5 bg-binance-yellow/10 hover:bg-binance-yellow/20 border border-binance-yellow/40 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-binance-yellow" />
                <div>
                  <div className="font-bold text-binance-yellow text-[11px]">ADMIN EMPRESA</div>
                  <div className="text-[10px] text-binance-gray">admiarbitrax1@gmail.com</div>
                </div>
              </div>
              <span className="text-[9px] bg-binance-yellow/20 text-binance-yellow px-2 py-0.5 rounded font-bold">Pass: Arbitrax.2006</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectQuick('roberto.g@arbitrax.com', 'Arbitrax.2006')}
              className="w-full p-2.5 bg-binance-card hover:bg-binance-border border border-binance-border rounded-xl text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-bold text-sky-300 text-[11px]">VENDEDOR (Roberto)</div>
                  <div className="text-[10px] text-binance-gray">roberto.g@arbitrax.com</div>
                </div>
              </div>
              <span className="text-[9px] bg-binance-black text-binance-gray px-2 py-0.5 rounded font-bold">Pass: Arbitrax.2006</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

