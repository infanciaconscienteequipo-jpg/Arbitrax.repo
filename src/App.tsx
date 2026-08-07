import React, { useState, useEffect } from 'react';
import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User, Organization, ExchangeAccount, IncomeExpenseRecord } from './types';
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

import { dashboardService } from './services/dashboard.service';
import { transactionService } from './services/transaction.service';
import { walletService } from './services/wallet.service';
import { shiftService } from './services/shift.service';
import { exchangeService } from './services/exchange.service';
import { organizationService } from './services/organization.service';
import { authService } from './services/auth.service';

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

  const [activeTab, setActiveTab] = useState<string>('dashboard');

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
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser && authUser.role !== 'SUPER_ADMIN' && activeTab.startsWith('saas-')) {
      setActiveTab('dashboard');
    }
  }, [authUser, activeTab]);

  // Cargar datos remotos desde Supabase
  useEffect(() => {
    if (!authUser) return;

    dashboardService.fetchAppState(authUser?.organization_id || undefined).then(remoteState => {
      if (remoteState && Object.keys(remoteState).length > 0) {
        setState(prev => ({
          ...prev,
          ...remoteState,
          organizations: remoteState.organizations?.length ? remoteState.organizations : prev.organizations,
          users: remoteState.users?.length ? remoteState.users : prev.users,
          wallets: remoteState.wallets?.length ? remoteState.wallets : prev.wallets,
          exchanges: remoteState.exchanges?.length ? remoteState.exchanges : prev.exchanges,
        }));
      }
    });
  }, [authUser]);

  const currentUser = authUser || state.currentUser;
  const isVendedor = currentUser?.role === 'VENDEDOR';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

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
  const handleAddTransaction = (txData: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => {
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
    };

    // Sync to Supabase via service
    transactionService.sync(newTx);

    setState(prev => {
      // Update Wallets
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === txData.walletId) {
          let pesosChange = 0;
          if (txData.type === 'compra') {
            pesosChange = -txData.totalPesos;
          } else if (txData.type === 'venta') {
            pesosChange = txData.totalPesos;
          } else if (txData.type === 'ingreso_fondos') {
            pesosChange = txData.totalPesos;
          } else if (txData.type === 'egreso_fondos') {
            pesosChange = -txData.totalPesos;
          }
          const updatedW = {
            ...w,
            saldoPesos: Math.max(0, w.saldoPesos + pesosChange),
          };
          walletService.sync(updatedW);
          return updatedW;
        }
        return w;
      });

      // Update Exchanges
      const updatedExchanges = prev.exchanges.map(ex => {
        if (ex.id === txData.walletId || ex.name.toLowerCase().includes('binance') || prev.exchanges.length === 1) {
          let cryptoChange = 0;
          if (txData.type === 'compra') {
            cryptoChange = txData.quantity;
          } else if (txData.type === 'venta') {
            cryptoChange = -txData.quantity;
          }
          const updatedEx = {
            ...ex,
            balanceCrypto: Math.max(0, ex.balanceCrypto + cryptoChange),
          };
          exchangeService.sync(updatedEx);
          return updatedEx;
        }
        return ex;
      });

      return {
        ...prev,
        wallets: updatedWallets,
        exchanges: updatedExchanges,
        transactions: [newTx, ...prev.transactions],
      };
    });
  };

  // Exchanges Handlers
  const handleAddExchange = (newEx: ExchangeAccount) => {
    setState(prev => ({
      ...prev,
      exchanges: [...prev.exchanges, newEx],
    }));
    exchangeService.sync(newEx);
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
  const handleAddIncomeExpense = (recordData: IncomeExpenseRecord) => {
    const record: IncomeExpenseRecord = {
      ...recordData,
      shiftId: recordData.shiftId || state.activeShiftId || undefined,
      organization_id: recordData.organization_id || authOrg?.id || '',
    };
    dashboardService.syncIncomeExpense(record);

    setState(prev => {
      let updatedWallets = [...prev.wallets];
      let updatedExchanges = [...prev.exchanges];

      if (record.assetType === 'pesos') {
        updatedWallets = updatedWallets.map(w => {
          if (w.id === record.walletOrExchangeId) {
            const delta = record.type === 'ingreso' ? record.amount : -record.amount;
            const updatedW = { ...w, saldoPesos: Math.max(0, w.saldoPesos + delta) };
            walletService.sync(updatedW);
            return updatedW;
          }
          return w;
        });
      } else {
        updatedExchanges = updatedExchanges.map(ex => {
          if (ex.id === record.walletOrExchangeId) {
            const delta = record.type === 'ingreso' ? record.amount : -record.amount;
            const updatedEx = { ...ex, balanceCrypto: Math.max(0, ex.balanceCrypto + delta) };
            exchangeService.sync(updatedEx);
            return updatedEx;
          }
          return ex;
        });
      }

      return {
        ...prev,
        wallets: updatedWallets,
        exchanges: updatedExchanges,
        incomeExpenses: [record, ...prev.incomeExpenses],
      };
    });
  };

  // Wallet Funding Handler
  const handleFundWallet = (walletId: string, amount: number, type: 'ingreso_fondos' | 'egreso_fondos', notes: string) => {
    const wallet = state.wallets.find(w => w.id === walletId);
    if (!wallet) return;

    handleAddTransaction({
      type,
      crypto: 'ARS',
      quantity: 0,
      unitPrice: 1,
      totalPesos: amount,
      walletId,
      walletName: wallet.name,
      operator: currentUser?.name || state.currentOperator || 'Manual Adjust',
      notes,
    });
  };

  const handleAddWallet = (walletName: string, titular: string, initialBalancePesos: number) => {
    const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan'];
    const randomColor = colors[state.wallets.length % colors.length];
    const newWallet: Wallet = {
      id: `wallet_${Date.now()}`,
      name: walletName,
      saldoPesos: initialBalancePesos,
      saldoUsdt: 0,
      color: randomColor,
      providerType: 'Billetera P2P',
      titular,
      organization_id: authOrg?.id || '',
      limitARS: 3000000,
      blocked: false,
    };
    walletService.sync(newWallet);
    setState(prev => ({
      ...prev,
      wallets: [...prev.wallets, newWallet],
    }));
  };

  const handleUpdateWallet = (walletId: string, updates: Partial<Wallet>) => {
    setState(prev => {
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === walletId) {
          const updated = { ...w, ...updates };
          walletService.sync(updated);
          return updated;
        }
        return w;
      });
      return { ...prev, wallets: updatedWallets };
    });
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
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'notificaciones' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                  }`}
                >
                  <Bell className="w-4 h-4 text-binance-yellow" />
                  Notificaciones
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
              />
            )}

            {activeTab === 'billeteras' && (
              <Billeteras
                wallets={state.wallets}
                transactions={state.transactions}
                users={state.users}
                activeShiftId={state.activeShiftId}
                onFundWallet={handleFundWallet}
                onAddWallet={handleAddWallet}
                onUpdateWallet={handleUpdateWallet}
              />
            )}

            {activeTab === 'exchanges' && (
              <Exchanges
                exchanges={state.exchanges}
                users={state.users}
                currentUser={currentUser as any}
                onAddExchange={handleAddExchange}
                onUpdateExchangeBalance={handleUpdateExchangeBalance}
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
              />
            )}

            {activeTab === 'calculadora' && (
              <CalculadoraP2P
                p2pCalcs={state.p2pCalcs}
                wallets={state.wallets}
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
              />
            )}

            {activeTab === 'ajustes' && !isVendedor && (
              <Ajustes
                currentUser={currentUser as any}
                onClearData={handleClearTransactions}
              />
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

