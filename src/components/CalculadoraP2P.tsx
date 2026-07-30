/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { P2PArbitrage, Wallet, Transaction } from '../types';
import { 
  Calculator, 
  Save, 
  History, 
  Plus, 
  Minus, 
  AlertCircle, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';

interface CalculadoraP2PProps {
  p2pCalcs: P2PArbitrage[];
  wallets: Wallet[];
  onAddP2PCalc: (calc: P2PArbitrage) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => void;
  activeShiftId: string | null;
}

export default function CalculadoraP2P({
  p2pCalcs,
  wallets,
  onAddP2PCalc,
  onAddTransaction,
  activeShiftId,
}: CalculadoraP2PProps) {
  // Calculator inputs (pre-populated with user's Excel screenshot example for instant recognition)
  const [pesosInput, setPesosInput] = useState<number | ''>(1000000);
  const [usdtInput, setUsdtInput] = useState<number | ''>(600);
  const [commissionPercent, setCommissionPercent] = useState<number>(0.2); // Binance 0.2% fee standard Maker
  const [gainPercent, setGainPercent] = useState<number | ''>(1.0); // 1.0% desired gain in pesos
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-calculated variables matching Excel formulas exactly
  const pesosUsed = typeof pesosInput === 'number' ? pesosInput : 0;
  const rawUsdt = typeof usdtInput === 'number' ? usdtInput : 0;
  const commissionRate = commissionPercent / 100;
  const desiredGainRate = typeof gainPercent === 'number' ? gainPercent / 100 : 0;

  // Formula 1: Precio promedio compra = (Pesos * (1 - Comisión)) / USDT comprados (C11)
  const averagePurchasePrice = rawUsdt > 0 ? (pesosUsed * (1 - commissionRate)) / rawUsdt : 0;

  // Formula 2: Ganancia pesos = Pesos * % ganancia (C14)
  const profitPesos = pesosUsed * desiredGainRate;

  // Formula 3: Ganancia USDT = Ganancia pesos / Precio promedio compra (C15)
  const profitUsdt = averagePurchasePrice > 0 ? profitPesos / averagePurchasePrice : 0;

  // Formula 4: USDT vendidos = USDT comprados - Ganancia USDT (C12)
  const usdtSold = Math.max(0, rawUsdt - profitUsdt);

  // Formula 5: Precio promedio venta = Pesos / USDT vendidos (C13)
  const averageSalePrice = usdtSold > 0 ? pesosUsed / usdtSold : 0;

  // Control: pesos recibidos por la venta = USDT vendidos * Precio promedio venta
  const controlPesosReceived = usdtSold * averageSalePrice;

  // Argentine Formatting Helpers (separador de miles con punto, decimal con coma)
  const formatArs = (num: number, showDecimals = false) => {
    if (isNaN(num) || !isFinite(num)) return '$ 0';
    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    };
    const formatted = new Intl.NumberFormat('es-AR', options).format(num);
    return `$ ${formatted}`;
  };

  const formatUsdt = (num: number, decimals = 4) => {
    if (isNaN(num) || !isFinite(num)) return '0,0000';
    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    };
    const formatted = new Intl.NumberFormat('es-AR', options).format(num);
    return formatted;
  };

  const handleSaveCalculation = (e: React.FormEvent) => {
    e.preventDefault();

    if (pesosUsed <= 0 || rawUsdt <= 0 || averagePurchasePrice <= 0) {
      setErrorMsg('Debe completar Pesos, USDT y Ganancia con valores mayores a cero.');
      return;
    }

    setErrorMsg('');

    const newCalc: P2PArbitrage = {
      id: `p2p-${Date.now()}`,
      timestamp: new Date().toISOString(),
      pesosUsed,
      usdtBought: rawUsdt,
      commissionPercent,
      commissionAmount: rawUsdt * commissionRate,
      netUsdt: usdtSold, // Total USDT to sell
      averagePrice: averagePurchasePrice,
      targetSalePrice: averageSalePrice,
      grossRevenue: controlPesosReceived,
      netProfit: profitPesos,
      profitabilityPercent: typeof gainPercent === 'number' ? gainPercent : 0,
      notes: notes.trim() || `Ganancia deseada de ${gainPercent}%`,
    };

    onAddP2PCalc(newCalc);
    setSuccessMsg('✅ Simulación de arbitraje USDT guardada en el historial de cálculos.');
    setNotes('');

    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Instant execution to Real Purchases / Sales logic
  const [realWalletId, setRealWalletId] = useState('');
  useEffect(() => {
    if (wallets.length > 0 && !realWalletId) {
      setRealWalletId(wallets[0].id);
    }
  }, [wallets, realWalletId]);

  const handleApplyPurchase = () => {
    if (!activeShiftId) {
      setErrorMsg('⚠️ Debe iniciar un turno en el panel de control de turnos para registrar compras reales.');
      return;
    }

    if (pesosUsed <= 0 || rawUsdt <= 0) {
      setErrorMsg('Simule una operación con valores de Pesos y USDT antes de registrar la compra.');
      return;
    }

    const selectedWallet = wallets.find(w => w.id === realWalletId);
    if (!selectedWallet) {
      setErrorMsg('Seleccione una billetera válida.');
      return;
    }

    if (selectedWallet.saldoPesos < pesosUsed) {
      setErrorMsg(`Saldo en pesos insuficiente en ${selectedWallet.name}. Saldo actual: ${formatArs(selectedWallet.saldoPesos)}.`);
      return;
    }

    setErrorMsg('');

    // Trigger purchase transaction (deducts pesos, adds USDT)
    onAddTransaction({
      type: 'compra',
      crypto: 'USDT',
      quantity: rawUsdt,
      unitPrice: averagePurchasePrice,
      totalPesos: pesosUsed,
      walletId: realWalletId,
      walletName: selectedWallet.name,
      operator: 'Calculadora P2P',
      notes: notes.trim() || 'Fase 1: Compra de USDT simulada',
      shiftId: activeShiftId,
    });

    setSuccessMsg(`🚀 Fase 1 Registrada: Se debitó ${formatArs(pesosUsed)} de pesos y se acreditaron ${formatUsdt(rawUsdt, 2)} USDT en ${selectedWallet.name}.`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleApplySale = () => {
    if (!activeShiftId) {
      setErrorMsg('⚠️ Debe iniciar un turno en el panel de control de turnos para registrar ventas reales.');
      return;
    }

    if (usdtSold <= 0 || averageSalePrice <= 0) {
      setErrorMsg('Simule una operación válida con USDT vendidos mayor a cero.');
      return;
    }

    const selectedWallet = wallets.find(w => w.id === realWalletId);
    if (!selectedWallet) {
      setErrorMsg('Seleccione una billetera válida.');
      return;
    }

    if (selectedWallet.saldoUsdt < usdtSold) {
      setErrorMsg(`Saldo en USDT insuficiente en ${selectedWallet.name}. Disponible: ${formatUsdt(selectedWallet.saldoUsdt, 2)} USDT. Se necesitan vender ${formatUsdt(usdtSold, 2)} USDT.`);
      return;
    }

    setErrorMsg('');

    // Trigger sale transaction (deducts usdtSold, adds pesosUsed back, calculates gain in pesos)
    onAddTransaction({
      type: 'venta',
      crypto: 'USDT',
      quantity: usdtSold,
      unitPrice: averageSalePrice,
      totalPesos: pesosUsed,
      walletId: realWalletId,
      walletName: selectedWallet.name,
      operator: 'Calculadora P2P',
      gain: profitPesos, // Profit generated on paper
      notes: notes.trim() || `Fase 2: Venta de USDT recuperando capital + ganancia en saldo USDT (${formatUsdt(profitUsdt)} USDT netos)`,
      shiftId: activeShiftId,
    });

    setSuccessMsg(`🚀 Fase 2 Registrada: Se acreditaron ${formatArs(pesosUsed)} de pesos y se vendieron ${formatUsdt(usdtSold, 2)} USDT en ${selectedWallet.name}. ¡Ganancia retenida: ${formatUsdt(profitUsdt, 4)} USDT!`);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Live Calculator Form Sheet */}
      <div className="lg:col-span-2 bg-binance-card rounded-2xl border border-binance-border p-6 space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <Calculator className="w-5 h-5 text-binance-yellow animate-pulse" />
            Planilla de Arbitraje P2P (USDT)
          </h2>
          <span className="self-start sm:self-auto text-[10px] bg-binance-black border border-binance-border text-binance-yellow px-2.5 py-1 rounded font-bold uppercase font-mono tracking-wider">
            Fórmulas Excel Integradas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-binance-black rounded-xl p-5 border border-binance-border">
          {/* Inputs Column 1 */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-binance-gray uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold font-sans">1</span>
              Ingresos del Ciclo
            </h3>

            {/* Pesos changed */}
            <div className="space-y-1.5">
              <label className="text-xs text-binance-gray font-bold block">
                Pesos Cambiados (ARS)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-binance-gray font-medium text-sm">$</span>
                <input
                  type="number"
                  placeholder="Ej. 1000000"
                  value={pesosInput}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setPesosInput(val);
                  }}
                  className="w-full pl-7 pr-4 py-2 bg-binance-card border border-binance-border rounded-xl text-sm focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-white font-mono font-bold"
                />
              </div>
            </div>

            {/* USDT Bought */}
            <div className="space-y-1.5">
              <label className="text-xs text-binance-gray font-bold block">
                USDT Recibidos
              </label>
              <input
                type="number"
                placeholder="Ej. 600"
                value={usdtInput}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setUsdtInput(val);
                }}
                className="w-full px-4 py-2 bg-binance-card border border-binance-border rounded-xl text-sm focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-white font-mono font-bold"
              />
            </div>
          </div>

          {/* Inputs Column 2 */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-binance-gray uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold font-sans">2</span>
              Comisiones & Rentabilidad
            </h3>

            {/* Fee */}
            <div className="space-y-1.5">
              <label className="text-xs text-binance-gray font-bold block">
                Comisión Binance P2P (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 0.2"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-binance-card border border-binance-border rounded-xl text-sm focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-white font-mono font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-binance-gray font-mono text-xs">%</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[0, 0.1, 0.2, 0.35].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCommissionPercent(v)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                      commissionPercent === v 
                        ? 'bg-binance-yellow text-binance-black border-binance-yellow' 
                        : 'bg-binance-card text-binance-gray border-binance-border hover:text-white'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* desired gain percent */}
            <div className="space-y-1.5">
              <label className="text-xs text-binance-gray font-bold block">
                % Ganancia Deseada en Pesos
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ej. 1.0"
                  value={gainPercent}
                  onChange={(e) => setGainPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-binance-card border border-binance-border rounded-xl text-sm focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-white font-mono font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-binance-gray font-mono text-xs">%</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[0.5, 1.0, 1.5, 2.0].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGainPercent(v)}
                    className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                      gainPercent === v 
                        ? 'bg-binance-yellow text-binance-black border-binance-yellow' 
                        : 'bg-binance-card text-binance-gray border-binance-border hover:text-white'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Note / Details */}
        <div className="space-y-1.5">
          <label className="text-xs text-binance-gray font-bold block">
            Detalle / Nota de Simulación
          </label>
          <input
            type="text"
            placeholder="Ej. Arbitraje Lemon -> Mercado Pago con 1% de margen"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden text-white"
          />
        </div>

        {/* EXCEL SHEET SIMULATION CARD (High Fidelity matching Excel) */}
        <div className="border border-emerald-500/30 rounded-2xl overflow-hidden shadow-lg">
          {/* Green Table Header */}
          <div className="bg-[#22c55e] px-5 py-3 flex justify-between items-center text-white font-bold font-sans tracking-wide">
            <span className="text-sm font-extrabold uppercase flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-white" /> RESULTADOS AUTOMÁTICOS
            </span>
            <span className="text-[10px] bg-emerald-700/50 px-2 py-0.5 rounded text-white font-mono uppercase font-bold">
              PLANILLA EXCEL
            </span>
          </div>

          {/* Table Body */}
          <div className="bg-[#101712] border-t border-emerald-500/20 divide-y divide-[#1e291f]/40 font-mono text-sm">
            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Precio promedio de compra
              </div>
              <div className="text-white text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatArs(averagePurchasePrice, true)}
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  (Pesos * (1 - Comisión)) / USDT
                </span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Cantidad total de USDT vendidos
              </div>
              <div className="text-[#fcd535] text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatUsdt(usdtSold, 4)} USDT
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  USDT comprados - Ganancia USDT
                </span>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Precio promedio de venta
              </div>
              <div className="text-white text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatArs(averageSalePrice, true)}
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  Pesos / USDT vendidos
                </span>
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Ganancia en pesos
              </div>
              <div className="text-[#22c55e] text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatArs(profitPesos, false)}
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  Pesos * % ganancia
                </span>
              </div>
            </div>

            {/* Row 5 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Ganancia en USDT
              </div>
              <div className="text-[#22c55e] text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatUsdt(profitUsdt, 4)} USDT
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  Ganancia pesos / P. Promedio Compra
                </span>
              </div>
            </div>

            {/* Row 6 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-5 py-3 hover:bg-emerald-500/5 transition-all bg-emerald-500/5">
              <div className="text-[#a3b899] font-sans font-bold text-xs flex items-center">
                Control: pesos recibidos por venta
              </div>
              <div className="text-white text-base font-extrabold sm:col-span-2 flex items-center gap-1">
                {formatArs(controlPesosReceived, false)}
                <span className="text-[10px] text-binance-gray font-sans font-normal ml-2">
                  USDT vendidos * Precio promedio venta
                </span>
              </div>
            </div>
          </div>

          {/* Table Footer Warning */}
          <div className="bg-[#151f17] border-t border-emerald-500/20 px-5 py-3 text-xs text-binance-gray italic leading-snug">
            ⚠️ <strong>Importante:</strong> la ganancia en USDT se muestra con coma decimal. Ej: 6,0120 USDT = aprox. 6 dólares, no 6 mil.
          </div>
        </div>

        {/* Save / Save Simulation Actions */}
        <div className="flex flex-col md:flex-row gap-3 pt-2">
          <button
            onClick={handleSaveCalculation}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-binance-black hover:bg-binance-black/80 text-white font-extrabold rounded-xl text-xs transition-all border border-binance-border cursor-pointer"
          >
            <Save className="w-4 h-4 text-binance-yellow" />
            Guardar Simulación en Historial
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-binance-red/20 border border-binance-red/40 rounded-xl text-binance-red text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-binance-green/20 border border-binance-green/40 rounded-xl text-binance-green text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Excel Explanation Section (Image 1 - Cómo funciona) */}
      <div className="space-y-6">
        <div className="bg-binance-card rounded-2xl border border-binance-border p-5 space-y-4 shadow-md">
          <h3 className="text-xs font-bold text-binance-gray uppercase tracking-wider flex items-center gap-1.5 border-b border-binance-border/40 pb-2">
            <HelpCircle className="w-4 h-4 text-binance-yellow" />
            ¿CÓMO FUNCIONA EL MODELO?
          </h3>

          <div className="relative pl-6 border-l border-binance-border/60 space-y-6 font-sans text-xs">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold">
                1
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white">Pesos Cambiados</h4>
                <p className="text-binance-gray text-[11px] leading-relaxed">
                  Ingresas el capital en pesos ARS con el que deseas iniciar la compra de criptomonedas.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold">
                2
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white">Precio Promedio Compra</h4>
                <p className="text-binance-gray text-[11px] leading-relaxed">
                  Calcula el costo unitario real de cada USDT deduciendo la comisión cobrada por el mercado.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold">
                3
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white">Ganancia en USDT</h4>
                <p className="text-binance-gray text-[11px] leading-relaxed">
                  Calcula cuántos USDT deseas conservar en tu saldo como beneficio directo, basado en tu porcentaje meta.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold">
                4
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white">USDT Vendidos</h4>
                <p className="text-binance-gray text-[11px] leading-relaxed">
                  Determina la cantidad de criptomonedas que debes vender en el mercado para recuperar exactamente tu capital en pesos invertido.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-binance-yellow text-binance-black flex items-center justify-center text-[10px] font-extrabold">
                5
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-white">Precio Promedio Venta</h4>
                <p className="text-binance-gray text-[11px] leading-relaxed">
                  Establece el precio mínimo al cual debes publicar tus anuncios de venta para lograr retener tu beneficio en la billetera.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History of Simulation calculations */}
        <div className="bg-binance-card rounded-2xl border border-binance-border p-5 space-y-4 shadow-md">
          <h3 className="text-xs font-bold text-binance-gray uppercase tracking-wider flex items-center gap-1.5 border-b border-binance-border/40 pb-2">
            <History className="w-4 h-4 text-binance-yellow" />
            Historial de Simulaciones
          </h3>

          {p2pCalcs.length === 0 ? (
            <p className="text-xs text-binance-gray italic">No hay cálculos guardados en esta sesión.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {p2pCalcs.map((c, idx) => (
                <div key={c.id || idx} className="p-3 bg-binance-black rounded-xl border border-binance-border space-y-2 text-xs">
                  <div className="flex justify-between items-center text-binance-gray text-[10px] font-mono">
                    <span>{new Date(c.timestamp).toLocaleString('es-AR')}</span>
                    <span className="bg-binance-card text-binance-yellow border border-binance-border px-1.5 py-0.5 rounded font-bold">
                      Comisión {c.commissionPercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-binance-gray block">Pesos Utilizados</span>
                      <span className="font-bold text-white">{formatArs(c.pesosUsed)}</span>
                    </div>
                    <div>
                      <span className="text-binance-gray block">P. Promedio Compra</span>
                      <span className="font-bold text-white">{formatArs(c.averagePrice, true)}</span>
                    </div>
                  </div>

                  <div className="border-t border-binance-border/40 pt-1.5 flex justify-between items-center font-mono">
                    <div>
                      <span className="text-[10px] text-binance-gray block">Margen Conservado</span>
                      <span className="font-bold text-binance-green">+{formatArs(c.netProfit)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-binance-gray block">Rentabilidad</span>
                      <span className="font-bold text-binance-yellow">{c.profitabilityPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                  {c.notes && (
                    <div className="text-[10px] text-binance-gray bg-binance-card px-2 py-1 rounded border border-binance-border/40 italic">
                      "{c.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

