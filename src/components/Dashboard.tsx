import React, { useState } from 'react';
import { Wallet, Transaction, ExchangeAccount, User, IncomeExpenseRecord, Shift } from '../types';
import { calculateAverageBuyPrice } from '../utils/dataStore';
import { Landmark, TrendingUp, BarChart3, Coins, Receipt, CalendarCheck, Award, ArrowUpRight, ArrowDownLeft, ShieldCheck, UserCheck, Layers, Cpu, Play, CircleAlert, Clock } from 'lucide-react';

interface DashboardProps {
  wallets: Wallet[];
  exchanges?: ExchangeAccount[];
  transactions: Transaction[];
  incomeExpenses?: IncomeExpenseRecord[];
  activeShiftId?: string | null;
  activeShift?: Shift | null;
  currentUser?: User | null;
  users?: User[];
  onSelectTab: (tab: string) => void;
}

export default function Dashboard({
  wallets,
  exchanges = [],
  transactions,
  incomeExpenses = [],
  activeShiftId,
  activeShift,
  currentUser,
  users = [],
  onSelectTab,
}: DashboardProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const currentOrgId = currentUser?.organization_id || 'org-1';

  // Helper to determine if a record belongs to the currently active shift
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

  // Get Vendors in Org
  const vendorsInOrg = users.filter(u => u.organization_id === currentOrgId && (u.role === 'VENDEDOR' || u.role === 'vendedor'));

  // Filter Wallets and Exchanges
  const filteredWallets = wallets.filter(w => {
    if (w.organization_id && w.organization_id !== currentOrgId) return false;
    if (!isAdmin && currentUser?.id) {
      return w.vendorId === currentUser.id;
    }
    if (selectedVendorFilter !== 'all') {
      return w.vendorId === selectedVendorFilter;
    }
    return true;
  });

  const filteredExchanges = exchanges.filter(ex => {
    if (ex.organization_id && ex.organization_id !== currentOrgId) return false;
    if (!isAdmin && currentUser?.id) {
      return ex.vendorId === currentUser.id;
    }
    if (selectedVendorFilter !== 'all') {
      return ex.vendorId === selectedVendorFilter;
    }
    return true;
  });

  // Filter transactions belonging to active shift
  const activeShiftTransactions = transactions.filter(t => isRecordInActiveShift(t));

  const filteredTransactions = activeShiftTransactions.filter(t => {
    if (!isAdmin && currentUser?.name) {
      return t.operator.toLowerCase().includes(currentUser.name.toLowerCase()) || (currentUser.username && t.operator.toLowerCase().includes(currentUser.username.toLowerCase()));
    }
    if (selectedVendorFilter !== 'all') {
      const vObj = users.find(u => u.id === selectedVendorFilter);
      if (vObj) {
        return t.operator.toLowerCase().includes(vObj.name.toLowerCase()) || t.operator.toLowerCase().includes(vObj.username.toLowerCase());
      }
    }
    return true;
  });

  // 1. PLATA TOTAL EN PESOS
  const totalPesos = filteredWallets.reduce((sum, w) => sum + (w.saldoPesos || 0), 0);

  // 2. STOCK TOTAL EXCHANGES
  const totalCryptoStockUSDT = filteredExchanges.reduce((sum, ex) => sum + (ex.balanceCrypto || 0), 0);
  const estimatedUsdtRate = 1240; // Rate in ARS
  const stockExchangesInARS = totalCryptoStockUSDT * estimatedUsdtRate;

  // 5. GANANCIA NETA EN TURNO ACTIVO
  const gananciaNetaTotal = filteredTransactions
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  // 7. CAPITAL OPERADO (TOTAL VENTAS ARS) EN TURNO ACTIVO
  const capitalOperadoTotal = filteredTransactions
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + t.totalPesos, 0);

  // 6. RÉCORDS DE PRECIOS DEL TURNO ACTIVO
  const buysWithPrices = filteredTransactions.filter(t => t.type === 'compra' && t.unitPrice > 0);
  const minBuyRecord = buysWithPrices.length > 0
    ? [...buysWithPrices].sort((a, b) => a.unitPrice - b.unitPrice)[0]
    : null;

  const salesWithPrices = filteredTransactions.filter(t => t.type === 'venta' && t.unitPrice > 0);
  const maxSaleRecord = salesWithPrices.length > 0
    ? [...salesWithPrices].sort((a, b) => b.unitPrice - a.unitPrice)[0]
    : null;

  const recentTxs = filteredTransactions.slice(0, 5);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formattedShiftStart = activeShift?.startTime && !isNaN(new Date(activeShift.startTime).getTime())
    ? new Date(activeShift.startTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="space-y-6 font-mono">
      {/* SHIFT STATUS BAR */}
      {activeShiftId && activeShift ? (
        <div className="bg-binance-green/10 border border-binance-green/40 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-binance-green/20 text-binance-green rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-binance-green uppercase tracking-wider block">
                🟢 JORNADA ACTIVA EN CURSO
              </span>
              <p className="text-xs text-white">
                Responsable: <strong className="text-binance-yellow">{activeShift.operatorName}</strong>
                {formattedShiftStart && ` • Inicio: ${formattedShiftStart}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('cierre')}
            className="px-3 py-1.5 bg-binance-black hover:bg-binance-card border border-binance-green/40 text-binance-green font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Ver Control de Turno →
          </button>
        </div>
      ) : (
        <div className="bg-binance-red/10 border border-binance-red/40 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-binance-red/20 text-binance-red rounded-xl">
              <CircleAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-binance-red uppercase tracking-wider block">
                🔴 SIN JORNADA ACTIVA (JORNADA CERRADA)
              </span>
              <p className="text-xs text-binance-gray">
                Las métricas de ganancias y volumen de ventas de la jornada se encuentran reiniciadas en $0.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('cierre')}
            className="px-4 py-2 bg-binance-yellow text-binance-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 hover:bg-amber-400 transition-colors cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Iniciar Nueva Jornada
          </button>
        </div>
      )}

      {/* HEADER & VENDOR FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-binance-card p-6 rounded-2xl border border-binance-border shadow-md">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">
            Dashboard Terminal <span className="text-binance-yellow">ArbitraX</span>
          </h1>
          <p className="text-xs text-binance-gray mt-1">
            {isAdmin
              ? 'Panel de control unificado multi-vendedor con cálculo de stock y rentabilidad en tiempo real.'
              : `Panel de trabajo personal para ${currentUser?.name || 'Vendedor'}.`}
          </p>
        </div>

        {isAdmin && vendorsInOrg.length > 0 && (
          <div className="flex items-center gap-2 bg-binance-black p-2.5 rounded-xl border border-binance-border">
            <UserCheck className="w-4 h-4 text-binance-yellow" />
            <span className="text-xs font-bold text-binance-gray">Vendedor:</span>
            <select
              value={selectedVendorFilter}
              onChange={e => setSelectedVendorFilter(e.target.value)}
              className="bg-binance-card text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-binance-border outline-hidden focus:border-binance-yellow cursor-pointer"
            >
              <option value="all">🌐 Todos los Vendedores (Organización)</option>
              {vendorsInOrg.map(v => (
                <option key={v.id} value={v.id}>👤 {v.name} ({v.username})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1, 2, 5, 7 MAIN INDICATORS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. PLATA TOTAL EN PESOS */}
        <div className="bg-binance-card rounded-2xl p-5 border border-binance-border space-y-2 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
              Plata Total en Pesos
            </span>
            <div className="p-2 bg-binance-black text-binance-yellow border border-binance-border rounded-xl">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-black text-white block tracking-tight font-mono">
              {formatMoney(totalPesos)}
            </span>
            <span className="text-[10px] text-binance-gray block">
              Sumatoria de saldos en billeteras fiat
            </span>
          </div>
        </div>

        {/* 2. STOCK TOTAL EXCHANGES */}
        <div className="bg-binance-card rounded-2xl p-5 border border-binance-border space-y-2 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-binance-gray uppercase tracking-wider block">
              Stock Total Exchanges
            </span>
            <div className="p-2 bg-binance-black text-binance-green border border-binance-border rounded-xl">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-black text-binance-green block tracking-tight font-mono">
              {totalCryptoStockUSDT.toLocaleString()} <span className="text-xs text-white">USDT</span>
            </span>
            <span className="text-[10px] text-binance-gray block font-mono">
              ≈ {formatMoney(stockExchangesInARS)} ARS
            </span>
          </div>
        </div>

        {/* 5. GANANCIA NETA */}
        <div className="bg-binance-green/10 text-binance-green rounded-2xl p-5 border border-binance-green/30 space-y-2 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-binance-green uppercase tracking-wider block">
              Ganancia Neta Real
            </span>
            <div className="p-2 bg-binance-green/20 text-binance-green rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-black text-white block tracking-tight font-mono">
              {formatMoney(gananciaNetaTotal)}
            </span>
            <span className="text-[10px] text-binance-green block">
              Retorno neto acumulado por arbitraje
            </span>
          </div>
        </div>

        {/* 7. CAPITAL OPERADO */}
        <div className="bg-binance-yellow/10 text-binance-yellow rounded-2xl p-5 border border-binance-yellow/30 space-y-2 shadow-md">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-binance-yellow uppercase tracking-wider block">
              Capital Operado (Ventas)
            </span>
            <div className="p-2 bg-binance-yellow/20 text-binance-yellow rounded-xl">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-black text-white block tracking-tight font-mono">
              {formatMoney(capitalOperadoTotal)}
            </span>
            <span className="text-[10px] text-binance-yellow block">
              Monto total facturado en ventas P2P
            </span>
          </div>
        </div>
      </div>

      {/* 3. MOTORES DE INVENTARIO INDEPENDIENTES BANNER */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl space-y-4 shadow-md">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-5 h-5 text-binance-yellow" />
          Motores de Inventario Independientes (Multi-Activo)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Motor Pesos */}
          <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-2">
            <div className="flex justify-between items-center border-b border-binance-border pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase">🇦🇷 Motor Pesos (Fiat)</span>
              <span className="text-[10px] text-binance-gray">Billeteras Activas: {filteredWallets.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-binance-gray">Disponible Fiat:</span>
              <span className="font-extrabold text-white text-base font-mono">{formatMoney(totalPesos)}</span>
            </div>
          </div>

          {/* Motor Crypto */}
          <div className="bg-binance-black p-4 rounded-xl border border-binance-border space-y-2">
            <div className="flex justify-between items-center border-b border-binance-border pb-2">
              <span className="text-xs font-bold text-binance-green uppercase">⚡ Motor Cripto (Exchanges)</span>
              <span className="text-[10px] text-binance-gray">Exchanges Activas: {filteredExchanges.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-binance-gray">Disponible USDT:</span>
              <span className="font-extrabold text-binance-green text-base font-mono">{totalCryptoStockUSDT.toLocaleString()} USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. RÉCORDS DE PRECIOS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Record Min Compra */}
        <div className="bg-binance-black p-5 rounded-2xl border border-binance-red/30 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-binance-red uppercase flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4" /> Récord Mínimo Compra
            </span>
            <Award className="w-4 h-4 text-binance-red" />
          </div>

          {minBuyRecord ? (
            <div className="space-y-1">
              <div className="text-2xl font-black text-binance-red font-mono">
                {formatMoney(minBuyRecord.unitPrice)}
              </div>
              <div className="text-[11px] text-binance-gray">
                Operador: <strong className="text-white">{minBuyRecord.operator}</strong> • {minBuyRecord.dateString}
              </div>
            </div>
          ) : (
            <p className="text-xs text-binance-gray italic">Sin registros de compras aún.</p>
          )}
        </div>

        {/* Record Max Venta */}
        <div className="bg-binance-black p-5 rounded-2xl border border-binance-green/30 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-binance-green uppercase flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" /> Récord Máximo Venta
            </span>
            <Award className="w-4 h-4 text-binance-green" />
          </div>

          {maxSaleRecord ? (
            <div className="space-y-1">
              <div className="text-2xl font-black text-binance-green font-mono">
                {formatMoney(maxSaleRecord.unitPrice)}
              </div>
              <div className="text-[11px] text-binance-gray">
                Operador: <strong className="text-white">{maxSaleRecord.operator}</strong> • {maxSaleRecord.dateString}
              </div>
            </div>
          ) : (
            <p className="text-xs text-binance-gray italic">Sin registros de ventas aún.</p>
          )}
        </div>
      </div>

      {/* 4. STOCK INDIVIDUAL POR BILLETERA Y EXCHANGE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock por Billetera */}
        <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-binance-border pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Landmark className="w-4 h-4 text-binance-yellow" />
              Stock Individual de Billeteras ($ ARS)
            </h3>
            <button onClick={() => onSelectTab('billeteras')} className="text-xs font-bold text-binance-yellow hover:underline cursor-pointer">
              Gestionar →
            </button>
          </div>

          <div className="space-y-3">
            {filteredWallets.map(w => (
              <div key={w.id} className="p-3 bg-binance-black rounded-xl border border-binance-border flex justify-between items-center text-xs">
                <div>
                  <span className="font-extrabold text-white block">{w.name}</span>
                  <span className="text-[10px] text-binance-gray block">
                    Vendedor: {w.vendorName || 'General'} {w.blocked ? '🔴 (BLOQUEADA)' : '🟢 (ACTIVA)'}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-amber-400 block">{formatMoney(w.saldoPesos)}</span>
                  {w.limitARS ? (
                    <span className="text-[9px] text-binance-gray block">
                      Límite: {formatMoney(w.limitARS)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {filteredWallets.length === 0 && (
              <p className="text-xs text-binance-gray italic py-4 text-center">No hay billeteras registradas.</p>
            )}
          </div>
        </div>

        {/* Stock por Exchange */}
        <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-4 shadow-md">
          <div className="flex justify-between items-center border-b border-binance-border pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-binance-green" />
              Stock Individual de Exchanges (USDT)
            </h3>
            <button onClick={() => onSelectTab('exchanges')} className="text-xs font-bold text-binance-yellow hover:underline cursor-pointer">
              Gestionar →
            </button>
          </div>

          <div className="space-y-3">
            {filteredExchanges.map(ex => (
              <div key={ex.id} className="p-3 bg-binance-black rounded-xl border border-binance-border flex justify-between items-center text-xs">
                <div>
                  <span className="font-extrabold text-white block">{ex.name}</span>
                  <span className="text-[10px] text-binance-gray block">
                    Vendedor: {ex.vendorName || 'General'}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="font-bold text-binance-green block">{ex.balanceCrypto} USDT</span>
                  <span className="text-[9px] text-binance-gray block">
                    ≈ {formatMoney(ex.balanceCrypto * estimatedUsdtRate)} ARS
                  </span>
                </div>
              </div>
            ))}

            {filteredExchanges.length === 0 && (
              <p className="text-xs text-binance-gray italic py-4 text-center">No hay exchanges registradas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
