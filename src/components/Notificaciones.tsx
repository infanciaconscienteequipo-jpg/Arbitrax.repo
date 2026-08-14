import React, { useState } from 'react';
import {
  Bell,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Info,
  CheckCheck,
  Filter,
  Check
} from 'lucide-react';
import { Wallet, Transaction, ExchangeAccount } from '../types';
import { AppNotification } from '../services/notification.service';

interface NotificacionesProps {
  wallets: Wallet[];
  exchanges: ExchangeAccount[];
  transactions: Transaction[];
  notifications?: AppNotification[];
  onMarkAsRead?: (id: string) => void | Promise<void>;
  onMarkAllAsRead?: () => void | Promise<void>;
}

export interface ParsedDetails {
  isWalletBlock: boolean;
  isWalletUnblock: boolean;
  walletName: string;
  motivo: string;
  dateFormatted: string;
}

export function parseNotificationDetails(
  n: AppNotification | any,
  wallets: Wallet[] = []
): ParsedDetails {
  const title = (n.title || '').trim();
  const rawMsg = (n.message || n.description || '').trim();

  let metadata: any = n.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }
  metadata = metadata || {};

  const fullText = `${title} ${rawMsg}`.toLowerCase();

  const isWalletUnblock =
    fullText.includes('desbloquead') ||
    metadata.action === 'unblock' ||
    metadata.type === 'unblock' ||
    n.type === 'unblocked';

  const isWalletBlock =
    !isWalletUnblock &&
    (fullText.includes('bloquead') ||
      fullText.includes('suspendid') ||
      metadata.action === 'block' ||
      metadata.type === 'block' ||
      n.type === 'blocked' ||
      n.type === 'danger' && fullText.includes('billetera') ||
      String(n.id).startsWith('blocked-'));

  // 1. Extraer nombre de billetera
  let walletName =
    n.wallet_name ||
    n.walletName ||
    metadata.wallet_name ||
    metadata.walletName ||
    metadata.wallet ||
    metadata.name ||
    '';

  if (!walletName && n.wallet_id) {
    const matched = wallets.find(w => w.id === n.wallet_id);
    if (matched) walletName = matched.name;
  }

  if (!walletName && metadata.wallet_id) {
    const matched = wallets.find(w => w.id === metadata.wallet_id);
    if (matched) walletName = matched.name;
  }

  if (!walletName) {
    const titleMatch = title.match(/(?:billetera\s+(?:bloqueada|desbloqueada|suspendida))\s*:\s*([^|–-]+)/i);
    if (titleMatch && titleMatch[1]) {
      walletName = titleMatch[1].trim();
    }
  }

  if (!walletName) {
    for (const w of wallets) {
      if (w.name && (title.includes(w.name) || rawMsg.includes(w.name))) {
        walletName = w.name;
        break;
      }
    }
  }

  // 2. Extraer motivo real guardado en Supabase
  let motivo =
    n.reason ||
    n.motivo ||
    n.note ||
    n.notes ||
    n.block_reason ||
    n.block_note ||
    metadata.reason ||
    metadata.motivo ||
    metadata.note ||
    metadata.notes ||
    metadata.block_reason ||
    metadata.blockReason ||
    metadata.description ||
    '';

  if (!motivo && rawMsg) {
    const prefixMatch = rawMsg.match(/(?:motivo|raz[oó]n|nota|observaci[oó]n|por)\s*:\s*(.+)$/i);
    if (prefixMatch && prefixMatch[1]) {
      motivo = prefixMatch[1].trim();
    } else {
      const isGeneric =
        rawMsg.toLowerCase().includes('esta billetera se encuentra suspendida') ||
        rawMsg.toLowerCase().includes('para evitar nuevas cargas') ||
        rawMsg.toLowerCase() === title.toLowerCase() ||
        (walletName && rawMsg.toLowerCase() === walletName.toLowerCase()) ||
        rawMsg.toLowerCase() === `billetera bloqueada: ${walletName.toLowerCase()}` ||
        rawMsg.toLowerCase() === `billetera desbloqueada: ${walletName.toLowerCase()}`;

      if (!isGeneric) {
        motivo = rawMsg;
      }
    }
  }

  // 3. Formatear fecha y hora
  const rawDate = n.createdAt || n.created_at || n.timestamp || n.time || new Date().toISOString();
  let dateFormatted = rawDate;
  if (rawDate !== 'Activo' && rawDate !== 'Ahora') {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    } catch {
      dateFormatted = rawDate;
    }
  }

  return {
    isWalletBlock,
    isWalletUnblock,
    walletName: walletName || 'Billetera',
    motivo: motivo.trim(),
    dateFormatted,
  };
}

