/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Wallet, Transaction, P2PArbitrage, Shift, User, Organization, ExchangeAccount } from '../types';

export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-1',
    name: 'ArbitraX Capital Partners S.A.',
    taxId: '30-71628391-4',
    country: 'Argentina',
    status: 'active',
    plan: 'Enterprise Pro',
    maxUsers: 10,
    monthlyFee: 250,
    createdAt: '2026-01-15',
    subscriptionExpiresAt: '2026-12-31',
    featureFlags: { p2pCalculator: true, shiftClosing: true, advancedReports: true, customCryptos: true, auditLogs: true }
  },
  {
    id: 'org-2',
    name: 'CriptoGlobal P2P SRL',
    taxId: '30-88492019-2',
    country: 'Argentina',
    status: 'active',
    plan: 'Pro SaaS',
    maxUsers: 5,
    monthlyFee: 120,
    createdAt: '2026-02-01',
    subscriptionExpiresAt: '2026-08-01',
    featureFlags: { p2pCalculator: true, shiftClosing: true, advancedReports: false, customCryptos: true, auditLogs: true }
  }
];

export const DEFAULT_WALLETS: Wallet[] = [
  { id: 'mercado_pago', name: 'Mercado Pago', saldoPesos: 1250000, saldoUsdt: 300, color: 'blue', providerType: 'Fintech', titular: 'Roberto Gómez', vendorId: 'u-2', vendorName: 'Roberto Gómez', organization_id: 'org-1', limitARS: 3000000, blocked: false },
  { id: 'lemon', name: 'Lemon Cash', saldoPesos: 450000, saldoUsdt: 120, color: 'green', providerType: 'Crypto Card', titular: 'Roberto Gómez', vendorId: 'u-2', vendorName: 'Roberto Gómez', organization_id: 'org-1', limitARS: 2000000, blocked: false },
  { id: 'naranja_x', name: 'Naranja X', saldoPesos: 310000, saldoUsdt: 50, color: 'orange', providerType: 'Fintech', titular: 'Carla Benítez', vendorId: 'u-3', vendorName: 'Carla Benítez', organization_id: 'org-1', limitARS: 1500000, blocked: false },
  { id: 'brubank', name: 'Brubank', saldoPesos: 600000, saldoUsdt: 210, color: 'teal', providerType: 'Digital Bank', titular: 'Carla Benítez', vendorId: 'u-3', vendorName: 'Carla Benítez', organization_id: 'org-1', limitARS: 5000000, blocked: false },
];

export const DEFAULT_EXCHANGES: ExchangeAccount[] = [
  { id: 'binance-main', name: 'Binance P2P', balanceCrypto: 1450, vendorId: 'u-2', vendorName: 'Roberto Gómez', organization_id: 'org-1' },
  { id: 'bybit-main', name: 'Bybit Official', balanceCrypto: 820, vendorId: 'u-2', vendorName: 'Roberto Gómez', organization_id: 'org-1' },
  { id: 'lemon-ex', name: 'Lemon Exchange', balanceCrypto: 310, vendorId: 'u-3', vendorName: 'Carla Benítez', organization_id: 'org-1' },
  { id: 'okx-main', name: 'OKX Pro', balanceCrypto: 600, vendorId: 'u-3', vendorName: 'Carla Benítez', organization_id: 'org-1' },
];

