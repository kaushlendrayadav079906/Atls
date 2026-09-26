import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  getAdminBranches,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
} from '../../services/api';
import type { Branch, AdminUser } from '../../types';

// ── Create User Modal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  branch: Branch;
  existingUsers: AdminUser[];
  onClose: () => void;
}

function CreateUserModal({ branch, onClose }: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    role: 'user' as 'user' | 'admin',
  });
  const [error, setError] = useState('');

  const { mutate: create, isPending } = useMutation({
    mutationFn: () =>
      createAdminUser({
        ...form,
        branch_id: branch.id,
        store_name: branch.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(`User "${form.username}" created for ${branch.name}`);
      onClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error?.response?.data?.detail ?? 'Failed to create user.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    create();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Create User</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Branch: <span className="font-medium text-emerald-700">{branch.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="john_doe"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              required
              type="password"
              minLength={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'user' | 'admin' }))}
            >
              <option value="user">Cashier (user)</option>
              {/* <option value="admin">Admin</option> */}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit User Branch Modal ───────────────────────────────────────────────────

interface EditUserModalProps {
  user: AdminUser;
  onClose: () => void;
}

function EditUserModal({ user, onClose }: EditUserModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload: {
        name?: string;
        username?: string;
        current_password?: string;
        new_password?: string;
      } = {
        name: name.trim() || undefined,
        username: username.trim() || undefined,
      };

      if (newPassword || confirmPassword || currentPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      return updateAdminUser(user.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
      onClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } } };
      const message = error?.response?.data?.detail ?? 'Failed to update user';
      setError(message);
      toast.error(message);
    },
  });

  const handleSave = () => {
    setError('');

    if (!name.trim() || !username.trim()) {
      setError('Name and username are required.');
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('Current, new, and confirm password are required.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
    }

    mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Edit {user.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="john_doe"
              autoComplete="off"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-2">Change Password (optional)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  minLength={6}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  minLength={6}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Branches Page ───────────────────────────────────────────────────────

const Branches = () => {
  const queryClient = useQueryClient();
  const [createModal, setCreateModal] = useState<Branch | null>(null);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['admin-branches'],
    queryFn: getAdminBranches,
    staleTime: 5 * 60_000,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
    staleTime: 60_000,
  });

  const { mutate: deactivate } = useMutation({
    mutationFn: deactivateAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deactivated');
    },
    onError: () => toast.error('Failed to deactivate user'),
  });

  const getUsersForBranch = (branchId: string) =>
    users.filter((u) => u.branch_id === branchId);

  const unassignedUsers = users.filter((u) => !u.branch_id);

  const isLoading = loadingBranches || loadingUsers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <p className="text-gray-500 text-sm">Manage SAP warehouses and assign users per branch</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Branch Cards */}
      {!isLoading && (
        <div className="space-y-4">
          {branches.map((branch) => {
            const branchUsers = getUsersForBranch(branch.id);
            return (
              <div key={branch.id} className="admin-card overflow-hidden">
                {/* Branch Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{branch.name}</p>
                      <p className="text-xs text-gray-400">
                        Code: <span className="font-mono">{branch.id}</span>
                        {branch.location ? ` · ${branch.location}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCreateModal(branch)}
                    className="admin-btn-primary"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                  </button>
                </div>

                {/* Users Table */}
                {branchUsers.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-gray-400 text-center">
                    No users assigned to this branch yet
                  </div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead className="bg-gray-50">
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {branchUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="font-medium text-gray-800">{u.name}</td>
                            <td className="text-gray-500 font-mono">{u.username}</td>
                            <td className="text-gray-500">{u.email}</td>
                            <td>
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  u.role === 'admin'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  u.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-600'
                                }`}
                              >
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditModal(u)}
                                  className="text-pink-500 hover:text-pink-700 text-xs font-semibold"
                                >
                                  Edit
                                </button>
                                {u.is_active && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Deactivate "${u.name}"?`)) deactivate(u.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                                  >
                                    Deactivate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned users */}
          {unassignedUsers.length > 0 && (
            <div className="admin-card border-yellow-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-yellow-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="font-semibold text-gray-700">Unassigned Users</p>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      {/* <th className="text-right">Actions</th> */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unassignedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="font-medium text-gray-800">{u.name}</td>
                        <td className="text-gray-500 font-mono">{u.username}</td>
                        <td>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {u.role}
                          </span>
                        </td>
                        {/* <td>
                          <button
                            onClick={() => setEditModal(u)}
                            className="text-pink-500 hover:text-pink-700 text-xs font-semibold"
                          >
                            Assign Branch
                          </button>
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {createModal && (
        <CreateUserModal
          branch={createModal}
          existingUsers={users}
          onClose={() => setCreateModal(null)}
        />
      )}
      {editModal && (
        <EditUserModal
          user={editModal}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
};

export default Branches;
