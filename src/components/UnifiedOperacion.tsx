/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Transaction, User as UserType } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clipboard,
  Coins,
  Wallet as WalletIcon,
  Tag,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Calculator,
  Percent,
  Copy,
  Info,
  DollarSign,
  Database,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface UnifiedOperacionProps {
  wallets: Wallet[];
  currentUser: UserType | null;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => void;
  transactions: Transaction[];
}

export default function UnifiedOperacion({
  wallets,
  currentUser,
  onAddTransaction,
  transactions,
}: UnifiedOperacionProps) {
  // Form type
  const [type, setType] = useState<'compra' | 'venta'>('compra');
  
  // General inputs
  const [usuario, setUsuario] = useState(''); // Contraparte / Proveedor / Cliente
  const [crypto, setCrypto] = useState('USDT');
  const [customCrypto, setCustomCrypto] = useState('');
  const [walletId, setWalletId] = useState('');
  const [notes, setNotes] = useState('');

  // COMPRA inputs
  const [cantidadComprada, setCantidadComprada] = useState<number | ''>('');
  const [montoPagado, setMontoPagado] = useState<number | ''>('');
  const [exchangeUsed, setExchangeUsed] = useState('Binance');
  const [customExchange, setCustomExchange] = useState('');
  const [comisionExchange, setComisionExchange] = useState<number>(0.1); // Default 0.1%
  const [gananciaConfigurada, setGananciaConfigurada] = useState<number>(1.5); // Default 1.5%

  // VENTA inputs
  const [cantidadVendida, setCantidadVendida] = useState<number | ''>('');
  const [precioVenta, setPrecioVenta] = useState<number | ''>('');
  const [metodoPago, setMetodoPago] = useState('Transferencia Bancaria');
  const [customMetodoPago, setCustomMetodoPago] = useState('');

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Motor de Costos - Interactive UI State
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTabDetail, setActiveTabDetail] = useState<'lotes' | 'history' | 'formula'>('lotes');

  // Scroll to Cost Engine anchor
  const scrollToCostEngine = () => {
    setDetailOpen(true);
    setTimeout(() => {
      const element = document.getElementById('motor-de-costos-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Live Clock
  const [systemTime, setSystemTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Set default wallet
  useEffect(() => {
    if (wallets.length > 0 && !walletId) {
      setWalletId(wallets[0].id);
    }
  }, [wallets, walletId]);

  const selectedWallet = wallets.find(w => w.id === walletId);
  const finalCrypto = crypto === 'custom' ? customCrypto.trim().toUpperCase() : crypto;
  const finalExchange = exchangeUsed === 'custom' ? customExchange.trim() : exchangeUsed;
  const finalMetodoPago = metodoPago === 'custom' ? customMetodoPago.trim() : metodoPago;

  // Paste helper from clipboard for the contraparte
  const handlePasteUsuario = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUsuario(text);
      }
    } catch (err) {
      console.warn('No se pudo acceder al portapapeles', err);
    }
  };

  // 1. Math calculations for COMPRA matching Excel spreadsheet formulas
  const valCantidadComprada = typeof cantidadComprada === 'number' ? cantidadComprada : 0;
  const valMontoPagado = typeof montoPagado === 'number' ? montoPagado : 0;
  const commissionRate = comisionExchange / 100;
  const desiredGainRate = gananciaConfigurada / 100;

  // Formula 1: Precio promedio compra = (Pesos * (1 - Comisión)) / USDT comprados (C11)
  const precioPromedioCompra = valCantidadComprada > 0 ? (valMontoPagado * (1 - commissionRate)) / valCantidadComprada : 0;

  // Formula 2: Ganancia pesos = Pesos * % ganancia (C14)
  const gananciaEsperada = valMontoPagado * desiredGainRate;

  // Formula 3: Ganancia USDT = Ganancia pesos / Precio promedio compra (C15)
  const gananciaUsdtCompra = precioPromedioCompra > 0 ? gananciaEsperada / precioPromedioCompra : 0;

  // Formula 4: USDT vendidos = USDT comprados - Ganancia USDT (C12)
  const usdtVendidosCompra = Math.max(0, valCantidadComprada - gananciaUsdtCompra);

  // Formula 5: Precio promedio venta = Pesos / USDT vendidos (C13)
  const precioMinimoRecomendado = usdtVendidosCompra > 0 ? valMontoPagado / usdtVendidosCompra : 0;

  // Keep for reference or UI labels
  const comisionDescontada = valMontoPagado * commissionRate; // Commission in pesos
  const usdtNetosRecibidos = valCantidadComprada; // Raw amount credited in this model
  const costoRealUsdt = precioPromedioCompra;

  // 2. Math calculations for VENTA via WAC (Weighted Average Cost)
  // Re-designed "Motor de Costos" FIFO Batch Inventory & WAC History Calculator
  const motorDeCostos = useMemo(() => {
    const cryptoName = finalCrypto || 'USDT';
    
    // Calculate total starting balance globally across all wallets
    const currentTotalWalletCrypto = wallets.reduce((sum, w) => sum + (w.saldoUsdt || 0), 0);
    
    // Total changes from registered transactions of this specific crypto
    const netTxCrypto = transactions.reduce((sum, t) => {
      if (t.crypto !== cryptoName) return sum;
      if (t.type === 'compra') return sum + t.quantity;
      if (t.type === 'venta') return sum - t.quantity;
      return sum;
    }, 0);

    // Initial stock baseline that exists in system prior to transactions
    const baselineStock = Math.max(0, currentTotalWalletCrypto - netTxCrypto);
    const baselinePrice = 1200; // Typical default starting baseline in ARS/USDT

    // Lots array with full audit details
    const lotesList: Array<{
      id: string;
      title: string;
      timestamp: number;
      dateStr: string;
      timeStr: string;
      initialQuantity: number;
      remainingQuantity: number;
      price: number;
      walletName: string;
      exchange: string;
      commission: number;
      status: 'Disponible' | 'Parcial' | 'Agotado';
      consumedBy: Array<{ txId: string; quantity: number; dateStr: string; client?: string }>;
    }> = [];

    if (baselineStock > 0) {
      lotesList.push({
        id: 'baseline',
        title: 'Lote #000 (S. Inicial)',
        timestamp: 0,
        dateStr: 'Pre-sistema',
        timeStr: '-',
        initialQuantity: baselineStock,
        remainingQuantity: baselineStock,
        price: baselinePrice,
        walletName: 'Varias (Saldo Inicial)',
        exchange: 'Inventario Inicial',
        commission: 0,
        status: 'Disponible',
        consumedBy: []
      });
    }

    // Process transactions sequentially to allocate and consume lots
    const sortedTxs = [...transactions]
      .filter(t => t.crypto === cryptoName)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Historical records of WAC changing over time
    const wacHistory: Array<{
      txId: string;
      timestamp: string;
      type: 'compra' | 'venta';
      quantity: number;
      price: number;
      resultingWac: number;
      resultingStock: number;
      counterparty: string;
      walletName: string;
    }> = [];

    // Helper to calculate active WAC and remaining stock at any point
    const getWacAndStockState = (currentLots: typeof lotesList) => {
      let activeStock = 0;
      let activeCost = 0;
      for (const l of currentLots) {
        if (l.remainingQuantity > 0) {
          activeStock += l.remainingQuantity;
          activeCost += l.remainingQuantity * l.price;
        }
      }
      const wac = activeStock > 0 ? activeCost / activeStock : baselinePrice;
      return { wac, stock: activeStock };
    };

    // Sequentially process each transaction
    for (const tx of sortedTxs) {
      if (tx.type === 'compra') {
        const exchangeName = tx.notes?.split('|').find(p => p.includes('Exchange:'))?.split('Exchange:')[1]?.trim() || 'Binance';
        const commissionPct = tx.commissionBinance || 0;

        lotesList.push({
          id: tx.id,
          title: `Lote #${tx.id.substring(0, 5).toUpperCase()}`,
          timestamp: new Date(tx.timestamp).getTime(),
          dateStr: tx.dateString || new Date(tx.timestamp).toLocaleDateString('es-AR'),
          timeStr: tx.timeString || new Date(tx.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          initialQuantity: tx.quantity,
          remainingQuantity: tx.quantity,
          price: tx.unitPrice,
          walletName: tx.walletName,
          exchange: exchangeName,
          commission: commissionPct,
          status: 'Disponible',
          consumedBy: []
        });
      } else if (tx.type === 'venta') {
        let amountToConsume = tx.quantity;
        for (const lot of lotesList) {
          if (amountToConsume <= 0) break;
          if (lot.remainingQuantity > 0) {
            const taken = Math.min(lot.remainingQuantity, amountToConsume);
            lot.remainingQuantity -= taken;
            amountToConsume -= taken;
            lot.consumedBy.push({
              txId: tx.id,
              quantity: taken,
              dateStr: tx.dateString || new Date(tx.timestamp).toLocaleDateString('es-AR'),
              client: tx.client || 'Cliente P2P'
            });

            if (lot.remainingQuantity <= 0.00001) {
              lot.remainingQuantity = 0;
              lot.status = 'Agotado';
            } else {
              lot.status = 'Parcial';
            }
          }
        }
      }

      const stateAtPoint = getWacAndStockState(lotesList);
      wacHistory.push({
        txId: tx.id,
        timestamp: tx.timestamp,
        type: tx.type as 'compra' | 'venta',
        quantity: tx.quantity,
        price: tx.unitPrice,
        resultingWac: stateAtPoint.wac,
        resultingStock: stateAtPoint.stock,
        counterparty: tx.client || tx.supplier || 'N/A',
        walletName: tx.walletName
      });
    }

    // Final calculations
    let totalRemainingStock = 0;
    let totalRemainingCost = 0;
    let activePurchasesCount = 0;

    for (const l of lotesList) {
      if (l.remainingQuantity > 0) {
        totalRemainingStock += l.remainingQuantity;
        totalRemainingCost += l.remainingQuantity * l.price;
        activePurchasesCount += 1;
      }
    }

    const currentWacValue = totalRemainingStock > 0 ? totalRemainingCost / totalRemainingStock : baselinePrice;
    
    let lastUpdateLabel = 'Sin transacciones';
    if (sortedTxs.length > 0) {
      const lastTx = sortedTxs[sortedTxs.length - 1];
      const d = new Date(lastTx.timestamp);
      lastUpdateLabel = `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return {
      lotes: lotesList,
      currentWAC: currentWacValue,
      historyWAC: wacHistory.reverse(), // Newest first
      totalRemainingStock,
      totalRemainingCost,
      activePurchasesCount,
      lastUpdateLabel
    };
  }, [transactions, wallets, finalCrypto]);

  const currentWAC = motorDeCostos.currentWAC;

  const valCantidadVendida = typeof cantidadVendida === 'number' ? cantidadVendida : 0;
  const valPrecioVenta = typeof precioVenta === 'number' ? precioVenta : 0;

  const montoRecibido = valCantidadVendida * valPrecioVenta;
  const costoHistorico = currentWAC * valCantidadVendida;
  const gananciaReal = montoRecibido - costoHistorico;
  const gananciaPorcentual = costoHistorico > 0 ? (gananciaReal / costoHistorico) * 100 : 0;
  const gananciaUsdt = valPrecioVenta > 0 ? gananciaReal / valPrecioVenta : 0;

  const isLoss = valPrecioVenta > 0 && valPrecioVenta < currentWAC;

  // Sidebar metrics
  const lastCompra = useMemo(() => {
    return transactions.find(t => t.type === 'compra' && t.crypto === finalCrypto);
  }, [transactions, finalCrypto]);

  const lastVenta = useMemo(() => {
    return transactions.find(t => t.type === 'venta' && t.crypto === finalCrypto);
  }, [transactions, finalCrypto]);

  const accumulatedGain = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.gain || 0), 0);
  }, [transactions]);

  // Format Helpers
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatCryptoVal = (val: number) => {
    return val.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  };

  // Clipboard copy handler for smart summaries
  const handleCopySummary = () => {
    let summaryText = '';
    if (type === 'compra') {
      summaryText = `📋 RESUMEN DE COMPRA P2P (${finalCrypto})
---------------------------------------
Operador: ${currentUser?.name || 'Manual'}
Proveedor: ${usuario || 'N/A'}
Exchange: ${finalExchange} (Comisión: ${comisionExchange}%)
Monto Invertido: ${formatMoney(valMontoPagado)}
Cantidad Recibida: ${formatCryptoVal(valCantidadComprada)} ${finalCrypto}
Comisión Descontada: ${formatCryptoVal(comisionDescontada)} ${finalCrypto}
USDT Netos Recibidos: ${formatCryptoVal(usdtNetosRecibidos)} ${finalCrypto}
Costo Real por USDT: ${formatMoney(costoRealUsdt)}
Margen Esperado: ${gananciaConfigurada}%
Venta Mínima Recomendada: ${formatMoney(precioMinimoRecomendado)}`;
    } else {
      summaryText = `📋 RESUMEN DE VENTA P2P (${finalCrypto})
---------------------------------------
Operador: ${currentUser?.name || 'Manual'}
Cliente: ${usuario || 'N/A'}
Método de Pago: ${finalMetodoPago}
Monto Recibido: ${formatMoney(montoRecibido)}
Cantidad Vendida: ${formatCryptoVal(valCantidadVendida)} ${finalCrypto}
Costo Promedio Ponderado (WAC): ${formatMoney(currentWAC)}
Costo Histórico Total: ${formatMoney(costoHistorico)}
Ganancia Neta Real: ${formatMoney(gananciaReal)} (${gananciaPorcentual.toFixed(2)}%)
Ganancia en USDT: ${formatCryptoVal(gananciaUsdt)} ${finalCrypto}`;
    }

    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      setErrorMsg('⚠️ Debe iniciar sesión con su usuario para registrar operaciones.');
      return;
    }

    if (!walletId) {
      setErrorMsg('Debe seleccionar una billetera.');
      return;
    }

    if (!finalCrypto) {
      setErrorMsg('Debe especificar la criptomoneda.');
      return;
    }

    if (type === 'compra') {
      if (valCantidadComprada <= 0) {
        setErrorMsg('La cantidad comprada debe ser un número positivo.');
        return;
      }
      if (valMontoPagado <= 0) {
        setErrorMsg('El monto pagado en pesos debe ser un número positivo.');
        return;
      }
      if (selectedWallet && selectedWallet.saldoPesos < valMontoPagado) {
        setErrorMsg(`Saldo en Pesos insuficiente en ${selectedWallet.name}. Disponible: ${formatMoney(selectedWallet.saldoPesos)}. Requerido: ${formatMoney(valMontoPagado)}`);
        return;
      }
    } else {
      if (valCantidadVendida <= 0) {
        setErrorMsg('La cantidad vendida debe ser un número positivo.');
        return;
      }
      if (valPrecioVenta <= 0) {
        setErrorMsg('El precio de venta debe ser un número positivo.');
        return;
      }
      if (selectedWallet && selectedWallet.saldoUsdt < valCantidadVendida) {
        setErrorMsg(`Saldo en Cripto insuficiente en ${selectedWallet.name}. Disponible: ${selectedWallet.saldoUsdt.toFixed(4)} ${finalCrypto}. Requerido: ${valCantidadVendida.toFixed(4)} ${finalCrypto}`);
        return;
      }
    }

    setErrorMsg('');

    const formattedNotes = [
      notes.trim(),
      type === 'compra' ? `Exchange: ${finalExchange} | Com.: ${comisionExchange}%` : `Pago: ${finalMetodoPago}`,
      type === 'compra' ? `Margen: ${gananciaConfigurada}%` : `Ganancia: ${formatMoney(gananciaReal)} (${gananciaPorcentual.toFixed(1)}%)`,
    ].filter(Boolean).join(' | ');

    onAddTransaction({
      type,
      crypto: finalCrypto,
      quantity: type === 'compra' ? usdtNetosRecibidos : valCantidadVendida,
      unitPrice: type === 'compra' ? costoRealUsdt : valPrecioVenta,
      totalPesos: type === 'compra' ? valMontoPagado : montoRecibido,
      walletId,
      walletName: selectedWallet?.name || 'Billetera',
      operator: currentUser.name,
      supplier: type === 'compra' ? (usuario.trim() || 'Proveedor P2P') : undefined,
      client: type === 'venta' ? (usuario.trim() || 'Cliente P2P') : undefined,
      gain: type === 'venta' ? gananciaReal : undefined,
      commissionBinance: type === 'compra' ? comisionExchange : undefined,
      notes: formattedNotes || undefined,
    });

    setSuccessMsg(`✅ Operación de ${type === 'venta' ? 'VENTA' : 'COMPRA'} registrada con éxito. Saldo de la wallet actualizado.`);
    
    // Reset inputs
    setUsuario('');
    setCantidadComprada('');
    setMontoPagado('');
    setCantidadVendida('');
    setPrecioVenta('');
    setNotes('');
    setCustomCrypto('');
    setCustomExchange('');
    setCustomMetodoPago('');

    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const recentTxs = transactions.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-binance-card p-4 border border-binance-border rounded-2xl shadow-md">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-display flex items-center gap-2">
            <Coins className="w-7 h-7 text-binance-yellow" />
            Nueva Operación <span className="text-binance-yellow">P2P</span>
          </h1>
          <p className="text-xs text-binance-gray">
            Centro inteligente de trading con cálculo automático de comisiones, márgenes y costo promedio ponderado (WAC).
          </p>
        </div>

        {/* Live Status and Clock */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl font-mono text-[11px] text-binance-gray">
            <Clock className="w-3.5 h-3.5 text-binance-yellow animate-pulse" />
            <span>{systemTime.toLocaleDateString('es-AR')}</span>
            <span className="text-white font-bold">{systemTime.toLocaleTimeString('es-AR')}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-binance-black border border-binance-border rounded-xl font-mono text-[11px] text-binance-gray">
            <User className="w-3.5 h-3.5 text-binance-gray" />
            <span>Operador:</span>
            <span className="text-binance-yellow font-bold">{currentUser?.name || 'Invitado'}</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-binance-green/10 border border-binance-green/30 rounded-xl flex items-center gap-3 text-binance-green text-sm shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-binance-red/10 border border-binance-red/30 rounded-xl flex items-center gap-3 text-binance-red text-sm shadow-sm"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </motion.div>
      )}

      {/* Main Grid Layout: Form and Intelligence (2 cols) vs Sidebar (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Form and Intelligent Calculations) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card Form */}
          <div className="bg-binance-card border border-binance-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
            
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-5 rounded-full transition-all duration-500 ${
              type === 'compra' ? 'bg-binance-red' : 'bg-binance-green'
            }`} />

            {/* Form Mode Selector */}
            <div className="flex p-1.5 bg-binance-black border border-binance-border rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setType('compra')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold font-mono text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'compra'
                    ? 'bg-binance-red text-white shadow-md'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                REGISTRAR COMPRA (INFLOW)
              </button>
              <button
                type="button"
                onClick={() => setType('venta')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold font-mono text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'venta'
                    ? 'bg-binance-green text-binance-black shadow-md'
                    : 'text-binance-gray hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                REGISTRAR VENTA (OUTFLOW)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Common section for both COMPRA and VENTA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Contraparte Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                    {type === 'compra' ? 'Proveedor / Contraparte' : 'Cliente / Contraparte'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder={type === 'compra' ? 'Ej: Binance Seller' : 'Ej: Cliente P2P'}
                      className="w-full pl-4 pr-12 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-semibold"
                    />
                    <button
                      type="button"
                      onClick={handlePasteUsuario}
                      title="Pegar desde Portapapeles"
                      className="absolute right-3 top-2.5 p-1 text-binance-gray hover:text-binance-yellow transition-colors cursor-pointer"
                    >
                      <Clipboard className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cryptocurrency Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                    Criptomoneda
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={crypto}
                      onChange={(e) => setCrypto(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer font-bold"
                    >
                      <option value="USDT">USDT (Tether)</option>
                      <option value="BTC">BTC (Bitcoin)</option>
                      <option value="ETH">ETH (Ethereum)</option>
                      <option value="USDC">USDC (USD Coin)</option>
                      <option value="SOL">SOL (Solana)</option>
                      <option value="custom">Otra...</option>
                    </select>

                    {crypto === 'custom' && (
                      <input
                        type="text"
                        value={customCrypto}
                        onChange={(e) => setCustomCrypto(e.target.value)}
                        placeholder="Cripto"
                        className="w-24 px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden uppercase font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* DYNAMIC FORM SECTION: COMPRA vs VENTA */}
              <AnimatePresence mode="wait">
                {type === 'compra' ? (
                  <motion.div
                    key="compra-inputs"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {/* Cantidad Comprada */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Cantidad Comprada ({finalCrypto})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={cantidadComprada}
                          onChange={(e) => setCantidadComprada(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                        />
                        <div className="absolute right-4 top-3 text-xs text-binance-gray font-bold">
                          {finalCrypto}
                        </div>
                      </div>
                    </div>

                    {/* Monto Pagado */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Monto Pagado (ARS)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={montoPagado}
                          onChange={(e) => setMontoPagado(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                        />
                        <div className="absolute left-4 top-3 text-xs text-binance-gray font-bold">
                          $
                        </div>
                      </div>
                    </div>

                    {/* Exchange Utilizado */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Exchange Utilizado
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={exchangeUsed}
                          onChange={(e) => setExchangeUsed(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer"
                        >
                          <option value="Binance">Binance</option>
                          <option value="Lemon Cash">Lemon Cash</option>
                          <option value="Belo">Belo</option>
                          <option value="Fiwind">Fiwind</option>
                          <option value="Ripio">Ripio</option>
                          <option value="custom">Otro...</option>
                        </select>

                        {exchangeUsed === 'custom' && (
                          <input
                            type="text"
                            value={customExchange}
                            onChange={(e) => setCustomExchange(e.target.value)}
                            placeholder="Exchange"
                            className="w-28 px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden"
                          />
                        )}
                      </div>
                    </div>

                    {/* Comisión del Exchange (%) and Ganancia Configurada (%) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block leading-tight">
                          Comisión (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={comisionExchange}
                            onChange={(e) => setComisionExchange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            placeholder="0.10"
                            className="w-full px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono text-center"
                          />
                          <div className="absolute right-2.5 top-3 text-xs text-binance-gray">%</div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block leading-tight">
                          Margen Esperado (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={gananciaConfigurada}
                            onChange={(e) => setGananciaConfigurada(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            placeholder="1.5"
                            className="w-full px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono text-center"
                          />
                          <div className="absolute right-2.5 top-3 text-xs text-binance-gray">%</div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="venta-inputs"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {/* Cantidad Vendida */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Cantidad Vendida ({finalCrypto})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={cantidadVendida}
                          onChange={(e) => setCantidadVendida(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                        />
                        <div className="absolute right-4 top-3 text-xs text-binance-gray font-bold">
                          {finalCrypto}
                        </div>
                      </div>
                    </div>

                    {/* Precio Unitario de Venta */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Precio Unitario de Venta (ARS)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={precioVenta}
                          onChange={(e) => setPrecioVenta(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="Ej: 1300"
                          className="w-full pl-8 pr-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden font-mono"
                        />
                        <div className="absolute left-4 top-3 text-xs text-binance-gray font-bold">
                          $
                        </div>
                      </div>
                    </div>

                    {/* Método de Pago */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                        Método de Pago Recibido
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={metodoPago}
                          onChange={(e) => setMetodoPago(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer"
                        >
                          <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                          <option value="Mercado Pago">Mercado Pago</option>
                          <option value="Lemon Cash">Lemon Cash</option>
                          <option value="Efectivo ARS">Efectivo ARS</option>
                          <option value="Efectivo USD">Efectivo USD</option>
                          <option value="custom">Otro...</option>
                        </select>

                        {metodoPago === 'custom' && (
                          <input
                            type="text"
                            value={customMetodoPago}
                            onChange={(e) => setCustomMetodoPago(e.target.value)}
                            placeholder="Método"
                            className="w-28 px-3 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden"
                          />
                        )}
                      </div>
                    </div>

                    {/* Weighted Average Cost display badge */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                          Costo de Inventario (WAC)
                        </label>
                        <button
                          type="button"
                          onClick={scrollToCostEngine}
                          className="text-[10px] text-binance-yellow hover:underline flex items-center gap-1 font-mono cursor-pointer"
                        >
                          <Info className="w-3 h-3" /> Ver Detalle / Auditoría
                        </button>
                      </div>
                      <div 
                        onClick={scrollToCostEngine}
                        className="px-4 py-3 bg-binance-black hover:bg-binance-black/80 border border-binance-border rounded-xl text-white font-mono text-sm flex justify-between items-center h-[46px] cursor-pointer transition-colors"
                        title="Haga clic para ver el cálculo completo del Motor de Costos"
                      >
                        <span className="text-binance-gray text-xs">Ponderado Promedio:</span>
                        <span className="font-extrabold text-binance-yellow flex items-center gap-1.5">
                          {formatMoney(currentWAC)}
                          <Sparkles className="w-3.5 h-3.5 text-binance-yellow animate-pulse" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Wallet select + Observations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Wallet select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                    Billetera Utilizada
                  </label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden cursor-pointer"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} (ARS: ${w.saldoPesos.toLocaleString('es-AR')} | {finalCrypto}: {w.saldoUsdt.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Additional Observaciones */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-binance-gray uppercase tracking-wider block">
                    Observaciones
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas internas de auditoría..."
                    rows={1}
                    className="w-full px-4 py-2.5 bg-binance-black border border-binance-border rounded-xl text-white focus:ring-2 focus:ring-binance-yellow/20 focus:border-binance-yellow transition-all text-sm outline-hidden resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-4 rounded-2xl font-bold font-mono transition-all transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    type === 'compra' 
                      ? 'bg-binance-red text-white hover:bg-binance-red/90 border border-transparent' 
                      : 'bg-binance-green text-binance-black hover:bg-binance-green/90 border border-transparent'
                  }`}
                >
                  {type === 'compra' ? (
                    <>
                      <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                      REGISTRAR COMPRA DE {finalCrypto}
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                      REGISTRAR VENTA DE {finalCrypto}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* REALTIME LIVE SUMMARY RECEIPT */}
          <div className="bg-binance-card border border-binance-border rounded-3xl p-6 shadow-xl relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-binance-black/60 hover:bg-binance-black border border-binance-border rounded-xl text-binance-gray hover:text-white transition-all text-[11px] font-mono cursor-pointer"
              >
                {copiedText ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-binance-green" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Datos</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <Calculator className="w-5 h-5 text-binance-yellow" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Resumen Inteligente en Tiempo Real
              </h2>
            </div>

            {type === 'compra' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Pesos Cambiados</span>
                  <span className="text-sm font-extrabold text-white font-mono block">
                    {formatMoney(valMontoPagado)}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Monto invertido</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">USDT Comprados</span>
                  <span className="text-sm font-extrabold text-white font-mono block">
                    {formatCryptoVal(valCantidadComprada)} {finalCrypto}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Cantidad bruta</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Comisión Exchange</span>
                  <span className="text-sm font-extrabold text-binance-red font-mono block">
                    {comisionExchange}%
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Maker fee</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1 border-binance-yellow/20">
                  <span className="text-[10px] text-binance-yellow uppercase font-bold tracking-wider block">Precio Prom. Compra</span>
                  <span className="text-sm font-extrabold text-binance-yellow font-mono block">
                    {formatMoney(precioPromedioCompra)}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">(Pesos * (1 - Com.)) / USDT</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Ganancia Pesos</span>
                  <span className="text-sm font-extrabold text-binance-green font-mono block">
                    {formatMoney(gananciaEsperada)}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Pesos * % Ganancia</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Ganancia USDT</span>
                  <span className="text-sm font-extrabold text-binance-green font-mono block">
                    {formatCryptoVal(gananciaUsdtCompra)} {finalCrypto}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Ganancia pesos / Precio prom.</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                  <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">USDT Vendidos</span>
                  <span className="text-sm font-extrabold text-white font-mono block">
                    {formatCryptoVal(usdtVendidosCompra)} {finalCrypto}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">USDT comp. - Ganancia USDT</span>
                </div>

                <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1 border-binance-green/20 premium-glow-green">
                  <span className="text-[10px] text-binance-green uppercase font-bold tracking-wider block">Precio Prom. Venta</span>
                  <span className="text-sm font-extrabold text-binance-green font-mono block">
                    {formatMoney(precioMinimoRecomendado)}
                  </span>
                  <span className="text-[9px] text-binance-gray font-mono block">Pesos / USDT vendidos</span>
                </div>

              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Monto a Recibir</span>
                    <span className="text-sm font-extrabold text-white font-mono block">
                      {formatMoney(montoRecibido)}
                    </span>
                    <span className="text-[9px] text-binance-gray font-mono block">Monto total ARS</span>
                  </div>

                  <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Cantidad Vendida</span>
                    <span className="text-sm font-extrabold text-white font-mono block">
                      {formatCryptoVal(valCantidadVendida)} {finalCrypto}
                    </span>
                    <span className="text-[9px] text-binance-gray font-mono block">De tu stock</span>
                  </div>

                  <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Costo Inventario (WAC)</span>
                    <span className="text-sm font-extrabold text-binance-yellow font-mono block">
                      {formatMoney(currentWAC)}
                    </span>
                    <span className="text-[9px] text-binance-gray font-mono block">Promedio histórico</span>
                  </div>

                  <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Costo Histórico Total</span>
                    <span className="text-sm font-extrabold text-white font-mono block">
                      {formatMoney(costoHistorico)}
                    </span>
                    <span className="text-[9px] text-binance-gray font-mono block">Costo base de lo vendido</span>
                  </div>

                </div>

                {/* Performance indicators */}
                {valPrecioVenta > 0 && valCantidadVendida > 0 && (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-4 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs ${
                      isLoss 
                        ? 'bg-binance-red/10 border-binance-red/30 text-binance-red' 
                        : 'bg-binance-green/10 border-binance-green/30 text-binance-green'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isLoss ? (
                        <TrendingDown className="w-8 h-8 text-binance-red shrink-0" />
                      ) : (
                        <TrendingUp className="w-8 h-8 text-binance-green shrink-0" />
                      )}
                      <div>
                        <p className="font-extrabold text-sm">
                          {isLoss ? '⚠️ OPERACIÓN CON PÉRDIDA' : '✅ OPERACIÓN CON GANANCIA'}
                        </p>
                        <p className="text-[11px] text-binance-gray">
                          El precio de venta {formatMoney(valPrecioVenta)} es {isLoss ? 'menor' : 'mayor'} que tu costo promedio ponderado de {formatMoney(currentWAC)}.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-right justify-end">
                      <div>
                        <span className="text-[10px] text-binance-gray block uppercase font-bold">Rendimiento</span>
                        <span className="text-sm font-extrabold font-mono block">
                          {isLoss ? '' : '+'}{gananciaPorcentual.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-binance-gray block uppercase font-bold">Pesos netos</span>
                        <span className="text-sm font-extrabold font-mono block">
                          {isLoss ? '' : '+'}{formatMoney(gananciaReal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-binance-gray block uppercase font-bold">USDT netos</span>
                        <span className="text-sm font-extrabold font-mono block">
                          {isLoss ? '' : '+'}{formatCryptoVal(gananciaUsdt)} {finalCrypto}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* MOTOR DE COSTOS (WAC) ERP COMPONENT */}
          <div 
            id="motor-de-costos-section"
            className="bg-binance-card border border-binance-border rounded-3xl p-6 shadow-xl relative space-y-5 scroll-mt-6 transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-binance-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-binance-yellow/10 rounded-xl">
                  <Database className="w-5 h-5 text-binance-yellow" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Motor de Costos & Inventario FIFO
                  </h2>
                  <p className="text-[11px] text-binance-gray font-mono">
                    Trazabilidad de lotes de {finalCrypto} en tiempo real
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-binance-black text-binance-gray border border-binance-border px-2.5 py-1 rounded-lg font-mono">
                  Último update: {motorDeCostos.lastUpdateLabel}
                </span>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
              <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Costo Ponderado</span>
                <span className="text-sm md:text-base font-extrabold text-binance-yellow block">
                  {formatMoney(currentWAC)}
                </span>
                <span className="text-[9px] text-binance-gray block">Costo base actual</span>
              </div>

              <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Inventario Activo</span>
                <span className="text-sm md:text-base font-extrabold text-white block">
                  {motorDeCostos.totalRemainingStock.toFixed(2)}
                </span>
                <span className="text-[9px] text-binance-gray block">{finalCrypto} remanente</span>
              </div>

              <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Compras Activas</span>
                <span className="text-sm md:text-base font-extrabold text-binance-green block">
                  {motorDeCostos.activePurchasesCount} {motorDeCostos.activePurchasesCount === 1 ? 'Lote' : 'Lotes'}
                </span>
                <span className="text-[9px] text-binance-gray block">Abiertos en stock</span>
              </div>

              <div className="bg-binance-black/40 p-4 border border-binance-border rounded-2xl space-y-1">
                <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">Inversión Activa</span>
                <span className="text-sm md:text-base font-extrabold text-white block">
                  {formatMoney(motorDeCostos.totalRemainingCost)}
                </span>
                <span className="text-[9px] text-binance-gray block">Valor total ARS</span>
              </div>
            </div>

            {/* Expand toggle */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDetailOpen(!detailOpen)}
                className="w-full py-2.5 bg-binance-black hover:bg-binance-black/80 border border-binance-border rounded-xl text-xs font-bold text-binance-gray hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {detailOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4 text-binance-yellow" />
                    OCULTAR DETALLES DE AUDITORÍA
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 text-binance-yellow" />
                    AUDITAR LOTES, EVOLUCIÓN HISTÓRICA Y FÓRMULA MATEMÁTICA
                  </>
                )}
              </button>
            </div>

            {/* Expanded Auditor Panel */}
            <AnimatePresence>
              {detailOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden space-y-4"
                >
                  <div className="h-px bg-binance-border" />

                  {/* Tabs bar */}
                  <div className="flex border-b border-binance-border/40 gap-1 pb-1">
                    <button
                      type="button"
                      onClick={() => setActiveTabDetail('lotes')}
                      className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTabDetail === 'lotes'
                          ? 'bg-binance-yellow/10 text-binance-yellow border border-binance-yellow/20'
                          : 'text-binance-gray hover:text-white bg-transparent'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Lotes en Inventario
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabDetail('history')}
                      className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTabDetail === 'history'
                          ? 'bg-binance-yellow/10 text-binance-yellow border border-binance-yellow/20'
                          : 'text-binance-gray hover:text-white bg-transparent'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Evolución de Costo
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabDetail('formula')}
                      className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTabDetail === 'formula'
                          ? 'bg-binance-yellow/10 text-binance-yellow border border-binance-yellow/20'
                          : 'text-binance-gray hover:text-white bg-transparent'
                      }`}
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Fórmula de Auditoría
                    </button>
                  </div>

                  {/* Tab Contents */}
                  {activeTabDetail === 'lotes' && (
                    <div className="space-y-3">
                      <div className="overflow-x-auto scrollbar-none">
                        <table className="w-full text-[11px] text-left border-collapse font-mono min-w-[500px]">
                          <thead>
                            <tr className="border-b border-binance-border text-binance-gray uppercase tracking-wider font-bold">
                              <th className="py-2 px-1">Lote / Compra</th>
                              <th className="py-2">Origen / Comisión</th>
                              <th className="py-2 text-right">Cant. Inicial</th>
                              <th className="py-2 text-right">Cant. Restante</th>
                              <th className="py-2 text-right">P. Unitario</th>
                              <th className="py-2 text-center">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {motorDeCostos.lotes.map((lot) => {
                              const pctRemaining = (lot.remainingQuantity / lot.initialQuantity) * 100;
                              const isAgotado = lot.status === 'Agotado';

                              return (
                                <React.Fragment key={lot.id}>
                                  <tr className={`border-b border-binance-border/40 hover:bg-white/5 transition-colors ${
                                    isAgotado ? 'opacity-40 line-through text-binance-gray' : 'text-white'
                                  }`}>
                                    <td className="py-2.5 px-1 font-bold">
                                      <span className="block text-white">{lot.title}</span>
                                      <span className="text-[9px] text-binance-gray block">
                                        {lot.dateStr} {lot.timeStr}
                                      </span>
                                    </td>
                                    <td className="py-2.5">
                                      <span className="block">{lot.exchange}</span>
                                      <span className="text-[9px] text-binance-gray block">
                                        {lot.walletName} | Comisión: {lot.commission}%
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-right font-semibold">
                                      {lot.initialQuantity.toFixed(2)}
                                    </td>
                                    <td className="py-2.5 text-right font-extrabold">
                                      <div className="flex flex-col items-end">
                                        <span>{lot.remainingQuantity.toFixed(2)}</span>
                                        {!isAgotado && (
                                          <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                                            <div 
                                              className="h-full bg-binance-yellow rounded-full" 
                                              style={{ width: `${pctRemaining}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2.5 text-right text-binance-yellow font-extrabold">
                                      {formatMoney(lot.price)}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                        lot.status === 'Disponible'
                                          ? 'bg-binance-green/20 text-binance-green border border-binance-green/30'
                                          : lot.status === 'Parcial'
                                            ? 'bg-binance-yellow/20 text-binance-yellow border border-binance-yellow/30'
                                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                                      }`}>
                                        {lot.status}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Sub-rows for Consumption traceability */}
                                  {lot.consumedBy.length > 0 && (
                                    <tr className="bg-binance-black/20 text-[9px]">
                                      <td colSpan={6} className="py-1 px-3 border-b border-binance-border/20 text-binance-gray">
                                        <div className="flex flex-col gap-1 py-1 font-mono">
                                          <span className="font-bold text-binance-yellow uppercase tracking-wider block text-[8px] mb-0.5">
                                            📦 Traza de consumo en ventas (FIFO):
                                          </span>
                                          {lot.consumedBy.map((c, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-binance-black/40 px-2.5 py-1 rounded-md border border-binance-border/30 my-0.5">
                                              <span className="flex items-center gap-1">
                                                <ArrowRight className="w-2.5 h-2.5 text-binance-red" />
                                                Vendido a <strong className="text-white">{c.client}</strong> el {c.dateStr}
                                              </span>
                                              <span className="text-white font-extrabold">
                                                -{c.quantity.toFixed(2)} {finalCrypto}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-binance-gray italic">
                        * Los lotes con estado <strong className="text-zinc-500">Agotado</strong> ya fueron completamente liquidados por ventas previas y quedan excluidos del cálculo del costo de reposición actual.
                      </p>
                    </div>
                  )}

                  {activeTabDetail === 'history' && (
                    <div className="space-y-3 font-mono text-xs">
                      <p className="text-binance-gray text-[11px]">
                        Registro cronológico de variación del costo ponderado promedio (WAC) según transacciones registradas.
                      </p>

                      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2 scrollbar-none">
                        {motorDeCostos.historyWAC.length === 0 ? (
                          <div className="text-center py-6 text-binance-gray italic text-[11px]">
                            No hay transacciones registradas de {finalCrypto} aún.
                          </div>
                        ) : (
                          motorDeCostos.historyWAC.map((h) => {
                            const isCompra = h.type === 'compra';
                            return (
                              <div 
                                key={h.txId}
                                className={`p-3 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors ${
                                  isCompra 
                                    ? 'bg-binance-red/5 border-binance-red/10 hover:bg-binance-red/10' 
                                    : 'bg-binance-green/5 border-binance-green/10 hover:bg-binance-green/10'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                      isCompra ? 'bg-binance-red/20 text-binance-red' : 'bg-binance-green/20 text-binance-green'
                                    }`}>
                                      {isCompra ? 'COMPRA' : 'VENTA'}
                                    </span>
                                    <span className="text-[10px] text-binance-gray">
                                      {new Date(h.timestamp).toLocaleDateString('es-AR')} {new Date(h.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="text-xs text-white">
                                    <strong className="text-white">{h.quantity.toFixed(2)} {finalCrypto}</strong> a <strong className="text-binance-yellow">{formatMoney(h.price)}</strong>
                                    <span className="text-binance-gray text-[10px] ml-1.5">({isCompra ? 'Proveedor' : 'Cliente'}: {h.counterparty})</span>
                                  </div>
                                </div>

                                <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-binance-border/30 pt-2 md:pt-0 gap-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-binance-gray text-[10px]">WAC Resultante:</span>
                                    <span className="text-xs font-extrabold text-binance-yellow">{formatMoney(h.resultingWac)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-binance-gray text-[9px]">Stock Restante:</span>
                                    <span className="text-[10px] font-bold text-white">{h.resultingStock.toFixed(2)} {finalCrypto}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {activeTabDetail === 'formula' && (
                    <div className="space-y-4 font-mono text-xs">
                      <div className="bg-binance-black/60 p-4 border border-binance-border rounded-2xl space-y-3">
                        <h4 className="text-xs font-bold text-binance-yellow uppercase tracking-wider block">
                          Ecuación Financiera del Promedio Ponderado
                        </h4>
                        
                        <div className="p-3 bg-binance-black/80 rounded-xl border border-binance-border/40 text-center space-y-1">
                          <p className="text-binance-gray text-[10px] uppercase font-bold">Fórmula Teórica</p>
                          <div className="text-xs md:text-sm text-white py-2 font-extrabold overflow-x-auto whitespace-nowrap">
                            WAC = ∑ (Cantidad Remanente * Precio Lote) / ∑ Cantidad Remanente
                          </div>
                        </div>

                        {/* Step by step computation of current stock */}
                        <div className="space-y-2 text-[11px] pt-1">
                          <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block">
                            Aplicación real sobre el inventario activo de {finalCrypto}:
                          </span>

                          {motorDeCostos.lotes.filter(l => l.remainingQuantity > 0).length === 0 ? (
                            <p className="text-binance-gray italic text-center py-2">
                              No hay inventario activo para evaluar.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {/* Numerator products */}
                              <div className="p-3 bg-binance-black/40 rounded-xl border border-binance-border/30 space-y-1.5">
                                <span className="text-[9px] text-binance-gray font-bold block uppercase">
                                  1. Costo Acumulado de Lotes Activos (Numerador):
                                </span>
                                <div className="space-y-1 pl-1">
                                  {motorDeCostos.lotes
                                    .filter(l => l.remainingQuantity > 0)
                                    .map((l) => (
                                      <div key={l.id} className="flex justify-between text-[10px]">
                                        <span className="text-binance-gray">
                                          {l.title} ({l.remainingQuantity.toFixed(2)} {finalCrypto} × {formatMoney(l.price)})
                                        </span>
                                        <span className="text-white font-semibold">
                                          {formatMoney(l.remainingQuantity * l.price)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                                <div className="h-px bg-binance-border/40 my-1" />
                                <div className="flex justify-between text-[10px] font-bold text-white">
                                  <span>COSTO TOTAL REMANENTE:</span>
                                  <span>{formatMoney(motorDeCostos.totalRemainingCost)}</span>
                                </div>
                              </div>

                              {/* Denominator */}
                              <div className="p-3 bg-binance-black/40 rounded-xl border border-binance-border/30 space-y-1 text-[10px]">
                                <span className="text-[9px] text-binance-gray font-bold block uppercase">
                                  2. Stock Total Remanente (Denominador):
                                </span>
                                <div className="flex justify-between text-white pl-1">
                                  <span className="text-binance-gray">Suma de cantidades remanentes:</span>
                                  <span className="font-bold">{motorDeCostos.totalRemainingStock.toFixed(2)} {finalCrypto}</span>
                                </div>
                              </div>

                              {/* Final division */}
                              <div className="p-3 bg-binance-yellow/5 rounded-xl border border-binance-yellow/20 space-y-1 text-[10px]">
                                <span className="text-[9px] text-binance-yellow font-bold block uppercase">
                                  3. División de Auditoría:
                                </span>
                                <div className="flex justify-between items-center text-white pl-1 pt-1 font-bold">
                                  <span className="text-binance-gray">WAC = {formatMoney(motorDeCostos.totalRemainingCost)} / {motorDeCostos.totalRemainingStock.toFixed(2)}</span>
                                  <span className="text-sm text-binance-yellow font-extrabold">{formatMoney(currentWAC)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar Statistics & Audits (1 col) */}
        <div className="space-y-6">
          
          {/* Active Balance Card */}
          <div className="bg-binance-card border border-binance-border rounded-3xl p-5 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-2">
              <WalletIcon className="w-4 h-4 text-binance-yellow" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Billetera Activa
              </h3>
            </div>

            {selectedWallet ? (
              <div className="space-y-4 font-mono">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-binance-gray">Billetera:</span>
                  <span className="font-bold text-white bg-binance-black px-2.5 py-1 rounded-lg border border-binance-border">
                    {selectedWallet.name}
                  </span>
                </div>
                
                <div className="h-px bg-binance-border/60" />

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-binance-gray">Saldo ARS:</span>
                    <span className="font-extrabold text-white text-sm">
                      {formatMoney(selectedWallet.saldoPesos)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-binance-gray">Saldo {finalCrypto}:</span>
                    <span className="font-extrabold text-binance-green text-sm">
                      {selectedWallet.saldoUsdt.toFixed(4)} {finalCrypto}
                    </span>
                  </div>
                </div>

                {/* WAC on selected crypto info */}
                <div 
                  className="p-3 bg-binance-black/40 hover:bg-binance-black/60 border border-binance-border rounded-xl space-y-1.5 cursor-pointer transition-colors" 
                  onClick={scrollToCostEngine} 
                  title="Haga clic para auditar el costo promedio en el Motor de Costos"
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-binance-gray font-bold flex items-center gap-1">
                      COSTO PROMEDIO (WAC): <Info className="w-3 h-3 text-binance-yellow" />
                    </span>
                    <span className="text-binance-yellow font-extrabold">{formatMoney(currentWAC)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-binance-gray font-bold">GANANCIA TOTAL ACUMULADA:</span>
                    <span className="text-binance-green font-extrabold">{formatMoney(accumulatedGain)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-binance-gray italic text-center py-2">Ninguna billetera seleccionada.</p>
            )}
          </div>

          {/* Historical Trade Intel Card */}
          <div className="bg-binance-card border border-binance-border rounded-3xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Info className="w-4 h-4 text-binance-yellow" />
              Últimas Operaciones ({finalCrypto})
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-binance-black/30 border border-binance-border rounded-xl space-y-2">
                <div className="text-[10px] text-binance-gray uppercase font-bold">Última Compra</div>
                {lastCompra ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-white font-bold">
                      <span>{formatCryptoVal(lastCompra.quantity)} {lastCompra.crypto}</span>
                      <span>{formatMoney(lastCompra.totalPesos)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-binance-gray">
                      <span>P. Unit: {formatMoney(lastCompra.unitPrice)}</span>
                      <span>{new Date(lastCompra.timestamp).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-binance-gray italic">No hay registros de compras</div>
                )}
              </div>

              <div className="p-3 bg-binance-black/30 border border-binance-border rounded-xl space-y-2">
                <div className="text-[10px] text-binance-gray uppercase font-bold">Última Venta</div>
                {lastVenta ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-white font-bold">
                      <span>{formatCryptoVal(lastVenta.quantity)} {lastVenta.crypto}</span>
                      <span>{formatMoney(lastVenta.totalPesos)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-binance-gray">
                      <span>P. Unit: {formatMoney(lastVenta.unitPrice)}</span>
                      <span>{new Date(lastVenta.timestamp).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-binance-gray italic">No hay registros de ventas</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent movements list */}
          <div className="bg-binance-card border border-binance-border rounded-3xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex justify-between items-center">
              <span>Últimos Movimientos</span>
              <span className="text-[9px] px-2 py-0.5 bg-binance-black text-binance-gray rounded-md border border-binance-border">Recientes</span>
            </h3>

            <div className="space-y-3 max-h-[220px] overflow-y-auto scrollbar-none">
              {recentTxs.length === 0 ? (
                <p className="text-xs text-binance-gray italic text-center py-4">
                  No hay operaciones registradas aún.
                </p>
              ) : (
                recentTxs.map((t) => (
                  <div key={t.id} className="p-3 bg-binance-black/40 border border-binance-border rounded-xl space-y-1 font-mono">
                    <div className="flex justify-between items-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        t.type === 'venta' 
                          ? 'bg-binance-green/10 text-binance-green' 
                          : t.type === 'compra' 
                            ? 'bg-binance-red/10 text-binance-red' 
                            : 'bg-binance-gray/20 text-binance-gray'
                      }`}>
                        {t.type === 'venta' ? 'VENTA' : t.type === 'compra' ? 'COMPRA' : t.type.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-binance-gray">{t.timeString}</span>
                    </div>

                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-xs text-white font-semibold">
                        {t.quantity.toFixed(4)} {t.crypto}
                      </span>
                      <span className="text-xs text-white font-bold">
                        {formatMoney(t.totalPesos)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-binance-gray">
                      <span>Ref: {t.client || t.supplier || 'P2P'}</span>
                      <span>{t.walletName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
