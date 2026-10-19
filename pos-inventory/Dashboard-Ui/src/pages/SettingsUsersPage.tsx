import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Shield,
  UserRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { adminApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { PermissionMatrixModal } from '../components/PermissionMatrixModal';

interface BranchOption {
  id: string;
  name: string;
  location?: string | null;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  branch_id?: string | null;
  store_name?: string | null;
  is_active: boolean;
  created_at?: string | null;
  phone?: string | null;
  job_role?: string | null;
}

interface UserFormState {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'operator' | 'user';
  branch_id: string;
  store_name: string;
  phone: string;
  job_role: string;
}

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'operator', label: 'Operator' },
  { value: 'user', label: 'Cashier' },
] as const;

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 ring-1 ring-violet-400/30',
  manager: 'bg-amber-500/15 text-amber-800 ring-1 ring-amber-400/30',
  operator: 'bg-sky-500/15 text-slate-600 ring-1 ring-sky-400/30',
  user: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-400/30',
};

const normalizeRole = (value?: string | null) => (value ?? 'user').toLowerCase();

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const emptyForm = (): UserFormState => ({
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'user',
  branch_id: '',
  store_name: '',
  phone: '',
  job_role: '',
});

const fetchUsers = async (): Promise<AdminUser[]> => {
  const response = await apiClient.get('/admin/users');
  return response.data;
};

const fetchBranches = async (): Promise<BranchOption[]> => {
  const response = await apiClient.get('/admin/branches');
  return response.data;
};

