import React, { useState, useMemo } from 'react';
import { Transaction, Wallet, ExchangeAccount, User } from '../types';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, Coins, FileDown, Trash2, Clock, SlidersHorizontal, Plus, ShieldCheck, DollarSign, CheckCircle2, Edit3, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface MovimientosProps {
  transactions: Transaction[];
  wallets: Wallet[];
  exchanges?: ExchangeAccount[];
  users?: User[];
  currentUser?: User | null;
  onClearTransactions?: () => void;
  onAddTransaction?: (tx: Omit<Transaction, 'id'>) => void | Promise<void>;
  onUpdateTransaction?: (tx: Transaction) => Promise<{ success: boolean; error?: string }>;
}

export default function Movimientos({
  transactions,
  wallets,
  exchanges = [],
  users = [],
  currentUser,
  onClearTransactions,
  onAddTransaction,
  onUpdateTransaction,
}: MovimientosProps) {
  // P2P Trade Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [tradeType, setTradeType] = useState<'compra' | 'venta'>('compra');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [selectedExchangeId, setSelectedExchangeId] = useState('');
  const [totalPesosInput, setTotalPesosInput] = useState<number | ''>('');
  const [cryptoQtyInput, setCryptoQtyInput] = useState<number | ''>('');
  const [cryptoTicker, setCryptoTicker] = useState('USDT');
  const [clientOrSupplier, setClientOrSupplier] = useState('');
  const [tradeNotes, setTradeNotes] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Edit Transaction Modal State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editType, setEditType] = useState<'compra' | 'venta' | 'ingreso_fondos' | 'egreso_fondos'>('compra');
  const [editTotalPesos, setEditTotalPesos] = useState<number | ''>('');
  const [editCryptoQty, setEditCryptoQty] = useState<number | ''>('');
  const [editWalletId, setEditWalletId] = useState('');
  const [editExchangeId, setEditExchangeId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editClientOrSupplier, setEditClientOrSupplier] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Filters State
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [cryptoFilter, setCryptoFilter] = useState('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [generalSearch, setGeneralSearch] = useState('');

  // Custom Date and Time Filters
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, cryptoFilter, walletFilter, exchangeFilter, typeFilter, vendorFilter, generalSearch, operatorSearch, customStartDate, customStartTime, customEndDate, customEndTime]);

  const currentOrgId = currentUser?.organization_id || '';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isVendedor = currentUser?.role === 'VENDEDOR';

  // Auto-calc unit price: Monto ARS / Cantidad Crypto
  const calculatedUnitPrice = (typeof totalPesosInput === 'number' && typeof cryptoQtyInput === 'number' && cryptoQtyInput > 0)
    ? totalPesosInput / cryptoQtyInput
    : 0;

  const availableWallets = wallets.filter(w => !isVendedor || (w.vendorId && w.vendorId === currentUser?.id));
  const availableExchanges = exchanges.filter(ex => !isVendedor || (ex.vendorId && ex.vendorId === currentUser?.id));

  // Auto-select defaults for form
  React.useEffect(() => {
    if (availableWallets.length > 0 && (!selectedWalletId || !availableWallets.some(w => w.id === selectedWalletId))) {
      setSelectedWalletId(availableWallets[0].id);
    }
    if (availableExchanges.length > 0 && (!selectedExchangeId || !availableExchanges.some(ex => ex.id === selectedExchangeId))) {
      setSelectedExchangeId(availableExchanges[0].id);
    }
  }, [availableWallets, availableExchanges, selectedWalletId, selectedExchangeId]);

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddTransaction) return;
    setFormError('');
    setFormSuccess('');

    if (typeof totalPesosInput !== 'number' || totalPesosInput <= 0) return;
    if (typeof cryptoQtyInput !== 'number' || cryptoQtyInput <= 0) return;

    const walletObj = wallets.find(w => w.id === selectedWalletId);
    if (walletObj?.blocked) {
      alert(`⛔ La billetera "${walletObj.name}" está BLOQUEADA. Desbloquéela en el panel de Billeteras para realizar operaciones.`);
      return;
    }

    const exchangeObj = exchanges.find(ex => ex.id === selectedExchangeId);

    const now = new Date();
    const isoStr = now.toISOString();
    const dateStr = isoStr.split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    // Estimated Gain calculation for sales
    let gain = 0;
    if (tradeType === 'venta') {
      const estimatedAvgBuyPrice = 1220; // Avg buy price ARS per USDT
      gain = (calculatedUnitPrice - estimatedAvgBuyPrice) * cryptoQtyInput;
    }

    try {
      await onAddTransaction({
        type: tradeType,
        timestamp: isoStr,
        dateString: dateStr,
        timeString: timeStr,
        crypto: cryptoTicker,
        quantity: cryptoQtyInput,
        unitPrice: calculatedUnitPrice,
        totalPesos: totalPesosInput,
        walletId: selectedWalletId,
        walletName: walletObj ? walletObj.name : 'Billetera',
        operator: currentUser?.name || currentUser?.username || 'Operador',
        client: tradeType === 'venta' ? clientOrSupplier : undefined,
        supplier: tradeType === 'compra' ? clientOrSupplier : undefined,
        gain: tradeType === 'venta' ? gain : undefined,
        notes: `${tradeNotes} | Exchange: ${exchangeObj ? exchangeObj.name : 'P2P'}`.trim(),
        exchangeId: selectedExchangeId || undefined,
        exchangeName: exchangeObj?.name || undefined,
        sellerId: isVendedor ? currentUser?.id : undefined,
      });

      setFormSuccess(`✅ Operación de ${tradeType.toUpperCase()} registrada exitosamente.`);
    } catch (err: any) {
      console.error('Error al registrar operación:', err);
      setFormError(err?.message || 'No se pudo registrar la operación.');
      return;
    }
    setTotalPesosInput('');
    setCryptoQtyInput('');
    setClientOrSupplier('');
    setTradeNotes('');

    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Extract unique vendors for filter dropdown (only for non-sellers)
  const activeVendorUsers = isVendedor
    ? []
    : users.filter(u =>
        u.active !== false &&
        u.status === 'active' &&
        (u.role || '').toUpperCase() === 'VENDEDOR' &&
        u.organization_id === currentOrgId
      );

  const uniqueVendors = activeVendorUsers.map(u => ({
    id: u.id || '',
    name: u.name || u.username,
    username: u.username,
  }));

  // Extract unique cryptos for filter
  const uniqueCryptos = Array.from(new Set(transactions.map(t => t.crypto.toUpperCase()))).filter(Boolean);

  // Helper to safely obtain a Date object for a transaction
  const getTxDate = (t: Transaction): Date | null => {
    if (t.timestamp) {
      const d = new Date(t.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (t.dateString) {
      const timeStr = t.timeString || '12:00:00';
      const d = new Date(`${t.dateString}T${timeStr}`);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Filter transactions
  const filteredTxs = transactions.filter(t => {
    const txDate = getTxDate(t);
    const now = new Date();
    
    // Time/Date Filtering
    if (timeFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      const tStr = t.dateString || (t.timestamp ? t.timestamp.split('T')[0] : '');
      if (todayStr !== tStr) return false;
    } else if (timeFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      if (!txDate || txDate < oneWeekAgo) return false;
    } else if (timeFilter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      if (!txDate || txDate < oneMonthAgo) return false;
    } else if (timeFilter === 'custom') {
      if (!txDate) return false;
      const txMs = txDate.getTime();

      // Lower bound check (Fecha + Hora desde)
      if (customStartDate) {
        const timePart = customStartTime ? customStartTime : '00:00';
        const startMs = new Date(`${customStartDate}T${timePart}:00`).getTime();
        if (!isNaN(startMs) && txMs < startMs) return false;
      } else if (customStartTime) {
        const [sH, sM] = customStartTime.split(':').map(Number);
        const txMinutes = txDate.getHours() * 60 + txDate.getMinutes();
        const startMinutes = (sH || 0) * 60 + (sM || 0);
        if (txMinutes < startMinutes) return false;
      }

      // Upper bound check (Fecha + Hora hasta)
      if (customEndDate) {
        const timePart = customEndTime ? customEndTime : '23:59';
        const endMs = new Date(`${customEndDate}T${timePart}:59`).getTime();
        if (!isNaN(endMs) && txMs > endMs) return false;
      } else if (customEndTime) {
        const [eH, eM] = customEndTime.split(':').map(Number);
        const txMinutes = txDate.getHours() * 60 + txDate.getMinutes();
        const endMinutes = (eH || 0) * 60 + (eM || 0);
        if (txMinutes > endMinutes) return false;
      }
    }

    if (cryptoFilter !== 'all' && t.crypto.toUpperCase() !== cryptoFilter.toUpperCase()) return false;
    if (walletFilter !== 'all' && t.walletId !== walletFilter) return false;
    if (exchangeFilter !== 'all') {
      const matchExId = (t as any).exchangeId === exchangeFilter || (t as any).exchange_id === exchangeFilter;
      const matchExName = (t.notes || '').toLowerCase().includes(exchangeFilter.toLowerCase());
      if (!matchExId && !matchExName) return false;
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'compra' && t.type !== 'compra') return false;
      if (typeFilter === 'venta' && t.type !== 'venta') return false;
      if (typeFilter === 'ingreso' && t.type !== 'ingreso_fondos') return false;
      if (typeFilter === 'egreso' && t.type !== 'egreso_fondos') return false;
    }

    if (isVendedor && currentUser) {
      const matchVendorId = (t as any).vendor_id === currentUser.id || (t as any).vendorId === currentUser.id;
      const ownsWallet = wallets.some(w => (w.id === t.walletId || w.name === t.walletName) && w.vendorId === currentUser.id);
      if (!matchVendorId && !ownsWallet) {
        return false;
      }
    } else if (vendorFilter !== 'all') {
      const vendor = activeVendorUsers.find(u => (u.id || '') === vendorFilter);
      if (!vendor) return false;
      const matchVendorId = t.sellerId === vendor.id || (t as any).vendor_id === vendor.id || (t as any).vendorId === vendor.id;
      const matchOperator = (t.operator || '').toLowerCase() === (vendor.name || '').toLowerCase()
        || (t.operator || '').toLowerCase() === (vendor.username || '').toLowerCase();
      if (!matchVendorId && !matchOperator) return false;
    }
    if (operatorSearch && !t.operator.toLowerCase().includes(operatorSearch.toLowerCase())) return false;

    if (generalSearch) {
      const query = generalSearch.toLowerCase();
      const matchNotes = t.notes?.toLowerCase().includes(query);
      const matchClient = t.client?.toLowerCase().includes(query);
      const matchSupplier = t.supplier?.toLowerCase().includes(query);
      const matchWallet = t.walletName.toLowerCase().includes(query);
      const matchCrypto = t.crypto.toLowerCase().includes(query);
      
      if (!matchNotes && !matchClient && !matchSupplier && !matchWallet && !matchCrypto) return false;
    }

    return true;
  });

  // Calculate stats
  const filteredTotalPurchases = filteredTxs
    .filter(t => t.type === 'compra')
    .reduce((sum, t) => sum + t.totalPesos, 0);

  const filteredTotalSales = filteredTxs
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + t.totalPesos, 0);

  const filteredTotalGains = filteredTxs
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  const totalPages = Math.ceil(filteredTxs.length / itemsPerPage) || 1;
  const paginatedTxs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTxs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTxs, currentPage, itemsPerPage]);

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditType(tx.type);
    setEditTotalPesos(tx.totalPesos);
    setEditCryptoQty(tx.quantity);
    setEditWalletId(tx.walletId || '');
    setEditExchangeId(tx.exchangeId || '');
    setEditNotes(tx.notes || '');
    setEditClientOrSupplier(tx.client || tx.supplier || '');
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !onUpdateTransaction) return;

    const numPesos = typeof editTotalPesos === 'number' ? editTotalPesos : 0;
    const numCrypto = typeof editCryptoQty === 'number' ? editCryptoQty : 0;

    if (numPesos <= 0) {
      setEditError('El monto en pesos debe ser mayor a cero.');
      return;
    }
    if (numCrypto <= 0) {
      setEditError('La cantidad cripto debe ser mayor a cero.');
      return;
    }

    const calculatedPrice = numCrypto > 0 ? numPesos / numCrypto : 0;
    const walletObj = wallets.find(w => w.id === editWalletId);
    const exchangeObj = exchanges.find(ex => ex.id === editExchangeId);

    const targetWalletId = editWalletId !== undefined && editWalletId !== '' ? editWalletId : editingTx.walletId;
    const targetExchangeId = editExchangeId !== undefined ? (editExchangeId.trim() === '' ? undefined : editExchangeId.trim()) : editingTx.exchangeId;

    const updated: Transaction = {
      ...editingTx,
      type: editType,
      totalPesos: numPesos,
      quantity: numCrypto,
      unitPrice: calculatedPrice,
      walletId: targetWalletId,
      walletName: walletObj?.name || (targetWalletId === editingTx.walletId ? editingTx.walletName : ''),
      exchangeId: targetExchangeId,
      exchangeName: targetExchangeId ? (exchangeObj?.name || (targetExchangeId === editingTx.exchangeId ? editingTx.exchangeName : '')) : undefined,
      notes: editNotes.trim(),
      client: editType === 'venta' ? editClientOrSupplier : undefined,
      supplier: editType === 'compra' ? editClientOrSupplier : undefined,
    };

    setIsSubmittingEdit(true);
    setEditError('');

    try {
      const res = await onUpdateTransaction(updated);
      if (res.success) {
        setEditSuccess('✅ Movimiento actualizado exitosamente.');
        setTimeout(() => {
          setEditingTx(null);
          setEditSuccess('');
        }, 1200);
      } else {
        setEditError(res.error || 'Error al actualizar el movimiento.');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Error inesperado al actualizar el movimiento.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportCSV = () => {
    if (filteredTxs.length === 0) return;
    
    const headers = ['ID', 'Fecha/Hora', 'Tipo', 'Cripto', 'Cantidad', 'Precio Unitario (ARS)', 'Total (ARS)', 'Billetera', 'Operador', 'Notas'];
    const rows = filteredTxs.map(t => [
      t.id,
      `${t.dateString} ${t.timeString}`,
      t.type.toUpperCase(),
      t.crypto,
      t.quantity,
      t.unitPrice,
      t.totalPesos,
      t.walletName,
      t.operator,
      t.notes || '',
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `movimientos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER & FORM TOGGLE */}
      <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
              <Filter className="w-5 h-5 text-binance-yellow" />
              Historial y Registro de Movimientos P2P
            </h2>
            <p className="text-xs text-binance-gray mt-1">
              Registro instantáneo de Compras y Ventas con cálculo automatizado de precios y saldos.
            </p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            {onAddTransaction && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-extrabold rounded-xl bg-binance-yellow text-binance-black hover:bg-binance-yellow/90 shadow-lg transition-all cursor-pointer uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                {showAddForm ? 'Ocultar Formulario' : 'Cargar Movimiento P2P'}
              </button>
            )}

            <button
              onClick={handleExportCSV}
              disabled={filteredTxs.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-binance-border bg-binance-black text-white hover:bg-binance-black/80 transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* P2P TRADE FORM (COMPRA / VENTA) */}
        {showAddForm && onAddTransaction && (
          <div className="bg-binance-black border border-binance-yellow/40 p-5 rounded-2xl space-y-4 shadow-xl mt-4">
            <div className="flex justify-between items-center border-b border-binance-border pb-3">
              <span className="text-xs font-black text-white uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-binance-yellow" /> Formulario Operación P2P
              </span>
              <span className="text-[10px] text-binance-gray font-bold">
                Operador: <strong className="text-binance-yellow">{currentUser?.name || 'Vendedor'}</strong>
              </span>
            </div>

            {formError && (
            <div className="mb-3 p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl text-binance-red text-xs font-bold">
              {formError}
            </div>
          )}

          {formSuccess && (
              <div className="p-3 bg-binance-green/20 border border-binance-green/40 text-binance-green rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateTrade} className="space-y-4 text-xs">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-binance-card p-1 rounded-xl border border-binance-border max-w-xs">
                <button
                  type="button"
                  onClick={() => setTradeType('compra')}
                  className={`py-2 px-3 rounded-lg font-black uppercase text-xs transition-all cursor-pointer ${
                    tradeType === 'compra' ? 'bg-binance-red text-white' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  🔴 Compra (Entra Cripto, Sale Pesos)
                </button>

                <button
                  type="button"
                  onClick={() => setTradeType('venta')}
                  className={`py-2 px-3 rounded-lg font-black uppercase text-xs transition-all cursor-pointer ${
                    tradeType === 'venta' ? 'bg-binance-green text-binance-black' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  🟢 Venta (Sale Cripto, Entran Pesos)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Wallet Select */}
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Billetera Pesos ($ ARS) *
                  </label>
                  <select
                    required
                    value={selectedWalletId}
                    onChange={e => setSelectedWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                  >
                    {availableWallets.map(w => (
                      <option key={w.id} value={w.id} disabled={w.blocked}>
                        {w.name} {w.blocked ? '🔒 [BLOQUEADA]' : `($${w.saldoPesos.toLocaleString('es-AR')} ARS)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exchange Select */}
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Exchange Cripto *
                  </label>
                  <select
                    required
                    value={selectedExchangeId}
                    onChange={e => setSelectedExchangeId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                  >
                    {availableExchanges.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name} ({ex.balanceCrypto} USDT)</option>
                    ))}
                  </select>
                </div>

                {/* Monto Pesos */}
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Monto en Pesos ($ ARS) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej. 120000"
                    value={totalPesosInput}
                    onChange={e => setTotalPesosInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-amber-400 font-extrabold outline-hidden focus:border-binance-yellow font-mono"
                  />
                </div>

                {/* Cantidad Cripto */}
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Cantidad Cripto (USDT) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej. 100"
                    value={cryptoQtyInput}
                    onChange={e => setCryptoQtyInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-binance-green font-extrabold outline-hidden focus:border-binance-yellow font-mono"
                  />
                </div>
              </div>

              {/* Auto calculated unit price banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-binance-card p-3 rounded-xl border border-binance-border">
                <div className="text-xs">
                  <span className="text-binance-gray">Precio Unitario Calculado: </span>
                  <strong className="text-binance-yellow font-mono text-sm">{formatMoney(calculatedUnitPrice)} / {cryptoTicker}</strong>
                </div>

                <div className="flex gap-2 mt-2 sm:mt-0">
                  <input
                    type="text"
                    placeholder="Cliente / Proveedor"
                    value={clientOrSupplier}
                    onChange={e => setClientOrSupplier(e.target.value)}
                    className="px-3 py-1 bg-binance-black border border-binance-border rounded-lg text-white text-xs outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Observaciones / Notas"
                    value={tradeNotes}
                    onChange={e => setTradeNotes(e.target.value)}
                    className="px-3 py-1 bg-binance-black border border-binance-border rounded-lg text-white text-xs outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 text-binance-black font-black uppercase text-xs rounded-xl shadow-lg cursor-pointer tracking-wider ${
                  tradeType === 'compra' ? 'bg-binance-red text-white hover:bg-binance-red/90' : 'bg-binance-green text-binance-black hover:bg-binance-green/90'
                }`}
              >
                Procesar {tradeType.toUpperCase()} de {cryptoQtyInput || 0} {cryptoTicker} por {formatMoney(Number(totalPesosInput) || 0)}
              </button>
            </form>
          </div>
        )}

        {/* Aggregated Filtered Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-binance-black rounded-xl border border-binance-border text-sm font-mono">
          <div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Operaciones Filtradas</span>
            <span className="text-base font-bold text-white">{filteredTxs.length} txs</span>
          </div>
          <div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Monto Compras</span>
            <span className="text-base font-bold text-binance-red">{formatMoney(filteredTotalPurchases)}</span>
          </div>
          <div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Monto Ventas</span>
            <span className="text-base font-bold text-binance-green">{formatMoney(filteredTotalSales)}</span>
          </div>
          <div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">Rentabilidad Neta</span>
            <span className={`text-base font-bold ${filteredTotalGains >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
              {formatMoney(filteredTotalGains)}
            </span>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-binance-gray" />
            <input
              type="text"
              placeholder="Buscar nota, cliente..."
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden text-white"
            />
          </div>

          {isAdmin && (
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full px-3 py-2 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-amber-400 font-bold"
            >
              <option value="all">👤 Todos los Vendedores</option>
              {uniqueVendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} (@{v.username})</option>
              ))}
            </select>
          )}

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-white font-bold"
          >
            <option value="all">Cualquier Fecha</option>
            <option value="today">Operaciones de Hoy</option>
            <option value="week">Última Semana</option>
            <option value="month">Último Mes</option>
            <option value="custom">📅 Rango Fecha/Hora Personalizado</option>
          </select>

          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Todas las Billeteras</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {exchanges.length > 0 && (
            <select
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-white"
            >
              <option value="all">Todos los Exchanges</option>
              {exchanges.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          )}

          <select
            value={cryptoFilter}
            onChange={(e) => setCryptoFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Todas las Criptos</option>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Cualquier Tipo</option>
            <option value="compra">Compras</option>
            <option value="venta">Ventas</option>
            <option value="ingreso">Fondos Ingresados</option>
            <option value="egreso">Fondos Egresados</option>
          </select>
        </div>

        {/* Custom Date & Time Filter Panel */}
        {timeFilter === 'custom' && (
          <div className="bg-binance-black p-4 rounded-xl border border-binance-yellow/30 space-y-3 mt-2">
            <div className="flex items-center justify-between text-xs border-b border-binance-border pb-2">
              <span className="font-bold text-binance-yellow flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Filtrar por Rango de Fecha y Hora
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setCustomStartDate(today);
                    setCustomStartTime('00:00');
                    setCustomEndDate(today);
                    setCustomEndTime('23:59');
                  }}
                  className="text-[11px] text-binance-yellow hover:underline font-bold cursor-pointer"
                >
                  Hoy Completo
                </button>
                <span className="text-binance-gray">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomStartTime('');
                    setCustomEndDate('');
                    setCustomEndTime('');
                  }}
                  className="text-[11px] text-binance-gray hover:text-white font-bold cursor-pointer"
                >
                  Limpiar Filtro
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-binance-gray text-[10px] font-bold uppercase mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-mono"
                />
              </div>

              <div>
                <label className="block text-binance-gray text-[10px] font-bold uppercase mb-1">
                  Hora Desde
                </label>
                <input
                  type="time"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-mono"
                />
              </div>

              <div>
                <label className="block text-binance-gray text-[10px] font-bold uppercase mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-mono"
                />
              </div>

              <div>
                <label className="block text-binance-gray text-[10px] font-bold uppercase mb-1">
                  Hora Hasta
                </label>
                <input
                  type="time"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-binance-card rounded-2xl border border-binance-border overflow-hidden shadow-md">
        {filteredTxs.length === 0 ? (
          <div className="text-center py-12 text-binance-gray">
            <p className="font-semibold mb-1">No se encontraron movimientos registrados</p>
            <p className="text-xs">Pruebe ajustando los filtros seleccionados o ingrese una operación real.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-binance-gray">
              <thead className="bg-binance-black text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
                <tr>
                  <th className="px-6 py-4">Fecha & Hora</th>
                  <th className="px-6 py-4">Operación</th>
                  <th className="px-6 py-4">Billetera</th>
                  <th className="px-6 py-4">Activo / Cripto</th>
                  <th className="px-6 py-4 text-right">Cant. / Precio</th>
                  <th className="px-6 py-4 text-right">Monto Pesos</th>
                  <th className="px-6 py-4 text-right text-binance-green">Ganancia</th>
                  <th className="px-6 py-4">Operador & Detalle</th>
                  {onUpdateTransaction && <th className="px-6 py-4 text-center">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-binance-border/40 font-mono">
                {paginatedTxs.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-binance-black/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-white">{t.dateString}</div>
                      <div className="text-binance-gray text-[10px] mt-0.5">{t.timeString}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                        t.type === 'compra' ? 'bg-binance-red/10 text-binance-red border border-binance-red/25' :
                        t.type === 'venta' ? 'bg-binance-green/10 text-binance-green border border-binance-green/25' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                      }`}>
                        {t.type === 'compra' && <ArrowDownLeft className="w-3.5 h-3.5" />}
                        {t.type === 'venta' && <ArrowUpRight className="w-3.5 h-3.5" />}
                        {t.type.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-white">
                      {t.walletName}
                    </td>

                    <td className="px-6 py-4 font-bold text-white">
                      {t.crypto}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-white">{t.quantity.toLocaleString()} {t.crypto}</div>
                      <div className="text-binance-gray text-[10px]">@ {formatMoney(t.unitPrice)}</div>
                    </td>

                    <td className="px-6 py-4 text-right font-black">
                      <span className={t.type === 'compra' ? 'text-binance-red' : 'text-binance-green'}>
                        {t.type === 'compra' ? '-' : '+'}{formatMoney(t.totalPesos)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-black">
                      {t.type === 'venta' && t.gain !== undefined ? (
                        <span className="text-binance-green">+{formatMoney(t.gain)}</span>
                      ) : (
                        <span className="text-binance-border italic">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-binance-gray space-y-1">
                      <div className="font-bold text-white">{t.operator}</div>
                      {t.notes && <div className="text-[10px] text-binance-gray italic">"{t.notes}"</div>}
                    </td>

                    {onUpdateTransaction && (
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="px-2.5 py-1.5 bg-binance-black hover:bg-binance-card border border-binance-border hover:border-binance-yellow/50 text-binance-yellow rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          title="Editar operación"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {filteredTxs.length > 0 && (
          <div className="bg-binance-black px-6 py-4 border-t border-binance-border flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <span className="text-binance-gray">
              Mostrando <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> a{' '}
              <strong className="text-white">{Math.min(currentPage * itemsPerPage, filteredTxs.length)}</strong> de{' '}
              <strong className="text-binance-yellow">{filteredTxs.length}</strong> movimientos
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 bg-binance-card border border-binance-border hover:border-binance-yellow/50 text-white rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>

                <div className="flex items-center gap-1 px-2">
                  <span className="text-binance-gray">Página</span>
                  <span className="font-bold text-binance-yellow">{currentPage}</span>
                  <span className="text-binance-gray">de {totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 bg-binance-card border border-binance-border hover:border-binance-yellow/50 text-white rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT TRANSACTION MODAL (rpc_transaction_update_v2) */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-binance-dark border border-binance-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-binance-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-binance-yellow/20 rounded-xl text-binance-yellow">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-display">
                    Editar Movimiento P2P
                  </h3>
                  <span className="text-[10px] text-binance-gray">Actualización financiera vía RPC v2</span>
                </div>
              </div>
              <button
                onClick={() => setEditingTx(null)}
                className="text-binance-gray hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl text-xs text-binance-red font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="p-3 bg-binance-green/10 border border-binance-green/30 rounded-xl text-xs text-binance-green font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-binance-black p-1 rounded-xl border border-binance-border">
                <button
                  type="button"
                  onClick={() => setEditType('compra')}
                  className={`py-2 px-3 rounded-lg font-black uppercase text-xs transition-all cursor-pointer ${
                    editType === 'compra' ? 'bg-binance-red text-white' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  🔴 Compra
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('venta')}
                  className={`py-2 px-3 rounded-lg font-black uppercase text-xs transition-all cursor-pointer ${
                    editType === 'venta' ? 'bg-binance-green text-binance-black' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  🟢 Venta
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Monto Pesos */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Monto en Pesos ($ ARS) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editTotalPesos}
                    onChange={e => setEditTotalPesos(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white font-mono text-sm focus:border-binance-yellow outline-hidden"
                  />
                </div>

                {/* Cantidad Cripto */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Cantidad Cripto ({editingTx.crypto || 'USDT'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editCryptoQty}
                    onChange={e => setEditCryptoQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white font-mono text-sm focus:border-binance-yellow outline-hidden"
                  />
                </div>
              </div>

              {/* Price calculation preview */}
              <div className="p-3 bg-binance-black rounded-xl border border-binance-border flex justify-between items-center text-xs">
                <span className="text-binance-gray">Precio Unitario Calculado:</span>
                <span className="font-extrabold text-binance-yellow font-mono">
                  {typeof editTotalPesos === 'number' && typeof editCryptoQty === 'number' && editCryptoQty > 0
                    ? formatMoney(editTotalPesos / editCryptoQty)
                    : '$0,00'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Billetera */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Billetera Asociada
                  </label>
                  <select
                    value={editWalletId}
                    onChange={e => setEditWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden cursor-pointer"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {/* Exchange */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Exchange Asociado
                  </label>
                  <select
                    value={editExchangeId}
                    onChange={e => setEditExchangeId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden cursor-pointer"
                  >
                    <option value="">(Ninguno / P2P directo)</option>
                    {exchanges.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Client / Supplier */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-binance-gray uppercase font-bold block">
                  Cliente / Proveedor / Contraparte
                </label>
                <input
                  type="text"
                  placeholder="Nombre o alias de contraparte"
                  value={editClientOrSupplier}
                  onChange={e => setEditClientOrSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-binance-gray uppercase font-bold block">
                  Notas / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles de la transacción"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-2.5 border border-binance-border text-binance-gray hover:text-white font-bold rounded-xl uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 disabled:opacity-40 text-binance-black font-extrabold rounded-xl uppercase text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isSubmittingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
