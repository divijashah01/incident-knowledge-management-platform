import { useEffect, useState } from 'react';
import { getTickets, getClusters, getRunbooks, getPostmortems } from '../services/api';
import StatCard from '../components/dashboard/StatCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function Dashboard() {
  const [tickets,    setTickets]    = useState([]);
  const [clusters,   setClusters]   = useState([]);
  const [runbooks,   setRunbooks]   = useState([]);
  const [postmortems,setPostmortems]= useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([getTickets(), getClusters(), getRunbooks(), getPostmortems()])
      .then(([t, c, r, p]) => {
        setTickets(t.data.tickets     || t.data.results || []);
        setClusters(c.data.clusters   || []);
        setRunbooks(r.data.runbooks   || []);
        setPostmortems(p.data.postmortems || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading analytics..." />;

  // ── Derived metrics ────────────────────────────────────────────
  const resolved  = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
  const avgMTTR   = resolved.length
    ? Math.round(resolved.reduce((s, t) => s + (t.resolution_time_minutes || 0), 0) / resolved.length)
    : 0;

  // Domain distribution
  const domainCounts = tickets.reduce((acc, t) => {
    const d = t.domain || 'Unknown';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const domainData = Object.entries(domainCounts)
    .map(([name, count]) => ({ name: name.split('/')[0].trim(), count }))
    .sort((a, b) => b.count - a.count);

  // Category distribution
  const catCounts = tickets.reduce((acc, t) => {
    const c = t.true_category || 'Unknown';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const catData = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

  // Severity distribution
  const sevCounts = tickets.reduce((acc, t) => {
    const s = t.severity || 'Unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const sevData = Object.entries(sevCounts).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Platform overview and incident analytics</p>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tickets"    value={tickets.length}     color="blue"   />
        <StatCard label="Avg MTTR"         value={`${avgMTTR}m`}      color="green"  sub="mean time to resolve" />
        <StatCard label="Clusters"         value={clusters.length}    color="purple" sub="recurring patterns" />
        <StatCard label="Runbooks"         value={runbooks.length}    color="yellow" sub="generated" />
        <StatCard label="Postmortems"      value={postmortems.length} color="red"    sub="Critical incidents" />
        <StatCard label="Resolved"         value={resolved.length}    color="green"  />
        <StatCard label="In Progress"      value={tickets.filter(t => t.status === 'In Progress').length} color="yellow" />
        <StatCard label="Runbook Coverage" value={`${Math.round((tickets.filter(t => t.runbook_available).length / tickets.length) * 100)}%`} color="blue" sub="tickets with runbook" />
      </div>

      {/* ── Charts row 1 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Tickets by Domain</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domainData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Category Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 2 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Severity Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sevData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Clusters by Size</h2>
          <div className="space-y-2">
            {clusters.slice(0, 6).map((c) => (
              <div key={c.cluster_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{c.label}</p>
                  <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(c.ticket_count / (clusters[0]?.ticket_count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{c.ticket_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}