import React, { useState } from 'react';
import { IncomeExpenseRecord, User, Wallet, ExchangeAccount } from '../types';
import { ArrowDownLeft, ArrowUpRight, Calendar, Clock, DollarSign, FileText, Filter, Landmark, Plus, Search, Upload, UserCheck, ShieldCheck } from 'lucide-react';

interface FondosProps {
  incomeExpenses: IncomeExpenseRecord[];
  wallets: Wallet[];
  exchanges: ExchangeAccount[];
  currentUser: User | null;
  users?: User[];
  activeShiftId?: string | null;
  onAddIncomeExpense: (record: Omit<IncomeExpenseRecord, 'id'>) => void;
}

export default function Fondos({
  incomeExpenses,
  wallets,
  exchanges,
  currentUser,
  users = [],
  activeShiftId,
  onAddIncomeExpense,
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
  const [proofFileName, setProofFileName] = useState('');

  // Filters
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [searchPerson, setSearchPerson] = useState('');

  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isContadora = currentUser?.role === 'CONTADORA';
  const currentOrgId = currentUser?.organization_id || '';

  // Unique vendors list (only for admin or contadora)
  const uniqueVendors = isVendedor
    ? []
    : Array.from(
        new Set([
          ...(users || []).map(u => u.name || u.username),
          ...incomeExpenses.map(r => r.transferPerson).filter(Boolean),
        ])
      ).filter(Boolean);

  // Filter records by org & user
  const records = incomeExpenses.filter(r => {
    if (r.organization_id && r.organization_id !== currentOrgId) return false;
    
    // Vendor isolation
    if (isVendedor && currentUser) {
      const uName = currentUser.name?.toLowerCase() || '';
      const uUsername = currentUser.username?.toLowerCase() || '';
      const matchPerson = (r.transferPerson && uName && r.transferPerson.toLowerCase().includes(uName)) || (r.transferPerson && uUsername && r.transferPerson.toLowerCase().includes(uUsername));
      const matchWallet = (r.walletOrExchangeName && uName && r.walletOrExchangeName.toLowerCase().includes(uName)) || (r.walletOrExchangeName && uUsername && r.walletOrExchangeName.toLowerCase().includes(uUsername));
      if (!matchPerson && !matchWallet && r.transferPerson) return false;
    } else if (vendorFilter !== 'all') {
      const vLower = vendorFilter.toLowerCase();
      const matchPerson = r.transferPerson?.toLowerCase().includes(vLower);
      const matchWallet = r.walletOrExchangeName?.toLowerCase().includes(vLower);
      if (!matchPerson && !matchWallet) return false;
    }
    
    // Time filter
    const now = new Date();
    const rDate = r.timestamp ? new Date(r.timestamp) : null;
    const isValidDate = rDate && !isNaN(rDate.getTime());

    if (timeFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      const rDateStr = r.dateString || (isValidDate ? rDate.toISOString().split('T')[0] : '');
      if (rDateStr !== todayStr) return false;
    } else if (timeFilter === 'month') {
      if (!isValidDate || rDate.getMonth() !== now.getMonth() || rDate.getFullYear() !== now.getFullYear()) return false;
    } else if (timeFilter === 'year') {
      if (!isValidDate || rDate.getFullYear() !== now.getFullYear()) return false;
    }

    if (typeFilter !== 'all' && r.type !== typeFilter) return false;

    if (searchPerson) {
      const q = searchPerson.toLowerCase();
      const mPerson = r.transferPerson.toLowerCase().includes(q);
      const mReason = r.reason.toLowerCase().includes(q);
      const mWallet = r.walletOrExchangeName.toLowerCase().includes(q);
      if (!mPerson && !mReason && !mWallet) return false;
    }

    return true;
  });

  // Calculate Daily & Filtered Metrics
  const incomesList = records.filter(r => r.type === 'ingreso');
  const totalIngresado = incomesList.reduce((sum, r) => sum + r.amount, 0);
  const totalEgresado = records.filter(r => r.type === 'egreso').reduce((sum, r) => sum + r.amount, 0);

  // Wallets used
  const uniqueWalletsUsed = Array.from(new Set(incomesList.map(r => r.walletOrExchangeName))).filter(Boolean);

  // Origen de transferencias
  const uniquePersons = Array.from(new Set(incomesList.map(r => r.transferPerson))).filter(Boolean);

  // Chronological order for First & Last
  const getIncomeSortTime = (inc: { timestamp?: string; dateString?: string; timeString?: string }) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    let targetName = 'N/A';
    if (assetType === 'pesos') {
      const w = wallets.find(x => x.id === targetId);
      targetName = w ? w.name : 'Billetera';
    } else {
      const ex = exchanges.find(x => x.id === targetId);
      targetName = ex ? ex.name : 'Exchange';
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

    onAddIncomeExpense({
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
      proofUrl: proofFileName ? `comprobante_${proofFileName}` : undefined,
      operator: currentUser?.name || 'Operador',
      vendorId: currentUser?.id,
      organization_id: currentOrgId,
      shiftId: activeShiftId || undefined,
    });

    setAmount(0);
    setTransferPerson('');
    setReason('');
    setCustomDate('');
    setProofFileName('');
    setShowModal(false);
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
      {/* HEADER & TOP CONTROLS */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-display">
              <Landmark className="w-6 h-6 text-binance-yellow" />
              Gestión de Fondos: Ingresos y Egresos
            </h2>
            <p className="text-xs text-binance-gray mt-1">
              Registro contable detallado de inyecciones y retiros de capital con comprobantes.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs rounded-xl shadow-lg hover:bg-binance-yellow/90 cursor-pointer uppercase tracking-wider shrink-0"
          >
            <Plus className="w-4 h-4" />
            Cargar Movimiento de Fondos
          </button>
        </div>
      </div>

      {/* CONTROLS: SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-binance-gray" />
          <input
            type="text"
            placeholder="Buscar por titular, motivo o billetera..."
            value={searchPerson}
            onChange={e => setSearchPerson(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-binance-card border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isAdmin || isContadora) && uniqueVendors.length > 0 && (
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2.5 bg-binance-card border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
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
            className="px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow cursor-pointer font-bold"
          >
            <option value="all">Todas las Fechas</option>
            <option value="today">Hoy</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow cursor-pointer font-bold"
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
                <th className="px-6 py-4">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-binance-border/40">
              {records.map((r, index) => (
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

                  <td className="px-6 py-4">
                    {r.proofUrl ? (
                      <span className="px-2 py-1 bg-binance-black border border-binance-border text-binance-yellow text-[10px] rounded-lg font-bold">
                        📄 Adjunto
                      </span>
                    ) : (
                      <span className="text-[10px] text-binance-gray italic">Sin adjunto</span>
                    )}
                  </td>
                </tr>
              ))}

              {records.length === 0 && (
                <tr key="empty-fondos-records">
                  <td colSpan={7} className="text-center py-10 text-binance-gray">
                    No hay movimientos de fondos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NUEVO MOVIMIENTO DE FONDOS */}
      {showModal && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Landmark className="w-4 h-4 text-binance-yellow" />
                Cargar Movimiento de Fondos
              </h3>
              <button onClick={() => setShowModal(false)} className="text-binance-gray hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Operación
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white font-bold outline-hidden focus:border-binance-yellow"
                  >
                    <option value="ingreso">🟢 Inyección / Ingreso (+)</option>
                    <option value="egreso">🔴 Retiro / Egreso (-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Tipo de Destino
                  </label>
                  <select
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                  >
                    <option value="pesos">Billetera Pesos ($)</option>
                    <option value="exchange">Exchange Cripto (USDT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Seleccionar {assetType === 'pesos' ? 'Billetera' : 'Exchange'} *
                </label>
                <select
                  required
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white font-bold outline-hidden focus:border-binance-yellow"
                >
                  <option value="">-- Seleccionar --</option>
                  {assetType === 'pesos'
                    ? wallets.map(w => <option key={w.id} value={w.id}>{w.name} (${w.saldoPesos.toLocaleString()} ARS)</option>)
                    : exchanges.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.balanceCrypto} USDT)</option>)
                  }
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
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-amber-400 font-extrabold outline-hidden focus:border-binance-yellow text-sm font-mono"
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
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
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
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
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
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Subir / Adjuntar Comprobante (Simulado)
                </label>
                <input
                  type="file"
                  onChange={e => setProofFileName(e.target.files?.[0]?.name || '')}
                  className="w-full text-xs text-binance-gray file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-binance-card file:text-white hover:file:bg-binance-border cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-binance-yellow text-binance-black font-extrabold rounded-xl uppercase tracking-wider text-xs shadow-md mt-2 cursor-pointer hover:bg-binance-yellow/90"
              >
                Registrar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
