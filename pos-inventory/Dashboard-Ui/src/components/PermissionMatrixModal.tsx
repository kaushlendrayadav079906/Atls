import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  XCircle,
  AlertTriangle,
  Save,
  X,
  LogOut,
  Layers,
  UserRound,
  Phone,
  Briefcase,
  Mail,
  Search,
} from 'lucide-react';
import { adminApi, type UserPermissionsResponse } from '../api/endpoints';

interface PermissionMatrixModalProps {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    phone?: string | null;
    job_role?: string | null;
  };
  onClose: () => void;
  onSuccessNotice?: (msg: string) => void;
}

interface PermissionGroupConfig {
  title: string;
  iconName: string;
  permissions: {
    id: string;
    label: string;
    action: 'View' | 'Create' | 'Edit' | 'Delete' | 'Export' | 'Approve' | 'Process' | 'Manage';
  }[];
}

const PERMISSION_GROUPS: PermissionGroupConfig[] = [
  {
    title: 'Dashboard',
    iconName: 'LayoutDashboard',
    permissions: [{ id: 'dashboard.view', label: 'View Analytics & KPIs', action: 'View' }],
  },
  {
    title: 'Product & Inventory',
    iconName: 'Package',
    permissions: [
      { id: 'products.view', label: 'View Products & Stock', action: 'View' },
      { id: 'products.create', label: 'Create Products', action: 'Create' },
      { id: 'products.edit', label: 'Edit Product Details', action: 'Edit' },
      { id: 'products.delete', label: 'Delete Products', action: 'Delete' },
      { id: 'products.export', label: 'Export Inventory Data', action: 'Export' },
    ],
  },
  {
    title: 'Point of Sale',
    iconName: 'ShoppingCart',
    permissions: [
      { id: 'pos.access', label: 'Access POS Terminal', action: 'View' },
      { id: 'pos.checkout', label: 'Execute Checkout & Payments', action: 'Create' },
    ],
  },
  {
    title: 'Sales & Invoices',
    iconName: 'FileText',
    permissions: [
      { id: 'sales_orders.view', label: 'View Sales Orders', action: 'View' },
      { id: 'sales_orders.create', label: 'Create Sales Orders', action: 'Create' },
      { id: 'sales_orders.edit', label: 'Edit Sales Orders', action: 'Edit' },
      { id: 'sales_orders.export', label: 'Export Sales Orders', action: 'Export' },
      { id: 'invoices.view', label: 'View Sales Invoices', action: 'View' },
      { id: 'invoices.create', label: 'Create Invoices', action: 'Create' },
      { id: 'invoices.edit', label: 'Edit Invoices', action: 'Edit' },
      { id: 'invoices.export', label: 'Export Invoices', action: 'Export' },
      { id: 'purchase_orders.view', label: 'View Purchase Orders', action: 'View' },
      { id: 'purchase_orders.create', label: 'Create Purchase Orders', action: 'Create' },
      { id: 'purchase_orders.export', label: 'Export Purchase Orders', action: 'Export' },
    ],
  },
  {
    title: 'Customers',
    iconName: 'Users',
    permissions: [
      { id: 'customers.view', label: 'View Customer Profiles', action: 'View' },
      { id: 'customers.create', label: 'Create New Customer', action: 'Create' },
      { id: 'customers.edit', label: 'Edit Customer Information', action: 'Edit' },
    ],
  },
  {
    title: 'Returns & Approvals',
    iconName: 'Undo2',
    permissions: [
      { id: 'returns.view', label: 'View Returns', action: 'View' },
      { id: 'returns.create', label: 'Create Return Request', action: 'Create' },
      { id: 'returns.approve', label: 'Authorize / Approve Returns', action: 'Approve' },
      { id: 'returns.process', label: 'Process Restock & Credit Notes', action: 'Process' },
    ],
  },
  {
    title: 'Production',
    iconName: 'Factory',
    permissions: [
      { id: 'production.view', label: 'View Production Overview', action: 'View' },
      { id: 'production.orders.view', label: 'View Production Orders', action: 'View' },
      { id: 'production.reports.view', label: 'View Production Reports', action: 'View' },
    ],
  },
  {
    title: 'Financial',
    iconName: 'DollarSign',
    permissions: [
      { id: 'finance.view', label: 'View Financial Overview', action: 'View' },
      { id: 'finance.invoices.view', label: 'View Accounts Receivable/Payable', action: 'View' },
      { id: 'finance.payments.view', label: 'View Incoming/Outgoing Payments', action: 'View' },
      { id: 'finance.reports.view', label: 'View Profitability & Audit', action: 'View' },
    ],
  },
  {
    title: 'Reports',
    iconName: 'BarChart2',
    permissions: [
      { id: 'reports.view', label: 'View Standard Reports', action: 'View' },
      { id: 'reports.export', label: 'Export Report Data (CSV/XLSX)', action: 'Export' },
    ],
  },
  {
    title: 'Settings & Administration',
    iconName: 'ShieldAlert',
    permissions: [
      { id: 'settings.view', label: 'View Settings Dashboard', action: 'View' },
      { id: 'users.manage', label: 'Manage Employee Accounts', action: 'Manage' },
      { id: 'roles.manage', label: 'Configure System Roles', action: 'Manage' },
      { id: 'permissions.manage', label: 'Administer Permissions Matrix', action: 'Manage' },
    ],
  },
];

