import React, { useState } from 'react';
import { Shift, Wallet, Transaction, IncomeExpenseRecord, ExchangeAccount, User } from '../types';
import {
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Eye,
  X,
  Coins,
  Building2,
  UserCheck,
  WalletCards,
  BarChart3,
  Download,
  ShieldCheck,
  Percent
} from 'lucide-react';

interface TurnosControlProps {
  shifts: Shift[];
  activeShift: Shift | null;
  wallets: Wallet[];
  exchanges?: ExchangeAccount[];
  incomeExpenses?: IncomeExpenseRecord[];
  transactions: Transaction[];
  users?: User[];
  currentUser?: User | null;
  currentOperator: string;
  onStartShift: (operatorName: string) => void;
  onEndShift: (shiftId: string) => void;
}

export default function TurnosControl({
  shifts,
  activeShift,
  wallets,
  exchanges = [],
  incomeExpenses = [],
  transactions,
  users = [],
  currentUser,
  currentOperator,
  onStartShift,
  onEndShift,
}: TurnosControlProps) {
  const isContadora = currentUser?.role === 'CONTADORA';
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [operatorInput, setOperatorInput] = useState(currentOperator || '');
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<Shift | null>(null);
  const [vendorFilter, setVendorFilter] = useState('all');

  // Solo el VENDEDOR dueño del turno puede ver y presionar el botón "CERRAR JORNADA".
  // ADMIN, SUPER_ADMIN y CONTADORA solo auditan información, historial y estado.
  const canCloseActiveShift = isVendedor && !isAdmin && !isContadora && (
    !activeShift?.userId ||
    activeShift.userId === currentUser?.id ||
    (activeShift?.operatorName && currentUser && (
      activeShift.operatorName.toLowerCase().includes((currentUser.name || '').toLowerCase()) ||
      activeShift.operatorName.toLowerCase().includes((currentUser.username || '').toLowerCase())
    ))
  );

  const uniqueVendors = isVendedor
    ? []
    : Array.from(
        new Set(
          (users || [])
            .filter(u => {
              const r = (u.role || '').toUpperCase();
              const isVendorRole = r === 'VENDEDOR' || (!r.includes('ADMIN') && !r.includes('CONTADOR') && !r.includes('SUPER'));
              const isSameOrg = !currentUser?.organization_id || !u.organization_id || u.organization_id === currentUser.organization_id;
              const isActive = u.active !== false && u.status !== 'disabled' && u.status !== 'suspended';
              return isVendorRole && isSameOrg && isActive;
            })
            .map(u => u.name || u.username)
            .filter(Boolean)
        )
      );

  const filteredShifts = shifts.filter(s => {
    if (isVendedor && currentUser) {
      const uName = currentUser.name?.toLowerCase() || '';
      const uUsername = currentUser.username?.toLowerCase() || '';
      if (!s.operatorName?.toLowerCase().includes(uName) && !s.operatorName?.toLowerCase().includes(uUsername)) {
        return false;
      }
    } else if (vendorFilter !== 'all') {
      const targetUser = users.find(u => (u.name || u.username) === vendorFilter);
      const nameMatch = s.operatorName?.toLowerCase().includes(vendorFilter.toLowerCase());
      const userNameMatch = targetUser?.username && s.operatorName?.toLowerCase().includes(targetUser.username.toLowerCase());
      const targetNameMatch = targetUser?.name && s.operatorName?.toLowerCase().includes(targetUser.name.toLowerCase());
      return Boolean(nameMatch || userNameMatch || targetNameMatch);
    }
    return true;
  });

  const safeDate = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const safeFormatDateTime = (val: any, fallback = '—'): string => {
    const d = safeDate(val);
    return d ? d.toLocaleString('es-AR') : fallback;
  };

  const safeFormatDate = (val: any, fallback = ''): string => {
    const d = safeDate(val);
    return d ? d.toLocaleDateString('es-AR') : fallback;
  };

  const safeFormatTime = (val: any, fallback = '00:00:00'): string => {
    const d = safeDate(val);
    if (!d) return fallback;
    try {
      return d.toTimeString().split(' ')[0] || fallback;
    } catch {
      return fallback;
    }
  };

  const safeISOString = (val: any, fallback = ''): string => {
    const d = safeDate(val);
    if (!d) return fallback;
    try {
      return d.toISOString().split('T')[0] || fallback;
    } catch {
      return fallback;
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (amount: number, decimals = 2) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  };

  // Helper to get all shift data for details calculation
  const getShiftDetails = (shift: Shift) => {
    const isRecordInShift = (
      item: { shiftId?: string; timestamp?: string; dateString?: string; timeString?: string }
    ): boolean => {
      // 1. If explicit shiftId exists, strictly match shift.id
      if (item.shiftId) {
        return item.shiftId === shift.id;
      }

      // 2. If no shiftId (legacy record), fallback to timestamp within shift bounds
      const shiftStartD = safeDate(shift.startTime);
      if (!shiftStartD) return false;
      const shiftStartTime = shiftStartD.getTime();

      const shiftEndD = safeDate(shift.endTime);
      const shiftEndTime = shiftEndD ? shiftEndD.getTime() : Date.now() + 1000;

      let itemD = safeDate(item.timestamp);
      if (!itemD && item.dateString) {
        const timeStr = item.timeString || '12:00:00';
        itemD = safeDate(`${item.dateString}T${timeStr}`);
      }

      if (!itemD) return false;
      const itemTime = itemD.getTime();

      return itemTime >= shiftStartTime && itemTime <= shiftEndTime;
    };

    // Filter transactions within shift
    const shiftTxs = transactions.filter(t => isRecordInShift(t));

    // Filter income expenses within shift
    const shiftIncomes = incomeExpenses.filter(inc => inc.type === 'ingreso' && isRecordInShift(inc));

    // Also get transactions of type 'ingreso_fondos'
    const txIncomes = shiftTxs.filter(t => t.type === 'ingreso_fondos');

    // Combine all income items
    const combinedIncomes = [
      ...shiftIncomes.map(inc => ({
        id: inc.id,
        operator: inc.operator || shift.operatorName,
        amount: inc.amount,
        timeString: inc.timeString || safeFormatTime(inc.timestamp),
        dateString: inc.dateString || safeISOString(inc.timestamp) || safeFormatDate(inc.timestamp),
        walletOrExchangeName: inc.walletOrExchangeName,
        note: inc.transferPerson ? `Origen: ${inc.transferPerson}` : inc.reason || 'Ingreso de fondo',
        timestamp: inc.timestamp,
      })),
      ...txIncomes.map(tx => ({
        id: tx.id,
        operator: tx.operator || shift.operatorName,
        amount: tx.totalPesos,
        timeString: tx.timeString || safeFormatTime(tx.timestamp),
        dateString: tx.dateString || safeISOString(tx.timestamp) || safeFormatDate(tx.timestamp),
        walletOrExchangeName: tx.walletName,
        note: tx.notes || 'Inyección a billetera',
        timestamp: tx.timestamp,
      })),
    ];

    // Sort combinedIncomes chronologically by exact date and time
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

    const sortedIncomes = [...combinedIncomes].sort((a, b) => getIncomeSortTime(a) - getIncomeSortTime(b));
    const firstIncome = sortedIncomes.length > 0 ? sortedIncomes[0] : null;
    const lastIncome = sortedIncomes.length > 0 ? sortedIncomes[sortedIncomes.length - 1] : null;

    const totalIncomeCount = combinedIncomes.length;
    const totalIncomeAmount = combinedIncomes.reduce((sum, inc) => sum + inc.amount, 0);

    // Purchases (Compras USDT)
    const purchaseTxs = shiftTxs.filter(t => t.type === 'compra');
    const totalUsdtBought = purchaseTxs.reduce((sum, t) => sum + t.quantity, 0);
    const totalPesosPurchases = purchaseTxs.reduce((sum, t) => sum + t.totalPesos, 0);
    const avgBuyPrice = totalUsdtBought > 0 ? totalPesosPurchases / totalUsdtBought : 0;

    // Sales (Ventas USDT)
    const salesTxs = shiftTxs.filter(t => t.type === 'venta');
    const totalUsdtSold = salesTxs.reduce((sum, t) => sum + t.quantity, 0);
    const totalPesosSales = salesTxs.reduce((sum, t) => sum + t.totalPesos, 0);
    const avgSellPrice = totalUsdtSold > 0 ? totalPesosSales / totalUsdtSold : 0;

    // Total Gains
    const totalGains = salesTxs.reduce((sum, t) => sum + (t.gain || 0), 0);

    // Breakdown per Exchange for Purchases and Sales
    const exchangeBreakdownMap: {
      [key: string]: {
        exchangeName: string;
        operators: Set<string>;
        buyCount: number;
        buyUsdt: number;
        buyPesos: number;
        sellCount: number;
        sellUsdt: number;
        sellPesos: number;
        gain: number;
        buyTxs: Transaction[];
        sellTxs: Transaction[];
      };
    } = {};

    shiftTxs.forEach(tx => {
      if (tx.type !== 'compra' && tx.type !== 'venta') return;
      const exName = tx.walletName || 'Exchange Principal';
      if (!exchangeBreakdownMap[exName]) {
        exchangeBreakdownMap[exName] = {
          exchangeName: exName,
          operators: new Set<string>(),
          buyCount: 0,
          buyUsdt: 0,
          buyPesos: 0,
          sellCount: 0,
          sellUsdt: 0,
          sellPesos: 0,
          gain: 0,
          buyTxs: [],
          sellTxs: [],
        };
      }
      exchangeBreakdownMap[exName].operators.add(tx.operator || shift.operatorName);
      if (tx.type === 'compra') {
        exchangeBreakdownMap[exName].buyCount += 1;
        exchangeBreakdownMap[exName].buyUsdt += tx.quantity;
        exchangeBreakdownMap[exName].buyPesos += tx.totalPesos;
        exchangeBreakdownMap[exName].buyTxs.push(tx);
      } else if (tx.type === 'venta') {
        exchangeBreakdownMap[exName].sellCount += 1;
        exchangeBreakdownMap[exName].sellUsdt += tx.quantity;
        exchangeBreakdownMap[exName].sellPesos += tx.totalPesos;
        exchangeBreakdownMap[exName].gain += (tx.gain || 0);
        exchangeBreakdownMap[exName].sellTxs.push(tx);
      }
    });

    const exchangeBreakdownList = Object.values(exchangeBreakdownMap).map(ex => ({
      ...ex,
      operatorNames: Array.from(ex.operators).join(', '),
      avgBuyPrice: ex.buyUsdt > 0 ? ex.buyPesos / ex.buyUsdt : 0,
      avgSellPrice: ex.sellUsdt > 0 ? ex.sellPesos / ex.sellUsdt : 0,
    }));

    return {
      shiftTxs,
      purchaseTxs,
      salesTxs,
      combinedIncomes,
      sortedIncomes,
      firstIncome,
      lastIncome,
      totalIncomeCount,
      totalIncomeAmount,
      totalUsdtBought,
      totalPesosPurchases,
      avgBuyPrice,
      totalUsdtSold,
      totalPesosSales,
      avgSellPrice,
      totalGains,
      exchangeBreakdownList,
    };
  };

  // Stats for current active shift
  const activeShiftDetails = activeShift ? getShiftDetails(activeShift) : null;

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
          <Clock className="w-5 h-5 text-binance-yellow" />
          Cierre de Jornada y Arqueo de Caja
        </h2>
        <p className="text-xs text-binance-gray mt-1">
          Apertura y cierre diario de caja, promedios de compra/venta de USDT, control de ingresos y desglose detallado por exchange.
        </p>
      </div>

      {/* ACTIVE SHIFT STATUS OR START SHIFT (DISABLED FOR CONTADORA) */}
      {!isContadora && (
        !activeShift ? (
          <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
            <div className="flex items-center gap-2 text-binance-yellow">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-extrabold text-sm uppercase">Sin Jornada Activa</h3>
            </div>
            <p className="text-xs text-binance-gray">
              Inicie la jornada operativa para registrar el arqueo de inicio de caja y auditar el rendimiento de las operaciones del día.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                placeholder="Nombre de Operador / Responsable"
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                className="px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white text-xs outline-hidden focus:border-binance-yellow"
              />
              <button
                onClick={() => onStartShift(operatorInput.trim() || 'Operador')}
                className="px-6 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs uppercase rounded-xl hover:bg-binance-yellow/90 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Jornada de Trabajo
              </button>
            </div>
          </div>
        ) : (
          activeShiftDetails && (
            <div className="bg-binance-card border border-binance-green/40 p-6 rounded-2xl space-y-6 shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-binance-border pb-4">
                <div>
                  <span className="px-2.5 py-1 bg-binance-green/20 text-binance-green border border-binance-green/30 rounded text-[10px] font-bold uppercase tracking-wider font-mono">
                    🟢 JORNADA EN CURSO
                  </span>
                  <h3 className="text-base font-extrabold text-white mt-2">
                    Responsable: {activeShift.operatorName}
                  </h3>
                  <p className="text-xs text-binance-gray">
                    Iniciada el {safeFormatDateTime(activeShift.startTime)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setSelectedShiftForDetails(activeShift)}
                    className="px-4 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs uppercase rounded-xl hover:bg-binance-yellow/90 transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Detalles del Día
                  </button>

                  {canCloseActiveShift && (
                    <button
                      onClick={() => onEndShift(activeShift.id)}
                      className="px-5 py-2.5 bg-binance-red text-white font-black text-xs uppercase rounded-xl hover:bg-binance-red/90 transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Cerrar Jornada
                    </button>
                  )}
                </div>
              </div>

              {/* Live KPI Summary Grid including Promedios & Ingresos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Precio Promedio Compra</span>
                  <span className="text-xl font-black text-binance-red font-mono">
                    ${formatNumber(activeShiftDetails.avgBuyPrice)} <span className="text-xs text-binance-gray font-normal">ARS/USDT</span>
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    Volumen: {formatNumber(activeShiftDetails.totalUsdtBought, 0)} USDT
                  </span>
                </div>

                <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Precio Promedio Venta</span>
                  <span className="text-xl font-black text-binance-green font-mono">
                    ${formatNumber(activeShiftDetails.avgSellPrice)} <span className="text-xs text-binance-gray font-normal">ARS/USDT</span>
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    Volumen: {formatNumber(activeShiftDetails.totalUsdtSold, 0)} USDT
                  </span>
                </div>

                <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Ingresos de Fondos</span>
                  <span className="text-xl font-black text-amber-400 font-mono">
                    {formatMoney(activeShiftDetails.totalIncomeAmount)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    {activeShiftDetails.totalIncomeCount} ingresos registrados
                  </span>
                </div>

                <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Ganancia de la Jornada</span>
                  <span className="text-xl font-black text-binance-yellow font-mono">
                    {formatMoney(activeShiftDetails.totalGains)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    {activeShiftDetails.shiftTxs.length} operaciones totales
                  </span>
                </div>
              </div>
            </div>
          )
        )
      )}

      {/* SHIFT HISTORY TABLE WITH "VER DETALLES DEL DÍA" */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-binance-yellow" />
            Historial de Jornadas e Informes Diarios
          </h3>
          {(isAdmin || isContadora) && uniqueVendors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-binance-gray">Vendedor / Operador:</span>
              <select
                value={vendorFilter}
                onChange={e => setVendorFilter(e.target.value)}
                className="px-3 py-1.5 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
              >
                <option value="all">👤 Todos los Vendedores</option>
                {uniqueVendors.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-binance-gray">
            <thead className="bg-binance-black text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
              <tr>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3 text-right">Prom. Compra</th>
                <th className="px-4 py-3 text-right">Prom. Venta</th>
                <th className="px-4 py-3 text-right">Ingresos ARS</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-binance-border/40 font-mono">
              {filteredShifts.map((s, idx) => {
                const sDetails = getShiftDetails(s);

                return (
                  <tr key={s.id || `shift-${idx}`} className="hover:bg-binance-black/40">
                    <td className="px-4 py-3 text-white font-medium">{safeFormatDateTime(s.startTime)}</td>
                    <td className="px-4 py-3 text-white">{s.endTime ? safeFormatDateTime(s.endTime) : 'En progreso...'}</td>
                    <td className="px-4 py-3 font-bold text-white">{s.operatorName}</td>
                    <td className="px-4 py-3 text-right font-bold text-binance-red">
                      ${formatNumber(sDetails.avgBuyPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-binance-green">
                      ${formatNumber(sDetails.avgSellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-400">
                      {formatMoney(sDetails.totalIncomeAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.endTime ? 'bg-binance-card text-binance-gray border border-binance-border' : 'bg-binance-green/20 text-binance-green border border-binance-green/30'
                      }`}>
                        {s.endTime ? 'Cerrada' : 'Activa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedShiftForDetails(s)}
                        className="px-3 py-1 bg-binance-yellow/20 hover:bg-binance-yellow/30 text-binance-yellow border border-binance-yellow/40 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                );
              })}

              {shifts.length === 0 && (
                <tr key="empty-shifts-row">
                  <td colSpan={8} className="text-center py-6 text-binance-gray italic">
                    Sin jornadas registradas previamente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: VER DETALLES DEL DÍA */}
      {selectedShiftForDetails && (() => {
        const modalDetails = getShiftDetails(selectedShiftForDetails);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-binance-dark border border-binance-yellow/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl font-mono text-binance-light">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-binance-border pb-4">
                <div>
                  <span className="px-2.5 py-0.5 bg-binance-yellow/20 text-binance-yellow border border-binance-yellow/40 rounded text-[10px] font-bold uppercase tracking-wider">
                    📋 REPORTE DETALLADO DE JORNADA
                  </span>
                  <h2 className="text-xl font-extrabold text-white mt-1.5 flex items-center gap-2">
                    Operador: {selectedShiftForDetails.operatorName}
                  </h2>
                  <p className="text-xs text-binance-gray mt-0.5">
                    Inicio: {safeFormatDateTime(selectedShiftForDetails.startTime)}
                    {selectedShiftForDetails.endTime && ` — Fin: ${safeFormatDateTime(selectedShiftForDetails.endTime)}`}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedShiftForDetails(null)}
                  className="p-2 rounded-xl bg-binance-black hover:bg-binance-card text-binance-gray hover:text-white border border-binance-border cursor-pointer transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* General Metrics & Averages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-binance-black p-3.5 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Promedio Compra USDT</span>
                  <span className="text-lg font-black text-binance-red">
                    ${formatNumber(modalDetails.avgBuyPrice)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    Total: {formatNumber(modalDetails.totalUsdtBought, 2)} USDT (${formatMoney(modalDetails.totalPesosPurchases)})
                  </span>
                </div>

                <div className="bg-binance-black p-3.5 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Promedio Venta USDT</span>
                  <span className="text-lg font-black text-binance-green">
                    ${formatNumber(modalDetails.avgSellPrice)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    Total: {formatNumber(modalDetails.totalUsdtSold, 2)} USDT (${formatMoney(modalDetails.totalPesosSales)})
                  </span>
                </div>

                <div className="bg-binance-black p-3.5 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Ingresos Realizados</span>
                  <span className="text-lg font-black text-amber-400">
                    {formatMoney(modalDetails.totalIncomeAmount)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    {modalDetails.totalIncomeCount} operaciones de ingreso
                  </span>
                </div>

                <div className="bg-binance-black p-3.5 rounded-xl border border-binance-border space-y-1">
                  <span className="text-[10px] text-binance-gray font-bold uppercase block">Ganancia del Día</span>
                  <span className="text-lg font-black text-binance-yellow">
                    {formatMoney(modalDetails.totalGains)}
                  </span>
                  <span className="text-[10px] text-binance-gray block">
                    Spread Promedio: ${formatNumber(Math.max(0, modalDetails.avgSellPrice - modalDetails.avgBuyPrice))}
                  </span>
                </div>
              </div>

              {/* SECCION 1: DETALLE DE INGRESOS REALIZADOS */}
              <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    Detalle de Ingresos de Fondos Realizados ({modalDetails.totalIncomeCount})
                  </h3>
                  <span className="text-xs font-bold text-white">
                    Total Ingresado: {formatMoney(modalDetails.totalIncomeAmount)}
                  </span>
                </div>

                {/* TARJETAS PRIMER Y ÚLTIMO INGRESO DEL DÍA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Primer Ingreso del día */}
                  <div className="bg-binance-card p-3.5 rounded-xl border border-binance-yellow/40 space-y-2">
                    <div className="flex justify-between items-center border-b border-binance-border/60 pb-1.5">
                      <span className="text-[11px] font-extrabold text-binance-yellow uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        🚀 Primer Ingreso del día
                      </span>
                      {modalDetails.firstIncome && (
                        <span className="text-[9px] bg-binance-yellow/20 text-binance-yellow font-bold px-2 py-0.5 rounded font-mono">
                          {modalDetails.firstIncome.timeString || safeFormatTime(modalDetails.firstIncome.timestamp)}
                        </span>
                      )}
                    </div>
                    {modalDetails.firstIncome ? (
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Monto:</span>
                          <span className="font-extrabold text-binance-green text-sm block">
                            {formatMoney(modalDetails.firstIncome.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Fecha/Hora:</span>
                          <span className="font-bold text-white text-xs block">
                            {modalDetails.firstIncome.dateString || safeFormatDate(modalDetails.firstIncome.timestamp) || '—'} {modalDetails.firstIncome.timeString || safeFormatTime(modalDetails.firstIncome.timestamp) || ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Titular:</span>
                          <span className="font-bold text-white text-xs block truncate">
                            {modalDetails.firstIncome.operator}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Billetera:</span>
                          <span className="font-bold text-binance-yellow text-xs block truncate">
                            {modalDetails.firstIncome.walletOrExchangeName}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-binance-gray italic font-mono py-1">Sin ingresos registrados</p>
                    )}
                  </div>

                  {/* Último Ingreso del día */}
                  <div className="bg-binance-card p-3.5 rounded-xl border border-amber-500/40 space-y-2">
                    <div className="flex justify-between items-center border-b border-binance-border/60 pb-1.5">
                      <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                        🏁 Último Ingreso del día
                      </span>
                      {modalDetails.lastIncome && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded font-mono">
                          {modalDetails.lastIncome.timeString || safeFormatTime(modalDetails.lastIncome.timestamp)}
                        </span>
                      )}
                    </div>
                    {modalDetails.lastIncome ? (
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Monto:</span>
                          <span className="font-extrabold text-binance-green text-sm block">
                            {formatMoney(modalDetails.lastIncome.amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Fecha/Hora:</span>
                          <span className="font-bold text-white text-xs block">
                            {modalDetails.lastIncome.dateString || safeFormatDate(modalDetails.lastIncome.timestamp) || '—'} {modalDetails.lastIncome.timeString || safeFormatTime(modalDetails.lastIncome.timestamp) || ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Titular:</span>
                          <span className="font-bold text-white text-xs block truncate">
                            {modalDetails.lastIncome.operator}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-binance-gray uppercase font-bold block">Billetera:</span>
                          <span className="font-bold text-binance-yellow text-xs block truncate">
                            {modalDetails.lastIncome.walletOrExchangeName}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-binance-gray italic font-mono py-1">Sin ingresos registrados</p>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-binance-gray">
                    <thead className="bg-binance-card text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
                      <tr>
                        <th className="px-3 py-2">Fecha y Hora</th>
                        <th className="px-3 py-2">Quién Fue (Operador)</th>
                        <th className="px-3 py-2 text-right">Monto Ingresado</th>
                        <th className="px-3 py-2">Billetera / Destino</th>
                        <th className="px-3 py-2">Detalle / Origen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-binance-border/30">
                      {modalDetails.sortedIncomes.map((inc, idx) => (
                        <tr key={inc.id ? `inc-${inc.id}` : `inc-idx-${idx}`} className="hover:bg-binance-card/50">
                          <td className="px-3 py-2 text-white font-mono">
                            <span className="block font-bold text-white text-xs">{inc.dateString || safeFormatDate(inc.timestamp) || '—'}</span>
                            <span className="text-[10px] text-binance-gray block font-mono">{inc.timeString || safeFormatTime(inc.timestamp)}</span>
                          </td>
                          <td className="px-3 py-2 font-bold text-white">{inc.operator}</td>
                          <td className="px-3 py-2 text-right font-black text-binance-green">
                            {formatMoney(inc.amount)}
                          </td>
                          <td className="px-3 py-2 text-binance-yellow font-bold">{inc.walletOrExchangeName}</td>
                          <td className="px-3 py-2 text-binance-gray text-[11px]">{inc.note}</td>
                        </tr>
                      ))}

                      {modalDetails.sortedIncomes.length === 0 && (
                        <tr key="empty-incomes-modal">
                          <td colSpan={5} className="text-center py-4 text-binance-gray italic">
                            No se registraron ingresos de fondos en esta jornada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECCION 2: DETALLE POR EXCHANGE (COMPRAS, VENTAS Y PRECIOS PROMEDIO) */}
              <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="text-xs font-black text-binance-yellow uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-4 h-4 text-binance-yellow" />
                    Detalle por Exchange: Compras, Ventas y Precios Promedio
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-bold font-mono">
                    <span className="text-binance-red">Compras: {formatNumber(modalDetails.totalUsdtBought, 2)} USDT</span>
                    <span className="text-binance-green">Ventas: {formatNumber(modalDetails.totalUsdtSold, 2)} USDT</span>
                  </div>
                </div>

                {/* Cards per Exchange */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modalDetails.exchangeBreakdownList.map(ex => (
                    <div key={ex.exchangeName} className="bg-binance-card p-4 rounded-xl border border-binance-border space-y-3">
                      <div className="flex justify-between items-start border-b border-binance-border/40 pb-2">
                        <div>
                          <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-binance-yellow" />
                            {ex.exchangeName}
                          </h4>
                          <span className="text-[10px] text-binance-gray block">
                            Operador(es): <strong className="text-white">{ex.operatorNames}</strong>
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {ex.buyCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-binance-black text-binance-red border border-binance-red/30">
                              {ex.buyCount} compras
                            </span>
                          )}
                          {ex.sellCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-binance-black text-binance-green border border-binance-green/30">
                              {ex.sellCount} ventas
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compras Block */}
                      <div className="bg-binance-black/60 p-2.5 rounded-lg border border-binance-border/60 space-y-1.5">
                        <span className="text-[10px] font-extrabold text-binance-red uppercase tracking-wider block">
                          🟢 Compras Realizadas
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-binance-gray uppercase block">Comprado</span>
                            <span className="font-black text-binance-red">{formatNumber(ex.buyUsdt, 2)} USDT</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-binance-gray uppercase block">Promedio Compra</span>
                            <span className="font-black text-binance-yellow">${formatNumber(ex.avgBuyPrice)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-binance-gray uppercase block">Total Invertido</span>
                            <span className="font-black text-white">{formatMoney(ex.buyPesos)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ventas Block */}
                      <div className="bg-binance-black/60 p-2.5 rounded-lg border border-binance-border/60 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-binance-green uppercase tracking-wider block">
                            🔴 Ventas Realizadas
                          </span>
                          {ex.gain !== 0 && (
                            <span className={`text-[10px] font-bold ${ex.gain >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
                              Ganancia: {formatMoney(ex.gain)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-binance-gray uppercase block">Vendido</span>
                            <span className="font-black text-binance-green">{formatNumber(ex.sellUsdt, 2)} USDT</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-binance-gray uppercase block">Promedio Venta</span>
                            <span className="font-black text-binance-yellow">${formatNumber(ex.avgSellPrice)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-binance-gray uppercase block">Total Recaudado</span>
                            <span className="font-black text-white">{formatMoney(ex.sellPesos)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {modalDetails.exchangeBreakdownList.length === 0 && (
                    <div className="col-span-2 p-6 text-center text-binance-gray italic text-xs bg-binance-card rounded-xl">
                      No se registraron operaciones de compra o venta en exchanges durante esta jornada.
                    </div>
                  )}
                </div>

                {/* Table view of individual purchase transactions */}
                {modalDetails.purchaseTxs.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[11px] font-bold text-binance-red block uppercase flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Desglose individual de transacciones de compra:
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-binance-gray">
                        <thead className="bg-binance-card text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
                          <tr>
                            <th className="px-3 py-2">Fecha y Hora</th>
                            <th className="px-3 py-2">Quién Compró</th>
                            <th className="px-3 py-2">Exchange</th>
                            <th className="px-3 py-2 text-right">Cantidad USDT</th>
                            <th className="px-3 py-2 text-right">Precio Unitario</th>
                            <th className="px-3 py-2 text-right">Total Pesos</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-binance-border/30">
                          {modalDetails.purchaseTxs.map((tx, idx) => (
                            <tr key={tx.id ? `tx-buy-${tx.id}` : `tx-buy-idx-${idx}`} className="hover:bg-binance-card/50">
                              <td className="px-3 py-2 text-white font-mono">
                                <span className="block font-bold text-white text-xs">{tx.dateString || safeFormatDate(tx.timestamp) || '—'}</span>
                                <span className="text-[10px] text-binance-gray block font-mono">{tx.timeString || safeFormatTime(tx.timestamp)}</span>
                              </td>
                              <td className="px-3 py-2 font-bold text-white">{tx.operator}</td>
                              <td className="px-3 py-2 text-binance-yellow font-bold">{tx.walletName}</td>
                              <td className="px-3 py-2 text-right font-bold text-binance-red">{formatNumber(tx.quantity, 2)} USDT</td>
                              <td className="px-3 py-2 text-right font-bold text-white">${formatNumber(tx.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-black text-white">{formatMoney(tx.totalPesos)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Table view of individual sales transactions */}
                {modalDetails.salesTxs.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    <span className="text-[11px] font-bold text-binance-green block uppercase flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Desglose individual de transacciones de venta:
                    </span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-binance-gray">
                        <thead className="bg-binance-card text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
                          <tr>
                            <th className="px-3 py-2">Fecha y Hora</th>
                            <th className="px-3 py-2">Quién Vendió</th>
                            <th className="px-3 py-2">Exchange / Billetera</th>
                            <th className="px-3 py-2 text-right">Cantidad USDT</th>
                            <th className="px-3 py-2 text-right">Precio Unitario</th>
                            <th className="px-3 py-2 text-right">Total Pesos</th>
                            <th className="px-3 py-2 text-right">Ganancia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-binance-border/30">
                          {modalDetails.salesTxs.map((tx, idx) => (
                            <tr key={tx.id ? `tx-sell-${tx.id}` : `tx-sell-idx-${idx}`} className="hover:bg-binance-card/50">
                              <td className="px-3 py-2 text-white font-mono">
                                <span className="block font-bold text-white text-xs">{tx.dateString || safeFormatDate(tx.timestamp) || '—'}</span>
                                <span className="text-[10px] text-binance-gray block font-mono">{tx.timeString || safeFormatTime(tx.timestamp)}</span>
                              </td>
                              <td className="px-3 py-2 font-bold text-white">{tx.operator}</td>
                              <td className="px-3 py-2 text-binance-yellow font-bold">{tx.walletName}</td>
                              <td className="px-3 py-2 text-right font-bold text-binance-green">{formatNumber(tx.quantity, 2)} USDT</td>
                              <td className="px-3 py-2 text-right font-bold text-white">${formatNumber(tx.unitPrice)}</td>
                              <td className="px-3 py-2 text-right font-black text-white">{formatMoney(tx.totalPesos)}</td>
                              <td className={`px-3 py-2 text-right font-black ${(tx.gain || 0) >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
                                {formatMoney(tx.gain || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-2 border-t border-binance-border">
                <button
                  onClick={() => setSelectedShiftForDetails(null)}
                  className="px-6 py-2.5 bg-binance-yellow text-binance-black font-extrabold text-xs uppercase rounded-xl hover:bg-binance-yellow/90 cursor-pointer transition-all shadow-md"
                >
                  Cerrar Detalles
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

