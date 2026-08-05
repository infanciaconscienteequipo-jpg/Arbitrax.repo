import React from 'react';
import { Bell, ShieldAlert, CheckCircle2, AlertTriangle, WalletCards, ArrowUpRight, ArrowDownLeft, Info } from 'lucide-react';
import { Wallet, Transaction, ExchangeAccount } from '../types';

interface NotificacionesProps {
  wallets: Wallet[];
  exchanges: ExchangeAccount[];
  transactions: Transaction[];
}

export default function Notificaciones({ wallets, exchanges, transactions }: NotificacionesProps) {
  // Generate automatic real-time alerts
  const notifications: Array<{
    id: string;
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'success' | 'info';
    time: string;
  }> = [];

  // Check wallets reaching limits (80%+ threshold as requested)
  wallets.forEach(w => {
    if (w.limitARS && w.limitARS > 0) {
      const percentageUsed = (w.saldoPesos / w.limitARS) * 100;
      if (percentageUsed >= 100) {
        notifications.push({
          id: `limit-exceeded-${w.id}`,
          title: `🚨 Límite Excedido (100%+): ${w.name}`,
          description: `La billetera ${w.name} alcanzó el ${percentageUsed.toFixed(1)}% de su límite asignado ($${w.saldoPesos.toLocaleString('es-AR')} ARS / $${w.limitARS.toLocaleString('es-AR')} ARS). Se recomienda bloquear la billetera para evitar sobreoperar.`,
          type: 'danger',
          time: 'Ahora',
        });
      } else if (percentageUsed >= 80) {
        notifications.push({
          id: `limit-warning-${w.id}`,
          title: `⚠️ Alerta de Límite (80%+ Ocupado): ${w.name}`,
          description: `La billetera ${w.name} ha ocupado el ${percentageUsed.toFixed(1)}% de su límite disponible ($${w.saldoPesos.toLocaleString('es-AR')} ARS sobre un límite de $${w.limitARS.toLocaleString('es-AR')} ARS). Por favor estar atentos.`,
          type: 'warning',
          time: 'Ahora',
        });
      }
    }

    if (w.blocked) {
      notifications.push({
        id: `blocked-${w.id}`,
        title: `🔒 Billetera Bloqueada: ${w.name}`,
        description: `Esta billetera se encuentra suspendida/bloqueada para evitar nuevas cargas u operaciones hasta ser desbloqueada.`,
        type: 'danger',
        time: 'Activo',
      });
    }
  });

  // Check low crypto in exchanges
  exchanges.forEach(ex => {
    if (ex.balanceCrypto < 50) {
      notifications.push({
        id: `low-crypto-${ex.id}`,
        title: `Stock Bajo de Crypto: ${ex.name}`,
        description: `El balance de ${ex.name} es de solo ${ex.balanceCrypto} USDT. Se recomienda reponer stock.`,
        type: 'warning',
        time: 'Ahora',
      });
    }
  });

  // Recent high volume transactions
  transactions.slice(0, 5).forEach(t => {
    if (t.totalPesos >= 500000) {
      notifications.push({
        id: `high-tx-${t.id}`,
        title: `Operación de Alto Volumen: ${t.type.toUpperCase()}`,
        description: `${t.operator} operó $${t.totalPesos.toLocaleString()} ARS en ${t.walletName} (${t.crypto}).`,
        type: 'info',
        time: `${t.dateString} ${t.timeString}`,
      });
    }
  });

  return (
    <div className="space-y-6 font-mono">
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
          <Bell className="w-5 h-5 text-binance-yellow" />
          Centro de Notificaciones y Alertas Automáticas
        </h2>
        <p className="text-xs text-binance-gray mt-1">
          Monitoreo en tiempo real de límites de billeteras, stock en exchanges y volumen de transacciones.
        </p>
      </div>

      <div className="space-y-3">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${
              n.type === 'danger'
                ? 'bg-binance-red/10 border-binance-red/30 text-binance-red'
                : n.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : n.type === 'success'
                ? 'bg-binance-green/10 border-binance-green/30 text-binance-green'
                : 'bg-binance-card border-binance-border text-white'
            }`}
          >
            <div className="pt-0.5">
              {n.type === 'danger' && <ShieldAlert className="w-5 h-5 text-binance-red" />}
              {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-binance-green" />}
              {n.type === 'info' && <Info className="w-5 h-5 text-binance-yellow" />}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-sm">{n.title}</h3>
                <span className="text-[10px] text-binance-gray font-mono">{n.time}</span>
              </div>
              <p className="text-xs text-binance-gray leading-relaxed">{n.description}</p>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="p-8 bg-binance-card border border-binance-border rounded-2xl text-center text-binance-gray text-xs">
            <CheckCircle2 className="w-8 h-8 text-binance-green mx-auto mb-2" />
            <p className="font-bold text-white">Todo operando normalmente</p>
            <p className="mt-1">No hay alertas críticas ni advertencias de saldo en este momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
