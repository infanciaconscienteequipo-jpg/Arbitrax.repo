/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Wallet, Transaction, User } from '../types';
import { Wallet as WalletIcon, Plus, Minus, ArrowUpRight, ArrowDownLeft, TrendingUp, DollarSign, WalletCards, Sparkles, CheckCircle2, AlertTriangle, Clock, SlidersHorizontal, Filter, Calendar, Lock, Unlock, Edit3, Save, X, Paperclip, FileText, Upload, Archive, ArchiveRestore } from 'lucide-react';

interface BilleterasProps {
  wallets: Wallet[];
  transactions: Transaction[];
  users?: User[];
  currentUser?: User | null;
  activeShiftId: string | null;
  onFundWallet: (walletId: string, amount: number, type: 'ingreso_fondos' | 'egreso_fondos', notes: string) => Promise<void> | void;
  onAddWallet: (name: string, titular: string, initialBalance: number, vendorId?: string) => Promise<void> | void;
  onUpdateWallet?: (walletId: string, updates: Partial<Wallet>) => void;
  onUpdateWalletLimit?: (walletId: string, limitARS: number) => Promise<boolean | void> | void;
  onTransferBetweenWallets?: (params: { fromWalletId: string; toWalletId: string; amount: number; notes?: string }) => Promise<{ success: boolean; error?: string }>;
  onBlockWallet?: (walletId: string, note: string) => Promise<boolean>;
  onUnblockWallet?: (walletId: string) => Promise<boolean>;
  onArchiveWallet?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onUnarchiveWallet?: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export default function Billeteras({
  wallets,
  transactions,
  users = [],
  currentUser,
  activeShiftId,
  onFundWallet,
  onAddWallet,
  onUpdateWallet,
  onUpdateWalletLimit,
  onTransferBetweenWallets,
  onBlockWallet,
  onUnblockWallet,
  onArchiveWallet,
  onUnarchiveWallet,
}: BilleterasProps) {
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [processingWalletId, setProcessingWalletId] = useState<string | null>(null);
  const [archiveFeedback, setArchiveFeedback] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [amountInput, setAmountInput] = useState<number | ''>('');
  const [operationType, setOperationType] = useState<'ingreso_fondos' | 'egreso_fondos'>('ingreso_fondos');
  const [notes, setNotes] = useState('');
  const [comprobanteFile, setComprobanteFile] = useState<{ name: string; url?: string } | null>(null);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmittingFund, setIsSubmittingFund] = useState(false);

  // Transfer Between Wallets Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Blocking Modal State
  const [blockingWallet, setBlockingWallet] = useState<Wallet | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [isSubmittingUnblock, setIsSubmittingUnblock] = useState(false);

  // Vendedor Filter State (for Admin)
  const [vendorFilter, setVendorFilter] = useState('all');

  // Editing Wallet Balance & Limit state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editPesos, setEditPesos] = useState<number | ''>('');
  const [editLimit, setEditLimit] = useState<number | ''>('');
  const [editTitular, setEditTitular] = useState<string>('');