export default function Notificaciones({
  wallets,
  exchanges,
  transactions,
  notifications: dbNotifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificacionesProps) {
  const [filter, setFilter] = useState<'all' | 'blocks' | 'alerts' | 'unread'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Lista unificada de notificaciones
  const unifiedList: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    time: string;
    read?: boolean;
    isDb?: boolean;
    raw?: any;
    details: ParsedDetails;
  }> = [];

  // 1. Agregar notificaciones reales de la base de datos Supabase
  dbNotifications.forEach(n => {
    const details = parseNotificationDetails(n, wallets);
    unifiedList.push({
      id: n.id,
      title: n.title,
      description: n.message,
      type: n.type || 'info',
      time: details.dateFormatted,
      read: Boolean(n.read),
      isDb: true,
      raw: n,
      details,
    });
  });

  // 2. Alertas dinámicas automáticas basadas en umbrales operativos
  wallets.forEach(w => {
    if (w.limitARS && w.limitARS > 0) {
      const percentageUsed = (w.saldoPesos / w.limitARS) * 100;
      if (percentageUsed >= 100) {
        const id = `limit-exceeded-${w.id}`;
        if (!unifiedList.some(item => item.id === id)) {
          unifiedList.push({
            id,
            title: `🚨 Límite Excedido (100%+): ${w.name}`,
            description: `La billetera ${w.name} alcanzó el ${percentageUsed.toFixed(1)}% de su límite asignado ($${w.saldoPesos.toLocaleString('es-AR')} ARS / $${w.limitARS.toLocaleString('es-AR')} ARS). Se recomienda bloquear la billetera para evitar sobreoperar.`,
            type: 'danger',
            time: 'Ahora',
            details: {
              isWalletBlock: false,
              isWalletUnblock: false,
              walletName: w.name,
              motivo: '',
              dateFormatted: 'Ahora',
            },
          });
        }
      } else if (percentageUsed >= 80) {
        const id = `limit-warning-${w.id}`;
        if (!unifiedList.some(item => item.id === id)) {
          unifiedList.push({
            id,
            title: `⚠️ Alerta de Límite (80%+ Ocupado): ${w.name}`,
            description: `La billetera ${w.name} ha ocupado el ${percentageUsed.toFixed(1)}% de su límite disponible ($${w.saldoPesos.toLocaleString('es-AR')} ARS sobre un límite de $${w.limitARS.toLocaleString('es-AR')} ARS). Por favor estar atentos.`,
            type: 'warning',
            time: 'Ahora',
            details: {
              isWalletBlock: false,
              isWalletUnblock: false,
              walletName: w.name,
              motivo: '',
              dateFormatted: 'Ahora',
            },
          });
        }
      }
    }

    // Si una billetera está marcada como bloqueada en memoria y no existe aún en notificaciones de DB
    if (w.blocked) {
      const alreadyInDb = unifiedList.some(
        item => item.details.isWalletBlock && item.details.walletName.toLowerCase() === w.name.toLowerCase()
      );
      if (!alreadyInDb) {
        const reason = (w as any).blockReason || (w as any).block_reason || (w as any).reason || (w as any).note || '';
        unifiedList.push({
          id: `blocked-${w.id}`,
          title: `🔒 Billetera Bloqueada: ${w.name}`,
          description: reason || `Esta billetera se encuentra suspendida/bloqueada para evitar nuevas cargas u operaciones.`,
          type: 'danger',
          time: 'Activo',
          details: {
            isWalletBlock: true,
            isWalletUnblock: false,
            walletName: w.name,
            motivo: reason,
            dateFormatted: 'Activo',
          },
        });
      }
    }
  });

  // Alerta de stock bajo en exchanges
  exchanges.forEach(ex => {
    if (ex.balanceCrypto < 50) {
      const id = `low-crypto-${ex.id}`;
      if (!unifiedList.some(item => item.id === id)) {
        unifiedList.push({
          id,
          title: `Stock Bajo de Crypto: ${ex.name}`,
          description: `El balance de ${ex.name} es de solo ${ex.balanceCrypto} USDT. Se recomienda reponer stock.`,
          type: 'warning',
          time: 'Ahora',
          details: {
            isWalletBlock: false,
            isWalletUnblock: false,
            walletName: '',
            motivo: '',
            dateFormatted: 'Ahora',
          },
        });
      }
    }
  });

  // Operaciones de alto volumen
  transactions.slice(0, 5).forEach(t => {
    if (t.totalPesos >= 500000) {
      const id = `high-tx-${t.id}`;
      if (!unifiedList.some(item => item.id === id)) {
        unifiedList.push({
          id,
          title: `Operación de Alto Volumen: ${t.type.toUpperCase()}`,
          description: `${t.operator} operó $${t.totalPesos.toLocaleString('es-AR')} ARS en ${t.walletName} (${t.crypto}).`,
          type: 'info',
          time: `${t.dateString} ${t.timeString}`,
          details: {
            isWalletBlock: false,
            isWalletUnblock: false,
            walletName: t.walletName,
            motivo: '',
            dateFormatted: `${t.dateString} ${t.timeString}`,
          },
        });
      }
    }
  });

  // Filtrado
  const filteredList = unifiedList.filter(item => {
    if (filter === 'blocks') {
      return item.details.isWalletBlock || item.details.isWalletUnblock;
    }
    if (filter === 'alerts') {
      return !item.details.isWalletBlock && !item.details.isWalletUnblock;
    }
    if (filter === 'unread') {
      return item.read === false;
    }
    return true;
  });

  const unreadCount = unifiedList.filter(n => n.read === false).length;

  const handleMarkAll = async () => {
    if (!onMarkAllAsRead) return;
    setIsMarkingAll(true);
    try {
      await onMarkAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER */}
      <div className="bg-binance-card border border-binance-border p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-binance-yellow/10 rounded-xl border border-binance-yellow/20">
              <Bell className="w-5 h-5 text-binance-yellow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">
                Centro de Notificaciones y Alertas
              </h2>
              <p className="text-xs text-binance-gray mt-0.5">
                Historial de bloqueos, motivos de suspensión, límites de billeteras y eventos en tiempo real.
              </p>
            </div>
          </div>
        </div>

        {unreadCount > 0 && onMarkAllAsRead && (
          <button
            onClick={handleMarkAll}
            disabled={isMarkingAll}
            className="flex items-center gap-2 px-3.5 py-2 bg-binance-dark border border-binance-border hover:border-binance-yellow/40 text-xs font-bold text-binance-yellow rounded-xl transition-all cursor-pointer hover:bg-binance-card shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            {isMarkingAll ? 'Actualizando...' : `Marcar todas leídas (${unreadCount})`}
          </button>
        )}
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-binance-yellow text-binance-dark font-extrabold shadow-sm'
              : 'bg-binance-card border border-binance-border text-binance-gray hover:text-white'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Todas ({unifiedList.length})
        </button>

        <button
          onClick={() => setFilter('blocks')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'blocks'
              ? 'bg-binance-red text-white font-extrabold shadow-sm'
              : 'bg-binance-card border border-binance-border text-binance-gray hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Bloqueos / Desbloqueos ({unifiedList.filter(n => n.details.isWalletBlock || n.details.isWalletUnblock).length})
        </button>

        <button
          onClick={() => setFilter('alerts')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'alerts'
              ? 'bg-amber-400 text-binance-dark font-extrabold shadow-sm'
              : 'bg-binance-card border border-binance-border text-binance-gray hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Límites y Stock ({unifiedList.filter(n => !n.details.isWalletBlock && !n.details.isWalletUnblock).length})
        </button>

        {unreadCount > 0 && (
          <button
            onClick={() => setFilter('unread')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'unread'
                ? 'bg-binance-yellow text-binance-dark font-extrabold shadow-sm'
                : 'bg-binance-card border border-binance-border text-binance-yellow hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-binance-yellow animate-pulse"></span>
            No leídas ({unreadCount})
          </button>
        )}
      </div>

      {/* NOTIFICATIONS LIST */}
      <div className="space-y-3">
        {filteredList.map(n => {
          const { isWalletBlock, isWalletUnblock, walletName, motivo, dateFormatted } = n.details;

          // RENDERIZADO EXACTO PARA BLOQUEO DE BILLETERA
          if (isWalletBlock) {
            return (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all ${
                  n.read === false
                    ? 'bg-binance-red/15 border-binance-red/50 shadow-md ring-1 ring-binance-red/30'
                    : 'bg-binance-card border-binance-red/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-binance-red font-extrabold text-sm font-display">
                    <Lock className="w-4 h-4 text-binance-red shrink-0" />
                    <span>🔒 Billetera bloqueada</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-binance-gray font-mono">{dateFormatted}</span>
                    {n.isDb && n.read === false && onMarkAsRead && (
                      <button
                        onClick={() => onMarkAsRead(n.id)}
                        title="Marcar como leída"
                        className="p-1 rounded bg-binance-dark border border-binance-border hover:border-binance-red text-binance-gray hover:text-white transition-all cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 bg-binance-dark/80 border border-binance-border/80 rounded-xl p-3.5 space-y-2.5">
                  <div>
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block mb-0.5">
                      Billetera:
                    </span>
                    <span className="font-bold text-white text-xs block">
                      {walletName}
                    </span>
                  </div>

                  {motivo && (
                    <div>
                      <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block mb-0.5">
                        Motivo:
                      </span>
                      <div className="bg-binance-red/10 border border-binance-red/25 rounded-lg px-3 py-1.5 inline-block max-w-full">
                        <span className="text-xs font-semibold text-binance-red block break-words">
                          {motivo}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block mb-0.5">
                      Fecha:
                    </span>
                    <span className="text-[11px] text-binance-gray font-mono block">
                      {dateFormatted}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // RENDERIZADO EXACTO PARA DESBLOQUEO DE BILLETERA
          if (isWalletUnblock) {
            return (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all ${
                  n.read === false
                    ? 'bg-binance-green/15 border-binance-green/50 shadow-md ring-1 ring-binance-green/30'
                    : 'bg-binance-card border-binance-green/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-binance-green font-extrabold text-sm font-display">
                    <Unlock className="w-4 h-4 text-binance-green shrink-0" />
                    <span>🔓 Billetera desbloqueada</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-binance-gray font-mono">{dateFormatted}</span>
                    {n.isDb && n.read === false && onMarkAsRead && (
                      <button
                        onClick={() => onMarkAsRead(n.id)}
                        title="Marcar como leída"
                        className="p-1 rounded bg-binance-dark border border-binance-border hover:border-binance-green text-binance-gray hover:text-white transition-all cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 bg-binance-dark/80 border border-binance-border/80 rounded-xl p-3.5 space-y-2.5">
                  <div>
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block mb-0.5">
                      Billetera:
                    </span>
                    <span className="font-bold text-white text-xs block">
                      {walletName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-binance-gray uppercase font-bold tracking-wider block mb-0.5">
                      Fecha:
                    </span>
                    <span className="text-[11px] text-binance-gray font-mono block">
                      {dateFormatted}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // RENDERIZADO PARA OTRAS ALERTAS OPERATIVAS
          const isDanger = n.type === 'danger';
          const isWarning = n.type === 'warning';
          const isSuccess = n.type === 'success';

          return (
            <div
              key={n.id}
              className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
                isDanger
                  ? 'bg-binance-red/10 border-binance-red/30 text-binance-red'
                  : isWarning
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : isSuccess
                  ? 'bg-binance-green/10 border-binance-green/30 text-binance-green'
                  : 'bg-binance-card border-binance-border text-white'
              }`}
            >
              <div className="pt-0.5 shrink-0">
                {isDanger && <ShieldAlert className="w-5 h-5 text-binance-red" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-binance-green" />}
                {!isDanger && !isWarning && !isSuccess && <Info className="w-5 h-5 text-binance-yellow" />}
              </div>

              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <h3 className="font-extrabold text-sm truncate">{n.title}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-binance-gray font-mono">{n.time}</span>
                    {n.isDb && n.read === false && onMarkAsRead && (
                      <button
                        onClick={() => onMarkAsRead(n.id)}
                        title="Marcar como leída"
                        className="p-1 rounded bg-binance-dark border border-binance-border hover:border-binance-yellow text-binance-gray hover:text-white transition-all cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-binance-gray leading-relaxed break-words">{n.description}</p>
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="p-10 bg-binance-card border border-binance-border rounded-2xl text-center text-binance-gray text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-binance-green mx-auto mb-2 opacity-80" />
            <p className="font-bold text-white text-sm">No hay notificaciones en esta vista</p>
            <p className="text-binance-gray max-w-sm mx-auto">
              Todo operando con normalidad. Los eventos de bloqueo de billeteras y límites aparecerán aquí automáticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
