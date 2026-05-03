import { useEffect, useState } from 'react';
import { getTickets } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const SEVERITY_COLORS = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
};
const STATUS_COLORS = {
  Resolved:    'bg-green-100 text-green-700',
  Closed:      'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
};

export default function Tickets() {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [domain,   setDomain]   = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus]   = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getTickets()
      .then(r => setTickets(r.data.tickets || r.data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading tickets..." />;

  const domains    = [...new Set(tickets.map(t => t.domain))].sort();
  const severities = ['Critical', 'High', 'Medium', 'Low'];
  const statuses   = ['Resolved', 'Closed', 'In Progress'];

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    return (
      (!search   || t.title?.toLowerCase().includes(q) || t.ticket_id?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) &&
      (!domain   || t.domain   === domain)   &&
      (!severity || t.severity === severity) &&
      (!status   || t.status   === status)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Tickets</h1>
      <p className="text-sm text-gray-500 mb-6">{filtered.length} of {tickets.length} tickets</p>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          className="border border-gray-200 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Search by title, ID, description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none" value={domain} onChange={e => setDomain(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="">All Severities</option>
          {severities.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || domain || severity || status) && (
          <button onClick={() => { setSearch(''); setDomain(''); setSeverity(''); setStatus(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline">
            Clear filters
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Title', 'Domain', 'Severity', 'Status', 'Category', 'MTTR'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 50).map(t => (
                <tr key={t.ticket_id}
                  onClick={() => setSelected(t)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${selected?.ticket_id === t.ticket_id ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticket_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-32">{t.domain?.split('/')[0].trim()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[t.severity] || 'bg-gray-100 text-gray-600'}`}>{t.severity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.true_category}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{t.resolution_time_minutes ? `${t.resolution_time_minutes}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 50 && (
            <p className="text-xs text-gray-400 px-4 py-3 border-t border-gray-100">
              Showing first 50 of {filtered.length} results. Use filters to narrow down.
            </p>
          )}
        </div>

        {/* ── Detail panel ───────────────────────────────────────── */}
        {selected && (
          <div className="w-80 bg-white border border-gray-200 rounded-lg p-5 text-sm shrink-0 self-start sticky top-8">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-900">{selected.ticket_id}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="font-medium text-gray-800 mb-3">{selected.title}</p>
            {[
              ['Domain',      selected.domain],
              ['Priority',    selected.priority],
              ['Severity',    selected.severity],
              ['Status',      selected.status],
              ['Environment', selected.environment],
              ['True Cat.',   selected.true_category],
              ['Pred. Cat.',  selected.predicted_category],
              ['Confidence',  selected.confidence_score ? `${(selected.confidence_score * 100).toFixed(0)}%` : '—'],
              ['MTTR',        selected.resolution_time_minutes ? `${selected.resolution_time_minutes} min` : '—'],
            ].map(([label, val]) => (
              <div key={label} className="flex gap-2 mb-1">
                <span className="text-gray-400 w-24 shrink-0">{label}</span>
                <span className="text-gray-700">{val || '—'}</span>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Description</p>
              <p className="text-gray-700 text-xs leading-relaxed">{selected.description}</p>
            </div>
            <div className="mt-3">
              <p className="text-gray-400 text-xs mb-1">Resolution</p>
              <p className="text-gray-700 text-xs leading-relaxed">{selected.resolution_steps || '—'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}