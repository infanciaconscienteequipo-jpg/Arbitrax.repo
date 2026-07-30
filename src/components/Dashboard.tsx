/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wallet, Transaction } from '../types';
import { calculateAverageBuyPrice } from '../utils/dataStore';
import { Landmark, TrendingUp, RefreshCw, BarChart3, Coins, ShoppingBag, ArrowUpRight, ArrowDownLeft, Receipt, CalendarCheck } from 'lucide-react';

interface DashboardProps {
  wallets: Wallet[];
  transactions: Transaction[];
  onSelectTab: (tab: string) => void;
}

export default function Dashboard({
  wallets,
  transactions,
  onSelectTab,
}: DashboardProps) {
  // 1. Calculations
  const totalPesos = wallets.reduce((sum, w) => sum + w.saldoPesos, 0);
  const totalUsdt = wallets.reduce((sum, w) => sum + w.saldoUsdt, 0);

  // Today's Date String
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM

  // Filter today's transactions
  const todayTransactions = transactions.filter(t => t.timestamp.startsWith(todayStr));
  const monthTransactions = transactions.filter(t => t.timestamp.startsWith(currentMonthStr));

  // Ganancia del día (gains on sales today)
  const gananciaDia = todayTransactions
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  // Ganancia del mes (gains on sales this month)
  const gananciaMes = monthTransactions
    .filter(t => t.type === 'venta')
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  // Cantidad de operaciones
  const operationsCount = transactions.length;

  // Average Compra Price (USDT)
  const averageBuyUSDT = calculateAverageBuyPrice(transactions, 'USDT');

  // Average Sale Price (USDT)
  const saleTransactions = transactions.filter(t => t.type === 'venta' && t.crypto.toUpperCase() === 'USDT');
  const averageSaleUSDT = saleTransactions.length > 0
    ? saleTransactions.reduce((sum, t) => sum + t.unitPrice, 0) / saleTransactions.length
    : 1245; // default estimation if empty

  // Format monetary amounts
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const recentTxs = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Overall Indicators */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
            Terminal de Arbitraje <span className="text-binance-yellow">ArbitraX</span>
          </h1>
          <p className="text-xs text-binance-gray mt-1">
            Resumen analítico y financiero de liquidez, arbitraje y rentabilidades en tiempo real.
          </p>
        </div>
        <div className="text-2xs font-mono text-binance-gray bg-binance-card border border-binance-border rounded-lg px-3 py-2 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-binance-yellow" />
          <span>ACTUALIZADO:</span>
          <span className="text-white font-bold">{new Date().toLocaleString('es-AR')}</span>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Pesos Card */}
        <div className="bg-binance-card rounded-2xl p-5 border border-binance-border space-y-3 shadow-md hover:border-binance-gray/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-2xs font-bold text-binance-gray uppercase tracking-wider block">Capital en Pesos</span>
            <div className="p-2 bg-binance-black/40 text-binance-yellow border border-binance-border rounded-lg">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-extrabold text-white block tracking-tight font-mono">
              {formatMoney(totalPesos)}
            </span>
            <span className="text-3xs text-binance-gray block">Total disponible en cuentas bancarias y fintech</span>
          </div>
        </div>

        {/* Total USDT Card */}
        <div className="bg-binance-card rounded-2xl p-5 border border-binance-border space-y-3 shadow-md hover:border-binance-green/30 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-2xs font-bold text-binance-gray uppercase tracking-wider block">Capital en USDT</span>
            <div className="p-2 bg-binance-black/40 text-binance-green border border-binance-border rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-extrabold text-binance-green block tracking-tight font-mono">
              {totalUsdt.toLocaleString()} <span className="text-xs font-bold text-white">USDT</span>
            </span>
            <span className="text-3xs text-binance-gray block">Cartera total en exchanges y billeteras cripto</span>
          </div>
        </div>

        {/* Ganancia del Día */}
        <div className="bg-binance-green/10 text-binance-green rounded-2xl p-5 border border-binance-green/30 shadow-md premium-glow-green space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-2xs font-bold text-binance-green uppercase tracking-wider block">Retornos de Hoy</span>
            <div className="p-2 bg-binance-green/20 text-binance-green rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-extrabold text-white block tracking-tight font-mono">
              {formatMoney(gananciaDia)}
            </span>
            <span className="text-3xs text-binance-green block">Arbitraje neto acumulado durante el día de hoy</span>
          </div>
        </div>

        {/* Ganancia del Mes */}
        <div className="bg-binance-yellow/10 text-binance-yellow rounded-2xl p-5 border border-binance-yellow/30 shadow-md premium-glow-yellow space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-2xs font-bold text-binance-yellow uppercase tracking-wider block">Retornos del Mes</span>
            <div className="p-2 bg-binance-yellow/20 text-binance-yellow rounded-lg">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-2xl font-extrabold text-white block tracking-tight font-mono">
              {formatMoney(gananciaMes)}
            </span>
            <span className="text-3xs text-binance-yellow block">Historial mensual de rentabilidad</span>
          </div>
        </div>
      </div>

      {/* Sub-metrics Banner (Ops count, Averages) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-binance-dark border border-binance-border rounded-2xl p-5 text-sm">
        <div>
          <span className="text-3xs text-binance-gray font-bold block uppercase tracking-wider mb-1">Operaciones de Turno</span>
          <span className="text-base font-extrabold text-white font-mono">{operationsCount} txs</span>
        </div>
        <div>
          <span className="text-3xs text-binance-gray font-bold block uppercase tracking-wider mb-1">Compra Promedio USDT</span>
          <span className="text-base font-extrabold text-binance-red font-mono">{formatMoney(averageBuyUSDT)}</span>
        </div>
        <div>
          <span className="text-3xs text-binance-gray font-bold block uppercase tracking-wider mb-1 font-mono">Venta Promedio USDT</span>
          <span className="text-base font-extrabold text-binance-green font-mono">{formatMoney(averageSaleUSDT)}</span>
        </div>
        <div>
          <span className="text-3xs text-binance-gray font-bold block uppercase tracking-wider mb-1">Spread de Retorno</span>
          <span className="text-base font-extrabold text-binance-green font-mono">
            +{averageBuyUSDT > 0 ? (((averageSaleUSDT - averageBuyUSDT) / averageBuyUSDT) * 100).toFixed(2) : '1.80'}%
          </span>
        </div>
      </div>

      {/* Interactive Bento Layout: Wallets Liquidity Bar Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Wallet Balances Chart Widget */}
        <div className="lg:col-span-2 bg-binance-card rounded-2xl border border-binance-border p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-binance-border pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-display">
              <Landmark className="w-5 h-5 text-binance-yellow" />
              Saldos e Inversión por Billeteras
            </h3>
            <button
              onClick={() => onSelectTab('billeteras')}
              className="text-xs font-bold text-binance-yellow hover:text-white transition-colors cursor-pointer"
            >
              Gestionar Billeteras →
            </button>
          </div>

          <div className="space-y-5">
            {wallets.map((w) => {
              // Calculate percentages
              const pesoShare = totalPesos > 0 ? (w.saldoPesos / totalPesos) * 100 : 0;
              const usdtShare = totalUsdt > 0 ? (w.saldoUsdt / totalUsdt) * 100 : 0;

              return (
                <div key={w.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs border-b border-binance-border/35 pb-4 last:border-b-0 last:pb-0">
                  <div className="md:col-span-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: w.color || '#f0b90b' }}></span>
                    <span className="font-extrabold text-white text-sm">{w.name}</span>
                  </div>
                  
                  {/* Pesos bar */}
                  <div className="md:col-span-4 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-binance-gray">
                      <span>ARS ({pesoShare.toFixed(0)}%)</span>
                      <span className="font-extrabold text-white font-mono">{formatMoney(w.saldoPesos)}</span>
                    </div>
                    <div className="w-full bg-binance-black h-2 rounded-full overflow-hidden">
                      <div className="bg-binance-yellow h-full rounded-full transition-all duration-500" style={{ width: `${pesoShare}%` }}></div>
                    </div>
                  </div>

                  {/* USDT bar */}
                  <div className="md:col-span-5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-binance-gray">
                      <span>USDT ({usdtShare.toFixed(0)}%)</span>
                      <span className="font-extrabold text-binance-green font-mono">{w.saldoUsdt.toLocaleString()} USDT</span>
                    </div>
                    <div className="w-full bg-binance-black h-2 rounded-full overflow-hidden">
                      <div className="bg-binance-green h-full rounded-full transition-all duration-500" style={{ width: `${usdtShare}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Operations sidebar */}
        <div className="bg-binance-card rounded-2xl border border-binance-border p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-binance-border pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-display">
              <Receipt className="w-5 h-5 text-binance-gray" />
              Últimas Actividades
            </h3>
            <button
              onClick={() => onSelectTab('movimientos')}
              className="text-xs font-bold text-binance-yellow hover:text-white transition-colors cursor-pointer"
            >
              Ver Todo →
            </button>
          </div>

          {recentTxs.length === 0 ? (
            <p className="text-xs text-binance-gray italic py-8 text-center">No se han registrado operaciones aún.</p>
          ) : (
            <div className="space-y-3">
              {recentTxs.map((t, idx) => (
                <div key={t.id || idx} className="p-3 bg-binance-black/60 rounded-xl border border-binance-border flex justify-between items-center text-xs hover:border-binance-gray/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono ${
                        t.type === 'compra' ? 'bg-binance-red/20 text-binance-red border border-binance-red/30' :
                        t.type === 'venta' ? 'bg-binance-green/20 text-binance-green border border-binance-green/30' : 'bg-blue-900/30 text-blue-400 border border-blue-900/50'
                      }`}>
                        {t.type === 'compra' ? 'Compra' : t.type === 'venta' ? 'Venta' : 'Carga'}
                      </span>
                      <span className="text-[10px] font-mono text-binance-gray">{t.timeString}</span>
                    </div>
                    <span className="font-extrabold text-white block mt-0.5">
                      {t.type !== 'ingreso_fondos' && t.type !== 'egreso_fondos' ? `${t.quantity} ${t.crypto}` : t.notes}
                    </span>
                    <span className="text-[10px] text-binance-gray block">{t.walletName}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-extrabold text-sm block font-mono ${
                      t.type === 'compra' || t.type === 'egreso_fondos' ? 'text-binance-red' : 'text-binance-green'
                    }`}>
                      {t.type === 'compra' || t.type === 'egreso_fondos' ? '-' : '+'}
                      {formatMoney(t.totalPesos)}
                    </span>
                    {t.type === 'venta' && t.gain && (
                      <span className="text-[10px] text-binance-green font-mono block">+{formatMoney(t.gain)} Gain</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