export const SettingsUsersPage = () => {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const canManageUsers = userRole === 'admin';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [notice, setNotice] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPageInput, setJumpPageInput] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    enabled: canManageUsers,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: fetchBranches,
    enabled: canManageUsers,
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((item) => item.is_active).length;
  const adminCount = users.filter((item) => normalizeRole(item.role) === 'admin').length;
  const managerCount = users.filter((item) => normalizeRole(item.role) === 'manager').length;

  const filteredUsers = useMemo(
    () =>
      users.filter((item) => {
        const haystack = `${item.name} ${item.username} ${item.email} ${item.store_name ?? ''} ${item.branch_id ?? ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [search, users],
  );

  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedUsers = useMemo(
    () => filteredUsers.slice(startIndex, endIndex),
    [filteredUsers, startIndex, endIndex]
  );

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpPageInput('');
    }
  };

  const createUser = useMutation({
    mutationFn: async (payload: Record<string, string | boolean | undefined>) => {
      const response = await apiClient.post('/admin/users', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsCreateOpen(false);
      setForm(emptyForm());
      setNotice('User created successfully.');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Unable to create user.';
      setNotice(message);
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Record<string, string | boolean | undefined> }) => {
      const response = await apiClient.put(`/admin/users/${userId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      setNotice('User updated successfully.');
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      if (detail.includes('CANNOT_DEMOTE_LAST_ADMIN')) {
        setNotice('Safety Guard: Cannot demote the last active administrator. Create another admin first.');
      } else {
        setNotice(detail || 'Unable to update user.');
      }
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiClient.put(`/admin/users/${userId}`, { is_active: isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice('User account status updated.');
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '';
      if (detail.includes('CANNOT_DEACTIVATE_LAST_ADMIN')) {
        setNotice('Safety Guard: Cannot deactivate the last active administrator.');
      } else {
        setNotice(detail || 'Unable to update user status.');
      }
    },
  });

  const revokeUserSessions = useMutation({
    mutationFn: async (userId: string) => {
      return await adminApi.revokeSessions(userId);
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice(data.message || 'All sessions revoked successfully.');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to revoke sessions.';
      setNotice(message);
    },
  });

  const handleCreate = () => {
    setNotice('');
    createUser.mutate({
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      role: form.role,
      branch_id: form.branch_id || undefined,
      store_name: form.store_name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      job_role: form.job_role.trim() || undefined,
    });
  };

  const handleEditSave = () => {
    if (!editingUser) return;
    setNotice('');
    updateUser.mutate({
      userId: editingUser.id,
      payload: {
        name: editingUser.name.trim(),
        username: editingUser.username.trim(),
        email: editingUser.email.trim(),
        role: editingUser.role,
        branch_id: editingUser.branch_id || undefined,
        store_name: editingUser.store_name || undefined,
        phone: editingUser.phone?.trim() || undefined,
        job_role: editingUser.job_role?.trim() || undefined,
      },
    });
  };

  if (!canManageUsers) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-700 shadow-2xl shadow-slate-950/40">
        <div className="flex items-center gap-3 text-blue-600">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Access restricted</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Users & Roles</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-600">
          This module is limited to administrators. Sign in with an admin account to manage users and permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] w-full space-y-6 pb-8 text-slate-800">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-blue-600">Administration</p>
          <h1 className="atlas-page-title mt-1 text-[28px] sm:text-[32px] md:text-[34px] font-bold text-slate-900 leading-tight">Users & Roles</h1>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[14px] sm:text-[14.5px] font-bold text-white shadow-sm transition hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total users" value={String(totalUsers)} accent="blue" />
        <StatCard label="Active" value={String(activeUsers)} accent="emerald" />
        <StatCard label="Admins" value={String(adminCount)} accent="violet" />
        <StatCard label="Managers" value={String(managerCount)} accent="amber" />
      </div>

      {notice && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">{notice}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search user, email, branch..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-[13.5px] sm:text-[14px]">
              <thead className="bg-slate-50 text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-[26%]">Member</th>
                  <th className="px-4 py-3 w-[14%]">Role</th>
                  <th className="px-4 py-3 w-[16%]">Branch</th>
                  <th className="px-4 py-3 w-[12%]">Status</th>
                  <th className="px-4 py-3 w-[14%]">Created</th>
                  <th className="px-4 py-3 text-right w-[18%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      Loading users…
                    </td>
                  </tr>
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-100/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-800">
                            {member.name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{member.name}</div>
                            <div className="text-xs text-slate-500">{member.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass[normalizeRole(member.role)] ?? 'bg-slate-700 text-slate-700'}`}>
                          {roleOptions.find((role) => role.value === normalizeRole(member.role))?.label ?? member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{member.store_name || member.branch_id || 'Unassigned'}</div>
                        {member.branch_id && <div className="text-xs text-slate-500">{member.branch_id}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${member.is_active ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-400/30' : 'bg-red-500/15 text-red-700 ring-1 ring-red-400/30'}`}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(member.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPermissions(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
                            title="Configure module & action permissions"
                          >
                            <Shield className="h-3.5 w-3.5 text-blue-600" />
                            <span>Permissions</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUser(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const action = member.is_active ? 'deactivate' : 'activate';
                              if (window.confirm(`Are you sure you want to ${action} ${member.name}'s account?`)) {
                                toggleUserStatus.mutate({ userId: member.id, isActive: !member.is_active });
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition shadow-2xs cursor-pointer ${member.is_active
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Revoke all active sessions and invalidating tokens for ${member.name}?`)) {
                                revokeUserSessions.mutate(member.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                            title="Revoke all active sessions"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Bar */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs font-medium text-slate-600">
          {/* Showing info and page size */}
          <div className="flex items-center flex-wrap gap-3">
            <span>
              Showing <strong className="font-semibold text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="font-semibold text-slate-900">{endIndex}</strong> of{' '}
              <strong className="font-semibold text-slate-900">{totalItems}</strong> users
            </span>

            <div className="flex items-center gap-1.5 text-slate-500">
              <span>•</span>
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls: Arrows, Page Numbers & Direct Page Jump */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {/* First page arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                title="First page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>

              {/* Previous page arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                title="Previous 10 entries"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Numbered Page Buttons */}
              {pageNumbers.map((p, idx) =>
                typeof p === 'number' ? (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-8 min-w-[32px] px-2 items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                      safeCurrentPage === p
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-semibold select-none">
                    ...
                  </span>
                )
              )}

              {/* Next page arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                title="Next 10 entries"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Last page arrow */}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                title="Last page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>

            {/* Jump to Page Input Form */}
            <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-500 font-medium">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={String(safeCurrentPage)}
                className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!jumpPageInput.trim()}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <ModalShell title="Create user" onClose={() => setIsCreateOpen(false)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="input-style" />
              </Field>
              <Field label="Username">
                <input value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))} className="input-style" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="input-style" />
              </Field>
              <Field label="Password">
                <input type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} className="input-style" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role">
                <select value={form.role} onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as UserFormState['role'] }))} className="input-style">
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Branch">
                <select value={form.branch_id} onChange={(e) => setForm((current) => ({ ...current, branch_id: e.target.value }))} className="input-style">
                  <option value="">Unassigned</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Branch display name">
              <input value={form.store_name} onChange={(e) => setForm((current) => ({ ...current, store_name: e.target.value }))} className="input-style" placeholder="Main branch" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="input-style" placeholder="+91 98765 43210" />
              </Field>
              <Field label="Job Role / Designation">
                <input value={form.job_role} onChange={(e) => setForm((current) => ({ ...current, job_role: e.target.value }))} className="input-style" placeholder="Cashier, Manager, etc." />
              </Field>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-700 hover:bg-slate-700">
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={createUser.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                {createUser.isPending ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {editingUser && (
        <ModalShell title="Edit user" onClose={() => setEditingUser(null)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input value={editingUser.name} onChange={(event) => setEditingUser((current) => (current ? { ...current, name: event.target.value } : current))} className="input-style" />
              </Field>
              <Field label="Username">
                <input value={editingUser.username} onChange={(event) => setEditingUser((current) => (current ? { ...current, username: event.target.value } : current))} className="input-style" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input type="email" value={editingUser.email} onChange={(event) => setEditingUser((current) => (current ? { ...current, email: event.target.value } : current))} className="input-style" />
              </Field>
              <Field label="Role">
                <select value={normalizeRole(editingUser.role)} onChange={(event) => setEditingUser((current) => (current ? { ...current, role: event.target.value } : current))} className="input-style">
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input value={editingUser.phone ?? ''} onChange={(event) => setEditingUser((current) => (current ? { ...current, phone: event.target.value } : current))} className="input-style" placeholder="+91 98765 43210" />
              </Field>
              <Field label="Job Role / Designation">
                <input value={editingUser.job_role ?? ''} onChange={(event) => setEditingUser((current) => (current ? { ...current, job_role: event.target.value } : current))} className="input-style" placeholder="Cashier, Manager, etc." />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch">
                <select value={editingUser.branch_id ?? ''} onChange={(event) => setEditingUser((current) => (current ? { ...current, branch_id: event.target.value || null } : current))} className="input-style">
                  <option value="">Unassigned</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Store name">
                <input value={editingUser.store_name ?? ''} onChange={(event) => setEditingUser((current) => (current ? { ...current, store_name: event.target.value || null } : current))} className="input-style" />
              </Field>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-700 hover:bg-slate-700">
                Cancel
              </button>
              <button type="button" onClick={handleEditSave} disabled={updateUser.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                {updateUser.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {selectedUserForPermissions && (
        <PermissionMatrixModal
          key={selectedUserForPermissions.id}
          user={selectedUserForPermissions}
          onClose={() => setSelectedUserForPermissions(null)}
          onSuccessNotice={(msg) => setNotice(msg)}
        />
      )}
    </div>
  );
};

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'blue' | 'emerald' | 'violet' | 'amber' }) {
  const accentMap = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${accentMap[accent]}`}>
      <p className="atlas-card-title text-[12.5px] sm:text-[13px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 atlas-kpi-val text-2xl sm:text-[28px] font-black text-slate-900">{value}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-bold text-slate-600 hover:bg-slate-100">
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[13.5px] sm:text-[14px] text-slate-700">
      <span className="mb-1.5 block text-[12px] sm:text-[12.5px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
