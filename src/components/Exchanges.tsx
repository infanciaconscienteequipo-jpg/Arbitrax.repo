import React, { useState } from 'react';
import { ExchangeAccount, User, Wallet } from '../types';
import { Building2, Coins, Plus, User as UserIcon, Trash2, ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';

interface ExchangesProps {
  exchanges: ExchangeAccount[];
  users: User[];
  currentUser: User | null;
  onAddExchange: (exchange: Omit<ExchangeAccount, 'id'>) => void;
  onUpdateExchangeBalance?: (exchangeId: string, newBalance: number) => void;
  onDeleteExchange?: (id: string) => void;
}

export default function Exchanges({
  exchanges,
  users,
  currentUser,
  onAddExchange,
  onDeleteExchange,
}: ExchangesProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [balanceCrypto, setBalanceCrypto] = useState<number>(0);
  const [vendorId, setVendorId] = useState<string>('');

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN' || isSuperAdmin;
  const currentOrgId = currentUser?.organization_id || '';

  // Available Vendors
  const vendorsList = users.length > 0 ? users : Array.from(
    new Set(exchanges.map(e => e.vendorName).filter(Boolean))
  ).map((name, i) => ({ id: name, name, username: name, role: 'VENDEDOR' } as User));

  // Filter exchanges by org and vendor
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const filteredExchanges = exchanges.filter(ex => {
    if (ex.organization_id && ex.organization_id !== currentOrgId) return false;
    if (isVendedor && currentUser) {
      const uName = currentUser.name?.toLowerCase() || '';
      const uUsername = currentUser.username?.toLowerCase() || '';
      const matchId = ex.vendorId === currentUser.id;
      const matchName = (ex.vendorName && uName && ex.vendorName.toLowerCase().includes(uName)) || (ex.vendorName && uUsername && ex.vendorName.toLowerCase().includes(uUsername));
      if (!matchId && !matchName) return false;
    } else if (selectedVendorFilter !== 'all') {
      const vLower = selectedVendorFilter.toLowerCase();
      const matchId = ex.vendorId === selectedVendorFilter;
      const matchName = ex.vendorName?.toLowerCase().includes(vLower);
      return matchId || matchName;
    }
    return true;
  });

  const totalCryptoStock = filteredExchanges.reduce((sum, ex) => sum + ex.balanceCrypto, 0);
  const estimatedUsdtRate = 1240; // ARS per USDT rate
  const totalArsEquivalent = totalCryptoStock * estimatedUsdtRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let assignedVendorId = vendorId;
    let assignedVendorName = '';

    if (!isAdmin && currentUser) {
      assignedVendorId = currentUser.id || '';
      assignedVendorName = currentUser.name;
    } else if (vendorId) {
      const vObj = users.find(u => u.id === vendorId);
      assignedVendorName = vObj?.name || 'Asignado';
    }

    onAddExchange({
      name: name.trim(),
      balanceCrypto: Number(balanceCrypto) || 0,
      vendorId: assignedVendorId,
      vendorName: assignedVendorName,
      organization_id: currentOrgId,
    });

    setName('');
    setBalanceCrypto(0);
    setVendorId('');
    setShowAddModal(false);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER & FILTERS */}
      <div className="bg-binance-card rounded-2xl border border-binance-border p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-display">
              <Coins className="w-6 h-6 text-binance-yellow" />
              Gestión de Exchanges y Stock Cripto
            </h2>
            <p className="text-xs text-binance-gray mt-1">
              {isAdmin
                ? 'Monitoreo unificado de cuentas de Exchanges (Binance, Bybit, Lemon, etc.) y stock individual por vendedor.'
                : 'Tus cuentas de Exchange asociadas para la compra/venta de activos P2P.'}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs rounded-xl shadow-lg hover:bg-binance-yellow/90 cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            Nueva Exchange
          </button>
        </div>

        {/* STATS BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-binance-black p-4 rounded-xl border border-binance-border">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Cuentas Registradas</span>
            <span className="text-xl font-black text-white">{filteredExchanges.length} exchanges</span>
          </div>

          <div className="bg-binance-black p-4 rounded-xl border border-binance-border">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Stock Cripto Total (USDT)</span>
            <span className="text-xl font-black text-binance-green">{totalCryptoStock.toLocaleString()} USDT</span>
          </div>

          <div className="bg-binance-black p-4 rounded-xl border border-binance-border">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Valor Estimado ARS ($)</span>
            <span className="text-xl font-black text-amber-400">{formatMoney(totalArsEquivalent)}</span>
          </div>
        </div>

        {/* VENDOR FILTER */}
        {isAdmin && vendorsList.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-binance-border/50">
            <span className="text-xs font-bold text-binance-gray flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-binance-yellow" />
              Filtrar por Vendedor:
            </span>
            <select
              value={selectedVendorFilter}
              onChange={e => setSelectedVendorFilter(e.target.value)}
              className="px-3 py-1.5 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
            >
              <option value="all">👤 Todos los Vendedores</option>
              {vendorsList.map(v => (
                <option key={v.id || v.name} value={v.id || v.name}>{v.name} ({v.username || v.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* EXCHANGES CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExchanges.map(ex => {
          const vendorObj = users.find(u => u.id === ex.vendorId);
          const arsVal = ex.balanceCrypto * estimatedUsdtRate;

          return (
            <div
              key={ex.id}
              className="bg-binance-card border border-binance-border rounded-2xl p-5 space-y-4 hover:border-binance-yellow/50 transition-all shadow-md relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-binance-yellow/10 border border-binance-yellow/30 text-binance-yellow rounded-xl">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">{ex.name}</h3>
                    <span className="text-[10px] text-binance-gray block">
                      Vendedor: <strong className="text-white">{ex.vendorName || vendorObj?.name || 'General'}</strong>
                    </span>
                  </div>
                </div>

                {onDeleteExchange && (
                  <button
                    onClick={() => onDeleteExchange(ex.id)}
                    className="p-1.5 text-binance-gray hover:text-binance-red hover:bg-binance-red/10 rounded-lg cursor-pointer transition-colors"
                    title="Eliminar Exchange"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1 bg-binance-black/60 p-4 rounded-xl border border-binance-border">
                <span className="text-[10px] text-binance-gray uppercase font-bold block">Stock Disponible USDT</span>
                <div className="text-2xl font-black text-binance-green font-mono">
                  {ex.balanceCrypto.toLocaleString()} <span className="text-xs text-white">USDT</span>
                </div>
                <span className="text-[10px] text-binance-gray block font-mono">
                  ≈ {formatMoney(arsVal)} ARS
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-binance-gray pt-1 border-t border-binance-border/40">
                <span className="flex items-center gap-1 text-binance-green font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Estado Operativo Real
                </span>
                <span>ID: {ex.id.substring(0, 8)}</span>
              </div>
            </div>
          );
        })}

        {filteredExchanges.length === 0 && (
          <div className="col-span-full bg-binance-card border border-binance-border p-12 rounded-2xl text-center text-binance-gray space-y-2">
            <Coins className="w-10 h-10 mx-auto text-binance-gray/40" />
            <p className="font-bold text-white">No hay cuentas de Exchange registradas</p>
            <p className="text-xs">Haga clic en "Nueva Exchange" para crear Binance, Bybit u otra plataforma P2P.</p>
          </div>
        )}
      </div>

      {/* MODAL NUEVA EXCHANGE */}
      {showAddModal && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-binance-yellow" />
                Registrar Nueva Exchange
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-binance-gray hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nombre de la Exchange *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Binance P2P, Bybit, Lemon Cash, OKX"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Saldo Inicial en Crypto (USDT) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={balanceCrypto}
                  onChange={e => setBalanceCrypto(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-binance-green font-bold outline-hidden focus:border-binance-yellow font-mono"
                />
              </div>

              {isAdmin && vendorsList.length > 0 && (
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Vendedor Asignado
                  </label>
                  <select
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                  >
                    <option value="">-- General / Administrador --</option>
                    {vendorsList.map(v => (
                      <option key={v.id || v.name} value={v.id || v.name}>{v.name} ({v.username || v.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-binance-yellow text-binance-black font-extrabold rounded-xl uppercase tracking-wider text-xs shadow-md mt-2 cursor-pointer hover:bg-binance-yellow/90"
              >
                Crear Exchange
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
