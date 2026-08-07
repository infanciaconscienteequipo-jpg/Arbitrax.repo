/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Organization, User } from '../types';
import { authService } from '../services/auth.service';
import {
  Crown,
  Building2,
  UserPlus,
  Building,
  DollarSign,
  Users,
  ShieldCheck,
  CreditCard,
  Sliders,
  Plus,
  Key,
  X,
  Lock,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Settings,
  Mail,
  User as UserIcon,
  AlertTriangle,
  RefreshCw,
  Clock,
  Briefcase
} from 'lucide-react';

interface SaasAdminProps {
  organizations: Organization[];
  users: User[];
  currentUser: User | null;
  onUpdateOrganizations: (orgs: Organization[]) => void;
  onAddOrganization: (newOrg: Organization) => void;
  onAddUser: (newUser: User) => void;
  onUpdateUsers: (users: User[]) => void;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}



export default function SaasAdmin({
  organizations,
  users,
  currentUser,
  onUpdateOrganizations,
  onAddOrganization,
  onAddUser,
  onUpdateUsers,
  activeSection = 'dashboard',
  onSectionChange,
}: SaasAdminProps) {
  // Local active tab fallback
  const [localTab, setLocalTab] = useState<'dashboard' | 'organizaciones' | 'administradores' | 'suscripciones' | 'configuracion'>('dashboard');

  const currentTab = onSectionChange ? (activeSection as any) : localTab;
  const setTab = (tab: any) => {
    if (onSectionChange) {
      onSectionChange(tab);
    } else {
      setLocalTab(tab);
    }
  };

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  
  // Admin Edit Modal
  const [showEditAdminModal, setShowEditAdminModal] = useState<User | null>(null);
  const [editAdminData, setEditAdminData] = useState({ name: '', email: '' });

  // Change Password Modal
  const [showPassModal, setShowPassModal] = useState<User | null>(null);
  const [newPass, setNewPass] = useState('Arbitrax.2006');

  // Delete Confirm Modal
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  // Search, Filters & Pagination for Organizations Table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'monthlyFee' | 'startDate' | 'vendors'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Form State for Create / Edit Organization & Admin
  const [formData, setFormData] = useState({
    orgName: '',
    adminName: '',
    email: '',
    password: 'Arbitrax.2006',
    monthlyFee: 120000,
    fechaIngreso: new Date().toISOString().substring(0, 10),
    status: 'active' as 'active' | 'suspended',
  });

  // Settings State
  const [settings, setSettings] = useState({
    saasName: 'ArbitraX PRO',
    currency: 'ARS',
    suspensionMessage: 'Estimado cliente, su suscripción se encuentra actualmente suspendida. Para restablecer el acceso a la terminal P2P, por favor comuníquese con Soporte.',
    notifyEmail: 'soporte@arbitrax.pro',
    autoLockUnpaid: true,
  });

  // Helper: Format Money in ARS
  const formatMoneyARS = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Helper: Calculate elapsed months
  const calculateMonthsElapsed = (startDateStr?: string) => {
    if (!startDateStr) return 1;
    const start = new Date(startDateStr);
    const now = new Date();
    if (isNaN(start.getTime())) return 1;

    const yearsDiff = now.getFullYear() - start.getFullYear();
    const monthsDiff = now.getMonth() - start.getMonth();
    const totalMonths = yearsDiff * 12 + monthsDiff + 1;
    return Math.max(1, totalMonths);
  };

  // KPI Calculations
  const activeOrgs = useMemo(() => organizations.filter(o => o.status === 'active').length, [organizations]);
  const suspendedOrgs = useMemo(() => organizations.filter(o => o.status === 'suspended' || o.status === 'disabled').length, [organizations]);
  
  const totalVendors = useMemo(() => {
    return users.filter(u => u.role === 'VENDEDOR' || u.role === 'vendedor' || u.role === 'operator').length;
  }, [users]);

  const totalAdmins = useMemo(() => {
    return users.filter(u => u.role === 'ADMIN' || u.role === 'admin').length;
  }, [users]);

  // Total Monthly Revenue in ARS from active organizations
  const monthlyRevenueARS = useMemo(() => {
    return organizations
      .filter(o => o.status === 'active')
      .reduce((sum, o) => sum + (o.monthlyFee || 0), 0);
  }, [organizations]);

  // New Organizations created in the current month
  const newOrgsThisMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return organizations.filter(o => {
      const dateStr = o.createdAt || o.fechaIngreso;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;
  }, [organizations]);

  // Helper: Count vendors per organization
  const getVendorCountForOrg = (orgId: string) => {
    return users.filter(u => u.organization_id === orgId && (u.role === 'VENDEDOR' || u.role === 'vendedor' || u.role === 'operator')).length;
  };

  // Helper: Get linked admin for an organization
  const getAdminForOrg = (orgId: string) => {
    return users.find(u => u.organization_id === orgId && (u.role === 'ADMIN' || u.role === 'admin'));
  };

  // Toggle active / suspended state
  const handleToggleStatus = (orgId: string) => {
    const targetOrg = organizations.find(o => o.id === orgId);
    if (!targetOrg) return;

    const newStatus: 'active' | 'suspended' = targetOrg.status === 'active' ? 'suspended' : 'active';

    const updatedOrgs = organizations.map(o => (o.id === orgId ? { ...o, status: newStatus, active: newStatus === 'active' } : o));
    onUpdateOrganizations(updatedOrgs);

    // Update all users belonging to this organization
    const updatedUsers: User[] = users.map(u => {
      if (u.organization_id === orgId && u.role !== 'SUPER_ADMIN') {
        const userStatus: 'active' | 'disabled' = newStatus === 'active' ? 'active' : 'disabled';
        return { ...u, status: userStatus, active: newStatus === 'active' };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
  };

  // Open Modal Create
  const handleOpenCreate = () => {
    setEditingOrg(null);
    setFormData({
      orgName: '',
      adminName: '',
      email: '',
      password: 'Arbitrax.2006',
      monthlyFee: 120000,
      fechaIngreso: new Date().toISOString().substring(0, 10),
      status: 'active',
    });
    setShowCreateModal(true);
  };

  // Open Modal Edit Organization
  const handleOpenEdit = (org: Organization) => {
    setEditingOrg(org);
    const linkedAdmin = getAdminForOrg(org.id);

    setFormData({
      orgName: org.name,
      adminName: org.adminName || linkedAdmin?.name || 'Administrador',
      email: linkedAdmin?.email || linkedAdmin?.username || 'admin@empresa.com',
      password: linkedAdmin?.password || 'Arbitrax.2006',
      monthlyFee: org.monthlyFee || 120000,
      fechaIngreso: org.fechaIngreso || org.createdAt || new Date().toISOString().substring(0, 10),
      status: org.status === 'active' ? 'active' : 'suspended',
    });
    setShowCreateModal(true);
  };

  // Open Modal Edit Admin Data
  const handleOpenEditAdmin = (adminUser: User) => {
    setShowEditAdminModal(adminUser);
    setEditAdminData({
      name: adminUser.name,
      email: adminUser.email || adminUser.username,
    });
  };

  // Save Edit Admin Data
  const handleSaveEditAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditAdminModal || !editAdminData.name.trim() || !editAdminData.email.trim()) return;

    const updatedUsers = users.map(u => {
      if (u.id === showEditAdminModal.id || u.username === showEditAdminModal.username) {
        return {
          ...u,
          name: editAdminData.name.trim(),
          email: editAdminData.email.trim().toLowerCase(),
          username: editAdminData.email.trim().toLowerCase().split('@')[0],
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    
    // Also sync adminName in Organization if linked
    if (showEditAdminModal.organization_id) {
      const updatedOrgs = organizations.map(o => {
        if (o.id === showEditAdminModal.organization_id) {
          return { ...o, adminName: editAdminData.name.trim() };
        }
        return o;
      });
      onUpdateOrganizations(updatedOrgs);
    }

    setShowEditAdminModal(null);
    alert('Datos del Administrador actualizados con éxito.');
  };

  // Submit Form Create / Edit Organization
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orgName.trim() || !formData.email.trim()) return;

    if (editingOrg) {
      // Update Existing Organization
      const updatedOrgs = organizations.map(o => {
        if (o.id === editingOrg.id) {
          return {
            ...o,
            name: formData.orgName.trim(),
            adminName: formData.adminName.trim(),
            monthlyFee: Number(formData.monthlyFee),
            fechaIngreso: formData.fechaIngreso,
            status: formData.status,
            active: formData.status === 'active',
          };
        }
        return o;
      });
      onUpdateOrganizations(updatedOrgs);

      // Update linked Admin user
      const updatedUsers: User[] = users.map(u => {
        if (u.organization_id === editingOrg.id && (u.role === 'ADMIN' || u.role === 'admin')) {
          const userStatus: 'active' | 'disabled' = formData.status === 'active' ? 'active' : 'disabled';
          return {
            ...u,
            name: formData.adminName.trim() || u.name,
            email: formData.email.trim().toLowerCase(),
            username: formData.email.trim().toLowerCase().split('@')[0],
            password: formData.password || u.password,
            status: userStatus,
            active: formData.status === 'active',
          };
        }
        return u;
      });
      onUpdateUsers(updatedUsers);

      alert(`Organización "${formData.orgName}" actualizada correctamente.`);
    } else {
      // Create New Organization + Admin User via Supabase Auth Admin & RPCs
      const newOrgId = `org-${Date.now()}`;
      const newOrg: Organization = {
        id: newOrgId,
        name: formData.orgName.trim(),
        adminName: formData.adminName.trim() || 'Administrador',
        status: formData.status,
        active: formData.status === 'active',
        monthlyFee: Number(formData.monthlyFee) || 120000,
        createdAt: formData.fechaIngreso,
        fechaIngreso: formData.fechaIngreso,
        subscriptionExpiresAt: '2026-12-31',
        lastLogin: new Date().toISOString().substring(0, 10),
        featureFlags: {
          p2pCalculator: true,
          shiftClosing: true,
          advancedReports: true,
          customCryptos: true,
          auditLogs: true,
        },
      };

      const createdAdmin = await authService.createUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password || 'Arbitrax.2006',
        name: formData.adminName.trim() || 'Admin Organización',
        username: formData.email.trim().toLowerCase().split('@')[0],
        role: 'ADMIN',
        organization_id: newOrgId,
      });

      onAddOrganization(newOrg);
      onAddUser(createdAdmin);
      alert(`Organización "${newOrg.name}" y Administrador creados exitosamente con Supabase.`);
    }

    setShowCreateModal(false);
  };

  // Confirm Delete Organization
  const handleConfirmDeleteOrg = () => {
    if (!orgToDelete) return;
    onUpdateOrganizations(organizations.filter(o => o.id !== orgToDelete.id));
    onUpdateUsers(users.filter(u => u.organization_id !== orgToDelete.id));
    setOrgToDelete(null);
    alert('Organización y usuarios asociados eliminados correctamente.');
  };

  // Change Admin Password
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPassModal || !newPass.trim()) return;

    const updatedUsers = users.map(u => {
      if (u.id === showPassModal.id || u.username === showPassModal.username) {
        return { ...u, password: newPass.trim() };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
    setShowPassModal(null);
    setNewPass('Arbitrax.2006');
    alert(`Contraseña para ${showPassModal.name} actualizada con éxito.`);
  };

  // Filtered & Sorted Organizations List
  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      const linkedAdmin = getAdminForOrg(org.id);
      const search = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !search ||
        org.name.toLowerCase().includes(search) ||
        (org.adminName && org.adminName.toLowerCase().includes(search)) ||
        (linkedAdmin && linkedAdmin.name.toLowerCase().includes(search)) ||
        (linkedAdmin && linkedAdmin.email && linkedAdmin.email.toLowerCase().includes(search));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && org.status === 'active') ||
        (statusFilter === 'suspended' && (org.status === 'suspended' || org.status === 'disabled'));

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'monthlyFee') {
        valA = a.monthlyFee || 0;
        valB = b.monthlyFee || 0;
      } else if (sortBy === 'startDate') {
        valA = new Date(a.fechaIngreso || a.createdAt || '2026-01-01').getTime();
        valB = new Date(b.fechaIngreso || b.createdAt || '2026-01-01').getTime();
      } else if (sortBy === 'vendors') {
        valA = getVendorCountForOrg(a.id);
        valB = getVendorCountForOrg(b.id);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [organizations, users, searchTerm, statusFilter, sortBy, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredOrganizations.length / rowsPerPage) || 1;
  const paginatedOrganizations = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrganizations.slice(start, start + rowsPerPage);
  }, [filteredOrganizations, currentPage, rowsPerPage]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const csvRows = [
      ['Organizacion', 'Administrador Principal', 'Email Admin', 'Valor Mensual (ARS)', 'Fecha Inicio', 'Vendedores', 'Estado', 'Ultimo Acceso'].join(',')
    ];

    filteredOrganizations.forEach(org => {
      const admin = getAdminForOrg(org.id);
      const vendorCount = getVendorCountForOrg(org.id);
      const row = [
        `"${org.name.replace(/"/g, '""')}"`,
        `"${(org.adminName || admin?.name || 'N/A').replace(/"/g, '""')}"`,
        `"${(admin?.email || admin?.username || 'N/A').replace(/"/g, '""')}"`,
        org.monthlyFee || 0,
        `"${org.fechaIngreso || org.createdAt || '2026-01-01'}"`,
        vendorCount,
        org.status === 'active' ? 'Activa' : 'Suspendida',
        `"${org.lastLogin || admin?.lastLogin || 'Hoy'}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `organizaciones_saas_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans antialiased text-binance-light">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 via-binance-black to-binance-card p-6 rounded-3xl border border-amber-500/40 space-y-3 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 font-mono">
                <Crown className="w-3.5 h-3.5" /> SUPER ADMINISTRADOR
              </span>
              <span className="text-binance-gray text-xs font-mono">&bull; Panel de Control Global SaaS</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1">Gestión Centralizada de Empresas y Suscripciones</h2>
            <p className="text-xs text-binance-gray">
              Administre organizaciones, cuentas de administradores, suscripciones mensuales en ARS y estados de suspensión.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono">
            <button
              onClick={handleOpenCreate}
              className="px-5 py-3 bg-gradient-to-r from-binance-yellow to-amber-400 hover:from-binance-yellow/90 hover:to-amber-500 text-binance-black font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-2 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              + Nueva Organización
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD INDICATORS GRID (6 MAIN CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 font-mono">
        {/* Card 1: Organizaciones Activas */}
        <div className="bg-binance-card border border-binance-border p-4 rounded-2xl space-y-2 hover:border-binance-green/50 transition-all">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Orgs. Activas</span>
            <CheckCircle2 className="w-4 h-4 text-binance-green" />
          </div>
          <div className="text-2xl font-black text-binance-green">{activeOrgs}</div>
          <div className="text-[10px] text-binance-green/80 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-binance-green animate-pulse"></span>
            Habilitadas
          </div>
        </div>

        {/* Card 2: Organizaciones Suspendidas */}
        <div className="bg-binance-card border border-binance-border p-4 rounded-2xl space-y-2 hover:border-binance-red/50 transition-all">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Orgs. Suspendidas</span>
            <XCircle className="w-4 h-4 text-binance-red" />
          </div>
          <div className="text-2xl font-black text-binance-red">{suspendedOrgs}</div>
          <div className="text-[10px] text-binance-red/80 font-bold">Bloqueadas</div>
        </div>

        {/* Card 3: Total Vendedores */}
        <div className="bg-binance-card border border-binance-border p-4 rounded-2xl space-y-2 hover:border-binance-yellow/50 transition-all">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Total Vendedores</span>
            <Users className="w-4 h-4 text-binance-yellow" />
          </div>
          <div className="text-2xl font-black text-binance-yellow">{totalVendors}</div>
          <div className="text-[10px] text-binance-gray">En todas las orgs</div>
        </div>

        {/* Card 4: Total Administradores */}
        <div className="bg-binance-card border border-binance-border p-4 rounded-2xl space-y-2 hover:border-sky-400/50 transition-all">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Administradores</span>
            <UserCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400">{totalAdmins}</div>
          <div className="text-[10px] text-sky-300/80">Admins principales</div>
        </div>

        {/* Card 5: Ingresos Mensuales (ARS) */}
        <div className="bg-binance-card border border-amber-500/30 p-4 rounded-2xl space-y-2 hover:border-amber-400 transition-all col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Ingresos Mensuales</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 truncate">{formatMoneyARS(monthlyRevenueARS)}</div>
          <div className="text-[10px] text-amber-300/80 font-bold">Suscripciones ARS/mes</div>
        </div>

        {/* Card 6: Nuevas Organizaciones */}
        <div className="bg-binance-card border border-binance-border p-4 rounded-2xl space-y-2 hover:border-purple-400/50 transition-all">
          <div className="flex justify-between items-center text-binance-gray text-[10px] uppercase font-bold tracking-wider">
            <span>Nuevas este Mes</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">+{newOrgsThisMonth}</div>
          <div className="text-[10px] text-purple-300/80">Nuevas altas</div>
        </div>
      </div>

      {/* RENDER SECTION ACCORDING TO ACTIVE NAVIGATION */}
      
      {/* SECTION 1: DASHBOARD OVERVIEW */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6 font-mono">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Quick Summary of Recent Organizations */}
            <div className="lg:col-span-2 bg-binance-card border border-binance-border p-6 rounded-3xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-binance-yellow" />
                  Organizaciones Recientes
                </h3>
                <button
                  onClick={() => setTab('organizaciones')}
                  className="text-[11px] text-binance-yellow hover:underline cursor-pointer font-bold"
                >
                  Ver Todas &rarr;
                </button>
              </div>

              <div className="divide-y divide-binance-border/40">
                {organizations.slice(0, 5).map(org => {
                  const admin = getAdminForOrg(org.id);
                  const isAct = org.status === 'active';
                  return (
                    <div key={org.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{org.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                            isAct ? 'bg-binance-green/20 text-binance-green border border-binance-green/30' : 'bg-binance-red/20 text-binance-red border border-binance-red/30'
                          }`}>
                            {isAct ? 'Activa' : 'Suspendida'}
                          </span>
                        </div>
                        <span className="text-[11px] text-binance-gray block">
                          Admin: {org.adminName || admin?.name || 'N/A'} ({admin?.email || admin?.username || 'admin'})
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-binance-yellow text-xs block">
                          {formatMoneyARS(org.monthlyFee || 0)}/mes
                        </span>
                        <span className="text-[10px] text-binance-gray">Alta: {org.fechaIngreso || org.createdAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Status & Control Card */}
            <div className="bg-binance-card border border-binance-border p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-binance-green" />
                Estado del Servidor SaaS
              </h3>

              <div className="p-4 bg-binance-black/60 border border-binance-border/60 rounded-2xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-binance-gray">Estado Supabase Auth & DB:</span>
                  <span className="px-2 py-0.5 rounded bg-binance-green/20 text-binance-green font-bold text-[10px]">
                    ✔ Online (Realtime)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-binance-gray">Aislamiento Multi-Tenant:</span>
                  <span className="text-white font-bold text-[10px]">Activo por Org ID</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-binance-gray">Moneda de Cobro:</span>
                  <span className="text-amber-400 font-bold text-[10px]">ARS (Pesos Argentinos)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-binance-gray">Sincronización en Tiempo Real:</span>
                  <span className="text-binance-green font-bold text-[10px]">Habilitada</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleOpenCreate}
                  className="w-full py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Registrar Nueva Organización
                </button>
                <button
                  onClick={() => setTab('suscripciones')}
                  className="w-full py-2.5 bg-binance-card hover:bg-binance-dark text-white border border-binance-border font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-binance-yellow" /> Ver Reporte de Suscripciones
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 2: ORGANIZACIONES (MAIN SCREEN FOR SUPER ADMIN) */}
      {(currentTab === 'organizaciones' || currentTab === 'saas-organizaciones') && (
        <div className="space-y-4 font-mono">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-binance-yellow" />
                Directorio y Administración de Organizaciones
              </h3>
              <p className="text-xs text-binance-gray">
                Cree, edite, suspenda o reactive organizaciones y sus administradores principales.
              </p>
            </div>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-binance-yellow hover:bg-binance-yellow/90 text-binance-black font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-2 uppercase tracking-wider shrink-0"
            >
              <Plus className="w-4 h-4" />
              + Nueva Organización
            </button>
          </div>

          {/* Search, Filter & Controls Toolbar */}
          <div className="bg-binance-card border border-binance-border p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-binance-gray absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por organización o admin..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
              />
            </div>

            {/* Filter and Sort controls */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-binance-gray" />
                <select
                  value={statusFilter}
                  onChange={e => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="active">🟢 Solo Activas</option>
                  <option value="suspended">🔴 Solo Suspendidas</option>
                </select>
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold cursor-pointer"
              >
                <option value="name">Ordenar por Nombre</option>
                <option value="monthlyFee">Ordenar por Mensualidad</option>
                <option value="startDate">Ordenar por Fecha Inicio</option>
                <option value="vendors">Ordenar por Vendedores</option>
              </select>

              {/* Order Direction */}
              <button
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-binance-yellow font-bold hover:bg-binance-border/40 transition-all cursor-pointer"
                title="Cambiar orden ascendente/descendente"
              >
                {sortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
              </button>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 bg-binance-green/20 hover:bg-binance-green/30 text-binance-green border border-binance-green/40 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Exportar listado a archivo CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>

          {/* ORGANIZATIONS TABLE (MODERN DATAGRID) */}
          <div className="bg-binance-card border border-binance-border rounded-2xl overflow-hidden shadow-xl">
            {paginatedOrganizations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-binance-gray text-xs">No se encontraron organizaciones con los criterios seleccionados.</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                  className="px-3 py-1.5 bg-binance-yellow/20 text-binance-yellow rounded-lg text-xs font-bold"
                >
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-binance-dark/90 text-binance-gray uppercase text-[10px] tracking-wider border-b border-binance-border">
                    <tr>
                      <th className="p-3 cursor-pointer hover:text-white" onClick={() => setSortBy('name')}>
                        Nombre de la Organización
                      </th>
                      <th className="p-3">Administrador Principal</th>
                      <th className="p-3 text-right cursor-pointer hover:text-white" onClick={() => setSortBy('monthlyFee')}>
                        Valor Mensual (ARS)
                      </th>
                      <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => setSortBy('startDate')}>
                        Fecha de Inicio
                      </th>
                      <th className="p-3 text-center cursor-pointer hover:text-white" onClick={() => setSortBy('vendors')}>
                        Vendedores
                      </th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Último Acceso</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-binance-border/30">
                    {paginatedOrganizations.map(org => {
                      const admin = getAdminForOrg(org.id);
                      const vendorCount = getVendorCountForOrg(org.id);
                      const isAct = org.status === 'active';
                      const fechaStr = org.fechaIngreso || org.createdAt || '2026-01-01';

                      return (
                        <tr key={org.id} className="hover:bg-binance-black/40 transition-all">
                          {/* Organization Name */}
                          <td className="p-3">
                            <span className="font-extrabold text-white text-xs block">{org.name}</span>
                            <span className="text-[10px] text-binance-gray">ID: {org.id}</span>
                          </td>

                          {/* Main Administrator */}
                          <td className="p-3">
                            <span className="font-bold text-sky-400 block">{org.adminName || admin?.name || 'Administrador'}</span>
                            <span className="text-[10px] text-binance-gray block">{admin?.email || admin?.username || 'sin_email@saas.com'}</span>
                          </td>

                          {/* Monthly Fee in ARS */}
                          <td className="p-3 text-right font-black text-amber-400">
                            {formatMoneyARS(org.monthlyFee || 0)}
                            <span className="text-[9px] text-binance-gray block font-normal">mensual</span>
                          </td>

                          {/* Start Date */}
                          <td className="p-3 text-center text-binance-gray font-bold">
                            {fechaStr}
                          </td>

                          {/* Vendor Count */}
                          <td className="p-3 text-center font-bold text-white">
                            <span className="px-2 py-0.5 rounded-full bg-binance-dark border border-binance-border text-binance-yellow text-[11px]">
                              👥 {vendorCount}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {isAct ? (
                              <span className="px-2.5 py-1 rounded-full bg-binance-green/20 text-binance-green text-[10px] font-extrabold border border-binance-green/40 inline-flex items-center gap-1 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-binance-green animate-pulse"></span>
                                Activa
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-binance-red/20 text-binance-red text-[10px] font-extrabold border border-binance-red/40 inline-flex items-center gap-1 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-binance-red"></span>
                                Suspendida
                              </span>
                            )}
                          </td>

                          {/* Last Access */}
                          <td className="p-3 text-center text-binance-gray text-[11px]">
                            {org.lastLogin || admin?.lastLogin || 'Hoy 15:30'}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Toggle Suspend / Reactivate */}
                              <button
                                onClick={() => handleToggleStatus(org.id)}
                                className={`px-2 py-1 rounded text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                                  isAct
                                    ? 'bg-binance-red/20 text-binance-red hover:bg-binance-red/30 border border-binance-red/30'
                                    : 'bg-binance-green/20 text-binance-green hover:bg-binance-green/30 border border-binance-green/30'
                                }`}
                                title={isAct ? 'Suspender Organización' : 'Reactivar Organización'}
                              >
                                {isAct ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                {isAct ? 'Suspender' : 'Reactivar'}
                              </button>

                              {/* Edit Org */}
                              <button
                                onClick={() => handleOpenEdit(org)}
                                className="px-2 py-1 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Editar organización"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              {/* Edit Admin Data */}
                              {admin && (
                                <button
                                  onClick={() => handleOpenEditAdmin(admin)}
                                  className="px-2 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Editar datos del administrador"
                                >
                                  <UserIcon className="w-3 h-3" />
                                </button>
                              )}

                              {/* Change Password */}
                              {admin && (
                                <button
                                  onClick={() => setShowPassModal(admin)}
                                  className="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Cambiar contraseña del admin"
                                >
                                  <Lock className="w-3 h-3" />
                                </button>
                              )}

                              {/* Delete Org */}
                              <button
                                onClick={() => setOrgToDelete(org)}
                                className="px-2 py-1 bg-binance-red/20 text-binance-red hover:bg-binance-red/30 border border-binance-red/30 rounded text-[10px] font-bold transition-all cursor-pointer"
                                title="Eliminar organización"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls Footer */}
            <div className="p-4 bg-binance-dark/80 border-t border-binance-border flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-binance-gray">
              <div>
                Mostrando <span className="font-bold text-white">{paginatedOrganizations.length}</span> de <span className="font-bold text-white">{filteredOrganizations.length}</span> organizaciones
              </div>

              <div className="flex items-center gap-4">
                {/* Rows per page selector */}
                <div className="flex items-center gap-1">
                  <span>Filas:</span>
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-binance-card border border-binance-border rounded text-white font-bold"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* Page Prev/Next */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-binance-card border border-binance-border rounded text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-white px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 bg-binance-card border border-binance-border rounded text-white disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: ADMINISTRADORES */}
      {(currentTab === 'administradores' || currentTab === 'saas-administradores') && (
        <div className="space-y-4 font-mono">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-400" />
                Directorio de Administradores Principales
              </h3>
              <p className="text-xs text-binance-gray">Lista de administradores vinculados a cada organización registrada.</p>
            </div>
          </div>

          <div className="bg-binance-card border border-binance-border rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-binance-dark/90 text-binance-gray uppercase text-[10px] tracking-wider border-b border-binance-border">
                <tr>
                  <th className="p-3">Nombre del Administrador</th>
                  <th className="p-3">Correo / Usuario</th>
                  <th className="p-3">Organización Asignada</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Último Acceso</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-binance-border/30">
                {users
                  .filter(u => u.role === 'ADMIN' || u.role === 'admin')
                  .map(admin => {
                    const linkedOrg = organizations.find(o => o.id === admin.organization_id);
                    const isAct = admin.status === 'active' || admin.active !== false;

                    return (
                      <tr key={admin.id || admin.username} className="hover:bg-binance-black/40 transition-all">
                        <td className="p-3 font-bold text-white">{admin.name}</td>
                        <td className="p-3 text-sky-400">{admin.email || admin.username}</td>
                        <td className="p-3 text-binance-yellow font-bold">{linkedOrg ? linkedOrg.name : 'Sin Organización'}</td>
                        <td className="p-3 text-center">
                          {isAct ? (
                            <span className="px-2 py-0.5 rounded-full bg-binance-green/20 text-binance-green text-[9px] font-bold border border-binance-green/30">
                              Activo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-binance-red/20 text-binance-red text-[9px] font-bold border border-binance-red/30">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-binance-gray">{admin.lastLogin || 'Hoy 14:00'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditAdmin(admin)}
                              className="px-2 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Editar Datos
                            </button>
                            <button
                              onClick={() => setShowPassModal(admin)}
                              className="px-2 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Cambiar Clave
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: SUSCRIPCIONES */}
      {(currentTab === 'suscripciones' || currentTab === 'saas-suscripciones') && (
        <div className="space-y-6 font-mono">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-binance-yellow" />
                Administración de Suscripciones e Ingresos
              </h3>
              <p className="text-xs text-binance-gray">Control de facturación en Pesos Argentinos (ARS) por organización.</p>
            </div>
          </div>

          {/* SaaS Revenue Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-binance-card border border-binance-border p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-[10px] text-binance-gray uppercase font-extrabold tracking-wider">Recaudación Mensual (MRR)</span>
              <div className="text-xl font-black text-amber-400">
                {formatMoneyARS(monthlyRevenueARS)}
              </div>
              <p className="text-[10px] text-binance-gray">Facturación de org. activas</p>
            </div>

            <div className="bg-binance-card border border-binance-border p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-[10px] text-binance-gray uppercase font-extrabold tracking-wider">Organizaciones Registradas</span>
              <div className="text-xl font-black text-white">
                {organizations.length} <span className="text-xs font-normal text-binance-green">({activeOrgs} Activas)</span>
              </div>
              <p className="text-[10px] text-binance-gray">Sin límite de usuarios</p>
            </div>

            <div className="bg-binance-card border border-binance-border p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-[10px] text-binance-gray uppercase font-extrabold tracking-wider">Cuota Promedio por Org</span>
              <div className="text-xl font-black text-sky-400">
                {formatMoneyARS(activeOrgs ? Math.round(monthlyRevenueARS / activeOrgs) : 0)}
              </div>
              <p className="text-[10px] text-binance-gray">Precio promedio en ARS</p>
            </div>

            <div className="bg-binance-card border border-binance-border p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-[10px] text-binance-gray uppercase font-extrabold tracking-wider">Límite de Usuarios</span>
              <div className="text-xl font-black text-binance-green">
                Ilimitado
              </div>
              <p className="text-[10px] text-binance-gray">Acceso total para operadores</p>
            </div>
          </div>

          {/* Subscriptions Billing Breakdown Table */}
          <div className="bg-binance-card border border-binance-border p-6 rounded-3xl space-y-4 shadow-xl">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
              Desglose de Recaudación por Organización
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-binance-dark/80 text-binance-gray uppercase text-[10px] tracking-wider border-b border-binance-border">
                  <tr>
                    <th className="p-3">Organización / Admin</th>
                    <th className="p-3 text-center">Fecha Inicio</th>
                    <th className="p-3 text-right">Cuota Mensual (ARS)</th>
                    <th className="p-3 text-center">Meses Activa</th>
                    <th className="p-3 text-right">Total Recaudado (ARS)</th>
                    <th className="p-3 text-center">Estado Cobro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-binance-border/30">
                  {organizations.map(org => {
                    const fechaStr = org.fechaIngreso || org.createdAt || '2026-01-01';
                    const monthsCount = calculateMonthsElapsed(fechaStr);
                    const totalInvoiced = monthsCount * (org.monthlyFee || 0);

                    return (
                      <tr key={org.id} className="hover:bg-binance-black/40 transition-all">
                        <td className="p-3">
                          <span className="font-bold text-white block">{org.name}</span>
                          <span className="text-[10px] text-binance-gray">{org.adminName || 'Admin'}</span>
                        </td>
                        <td className="p-3 text-center text-binance-gray">{fechaStr}</td>
                        <td className="p-3 text-right text-amber-400 font-bold">{formatMoneyARS(org.monthlyFee || 0)}</td>
                        <td className="p-3 text-center text-white font-bold">{monthsCount} meses</td>
                        <td className="p-3 text-right text-binance-green font-black">{formatMoneyARS(totalInvoiced)}</td>
                        <td className="p-3 text-center">
                          {org.status === 'active' ? (
                            <span className="px-2 py-0.5 rounded bg-binance-green/20 text-binance-green text-[9px] font-bold border border-binance-green/40">
                              ✔ Al Día
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-binance-red/20 text-binance-red text-[9px] font-bold border border-binance-red/40">
                              ❌ Suspendida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: CONFIGURACIÓN */}
      {(currentTab === 'configuracion' || currentTab === 'saas-configuracion') && (
        <div className="space-y-6 font-mono">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-binance-yellow" />
                Configuración del Sistema SaaS
              </h3>
              <p className="text-xs text-binance-gray">Ajustes globales de la plataforma, mensajes de suspensión y monedas.</p>
            </div>
          </div>

          <div className="bg-binance-card border border-binance-border p-6 rounded-3xl space-y-6 max-w-3xl shadow-xl">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nombre de la Plataforma SaaS
                </label>
                <input
                  type="text"
                  value={settings.saasName}
                  onChange={e => setSettings({ ...settings, saasName: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Moneda Predeterminada para Cobros
                </label>
                <select
                  value={settings.currency}
                  onChange={e => setSettings({ ...settings, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white font-bold text-amber-400 outline-hidden focus:border-binance-yellow"
                >
                  <option value="ARS">ARS - Pesos Argentinos ($)</option>
                  <option value="USD">USD - Dólares Estadounidenses ($)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Mensaje por Defecto al Intentar Ingresar a Organización Suspendida
                </label>
                <textarea
                  rows={3}
                  value={settings.suspensionMessage}
                  onChange={e => setSettings({ ...settings, suspensionMessage: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Correo Electrónico de Notificaciones
                </label>
                <input
                  type="email"
                  value={settings.notifyEmail}
                  onChange={e => setSettings({ ...settings, notifyEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-dark border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>
            </div>

            <button
              onClick={() => alert('Configuración global del SaaS guardada correctamente.')}
              className="px-6 py-3 bg-gradient-to-r from-binance-yellow to-amber-400 text-binance-black font-black rounded-xl text-xs uppercase tracking-wider shadow-md hover:from-binance-yellow/90 hover:to-amber-500 cursor-pointer"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      )}

      {/* MODAL: FORMULARIO NUEVA / EDITAR ORGANIZACIÓN */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-binance-dark border border-binance-border p-6 sm:p-8 rounded-3xl w-full max-w-lg space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-binance-yellow" />
                {editingOrg ? 'Editar Organización' : 'Formulario Nueva Organización'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-binance-gray hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Nombre de la Organización */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nombre de la Organización *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. CriptoGlobal P2P SRL"
                  value={formData.orgName}
                  onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              {/* Valor Mensual de la Suscripción (ARS) */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Valor Mensual de la Suscripción (ARS) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="ej. 120000"
                  value={formData.monthlyFee}
                  onChange={e => setFormData({ ...formData, monthlyFee: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-amber-400 font-bold outline-hidden focus:border-binance-yellow"
                />
                <span className="text-[10px] text-binance-gray mt-1 block">
                  Vista previa: {formatMoneyARS(Number(formData.monthlyFee) || 0)} / mes
                </span>
              </div>

              {/* Fecha de Inicio */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  required
                  value={formData.fechaIngreso}
                  onChange={e => setFormData({ ...formData, fechaIngreso: e.target.value })}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              {/* Nombre completo del Administrador */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nombre Completo del Administrador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Carlos Pérez"
                  value={formData.adminName}
                  onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              {/* Correo Electrónico & Contraseña Temporal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@empresa.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                    Contraseña Temporal *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                  />
                </div>
              </div>

              {/* Estado de la Organización */}
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Estado Inicial
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' })}
                  className="w-full px-3 py-2.5 bg-binance-card border border-binance-border rounded-xl text-white font-bold outline-hidden focus:border-binance-yellow"
                >
                  <option value="active" className="text-binance-green font-bold">🟢 Activa (Acceso Permitido)</option>
                  <option value="suspended" className="text-binance-red font-bold">🔴 Suspendida (Acceso Bloqueado)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-binance-yellow to-amber-400 text-binance-black font-black rounded-xl uppercase tracking-wider text-xs shadow-lg mt-4 cursor-pointer hover:from-binance-yellow/90 hover:to-amber-500"
              >
                {editingOrg ? 'Guardar Cambios de Organización' : 'Crear Organización y Administrador'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR DATOS DEL ADMINISTRADOR */}
      {showEditAdminModal && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-purple-400" />
                Editar Datos del Administrador
              </h3>
              <button onClick={() => setShowEditAdminModal(null)} className="text-binance-gray hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAdmin} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editAdminData.name}
                  onChange={e => setEditAdminData({ ...editAdminData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editAdminData.email}
                  onChange={e => setEditAdminData({ ...editAdminData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-purple-500 text-white font-extrabold rounded-xl uppercase tracking-wider text-xs shadow-md mt-2 cursor-pointer hover:bg-purple-600"
              >
                Guardar Datos Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR CONTRASEÑA DE ADMINISTRADOR */}
      {showPassModal && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-binance-dark border border-binance-border p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-binance-border/60 pb-3">
              <h3 className="font-bold text-white text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                Cambiar Contraseña: {showPassModal.name}
              </h3>
              <button onClick={() => setShowPassModal(null)} className="text-binance-gray hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-binance-gray uppercase font-bold block mb-1">
                  Nueva Contraseña Temporal
                </label>
                <input
                  type="text"
                  required
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="w-full px-3 py-2 bg-binance-card border border-binance-border rounded-xl text-white outline-hidden focus:border-binance-yellow font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 text-binance-black font-extrabold rounded-xl uppercase tracking-wider text-xs shadow-md mt-2 cursor-pointer hover:bg-amber-400"
              >
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE ORGANIZACIÓN */}
      {orgToDelete && (
        <div className="fixed inset-0 bg-binance-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-binance-dark border border-binance-red/50 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 text-binance-red">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-white text-sm">Eliminar Organización</h3>
            </div>

            <p className="text-xs text-binance-gray leading-relaxed">
              ¿Está seguro de que desea eliminar permanentemente la organización <strong className="text-white">{orgToDelete.name}</strong> y todos sus usuarios vinculados? Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOrgToDelete(null)}
                className="flex-1 py-2.5 bg-binance-card hover:bg-binance-border text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteOrg}
                className="flex-1 py-2.5 bg-binance-red hover:bg-binance-red/90 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer uppercase tracking-wider"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
