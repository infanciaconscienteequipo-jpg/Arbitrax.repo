import { supabase } from '../lib/supabase';
import { Shift } from '../types';

export const shiftService = {
  async list(organizationId?: string): Promise<Shift[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase.from('shifts').select('*').order('start_time', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error al listar turnos:', error.message);
      return [];
    }
    return (data || []).map(mapShiftFromDB);
  },

  async getActiveShift(organizationId?: string): Promise<Shift | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    let query = supabase.from('shifts').select('*').is('end_time', null).order('start_time', { ascending: false });
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return null;
    }
    return mapShiftFromDB(data);
  },

  async startShift(operatorName: string, initialBalances: any, organizationId?: string): Promise<Shift> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null as any;

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      operatorName,
      startTime: new Date().toISOString(),
      initialBalances,
      totalPurchasesPesos: 0,
      totalSalesPesos: 0,
      totalGainsPesos: 0,
      operationsCount: 0,
      organization_id: organizationId,
    };

    return this.sync(newShift);
  },

  async closeShift(shiftId: string, finalBalances?: any): Promise<Shift | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: existing, error: getErr } = await supabase.from('shifts').select('*').eq('id', shiftId).single();
    if (getErr || !existing) {
      console.error('No se encontró el turno para cerrar:', getErr?.message);
      return null;
    }

    const updatedShift: Shift = {
      ...mapShiftFromDB(existing),
      endTime: new Date().toISOString(),
      finalBalances: finalBalances || existing.final_balances,
    };

    return this.sync(updatedShift);
  },

  async sync(shift: Shift): Promise<Shift> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return shift;

    const dbShift = mapShiftToDB(shift);
    const { error } = await supabase.from('shifts').upsert(dbShift);
    if (error) {
      console.error('Error al guardar turno:', error.message);
      throw error;
    }
    return shift;
  },
};

function mapShiftFromDB(s: any): Shift {
  return {
    id: s.id,
    operatorName: s.operator_name || s.operatorName,
    startTime: s.start_time || s.startTime,
    endTime: s.end_time || s.endTime,
    initialBalances: s.initial_balances || s.initialBalances || {},
    finalBalances: s.final_balances || s.finalBalances || {},
    totalPurchasesPesos: Number(s.total_purchases_pesos || s.totalPurchasesPesos || 0),
    totalSalesPesos: Number(s.total_sales_pesos || s.totalSalesPesos || 0),
    totalGainsPesos: Number(s.total_gains_pesos || s.totalGainsPesos || 0),
    operationsCount: Number(s.operations_count || s.operationsCount || 0),
    organization_id: s.organization_id,
  };
}

function mapShiftToDB(s: Shift) {
  return {
    id: s.id,
    operator_name: s.operatorName,
    start_time: s.startTime,
    end_time: s.endTime || null,
    initial_balances: s.initialBalances,
    final_balances: s.finalBalances || null,
    total_purchases_pesos: s.totalPurchasesPesos,
    total_sales_pesos: s.totalSalesPesos,
    total_gains_pesos: s.totalGainsPesos,
    operations_count: s.operationsCount,
    organization_id: s.organization_id || null,
    updated_at: new Date().toISOString(),
  };
}