  // New wallet state variables
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletTitular, setNewWalletTitular] = useState('');
  const [newWalletInitialBalance, setNewWalletInitialBalance] = useState<number | ''>('');
  const [newWalletVendorId, setNewWalletVendorId] = useState<string>('');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  
  const [createErrorMsg, setCreateErrorMsg] = useState('');
  const [createSuccessMsg, setCreateSuccessMsg] = useState('');

  // bottom "Historial de Billetera" filtering states
  const [histWalletFilter, setHistWalletFilter] = useState('all');
  const [histTypeFilter, setHistTypeFilter] = useState('all');
  const [histTimeFilter, setHistTimeFilter] = useState('all');
  
  // Advanced filters inside Billeteras
  const [histUseAdvanced, setHistUseAdvanced] = useState(false);
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');
  const [histSelectedYear, setHistSelectedYear] = useState('all');
  const [histSelectedMonth, setHistSelectedMonth] = useState('all');
  const [histSelectedDayOfMonth, setHistSelectedDayOfMonth] = useState('all');
  const [histSelectedDayOfWeek, setHistSelectedDayOfWeek] = useState('all');
  const [histStartHour, setHistStartHour] = useState('0');
  const [histEndHour, setHistEndHour] = useState('23');

  const MONTHS = [
    { value: '0', label: 'Enero' },
    { value: '1', label: 'Febrero' },
    { value: '2', label: 'Marzo' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Mayo' },
    { value: '5', label: 'Junio' },
    { value: '6', label: 'Julio' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Septiembre' },
    { value: '9', label: 'Octubre' },
    { value: '10', label: 'Noviembre' },
    { value: '11', label: 'Diciembre' },
  ];

  const DAYS_OF_WEEK = [
    { value: '1', label: 'Lunes' },
    { value: '2', label: 'Martes' },
    { value: '3', label: 'Miércoles' },
    { value: '4', label: 'Jueves' },
    { value: '5', label: 'Viernes' },
    { value: '6', label: 'Sábado' },
    { value: '0', label: 'Domingo' },
  ];

  // Extract unique years from transactions
  const uniqueYears = Array.from(
    new Set(transactions.map(t => new Date(t.timestamp).getFullYear().toString()))
  ).filter(Boolean).sort();
  
  if (uniqueYears.length === 0) {
    uniqueYears.push(new Date().getFullYear().toString());
  }

  // Active vendors list strictly from public.users
  const activeVendorsList = users.filter(
    u => u.active !== false && u.status === 'active' && ((u.role || '').toUpperCase() === 'VENDEDOR' || (u.role || '').toUpperCase() === 'SELLER')
  );

  // Filter wallets by vendor/titular and status/archive if selected
  const filteredWallets = wallets.filter(w => {
    const isArchived = w.archived === true || w.status === 'ARCHIVED' || w.status === 'archived';
    if (statusFilter === 'active' && isArchived) return false;
    if (statusFilter === 'archived' && !isArchived) return false;

    if (isVendedor && currentUser) {
      if (!w.vendorId || w.vendorId !== currentUser.id) return false;
    } else if (vendorFilter !== 'all') {
      const vLower = vendorFilter.toLowerCase();
      const matchesTitular = w.titular?.toLowerCase().includes(vLower);
      const matchesName = w.name?.toLowerCase().includes(vLower);
      const matchesVendorId = w.vendorId === vendorFilter;
      if (!matchesTitular && !matchesName && !matchesVendorId) return false;
    }
    return true;
  });

  const activeWalletsCount = wallets.filter(w => !w.archived && w.status !== 'ARCHIVED' && w.status !== 'archived').length;
  const archivedWalletsCount = wallets.filter(w => w.archived === true || w.status === 'ARCHIVED' || w.status === 'archived').length;
  const activeWalletsOnly = wallets.filter(w => !w.archived && w.status !== 'ARCHIVED' && w.status !== 'archived');

  const handleArchive = async (id: string) => {
    if (!onArchiveWallet) return;
    setProcessingWalletId(id);
    setArchiveFeedback(null);
    try {
      const res = await onArchiveWallet(id);
      if (res.success) {
        setArchiveFeedback({ id, msg: 'Billetera archivada exitosamente.', type: 'success' });
      } else {
        setArchiveFeedback({ id, msg: res.error || 'Error al archivar la billetera.', type: 'error' });
      }
    } catch (err: any) {
      setArchiveFeedback({ id, msg: err?.message || 'Error al procesar el archivado.', type: 'error' });
    } finally {
      setProcessingWalletId(null);
      setTimeout(() => setArchiveFeedback(null), 3000);
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!onUnarchiveWallet) return;
    setProcessingWalletId(id);
    setArchiveFeedback(null);
    try {
      const res = await onUnarchiveWallet(id);
      if (res.success) {
        setArchiveFeedback({ id, msg: 'Billetera desarchivada exitosamente.', type: 'success' });
      } else {
        setArchiveFeedback({ id, msg: res.error || 'Error al desarchivar la billetera.', type: 'error' });
      }
    } catch (err: any) {
      setArchiveFeedback({ id, msg: err?.message || 'Error al procesar el desarchivado.', type: 'error' });
    } finally {
      setProcessingWalletId(null);
      setTimeout(() => setArchiveFeedback(null), 3000);
    }
  };

  // Filtered transactions for bottom history table
  const filteredHistTxs = transactions.filter(t => {
    const txDate = new Date(t.timestamp);
    const now = new Date();

    // 0. Vendor Filter
    if (isVendedor && currentUser) {
      const matchVendorId = (t as any).vendor_id === currentUser.id || (t as any).vendorId === currentUser.id;
      const ownsWallet = wallets.some(w => (w.id === t.walletId || w.name === t.walletName) && w.vendorId === currentUser.id);
      if (!matchVendorId && !ownsWallet) {
        return false;
      }
    } else if (vendorFilter !== 'all') {
      const vLower = vendorFilter.toLowerCase();
      const matchVendorId = (t as any).vendor_id === vendorFilter || (t as any).vendorId === vendorFilter;
      const matchesWallet = wallets.some(w => (w.id === t.walletId || w.name === t.walletName) && (w.vendorId === vendorFilter || w.titular?.toLowerCase().includes(vLower)));
      const matchesOperator = t.operator.toLowerCase().includes(vLower);
      if (!matchVendorId && !matchesWallet && !matchesOperator) {
        return false;
      }
    }

    // 1. Time / Chronological Filtering
    if (!histUseAdvanced) {
      if (histTimeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const tStr = t.timestamp.split('T')[0];
        if (todayStr !== tStr) return false;
      } else if (histTimeFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        if (txDate < oneWeekAgo) return false;
      } else if (histTimeFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        if (txDate < oneMonthAgo) return false;
      }
    } else {
      // Advanced Filters
      if (histStartDate) {
        const start = new Date(histStartDate + 'T00:00:00');
        if (txDate < start) return false;
      }
      if (histEndDate) {
        const end = new Date(histEndDate + 'T23:59:59');
        if (txDate > end) return false;
      }
      if (histSelectedYear !== 'all') {
        if (txDate.getFullYear().toString() !== histSelectedYear) return false;
      }
      if (histSelectedMonth !== 'all') {
        if (txDate.getMonth().toString() !== histSelectedMonth) return false;
      }
      if (histSelectedDayOfMonth !== 'all') {
        if (txDate.getDate().toString() !== histSelectedDayOfMonth) return false;
      }
      if (histSelectedDayOfWeek !== 'all') {
        if (txDate.getDay().toString() !== histSelectedDayOfWeek) return false;
      }
      const hour = txDate.getHours();
      const sHour = parseInt(histStartHour, 10);
      const eHour = parseInt(histEndHour, 10);
      if (hour < sHour || hour > eHour) return false;
    }

    // 2. Wallet Filter (or match walletId or walletName)
    if (histWalletFilter !== 'all') {
      if (t.walletId !== histWalletFilter && t.walletName !== histWalletFilter) {
        return false;
      }
    }

    // 3. Type Filter
    if (histTypeFilter !== 'all') {
      if (histTypeFilter === 'compra' && t.type !== 'compra') return false;
      if (histTypeFilter === 'venta' && t.type !== 'venta') return false;
      if (histTypeFilter === 'ingreso' && t.type !== 'ingreso_fondos') return false;
      if (histTypeFilter === 'egreso' && t.type !== 'egreso_fondos') return false;
    }

    return true;
  });

  // Auto-select first wallet if none selected
  React.useEffect(() => {
    if (activeWalletsOnly.length > 0 && (!selectedWalletId || !activeWalletsOnly.some(w => w.id === selectedWalletId))) {
      setSelectedWalletId(activeWalletsOnly[0].id);
    }
  }, [activeWalletsOnly, selectedWalletId]);

  const handleStartEdit = (w: Wallet) => {
    setEditingWalletId(w.id);
    setEditPesos(w.saldoPesos);
    setEditLimit(w.limitARS || 3000000);
    setEditTitular(w.titular || '');
  };

  const handleSaveEdit = async (walletId: string) => {
    const newPesos = typeof editPesos === 'number' ? Math.max(0, editPesos) : 0;
    const newLimit = typeof editLimit === 'number' ? Math.max(0, editLimit) : 0;

    try {
      if (onUpdateWalletLimit) {
        await onUpdateWalletLimit(walletId, newLimit);
      }
      if (onUpdateWallet) {
        await onUpdateWallet(walletId, {
          saldoPesos: newPesos,
          limitARS: newLimit,
          titular: editTitular.trim(),
        });
      }
      setEditingWalletId(null);
      setSuccessMsg('✅ Saldo, titular y límite de la billetera actualizados exitosamente.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar billetera');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleOpenTransferModal = (fromWallet?: Wallet) => {
    const fromId = fromWallet?.id || (filteredWallets.length > 0 ? filteredWallets[0].id : '');
    const toId = filteredWallets.find(w => w.id !== fromId)?.id || wallets.find(w => w.id !== fromId)?.id || '';
    setTransferFromId(fromId);
    setTransferToId(toId);
    setTransferAmount('');
    setTransferNotes('');
    setTransferError('');
    setTransferSuccess('');
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onTransferBetweenWallets) return;

    if (!transferFromId || !transferToId) {
      setTransferError('Debe seleccionar la billetera de origen y de destino.');
      return;
    }

    if (transferFromId === transferToId) {
      setTransferError('La billetera de destino debe ser diferente a la de origen.');
      return;
    }

    const fromW = wallets.find(w => w.id === transferFromId);
    const toW = wallets.find(w => w.id === transferToId);

    if (fromW?.blocked) {
      setTransferError(`La billetera de origen "${fromW.name}" está bloqueada.`);
      return;
    }

    const numAmount = typeof transferAmount === 'number' ? transferAmount : 0;
    if (numAmount <= 0) {
      setTransferError('El monto a transferir debe ser mayor a cero.');
      return;
    }

    if (fromW && fromW.saldoPesos < numAmount) {
      setTransferError(`Saldo insuficiente en "${fromW.name}". Disponible: ${formatMoney(fromW.saldoPesos)}.`);
      return;
    }

    setIsSubmittingTransfer(true);
    setTransferError('');

    try {
      const res = await onTransferBetweenWallets({
        fromWalletId: transferFromId,
        toWalletId: transferToId,
        amount: numAmount,
        notes: transferNotes.trim() || undefined,
      });

      if (res.success) {
        setTransferSuccess(`✅ Transferencia de ${formatMoney(numAmount)} realizada con éxito entre "${fromW?.name}" y "${toW?.name}".`);
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess('');
          setTransferAmount('');
          setTransferNotes('');
        }, 2000);
      } else {
        setTransferError(res.error || 'Error al procesar la transferencia entre billeteras.');
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Error inesperado al conectar con el servidor.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleStartBlock = (w: Wallet) => {
    setBlockingWallet(w);
    setBlockReason('');
  };

  const handleConfirmBlock = async () => {
    if (!blockingWallet || !blockReason.trim()) return;
    setIsSubmittingBlock(true);
    try {
      if (!onBlockWallet) throw new Error('La función de bloqueo no está disponible.');
      const ok = await onBlockWallet(blockingWallet.id, blockReason.trim());
      if (ok !== true) throw new Error('La billetera no pudo ser bloqueada.');
      setSuccessMsg(`🔒 Billetera "${blockingWallet.name}" bloqueada exitosamente.`);
      setBlockingWallet(null);
      setBlockReason('');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al bloquear la billetera');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleConfirmUnblock = async (w: Wallet) => {
    setIsSubmittingUnblock(true);
    try {
      if (!onUnblockWallet) throw new Error('La función de desbloqueo no está disponible.');
      const ok = await onUnblockWallet(w.id);
      if (ok !== true) throw new Error('La billetera no pudo ser desbloqueada.');
      setSuccessMsg(`🔓 Billetera "${w.name}" desbloqueada exitosamente.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al desbloquear la billetera');
    } finally {
      setIsSubmittingUnblock(false);
    }
  };

  const handleCreateWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErrorMsg('');
    setCreateSuccessMsg('');

    if (!newWalletName.trim()) {
      setCreateErrorMsg('Por favor ingrese el nombre de la billetera.');
      return;
    }

    if (!newWalletTitular.trim()) {
      setCreateErrorMsg('Por favor ingrese el titular de la cuenta.');
      return;
    }

    const initialBalance = typeof newWalletInitialBalance === 'number' ? newWalletInitialBalance : 0;
    if (initialBalance < 0) {
      setCreateErrorMsg('El saldo inicial no puede ser negativo.');
      return;
    }

    const assignedVendor = isVendedor ? (currentUser?.id || '') : (newWalletVendorId || undefined);

    setIsCreatingWallet(true);
    try {
      if (onAddWallet) {
        await onAddWallet(newWalletName.trim(), newWalletTitular.trim(), initialBalance, assignedVendor);
      }
      setCreateSuccessMsg(`✅ Billetera "${newWalletName.trim()}" creada con éxito.`);
      setNewWalletName('');
      setNewWalletTitular('');
      setNewWalletInitialBalance('');
      setNewWalletVendorId('');
      setTimeout(() => {
        setCreateSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      setCreateErrorMsg(err?.message || 'Error al crear la billetera en Supabase.');
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const selectedWalletObj = wallets.find(w => w.id === selectedWalletId);

  // Totals calculations
  const totalPesos = wallets.reduce((sum, w) => sum + w.saldoPesos, 0);
  const totalUsdt = wallets.reduce((sum, w) => sum + w.saldoUsdt, 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeShiftId) {
      setErrorMsg('⚠️ Debe iniciar un turno en el control de turnos para poder registrar cargas o retiros de dinero.');
      return;
    }

    if (!selectedWalletId) {
      setErrorMsg('Seleccione una billetera.');
      return;
    }

    if (selectedWalletObj?.blocked) {
      setErrorMsg(`⛔ La billetera "${selectedWalletObj.name}" está BLOQUEADA. Desbloquéela en su tarjeta para operar.`);
      return;
    }

    if (typeof amountInput !== 'number' || amountInput <= 0) {
      setErrorMsg('El monto debe ser un número positivo.');
      return;
    }

    if (operationType === 'egreso_fondos' && selectedWalletObj && selectedWalletObj.saldoPesos < amountInput) {
      setErrorMsg(`Saldo insuficiente en pesos en ${selectedWalletObj.name} para retirar ${formatMoney(amountInput)}.`);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    
    let baseNote = notes.trim() || `${operationType === 'ingreso_fondos' ? 'Ingreso' : 'Egreso'} manual de fondos`;
    if (comprobanteFile) {
      baseNote += ` | Comprobante: ${comprobanteFile.name}`;
    }

    try {
      setIsSubmittingFund(true);
      await onFundWallet(
        selectedWalletId, 
        amountInput, 
        operationType, 
        baseNote
      );

      setSuccessMsg(`✅ Operación registrada con éxito. Se actualizó el saldo de ${selectedWalletObj?.name}.`);
      setAmountInput('');
      setNotes('');
      setComprobanteFile(null);

      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar la operación de fondos.');
    } finally {
      setIsSubmittingFund(false);
    }
  };

  // Color mapping helper
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return { bg: 'bg-blue-50 border-blue-200 text-blue-700', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-600' };
      case 'green': return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-600' };
      case 'orange': return { bg: 'bg-orange-50 border-orange-200 text-orange-700', badge: 'bg-orange-100 text-orange-800', bar: 'bg-orange-600' };
      case 'purple': return { bg: 'bg-purple-50 border-purple-200 text-purple-700', badge: 'bg-purple-100 text-purple-800', bar: 'bg-purple-600' };
      case 'teal': return { bg: 'bg-teal-50 border-teal-200 text-teal-700', badge: 'bg-teal-100 text-teal-800', bar: 'bg-teal-600' };
      case 'cyan': return { bg: 'bg-cyan-50 border-cyan-200 text-cyan-700', badge: 'bg-cyan-100 text-cyan-800', bar: 'bg-cyan-600' };
      default: return { bg: 'bg-slate-50 border-slate-200 text-slate-700', badge: 'bg-slate-100 text-slate-800', bar: 'bg-slate-600' };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Wallet Cards Portfolio Grid */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
              <WalletCards className="w-5 h-5 text-binance-yellow" />
              Billeteras y Liquidez
            </h2>

            {/* Status Tabs: Activas / Archivadas */}
            <div className="flex bg-binance-black p-1 rounded-xl border border-binance-border">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-binance-yellow text-binance-black font-extrabold shadow-xs'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                Activas
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'active' ? 'bg-binance-black/20 text-binance-black' : 'bg-binance-card text-binance-gray'}`}>
                  {activeWalletsCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'archived'
                    ? 'bg-binance-yellow text-binance-black font-extrabold shadow-xs'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archivadas
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'archived' ? 'bg-binance-black/20 text-binance-black' : 'bg-binance-card text-binance-gray'}`}>
                  {archivedWalletsCount}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onTransferBetweenWallets && activeWalletsOnly.length >= 2 && statusFilter === 'active' && (
              <button
                type="button"
                onClick={() => handleOpenTransferModal()}
                className="px-3.5 py-1.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Transferir entre Billeteras
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-binance-gray">Vendedor / Titular:</span>
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="px-3 py-1.5 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs focus:border-binance-yellow outline-hidden cursor-pointer text-amber-400 font-bold"
                >
                  <option value="all">👤 Todos los Vendedores</option>
                  {activeVendorsList.map(v => (
                    <option key={v.id} value={v.id}>{v.name || v.username}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {archiveFeedback && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            archiveFeedback.type === 'success'
              ? 'bg-binance-green/20 text-binance-green border border-binance-green/40'
              : 'bg-binance-red/20 text-binance-red border border-binance-red/40'
          }`}>
            {archiveFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{archiveFeedback.msg}</span>
          </div>
        )}

        {/* Global Wallet Portfolio Summary Card - Pesos Focus */}
        <div className="bg-binance-black border border-binance-border rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-binance-yellow/5 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-binance-yellow flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-binance-yellow" /> Liquidez Consolidada en Pesos (ARS)
            </span>
            <span className="text-[9px] bg-binance-card text-binance-gray border border-binance-border px-2.5 py-0.5 rounded font-mono uppercase">
              Total Billeteras FIAT
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-binance-gray uppercase tracking-wider font-bold block">Total Stock Pesos Disponibles</span>
            <span className="text-4xl font-extrabold block text-white tracking-tight font-mono">
              {formatMoney(totalPesos)}
            </span>
          </div>
        </div>

        {/* Wallet Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredWallets.map((w) => {
            const pesosPercentage = totalPesos > 0 ? (w.saldoPesos / totalPesos) * 100 : 0;
            const limitVal = w.limitARS || 3000000;
            const limitPercentage = Math.min(100, (w.saldoPesos / limitVal) * 100);
            const isNearOrOverLimit = limitPercentage >= 80;
            const isEditing = editingWalletId === w.id;

            return (
              <div
                key={w.id}
                className={`bg-binance-card rounded-xl border p-5 shadow-xs space-y-4 transition-all ${
                  w.blocked
                    ? 'border-binance-red/50 bg-binance-red/5'
                    : isNearOrOverLimit
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-binance-border hover:border-binance-gray/30'
                }`}
              >
                {/* Wallet header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                      {w.name}
                      {w.blocked && <Lock className="w-4 h-4 text-binance-red" />}
                    </h3>
                    {w.titular && (
                      <span className="text-[11px] text-binance-yellow font-bold block mt-0.5 font-mono">
                        Titular: {w.titular}
                      </span>
                    )}
                    <span className="text-[10px] text-binance-gray uppercase tracking-wider block mt-0.5 font-mono">{w.providerType}</span>
                  </div>

                  {/* Status Badge */}
                  {w.blocked ? (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-binance-red/20 text-binance-red border border-binance-red/40 font-mono flex items-center gap-1.5 animate-pulse">
                      <Lock className="w-3 h-3" /> BLOQUEADA
                    </span>
                  ) : isNearOrOverLimit ? (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> 80%+ OCUPADA
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-binance-green/20 text-binance-green border border-binance-green/30 font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> ACTIVA
                    </span>
                  )}
                </div>

                {/* Inline Editing Form or Balances View */}
                {isEditing ? (
                  <div className="bg-binance-black p-3.5 rounded-xl border border-binance-yellow/40 space-y-3 mt-2">
                    <div className="flex justify-between items-center text-xs font-bold text-binance-yellow border-b border-binance-border pb-1.5">
                      <span className="flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Modificar Saldo y Límite</span>
                      <button onClick={() => setEditingWalletId(null)} className="text-binance-gray hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] text-binance-gray font-bold uppercase block mb-1">Saldo Pesos ($ ARS)</label>
                        <input
                          type="number"
                          step="any"
                          value={editPesos}
                          onChange={(e) => setEditPesos(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-binance-card border border-binance-border rounded-lg text-white font-mono text-xs focus:border-binance-yellow outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-binance-gray font-bold uppercase block mb-1">Límite Operación ARS</label>
                          <input
                            type="number"
                            step="any"
                            value={editLimit}
                            onChange={(e) => setEditLimit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-binance-card border border-binance-border rounded-lg text-white font-mono text-xs focus:border-binance-yellow outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-binance-gray font-bold uppercase block mb-1">Titular Cuenta</label>
                          <input
                            type="text"
                            value={editTitular}
                            onChange={(e) => setEditTitular(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-binance-card border border-binance-border rounded-lg text-white text-xs focus:border-binance-yellow outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleSaveEdit(w.id)}
                        className="flex-1 py-1.5 px-3 bg-binance-yellow text-binance-black font-extrabold rounded-lg text-xs flex items-center justify-center gap-1 hover:bg-binance-yellow/90 cursor-pointer transition-all"
                      >
                        <Save className="w-3.5 h-3.5" /> Guardar
                      </button>
                      <button
                        onClick={() => setEditingWalletId(null)}
                        className="py-1.5 px-3 border border-binance-border text-binance-gray font-bold rounded-lg text-xs hover:text-white cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Balances detail - Pesos only */}
                    <div className="space-y-2 pt-1 border-t border-binance-border/40">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-binance-gray font-medium">Stock Pesos:</span>
                        <span className="font-extrabold text-white font-mono text-base">
                          {formatMoney(w.saldoPesos)}
                        </span>
                      </div>
                    </div>

                    {/* Limit progress bar & 80% indicator */}
                    <div className="space-y-1.5 pt-1 border-t border-binance-border/30">
                      <div className="text-[10px] text-binance-gray flex justify-between font-mono">
                        <span>Ocupación de Límite ($ ARS)</span>
                        <span className={`font-bold ${limitPercentage >= 100 ? 'text-binance-red' : limitPercentage >= 80 ? 'text-amber-400' : 'text-white'}`}>
                          {limitPercentage.toFixed(1)}% ({formatMoney(w.saldoPesos)} / {formatMoney(limitVal)})
                        </span>
                      </div>
                      <div className="w-full bg-binance-black h-2 rounded-full overflow-hidden border border-binance-border/40">
                        <div
                          className={`h-full transition-all ${
                            limitPercentage >= 100
                              ? 'bg-binance-red'
                              : limitPercentage >= 80
                              ? 'bg-amber-400'
                              : 'bg-binance-yellow'
                          }`}
                          style={{ width: `${limitPercentage}%` }}
                        />
                      </div>
                      {isNearOrOverLimit && (
                        <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Alerta: Ocupó el {limitPercentage.toFixed(0)}% del límite operativo.
                        </p>
                      )}
                    </div>

                    {/* Micro allocation bar graphs */}
                    <div className="space-y-1.5 pt-1 text-[10px] text-binance-gray font-mono">
                      <div className="flex justify-between">
                        <span>% Participación Líquido ARS</span>
                        <span className="font-bold text-white">{pesosPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-binance-black h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-binance-yellow/60" style={{ width: `${pesosPercentage}%` }}></div>
                      </div>
                    </div>

                    {/* Action controls (Edit Saldo/Limit & Lock/Unlock & Transfer & Archive) */}
                    <div className="flex items-center gap-2 pt-2 border-t border-binance-border/40 flex-wrap">
                      <button
                        onClick={() => handleStartEdit(w)}
                        className="flex-1 min-w-[70px] py-1.5 px-2 bg-binance-black hover:bg-binance-card border border-binance-border hover:border-binance-yellow/40 text-binance-yellow rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Modificar saldo, titular o límite"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Modificar
                      </button>

                      {statusFilter === 'active' && onTransferBetweenWallets && (
                        <button
                          onClick={() => handleOpenTransferModal(w)}
                          disabled={w.blocked}
                          className="flex-1 min-w-[70px] py-1.5 px-2 bg-binance-black hover:bg-binance-card border border-binance-border hover:border-binance-yellow/40 text-binance-yellow rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                          title="Transferir a otra billetera"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Transferir
                        </button>
                      )}

                      {w.blocked ? (
                        <button
                          onClick={() => handleConfirmUnblock(w)}
                          disabled={isSubmittingUnblock}
                          className="flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border bg-binance-green/20 hover:bg-binance-green/30 text-binance-green border-binance-green/40 disabled:opacity-50"
                        >
                          <Unlock className="w-3.5 h-3.5" /> Desbloquear
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartBlock(w)}
                          className="flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border-binance-red/40"
                        >
                          <Lock className="w-3.5 h-3.5" /> Bloquear
                        </button>
                      )}

                      {statusFilter === 'active' && onArchiveWallet && (
                        <button
                          onClick={() => handleArchive(w.id)}
                          disabled={processingWalletId === w.id}
                          className="flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-binance-border hover:border-binance-gray/40 text-binance-gray hover:text-white disabled:opacity-50"
                          title="Archivar billetera"
                        >
                          <Archive className="w-3.5 h-3.5" /> Archivar
                        </button>
                      )}

                      {statusFilter === 'archived' && onUnarchiveWallet && (
                        <button
                          onClick={() => handleUnarchive(w.id)}
                          disabled={processingWalletId === w.id}
                          className="flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border bg-binance-yellow/20 hover:bg-binance-yellow/30 text-binance-yellow border-binance-yellow/40 disabled:opacity-50"
                          title="Desarchivar billetera"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" /> Desarchivar
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Adjust Wallet Balance / Manual funding widget */}
      <div className="space-y-6">
        
        {/* CREATE WALLET WIDGET */}
        <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-5 shadow-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5 font-display">
            <Plus className="w-5 h-5 text-binance-yellow" />
            Nueva Billetera
          </h3>
          
          <form onSubmit={handleCreateWalletSubmit} className="space-y-4">
            {/* Wallet Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Nombre de la Billetera
              </label>
              <input
                type="text"
                placeholder="Ej. Mercado Pago, Lemon, Galicia"
                value={newWalletName}
                onChange={(e) => setNewWalletName(e.target.value)}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white"
                required
              />
            </div>

            {/* Account Holder */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Titular de la Cuenta
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={newWalletTitular}
                onChange={(e) => setNewWalletTitular(e.target.value)}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white"
                required
              />
            </div>

            {/* Initial Balance in Pesos */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Saldo Inicial en Pesos (ARS)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Ej. 0 o 50000"
                value={newWalletInitialBalance}
                onChange={(e) => setNewWalletInitialBalance(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white font-mono"
              />
            </div>

            {/* Asignar Vendedor (Solo visible para Administradores) */}
            {isAdmin && activeVendorsList.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                  Asignar a Vendedor (Opcional)
                </label>
                <select
                  value={newWalletVendorId}
                  onChange={(e) => setNewWalletVendorId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white cursor-pointer"
                >
                  <option value="">General / Sin Asignar</option>
                  {activeVendorsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || v.username}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createErrorMsg && (
              <div className="p-2.5 bg-binance-red/20 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{createErrorMsg}</span>
              </div>
            )}

            {createSuccessMsg && (
              <div className="p-2.5 bg-binance-green/20 border border-binance-green/40 rounded-xl text-binance-green text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{createSuccessMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreatingWallet}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 font-extrabold rounded-xl transition-all text-xs cursor-pointer bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black shadow-md premium-glow-yellow disabled:opacity-50"
            >
              <Plus className="w-4 h-4 text-binance-black" />
              {isCreatingWallet ? 'Creando en Supabase...' : 'Crear Billetera'}
            </button>
          </form>
        </div>

        <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-5 shadow-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5 font-display">
            <DollarSign className="w-5 h-5 text-binance-yellow" />
            Cargar / Retirar Capital
          </h3>

          {!activeShiftId && (
            <div className="p-3 bg-binance-yellow/10 border border-binance-yellow/30 rounded-xl text-binance-yellow text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-binance-yellow shrink-0 mt-0.5" />
              <span>Debe iniciar un turno en el control de turnos para poder registrar movimientos en billeteras.</span>
            </div>
          )}

          <form onSubmit={handleFundSubmit} className="space-y-4">
            {/* Wallet Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Seleccionar Cuenta / Billetera
              </label>
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer font-medium"
              >
                {activeWalletsOnly.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.blocked ? '🔒 [BLOQUEADA]' : ''} — Saldo: {formatMoney(w.saldoPesos)}
                  </option>
                ))}
              </select>
            </div>

            {selectedWalletObj?.blocked && (
              <div className="p-3 bg-binance-red/20 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-center gap-2 font-bold">
                <Lock className="w-4 h-4 shrink-0 text-binance-red" />
                <span>⛔ Esta billetera está <strong>BLOQUEADA</strong>. Para registrar depósitos o retiros debe desbloquearla primero en su tarjeta.</span>
              </div>
            )}

            {/* Type tabs toggle */}
            <div className="grid grid-cols-2 gap-2 bg-binance-black p-1 rounded-xl border border-binance-border">
              <button
                type="button"
                onClick={() => setOperationType('ingreso_fondos')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  operationType === 'ingreso_fondos'
                    ? 'bg-binance-yellow text-binance-black premium-glow-yellow'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Cargar Plata
              </button>
              <button
                type="button"
                onClick={() => setOperationType('egreso_fondos')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  operationType === 'egreso_fondos'
                    ? 'bg-binance-red text-white premium-glow-red'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                Retirar Plata
              </button>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Monto en Pesos (ARS)
              </label>
              <input
                type="number"
                step="any"
                placeholder="Ej. 150000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white font-mono"
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Concepto / Origen
              </label>
              <input
                type="text"
                placeholder="Ej. Carga MP o Retiro por cajero"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white"
              />
            </div>

            {/* Attach Comprobante File */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
                Adjuntar Comprobante de la Operación
              </label>
              {comprobanteFile ? (
                <div className="flex items-center justify-between p-3 bg-binance-black border border-binance-green/50 rounded-xl text-xs text-white shadow-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-binance-green shrink-0" />
                    <div className="truncate">
                      <span className="font-mono font-bold block truncate">{comprobanteFile.name}</span>
                      <span className="text-[10px] text-binance-green font-medium block">✓ Comprobante listo para adjuntar</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComprobanteFile(null)}
                    className="p-1.5 hover:bg-binance-card rounded-lg text-binance-gray hover:text-binance-red transition-colors cursor-pointer ml-2"
                    title="Eliminar comprobante"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-binance-black border border-dashed border-binance-border hover:border-binance-yellow/60 rounded-xl cursor-pointer transition-all text-xs text-binance-gray hover:text-white group">
                  <Paperclip className="w-4 h-4 text-binance-yellow group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Adjuntar Comprobante (Imagen o PDF)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setComprobanteFile({ name: file.name });
                      }
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-binance-red/20 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-binance-green/20 border border-binance-green/40 rounded-xl text-binance-green text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!activeShiftId || selectedWalletObj?.blocked || isSubmittingFund}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 font-extrabold rounded-xl transition-all text-xs cursor-pointer ${
                activeShiftId && !selectedWalletObj?.blocked && !isSubmittingFund
                  ? 'bg-white hover:bg-white/90 text-binance-black'
                  : 'bg-binance-border text-binance-gray cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmittingFund
                ? 'Actualizando saldo en Supabase...'
                : (operationType === 'ingreso_fondos' ? 'Procesar Carga de Fondos' : 'Procesar Retiro de Fondos')}
            </button>
          </form>
        </div>
      </div>

      {/* Historial de Billetera with Advanced Filtering */}
      <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-6 shadow-md mt-6 lg:col-span-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-binance-border/40 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
              <Filter className="w-5 h-5 text-binance-yellow" />
              Historial de Billetera
            </h3>
            <p className="text-2xs text-binance-gray">Lista de movimientos y transacciones con filtros dinámicos</p>
          </div>

          {/* Core Controls with Responsive Grid for Mobile/Tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:flex xl:flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Wallet Selector */}
            <select
              value={histWalletFilter}
              onChange={(e) => setHistWalletFilter(e.target.value)}
              className="px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden cursor-pointer focus:border-binance-yellow w-full xl:w-auto"
            >
              <option value="all">Todas las Billeteras</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            {/* Type Selector */}
            <select
              value={histTypeFilter}
              onChange={(e) => setHistTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden cursor-pointer focus:border-binance-yellow w-full xl:w-auto"
            >
              <option value="all">Todos los tipos</option>
              <option value="compra">Compras</option>
              <option value="venta">Ventas</option>
              <option value="ingreso">Carga / Ingreso</option>
              <option value="egreso">Retiro / Egreso</option>
            </select>

            {/* Time Frame Selector */}
            <select
              value={histTimeFilter}
              onChange={(e) => setHistTimeFilter(e.target.value)}
              className="px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden cursor-pointer focus:border-binance-yellow w-full xl:w-auto"
            >
              <option value="all">Todo el tiempo</option>
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </select>

            {/* Toggle Advanced */}
            <button
              type="button"
              onClick={() => setHistUseAdvanced(!histUseAdvanced)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer w-full xl:w-auto ${
                histUseAdvanced 
                  ? 'bg-binance-yellow/20 text-binance-yellow border-binance-yellow premium-glow-yellow' 
                  : 'bg-binance-black text-binance-gray border-binance-border hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros Cronológicos
            </button>
          </div>
        </div>

        {/* ADVANCED CHRONOLOGICAL FILTER DRAWER */}
        {histUseAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-binance-black/40 rounded-xl border border-binance-border/50 text-xs">
            {/* Start date */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Desde</span>
              <input
                type="date"
                value={histStartDate}
                onChange={(e) => setHistStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white"
              />
            </div>
            
            {/* End date */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Hasta</span>
              <input
                type="date"
                value={histEndDate}
                onChange={(e) => setHistEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white"
              />
            </div>

            {/* Year */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Año</span>
              <select
                value={histSelectedYear}
                onChange={(e) => setHistSelectedYear(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer"
              >
                <option value="all">Todos</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Month */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Mes</span>
              <select
                value={histSelectedMonth}
                onChange={(e) => setHistSelectedMonth(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer"
              >
                <option value="all">Todos</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Day of Month */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Día de Mes</span>
              <select
                value={histSelectedDayOfMonth}
                onChange={(e) => setHistSelectedDayOfMonth(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer"
              >
                <option value="all">Todos</option>
                {Array.from({ length: 31 }, (_, i) => (i + 1).toString()).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Day of Week */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Día de Semana</span>
              <select
                value={histSelectedDayOfWeek}
                onChange={(e) => setHistSelectedDayOfWeek(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer"
              >
                <option value="all">Todos</option>
                {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            {/* Start Hour */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Hora Inicio</span>
              <select
                value={histStartHour}
                onChange={(e) => setHistStartHour(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer font-mono"
              >
                {Array.from({ length: 24 }, (_, i) => i.toString()).map(h => (
                  <option key={h} value={h}>{h.padStart(2, '0')}:00 hs</option>
                ))}
              </select>
            </div>

            {/* End Hour */}
            <div className="space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase tracking-wider block">Hora Fin</span>
              <select
                value={histEndHour}
                onChange={(e) => setHistEndHour(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-binance-black border border-binance-border rounded-lg text-white cursor-pointer font-mono"
              >
                {Array.from({ length: 24 }, (_, i) => i.toString()).map(h => (
                  <option key={h} value={h}>{h.padStart(2, '0')}:59 hs</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-4 flex justify-end gap-2 pt-2 border-t border-binance-border/30">
              <button
                type="button"
                onClick={() => {
                  setHistStartDate('');
                  setHistEndDate('');
                  setHistSelectedYear('all');
                  setHistSelectedMonth('all');
                  setHistSelectedDayOfMonth('all');
                  setHistSelectedDayOfWeek('all');
                  setHistStartHour('0');
                  setHistEndHour('23');
                }}
                className="px-3 py-1.5 bg-binance-black hover:bg-binance-black/85 border border-binance-border text-binance-gray hover:text-white rounded-lg text-2xs font-bold transition-all cursor-pointer"
              >
                Limpiar Filtros Cronológicos
              </button>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-binance-black rounded-xl border border-binance-border overflow-hidden">
          {filteredHistTxs.length === 0 ? (
            <div className="text-center py-10 text-binance-gray text-xs italic">
              No se encontraron movimientos registrados para esta búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-binance-gray">
                <thead className="bg-binance-black text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
                  <tr>
                    <th className="px-6 py-4">Fecha & Hora</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Monto</th>
                    <th className="px-6 py-4">Descripción / Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-binance-border/40">
                  {filteredHistTxs.slice(0, 100).map((t, index) => {
                    let badgeText = 'CARGA';
                    let badgeClass = 'bg-binance-green/10 text-binance-green border border-binance-green/20';

                    if (t.type === 'compra') {
                      badgeText = 'COMPRA';
                      badgeClass = 'bg-binance-red/10 text-binance-red border border-binance-red/20';
                    } else if (t.type === 'venta') {
                      badgeText = 'VENTA';
                      badgeClass = 'bg-binance-green/10 text-binance-green border border-binance-green/20';
                    } else if (t.type === 'egreso_fondos') {
                      badgeText = 'AJUSTE -';
                      badgeClass = 'bg-binance-red/10 text-binance-red border border-binance-red/20';
                    } else if (t.type === 'ingreso_fondos') {
                      badgeText = 'CARGA';
                      badgeClass = 'bg-binance-green/10 text-binance-green border border-binance-green/20';
                    }

                    const formattedDate = new Date(t.timestamp).toLocaleString('es-AR');

                    return (
                      <tr key={t.id || index} className="hover:bg-binance-black/30 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-white text-[11px] whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </td>
                        <td className={`px-6 py-3.5 font-mono font-bold text-xs ${
                          t.type === 'compra' || t.type === 'egreso_fondos' ? 'text-binance-red' : 'text-binance-green'
                        }`}>
                          {t.type === 'compra' || t.type === 'egreso_fondos' ? '-' : '+'}
                          {formatMoney(t.totalPesos)}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-binance-gray max-w-md truncate" title={t.notes}>
                          {t.notes || `${t.type.toUpperCase()} — ${t.crypto}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE BLOQUEO DE BILLETERA */}
      {blockingWallet && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative font-mono">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-binance-red/10 border border-binance-red/30 text-binance-red rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">
                    ¿Confirmar bloqueo de billetera?
                  </h3>
                  <span className="text-[10px] text-binance-gray">Acción de seguridad preventiva</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setBlockingWallet(null);
                  setBlockReason('');
                }}
                className="text-binance-gray hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-binance-gray">Nombre de la billetera:</span>
                <span className="font-extrabold text-white">{blockingWallet.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-binance-gray">Titular:</span>
                <span className="font-bold text-binance-yellow">{blockingWallet.titular || 'No especificado'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-binance-border/40 pt-2">
                <span className="text-binance-gray">Saldo actual:</span>
                <span className="font-black text-white text-sm">{formatMoney(blockingWallet.saldoPesos)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-binance-gray uppercase font-bold block">
                Motivo del bloqueo <span className="text-binance-red">* (obligatorio)</span>
              </label>
              <textarea
                required
                placeholder="Indique el motivo o incidente que amerita el bloqueo..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white text-xs outline-hidden focus:border-binance-red resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setBlockingWallet(null);
                  setBlockReason('');
                }}
                className="flex-1 py-2.5 border border-binance-border text-binance-gray hover:text-white font-bold rounded-xl uppercase text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingBlock || !blockReason.trim()}
                onClick={handleConfirmBlock}
                className="flex-1 py-2.5 bg-binance-red hover:bg-binance-red/90 disabled:opacity-40 text-white font-extrabold rounded-xl uppercase text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                {isSubmittingBlock ? 'Bloqueando...' : 'Confirmar Bloqueo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER BETWEEN WALLETS MODAL (rpc_wallet_transfer_v2) */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-binance-dark border border-binance-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-binance-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-binance-yellow/20 rounded-xl text-binance-yellow">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-display">
                    Transferencia entre Billeteras
                  </h3>
                  <span className="text-[10px] text-binance-gray">Movimiento interno de liquidez en Pesos (ARS)</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferError('');
                  setTransferSuccess('');
                }}
                className="text-binance-gray hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-binance-red/10 border border-binance-red/30 rounded-xl text-xs text-binance-red font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}

            {transferSuccess && (
              <div className="p-3 bg-binance-green/10 border border-binance-green/30 rounded-xl text-xs text-binance-green font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {transferSuccess}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Billetera Origen */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Billetera Origen <span className="text-binance-red">*</span>
                  </label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden cursor-pointer"
                    required
                  >
                    <option value="">Seleccionar Origen</option>
                    {activeWalletsOnly.map(w => (
                      <option key={w.id} value={w.id} disabled={w.blocked}>
                        {w.name} ({formatMoney(w.saldoPesos)}) {w.blocked ? '[BLOQUEADA]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Billetera Destino */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Billetera Destino <span className="text-binance-green">*</span>
                  </label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-green outline-hidden cursor-pointer"
                    required
                  >
                    <option value="">Seleccionar Destino</option>
                    {activeWalletsOnly.filter(w => w.id !== transferFromId).map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatMoney(w.saldoPesos)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-binance-gray uppercase font-bold block">
                    Monto a Transferir (ARS) <span className="text-binance-yellow">*</span>
                  </label>
                  {transferFromId && (
                    <button
                      type="button"
                      onClick={() => {
                        const fromW = wallets.find(w => w.id === transferFromId);
                        if (fromW) setTransferAmount(fromW.saldoPesos);
                      }}
                      className="text-[10px] text-binance-yellow hover:underline font-bold cursor-pointer"
                    >
                      MAX ({formatMoney(wallets.find(w => w.id === transferFromId)?.saldoPesos || 0)})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-binance-gray font-bold">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white font-mono text-sm focus:border-binance-yellow outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-binance-gray uppercase font-bold block">
                  Notas / Motivo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Rebalanceo de cuentas, carga de liquidez"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferError('');
                    setTransferSuccess('');
                  }}
                  className="flex-1 py-2.5 border border-binance-border text-binance-gray hover:text-white font-bold rounded-xl uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer || !transferAmount || Number(transferAmount) <= 0 || !transferFromId || !transferToId}
                  className="flex-1 py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 disabled:opacity-40 text-binance-black font-extrabold rounded-xl uppercase text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {isSubmittingTransfer ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