const actionBadgeStyles: Record<string, string> = {
  View: 'bg-blue-50 text-blue-700 border-blue-200',
  Create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Edit: 'bg-amber-50 text-amber-700 border-amber-200',
  Delete: 'bg-red-50 text-red-700 border-red-200',
  Export: 'bg-purple-50 text-purple-700 border-purple-200',
  Approve: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Process: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Manage: 'bg-rose-50 text-rose-700 border-rose-200',
};

const DEFAULT_ROLE_PRESETS: Record<string, string[]> = {
  admin: PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id)),
  manager: [
    'dashboard.view',
    'products.view', 'products.create', 'products.edit', 'products.export',
    'pos.access', 'pos.checkout',
    'sales_orders.view', 'sales_orders.create', 'sales_orders.edit', 'sales_orders.export',
    'invoices.view', 'invoices.create', 'invoices.edit', 'invoices.export',
    'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.edit', 'purchase_orders.export',
    'customers.view', 'customers.create', 'customers.edit',
    'returns.view', 'returns.create', 'returns.approve', 'returns.process',
    'production.view', 'production.orders.view', 'production.reports.view',
    'finance.view', 'finance.invoices.view', 'finance.payments.view', 'finance.reports.view',
    'reports.view', 'reports.export',
  ],
  operator: [
    'dashboard.view',
    'pos.access', 'pos.checkout',
    'products.view', 'products.export',
    'sales_orders.view', 'sales_orders.create',
    'invoices.view', 'invoices.create',
    'customers.view', 'customers.create',
    'returns.view', 'returns.create',
  ],
  user: [
    'dashboard.view',
    'pos.access', 'pos.checkout',
    'products.view',
    'sales_orders.view', 'sales_orders.create',
    'invoices.view', 'invoices.create',
    'customers.view', 'customers.create',
    'returns.view', 'returns.create',
  ],
};

const ROLE_TEMPLATES = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'operator', label: 'Operator' },
  { key: 'user', label: 'Cashier' },
];