export const DEFAULT_USERS: User[] = [
  {
    id: 'u-super-1',
    email: 'arbitrax19@gmail.com',
    username: 'superadmin',
    name: 'Super Admin ArbitraX',
    password: 'Arbitrax.2006',
    role: 'SUPER_ADMIN',
    organization_id: null
  },
  {
    id: 'u-1',
    email: 'admiarbitrax1@gmail.com',
    username: 'admin',
    name: 'Administrador Principal',
    password: 'Arbitrax.2006',
    role: 'ADMIN',
    organization_id: 'org-1'
  },
  {
    id: 'u-2',
    email: 'roberto.g@arbitrax.com',
    username: 'roberto.g',
    name: 'Roberto Gómez (Vendedor)',
    password: 'Arbitrax.2006',
    role: 'VENDEDOR',
    organization_id: 'org-1'
  },
  {
    id: 'u-3',
    email: 'carla.b@arbitrax.com',
    username: 'carla.b',
    name: 'Carla Benítez (Vendedor)',
    password: 'Arbitrax.2006',
    role: 'VENDEDOR',
    organization_id: 'org-1'
  },
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
      organizations: DEFAULT_ORGANIZATIONS,
      wallets: DEFAULT_WALLETS,
      exchanges: DEFAULT_EXCHANGES,
      incomeExpenses: [],
      transactions: INITIAL_TRANSACTIONS,
      p2pCalcs: INITIAL_P2P,
      shifts: INITIAL_SHIFTS,
      activeShiftId: null,
      currentOperator: 'Roberto Gómez',
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
        if (!parsed.exchanges || parsed.exchanges.length === 0) {
          parsed.exchanges = DEFAULT_EXCHANGES;
        }
        if (!parsed.incomeExpenses) {
          parsed.incomeExpenses = [];
        }

        if (!parsed.organizations || parsed.organizations.length === 0) {
          parsed.organizations = DEFAULT_ORGANIZATIONS;
        } else {
          DEFAULT_ORGANIZATIONS.forEach(defOrg => {
            if (!parsed.organizations.some((o: Organization) => o.id === defOrg.id)) {
              parsed.organizations.push(defOrg);
            }
          });
        }

        if (!parsed.users || parsed.users.length === 0) {
          parsed.users = DEFAULT_USERS;
        } else {
          // Merge default users (Super Admin, Admins) if not present
          DEFAULT_USERS.forEach(defUser => {
            const index = parsed.users.findIndex((u: User) =>
              u.id === defUser.id ||
              (u.email && defUser.email && u.email.toLowerCase() === defUser.email.toLowerCase()) ||
              (u.username && defUser.username && u.username.toLowerCase() === defUser.username.toLowerCase())
            );
            if (index === -1) {
              parsed.users.push(defUser);
            } else {
              // Ensure role and password match default if updated
              parsed.users[index] = {
                ...parsed.users[index],
                email: parsed.users[index].email || defUser.email,
                role: defUser.role,
                password: parsed.users[index].password || defUser.password,
              };
            }
          });
        }

        if (!parsed.currentUser) {
          parsed.currentUser = parsed.users[0] || DEFAULT_USERS[0];
        } else {
          // Sync current user role/email
          const currentInList = parsed.users.find((u: User) => u.username === parsed.currentUser.username || u.email === parsed.currentUser.email);
          if (currentInList) {
            parsed.currentUser = currentInList;
          } else {
            parsed.currentUser = parsed.users[0] || DEFAULT_USERS[0];
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load local storage state:', e);
  }

  // Fallback to defaults
  const state: AppState = {
    organizations: DEFAULT_ORGANIZATIONS,
    wallets: DEFAULT_WALLETS,
    exchanges: DEFAULT_EXCHANGES,
    incomeExpenses: [],
    transactions: INITIAL_TRANSACTIONS,
    p2pCalcs: INITIAL_P2P,
    shifts: INITIAL_SHIFTS,
    activeShiftId: null,
    currentOperator: 'Roberto Gómez',
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
    organizations: DEFAULT_ORGANIZATIONS,
    wallets: DEFAULT_WALLETS.map(w => ({ ...w })),
    exchanges: DEFAULT_EXCHANGES.map(e => ({ ...e })),
    incomeExpenses: [],
    transactions: [],
    p2pCalcs: [],
    shifts: [],
    activeShiftId: null,
    currentOperator: 'Roberto Gómez',
    users: DEFAULT_USERS,
    currentUser: DEFAULT_USERS[0],
  };
  saveState(freshState);
  return freshState;
}
