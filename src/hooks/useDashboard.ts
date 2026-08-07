import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../services/dashboard.service';

export function useDashboard(organizationId?: string) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const data = await dashboardService.getDashboardMetrics(organizationId);
    setMetrics(data);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    metrics,
    loading,
    refetch: loadDashboard,
  };
}
