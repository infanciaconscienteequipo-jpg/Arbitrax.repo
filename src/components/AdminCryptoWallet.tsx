import React, { useState } from 'react';
import { CryptoAdminTransfer, User } from '../types';
import {
  Coins,
  ArrowDownLeft,
  ShieldCheck,
  Building2,
  User as UserIcon,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  WalletCards
} from 'lucide-react';

interface AdminCryptoWalletProps {
  transfers: CryptoAdminTransfer[];
  users: User[];
  currentUser: User | null;
  onRefresh?: () => void;
}

export default function AdminCryptoWallet({
  transfers,
  users,
  currentUser,
  onRefresh,
}: AdminCryptoWalletProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const currentOrgId = currentUser?.organization_id || '';

  // Filter transfers by organization and vendor/search
  const filteredTransfers = transfers.filter(t => {
    if (!isSuperAdmin && t.organization_id && t.organization_id !== currentOrgId) {
      return false;
    }
    if (selectedVendorFilter !== 'all') {
      const matchVendorId = t.vendorId === selectedVendorFilter;
      const matchVendorName = t.vendorName.toLowerCase().includes(selectedVendorFilter.toLowerCase());
      if (!matchVendorId && !matchVendorName) return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchVendor = t.vendorName.toLowerCase().includes(term);
      const matchExchange = t.fromExchangeName.toLowerCase().includes(term);
      const matchNotes = (t.notes || '').toLowerCase().includes(term);
      const matchId = t.id.toLowerCase().includes(term);
      if (!matchVendor && !matchExchange && !matchNotes && !matchId) return false;
    }
    return true;
  });

  // Calculate total crypto stock received
  const totalCryptoStock = filteredTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);
  const estimatedUsdtRate = 1240; // ARS per USDT rate
  const totalArsEquivalent = totalCryptoStock * estimatedUsdtRate;

  const handleRefreshClick = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`;
    } catch {
      return dateStr;
    }
  };

  // Vendor options for filter
  const vendorOptions = users.filter(u => u.role === 'VENDEDOR' || u.role === 'vendedor');

  return (
    <div className="space-y-6 font-mono">
      {/* HEADER BANNER */}
      <div className="bg-binance-card rounded-2xl border border-binance-border p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-binance-yellow/10 border border-binance-yellow/30 text-binance-yellow text-[10px] font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Bóveda Administrativa Organizacional
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5 font-display">
              <Coins className="w-7 h-7 text-binance-yellow" />
              Billetera Administrativa Crypto
            </h2>
            <p className="text-xs text-binance-gray mt-1 max-w-2xl">
              Custodia centralizada y control en tiempo real de los envíos de criptomonedas (USDT) recibidos desde los exchanges de los vendedores de la organización.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRefresh && (
              <button
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="px-4 py-2 bg-binance-black hover:bg-binance-card border border-binance-border text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-binance-yellow ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-binance-green/10 rounded-full blur-xl pointer-events-none"></div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Saldo Crypto Total Recibido
            </span>
            <div className="text-3xl font-black text-binance-green mt-1 flex items-baseline gap-1.5">
              {totalCryptoStock.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              <span className="text-xs text-white font-bold">USDT</span>
            </div>
            <span className="text-[10px] text-binance-gray block mt-1 font-mono">
              Stock auditado en bóveda
            </span>
          </div>

          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-binance-yellow/10 rounded-full blur-xl pointer-events-none"></div>
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Equivalente Estimado en Pesos
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
              {formatMoney(totalArsEquivalent)}
            </div>
            <span className="text-[10px] text-binance-gray block mt-1 font-mono">
              Tasa ref. $1.240 ARS/USDT
            </span>
          </div>

          <div className="bg-binance-black p-5 rounded-2xl border border-binance-border relative overflow-hidden">
            <span className="text-[10px] text-binance-gray font-bold block uppercase tracking-wider">
              Transferencias Recibidas
            </span>
            <div className="text-3xl font-black text-white mt-1">
              {filteredTransfers.length}{' '}
              <span className="text-xs text-binance-gray font-bold">envíos</span>
            </div>
            <span className="text-[10px] text-binance-green font-bold block mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Estado 100% Auditado
            </span>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-binance-border/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-binance-gray flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-binance-yellow" />
                Vendedor:
              </span>
              <select
                value={selectedVendorFilter}
                onChange={e => setSelectedVendorFilter(e.target.value)}
                className="px-3 py-1.5 bg-binance-black border border-binance-yellow/50 rounded-xl text-xs text-amber-400 font-bold outline-hidden focus:border-binance-yellow cursor-pointer"
              >
                <option value="all">👤 Todos los Vendedores</option>
                {vendorOptions.map(v => (
                  <option key={v.id || v.name} value={v.id || v.name}>
                    {v.name} (@{v.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-binance-gray absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por exchange, vendedor o nota..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-binance-black border border-binance-border rounded-xl text-white text-xs outline-hidden focus:border-binance-yellow placeholder:text-binance-gray/60"
            />
          </div>
        </div>
      </div>

      {/* TRANSFERS AUDIT TABLE */}
      <div className="bg-binance-card rounded-2xl border border-binance-border overflow-hidden shadow-md">
        <div className="p-4 bg-binance-card border-b border-binance-border flex items-center justify-between">
          <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-binance-green" />
            Historial de Transferencias Recibidas de Vendedores
          </h3>
          <span className="text-[10px] text-binance-gray font-mono">
            {filteredTransfers.length} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-binance-black/70 text-[10px] text-binance-gray uppercase font-bold border-b border-binance-border">
              <tr>
                <th className="px-4 py-3">Fecha / Hora</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Exchange Origen</th>
                <th className="px-4 py-3 text-right">Cantidad Transferida</th>
                <th className="px-4 py-3 text-center">Activo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3">Notas / Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-binance-border/40">
              {filteredTransfers.map(t => (
                <tr key={t.id} className="hover:bg-binance-black/40 transition-colors">
                  <td className="px-4 py-3 text-white font-mono text-[11px] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-binance-gray" />
                      {formatDateTime(t.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-amber-400 block">{t.vendorName}</span>
                    <span className="text-[10px] text-binance-gray">ID: {t.vendorId.substring(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">
                    <span className="px-2 py-0.5 bg-binance-black border border-binance-border rounded text-[11px] font-bold">
                      {t.fromExchangeName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-binance-green text-sm whitespace-nowrap">
                    +{t.amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {t.asset}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-binance-yellow/10 border border-binance-yellow/30 text-binance-yellow rounded text-[10px] font-bold">
                      {t.asset}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-binance-green/20 border border-binance-green/40 text-binance-green rounded text-[10px] font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Recibido
                    </span>
                  </td>
                  <td className="px-4 py-3 text-binance-gray text-[11px] max-w-xs truncate">
                    {t.notes || '—'}
                  </td>
                </tr>
              ))}

              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-binance-gray space-y-2">
                    <Coins className="w-8 h-8 mx-auto text-binance-gray/40" />
                    <p className="font-bold text-white text-xs">
                      No hay transferencias de crypto registradas en este período
                    </p>
                    <p className="text-[11px]">
                      Cuando los vendedores utilicen "Enviar al administrador" desde sus Exchanges, las transferencias aparecerán aquí en tiempo real.
                    </p>
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
