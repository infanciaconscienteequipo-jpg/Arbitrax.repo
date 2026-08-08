/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/auth.service';
import { UserCheck, Plus, Archive, ShieldAlert, Edit2, Check, X, RefreshCw, Mail } from 'lucide-react';

interface VendedoresManagerProps {
  users: User[];
  currentUser: User | null;
  onAddUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
  onUpdateUsers?: (users: User[]) => void;
}

export default function VendedoresManager({
  currentUser,
  onAddUser,
  onDeleteUser,
  onUpdateUsers,
}: VendedoresManagerProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState<User[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Estado para edición en línea
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Cargar vendedores exclusivamente desde Supabase para la empresa activa
  const loadSellersFromSupabase = async () => {
    if (!currentUser?.organization_id) return;
    setLoading(true);
    try {
      const fetchedUsers = await authService.listUsers(undefined, currentUser.organization_id);
      const sellersOnly = fetchedUsers.filter(u => {
        const r = (u.role || '').toUpperCase();
        return r === 'VENDEDOR' || r === 'SELLER';
      });
      setSellers(sellersOnly);
      if (onUpdateUsers) {
        onUpdateUsers(fetchedUsers);
      }
    } catch (err) {
      console.error('Error al cargar vendedores desde Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellersFromSupabase();
  }, [currentUser?.organization_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    if (!cleanUsername) {
      setErrorMsg('El usuario de acceso es obligatorio.');
      return;
    }

    if (!cleanEmail) {
      setErrorMsg('El correo electrónico es obligatorio.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Por favor ingrese un correo electrónico válido (ej: vendedor@empresa.com).');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('La contraseña es obligatoria.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const existsUsername = sellers.some(u => u.username.toLowerCase() === cleanUsername);
    if (existsUsername) {
      setErrorMsg('El nombre de usuario ya está registrado en la organización.');
      return;
    }

    const existsEmail = sellers.some(u => u.email?.toLowerCase() === cleanEmail);
    if (existsEmail) {
      setErrorMsg('El correo electrónico ya está registrado.');
      return;
    }

    const orgId = currentUser?.organization_id;
    if (!orgId) {
      setErrorMsg('No se detectó la organización del usuario administrador.');
      return;
    }

    setLoading(true);
    try {
      // Flujo de creación de vendedor en Supabase sin alterar la sesión del ADMIN
      // Edge Function create-user -> rpc_create_seller -> public.users
      const createdUser = await authService.createSeller({
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
        username: cleanUsername,
        organization_id: orgId,
      });

      setSuccessMsg(`✅ Vendedor ${cleanName} registrado exitosamente en Supabase Auth.`);
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');

      if (onAddUser) {
        onAddUser(createdUser);
      }

      await loadSellersFromSupabase();

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al registrar vendedor en Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (seller: User) => {
    if (!confirm('¿Desea archivar este vendedor?\nNo podrá iniciar sesión, pero todas sus operaciones permanecerán registradas.')) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const sellerId = seller.id || seller.username;
      const ok = await authService.deleteSeller(sellerId);
      if (ok) {
        setSuccessMsg('Vendedor archivado correctamente.');
        if (onDeleteUser) onDeleteUser(seller.username);
        await loadSellersFromSupabase();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al archivar vendedor.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (seller: User) => {
    setEditingId(seller.id);
    setEditName(seller.name);
    setEditEmail(seller.email || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
  };

  const saveEdit = async (seller: User) => {
    if (!editName.trim()) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const ok = await authService.updateSeller({
        id: seller.id,
        name: editName.trim(),
        username: seller.username,
        email: editEmail.trim().toLowerCase(),
        active: seller.active !== false && seller.status === 'active',
      });
      if (ok) {
        setSuccessMsg(`✅ Vendedor ${seller.username} actualizado correctamente.`);
        cancelEdit();
        await loadSellersFromSupabase();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar vendedor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
            Gestión de <span className="text-binance-yellow">Vendedores</span>
          </h1>
          <p className="text-xs text-binance-gray mt-1">
            Cree y administre las cuentas de vendedores respaldadas en Supabase Auth y public.users.
          </p>
        </div>

        <button
          onClick={loadSellersFromSupabase}
          disabled={loading}
          className="px-3 py-1.5 bg-binance-black border border-binance-border hover:border-binance-yellow/50 rounded-xl text-binance-gray hover:text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer font-mono"
          title="Refrescar lista desde Supabase"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-binance-yellow' : ''}`} />
          <span>Refrescar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Registro */}
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
            {/* Campo 1: Nombre Completo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Nombre Completo (Ej: Juan Gómez) *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Gómez"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden"
              />
            </div>

            {/* Campo 2: Usuario de Acceso */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Usuario de Acceso (Ej: juan_p2p) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="juan_p2p"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
              />
            </div>

            {/* Campo 3: Email (NUEVO CAMPO OBLIGATORIO) ubicado DEBAJO de Usuario */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block flex items-center justify-between">
                <span>Correo Electrónico *</span>
                <span className="text-[9px] text-binance-yellow font-normal font-mono">Para Supabase Auth</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendedor@empresa.com"
                  className="w-full px-4 py-2.5 pl-10 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                />
                <Mail className="w-4 h-4 text-binance-gray absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Campo 4: Contraseña */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Contraseña *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
              />
            </div>

            {/* Campo 5: Rol / Permisos */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                Rol / Permisos
              </label>
              <select
                value="VENDEDOR"
                disabled
                className="w-full px-4 py-2.5 bg-binance-black/60 border border-binance-border rounded-xl text-binance-green font-bold text-sm outline-hidden font-mono cursor-not-allowed opacity-90"
              >
                <option value="VENDEDOR">VENDEDOR</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold rounded-xl transition-all font-mono text-sm shadow-md cursor-pointer tracking-wider disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>REGISTRANDO EN SUPABASE...</span>
                </>
              ) : (
                <span>REGISTRAR VENDEDOR</span>
              )}
            </button>
          </form>
        </div>

        {/* Listado de Vendedores desde Supabase */}
        <div className="lg:col-span-2 bg-binance-card border border-binance-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Vendedores {showArchived ? 'Registrados' : 'Activos'} en Supabase (
              {sellers.filter((u) => (showArchived ? true : u.active !== false && u.status === 'active')).length}
              )
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-mono text-binance-gray cursor-pointer hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-3.5 h-3.5 accent-binance-yellow rounded cursor-pointer"
                />
                <span>Mostrar vendedores archivados</span>
              </label>
              <span className="text-[10px] text-binance-gray font-mono">
                Org: <span className="text-binance-yellow font-bold">{currentUser?.organization_id || 'Sin Org'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sellers
              .filter((u) => (showArchived ? true : u.active !== false && u.status === 'active'))
              .map((u) => {
                const isSelf = currentUser?.username === u.username;
                const isEditing = editingId === u.id;
                const isActive = u.active !== false && u.status === 'active';

                return (
                  <div
                    key={u.id || u.username}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                      isSelf 
                        ? 'bg-binance-yellow/5 border-binance-yellow/40 premium-glow-yellow' 
                        : 'bg-binance-black/40 border-binance-border hover:border-binance-yellow/30'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 bg-binance-black border border-binance-yellow rounded text-sm text-white font-bold w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white font-display">{u.name}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 bg-binance-yellow text-binance-black rounded text-[8px] font-bold tracking-widest uppercase font-mono">
                                  TÚ
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] text-binance-gray block font-mono">
                            Usuario: <span className="text-white">{u.username}</span>
                          </span>
                        </div>

                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase font-mono bg-binance-green/10 text-binance-green border border-binance-green/20">
                          {u.role || 'VENDEDOR'}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-binance-gray">
                        {isEditing ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="px-2 py-1 bg-binance-black border border-binance-yellow rounded text-xs text-white font-mono w-full mt-1"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-binance-gray">
                            <Mail className="w-3 h-3 text-binance-yellow shrink-0" />
                            <span className="text-white truncate">{u.email || 'Sin correo'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-binance-border/50 text-[10px]">
                      <span className="text-binance-gray font-mono">
                        Estado:{' '}
                        {isActive ? (
                          <span className="text-binance-green font-bold">Activo</span>
                        ) : (
                          <span className="text-binance-red font-bold">Archivado</span>
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(u)}
                              className="text-binance-green hover:bg-binance-green/20 p-1 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                              title="Guardar cambios"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Guardar</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-binance-gray hover:text-white p-1 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(u)}
                              className="text-binance-yellow hover:bg-binance-yellow/10 p-1 rounded transition-all cursor-pointer flex items-center gap-1 font-mono"
                              title="Editar en Supabase"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            {!isSelf && isActive && (
                              <button
                                onClick={() => handleArchive(u)}
                                className="text-binance-red hover:text-red-400 p-1 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-all cursor-pointer flex items-center gap-1 font-mono"
                                title="Archivar vendedor"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archivar</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {sellers.length === 0 && !loading && (
              <div className="col-span-2 py-8 text-center text-binance-gray text-xs font-mono space-y-2">
                <p>No se encontraron vendedores registrados en Supabase para esta organización.</p>
                <p className="text-[10px] text-binance-yellow">Utilice el formulario para crear el primer vendedor.</p>
              </div>
            )}
          </div>

          <div className="p-3 bg-binance-black/20 border border-binance-border rounded-xl flex gap-3 text-binance-gray text-[10px] leading-relaxed">
            <UserCheck className="w-4 h-4 shrink-0 text-binance-yellow mt-0.5" />
            <p>
              Todos los vendedores creados están registrados en <strong>Supabase Auth</strong> y vinculados mediante <code>rpc_create_seller</code>. Pueden iniciar sesión con su correo o usuario y contraseña.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

