import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User, Organization, ExchangeAccount, IncomeExpenseRecord, CryptoAdminTransfer } from './types';
import { clearAllData } from './utils/dataStore';
import { useAuth } from './hooks/useAuth';
import RequireAuth from './auth/RequireAuth';

import Dashboard from './components/Dashboard';
import Movimientos from './components/Movimientos';
import Billeteras from './components/Billeteras';
import Exchanges from './components/Exchanges';
import Fondos from './components/Fondos';
import CalculadoraP2P from './components/CalculadoraP2P';
import VendedoresManager from './components/VendedoresManager';
import SaasAdmin from './components/SaasAdmin';
import Reportes from './components/Reportes';
import TurnosControl from './components/TurnosControl';
import Notificaciones from './components/Notificaciones';
import Ajustes from './components/Ajustes';
import AdminCryptoWallet from './components/AdminCryptoWallet';

import { dashboardService } from './services/dashboard.service';
import { transactionService } from './services/transaction.service';
import { walletService } from './services/wallet.service';
import { shiftService } from './services/shift.service';
import { exchangeService } from './services/exchange.service';
import { organizationService } from './services/organization.service';
import { authService } from './services/auth.service';
import { notificationService, mapNotificationFromDB, AppNotification } from './services/notification.service';
import { playNotificationSound } from './utils/sound';
import { supabase } from './lib/supabase';

import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  WalletCards,
  Calculator,
  Clock,
  LogOut,
  AlertTriangle,
  User as UserIcon,
  ShieldAlert,
  Crown,
  Building2,
  Users,
  CreditCard,
  Settings,
  Coins,
  DollarSign,
  BarChart3,
  Bell,
  CheckCircle2,
  Database
} from 'lucide-react';

