import { useEffect, useState } from 'react';
import { getTickets, getTicket } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SEV = { Critical:'bg-red-100 text-red-700', High:'bg-orange-100 text-orange-700', Medium:'bg-yellow-100 text-yellow-700', Low:'bg-green-100 text-green-700' };
const STS = { Resolved:'bg-green-100 text-green-700', Closed:'bg-gray-100 text-gray-600', 'In Progress':'bg-blue-100 text-blue-700' };

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

  const domains = [...new Set(tickets.map(t => t.domain))].sort();

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    return (
      (!search   || t.title?.toLowerCase().includes(q) || t.ticket_id?.toLowerCase().includes(q)) &&
      (!domain   || t.domain   === domain)   &&
      (!severity || t.severity === severity) &&
      (!status   || t.status   === status)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">All Tickets</h1>
      <p className="text-sm text-gray-500 mb-5">{filtered.length} of {tickets.length} tickets</p>

      <div className="flex flex-wrap gap-3 mb-5">
        <input className="border border-gray-200 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Search ID or title..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm" value={domain} onChange={e => setDomain(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="">All Severities</option>
          {['Critical','High','Medium','Low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded-md px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Resolved','Closed','In Progress'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search||domain||severity||status) && (
          <button onClick={() => { setSearch(''); setDomain(''); setSeverity(''); setStatus(''); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline">Clear</button>
        )}
      </div>

      <div className="flex gap-5">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['ID','Title','Domain','Sev','Status','Category','Confidence','MTTR'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0,60).map(t => (
                <tr key={t.ticket_id} onClick={() => setSelected(t)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected?.ticket_id===t.ticket_id?'bg-blue-50':''}`}>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{t.ticket_id}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-48 truncate">{t.title}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-24 truncate">{t.domain?.split('/')[0].trim()}</td>
                  <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SEV[t.severity]||''}`}>{t.severity}</span></td>
                  <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded text-xs ${STS[t.status]||''}`}>{t.status}</span></td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{t.true_category}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{t.confidence_score ? `${Math.round(t.confidence_score*100)}%` : '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{t.resolution_time_minutes?`${t.resolution_time_minutes}m`:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 60 && <p className="text-xs text-gray-400 px-4 py-2 border-t">Showing 60 of {filtered.length}</p>}
        </div>

        {selected && (
          <div className="w-72 bg-white border border-gray-200 rounded-lg p-4 shrink-0 self-start sticky top-8 text-sm">
            <div className="flex justify-between mb-3">
              <span className="font-mono text-xs text-gray-400">{selected.ticket_id}</span>
              <button onClick={() => setSelected(null)} className="text-gray-400">✕</button>
            </div>
            <p className="font-semibold text-gray-900 mb-3">{selected.title}</p>
            {[['Domain',selected.domain],['Priority',selected.priority],['Severity',selected.severity],['Status',selected.status],['Environment',selected.environment],['True Cat.',selected.true_category],['Pred. Cat.',selected.predicted_category],['Confidence',selected.confidence_score?`${Math.round(selected.confidence_score*100)}%`:'—'],['MTTR',selected.resolution_time_minutes?`${selected.resolution_time_minutes}m`:'—'],['Runbook',selected.runbook_available?'Yes':'No']].map(([l,v]) => (
              <div key={l} className="flex gap-2 mb-1">
                <span className="text-gray-400 text-xs w-24 shrink-0">{l}</span>
                <span className="text-gray-700 text-xs">{v||'—'}</span>
              </div>
            ))}
            {selected.description && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-xs text-gray-700 leading-relaxed">{selected.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}