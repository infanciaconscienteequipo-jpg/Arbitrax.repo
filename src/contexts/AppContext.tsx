import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User, Organization, ExchangeAccount, IncomeExpenseRecord } from '../types';
import { dashboardService } from '../services/dashboard.service';
import { walletService } from '../services/wallet.service';
import { exchangeService } from '../services/exchange.service';
import { transactionService } from '../services/transaction.service';
import { shiftService } from '../services/shift.service';
import { organizationService } from '../services/organization.service';
import { authService } from '../services/auth.service';
import { useAuth } from '../hooks/useAuth';

export interface AppContextType {
  state: AppState;
  loading: boolean;
  refreshState: () => Promise<void>;
  addTransaction: (txData: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => Promise<void>;
  addWallet: (walletName: string, titular: string, initialBalancePesos: number) => Promise<void>;
  updateWallet: (walletId: string, updates: Partial<Wallet>) => Promise<void>;
  fundWallet: (walletId: string, amount: number, type: 'ingreso_fondos' | 'egreso_fondos', notes: string) => Promise<void>;
  addExchange: (newEx: ExchangeAccount) => Promise<void>;
  updateExchangeBalance: (exchangeId: string, newBalance: number) => Promise<void>;
  addIncomeExpense: (recordData: IncomeExpenseRecord) => Promise<void>;
  addP2PCalc: (calc: P2PArbitrage) => void;
  startShift: (operatorName: string) => Promise<void>;
  endShift: (shiftId: string) => Promise<void>;
  updateOrganizations: (orgs: Organization[]) => Promise<void>;
  addOrganization: (newOrg: Organization) => Promise<void>;
  addUser: (newUser: User) => Promise<void>;
  updateUsers: (updatedUsers: User[]) => void;
  deleteUser: (username: string) => void;
  clearTransactions: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser, organization: authOrg } = useAuth();
  const orgId = authUser?.role === 'SUPER_ADMIN' ? undefined : (authOrg?.id || authUser?.organization_id || undefined);

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
    organizations: authOrg ? [authOrg] : [],
  });

  const [loading, setLoading] = useState<boolean>(true);

  const refreshState = useCallback(async () => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const remote = await dashboardService.fetchAppState(orgId);
      if (remote) {
        setState(prev => ({
          ...prev,
          ...remote,
          currentUser: authUser as any || prev.currentUser,
          currentOperator: authUser?.name || prev.currentOperator,
          organizations: remote.organizations?.length ? remote.organizations : (authOrg ? [authOrg] : prev.organizations),
        }));
      }
    } catch (err) {
      console.error('Error al actualizar estado global:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, authUser, authOrg]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (authUser) {
      setState(prev => ({
        ...prev,
        currentUser: authUser as any,
        currentOperator: authUser.name,
      }));
    }
  }, [authUser]);

  const addTransaction = async (txData: Omit<Transaction, 'id' | 'timestamp' | 'dateString' | 'timeString'>) => {
    const now = new Date();
    const isoStr = now.toISOString();
    const dateStr = isoStr.split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const currentOrgId = orgId || txData.organization_id || authOrg?.id || '';

    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      timestamp: isoStr,
      dateString: dateStr,
      timeString: timeStr,
      shiftId: txData.shiftId || state.activeShiftId || undefined,
      organization_id: currentOrgId,
    };

    await transactionService.create(newTx);

    setState(prev => {
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === txData.walletId) {
          let pesosChange = 0;
          if (txData.type === 'compra' || txData.type === 'egreso_fondos') {
            pesosChange = -txData.totalPesos;
          } else if (txData.type === 'venta' || txData.type === 'ingreso_fondos') {
            pesosChange = txData.totalPesos;
          }
          const updatedW = { ...w, saldoPesos: Math.max(0, w.saldoPesos + pesosChange) };
          walletService.sync(updatedW);
          return updatedW;
        }
        return w;
      });

      const updatedExchanges = prev.exchanges.map(ex => {
        if (ex.id === txData.walletId || ex.name.toLowerCase().includes('binance') || prev.exchanges.length === 1) {
          let cryptoChange = 0;
          if (txData.type === 'compra') cryptoChange = txData.quantity;
          else if (txData.type === 'venta') cryptoChange = -txData.quantity;
          const updatedEx = { ...ex, balanceCrypto: Math.max(0, ex.balanceCrypto + cryptoChange) };
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

  const addWallet = async (walletName: string, titular: string, initialBalancePesos: number) => {
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
      organization_id: orgId || authOrg?.id || '',
      limitARS: 3000000,
      blocked: false,
    };

    await walletService.create(newWallet);
    setState(prev => ({ ...prev, wallets: [...prev.wallets, newWallet] }));
  };

  const updateWallet = async (walletId: string, updates: Partial<Wallet>) => {
    setState(prev => {
      const updatedWallets = prev.wallets.map(w => {
        if (w.id === walletId) {
          const updated = { ...w, ...updates };
          walletService.update(updated);
          return updated;
        }
        return w;
      });
      return { ...prev, wallets: updatedWallets };
    });
  };

  const fundWallet = async (walletId: string, amount: number, type: 'ingreso_fondos' | 'egreso_fondos', notes: string) => {
    const wallet = state.wallets.find(w => w.id === walletId);
    if (!wallet) return;

    await addTransaction({
      type,
      crypto: 'ARS',
      quantity: 0,
      unitPrice: 1,
      totalPesos: amount,
      walletId,
      walletName: wallet.name,
      operator: authUser?.name || state.currentOperator || 'Manual Adjust',
      notes,
      organization_id: orgId || authOrg?.id || '',
    });
  };

  const addExchange = async (newEx: ExchangeAccount) => {
    const formatted = {
      ...newEx,
      organization_id: orgId || authOrg?.id || newEx.organization_id || '',
    };
    await exchangeService.create(formatted);
    setState(prev => ({ ...prev, exchanges: [...prev.exchanges, formatted] }));
  };

  const updateExchangeBalance = async (exchangeId: string, newBalance: number) => {
    setState(prev => {
      const updatedExchanges = prev.exchanges.map(ex => {
        if (ex.id === exchangeId) {
          const updated = { ...ex, balanceCrypto: newBalance };
          exchangeService.update(updated);
          return updated;
        }
        return ex;
      });
      return { ...prev, exchanges: updatedExchanges };
    });
  };

  const addIncomeExpense = async (recordData: IncomeExpenseRecord) => {
    const record: IncomeExpenseRecord = {
      ...recordData,
      shiftId: recordData.shiftId || state.activeShiftId || undefined,
      organization_id: orgId || authOrg?.id || recordData.organization_id || '',
    };

    await dashboardService.syncIncomeExpense(record);

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

  const addP2PCalc = (calc: P2PArbitrage) => {
    setState(prev => ({ ...prev, p2pCalcs: [calc, ...prev.p2pCalcs] }));
  };

  const startShift = async (operatorName: string) => {
    const initialBal = state.wallets.reduce((acc, w) => {
      acc[w.id] = { pesos: w.saldoPesos, usdt: w.saldoUsdt };
      return acc;
    }, {} as any);

    const newShift = await shiftService.startShift(operatorName, initialBal, orgId || authOrg?.id || '');

    setState(prev => ({
      ...prev,
      shifts: [newShift, ...prev.shifts],
      activeShiftId: newShift.id,
      currentOperator: operatorName,
    }));
  };

  const endShift = async (shiftId: string) => {
    const closed = await shiftService.closeShift(shiftId);
    if (closed) {
      setState(prev => ({
        ...prev,
        shifts: prev.shifts.map(s => (s.id === shiftId ? closed : s)),
        activeShiftId: null,
      }));
    }
  };

  const updateOrganizations = async (orgs: Organization[]) => {
    setState(prev => ({ ...prev, organizations: orgs }));
    for (const org of orgs) {
      await organizationService.update(org);
    }
  };

  const addOrganization = async (newOrg: Organization) => {
    await organizationService.create(newOrg);
    setState(prev => ({ ...prev, organizations: [...(prev.organizations || []), newOrg] }));
  };

  const addUser = async (newUser: User) => {
    await authService.createUser({
      email: newUser.email || `${newUser.username}@arbitrax.local`,
      password: newUser.password,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      organization_id: newUser.organization_id || orgId || authOrg?.id || '',
    });
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
  };

  const updateUsers = (updatedUsers: User[]) => {
    setState(prev => ({
      ...prev,
      users: updatedUsers,
      currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id || u.username === prev.currentUser?.username) || prev.currentUser,
    }));
  };

  const deleteUser = (username: string) => {
    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.username.toLowerCase() !== username.toLowerCase()),
    }));
  };

  const clearTransactions = () => {
    setState(prev => ({ ...prev, transactions: [], incomeExpenses: [], p2pCalcs: [] }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        loading,
        refreshState,
        addTransaction,
        addWallet,
        updateWallet,
        fundWallet,
        addExchange,
        updateExchangeBalance,
        addIncomeExpense,
        addP2PCalc,
        startShift,
        endShift,
        updateOrganizations,
        addOrganization,
        addUser,
        updateUsers,
        deleteUser,
        clearTransactions,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe ser utilizado dentro de un AppProvider');
  }
  return context;
}
