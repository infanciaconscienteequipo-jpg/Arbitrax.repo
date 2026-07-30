/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, Wallet } from '../types';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Wallet as WalletIcon, RefreshCw, Calendar, FileDown, Trash2, Clock, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';

interface MovimientosProps {
  transactions: Transaction[];
  wallets: Wallet[];
  onClearTransactions?: () => void;
}

export default function Movimientos({
  transactions,
  wallets,
  onClearTransactions,
}: MovimientosProps) {
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [cryptoFilter, setCryptoFilter] = useState('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [generalSearch, setGeneralSearch] = useState('');

  // Advanced Chronological Filters
  const [useAdvancedTime, setUseAdvancedTime] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState('all');
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState('all');
  const [startHour, setStartHour] = useState('0');
  const [endHour, setEndHour] = useState('23');

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

  // Extract unique years from transactions for the filter dropdown
  const uniqueYears = Array.from(
    new Set(transactions.map(t => new Date(t.timestamp).getFullYear().toString()))
  ).filter(Boolean).sort();
  
  if (uniqueYears.length === 0) {
    uniqueYears.push(new Date().getFullYear().toString());
  }

  // Extract unique cryptos for filter
  const uniqueCryptos = Array.from(new Set(transactions.map(t => t.crypto.toUpperCase()))).filter(Boolean);

  // Filter transactions
  const filteredTxs = transactions.filter(t => {
    const txDate = new Date(t.timestamp);
    const now = new Date();
    
    // Time/Date Filtering
    if (!useAdvancedTime) {
      if (timeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const tStr = t.timestamp.split('T')[0];
        if (todayStr !== tStr) return false;
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        if (txDate < oneWeekAgo) return false;
      } else if (timeFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        if (txDate < oneMonthAgo) return false;
      }
    } else {
      // Advanced Chronological Filters
      // Date Range (Local time comparison)
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        if (txDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        if (txDate > end) return false;
      }

      // Year Filter
      if (selectedYear !== 'all') {
        if (txDate.getFullYear().toString() !== selectedYear) return false;
      }

      // Month Filter (0-11)
      if (selectedMonth !== 'all') {
        if (txDate.getMonth().toString() !== selectedMonth) return false;
      }

      // Day of Month Filter (1-31)
      if (selectedDayOfMonth !== 'all') {
        if (txDate.getDate().toString() !== selectedDayOfMonth) return false;
      }

      // Day of Week Filter (1=Lunes, 2=Martes... 0=Domingo)
      if (selectedDayOfWeek !== 'all') {
        if (txDate.getDay().toString() !== selectedDayOfWeek) return false;
      }

      // Hour Filter (0-23)
      const hour = txDate.getHours();
      const sHour = parseInt(startHour, 10);
      const eHour = parseInt(endHour, 10);
      if (hour < sHour || hour > eHour) return false;
    }

    // Crypto filter
    if (cryptoFilter !== 'all' && t.crypto.toUpperCase() !== cryptoFilter.toUpperCase()) {
      return false;
    }

    // Wallet filter
    if (walletFilter !== 'all' && t.walletId !== walletFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'compra' && t.type !== 'compra') return false;
      if (typeFilter === 'venta' && t.type !== 'venta') return false;
      if (typeFilter === 'ingreso' && t.type !== 'ingreso_fondos') return false;
      if (typeFilter === 'egreso' && t.type !== 'egreso_fondos') return false;
    }

    // Operator filter
    if (operatorSearch && !t.operator.toLowerCase().includes(operatorSearch.toLowerCase())) {
      return false;
    }

    // General search (notes, client, supplier, unit price, quantity)
    if (generalSearch) {
      const query = generalSearch.toLowerCase();
      const matchNotes = t.notes?.toLowerCase().includes(query);
      const matchClient = t.client?.toLowerCase().includes(query);
      const matchSupplier = t.supplier?.toLowerCase().includes(query);
      const matchWallet = t.walletName.toLowerCase().includes(query);
      const matchCrypto = t.crypto.toLowerCase().includes(query);
      const matchQty = t.quantity.toString().includes(query);
      
      if (!matchNotes && !matchClient && !matchSupplier && !matchWallet && !matchCrypto && !matchQty) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats on the filtered set
  const filteredTotalPurchases = filteredTxs
    .filter(t => t.type === 'compra')
    .reduce((sum, t) => sum + t.totalPesos, 0);

  const filteredTotalSales = filteredTxs
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + t.totalPesos, 0);

  const filteredTotalGains = filteredTxs
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredTxs.length === 0) return;
    
    const headers = ['ID', 'Fecha/Hora', 'Tipo', 'Cripto', 'Cantidad', 'Precio Unitario (ARS)', 'Total (ARS)', 'Billetera', 'Operador', 'Cliente/Proveedor', 'Ganancia (ARS)', 'Observaciones'];
    const rows = filteredTxs.map(t => [
      t.id,
      formatDateTime(t.timestamp),
      t.type.toUpperCase(),
      t.crypto,
      t.quantity,
      t.unitPrice,
      t.totalPesos,
      t.walletName,
      t.operator,
      t.type === 'compra' ? (t.supplier || '') : (t.client || ''),
      t.gain || 0,
      t.notes || '',
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `movimientos_cripto_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Section */}
      <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <Filter className="w-5 h-5 text-binance-yellow" />
            Historial de Operaciones y Movimientos
          </h2>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredTxs.length === 0}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                filteredTxs.length > 0 
                  ? 'bg-binance-black hover:bg-binance-black/80 text-white border-binance-border' 
                  : 'bg-binance-black/30 text-binance-gray border-binance-border/50 cursor-not-allowed'
              }`}
            >
              <FileDown className="w-4 h-4" />
              Exportar CSV
            </button>
            
            {onClearTransactions && (
              <button
                onClick={() => {
                  if (confirm('¿Está seguro de que desea reiniciar todo el historial de transacciones y saldos?')) {
                    onClearTransactions();
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold rounded-xl bg-binance-red/20 hover:bg-binance-red/35 text-binance-red border border-binance-red/35 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Reiniciar Datos
              </button>
            )}
          </div>
        </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* General Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-binance-gray" />
            <input
              type="text"
              placeholder="Buscar nota, cliente..."
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden transition-all text-white"
            />
          </div>

          {/* Timeframe */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Cualquier Fecha</option>
            <option value="today">Operaciones de Hoy</option>
            <option value="week">Última Semana</option>
            <option value="month">Último Mes</option>
          </select>

          {/* Wallet Selection */}
          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Todas las Billeteras</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Crypto Selection */}
          <select
            value={cryptoFilter}
            onChange={(e) => setCryptoFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Todas las Criptos</option>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            {uniqueCryptos.map(c => (
              c !== 'USDT' && c !== 'BTC' && c !== 'ETH' && c !== 'ARS' ? (
                <option key={c} value={c}>{c}</option>
              ) : null
            ))}
          </select>

          {/* Transaction Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
          >
            <option value="all">Cualquier Tipo</option>
            <option value="compra">Compras</option>
            <option value="venta">Ventas</option>
            <option value="ingreso">Fondos Ingresados</option>
            <option value="egreso">Fondos Egresados</option>
          </select>
        </div>

        {/* Operator Search & Advanced filters Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-binance-gray" />
            <input
              type="text"
              placeholder="Filtrar por Operador..."
              value={operatorSearch}
              onChange={(e) => setOperatorSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden transition-all text-white"
            />
          </div>
          
          <button
            type="button"
            onClick={() => setUseAdvancedTime(!useAdvancedTime)}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              useAdvancedTime
                ? 'bg-binance-yellow/20 border-binance-yellow text-binance-yellow premium-glow-yellow'
                : 'bg-binance-black hover:bg-binance-black/60 border-binance-border text-binance-gray hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {useAdvancedTime ? 'Filtros Cronológicos: Activos' : 'Filtros Cronológicos (Fecha, Hora, Mes, Año)'}
          </button>
        </div>

        {/* ADVANCED TIME FILTERS EXPANDABLE PANEL */}
        {useAdvancedTime && (
          <div className="bg-binance-black/40 border border-binance-border/60 rounded-xl p-4 space-y-4 transition-all duration-300">
            <div className="flex justify-between items-center border-b border-binance-border/30 pb-2">
              <span className="text-xs font-bold text-binance-yellow flex items-center gap-1.5 font-mono">
                <Clock className="w-4 h-4" /> Búsqueda por Período y Horario Exacto
              </span>
              <span className="text-[10px] text-binance-gray font-mono">Los Filtros Rápidos de Tiempo quedan suspendidos mientras se use este panel</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Date Start */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Desde Fecha</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden text-white"
                />
              </div>

              {/* Date End */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Hasta Fecha</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden text-white"
                />
              </div>

              {/* Year */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Año</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
                >
                  <option value="all">Cualquier Año</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Mes</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
                >
                  <option value="all">Cualquier Mes</option>
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Day of Month */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Día del Mes</label>
                <select
                  value={selectedDayOfMonth}
                  onChange={(e) => setSelectedDayOfMonth(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
                >
                  <option value="all">Cualquier Día (1-31)</option>
                  {Array.from({ length: 31 }, (_, i) => (i + 1).toString()).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Day of Week */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Día de la Semana</label>
                <select
                  value={selectedDayOfWeek}
                  onChange={(e) => setSelectedDayOfWeek(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white"
                >
                  <option value="all">Cualquier Día (Lun-Dom)</option>
                  {DAYS_OF_WEEK.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Start Hour */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Hora Inicio (Desde)</label>
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white font-mono"
                >
                  {Array.from({ length: 24 }, (_, i) => i.toString()).map(h => (
                    <option key={h} value={h}>{h.padStart(2, '0')}:00 hs</option>
                  ))}
                </select>
              </div>

              {/* End Hour */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-binance-gray uppercase tracking-wider block">Hora Fin (Hasta)</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-xs focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow outline-hidden cursor-pointer text-white font-mono"
                >
                  {Array.from({ length: 24 }, (_, i) => i.toString()).map(h => (
                    <option key={h} value={h}>{h.padStart(2, '0')}:59 hs</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-binance-border/30">
              <span className="text-[10px] text-binance-gray font-mono italic">
                * Filtro aplicado en tiempo real
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedYear('all');
                    setSelectedMonth('all');
                    setSelectedDayOfMonth('all');
                    setSelectedDayOfWeek('all');
                    setStartHour('0');
                    setEndHour('23');
                  }}
                  className="px-3 py-1.5 bg-binance-black hover:bg-binance-black/85 border border-binance-border text-[11px] text-binance-gray hover:text-white font-bold rounded-lg transition-all cursor-pointer"
                >
                  Limpiar Filtros
                </button>
                <button
                  type="button"
                  onClick={() => setUseAdvancedTime(false)}
                  className="px-3 py-1.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black text-[11px] font-extrabold rounded-lg transition-all cursor-pointer"
                >
                  Usar Filtros Rápidos
                </button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-binance-border/40">
                {filteredTxs.map((t, idx) => (
                  <tr key={t.id || idx} className="hover:bg-binance-black/40 transition-colors">
                    {/* Timestamp */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-white">{t.dateString}</div>
                      <div className="text-binance-gray font-mono text-[10px] mt-0.5">{t.timeString}</div>
                    </td>

                    {/* Operation Type badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                        t.type === 'compra' ? 'bg-binance-red/10 text-binance-red border border-binance-red/25' :
                        t.type === 'venta' ? 'bg-binance-green/10 text-binance-green border border-binance-green/25' :
                        t.type === 'ingreso_fondos' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25' :
                        'bg-binance-black text-white border border-binance-border'
                      }`}>
                        {t.type === 'compra' && <ArrowDownLeft className="w-3.5 h-3.5" />}
                        {t.type === 'venta' && <ArrowUpRight className="w-3.5 h-3.5" />}
                        {t.type === 'ingreso_fondos' && <span className="text-blue-400 font-bold">+</span>}
                        {t.type === 'egreso_fondos' && <span className="text-binance-gray font-bold">-</span>}
                        
                        {t.type === 'compra' ? 'Compra' :
                         t.type === 'venta' ? 'Venta' :
                         t.type === 'ingreso_fondos' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>

                    {/* Wallet Name */}
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-white">
                      <div className="flex items-center gap-1.5">
                        <WalletIcon className="w-3.5 h-3.5 text-binance-yellow" />
                        {t.walletName}
                      </div>
                    </td>

                    {/* Crypto ticker */}
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-white font-mono">
                      {t.crypto}
                    </td>

                    {/* Quantity and Unit Price */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {t.type !== 'ingreso_fondos' && t.type !== 'egreso_fondos' ? (
                        <>
                          <div className="font-bold text-white font-mono">{t.quantity.toLocaleString()} {t.crypto}</div>
                          <div className="text-binance-gray mt-0.5 font-mono text-[10px]">@ {formatMoney(t.unitPrice)}</div>
                        </>
                      ) : (
                        <span className="text-binance-gray italic">-</span>
                      )}
                    </td>

                    {/* Total Pesos cost */}
                    <td className="px-6 py-4 text-right whitespace-nowrap font-extrabold font-mono">
                      <span className={t.type === 'compra' || t.type === 'egreso_fondos' ? 'text-binance-red' : 'text-binance-green'}>
                        {t.type === 'compra' || t.type === 'egreso_fondos' ? '-' : '+'}
                        {formatMoney(t.totalPesos)}
                      </span>
                    </td>

                    {/* Realized profit */}
                    <td className="px-6 py-4 text-right whitespace-nowrap font-extrabold font-mono">
                      {t.type === 'venta' && t.gain !== undefined ? (
                        <span className="text-binance-green">+{formatMoney(t.gain)}</span>
                      ) : (
                        <span className="text-binance-border italic">-</span>
                      )}
                    </td>

                    {/* Operator and client/provider */}
                    <td className="px-6 py-4 text-binance-gray space-y-1">
                      <div className="font-bold text-white">
                        {t.operator}
                      </div>
                      {t.supplier && (
                        <div className="text-[10px] text-binance-yellow">Proveedor: {t.supplier}</div>
                      )}
                      {t.client && (
                        <div className="text-[10px] text-binance-green">Comprador: {t.client}</div>
                      )}
                      {t.notes && (
                        <div className="text-[10px] text-binance-gray italic font-mono">"{t.notes}"</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