export default function App() {
  const { user: authUser, organization: authOrg, logout: authLogout } = useAuth();
  const [state, setState] = useState<AppState>({
    currentUser: authUser as any,
    currentOperator: authUser?.name || '',
    activeShiftId: null,
    wallets: [],
    exchanges: [],
    transactions: [],
    incomeExpenses: [],
    shifts: [],
    p2pCalcs: [],
    users: [],
    organizations: authOrg ? [authOrg] : []
  });

  const [cryptoTransfers, setCryptoTransfers] = useState<CryptoAdminTransfer[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const hasLoadedInitialNotifsRef = React.useRef(false);
  const knownNotificationIdsRef = React.useRef<Set<string>>(new Set());

  // Trigger sound ONLY when a genuinely new notification arrives
  useEffect(() => {
    const notifs = state.notifications;
    if (!notifs) return;

    if (!hasLoadedInitialNotifsRef.current) {
      // First load / F5 reload: record existing IDs without playing sound
      notifs.forEach(n => {
        if (n && n.id) {
          knownNotificationIdsRef.current.add(String(n.id));
        }
      });
      hasLoadedInitialNotifsRef.current = true;
      return;
    }

    // Subsequent updates: check for any new notification IDs
    const newItems = notifs.filter(n => n && n.id && !knownNotificationIdsRef.current.has(String(n.id)));
    if (newItems.length > 0) {
      newItems.forEach(n => knownNotificationIdsRef.current.add(String(n.id)));
      playNotificationSound();
    }
  }, [state.notifications]);

  // Realtime subscription for Supabase notifications
  useEffect(() => {
    if (!authUser) return;
    const orgId = authUser.organization_id;

    const channel = supabase
      .channel(`rt-notifs-${orgId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: orgId ? `organization_id=eq.${orgId}` : undefined,
        },
        (payload) => {
          if (payload.new) {
            const mapped = mapNotificationFromDB(payload.new);
            if (mapped && mapped.id) {
              if (hasLoadedInitialNotifsRef.current && !knownNotificationIdsRef.current.has(String(mapped.id))) {
                knownNotificationIdsRef.current.add(String(mapped.id));
                playNotificationSound();
              }
              setState(prev => ({
                ...prev,
                notifications: [mapped, ...(prev.notifications || []).filter(n => n.id !== mapped.id)],
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const currentUser = authUser || state.currentUser;
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isContadora = currentUser?.role === 'CONTADORA';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN' || isSuperAdmin;

  // Sincronizar el usuario autenticado de Supabase Auth con el estado de la app
  useEffect(() => {
    if (authUser) {
      setState(prev => ({
        ...prev,
        currentUser: authUser as any,
        currentOperator: authUser.name
      }));

      // Redirección inicial basada en Rol
      if (authUser.role === 'SUPER_ADMIN') {
        setActiveTab('saas-dashboard');
      } else if (authUser.role === 'CONTADORA') {
        setActiveTab('cierre');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser && authUser.role !== 'SUPER_ADMIN' && activeTab.startsWith('saas-')) {
      setActiveTab('dashboard');
    }
    if (authUser && authUser.role === 'CONTADORA' && activeTab !== 'cierre') {
      setActiveTab('cierre');
    }
  }, [authUser, activeTab]);

  const fetchCryptoTransfers = useCallback(async () => {
    if (!authUser) return;
    const transfers = await walletService.listCryptoAdminTransfers(authUser.organization_id || undefined);
    setCryptoTransfers(transfers);
  }, [authUser]);

  const refreshData = useCallback(async () => {
    if (!authUser) return;
    if (authUser.role !== 'SUPER_ADMIN' && !authUser.organization_id) return;

    const remoteState = await dashboardService.fetchAppState(authUser.organization_id || undefined);
    if (remoteState && Object.keys(remoteState).length > 0) {
      setState(prev => ({
        ...prev,
        ...remoteState,
        organizations: remoteState.organizations?.length ? remoteState.organizations : prev.organizations,
        users: remoteState.users?.length ? remoteState.users : prev.users,
        wallets: remoteState.wallets || [],
        exchanges: remoteState.exchanges || [],
        transactions: remoteState.transactions || [],
        incomeExpenses: remoteState.incomeExpenses || [],
        shifts: remoteState.shifts || [],
      }));
    }

    if (authUser.role === 'ADMIN' || authUser.role === 'SUPER_ADMIN') {
      fetchCryptoTransfers();
    }
  }, [authUser, fetchCryptoTransfers]);

  // Cargar datos remotos desde Supabase
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleLogout = async () => {
    await authLogout();
  };

  // Organizations and Users handlers
  const handleUpdateOrganizations = (orgs: Organization[]) => {
    setState(prev => ({ ...prev, organizations: orgs }));
    orgs.forEach(org => organizationService.sync(org));
  };

  const handleAddOrganization = (newOrg: Organization) => {
    setState(prev => ({ ...prev, organizations: [...(prev.organizations || []), newOrg] }));
    organizationService.sync(newOrg);
  };

  const handleUpdateUsers = (updatedUsers: User[]) => {
    setState(prev => ({
      ...prev,
      users: updatedUsers,
      currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id || u.username === prev.currentUser?.username) || prev.currentUser,
    }));
  };

  const handleAddUser = (newUser: User) => {
    setState(prev => {
      const exists = prev.users.some(u => u.id === newUser.id || u.username.toLowerCase() === newUser.username.toLowerCase());
      if (exists) return prev;
      return { ...prev, users: [...prev.users, newUser] };
    });
  };

  const handleDeleteUser = (username: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.username.toLowerCase() !== username.toLowerCase()),
    }));
  };

  // Transaction Handler: Executes financial logic for COMPRA / VENTA
  const handleAddTransaction = async (txData: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => {
    const now = new Date();
    const isoStr = now.toISOString();
    const dateStr = isoStr.split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      timestamp: isoStr,
      dateString: dateStr,
      timeString: timeStr,
      shiftId: txData.shiftId || state.activeShiftId || undefined,
      organization_id: txData.organization_id || authOrg?.id || '',
      sellerId: txData.sellerId || (currentUser?.role === 'VENDEDOR' ? currentUser.id : undefined),
    };

    if (txData.type === 'compra') {
      await transactionService.buy({
        crypto: txData.crypto,
        quantity: txData.quantity,
        unitPrice: txData.unitPrice,
        totalPesos: txData.totalPesos,
        walletId: txData.walletId,
        walletName: txData.walletName,
        operator: txData.operator,
        supplier: txData.supplier,
        notes: txData.notes,
        shiftId: txData.shiftId || state.activeShiftId || undefined,
        organization_id: txData.organization_id || authOrg?.id || '',
        exchangeId: txData.exchangeId,
        exchangeName: txData.exchangeName,
        sellerId: txData.sellerId || (currentUser?.role === 'VENDEDOR' ? currentUser.id : undefined),
      });
    } else if (txData.type === 'venta') {
      await transactionService.sell({
        crypto: txData.crypto,
        quantity: txData.quantity,
        unitPrice: txData.unitPrice,
        totalPesos: txData.totalPesos,
        walletId: txData.walletId,
        walletName: txData.walletName,
        operator: txData.operator,
        client: txData.client,
        gain: txData.gain,
        notes: txData.notes,
        shiftId: txData.shiftId || state.activeShiftId || undefined,
        organization_id: txData.organization_id || authOrg?.id || '',
        exchangeId: txData.exchangeId,
        exchangeName: txData.exchangeName,
        sellerId: txData.sellerId || (currentUser?.role === 'VENDEDOR' ? currentUser.id : undefined),
      });
    } else {
      await transactionService.sync(newTx);
    }

    await refreshData();
  };

  // Exchanges Handlers
  const handleAddExchange = async (newEx: Omit<ExchangeAccount, 'id'>) => {
    await exchangeService.create(newEx as ExchangeAccount);
    await refreshData();
  };

  const handleUpdateExchangeBalance = (exchangeId: string, newBalance: number) => {
    setState(prev => {
      const updatedExchanges = prev.exchanges.map(ex => {
        if (ex.id === exchangeId) {
          const updated = { ...ex, balanceCrypto: newBalance };
          exchangeService.sync(updated);
          return updated;
        }
        return ex;
      });
      return { ...prev, exchanges: updatedExchanges };
    });
  };

  // Income / Expense Handlers
  const handleAddIncomeExpense = async (recordData: Omit<IncomeExpenseRecord, 'id'> | IncomeExpenseRecord) => {
    await transactionService.createIncomeExpense({
      type: recordData.type,
      assetType: recordData.assetType,
      walletOrExchangeId: recordData.walletOrExchangeId,
      amount: recordData.amount,
      timestamp: recordData.timestamp,
      transferPerson: recordData.transferPerson,
      reason: recordData.reason,
      proofUrl: recordData.proofUrl,
      shiftId: recordData.shiftId || state.activeShiftId || undefined,
    });

    await refreshData();
  };

  // Wallet Funding Handler (Ingreso / Egreso de Fondos en Billetera)
  const handleFundWallet = async (walletId: string, amount: number, type: 'ingreso_fondos' | 'egreso_fondos', notes: string) => {
    const wallet = state.wallets.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error('Billetera no encontrada.');
    }

    if (currentUser?.role === 'VENDEDOR' && wallet.vendorId && wallet.vendorId !== currentUser.id) {
      throw new Error('No está autorizado para operar esta billetera.');
    }

    if (wallet.blocked) {
      throw new Error(`La billetera "${wallet.name}" está bloqueada.`);
    }

    if (type === 'egreso_fondos' && wallet.saldoPesos < amount) {
      throw new Error(`Saldo insuficiente en pesos en ${wallet.name}.`);
    }

    // Registrar el ingreso / egreso mediante la RPC oficial en Supabase que actualiza wallets.saldo_pesos
    await transactionService.createIncomeExpense({
      type: type === 'ingreso_fondos' ? 'ingreso' : 'egreso',
      assetType: 'pesos',
      walletOrExchangeId: walletId,
      amount,
      timestamp: new Date().toISOString(),
      reason: notes || (type === 'ingreso_fondos' ? 'Ingreso manual de fondos' : 'Egreso manual de fondos'),
      shiftId: state.activeShiftId || undefined,
    });

    await refreshData();
  };

  const handleAddWallet = async (walletName: string, titular: string, initialBalancePesos: number, customVendorId?: string) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan'];
    const randomColor = colors[state.wallets.length % colors.length];
    
    // VENDEDOR: strictly assign own user ID; Admin can assign customVendorId
    const vendorId = currentUser?.role === 'VENDEDOR' 
      ? currentUser.id 
      : (customVendorId || currentUser?.id || '');

    const vendorObj = state.users.find(u => u.id === vendorId);

    const walletPayload: Wallet = {
      id: '',
      name: walletName,
      saldoPesos: initialBalancePesos,
      saldoUsdt: 0,
      color: randomColor,
      providerType: 'Billetera P2P',
      titular,
      vendorId: vendorId || undefined,
      vendorName: vendorObj?.name || currentUser?.name || currentUser?.username || '',
      organization_id: authOrg?.id || '',
      limitARS: 3000000,
      blocked: false,
    };

    await walletService.create(walletPayload);
    await refreshData();
  };

  const handleUpdateWallet = async (walletId: string, updates: Partial<Wallet>) => {
    const wObj = state.wallets.find(w => w.id === walletId);
    if (!wObj) throw new Error('Billetera no encontrada');
    const updatedWallet: Wallet = {
      ...wObj,
      ...updates,
    };
    await walletService.update(updatedWallet);
    await refreshData();
  };

  const handleUpdateWalletLimit = async (walletId: string, newLimitARS: number) => {
    const wObj = state.wallets.find(w => w.id === walletId);
    if (!wObj) throw new Error('Billetera no encontrada');
    await walletService.update({
      ...wObj,
      limitARS: newLimitARS,
    });
    await refreshData();
    return true;
  };

  const handleArchiveWallet = async (walletId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await walletService.archiveWallet(walletId);
      if (res) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: 'No se pudo archivar la billetera' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al archivar la billetera' };
    }
  };

  const handleUnarchiveWallet = async (walletId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await walletService.unarchiveWallet(walletId);
      if (res) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: 'No se pudo desarchivar la billetera' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al desarchivar la billetera' };
    }
  };

  const handleTransferBetweenWallets = async (params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    notes?: string;
  }) => {
    const res = await walletService.transferBetweenWallets(params);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleUpdateTransaction = async (updatedTx: Transaction): Promise<{ success: boolean; error?: string }> => {
    try {
      await transactionService.updateTransaction(updatedTx);
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al actualizar movimiento' };
    }
  };

  const handleUpdateIncomeExpense = async (updatedRecord: IncomeExpenseRecord): Promise<{ success: boolean; error?: string }> => {
    try {
      await transactionService.updateIncomeExpense(updatedRecord);
      await refreshData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al actualizar registro de fondos' };
    }
  };

  const handleArchiveExchange = async (exchangeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await exchangeService.archiveExchange(exchangeId);
      if (res) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: 'No se pudo archivar el exchange' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al archivar exchange' };
    }
  };

  const handleUnarchiveExchange = async (exchangeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await exchangeService.unarchiveExchange(exchangeId);
      if (res) {
        await refreshData();
        return { success: true };
      }
      return { success: false, error: 'No se pudo desarchivar el exchange' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al desarchivar exchange' };
    }
  };

  // RPC-based Wallet Blocking / Unblocking
  const handleBlockWallet = async (walletId: string, note: string) => {
    const success = await walletService.block(walletId, note);
    if (success) {
      await refreshData();
    }
    return success;
  };

  const handleUnblockWallet = async (walletId: string) => {
    const success = await walletService.unblock(walletId);
    if (success) {
      await refreshData();
    }
    return success;
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => (n.id === id ? { ...n, read: true } : n)),
    }));
  };

  const handleMarkAllNotificationsAsRead = async () => {
    await notificationService.markAllAsRead(authUser?.organization_id || undefined);
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).map(n => ({ ...n, read: true })),
    }));
  };

  // Crypto Transfer from Seller Exchange to Admin
  const handleTransferCryptoToAdmin = async (params: {
    exchangeId: string;
    amount: number;
    asset?: string;
    notes?: string;
  }) => {
    const res = await walletService.transferCryptoToAdmin({
      ...params,
      vendorId: currentUser?.id,
      vendorName: currentUser?.name,
      organizationId: authOrg?.id,
    });

    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleAddP2PCalc = (calc: P2PArbitrage) => {
    setState(prev => ({ ...prev, p2pCalcs: [calc, ...prev.p2pCalcs] }));
  };

  const handleClearTransactions = () => {
    const fresh = clearAllData();
    setState(fresh);
    setActiveTab('dashboard');
  };

  // Shift Handlers
  const handleStartShift = (operatorName: string) => {
    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      operatorName,
      startTime: new Date().toISOString(),
      initialBalances: state.wallets.reduce((acc, w) => {
        acc[w.id] = { pesos: w.saldoPesos, usdt: w.saldoUsdt };
        return acc;
      }, {} as any),
      totalPurchasesPesos: 0,
      totalSalesPesos: 0,
      totalGainsPesos: 0,
      operationsCount: 0,
      organization_id: authOrg?.id || '',
    };

    shiftService.sync(newShift);

    setState(prev => ({
      ...prev,
      shifts: [newShift, ...prev.shifts],
      activeShiftId: newShift.id,
      currentOperator: operatorName,
    }));
  };

  const handleEndShift = (shiftId: string) => {
    setState(prev => {
      const updatedShifts = prev.shifts.map(s => {
        if (s.id === shiftId) {
          const updated = { ...s, endTime: new Date().toISOString() };
          shiftService.sync(updated);
          return updated;
        }
        return s;
      });
      return {
        ...prev,
        shifts: updatedShifts,
        activeShiftId: null,
      };
    });
  };

  const activeShift = state.shifts.find(s => s.id === state.activeShiftId) || null;

  return (
    <RequireAuth>
      <div className="min-h-screen bg-binance-black font-sans text-binance-light flex flex-col antialiased selection:bg-binance-yellow selection:text-binance-black">
        {/* HEADER */}
        <header className="bg-binance-dark border-b border-binance-border shrink-0 sticky top-0 z-50 shadow-md font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-binance-yellow to-amber-500 rounded-xl flex items-center justify-center text-binance-black font-extrabold tracking-wider font-display text-sm shadow-lg premium-glow-yellow">
                ARX
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-white text-base sm:text-lg tracking-tight">
                    Arbitra<span className="text-binance-yellow">X</span>
                  </h1>
                  <span className="px-1.5 py-0.5 bg-binance-green/20 text-binance-green rounded text-[9px] font-bold tracking-wider uppercase">
                    PRO SaaS
                  </span>
                </div>
                <span className="text-[10px] text-binance-gray block uppercase tracking-widest font-semibold">
                  Plataforma de Arbitraje P2P Multi-Organización
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* CURRENT USER BADGE */}
              {currentUser && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-binance-card border border-binance-border rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-binance-yellow/20 text-binance-yellow flex items-center justify-center font-bold text-xs uppercase">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white max-w-[130px] truncate block">
                        {currentUser.name}
                      </span>
                      {currentUser.role === 'SUPER_ADMIN' ? (
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px] font-extrabold">SUPER ADMIN</span>
                      ) : currentUser.role === 'ADMIN' ? (
                        <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded text-[9px] font-bold">ADMIN</span>
                      ) : currentUser.role === 'CONTADORA' ? (
                        <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded text-[9px] font-bold">CONTADORA</span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">VENDEDOR</span>
                      )}
                    </div>
                    <span className="text-[10px] text-binance-gray block font-mono">
                      @{currentUser.username}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border border-binance-red/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6 font-mono">
          {/* SIDEBAR NAVIGATION */}
          <nav className="md:w-60 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none border-b md:border-b-0 border-binance-border -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
            {isSuperAdmin ? (
              <>
                <div className="hidden md:block px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-1 text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" /> Super Admin SaaS
                </div>

                <button
                  onClick={() => setActiveTab('saas-dashboard')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saas-dashboard' || activeTab === 'saas-admin' ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('saas-organizaciones')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saas-organizaciones' ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-400" />
                  Organizaciones
                </button>

                <button
                  onClick={() => setActiveTab('saas-administradores')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saas-administradores' ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  Administradores
                </button>

                <button
                  onClick={() => setActiveTab('saas-suscripciones')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saas-suscripciones' ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-binance-yellow" />
                  Suscripciones
                </button>

                <button
                  onClick={() => setActiveTab('saas-configuracion')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saas-configuracion' ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-amber-400" />
                  Configuración
                </button>

                <div className="pt-3 border-t border-binance-border/40 mt-2">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-binance-gray hover:text-white hover:bg-binance-card transition-all cursor-pointer"
                  >
                    👁 Vista Terminal Cliente
                  </button>
                </div>
              </>
            ) : isContadora ? (
              <>
                <div className="hidden md:block px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl mb-1 text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Rol Contadora
                </div>

                <button
                  onClick={() => setActiveTab('cierre')}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-binance-card text-amber-400 border-l-2 border-amber-400"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  Cierres de Jornada
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-binance-yellow" />
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('movimientos')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'movimientos' ? 'bg-binance-card text-white border-l-2 border-binance-gray' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 text-binance-gray" />
                  Movimientos
                </button>

                <button
                  onClick={() => setActiveTab('billeteras')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'billeteras' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <WalletCards className="w-4 h-4 text-binance-yellow" />
                  Billeteras
                </button>

                <button
                  onClick={() => setActiveTab('exchanges')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'exchanges' ? 'bg-binance-card text-binance-green border-l-2 border-binance-green' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Coins className="w-4 h-4 text-binance-green" />
                  Exchanges
                </button>

                {isAdmin && !isVendedor && (
                  <button
                    onClick={() => setActiveTab('admin-crypto')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'admin-crypto' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                    }`}
                  >
                    <Coins className="w-4 h-4 text-binance-yellow" />
                    Billetera Crypto
                  </button>
                )}

                {!isVendedor && (
                  <button
                    onClick={() => setActiveTab('vendedores')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'vendedores' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                    }`}
                  >
                    <UserIcon className="w-4 h-4 text-binance-yellow" />
                    Vendedores
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('fondos')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'fondos' ? 'bg-binance-card text-amber-400 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  Fondo / Inyecciones
                </button>

                <button
                  onClick={() => setActiveTab('calculadora')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'calculadora' ? 'bg-binance-card text-binance-green border-l-2 border-binance-green' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Calculator className="w-4 h-4 text-binance-green" />
                  Calculadora P2P
                </button>

                {!isVendedor && (
                  <button
                    onClick={() => setActiveTab('reportes')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'reportes' ? 'bg-binance-card text-sky-400 border-l-2 border-sky-400' : 'text-binance-gray hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-sky-400" />
                    Métricas y Reportes
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('cierre')}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'cierre' ? 'bg-binance-card text-amber-400 border-l-2 border-amber-400' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  Cierre de Jornada
                </button>

                <button
                  onClick={() => setActiveTab('notificaciones')}
                  className={`flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'notificaciones' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-binance-yellow" />
                    Notificaciones
                  </div>
                  {(state.notifications || []).filter(n => n.read === false).length > 0 && (
                    <span className="bg-binance-yellow text-binance-dark text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                      {(state.notifications || []).filter(n => n.read === false).length}
                    </span>
                  )}
                </button>

                {!isVendedor && (
                  <button
                    onClick={() => setActiveTab('ajustes')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'ajustes' ? 'bg-binance-card text-binance-gray border-l-2 border-binance-gray' : 'text-binance-gray hover:text-white'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-binance-gray" />
                    Ajustes
                  </button>
                )}
              </>
            )}
          </nav>

          {/* MAIN DISPLAY AREA */}
          <main className="flex-1 min-w-0">
            {isContadora ? (
              <TurnosControl
                shifts={state.shifts}
                activeShift={activeShift}
                wallets={state.wallets}
                exchanges={state.exchanges}
                incomeExpenses={state.incomeExpenses}
                transactions={state.transactions}
                users={state.users}
                currentUser={currentUser as any}
                currentOperator={currentUser?.name || state.currentOperator}
                onStartShift={handleStartShift}
                onEndShift={handleEndShift}
              />
            ) : (
              <>
                {(activeTab.startsWith('saas-') || activeTab === 'saas-admin') && isSuperAdmin && (
                  <SaasAdmin
                    organizations={state.organizations || []}
                    users={state.users}
                    currentUser={currentUser as any}
                    onUpdateOrganizations={handleUpdateOrganizations}
                    onAddOrganization={handleAddOrganization}
                    onAddUser={handleAddUser}
                    onUpdateUsers={handleUpdateUsers}
                    activeSection={activeTab.replace('saas-', '')}
                    onSectionChange={(sec) => setActiveTab(`saas-${sec}`)}
                  />
                )}

                {activeTab === 'dashboard' && (
                  <Dashboard
                    wallets={state.wallets}
                    exchanges={state.exchanges}
                    transactions={state.transactions}
                    incomeExpenses={state.incomeExpenses}
                    activeShiftId={state.activeShiftId}
                    activeShift={activeShift}
                    currentUser={currentUser as any}
                    users={state.users}
                    onSelectTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'movimientos' && (
                  <Movimientos
                    transactions={state.transactions}
                    wallets={state.wallets}
                    exchanges={state.exchanges}
                    users={state.users}
                    currentUser={currentUser as any}
                    onClearTransactions={handleClearTransactions}
                    onAddTransaction={handleAddTransaction}
                    onUpdateTransaction={handleUpdateTransaction}
                  />
                )}

                {activeTab === 'billeteras' && (
                  <Billeteras
                    wallets={state.wallets}
                    transactions={state.transactions}
                    users={state.users}
                    currentUser={currentUser as any}
                    activeShiftId={state.activeShiftId}
                    onFundWallet={handleFundWallet}
                    onAddWallet={handleAddWallet}
                    onUpdateWallet={handleUpdateWallet}
                    onUpdateWalletLimit={handleUpdateWalletLimit}
                    onTransferBetweenWallets={handleTransferBetweenWallets}
                    onBlockWallet={handleBlockWallet}
                    onUnblockWallet={handleUnblockWallet}
                    onArchiveWallet={handleArchiveWallet}
                    onUnarchiveWallet={handleUnarchiveWallet}
                  />
                )}

                {activeTab === 'exchanges' && (
                  <Exchanges
                    exchanges={state.exchanges}
                    users={state.users}
                    currentUser={currentUser as any}
                    onAddExchange={handleAddExchange}
                    onUpdateExchangeBalance={handleUpdateExchangeBalance}
                    onTransferCryptoToAdmin={handleTransferCryptoToAdmin}
                    onArchiveExchange={handleArchiveExchange}
                    onUnarchiveExchange={handleUnarchiveExchange}
                  />
                )}

                {activeTab === 'admin-crypto' && isAdmin && (
                  <AdminCryptoWallet
                    transfers={cryptoTransfers}
                    users={state.users}
                    currentUser={currentUser as any}
                    onRefresh={fetchCryptoTransfers}
                  />
                )}

                {activeTab === 'vendedores' && !isVendedor && (
                  <VendedoresManager
                    users={state.users}
                    currentUser={currentUser as any}
                    onAddUser={handleAddUser}
                    onDeleteUser={handleDeleteUser}
                    onUpdateUsers={handleUpdateUsers}
                  />
                )}

                {activeTab === 'fondos' && (
                  <Fondos
                    wallets={state.wallets}
                    exchanges={state.exchanges}
                    incomeExpenses={state.incomeExpenses}
                    currentUser={currentUser as any}
                    users={state.users}
                    activeShiftId={state.activeShiftId}
                    onAddIncomeExpense={handleAddIncomeExpense}
                    onUpdateIncomeExpense={handleUpdateIncomeExpense}
                  />
                )}

                {activeTab === 'calculadora' && (
                  <CalculadoraP2P
                    p2pCalcs={state.p2pCalcs}
                    wallets={state.wallets}
                    currentUser={currentUser as any}
                    onAddP2PCalc={handleAddP2PCalc}
                    onAddTransaction={handleAddTransaction}
                    activeShiftId={state.activeShiftId}
                  />
                )}

                {activeTab === 'reportes' && !isVendedor && (
                  <Reportes
                    transactions={state.transactions}
                    incomeExpenses={state.incomeExpenses}
                    users={state.users}
                    currentUser={currentUser as any}
                    activeShiftId={state.activeShiftId}
                    activeShift={activeShift}
                  />
                )}

                {activeTab === 'cierre' && (
                  <TurnosControl
                    shifts={state.shifts}
                    activeShift={activeShift}
                    wallets={state.wallets}
                    exchanges={state.exchanges}
                    incomeExpenses={state.incomeExpenses}
                    transactions={state.transactions}
                    users={state.users}
                    currentUser={currentUser as any}
                    currentOperator={currentUser?.name || state.currentOperator}
                    onStartShift={handleStartShift}
                    onEndShift={handleEndShift}
                  />
                )}

                {activeTab === 'notificaciones' && (
                  <Notificaciones
                    wallets={state.wallets}
                    exchanges={state.exchanges}
                    transactions={state.transactions}
                    notifications={state.notifications || []}
                    onMarkAsRead={handleMarkNotificationAsRead}
                    onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                  />
                )}

                {activeTab === 'ajustes' && !isVendedor && (
                  <Ajustes
                    currentUser={currentUser as any}
                    onClearData={handleClearTransactions}
                  />
                )}
              </>
            )}
          </main>
        </div>

        <footer className="bg-binance-dark border-t border-binance-border text-center py-4 text-[10px] text-binance-gray font-mono">
          &copy; 2026 ArbitraX &bull; Plataforma SaaS de Arbitraje P2P &bull; Todos los derechos reservados
        </footer>
      </div>
    </RequireAuth>
  );
}

