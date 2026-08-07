import { useState, useEffect, useCallback } from 'react';
import { Wallet } from '../types';
import { walletService } from '../services/wallet.service';

export function useWallets(organizationId?: string) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await walletService.list(organizationId);
      setWallets(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar billeteras');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const createWallet = async (wallet: Wallet) => {
    const created = await walletService.create(wallet);
    setWallets(prev => [...prev, created]);
    return created;
  };

  const updateWallet = async (wallet: Wallet) => {
    const updated = await walletService.update(wallet);
    setWallets(prev => prev.map(w => (w.id === updated.id ? updated : w)));
    return updated;
  };

  const deleteWallet = async (id: string) => {
    const success = await walletService.delete(id);
    if (success) {
      setWallets(prev => prev.filter(w => w.id !== id));
    }
    return success;
  };

  return {
    wallets,
    loading,
    error,
    refetch: fetchWallets,
    createWallet,
    updateWallet,
    deleteWallet,
  };
}
