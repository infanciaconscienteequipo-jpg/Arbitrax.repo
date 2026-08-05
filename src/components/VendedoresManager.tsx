/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, Plus, Trash2, ShieldAlert, Key, UserX } from 'lucide-react';

interface VendedoresManagerProps {
  users: User[];
  currentUser: User | null;
  onAddUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
}

export default function VendedoresManager({
  users,
  currentUser,
  onAddUser,
  onDeleteUser,
}: VendedoresManagerProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'vendedor' | 'admin'>('vendedor');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !name.trim() || !password.trim()) {
      setErrorMsg('Por favor complete todos los campos.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    const exists = users.some(u => u.username.toLowerCase() === cleanUsername);
    if (exists) {
      setErrorMsg('El nombre de usuario ya existe.');
      return;
    }

    const newUser: User = {
      username: cleanUsername,
      name: name.trim(),
      password: password,
      role,
      organization_id: currentUser?.organization_id || 'org-1',
    };

    onAddUser(newUser);
    setSuccessMsg(`✅ Vendedor ${name.trim()} registrado exitosamente.`);
    setUsername('');
    setName('');
    setPassword('');
    setErrorMsg('');

    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
          Gestión de <span className="text-binance-yellow">Vendedores</span>
        </h1>
        <p className="text-xs text-binance-gray mt-1">
          Cree y administre las cuentas de operadores y vendedores que acceden a la terminal de operaciones.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="lg:col-span-1 bg-binance-card border border-binance-border rounded-2xl p-6 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Plus className="w-4 h-4 text-binance-yellow" /> Nuevo Vendedor
          </h2>

          {errorMsg && (
            <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl flex items-center gap-2 text-binance-red text-2xs">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-binance-green/10 border border-binance-green/30 rounded-xl flex items-center gap-2 text-binance-green text-2xs">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Nombre Completo (Ej: Juan Gómez)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Gómez"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Usuario de Acceso (Ej: juan_p2p)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="juan_p2p"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Rol / Permisos
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'vendedor' | 'admin')}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer font-bold"
              >
                <option value="vendedor">VENDEDOR / CAJERO</option>
                <option value="admin">ADMINISTRADOR</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold rounded-xl transition-all font-mono text-sm shadow-md cursor-pointer tracking-wider"
            >
              REGISTRAR VENDEDOR
            </button>
          </form>
        </div>

        {/* Vendors List */}
        <div className="lg:col-span-2 bg-binance-card border border-binance-border rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Vendedores Activos ({users.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => {
              const isSelf = currentUser?.username === u.username;
              return (
                <div
                  key={u.username}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                    isSelf 
                      ? 'bg-binance-yellow/5 border-binance-yellow/40 premium-glow-yellow' 
                      : 'bg-binance-black/40 border-binance-border'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white font-display">{u.name}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 bg-binance-yellow text-binance-black rounded text-[8px] font-bold tracking-widest uppercase font-mono">
                            TÚ
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-binance-gray block font-mono">
                        Usuario: <span className="text-white">{u.username}</span>
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase font-mono ${
                      u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-binance-green/10 text-binance-green border border-binance-green/20'
                    }`}>
                      {u.role}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-binance-border/50 text-[10px]">
                    <span className="text-binance-gray font-mono">
                      Clave: <span className="text-white font-bold">{u.password || '••••'}</span>
                    </span>

                    {/* Show delete button if not self and we are an admin or has multiple accounts */}
                    {!isSelf && users.length > 1 && (
                      <button
                        onClick={() => onDeleteUser(u.username)}
                        className="text-binance-red hover:text-red-400 p-1 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-all cursor-pointer flex items-center gap-1"
                        title="Eliminar este vendedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-binance-black/20 border border-binance-border rounded-xl flex gap-3 text-binance-gray text-[10px] leading-relaxed">
            <UserCheck className="w-4 h-4 shrink-0 text-binance-yellow mt-0.5" />
            <p>
              Cualquier vendedor cargado en esta lista puede iniciar sesión utilizando su nombre de usuario y contraseña para que su firma se autocomplete en todas las operaciones que registre.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
