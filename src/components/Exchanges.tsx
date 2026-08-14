import React, { useState } from 'react';
import { ExchangeAccount, User, Wallet } from '../types';
import {
  Building2,
  Coins,
  Plus,
  User as UserIcon,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Wallet as WalletIcon,
  Send,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';

interface ExchangesProps {
  exchanges: ExchangeAccount[];
  users: User[];
  currentUser: User | null;
  onAddExchange: (exchange: Omit<ExchangeAccount, 'id'>) => void;
  onUpdateExchangeBalance?: (exchangeId: string, newBalance: number) => void;
  onDeleteExchange?: (id: string) => void;
  onTransferCryptoToAdmin?: (params: {
    exchangeId: string;
    amount: number;
    notes?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export default function Exchanges({
  exchanges,
  users,
  currentUser,
  onAddExchange,
  onDeleteExchange,
  onTransferCryptoToAdmin,
}: ExchangesProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Transfer to Admin Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferExchangeId, setTransferExchangeId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [transferSuccess, setTransferSuccess] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState('');
  const [balanceCrypto, setBalanceCrypto] = useState<number>(0);
  const [vendorId, setVendorId] = useState<string>('');

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN' || isSuperAdmin;
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const currentOrgId = currentUser?.organization_id || '';

  // Available Vendors
  const vendorsList = users.length > 0 ? users : Array.from(
    new Set(exchanges.map(e => e.vendorName).filter(Boolean))
  ).map((name, i) => ({ id: name, name, username: name, role: 'VENDEDOR' } as User));

  // Filter exchanges by org and vendor
  const filteredExchanges = exchanges.filter(ex => {
    if (ex.organization_id && ex.organization_id !== currentOrgId) return false;
    if (isVendedor && currentUser) {
      if (!ex.vendorId || ex.vendorId !== currentUser.id) return false;
    } else if (selectedVendorFilter !== 'all') {
      const vLower = selectedVendorFilter.toLowerCase();
      const matchId = ex.vendorId === selectedVendorFilter;
      const matchName = ex.vendorName?.toLowerCase().includes(vLower);
      return matchId || matchName;
    }
    return true;
  });

  // Exchanges owned by current user (for transfer modal)
  const myExchanges = exchanges.filter(ex => {
    if (ex.organization_id && ex.organization_id !== currentOrgId) return false;
    if (isVendedor && currentUser) {
      return Boolean(ex.vendorId && ex.vendorId === currentUser.id);
    }
    return true;
  });

  const selectedTransferExchange = myExchanges.find(ex => ex.id === transferExchangeId) || myExchanges[0];

  const totalCryptoStock = filteredExchanges.reduce((sum, ex) => sum + ex.balanceCrypto, 0);
  const estimatedUsdtRate = 1240; // ARS per USDT rate
  const totalArsEquivalent = totalCryptoStock * estimatedUsdtRate;

  const handleOpenTransfer = (exchange?: ExchangeAccount) => {
    const targetId = exchange?.id || (myExchanges.length > 0 ? myExchanges[0].id : '');
    setTransferExchangeId(targetId);
    setTransferAmount('');
    setTransferNotes('');
    setTransferError('');
    setTransferSuccess('');
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onTransferCryptoToAdmin) return;

    if (!selectedTransferExchange) {
      setTransferError('Debe seleccionar una cuenta de Exchange origen.');
      return;
    }

    const numAmount = typeof transferAmount === 'number' ? transferAmount : 0;
    if (numAmount <= 0) {
      setTransferError('La cantidad a transferir debe ser mayor a cero.');
      return;
    }

    if (numAmount > selectedTransferExchange.balanceCrypto) {
      setTransferError(`Saldo insuficiente en ${selectedTransferExchange.name}. Disponible: ${selectedTransferExchange.balanceCrypto} USDT.`);
      return;
    }

    setIsTransferring(true);
    setTransferError('');

    try {
      const res = await onTransferCryptoToAdmin({
        exchangeId: selectedTransferExchange.id,
        amount: numAmount,
        notes: transferNotes.trim() || undefined,
      });

      if (res.success) {
        setTransferSuccess(`✅ Se transfirieron con éxito ${numAmount} USDT a la Billetera Administrativa.`);
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess('');
          setTransferAmount('');
          setTransferNotes('');
        }, 2000);
      } else {
        setTransferError(res.error || 'Error al procesar la transferencia.');
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Error inesperado al conectar con el servidor.');
    } finally {
      setIsTransferring(false);
    }
  };

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
                : 'Tus cuentas de Exchange asociadas para la compra/venta de activos P2P y transferencia de custodia.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {myExchanges.length > 0 && onTransferCryptoToAdmin && (
              <button
                onClick={() => handleOpenTransfer()}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer uppercase tracking-wider transition-all"
              >
                <Send className="w-4 h-4" />
                Enviar al Administrador
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs rounded-xl shadow-lg hover:bg-binance-yellow/90 cursor-pointer uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              Nueva Exchange
            </button>
          </div>
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

              {/* ACTION: Enviar al administrador */}
              {onTransferCryptoToAdmin && (
                <button
                  onClick={() => handleOpenTransfer(ex)}
                  className="w-full py-2 px-3 bg-binance-black hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar al Administrador
                </button>
              )}

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

      {/* MODAL TRANSFERENCIA VENDEDOR -> ADMIN */}
      {showTransferModal && selectedTransferExchange && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    Enviar Crypto al Administrador
                  </h3>
                  <span className="text-[10px] text-binance-gray">Transferencia segura atómica a Bóveda Central</span>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-binance-gray hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-binance-red/20 border border-binance-red/40 rounded-xl text-binance-red text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div className="p-3 bg-binance-green/20 border border-binance-green/40 rounded-xl text-binance-green text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {transferSuccess}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              {/* Select Exchange origen */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Exchange Origen *
                </label>
                <select
                  value={transferExchangeId}
                  onChange={e => setTransferExchangeId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold"
                >
                  {myExchanges.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} — Saldo: {ex.balanceCrypto} USDT
                    </option>
                  ))}
                </select>
              </div>

              {/* Saldo Disponible & Saldo Posterior calculation */}
              <div className="grid grid-cols-2 gap-3 bg-binance-black p-3.5 rounded-xl border border-binance-border">
                <div>
                  <span className="text-[10px] text-binance-gray block font-bold">Saldo Disponible</span>
                  <span className="text-base font-black text-binance-green font-mono">
                    {selectedTransferExchange.balanceCrypto.toLocaleString()} USDT
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray block font-bold">Saldo Posterior</span>
                  <span className="text-base font-black text-white font-mono">
                    {Math.max(
                      0,
                      selectedTransferExchange.balanceCrypto -
                        (typeof transferAmount === 'number' ? transferAmount : 0)
                    ).toLocaleString()}{' '}
                    USDT
                  </span>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Cantidad a Transferir (USDT) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    max={selectedTransferExchange.balanceCrypto}
                    className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-binance-green font-black text-sm outline-hidden focus:border-binance-yellow font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setTransferAmount(selectedTransferExchange.balanceCrypto)}
                    className="absolute right-2 top-2 px-2 py-1 bg-binance-black hover:bg-binance-border text-binance-yellow border border-binance-yellow/30 text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Observaciones / Motivo del Envío
                </label>
                <textarea
                  placeholder="ej. Cierre de turno, reposición de custodia administrativa..."
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2.5 border border-binance-border text-binance-gray hover:text-white font-bold rounded-xl uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isTransferring ||
                    typeof transferAmount !== 'number' ||
                    transferAmount <= 0 ||
                    transferAmount > selectedTransferExchange.balanceCrypto
                  }
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold rounded-xl uppercase text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isTransferring ? 'Transfiriendo...' : 'Confirmar Envío'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

