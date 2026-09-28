import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Plus, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

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
}

interface UserFormState {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'operator' | 'user';
  branch_id: string;
  store_name: string;
}

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'operator', label: 'Operator' },
  { value: 'user', label: 'Cashier' },
] as const;

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30',
  manager: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30',
  operator: 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30',
  user: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30',
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
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [notice, setNotice] = useState('');

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
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Unable to update user.';
      setNotice(message);
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiClient.put(`/admin/users/${userId}`, { is_active: isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice('Status updated.');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Unable to update status.';
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
      },
    });
  };

  if (!canManageUsers) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-sky-900/80 bg-[#0b1f35] p-8 text-slate-200 shadow-2xl shadow-slate-950/40">
        <div className="flex items-center gap-3 text-sky-300">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Access restricted</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-white">Users & Roles</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          This module is limited to administrators. Sign in with an admin account to manage users and permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8 text-slate-100">
      <div className="flex flex-col gap-4 rounded-2xl border border-sky-900/80 bg-[#0b1f35] p-5 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Administration</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Users & Roles</h1>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
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
        <div className="rounded-xl border border-sky-700/60 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">{notice}</div>
      )}

      <div className="rounded-2xl border border-sky-900/80 bg-[#0b1f35] p-4 shadow-xl shadow-slate-950/20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, email, branch..."
              className="w-full rounded-lg border border-sky-800 bg-[#081c2e] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-sky-900/80">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sky-900/80 text-left text-sm">
              <thead className="bg-[#081c2e] text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-900/80 bg-[#0b1f35]">
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Loading users…
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((member) => (
                    <tr key={member.id} className="hover:bg-sky-950/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-100">
                            {member.name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium text-white">{member.name}</div>
                            <div className="text-xs text-slate-400">{member.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass[normalizeRole(member.role)] ?? 'bg-slate-700 text-slate-200'}`}>
                          {roleOptions.find((role) => role.value === normalizeRole(member.role))?.label ?? member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200">{member.store_name || member.branch_id || 'Unassigned'}</div>
                        {member.branch_id && <div className="text-xs text-slate-400">{member.branch_id}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${member.is_active ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30' : 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30'}`}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(member.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUser(member)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-700 bg-sky-900/60 px-2 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-800"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleUserStatus.mutate({ userId: member.id, isActive: !member.is_active })}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
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
              <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                Cancel
              </button>
              <button type="button" onClick={handleEditSave} disabled={updateUser.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                {updateUser.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'blue' | 'emerald' | 'violet' | 'amber' }) {
  const accentMap = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-100',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  };

  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-sky-900/80 bg-[#0b1f35] shadow-2xl shadow-slate-950/60">
        <div className="flex items-center justify-between border-b border-sky-900/80 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800">
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
