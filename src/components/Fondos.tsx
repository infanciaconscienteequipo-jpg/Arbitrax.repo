import React, { useState, useMemo } from 'react';
import { IncomeExpenseRecord, User, Wallet, ExchangeAccount } from '../types';
import { storageService } from '../services/storage.service';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Landmark,
  Plus,
  Search,
  Upload,
  UserCheck,
  ShieldCheck,
  Eye,
  ExternalLink,
  X,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FondosProps {
  incomeExpenses: IncomeExpenseRecord[];
  wallets: Wallet[];
  exchanges: ExchangeAccount[];
  currentUser: User | null;
  users?: User[];
  activeShiftId?: string | null;
  onAddIncomeExpense: (record: Omit<IncomeExpenseRecord, 'id'>) => void | Promise<void>;
  onUpdateIncomeExpense?: (record: IncomeExpenseRecord) => Promise<{ success: boolean; error?: string }>;
}

export default function Fondos({
  incomeExpenses,
  wallets,
  exchanges,
  currentUser,
  users = [],
  activeShiftId,
  onAddIncomeExpense,
  onUpdateIncomeExpense,
}: FondosProps) {
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [assetType, setAssetType] = useState<'pesos' | 'exchange'>('pesos');
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [transferPerson, setTransferPerson] = useState('');
  const [reason, setReason] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Income/Expense Modal State
  const [editingRecord, setEditingRecord] = useState<IncomeExpenseRecord | null>(null);
  const [editType, setEditType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [editAssetType, setEditAssetType] = useState<'pesos' | 'exchange'>('pesos');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editTargetId, setEditTargetId] = useState('');
  const [editTransferPerson, setEditTransferPerson] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editProofUrl, setEditProofUrl] = useState<string>('');
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [isUploadingEdit, setIsUploadingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Proof Modal state
  const [viewingProof, setViewingProof] = useState<{ url: string; title: string } | null>(null);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [searchPerson, setSearchPerson] = useState('');

  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isContadora = currentUser?.role === 'CONTADORA';
  const currentOrgId = currentUser?.organization_id || '';

  const availableWallets = wallets.filter(w => !isVendedor || (w.vendorId && w.vendorId === currentUser?.id));
  const availableExchanges = exchanges.filter(ex => !isVendedor || (ex.vendorId && ex.vendorId === currentUser?.id));

  // Unique active vendors list
  const uniqueVendors = isVendedor
    ? []
    : (users || [])
        .filter(u => u.active !== false && u.status === 'active' && (u.role === 'VENDEDOR' || u.role === 'ADMIN'))
        .map(u => u.name || u.username)
        .filter(Boolean);

  // Filter records by org & user
  const records = incomeExpenses.filter(r => {
    if (r.organization_id && r.organization_id !== currentOrgId) return false;
    
    // Vendor isolation
    if (isVendedor && currentUser) {
      const matchVendorId = r.vendorId === currentUser.id;
      const ownsWalletOrEx = wallets.some(w => w.id === r.walletOrExchangeId && w.vendorId === currentUser.id) ||
        exchanges.some(ex => ex.id === r.walletOrExchangeId && ex.vendorId === currentUser.id);
      if (!matchVendorId && !ownsWalletOrEx) return false;
    } else if (vendorFilter !== 'all') {
      const vLower = vendorFilter.toLowerCase();
      const matchVendor = r.transferPerson?.toLowerCase().includes(vLower) ||
        (r.operator && r.operator.toLowerCase().includes(vLower));
      if (!matchVendor) return false;
    }

    // Time filter
    if (timeFilter !== 'all' && r.timestamp) {
      const d = new Date(r.timestamp);
      const now = new Date();
      if (timeFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (timeFilter === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (timeFilter === 'year' && d.getFullYear() !== now.getFullYear()) return false;
    }

    // Type filter
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;

    // Search filter
    if (searchPerson.trim()) {
      const query = searchPerson.toLowerCase();
      const matchPerson = r.transferPerson?.toLowerCase().includes(query);
      const matchReason = r.reason?.toLowerCase().includes(query);
      const matchDest = r.walletOrExchangeName?.toLowerCase().includes(query);
      if (!matchPerson && !matchReason && !matchDest) return false;
    }

    return true;
  });

  // Calculate totals
  const totalIngresos = records.filter(r => r.type === 'ingreso').reduce((sum, r) => sum + r.amount, 0);
  const totalEgresos = records.filter(r => r.type === 'egreso').reduce((sum, r) => sum + r.amount, 0);
  const balanceNeto = totalIngresos - totalEgresos;

  const totalPages = Math.ceil(records.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return records.slice(start, start + itemsPerPage);
  }, [records, currentPage, itemsPerPage]);

  const handleOpenEdit = (r: IncomeExpenseRecord) => {
    setEditingRecord(r);
    setEditType(r.type);
    const initialAssetType = r.assetType || (wallets.some(w => w.id === r.walletOrExchangeId) ? 'pesos' : 'exchange');
    setEditAssetType(initialAssetType);
    setEditAmount(r.amount);
    setEditTargetId(r.walletOrExchangeId || '');
    setEditTransferPerson(r.transferPerson || '');
    setEditReason(r.reason || '');
    setEditProofUrl(r.proofUrl || '');
    setEditSelectedFile(null);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !onUpdateIncomeExpense) return;

    const numAmount = typeof editAmount === 'number' ? editAmount : (parseFloat(String(editAmount)) || 0);
    if (numAmount < 0) {
      setEditError('El monto no puede ser negativo.');
      return;
    }

    if (!editTargetId) {
      setEditError(editAssetType === 'pesos' ? 'Debe seleccionar una billetera.' : 'Debe seleccionar un Exchange.');
      return;
    }

    let finalProofUrl = editProofUrl;
    if (editSelectedFile) {
      setIsUploadingEdit(true);
      try {
        const uploadRes = await storageService.uploadProof(editSelectedFile);
        finalProofUrl = uploadRes.url;
      } catch (uploadErr: any) {
        setEditError('Error al subir comprobante: ' + (uploadErr.message || ''));
        setIsUploadingEdit(false);
        return;
      }
      setIsUploadingEdit(false);
    }

    const walletObj = wallets.find(w => w.id === editTargetId);
    const exchangeObj = exchanges.find(ex => ex.id === editTargetId);
    const targetName = editAssetType === 'pesos'
      ? (walletObj ? walletObj.name : editingRecord.walletOrExchangeName)
      : (exchangeObj ? exchangeObj.name : editingRecord.walletOrExchangeName);

    const updated: IncomeExpenseRecord = {
      ...editingRecord,
      type: editType,
      assetType: editAssetType,
      amount: numAmount,
      walletOrExchangeId: editTargetId,
      walletOrExchangeName: targetName,
      transferPerson: editTransferPerson.trim(),
      reason: editReason.trim(),
      proofUrl: finalProofUrl || undefined,
    };

    setIsSubmittingEdit(true);
    setEditError('');

    try {
      const res = await onUpdateIncomeExpense(updated);
      if (res.success) {
        setEditSuccess('✅ Registro de fondos actualizado con éxito.');
        setTimeout(() => {
          setEditingRecord(null);
          setEditSuccess('');
        }, 1200);
      } else {
        setEditError(res.error || 'Error al actualizar el registro.');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Error inesperado al actualizar.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Set default target ID
  React.useEffect(() => {
    if (assetType === 'pesos' && availableWallets.length > 0 && !targetId) {
      setTargetId(availableWallets[0].id);
    } else if (assetType === 'exchange' && availableExchanges.length > 0 && !targetId) {
      setTargetId(availableExchanges[0].id);
    }
  }, [assetType, availableWallets, availableExchanges, targetId]);

  // Income Timeline Metrics
  const incomesList = records.filter(r => r.type === 'ingreso');
  
  const getIncomeSortTime = (inc: IncomeExpenseRecord) => {
    let datePart = '';
    if (inc.dateString) {
      const rawDate = inc.dateString.trim();
      datePart = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    } else if (inc.timestamp) {
      datePart = inc.timestamp.split('T')[0];
    }

    let timePart = '';
    if (inc.timeString) {
      const rawTime = inc.timeString.trim();
      timePart = rawTime.includes('T') ? (rawTime.split('T')[1]?.substring(0, 8) || rawTime) : rawTime;
    } else if (inc.timestamp && inc.timestamp.includes('T')) {
      timePart = inc.timestamp.split('T')[1]?.substring(0, 8) || '';
    }

    if (timePart && timePart.length === 5) {
      timePart = `${timePart}:00`;
    }

    if (datePart && timePart) {
      const d = new Date(`${datePart}T${timePart}`);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    if (datePart) {
      const d = new Date(`${datePart}T00:00:00`);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    if (inc.timestamp) {
      const d = new Date(inc.timestamp);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    return 0;
  };

  const sortedIncomes = [...incomesList].sort((a, b) => getIncomeSortTime(a) - getIncomeSortTime(b));
  const firstIncome = sortedIncomes.length > 0 ? sortedIncomes[0] : null;
  const lastIncome = sortedIncomes.length > 0 ? sortedIncomes[sortedIncomes.length - 1] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!amount || amount <= 0) {
      setFormError('El monto debe ser mayor a 0.');
      return;
    }

    let targetName = 'N/A';
    if (assetType === 'pesos') {
      const w = wallets.find(x => x.id === targetId);
      targetName = w ? w.name : 'Billetera';
    } else {
      const ex = exchanges.find(x => x.id === targetId);
      targetName = ex ? ex.name : 'Exchange';
    }

    let uploadedProofUrl: string | undefined = undefined;

    if (selectedFile) {
      setIsUploading(true);
      try {
        const uploadRes = await storageService.uploadProof(selectedFile, 'comprobantes');
        uploadedProofUrl = uploadRes.url;
      } catch (err: any) {
        setIsUploading(false);
        setFormError(err?.message || 'Error al subir el comprobante a Supabase Storage.');
        return;
      }
      setIsUploading(false);
    }

    const now = new Date();
    let dateObj = now;
    if (customDate) {
      const parsed = new Date(`${customDate}T12:00:00`);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    const isoStr = dateObj.toISOString();
    const dateStr = customDate || now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    try {
      await onAddIncomeExpense({
        type,
        assetType,
        walletOrExchangeId: targetId,
      walletOrExchangeName: targetName,
      timestamp: isoStr,
      dateString: dateStr,
      timeString: timeStr,
      amount: Number(amount),
      transferPerson: transferPerson.trim() || 'Desconocido',
      reason: reason.trim() || 'Sin motivo especificado',
      proofUrl: uploadedProofUrl,
      operator: currentUser?.name || currentUser?.username || 'Operador',
      vendorId: currentUser?.id,
      organization_id: currentOrgId,
      shiftId: activeShiftId || undefined,
      });
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo registrar el movimiento.');
      return;
    }

    setAmount(0);
    setTransferPerson('');
    setReason('');
    setCustomDate('');
    setSelectedFile(null);
    setShowModal(false);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <Landmark className="w-5 h-5 text-binance-yellow" />
            Control de Fondos, Ingresos y Egresos
          </h2>
          <p className="text-xs text-binance-gray mt-1">
            Registro detallado de inyecciones de capital, retiros de dinero, titular que transfiere y comprobantes de pago.
          </p>
        </div>

        {/* Action Button: Disabled for Contadora */}
        {!isContadora && (
          <button
            onClick={() => {
              setShowModal(true);
              setFormError('');
            }}
            className="px-4 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs uppercase rounded-xl hover:bg-binance-yellow/90 transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nuevo Ingreso / Egreso
          </button>
        )}
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-binance-card border border-binance-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-binance-gray text-xs font-bold uppercase mb-2">
            <span>Total Ingresos</span>
            <ArrowDownLeft className="w-4 h-4 text-binance-green" />
          </div>
          <div className="text-xl font-black text-binance-green font-mono">
            +{formatMoney(totalIngresos)}
          </div>
          <div className="text-[10px] text-binance-gray mt-1">
            {records.filter(r => r.type === 'ingreso').length} transacciones registradas
          </div>
        </div>

        <div className="bg-binance-card border border-binance-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-binance-gray text-xs font-bold uppercase mb-2">
            <span>Total Egresos</span>
            <ArrowUpRight className="w-4 h-4 text-binance-red" />
          </div>
          <div className="text-xl font-black text-binance-red font-mono">
            -{formatMoney(totalEgresos)}
          </div>
          <div className="text-[10px] text-binance-gray mt-1">
            {records.filter(r => r.type === 'egreso').length} transacciones registradas
          </div>
        </div>

        <div className="bg-binance-card border border-binance-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-binance-gray text-xs font-bold uppercase mb-2">
            <span>Balance Neto</span>
            <DollarSign className="w-4 h-4 text-binance-yellow" />
          </div>
          <div className={`text-xl font-black font-mono ${balanceNeto >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
            {balanceNeto >= 0 ? '+' : ''}{formatMoney(balanceNeto)}
          </div>
          <div className="text-[10px] text-binance-gray mt-1">
            Flujo de caja del período
          </div>
        </div>
      </div>

      {/* TIMELINE DE INGRESOS */}
      <div className="bg-binance-card border border-binance-border p-5 rounded-2xl shadow-md space-y-4">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 border-b border-binance-border/60 pb-3">
          <Clock className="w-4 h-4 text-binance-yellow" />
          Cronología de Ingresos de Fondos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primer Ingreso */}
          <div className="bg-binance-black p-4 rounded-xl border border-binance-green/30 space-y-2">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-2">
              <span className="text-xs font-black text-binance-green uppercase tracking-wider flex items-center gap-1.5 font-mono">
                ⭐ Primer Ingreso Registrado
              </span>
              {firstIncome && (
                <span className="text-[10px] bg-binance-green/20 text-binance-green font-bold px-2 py-0.5 rounded font-mono">
                  {firstIncome.timeString || '00:00:00'}
                </span>
              )}
            </div>

            {firstIncome ? (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Monto:</span>
                  <span className="font-extrabold text-binance-green text-sm block">
                    {formatMoney(firstIncome.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Fecha:</span>
                  <span className="font-bold text-white text-xs block">
                    {firstIncome.dateString || '—'} {firstIncome.timeString || ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Titular:</span>
                  <span className="font-bold text-white text-xs block truncate">
                    {firstIncome.transferPerson || 'Desconocido'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Destino:</span>
                  <span className="font-bold text-binance-yellow text-xs block truncate">
                    {firstIncome.walletOrExchangeName}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-binance-gray italic font-mono py-2">Sin ingresos registrados en el período</p>
            )}
          </div>

          {/* Último Ingreso */}
          <div className="bg-binance-black p-4 rounded-xl border border-amber-500/30 space-y-2">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-2">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                🏁 Último Ingreso Registrado
              </span>
              {lastIncome && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded font-mono">
                  {lastIncome.timeString || '00:00:00'}
                </span>
              )}
            </div>

            {lastIncome ? (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Monto:</span>
                  <span className="font-extrabold text-binance-green text-sm block">
                    {formatMoney(lastIncome.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Fecha:</span>
                  <span className="font-bold text-white text-xs block">
                    {lastIncome.dateString || '—'} {lastIncome.timeString || ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Titular:</span>
                  <span className="font-bold text-white text-xs block truncate">
                    {lastIncome.transferPerson || 'Desconocido'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-binance-gray uppercase font-bold block">Destino:</span>
                  <span className="font-bold text-binance-yellow text-xs block truncate">
                    {lastIncome.walletOrExchangeName}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-binance-gray italic font-mono py-2">Sin ingresos registrados en el período</p>
            )}
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-binance-card border border-binance-border p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-binance-gray absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por titular, motivo o billetera..."
            value={searchPerson}
            onChange={e => setSearchPerson(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isAdmin || isContadora) && uniqueVendors.length > 0 && (
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2.5 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
            >
              <option value="all">👤 Todos los Vendedores</option>
              {uniqueVendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          <select
            value={timeFilter}
            onChange={e => setTimeFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow cursor-pointer font-bold"
          >
            <option value="all">Todas las Fechas</option>
            <option value="today">Hoy</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow cursor-pointer font-bold"
          >
            <option value="all">Todos (Ingresos y Egresos)</option>
            <option value="ingreso">Solo Ingresos</option>
            <option value="egreso">Solo Egresos</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-binance-card border border-binance-border rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-binance-gray">
            <thead className="bg-binance-black text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
              <tr>
                <th className="px-6 py-4">Fecha & Hora</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Billetera / Exchange</th>
                <th className="px-6 py-4">Titular / Transfiere</th>
                <th className="px-6 py-4 text-right">Monto</th>
                <th className="px-6 py-4">Motivo / Notas</th>
                <th className="px-6 py-4 text-center">Comprobante</th>
                {onUpdateIncomeExpense && <th className="px-6 py-4 text-center">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-binance-border/40">
              {paginatedRecords.map((r, index) => (
                <tr key={r.id ? `record-${r.id}` : `record-idx-${index}`} className="hover:bg-binance-black/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-white">{r.dateString}</div>
                    <div className="text-[10px] text-binance-gray font-mono">{r.timeString}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase border ${
                      r.type === 'ingreso'
                        ? 'bg-binance-green/20 text-binance-green border-binance-green/30'
                        : 'bg-binance-red/20 text-binance-red border-binance-red/30'
                    }`}>
                      {r.type === 'ingreso' ? '+ INGRESO' : '- EGRESO'}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-bold text-white">
                    {r.walletOrExchangeName}
                  </td>

                  <td className="px-6 py-4 font-semibold text-cyan-300">
                    {r.transferPerson}
                  </td>

                  <td className="px-6 py-4 text-right font-black font-mono text-sm">
                    <span className={r.type === 'ingreso' ? 'text-binance-green' : 'text-binance-red'}>
                      {r.type === 'ingreso' ? '+' : '-'}{formatMoney(r.amount)}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-binance-gray italic max-w-xs truncate">
                    "{r.reason}"
                  </td>

                  <td className="px-6 py-4 text-center">
                    {r.proofUrl ? (
                      <button
                        onClick={() => setViewingProof({ url: r.proofUrl!, title: `Comprobante de ${r.transferPerson} (${formatMoney(r.amount)})` })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-binance-black border border-binance-yellow/40 hover:border-binance-yellow text-binance-yellow text-[11px] rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                      >
                        {storageService.isPdf(r.proofUrl) ? (
                          <FileText className="w-3.5 h-3.5" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span>{storageService.isPdf(r.proofUrl) ? 'Ver PDF' : 'Ver Comprobante'}</span>
                      </button>
                    ) : (
                      <span className="text-binance-gray/40 text-[11px] italic">Sin adjunto</span>
                    )}
                  </td>

                  {onUpdateIncomeExpense && (
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(r)}
                        className="px-2.5 py-1.5 bg-binance-black hover:bg-binance-card border border-binance-border hover:border-binance-yellow/50 text-binance-yellow rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        title="Editar movimiento de fondos"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {records.length === 0 && (
                <tr key="empty-fondos-records">
                  <td colSpan={onUpdateIncomeExpense ? 8 : 7} className="text-center py-12 text-binance-gray italic font-mono">
                    No se encontraron registros con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BAR */}
        {records.length > 0 && (
          <div className="bg-binance-black px-6 py-4 border-t border-binance-border flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <span className="text-binance-gray">
              Mostrando <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> a{' '}
              <strong className="text-white">{Math.min(currentPage * itemsPerPage, records.length)}</strong> de{' '}
              <strong className="text-binance-yellow">{records.length}</strong> registros de fondos
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

      {/* MODAL VIEW PROOF */}
      {viewingProof && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-binance-card border border-binance-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-binance-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-binance-yellow" />
                {viewingProof.title}
              </h3>
              <button
                onClick={() => setViewingProof(null)}
                className="text-binance-gray hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-binance-black/60 rounded-xl p-4 min-h-[300px]">
              {storageService.isPdf(viewingProof.url) ? (
                <div className="text-center space-y-4 p-6">
                  <FileText className="w-16 h-16 text-binance-yellow mx-auto" />
                  <p className="text-sm text-white font-bold">Documento Comprobante en formato PDF</p>
                  <a
                    href={viewingProof.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-binance-yellow text-binance-black font-extrabold text-xs uppercase rounded-xl hover:bg-binance-yellow/90 transition-all shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir PDF en pestaña nueva
                  </a>
                </div>
              ) : (
                <img
                  src={viewingProof.url}
                  alt="Comprobante"
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain border border-binance-border shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-binance-border">
              <a
                href={viewingProof.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-binance-yellow hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir enlace directo
              </a>
              <button
                onClick={() => setViewingProof(null)}
                className="px-5 py-2 bg-binance-border hover:bg-binance-gray/20 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO MOVIMIENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-binance-card border border-binance-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-binance-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-binance-yellow" />
                Registrar Movimiento de Fondos
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-binance-gray hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-binance-red/20 border border-binance-red/40 rounded-xl text-xs text-binance-red flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Operación
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                  >
                    <option value="ingreso">🟢 Ingreso de Dinero</option>
                    <option value="egreso">🔴 Egreso / Retiro</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Activo / Destino
                  </label>
                  <select
                    value={assetType}
                    onChange={e => {
                      setAssetType(e.target.value as any);
                      setTargetId('');
                    }}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                  >
                    <option value="pesos">Billetera en Pesos (ARS)</option>
                    <option value="exchange">Exchange Cripto (USDT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Seleccionar Billetera o Exchange Específico
                </label>
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                >
                  {assetType === 'pesos' ? (
                    availableWallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.titular}) - Saldo: {formatMoney(w.saldoPesos)}
                      </option>
                    ))
                  ) : (
                    availableExchanges.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} - Stock: {ex.balanceCrypto} USDT
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Monto *
                </label>
                <input
                  type="number"
                  required
                  step="any"
                  min="1"
                  placeholder="ej. 150000"
                  value={amount || ''}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-amber-400 font-extrabold outline-hidden focus:border-binance-yellow text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Persona / Titular que Transfiere *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Carlos Pérez / Proveedor X"
                  value={transferPerson}
                  onChange={e => setTransferPerson(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Motivo / Observaciones *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Inyección inicial de capital o pago de comisión"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Fecha y Hora (Opcional, por defecto Actual)
                </label>
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Adjuntar Comprobante (Imagen o PDF)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-binance-gray file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-binance-black file:text-binance-yellow hover:file:bg-binance-border cursor-pointer border border-binance-border rounded-xl p-1 bg-binance-black/50"
                />
                {selectedFile && (
                  <p className="text-[10px] text-binance-green mt-1 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Archivo listo para subir: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 bg-binance-yellow text-binance-black font-extrabold rounded-xl uppercase tracking-wider text-xs shadow-md mt-2 cursor-pointer hover:bg-binance-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Upload className="w-4 h-4 animate-bounce" />
                    Subiendo comprobante a Supabase Storage...
                  </>
                ) : (
                  'Registrar Movimiento'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INCOME/EXPENSE MODAL (rpc_income_expense_update_v2) */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-binance-dark border border-binance-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-binance-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-binance-yellow/20 rounded-xl text-binance-yellow">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base font-display">
                    Editar Movimiento de Fondos
                  </h3>
                  <span className="text-[10px] text-binance-gray">Actualización financiera vía RPC v2</span>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-binance-gray hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-binance-red/20 border border-binance-red/40 rounded-xl text-xs text-binance-red flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="p-3 bg-binance-green/20 border border-binance-green/40 rounded-xl text-xs text-binance-green flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Movimiento *
                  </label>
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                  >
                    <option value="ingreso">🟢 + INGRESO</option>
                    <option value="egreso">🔴 - EGRESO</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Activo *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-binance-black border border-binance-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setEditAssetType('pesos');
                        if (!wallets.some(w => w.id === editTargetId) && availableWallets.length > 0) {
                          setEditTargetId(availableWallets[0].id);
                        }
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        editAssetType === 'pesos'
                          ? 'bg-binance-yellow text-binance-black shadow-xs'
                          : 'text-binance-gray hover:text-white'
                      }`}
                    >
                      💵 Pesos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditAssetType('exchange');
                        if (!exchanges.some(ex => ex.id === editTargetId) && availableExchanges.length > 0) {
                          setEditTargetId(availableExchanges[0].id);
                        }
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        editAssetType === 'exchange'
                          ? 'bg-binance-yellow text-binance-black shadow-xs'
                          : 'text-binance-gray hover:text-white'
                      }`}
                    >
                      🏦 Exchange
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    {editAssetType === 'pesos' ? 'Billetera Destino ($ ARS) *' : 'Exchange Destino (USDT) *'}
                  </label>
                  {editAssetType === 'pesos' ? (
                    <select
                      value={editTargetId}
                      onChange={e => setEditTargetId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden cursor-pointer"
                    >
                      <option value="">Seleccione Billetera...</option>
                      {availableWallets.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.titular ? `(${w.titular})` : ''} - ${w.saldoPesos.toLocaleString('es-AR')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={editTargetId}
                      onChange={e => setEditTargetId(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white focus:border-binance-yellow outline-hidden cursor-pointer"
                    >
                      <option value="">Seleccione Exchange...</option>
                      {availableExchanges.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name} - {(ex.balanceCrypto || 0).toFixed(2)} USDT
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Monto ({editAssetType === 'pesos' ? '$ ARS' : 'USDT'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white font-mono text-sm focus:border-binance-yellow outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Persona que Transfiere / Titular
                </label>
                <input
                  type="text"
                  placeholder="Nombre de la persona o entidad"
                  value={editTransferPerson}
                  onChange={e => setEditTransferPerson(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Motivo / Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Concepto o justificación"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Comprobante (Opcional)
                </label>
                {editProofUrl && !editSelectedFile && (
                  <div className="mb-2 p-2 bg-binance-black border border-binance-border rounded-xl flex items-center justify-between">
                    <span className="text-[11px] text-binance-green flex items-center gap-1.5 truncate">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      Comprobante actual adjunto
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={editProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-binance-yellow hover:underline text-[10px] font-bold flex items-center gap-1"
                      >
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setEditProofUrl('')}
                        className="text-binance-red hover:underline text-[10px] cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setEditSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-binance-gray file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-binance-border file:text-white hover:file:bg-binance-yellow hover:file:text-binance-black cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 py-2.5 border border-binance-border text-binance-gray hover:text-white font-bold rounded-xl uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || isUploadingEdit}
                  className="flex-1 py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 disabled:opacity-40 text-binance-black font-extrabold rounded-xl uppercase text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isSubmittingEdit || isUploadingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
