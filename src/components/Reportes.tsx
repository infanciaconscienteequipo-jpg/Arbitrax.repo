import React, { useState } from 'react';
import { Transaction, User, IncomeExpenseRecord, Shift } from '../types';
import { BarChart3, Calendar, Award, TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownLeft, ShieldCheck, Clock, CircleAlert, Coins, ShoppingBag, Receipt, ArrowRightLeft } from 'lucide-react';

interface ReportesProps {
  transactions: Transaction[];
  incomeExpenses: IncomeExpenseRecord[];
  users: User[];
  currentUser: User | null;
  activeShiftId?: string | null;
  activeShift?: Shift | null;
}

export default function Reportes({
  transactions,
  incomeExpenses,
  users,
  currentUser,
  activeShiftId,
  activeShift,
}: ReportesProps) {
  const [timeframe, setTimeframe] = useState<'shift' | 'all' | 'today' | 'month' | 'year' | 'custom'>('today');
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  // Custom date and time range states
  const [customStartDate, setCustomStartDate] = useState('');
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  const currentOrgId = currentUser?.organization_id || '';
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isVendedor = currentUser?.role === 'VENDEDOR';

  // Solo vendedores activos y existentes de la organización actual.
  const activeVendorUsers = users.filter(u =>
    u.active !== false &&
    u.status === 'active' &&
    (u.role || '').toUpperCase() === 'VENDEDOR' &&
    u.organization_id === currentOrgId
  );

  // Helper to test if a record belongs to the active shift
  const isRecordInActiveShift = (
    item: { shiftId?: string; timestamp?: string; dateString?: string; timeString?: string }
  ): boolean => {
    if (!activeShiftId) return false;
    if (item.shiftId) {
      return item.shiftId === activeShiftId;
    }
    if (activeShift?.startTime) {
      const shiftStartD = new Date(activeShift.startTime).getTime();
      if (isNaN(shiftStartD)) return false;
      const shiftEndD = activeShift.endTime ? new Date(activeShift.endTime).getTime() : Date.now() + 86400000;
      const itemD = item.timestamp ? new Date(item.timestamp) : null;
      if (itemD && !isNaN(itemD.getTime())) {
        const itemTime = itemD.getTime();
        return itemTime >= shiftStartD && itemTime <= shiftEndD;
      }
    }
    return false;
  };

  // Helper to safely get a Date object for a transaction or record
  const getRecordDate = (item: { timestamp?: string; dateString?: string; timeString?: string }): Date | null => {
    if (item.timestamp) {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (item.dateString) {
      const timeStr = item.timeString || '12:00:00';
      const d = new Date(`${item.dateString}T${timeStr}`);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Filter transactions by org and timeframe
  const filteredTxs = transactions.filter(t => {
    if (isVendedor && currentUser) {
      const uName = currentUser.name?.toLowerCase() || '';
      const uUsername = currentUser.username?.toLowerCase() || '';
      if (!t.operator.toLowerCase().includes(uName) && !t.operator.toLowerCase().includes(uUsername)) {
        return false;
      }
    } else if (vendorFilter !== 'all') {
      const vendor = activeVendorUsers.find(u => (u.id || '') === vendorFilter);
      if (!vendor) return false;
      if (t.sellerId) {
        if (t.sellerId !== vendor.id) return false;
      } else {
        const op = (t.operator || '').toLowerCase();
        if (op !== (vendor.name || '').toLowerCase() && op !== (vendor.username || '').toLowerCase()) return false;
      }
    }

    if (timeframe === 'shift') {
      return isRecordInActiveShift(t);
    }

    const tDate = getRecordDate(t);
    const now = new Date();

    if (timeframe === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      const tStr = t.dateString || (t.timestamp ? t.timestamp.split('T')[0] : '');
      if (tStr !== todayStr) return false;
    } else if (timeframe === 'month') {
      if (!tDate || tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
    } else if (timeframe === 'year') {
      if (!tDate || tDate.getFullYear() !== now.getFullYear()) return false;
    } else if (timeframe === 'custom') {
      if (!tDate) return false;
      const txMs = tDate.getTime();

      // Lower bound check (Fecha + Hora desde)
      if (customStartDate) {
        const timePart = customStartTime ? customStartTime : '00:00';
        const startMs = new Date(`${customStartDate}T${timePart}:00`).getTime();
        if (!isNaN(startMs) && txMs < startMs) return false;
      } else if (customStartTime) {
        const [sH, sM] = customStartTime.split(':').map(Number);
        const txMinutes = tDate.getHours() * 60 + tDate.getMinutes();
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
        const txMinutes = tDate.getHours() * 60 + tDate.getMinutes();
        const endMinutes = (eH || 0) * 60 + (eM || 0);
        if (txMinutes > endMinutes) return false;
      }
    }

    return true;
  });

  // Filter income records
  const filteredIncomes = incomeExpenses.filter(r => {
    if (r.organization_id && r.organization_id !== currentOrgId) return false;
    if (r.type !== 'ingreso') return false;

    if (isVendedor && currentUser) {
      const uName = currentUser.name?.toLowerCase() || '';
      const uUsername = currentUser.username?.toLowerCase() || '';
      const matchPerson = r.transferPerson?.toLowerCase().includes(uName) || r.transferPerson?.toLowerCase().includes(uUsername);
      const matchWallet = r.walletOrExchangeName?.toLowerCase().includes(uName) || r.walletOrExchangeName?.toLowerCase().includes(uUsername);
      const matchOperator = r.operator?.toLowerCase().includes(uName) || r.operator?.toLowerCase().includes(uUsername);
      if (!matchPerson && !matchWallet && !matchOperator) return false;
    } else if (vendorFilter !== 'all') {
      const vendor = activeVendorUsers.find(u => (u.id || '') === vendorFilter);
      if (!vendor) return false;
      if (r.vendorId) {
        if (r.vendorId !== vendor.id) return false;
      } else {
        const vLower = (vendor.name || vendor.username || '').toLowerCase();
        const matchPerson = r.transferPerson?.toLowerCase().includes(vLower);
        const matchWallet = r.walletOrExchangeName?.toLowerCase().includes(vLower);
        if (!matchPerson && !matchWallet) return false;
      }
    }

    if (timeframe === 'shift') {
      return isRecordInActiveShift(r);
    }

    const rDate = getRecordDate(r);
    const now = new Date();

    if (timeframe === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      const rStr = r.dateString || (r.timestamp ? r.timestamp.split('T')[0] : '');
      if (rStr !== todayStr) return false;
    } else if (timeframe === 'month') {
      if (!rDate || rDate.getMonth() !== now.getMonth() || rDate.getFullYear() !== now.getFullYear()) return false;
    } else if (timeframe === 'year') {
      if (!rDate || rDate.getFullYear() !== now.getFullYear()) return false;
    } else if (timeframe === 'custom') {
      if (!rDate) return false;
      const rMs = rDate.getTime();

      if (customStartDate) {
        const timePart = customStartTime ? customStartTime : '00:00';
        const startMs = new Date(`${customStartDate}T${timePart}:00`).getTime();
        if (!isNaN(startMs) && rMs < startMs) return false;
      } else if (customStartTime) {
        const [sH, sM] = customStartTime.split(':').map(Number);
        const rMinutes = rDate.getHours() * 60 + rDate.getMinutes();
        const startMinutes = (sH || 0) * 60 + (sM || 0);
        if (rMinutes < startMinutes) return false;
      }

      if (customEndDate) {
        const timePart = customEndTime ? customEndTime : '23:59';
        const endMs = new Date(`${customEndDate}T${timePart}:59`).getTime();
        if (!isNaN(endMs) && rMs > endMs) return false;
      } else if (customEndTime) {
        const [eH, eM] = customEndTime.split(':').map(Number);
        const rMinutes = rDate.getHours() * 60 + rDate.getMinutes();
        const endMinutes = (eH || 0) * 60 + (eM || 0);
        if (rMinutes > endMinutes) return false;
      }
    }

    return true;
  });

  // 1. Capital total de pesos ingresados
  const totalPesosIngresados = filteredIncomes.reduce((sum, r) => sum + r.amount, 0);

  // 2. Ventas Metrics
  const ventasTxs = filteredTxs.filter(t => t.type === 'venta');
  const ventasCount = ventasTxs.length;
  const totalUsdtVendidos = ventasTxs.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const totalPesosRecibidosVentas = ventasTxs.reduce((sum, t) => sum + (t.totalPesos || 0), 0);
  const totalGananciasAcumuladas = ventasTxs.reduce((sum, t) => sum + (t.gain || 0), 0);
  const precioPromedioVenta = totalUsdtVendidos > 0 ? totalPesosRecibidosVentas / totalUsdtVendidos : 0;

  // 3. Compras Metrics
  const comprasTxs = filteredTxs.filter(t => t.type === 'compra');
  const comprasCount = comprasTxs.length;
  const totalUsdtComprados = comprasTxs.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const totalPesosPagadosCompras = comprasTxs.reduce((sum, t) => sum + (t.totalPesos || 0), 0);
  const precioPromedioCompra = totalUsdtComprados > 0 ? totalPesosPagadosCompras / totalUsdtComprados : 0;

  // 4. Rankings de Mejores Precios
  const salesWithPrice = ventasTxs.filter(t => t.unitPrice > 0);
  const bestSalesRanking = [...salesWithPrice].sort((a, b) => b.unitPrice - a.unitPrice).slice(0, 5);

  const buysWithPrice = comprasTxs.filter(t => t.unitPrice > 0);
  const bestBuysRanking = [...buysWithPrice].sort((a, b) => a.unitPrice - b.unitPrice).slice(0, 5);

  // 5. Vendedores con más operaciones
  const vendorOpsMap: Record<string, { count: number; volume: number; gains: number }> = {};
  filteredTxs.forEach(t => {
    const op = t.operator || 'Desconocido';
    if (!vendorOpsMap[op]) {
      vendorOpsMap[op] = { count: 0, volume: 0, gains: 0 };
    }
    vendorOpsMap[op].count += 1;
    vendorOpsMap[op].volume += t.totalPesos;
    if (t.type === 'venta' && t.gain) {
      vendorOpsMap[op].gains += t.gain;
    }
  });

  const vendorRanking = Object.entries(vendorOpsMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);

  const topVendor = vendorRanking.length > 0 ? vendorRanking[0] : null;

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatUsdt = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER & TIMEFRAME SELECTOR */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2 font-display">
              <BarChart3 className="w-6 h-6 text-binance-yellow" />
              Métricas Avanzadas y Reportes de Rendimiento
            </h2>
            <p className="text-xs text-binance-gray mt-1">
              Desglose detallado de ventas, compras, capitales ingresados y ránking de desempeño.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-binance-gray">Vendedor:</span>
                <select
                  value={vendorFilter}
                  onChange={e => setVendorFilter(e.target.value)}
                  className="px-3 py-2 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
                >
                  <option value="all">👤 Todos los Vendedores</option>
                  {activeVendorUsers.map(v => (
                    <option key={v.id} value={v.id}>{v.name || v.username} (@{v.username})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-binance-gray flex items-center gap-1">
                <Calendar className="w-4 h-4 text-binance-yellow" /> Período:
              </span>
              <select
                value={timeframe}
                onChange={e => setTimeframe(e.target.value as any)}
                className="px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
              >
                <option value="shift">⚡ Turno Activo Actual</option>
                <option value="today">Hoy</option>
                <option value="month">Este Mes</option>
                <option value="year">Este Año</option>
                <option value="all">Histórico Completo</option>
                <option value="custom">📅 Rango Fecha/Hora Personalizado</option>
              </select>
            </div>
          </div>
        </div>

        {/* CUSTOM DATE & TIME FILTER PANEL */}
        {timeframe === 'custom' && (
          <div className="bg-binance-black p-4 rounded-xl border border-binance-yellow/40 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-binance-border pb-2">
              <span className="font-bold text-binance-yellow flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-4 h-4" /> Filtrar Reporte por Fecha y Hora Específica
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

        {/* TOP KPI METRICS SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Capital Pesos Ingresados */}
          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border space-y-1">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Total Pesos Ingresados
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {formatMoney(totalPesosIngresados)}
            </div>
            <span className="text-[10px] text-binance-gray block">Inyecciones / cargas de capital</span>
          </div>

          {/* Total Operaciones */}
          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border space-y-1">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Total Operaciones
            </span>
            <div className="text-2xl font-black text-white font-mono">
              {filteredTxs.length} <span className="text-xs font-normal text-binance-gray">ops</span>
            </div>
            <span className="text-[10px] text-binance-gray block">
              {comprasCount} compras • {ventasCount} ventas
            </span>
          </div>

          {/* Ganancias Acumuladas */}
          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border space-y-1">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Ganancias Totales Arbitraje
            </span>
            <div className="text-2xl font-black text-binance-green font-mono">
              {formatMoney(totalGananciasAcumuladas)}
            </div>
            <span className="text-[10px] text-binance-gray block">Ganancia neta acumulada</span>
          </div>

          {/* Top Vendedor */}
          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border space-y-1">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Vendedor Destacado
            </span>
            <div className="text-lg font-extrabold text-white truncate">
              {topVendor ? topVendor.name : 'N/A'}
            </div>
            <span className="text-[10px] text-binance-yellow block">
              {topVendor ? `${topVendor.count} ops | Vol: ${formatMoney(topVendor.volume)}` : 'Sin operaciones'}
            </span>
          </div>
        </div>
      </div>

      {/* DETAILED VENTAS & COMPRAS REPORTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* REPORTE DE VENTAS */}
        <div className="bg-binance-card border border-binance-green/30 p-6 rounded-2xl space-y-4 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-binance-border pb-3">
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-binance-green" />
              Reporte de Ventas
            </h3>
            <span className="text-xs bg-binance-green/10 border border-binance-green/30 text-binance-green px-2.5 py-1 rounded-lg font-bold">
              {ventasCount} Operaciones
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Total USDT Vendidos
              </span>
              <span className="text-2xl font-extrabold text-binance-green block">
                {formatUsdt(totalUsdtVendidos)} <span className="text-xs font-bold text-white">USDT</span>
              </span>
              <span className="text-[10px] text-binance-gray block">Monto total en cripto entregado</span>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Pesos Recibidos (ARS)
              </span>
              <span className="text-2xl font-extrabold text-white block">
                {formatMoney(totalPesosRecibidosVentas)}
              </span>
              <span className="text-[10px] text-binance-gray block">Capital bruto cobrado</span>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Precio Promedio de Venta
              </span>
              <span className="text-lg font-bold text-amber-400 block">
                {precioPromedioVenta > 0 ? `${formatMoney(precioPromedioVenta)} / USDT` : '$0 / USDT'}
              </span>
              <span className="text-[10px] text-binance-gray block">Promedio ponderado</span>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Ganancia Generada Ventas
              </span>
              <span className="text-lg font-bold text-binance-green block">
                {formatMoney(totalGananciasAcumuladas)}
              </span>
              <span className="text-[10px] text-binance-gray block">Ganancia neta total</span>
            </div>
          </div>
        </div>

        {/* REPORTE DE COMPRAS */}
        <div className="bg-binance-card border border-binance-red/30 p-6 rounded-2xl space-y-4 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-binance-border pb-3">
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-binance-red" />
              Reporte de Compras
            </h3>
            <span className="text-xs bg-binance-red/10 border border-binance-red/30 text-binance-red px-2.5 py-1 rounded-lg font-bold">
              {comprasCount} Operaciones
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Total USDT Comprados
              </span>
              <span className="text-2xl font-extrabold text-binance-red block">
                {formatUsdt(totalUsdtComprados)} <span className="text-xs font-bold text-white">USDT</span>
              </span>
              <span className="text-[10px] text-binance-gray block">Monto total en cripto adquirido</span>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Pesos Pagados (ARS)
              </span>
              <span className="text-2xl font-extrabold text-white block">
                {formatMoney(totalPesosPagadosCompras)}
              </span>
              <span className="text-[10px] text-binance-gray block">Capital invertido en compras</span>
            </div>

            <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-1 col-span-1 sm:col-span-2">
              <span className="text-[10px] text-binance-gray font-bold uppercase block">
                Precio Promedio de Compra
              </span>
              <span className="text-lg font-bold text-amber-400 block">
                {precioPromedioCompra > 0 ? `${formatMoney(precioPromedioCompra)} / USDT` : '$0 / USDT'}
              </span>
              <span className="text-[10px] text-binance-gray block">Costo unitario ponderado por USDT</span>
            </div>
          </div>
        </div>

      </div>

      {/* RANKINGS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* RANKING MEJORES PRECIOS DE VENTA */}
        <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Award className="w-5 h-5 text-binance-green" />
            Ranking: Mejores Precios Obtenidos de Venta
          </h3>

          <div className="space-y-3">
            {bestSalesRanking.map((t, idx) => (
              <div key={t.id} className="p-3 bg-binance-black rounded-xl border border-binance-border flex justify-between items-center text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-binance-green/20 text-binance-green border border-binance-green/30 rounded-full flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-white block">{t.operator}</span>
                    <span className="text-[10px] text-binance-gray block font-mono">{t.dateString} {t.timeString} • {t.walletName}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-binance-green font-mono block">
                    {formatMoney(t.unitPrice)}
                  </span>
                  <span className="text-[10px] text-binance-gray font-mono block">{t.quantity} {t.crypto}</span>
                </div>
              </div>
            ))}

            {bestSalesRanking.length === 0 && (
              <p className="text-xs text-binance-gray italic text-center py-6">No hay registros de ventas en este período.</p>
            )}
          </div>
        </div>

        {/* RANKING MEJORES PRECIOS DE COMPRA */}
        <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Award className="w-5 h-5 text-binance-red" />
            Ranking: Mejores Precios Obtenidos de Compra
          </h3>

          <div className="space-y-3">
            {bestBuysRanking.map((t, idx) => (
              <div key={t.id} className="p-3 bg-binance-black rounded-xl border border-binance-border flex justify-between items-center text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-binance-red/20 text-binance-red border border-binance-red/30 rounded-full flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-white block">{t.operator}</span>
                    <span className="text-[10px] text-binance-gray block font-mono">{t.dateString} {t.timeString} • {t.walletName}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-binance-red font-mono block">
                    {formatMoney(t.unitPrice)}
                  </span>
                  <span className="text-[10px] text-binance-gray font-mono block">{t.quantity} {t.crypto}</span>
                </div>
              </div>
            ))}

            {bestBuysRanking.length === 0 && (
              <p className="text-xs text-binance-gray italic text-center py-6">No hay registros de compras en este período.</p>
            )}
          </div>
        </div>

      </div>

      {/* RANKING VENDEDORES TABLA */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Users className="w-5 h-5 text-binance-yellow" />
          Ranking Global de Vendedores por Operaciones
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-binance-gray">
            <thead className="bg-binance-black text-binance-gray font-extrabold uppercase tracking-wider border-b border-binance-border">
              <tr>
                <th className="px-6 py-3">Posición</th>
                <th className="px-6 py-3">Vendedor / Operador</th>
                <th className="px-6 py-3 text-center">Cant. Operaciones</th>
                <th className="px-6 py-3 text-right">Volumen Operado (ARS)</th>
                <th className="px-6 py-3 text-right text-binance-green">Ganancia Generada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-binance-border/40 font-mono">
              {vendorRanking.map((v, idx) => (
                <tr key={v.name} className="hover:bg-binance-black/40">
                  <td className="px-6 py-3 font-bold text-amber-400">#{idx + 1}</td>
                  <td className="px-6 py-3 font-bold text-white">{v.name}</td>
                  <td className="px-6 py-3 text-center text-white font-extrabold">{v.count} ops</td>
                  <td className="px-6 py-3 text-right text-white font-bold">{formatMoney(v.volume)}</td>
                  <td className="px-6 py-3 text-right text-binance-green font-black">{formatMoney(v.gains)}</td>
                </tr>
              ))}

              {vendorRanking.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-binance-gray">
                    Sin estadísticas de vendedores en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