export const PermissionMatrixModal: React.FC<PermissionMatrixModalProps> = ({
  user,
  onClose,
  onSuccessNotice,
}) => {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [initialPermissions, setInitialPermissions] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch effective permissions and custom assignments for this user
  const { data: userPerms, isLoading: permsLoading } = useQuery<UserPermissionsResponse>({
    queryKey: ['user-permissions', user.id],
    queryFn: () => adminApi.getUserPermissions(user.id),
  });

  // Fetch detailed user profile to ensure freshest database values are displayed
  const { data: userDetails } = useQuery({
    queryKey: ['admin-user-detail', user.id],
    queryFn: () => adminApi.getUser(user.id),
    initialData: user,
    staleTime: 0,
  });

  const activeUser = userDetails || user;

  // Fetch role definitions
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: adminApi.getRoles,
  });

  useEffect(() => {
    if (userPerms?.effective_permissions) {
      const permsSet = new Set(userPerms.effective_permissions);
      setSelectedPermissions(permsSet);
      setInitialPermissions(new Set(permsSet));
    }
  }, [userPerms]);

  const hasUnsavedChanges = useMemo(() => {
    if (selectedPermissions.size !== initialPermissions.size) return true;
    for (const p of selectedPermissions) {
      if (!initialPermissions.has(p)) return true;
    }
    return false;
  }, [selectedPermissions, initialPermissions]);

  // Mutation to save permission matrix
  const saveMutation = useMutation({
    mutationFn: (perms: string[]) => adminApi.setUserPermissions(user.id, perms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setInitialPermissions(new Set(selectedPermissions));
      if (onSuccessNotice) {
        onSuccessNotice(`Permissions updated successfully for ${user.name}.`);
      }
      onClose();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(detail || 'Failed to update permissions.');
    },
  });

  // Mutation to revoke active sessions
  const revokeMutation = useMutation({
    mutationFn: () => adminApi.revokeSessions(user.id),
    onSuccess: (data: { message?: string; token_version?: number }) => {
      setConfirmRevokeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      if (onSuccessNotice) {
        onSuccessNotice(data.message || `All active sessions revoked for ${user.name}.`);
      }
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(detail || 'Failed to revoke sessions.');
      setConfirmRevokeOpen(false);
    },
  });

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const toggleGroup = (group: PermissionGroupConfig) => {
    const allSelected = group.permissions.every((p) => selectedPermissions.has(p.id));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        group.permissions.forEach((p) => next.delete(p.id));
      } else {
        group.permissions.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return PERMISSION_GROUPS;

    return PERMISSION_GROUPS.map((group) => {
      const groupTitleMatches = group.title.toLowerCase().includes(query);
      const matchingPermissions = group.permissions.filter((p) => {
        return (
          groupTitleMatches ||
          p.label.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.action.toLowerCase().includes(query)
        );
      });

      return {
        ...group,
        permissions: matchingPermissions,
      };
    }).filter((group) => group.permissions.length > 0);
  }, [searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.permissions.length, 0);
  }, [filteredGroups]);

  const applyRoleDefaults = (roleName: string) => {
    const targetRole = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    if (targetRole && targetRole.permissions?.length) {
      setSelectedPermissions(new Set(targetRole.permissions));
    } else if (DEFAULT_ROLE_PRESETS[roleName.toLowerCase()]) {
      setSelectedPermissions(new Set(DEFAULT_ROLE_PRESETS[roleName.toLowerCase()]));
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved permission changes. Discard and exit?')) {
        return;
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4.5 bg-slate-50/60 rounded-t-3xl">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-700">
                  {user.role}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                  {user.is_active ? 'Active' : 'Deactivated'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                @{user.username} &bull; {user.email} &bull; Role-Based & Custom Action Permissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmRevokeOpen(true)}
              disabled={revokeMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
              title="Invalidate all active JWTs for this user immediately"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Revoke Sessions</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="flex items-center justify-between bg-amber-500/10 border-b border-amber-300 px-6 py-2.5 text-xs text-amber-900 font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>You have unsaved permission modifications for this employee.</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPermissions(new Set(initialPermissions))}
              className="text-amber-800 underline hover:text-amber-950 font-bold"
            >
              Reset
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-6 py-2.5 text-xs text-red-800 font-semibold">
            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* User Profile Details Section */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3.5">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <UserRound className="h-4 w-4 text-blue-600" />
            <span>User Profile</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                <span>Full Name</span>
              </div>
              <span className="mt-1 block text-sm font-bold text-slate-900 truncate" title={activeUser.name}>
                {activeUser.name || 'Not provided'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>Email Address</span>
              </div>
              <span className="mt-1 block text-sm font-semibold text-slate-800 truncate" title={activeUser.email}>
                {activeUser.email || 'Not provided'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>Phone Number</span>
              </div>
              <span className="mt-1 block text-sm font-semibold text-slate-800 truncate">
                {activeUser.phone || 'Not provided'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                <span>Job Role / Designation</span>
              </div>
              <span className="mt-1 block text-sm font-semibold text-slate-800 truncate" title={activeUser.job_role || 'Not provided'}>
                {activeUser.job_role || 'Not provided'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Shield className="h-3.5 w-3.5 text-slate-400" />
                <span>Username</span>
              </div>
              <span className="mt-1 block text-sm font-semibold text-slate-800 truncate">
                @{activeUser.username}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span>Application Access Role</span>
              </div>
              <div className="mt-1">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${activeUser.role?.toLowerCase() === 'admin'
                    ? 'bg-violet-100 text-violet-700'
                    : activeUser.role?.toLowerCase() === 'manager'
                      ? 'bg-amber-100 text-amber-800'
                      : activeUser.role?.toLowerCase() === 'operator'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}>
                  {activeUser.role?.toLowerCase() === 'user' ? 'Cashier' : activeUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick presets & Search toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-3">
          <div className="flex items-center flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="text-slate-500 font-medium">Apply Role Template:</span>
            {ROLE_TEMPLATES.map((tpl) => {
              const isMatch =
                Boolean(searchQuery.trim()) &&
                (tpl.label.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                  tpl.key.toLowerCase().includes(searchQuery.trim().toLowerCase()));

              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyRoleDefaults(tpl.key)}
                  title={`Apply ${tpl.label} permission template`}
                  className={`capitalize rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${isMatch
                      ? 'border-blue-400 bg-blue-100 text-blue-800 ring-2 ring-blue-300'
                      : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-slate-700'
                    }`}
                >
                  {tpl.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Search Input */}
            <div className="relative w-52 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                placeholder="Search permissions..."
                aria-label="Search permissions or role templates"
                data-testid="permission-search-input"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8.5 pr-7 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Selection actions */}
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  setSelectedPermissions((prev) => {
                    const next = new Set(prev);
                    filteredGroups.forEach((g) => g.permissions.forEach((p) => next.add(p.id)));
                    return next;
                  });
                } else {
                  const all = new Set<string>();
                  PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => all.add(p.id)));
                  setSelectedPermissions(all);
                }
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {searchQuery.trim() ? `Select Filtered (${totalFilteredCount})` : 'Select All'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  setSelectedPermissions((prev) => {
                    const next = new Set(prev);
                    filteredGroups.forEach((g) => g.permissions.forEach((p) => next.delete(p.id)));
                    return next;
                  });
                } else {
                  setSelectedPermissions(new Set());
                }
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {searchQuery.trim() ? 'Clear Filtered' : 'Clear All'}
            </button>
          </div>
        </div>

        {/* Scrollable Matrix Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {searchQuery.trim() && (
            <div className="flex items-center justify-between rounded-xl bg-blue-50/70 border border-blue-100 px-3.5 py-2 text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>
                  Showing <strong className="font-semibold">{totalFilteredCount}</strong> matching {totalFilteredCount === 1 ? 'permission' : 'permissions'} for &ldquo;<strong>{searchQuery.trim()}</strong>&rdquo; across <strong className="font-semibold">{filteredGroups.length}</strong> {filteredGroups.length === 1 ? 'group' : 'groups'}.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer ml-3 shrink-0"
              >
                Reset Filter
              </button>
            </div>
          )}

          {permsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mb-3" />
              <p className="text-sm font-semibold">Loading permission matrix...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">No permissions found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                No permissions matched &ldquo;{searchQuery}&rdquo;. Try another keyword like &ldquo;sales&rdquo;, &ldquo;invoice&rdquo;, &ldquo;orders&rdquo;, or &ldquo;production&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear search</span>
              </button>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const allChecked = group.permissions.every((p) => selectedPermissions.has(p.id));

              return (
                <div
                  key={group.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs transition hover:border-slate-300"
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Layers className="h-4 w-4 text-blue-600" />
                      <h3 className="font-bold text-slate-900 text-[15px]">{group.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {group.permissions.filter((p) => selectedPermissions.has(p.id)).length} /{' '}
                        {group.permissions.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                    >
                      {allChecked ? 'Deselect Group' : 'Select All in Group'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {group.permissions.map((perm) => {
                      const isChecked = selectedPermissions.has(perm.id);

                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start justify-between p-3 rounded-xl border transition cursor-pointer select-none ${isChecked
                              ? 'bg-blue-50/60 border-blue-200 text-slate-900 ring-1 ring-blue-500/20'
                              : 'bg-slate-50/40 border-slate-200/80 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.id)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <div className="font-semibold text-[13.5px] text-slate-900">{perm.label}</div>
                              <div className="font-mono text-[11px] text-slate-400 mt-0.5">{perm.id}</div>
                            </div>
                          </div>

                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${actionBadgeStyles[perm.action] || 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            {perm.action}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/80 rounded-b-3xl">
          <div className="text-xs text-slate-500">
            Total Granted:{' '}
            <span className="font-bold text-slate-900">{selectedPermissions.size}</span> permissions
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saveMutation.isPending || !hasUnsavedChanges}
              onClick={() => saveMutation.mutate(Array.from(selectedPermissions))}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>{saveMutation.isPending ? 'Saving...' : 'Save Permissions'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Session Revocation */}
      {confirmRevokeOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Revoke All Active Sessions?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              This will increment the security token version for <strong className="text-slate-900">{user.name}</strong>.
              All existing login sessions and active tokens will be invalidated immediately across all devices.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRevokeOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 shadow-sm"
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Yes, Revoke Sessions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
