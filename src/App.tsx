import React, { useState, useEffect } from 'react';
import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User, Organization, ExchangeAccount, IncomeExpenseRecord } from './types';
import { getInitialState, saveState, clearAllData } from './utils/dataStore';

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
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(getInitialState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Sync state changes with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Handle user login / role switch
  const handleLogin = (identifier: string, password?: string): boolean => {
    const cleanId = identifier.toLowerCase().trim();
    const user = state.users.find(
      u => (u.username.toLowerCase() === cleanId || (u.email && u.email.toLowerCase() === cleanId)) && (!password || u.password === password)
    );
    if (user) {
      setState(prev => ({
        ...prev,
        currentUser: user,
        currentOperator: user.name,
      }));

      if (user.role === 'SUPER_ADMIN') {
        setActiveTab('saas-dashboard');
      } else {
        setActiveTab('dashboard');
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setState(prev => ({
      ...prev,
      currentUser: prev.users[0],
      currentOperator: prev.users[0]?.name || '',
    }));
    setActiveTab('dashboard');
  };

  // Organizations and Users handlers
  const handleUpdateOrganizations = (orgs: Organization[]) => {
    setState(prev => ({ ...prev, organizations: orgs }));
  };

  const handleAddOrganization = (newOrg: Organization) => {
    setState(prev => ({ ...prev, organizations: [...(prev.organizations || []), newOrg] }));
  };

  const handleUpdateUsers = (updatedUsers: User[]) => {
    setState(prev => ({
      ...prev,
      users: updatedUsers,
      currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id || u.username === prev.currentUser?.username) || prev.currentUser,
    }));
  };

  const handleAddUser = (newUser: User) => {
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
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
    };

    setState(prev => {
      // Update Wallets
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === txData.walletId) {
          let pesosChange = 0;
          if (txData.type === 'compra') {
            pesosChange = -txData.totalPesos; // COMPRA: Se descuentan pesos de la billetera
          } else if (txData.type === 'venta') {
            pesosChange = txData.totalPesos;  // VENTA: Se aumentan pesos en la billetera
          } else if (txData.type === 'ingreso_fondos') {
            pesosChange = txData.totalPesos;
          } else if (txData.type === 'egreso_fondos') {
            pesosChange = -txData.totalPesos;
          }
          return {
            ...w,
            saldoPesos: Math.max(0, w.saldoPesos + pesosChange),
          };
        }
        return w;
      });

      // Update Exchanges
      const updatedExchanges = prev.exchanges.map(ex => {
        // Find match or update first active exchange
        if (ex.id === txData.walletId || ex.name.toLowerCase().includes('binance') || prev.exchanges.length === 1) {
          let cryptoChange = 0;
          if (txData.type === 'compra') {
            cryptoChange = txData.quantity;  // COMPRA: Se aumenta stock en la exchange
          } else if (txData.type === 'venta') {
            cryptoChange = -txData.quantity; // VENTA: Se descuenta stock de la exchange
          }
          return {
            ...ex,
            balanceCrypto: Math.max(0, ex.balanceCrypto + cryptoChange),
          };
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
  };

  const handleUpdateExchangeBalance = (exchangeId: string, newBalance: number) => {
    setState(prev => ({
      ...prev,
      exchanges: prev.exchanges.map(ex => ex.id === exchangeId ? { ...ex, balanceCrypto: newBalance } : ex),
    }));
  };

  // Income / Expense Handlers
  const handleAddIncomeExpense = (recordData: IncomeExpenseRecord) => {
    const record: IncomeExpenseRecord = {
      ...recordData,
      shiftId: recordData.shiftId || state.activeShiftId || undefined,
    };
    setState(prev => {
      // Apply to wallet or exchange balance
      let updatedWallets = [...prev.wallets];
      let updatedExchanges = [...prev.exchanges];

      if (record.assetType === 'pesos') {
        updatedWallets = updatedWallets.map(w => {
          if (w.id === record.walletOrExchangeId) {
            const delta = record.type === 'ingreso' ? record.amount : -record.amount;
            return { ...w, saldoPesos: Math.max(0, w.saldoPesos + delta) };
          }
          return w;
        });
      } else {
        updatedExchanges = updatedExchanges.map(ex => {
          if (ex.id === record.walletOrExchangeId) {
            const delta = record.type === 'ingreso' ? record.amount : -record.amount;
            return { ...ex, balanceCrypto: Math.max(0, ex.balanceCrypto + delta) };
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
      operator: state.currentUser?.name || state.currentOperator || 'Manual Adjust',
      notes,
    });
  };

  const handleAddWallet = (walletName: string, titular: string, initialBalancePesos: number) => {
    setState(prev => {
      const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan'];
      const randomColor = colors[prev.wallets.length % colors.length];
      const newWallet: Wallet = {
        id: `wallet_${Date.now()}`,
        name: walletName,
        saldoPesos: initialBalancePesos,
        saldoUsdt: 0,
        color: randomColor,
        providerType: 'Billetera P2P',
        titular,
        limitARS: 3000000,
        blocked: false,
      };
      return {
        ...prev,
        wallets: [...prev.wallets, newWallet],
      };
    });
  };

  const handleUpdateWallet = (walletId: string, updates: Partial<Wallet>) => {
    setState(prev => ({
      ...prev,
      wallets: prev.wallets.map(w => w.id === walletId ? { ...w, ...updates } : w),
    }));
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
    };

    setState(prev => ({
      ...prev,
      shifts: [newShift, ...prev.shifts],
      activeShiftId: newShift.id,
      currentOperator: operatorName,
    }));
  };

  const handleEndShift = (shiftId: string) => {
    setState(prev => ({
      ...prev,
      shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, endTime: new Date().toISOString() } : s),
      activeShiftId: null,
    }));
  };

  const activeShift = state.shifts.find(s => s.id === state.activeShiftId) || null;

  return (
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
            {state.currentUser?.role === 'SUPER_ADMIN' ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-xl">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-300">
                  SUPER ADMIN: <span className="text-white">{state.currentUser.name}</span>
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  const superAdmin = state.users.find(u => u.role === 'SUPER_ADMIN') || {
                    id: 'u-super-1',
                    email: 'arbitrax19@gmail.com',
                    username: 'superadmin',
                    name: 'Super Admin ArbitraX',
                    password: 'Arbitrax.2006',
                    role: 'SUPER_ADMIN',
                    organization_id: null
                  };
                  setState(prev => ({ ...prev, currentUser: superAdmin }));
                  setActiveTab('saas-dashboard');
                }}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 text-amber-300 border border-amber-500/50 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                👑 Panel Super Admin
              </button>
            )}

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border border-binance-red/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6 font-mono">
        {/* SIDEBAR NAVIGATION */}
        <nav className="md:w-60 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none border-b md:border-b-0 border-binance-border -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
          {state.currentUser?.role === 'SUPER_ADMIN' ? (
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

              <button
                onClick={() => setActiveTab('vendedores')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'vendedores' ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow' : 'text-binance-gray hover:text-white'
                }`}
              >
                <UserIcon className="w-4 h-4 text-binance-yellow" />
                Vendedores
              </button>

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

              <button
                onClick={() => setActiveTab('reportes')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'reportes' ? 'bg-binance-card text-sky-400 border-l-2 border-sky-400' : 'text-binance-gray hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-sky-400" />
                Métricas y Reportes
              </button>

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

              <button
                onClick={() => setActiveTab('ajustes')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ajustes' ? 'bg-binance-card text-binance-gray border-l-2 border-binance-gray' : 'text-binance-gray hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 text-binance-gray" />
                Ajustes
              </button>
            </>
          )}
        </nav>

        {/* MAIN DISPLAY AREA */}
        <main className="flex-1 min-w-0">
          {(activeTab.startsWith('saas-') || activeTab === 'saas-admin') && (
            <SaasAdmin
              organizations={state.organizations || []}
              users={state.users}
              currentUser={state.currentUser}
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
              currentUser={state.currentUser}
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
              currentUser={state.currentUser}
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
              currentUser={state.currentUser}
              onAddExchange={handleAddExchange}
              onUpdateExchangeBalance={handleUpdateExchangeBalance}
            />
          )}

          {activeTab === 'vendedores' && (
            <VendedoresManager
              users={state.users}
              currentUser={state.currentUser}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'fondos' && (
            <Fondos
              wallets={state.wallets}
              exchanges={state.exchanges}
              incomeExpenses={state.incomeExpenses}
              currentUser={state.currentUser}
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

          {activeTab === 'reportes' && (
            <Reportes
              transactions={state.transactions}
              incomeExpenses={state.incomeExpenses}
              users={state.users}
              currentUser={state.currentUser}
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
              currentOperator={state.currentUser?.name || state.currentOperator}
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

          {activeTab === 'ajustes' && (
            <Ajustes
              currentUser={state.currentUser}
              onClearData={handleClearTransactions}
            />
          )}
        </main>
      </div>

      <footer className="bg-binance-dark border-t border-binance-border text-center py-4 text-[10px] text-binance-gray font-mono">
        &copy; 2026 ArbitraX &bull; Plataforma SaaS de Arbitraje P2P &bull; Todos los derechos reservados
      </footer>
    </div>
  );
}
