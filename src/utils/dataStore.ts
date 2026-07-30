/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User } from '../types';

export const DEFAULT_WALLETS: Wallet[] = [
  { id: 'mercado_pago', name: 'Mercado Pago', saldoPesos: 1250000, saldoUsdt: 300, color: 'blue', providerType: 'Fintech' },
  { id: 'lemon', name: 'Lemon Cash', saldoPesos: 450000, saldoUsdt: 120, color: 'green', providerType: 'Crypto Card' },
  { id: 'naranja_x', name: 'Naranja X', saldoPesos: 310000, saldoUsdt: 50, color: 'orange', providerType: 'Fintech' },
  { id: 'astro_pay', name: 'AstroPay', saldoPesos: 180000, saldoUsdt: 80, color: 'purple', providerType: 'International Wallet' },
  { id: 'brubank', name: 'Brubank', saldoPesos: 600000, saldoUsdt: 210, color: 'teal', providerType: 'Digital Bank' },
  { id: 'personal_pay', name: 'Personal Pay', saldoPesos: 250000, saldoUsdt: 100, color: 'cyan', providerType: 'Fintech' },
  { id: 'other', name: 'Otra Billetera', saldoPesos: 50000, saldoUsdt: 0, color: 'gray', providerType: 'Otro' },
];

export const DEFAULT_USERS: User[] = [
  { username: 'demo chip', name: 'demo chip', password: '123', role: 'vendedor' },
  { username: 'martin_p2p', name: 'Martin P2P', password: '123', role: 'vendedor' },
  { username: 'sofia_crypto', name: 'Sofia Crypto', password: '123', role: 'vendedor' },
  { username: 'admin', name: 'Administrador', password: 'admin', role: 'admin' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    type: 'compra',
    timestamp: '2026-07-14T01:22:00Z',
    dateString: '2026-07-14',
    timeString: '01:22:00',
    crypto: 'USDT',
    quantity: 150,
    unitPrice: 1220,
    totalPesos: 183000,
    walletId: 'mercado_pago',
    walletName: 'Mercado Pago',
    operator: 'Martin P2P',
    supplier: 'Binance Merchant X',
    notes: 'Compra inicial turno noche',
  },
  {
    id: 'tx-2',
    type: 'venta',
    timestamp: '2026-07-14T02:10:00Z',
    dateString: '2026-07-14',
    timeString: '02:10:00',
    crypto: 'USDT',
    quantity: 100,
    unitPrice: 1245,
    totalPesos: 124500,
    walletId: 'lemon',
    walletName: 'Lemon Cash',
    operator: 'Martin P2P',
    client: 'Juan Gomez',
    gain: 2500, // (1245 - 1220) * 100
    notes: 'Venta por transferencia bancaria',
  },
  {
    id: 'tx-3',
    type: 'ingreso_fondos',
    timestamp: '2026-07-14T03:00:00Z',
    dateString: '2026-07-14',
    timeString: '03:00:00',
    crypto: 'ARS',
    quantity: 0,
    unitPrice: 1,
    totalPesos: 500000,
    walletId: 'brubank',
    walletName: 'Brubank',
    operator: 'Martin P2P',
    notes: 'Inyección de capital para compras de USDT',
  },
];

const INITIAL_P2P: P2PArbitrage[] = [
  {
    id: 'p2p-1',
    timestamp: '2026-07-14T04:15:00Z',
    pesosUsed: 500000,
    usdtBought: 412.5,
    commissionPercent: 0.1,
    commissionAmount: 500,
    netUsdt: 412.09,
    averagePrice: 1213.33,
    targetSalePrice: 1238.00,
    grossRevenue: 510167.4,
    netProfit: 10167.4,
    profitabilityPercent: 2.03,
    notes: 'Filtro Binance P2P ARS/USDT',
  },
];

const INITIAL_SHIFTS: Shift[] = [
  {
    id: 'shift-1',
    operatorName: 'Martin P2P',
    startTime: '2026-07-14T01:00:00Z',
    endTime: '2026-07-14T05:00:00Z',
    initialBalances: {
      mercado_pago: { pesos: 1433000, usdt: 150 },
      lemon: { pesos: 325500, usdt: 220 },
    },
    finalBalances: {
      mercado_pago: { pesos: 1250000, usdt: 300 },
      lemon: { pesos: 450000, usdt: 120 },
    },
    totalPurchasesPesos: 183000,
    totalSalesPesos: 124500,
    totalGainsPesos: 2500,
    operationsCount: 3,
  },
];

const LOCAL_STORAGE_KEY = 'crypto_p2p_app_state_v1';

export function getInitialState(): AppState {
  if (typeof window === 'undefined') {
    return {
      wallets: DEFAULT_WALLETS,
      transactions: INITIAL_TRANSACTIONS,
      p2pCalcs: INITIAL_P2P,
      shifts: INITIAL_SHIFTS,
      activeShiftId: null,
      currentOperator: 'demo chip',
      users: DEFAULT_USERS,
      currentUser: DEFAULT_USERS[0],
    };
  }

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure basic keys are intact
      if (parsed.wallets && parsed.transactions) {
        if (!parsed.users || parsed.users.length === 0) {
          parsed.users = DEFAULT_USERS;
        }
        if (parsed.currentUser === undefined) {
          parsed.currentUser = parsed.users[0] || DEFAULT_USERS[0];
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load local storage state:', e);
  }

  // Fallback to defaults
  const state: AppState = {
    wallets: DEFAULT_WALLETS,
    transactions: INITIAL_TRANSACTIONS,
    p2pCalcs: INITIAL_P2P,
    shifts: INITIAL_SHIFTS,
    activeShiftId: null,
    currentOperator: 'demo chip',
    users: DEFAULT_USERS,
    currentUser: DEFAULT_USERS[0],
  };
  saveState(state);
  return state;
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to local storage:', e);
  }
}

/**
 * Calculates the current weighted average buy price of a cryptocurrency.
 * Useful for calculating real-time margins and gains.
 */
export function calculateAverageBuyPrice(transactions: Transaction[], crypto: string): number {
  const buys = transactions.filter(t => t.type === 'compra' && t.crypto.toUpperCase() === crypto.toUpperCase());
  if (buys.length === 0) {
    // Return a default realistic average if no buys are logged yet (e.g., around 1220 for USDT)
    return crypto.toUpperCase() === 'USDT' ? 1220 : 0;
  }

  let totalQty = 0;
  let totalCost = 0;
  buys.forEach(b => {
    totalQty += b.quantity;
    totalCost += b.totalPesos;
  });

  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Reset App Data helper
 */
export function clearAllData(): AppState {
  const freshState: AppState = {
    wallets: DEFAULT_WALLETS.map(w => ({ ...w })),
    transactions: [],
    p2pCalcs: [],
    shifts: [],
    activeShiftId: null,
    currentOperator: 'demo chip',
    users: DEFAULT_USERS,
    currentUser: DEFAULT_USERS[0],
  };
  saveState(freshState);
  return freshState;
}
