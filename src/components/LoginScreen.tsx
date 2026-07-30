/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { ShieldAlert, Key, UserCheck, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLogin: (username: string, password?: string) => boolean;
}

export default function LoginScreen({ users, onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('demo chip');
  const [password, setPassword] = useState('123');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Por favor ingrese su usuario.');
      return;
    }

    const success = onLogin(username.trim(), password);
    if (!success) {
      setErrorMsg('Usuario o contraseña incorrectos. (Pruebe con "demo chip" y contraseña "123")');
    } else {
      setErrorMsg('');
    }
  };

  const handleSelectPreseeded = (user: User) => {
    setUsername(user.username);
    setPassword(user.password || '123');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-binance-black text-binance-light flex flex-col justify-center items-center p-4 selection:bg-binance-yellow selection:text-binance-black">
      {/* Container */}
      <div className="w-full max-w-md bg-binance-dark border border-binance-border rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Subtle glowing accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-binance-yellow to-transparent opacity-80" />

        {/* Brand Area */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-binance-yellow to-amber-500 rounded-2xl flex items-center justify-center text-binance-black font-extrabold tracking-wider text-base shadow-xl transform hover:scale-105 transition-transform duration-200">
            ARX
          </div>
          <div>
            <h1 className="font-display font-extrabold text-white text-xl tracking-tight">
              Iniciar Sesión en <span className="text-binance-yellow">ArbitraX</span>
            </h1>
            <span className="text-[10px] text-binance-gray uppercase tracking-widest font-mono font-semibold block mt-1">
              Terminal de Control de Liquidez P2P
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl flex items-center gap-2.5 text-binance-red text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
              Usuario
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nombre de usuario"
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
            className="w-full py-3 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold rounded-xl transition-all font-mono text-sm shadow-md cursor-pointer tracking-wider hover:shadow-binance-yellow/20"
          >
            INGRESAR A LA TERMINAL
          </button>
        </form>

        {/* Preloaded accounts selector */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="h-px bg-binance-border flex-1" />
            <span className="text-[9px] text-binance-gray font-bold uppercase tracking-widest font-mono">
              Cuentas de Vendedores
            </span>
            <span className="h-px bg-binance-border flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {users.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => handleSelectPreseeded(u)}
                className="p-2 bg-binance-black hover:bg-binance-card hover:border-binance-yellow border border-binance-border rounded-xl text-left transition-all cursor-pointer block"
              >
                <div className="font-bold text-white truncate font-mono">{u.name}</div>
                <div className="text-binance-gray mt-0.5 truncate">Pass: {u.password || '123'}</div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
