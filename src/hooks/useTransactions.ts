import { useState, useEffect, useCallback } from 'react';
import { Transaction } from '../types';
import { transactionService } from '../services/transaction.service';

export function useTransactions(organizationId?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await transactionService.list(organizationId);
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar transacciones');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const buy = async (params: Parameters<typeof transactionService.buy>[0]) => {
    const newTx = await transactionService.buy(params);
    setTransactions(prev => [newTx, ...prev]);
    return newTx;
  };

  const sell = async (params: Parameters<typeof transactionService.sell>[0]) => {
    const newTx = await transactionService.sell(params);
    setTransactions(prev => [newTx, ...prev]);
    return newTx;
  };

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    buy,
    sell,
  };
}
