/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/auth.service';
import { UserCheck, Plus, Archive, ShieldAlert, Edit2, Check, X, RefreshCw, Mail, Users, FileSpreadsheet, ShieldCheck } from 'lucide-react';

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
  const [activeSubTab, setActiveSubTab] = useState<'vendedores' | 'contadora'>('vendedores');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState<User[]>([]);
  const [contadoras, setContadoras] = useState<User[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Estado para edición en línea
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const activeContadora = contadoras.find(c => c.active !== false && c.status === 'active');

  // Cargar usuarios exclusivamente desde Supabase para la empresa activa
  const loadUsersFromSupabase = async () => {
    if (!currentUser?.organization_id) return;
    setLoading(true);
    try {
      const fetchedUsers = await authService.listUsers(undefined, currentUser.organization_id);
      const sellersOnly = fetchedUsers.filter(u => {
        const r = (u.role || '').toUpperCase();
        return r === 'VENDEDOR' || r === 'SELLER';
      });
      const contadorasOnly = fetchedUsers.filter(u => {
        const r = (u.role || '').toUpperCase();
        return r === 'CONTADORA' || r === 'CONTADOR';
      });
      setSellers(sellersOnly);
      setContadoras(contadorasOnly);
      if (onUpdateUsers) {
        onUpdateUsers(fetchedUsers);
      }
    } catch (err) {
      console.error('Error al cargar usuarios desde Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsersFromSupabase();
  }, [currentUser?.organization_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const rawPassword = password;

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
      setErrorMsg('Por favor ingrese un correo electrónico válido (ej: usuario@empresa.com).');
      return;
    }

    if (!rawPassword) {
      setErrorMsg('La contraseña es obligatoria.');
      return;
    }

    if (rawPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    const allUsers = [...sellers, ...contadoras];
    const existsUsername = allUsers.some(u => u.username.toLowerCase() === cleanUsername);
    if (existsUsername) {
      setErrorMsg('El nombre de usuario ya está registrado en la organización.');
      return;
    }

    const existsEmail = allUsers.some(u => u.email?.toLowerCase() === cleanEmail);
    if (existsEmail) {
      setErrorMsg('El correo electrónico ya está registrado.');
      return;
    }

    const orgId = currentUser?.organization_id;
    if (!orgId) {
      setErrorMsg('No se detectó la organización del usuario administrador.');
      return;
    }

    if (activeSubTab === 'contadora' && activeContadora) {
      setErrorMsg('Esta organización ya tiene una CONTADORA activa.');
      return;
    }

    setLoading(true);
    try {
      let createdUser: User;
      if (activeSubTab === 'contadora') {
        createdUser = await authService.createContadora({
          email: cleanEmail,
          password: rawPassword,
          name: cleanName,
          username: cleanUsername,
          organization_id: orgId,
        });
        setSuccessMsg(`✅ Contadora ${cleanName} registrada exitosamente.`);
      } else {
        createdUser = await authService.createSeller({
          email: cleanEmail,
          password: rawPassword,
          name: cleanName,
          username: cleanUsername,
          organization_id: orgId,
        });
        setSuccessMsg(`✅ Vendedor ${cleanName} registrado exitosamente.`);
      }

      setName('');
      setUsername('');
      setEmail('');
      setPassword('');

      if (onAddUser) {
        onAddUser(createdUser);
      }

      await loadUsersFromSupabase();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al registrar usuario en Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (user: User) => {
    const isCont = (user.role || '').toUpperCase().includes('CONTAD');
    const label = isCont ? 'esta contadora' : 'este vendedor';
    if (!confirm(`¿Desea archivar ${label}?\nNo podrá iniciar sesión, pero los registros históricos permanecerán guardados.`)) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const userId = user.id || user.username;
      const ok = await authService.deleteSeller(userId);
      if (ok) {
        setSuccessMsg(`${isCont ? 'Contadora' : 'Vendedor'} archivado correctamente.`);
        if (onDeleteUser) onDeleteUser(user.username);
        await loadUsersFromSupabase();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al archivar usuario.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
  };

  const saveEdit = async (user: User) => {
    if (!editName.trim()) {
      setErrorMsg('El nombre no puede estar vacío.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const ok = await authService.updateSeller({
        id: user.id,
        name: editName.trim(),
        username: user.username,
        email: editEmail.trim().toLowerCase(),
        active: user.active !== false && user.status === 'active',
      });
      if (ok) {
        setSuccessMsg(`✅ Usuario ${user.username} actualizado correctamente.`);
        cancelEdit();
        await loadUsersFromSupabase();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar usuario.');
    } finally {
      setLoading(false);
    }
  };

  const displayedList = activeSubTab === 'contadora' ? contadoras : sellers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
            Gestión de <span className="text-binance-yellow">Equipo y Usuarios</span>
          </h1>
          <p className="text-xs text-binance-gray mt-1">
            Administre vendedores y contadora asignados automáticamente a su organización.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* SUB-TABS */}
          <div className="flex bg-binance-black p-1 rounded-xl border border-binance-border font-mono text-xs">
            <button
              onClick={() => { setActiveSubTab('vendedores'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'vendedores'
                  ? 'bg-binance-yellow text-binance-black shadow-md'
                  : 'text-binance-gray hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Vendedores ({sellers.length})</span>
            </button>
            <button
              onClick={() => { setActiveSubTab('contadora'); setErrorMsg(''); setSuccessMsg(''); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'contadora'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-binance-gray hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Contadora {activeContadora ? '(Activa)' : '(0)'}</span>
            </button>
          </div>

          <button
            onClick={loadUsersFromSupabase}
            disabled={loading}
            className="px-3 py-2 bg-binance-black border border-binance-border hover:border-binance-yellow/50 rounded-xl text-binance-gray hover:text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer font-mono"
            title="Refrescar lista desde Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-binance-yellow' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de Registro */}
        <div className="lg:col-span-1 bg-binance-card border border-binance-border rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Plus className="w-4 h-4 text-binance-yellow" />
              {activeSubTab === 'contadora' ? 'Registrar Contadora' : 'Nuevo Vendedor'}
            </h2>
            {activeSubTab === 'contadora' && activeContadora && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[9px] font-extrabold uppercase font-mono">
                CONTADORA ACTIVA
              </span>
            )}
          </div>

          {activeSubTab === 'contadora' && activeContadora && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2 text-xs font-mono text-purple-200">
              <div className="flex items-center gap-2 font-bold text-purple-300">
                <ShieldCheck className="w-4 h-4" />
                <span>CONTADORA ACTIVA EN LA EMPRESA</span>
              </div>
              <p className="text-[11px] text-binance-gray">
                Esta organización ya cuenta con una CONTADORA activa (<span className="text-white font-bold">{activeContadora.name}</span>). Solo se permite 1 contadora activa por organización.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl flex items-center gap-2 text-binance-red text-2xs font-mono">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-binance-green/10 border border-binance-green/30 rounded-xl flex items-center gap-2 text-binance-green text-2xs font-mono">
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {!(activeSubTab === 'contadora' && activeContadora) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo 1: Nombre Completo */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeSubTab === 'contadora' ? 'Lic. María Fernández' : 'Juan Gómez'}
                  className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden"
                />
              </div>

              {/* Campo 2: Usuario de Acceso */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                  Usuario de Acceso *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={activeSubTab === 'contadora' ? 'maria_contable' : 'juan_p2p'}
                  className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                />
              </div>

              {/* Campo 3: Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={activeSubTab === 'contadora' ? 'contabilidad@empresa.com' : 'vendedor@empresa.com'}
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
                  Rol Asignado
                </label>
                <div className="w-full px-4 py-2.5 bg-binance-black/60 border border-binance-border rounded-xl text-xs font-bold font-mono">
                  {activeSubTab === 'contadora' ? (
                    <span className="text-purple-300">CONTADORA (100% Solo Lectura de Cierres e Informes)</span>
                  ) : (
                    <span className="text-binance-green">VENDEDOR (Operador de Billeteras y Jornadas)</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 font-extrabold rounded-xl transition-all font-mono text-sm shadow-md cursor-pointer tracking-wider disabled:opacity-50 flex justify-center items-center gap-2 ${
                  activeSubTab === 'contadora'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>REGISTRANDO...</span>
                  </>
                ) : (
                  <span>{activeSubTab === 'contadora' ? 'REGISTRAR CONTADORA' : 'REGISTRAR VENDEDOR'}</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Listado de Usuarios desde Supabase */}
        <div className="lg:col-span-2 bg-binance-card border border-binance-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              {activeSubTab === 'contadora' ? 'Contadora de la Organización' : 'Vendedores'} {showArchived ? 'Registrados' : 'Activos'} (
              {displayedList.filter((u) => (showArchived ? true : u.active !== false && u.status === 'active')).length}
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
                <span>Mostrar archivados</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedList
              .filter((u) => (showArchived ? true : u.active !== false && u.status === 'active'))
              .map((u) => {
                const isSelf = currentUser?.username === u.username;
                const isEditing = editingId === u.id;
                const isActive = u.active !== false && u.status === 'active';
                const isCont = (u.role || '').toUpperCase().includes('CONTAD');

                return (
                  <div
                    key={u.id || u.username}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                      isCont
                        ? 'bg-purple-900/10 border-purple-500/40'
                        : isSelf
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

                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-widest uppercase font-mono ${
                          isCont
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-binance-green/10 text-binance-green border border-binance-green/20'
                        }`}>
                          {u.role || (isCont ? 'CONTADORA' : 'VENDEDOR')}
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
                                title="Archivar usuario"
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

            {displayedList.length === 0 && !loading && (
              <div className="col-span-2 py-8 text-center text-binance-gray text-xs font-mono space-y-2">
                <p>
                  {activeSubTab === 'contadora'
                    ? 'No se ha registrado una Contadora para esta organización.'
                    : 'No se encontraron vendedores registrados en Supabase para esta organización.'}
                </p>
                <p className="text-[10px] text-binance-yellow">
                  {activeSubTab === 'contadora'
                    ? 'Utilice el formulario de la izquierda para registrar a la Contadora.'
                    : 'Utilice el formulario para crear el primer vendedor.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

