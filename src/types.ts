/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Wallet {
  id: string;
  name: string;
  saldoPesos: number;
  saldoUsdt: number;
  color: string;
  providerType?: string;
  titular?: string;
}

export type TransactionType = 'compra' | 'venta' | 'ingreso_fondos' | 'egreso_fondos';

export interface Transaction {
  id: string;
  type: TransactionType;
  timestamp: string; // ISO string
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM:SS
  crypto: string;     // USDT, BTC, ETH, etc.
  quantity: number;
  unitPrice: number;
  totalPesos: number;
  walletId: string;
  walletName: string;
  operator: string;
  supplier?: string;  // Purchases
  client?: string;    // Sales
  gain?: number;      // Calculated profit on sales
  commissionBinance?: number; // Fee
  notes?: string;
  shiftId?: string;   // Reference to the active shift
}

export interface P2PArbitrage {
  id: string;
  timestamp: string;
  pesosUsed: number;
  usdtBought: number;
  commissionPercent: number; // Binance commission (e.g. 0.1)
  commissionAmount: number;
  netUsdt: number;
  averagePrice: number; // pesosUsed / netUsdt
  targetSalePrice: number; // ARS/USDT expected sale price
  grossRevenue: number; // netUsdt * targetSalePrice
  netProfit: number; // grossRevenue - pesosUsed
  profitabilityPercent: number; // (netProfit / pesosUsed) * 100
  notes?: string;
}

export interface Shift {
  id: string;
  operatorName: string;
  startTime: string; // ISO string
  endTime?: string;  // ISO string, null if active
  initialBalances: { [walletId: string]: { pesos: number; usdt: number } };
  finalBalances?: { [walletId: string]: { pesos: number; usdt: number } };
  totalPurchasesPesos: number;
  totalSalesPesos: number;
  totalGainsPesos: number;
  operationsCount: number;
}

export interface User {
  username: string;
  name: string;
  password?: string;
  role: 'vendedor' | 'admin';
}

export interface AppState {
  wallets: Wallet[];
  transactions: Transaction[];
  p2pCalcs: P2PArbitrage[];
  shifts: Shift[];
  activeShiftId: string | null;
  currentOperator: string;
  users: User[];
  currentUser: User | null;
}
