/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Organization {
  id: string;
  name: string;
  adminName?: string;
  taxId?: string;
  country?: string;
  status: 'active' | 'suspended' | 'disabled';
  active?: boolean;
  plan: string;
  maxUsers: number;
  monthlyFee: number;
  createdAt: string;
  fechaIngreso?: string;
  subscriptionExpiresAt: string;
  lastLogin?: string;
  featureFlags: {
    p2pCalculator: boolean;
    shiftClosing: boolean;
    advancedReports: boolean;
    customCryptos: boolean;
    auditLogs: boolean;
  };
}

export interface Wallet {
  id: string;
  name: string;
  saldoPesos: number;
  saldoUsdt: number;
  color: string;
  providerType?: string;
  titular?: string;
  vendorId?: string;
  vendorName?: string;
  organization_id?: string;
  limitARS?: number;
  blocked?: boolean;
}

export interface ExchangeAccount {
  id: string;
  name: string;
  balanceCrypto: number;
  vendorId?: string;
  vendorName?: string;
  organization_id?: string;
}

export interface IncomeExpenseRecord {
  id: string;
  type: 'ingreso' | 'egreso';
  assetType: 'pesos' | 'exchange';
  walletOrExchangeId: string;
  walletOrExchangeName: string;
  timestamp: string;
  dateString: string;
  timeString: string;
  amount: number;
  transferPerson: string;
  reason: string;
  proofUrl?: string;
  operator: string;
  vendorId?: string;
  organization_id?: string;
  shiftId?: string;
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
  organization_id?: string;
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
  organization_id?: string;
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
  organization_id?: string;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR' | 'operator' | 'admin' | 'vendedor';

export interface User {
  id?: string;
  username: string;
  name: string;
  email?: string;
  password?: string;
  role: UserRole;
  organization_id: string | null;
  status?: 'active' | 'disabled' | 'suspended';
  active?: boolean;
  lastLogin?: string;
}

export interface AppState {
  organizations: Organization[];
  wallets: Wallet[];
  exchanges: ExchangeAccount[];
  incomeExpenses: IncomeExpenseRecord[];
  transactions: Transaction[];
  p2pCalcs: P2PArbitrage[];
  shifts: Shift[];
  activeShiftId: string | null;
  currentOperator: string;
  users: User[];
  currentUser: User | null;
}

