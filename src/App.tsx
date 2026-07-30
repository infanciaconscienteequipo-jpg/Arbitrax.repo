/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User } from './types';
import { getInitialState, saveState, clearAllData } from './utils/dataStore';

import Dashboard from './components/Dashboard';
import UnifiedOperacion from './components/UnifiedOperacion';
import Movimientos from './components/Movimientos';
import Billeteras from './components/Billeteras';
import CalculadoraP2P from './components/CalculadoraP2P';
import VendedoresManager from './components/VendedoresManager';
import LoginScreen from './components/LoginScreen';

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
  Moon,
  Sun
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(getInitialState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Sync state changes with localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // User session and authentication handlers
  const handleLogin = (username: string, password?: string): boolean => {
    const user = state.users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && (!password || u.password === password)
    );
    if (user) {
      setState(prev => ({
        ...prev,
        currentUser: user,
        currentOperator: user.name,
      }));
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setState(prev => ({
      ...prev,
      currentUser: null,
      currentOperator: '',
    }));
    setActiveTab('dashboard');
  };

  const handleAddUser = (newUser: User) => {
    setState(prev => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
  };

  const handleDeleteUser = (username: string) => {
    setState(prev => {
      const filteredUsers = prev.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      const loggingOut = prev.currentUser?.username.toLowerCase() === username.toLowerCase();
      return {
        ...prev,
        users: filteredUsers,
        currentUser: loggingOut ? null : prev.currentUser,
        currentOperator: loggingOut ? '' : prev.currentOperator,
      };
    });
  };

  // Handler to add a simulated P2P arbitrage calculation to history logs
  const handleAddP2PCalc = (calc: P2PArbitrage) => {
    setState(prev => ({
      ...prev,
      p2pCalcs: [calc, ...prev.p2pCalcs],
    }));
  };

  // Core handler: Registers any buy, sale, or wallet funding operation & updates balances automatically!
  const handleAddTransaction = (
    txData: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>
  ) => {
    const now = new Date();
    
    // Create correct local date and time string to prevent UTC offsets shifting the displayed records
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    const dateString = localDate.toISOString().split('T')[0];
    const timeString = localDate.toISOString().split('T')[1].substring(0, 8);

    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      timestamp: now.toISOString(),
      dateString,
      timeString,
    };

    setState(prev => {
      // 1. Update wallet balance transacts
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === txData.walletId) {
          let pesosChange = 0;
          let usdtChange = 0;

          if (txData.type === 'compra') {
            pesosChange = -txData.totalPesos;
            usdtChange = txData.quantity;
          } else if (txData.type === 'venta') {
            pesosChange = txData.totalPesos;
            usdtChange = -txData.quantity;
          } else if (txData.type === 'ingreso_fondos') {
            pesosChange = txData.totalPesos;
          } else if (txData.type === 'egreso_fondos') {
            pesosChange = -txData.totalPesos;
          }

          return {
            ...w,
            saldoPesos: Math.max(0, w.saldoPesos + pesosChange),
            saldoUsdt: Math.max(0, w.saldoUsdt + usdtChange),
          };
        }
        return w;
      });

      // 2. Insert transaction at index 0 (newest first)
      const updatedTransactions = [newTx, ...prev.transactions];

      return {
        ...prev,
        wallets: updatedWallets,
        transactions: updatedTransactions,
      };
    });
  };

  // Handler to add or withdraw Pesos from any wallet
  const handleFundWallet = (
    walletId: string,
    amount: number,
    type: 'ingreso_fondos' | 'egreso_fondos',
    notes: string
  ) => {
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
      operator: state.currentOperator || 'Manual Adjust',
      notes,
      shiftId: state.activeShiftId || undefined,
    });
  };

  // Handler to create a new wallet from Billeteras UI
  const handleAddWallet = (walletName: string, titular: string, initialBalancePesos: number) => {
    setState(prev => {
      const colors = ['blue', 'green', 'orange', 'purple', 'teal', 'cyan'];
      const randomColor = colors[prev.wallets.length % colors.length];
      const id = `wallet_${Date.now()}`;
      
      const newWallet: Wallet = {
        id,
        name: walletName,
        saldoPesos: initialBalancePesos,
        saldoUsdt: 0,
        color: randomColor,
        providerType: 'Billetera P2P',
        titular: titular,
      };

      return {
        ...prev,
        wallets: [...prev.wallets, newWallet],
      };
    });
  };

  // Full reset helper
  const handleClearTransactions = () => {
    const fresh = clearAllData();
    setState(fresh);
    setActiveTab('dashboard');
  };

  // Format currency
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!state.currentUser) {
    return (
      <LoginScreen
        users={state.users}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-binance-black font-sans text-binance-light flex flex-col antialiased selection:bg-binance-yellow selection:text-binance-black">
      {/* Top Premium Header Control */}
      <header className="bg-binance-dark border-b border-binance-border shrink-0 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo Brand area - ArbitraX */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-binance-yellow to-amber-500 rounded-xl flex items-center justify-center text-binance-black font-extrabold tracking-wider font-display text-sm shadow-lg premium-glow-yellow transform hover:scale-105 transition-transform duration-200">
              ARX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-white text-base sm:text-lg tracking-tight">
                  Arbitra<span className="text-binance-yellow">X</span>
                </h1>
                <span className="px-1.5 py-0.5 bg-binance-green/20 text-binance-green rounded text-[9px] font-bold tracking-wider uppercase font-mono">
                  PRO P2P
                </span>
              </div>
              <span className="text-[10px] text-binance-gray block mt-0.5 uppercase tracking-widest font-mono font-semibold">
                Control de Liquidez y Arbitraje
              </span>
            </div>
          </div>

          {/* Active Session status indicator */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {state.currentUser ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-binance-green/10 border border-binance-green/30 rounded-lg premium-glow-green">
                <span className="w-2 h-2 rounded-full bg-binance-green animate-pulse"></span>
                <span className="text-[11px] font-semibold text-binance-green font-mono">
                  SESIÓN: <span className="font-extrabold text-white">{state.currentUser.name}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-binance-red/10 border border-binance-red/20 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-binance-red"></span>
                <span className="text-[11px] font-semibold text-binance-red font-mono">
                  SIN SESIÓN ACTIVA
                </span>
              </div>
            )}

            {/* Quick Session trigger */}
            {state.currentUser ? (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-binance-red/20 hover:bg-binance-red/30 text-binance-red border border-binance-red/40 rounded-lg text-xs font-bold transition-all cursor-pointer font-mono"
                title="Cerrar sesión de vendedor"
              >
                Cerrar Sesión
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('vendedores')}
                className="px-3 py-1.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black shadow-md premium-glow-yellow rounded-lg text-xs font-bold transition-all cursor-pointer font-mono"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main navigation and page container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Sidebar */}
        <nav className="md:w-64 shrink-0 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none border-b md:border-b-0 border-binance-border -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
          
          <button
            onClick={() => {
              setActiveTab('dashboard');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'dashboard'
                ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow shadow-md premium-glow-yellow'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-binance-yellow" />
            Dashboard
          </button>

          <button
            onClick={() => {
              setActiveTab('operacion');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'operacion'
                ? 'bg-binance-yellow/15 text-binance-yellow border-l-2 border-binance-yellow shadow-md premium-glow-yellow'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-binance-yellow" />
            Nueva Operación P2P
          </button>

          <button
            onClick={() => {
              setActiveTab('movimientos');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'movimientos'
                ? 'bg-binance-card text-white border-l-2 border-binance-gray shadow-sm'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-binance-gray" />
            Movimientos
          </button>

          <button
            onClick={() => {
              setActiveTab('billeteras');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'billeteras'
                ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow shadow-sm'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <WalletCards className="w-4 h-4 text-binance-yellow" />
            Billeteras
          </button>

          <button
            onClick={() => {
              setActiveTab('calculadora');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'calculadora'
                ? 'bg-binance-card text-binance-green border-l-2 border-binance-green shadow-sm'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4 text-binance-green" />
            Calculadora P2P
          </button>

          <button
            onClick={() => {
              setActiveTab('vendedores');
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer font-mono ${
              activeTab === 'vendedores'
                ? 'bg-binance-card text-binance-yellow border-l-2 border-binance-yellow shadow-sm'
                : 'text-binance-gray hover:bg-binance-card/50 hover:text-white'
            }`}
          >
            <UserIcon className="w-4 h-4 text-binance-yellow" />
            Vendedores
          </button>

          {/* Quick instructions/compliance card in sidebar */}
          <div className="hidden md:block mt-auto p-4 bg-binance-card border border-binance-border rounded-xl space-y-2 text-[11px]">
            <div className="flex items-center gap-1 font-bold text-white uppercase font-mono tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-binance-yellow" />
              Soporte ArbitraX
            </div>
            <p className="text-binance-gray leading-relaxed">
              Los cálculos y balances de billeteras se actualizan al instante en tiempo real. Siempre verifique su sesión activa antes de registrar transacciones.
            </p>
          </div>
        </nav>

        {/* Primary Views Content Switcher */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              wallets={state.wallets}
              transactions={state.transactions}
              onSelectTab={(tab) => {
                if (tab === 'compras' || tab === 'ventas') {
                  setActiveTab('operacion');
                } else {
                  setActiveTab(tab);
                }
              }}
            />
          )}

          {activeTab === 'operacion' && (
            <UnifiedOperacion
              wallets={state.wallets}
              currentUser={state.currentUser}
              onAddTransaction={handleAddTransaction}
              transactions={state.transactions}
            />
          )}

          {activeTab === 'movimientos' && (
            <Movimientos
              transactions={state.transactions}
              wallets={state.wallets}
              onClearTransactions={handleClearTransactions}
            />
          )}

          {activeTab === 'billeteras' && (
            <Billeteras
              wallets={state.wallets}
              transactions={state.transactions}
              activeShiftId={null}
              onFundWallet={handleFundWallet}
              onAddWallet={handleAddWallet}
            />
          )}

          {activeTab === 'calculadora' && (
            <CalculadoraP2P
              p2pCalcs={state.p2pCalcs}
              wallets={state.wallets}
              onAddP2PCalc={handleAddP2PCalc}
              onAddTransaction={handleAddTransaction}
              activeShiftId={null}
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
        </main>
      </div>

      {/* Humble Footer */}
      <footer className="bg-binance-dark border-t border-binance-border shrink-0 text-center py-4 text-[10px] text-binance-gray font-mono">
        &copy; 2026 ArbitraX &bull; Terminal de Arbitraje Profesional P2P &bull; Hecho para Administradores de Activos
      </footer>
    </div>
  );
}
