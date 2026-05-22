import { useEffect, useState } from 'react';
import { getUsers, createUser, updateRole } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ROLE_COLORS = {
  admin:    'bg-purple-100 text-purple-700',
  engineer: 'bg-blue-100 text-blue-700',
  reporter: 'bg-green-100 text-green-700',
};

export default function Users() {
  const { user: me }            = useAuth();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ username:'', password:'', email:'', role:'engineer' });
  const [creating, setCreating] = useState(false);
  const [msg,      setMsg]      = useState('');
  const [error,    setError]    = useState('');

  const load = () => {
    setLoading(true);
    getUsers()
      .then(r => setUsers(r.data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      await createUser(form);
      setMsg(`User '${form.username}' created.`);
      setForm({ username:'', password:'', email:'', role:'engineer' });
      setShowForm(false);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateRole(userId, newRole);
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
      setMsg('Role updated.');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      setMsg('Failed to update role.');
    }
  };

  if (loading) return <LoadingSpinner message="Loading users..." />;

  const counts = {
    admin:    users.filter(u => u.role === 'admin').length,
    engineer: users.filter(u => u.role === 'engineer').length,
    reporter: users.filter(u => u.role === 'reporter').length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Users</h1>
      <p className="text-sm text-gray-500 mb-6">Manage platform users and their roles.</p>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[['Admins', counts.admin, 'purple'], ['Engineers', counts.engineer, 'blue'], ['Reporters', counts.reporter, 'green']].map(([label, count, color]) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4 text-center`}>
            <p className={`text-2xl font-bold text-${color}-700`}>{count}</p>
            <p className={`text-xs text-${color}-400 mt-1`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Create user button */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} total users</p>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
          {showForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-5 mb-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Create New User</h3>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Username *</label>
              <input required className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
              <input type="password" required className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none"
                value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="reporter">Reporter</option>
                <option value="engineer">Engineer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {creating ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Username', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {u.username[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{u.username}</span>
                    {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{u.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {u.id !== me?.id ? (
                    <select
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}>
                      <option value="reporter">Reporter</option>
                      <option value="engineer">Engineer</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="text-xs text-gray-400">Cannot edit own role</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}