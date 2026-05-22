import { useEffect, useState } from 'react';
import { getTickets, getSimilarTickets, classifyTicket } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SEV_COLORS = { Critical:'bg-red-100 text-red-700', High:'bg-orange-100 text-orange-700', Medium:'bg-yellow-100 text-yellow-700', Low:'bg-green-100 text-green-700' };
const PRI_COLORS = { P1:'bg-red-600 text-white', P2:'bg-orange-500 text-white', P3:'bg-gray-200 text-gray-600' };

export default function Queue() {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [similar,  setSimilar]  = useState([]);
  const [simLoad,  setSimLoad]  = useState(false);
  const [filter,   setFilter]   = useState('In Progress');

  useEffect(() => {
    getTickets()
      .then(r => setTickets(r.data.tickets || r.data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectTicket = async (ticket) => {
    setSelected(ticket);
    setSimilar([]);
    setSimLoad(true);
    try {
      const r = await getSimilarTickets(
        `${ticket.title} ${ticket.description || ''}`, 4);
      setSimilar(r.data.results?.filter(s => s.ticket_id !== ticket.ticket_id) || []);
    } catch { setSimilar([]); }
    finally { setSimLoad(false); }
  };

  if (loading) return <LoadingSpinner message="Loading ticket queue..." />;

  const filtered = filter === 'all'
    ? tickets
    : tickets.filter(t => t.status === filter);

  const counts = {
    'In Progress': tickets.filter(t => t.status === 'In Progress').length,
    'Resolved':    tickets.filter(t => t.status === 'Resolved').length,
    'Closed':      tickets.filter(t => t.status === 'Closed').length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ticket Queue</h1>
      <p className="text-sm text-gray-500 mb-5">Review and resolve incoming incident tickets.</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {[['In Progress', counts['In Progress']], ['Resolved', counts['Resolved']], ['Closed', counts['Closed']], ['all', tickets.length]].map(([s, c]) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {s === 'all' ? 'All' : s} <span className="ml-1 opacity-70">({c})</span>
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Ticket list */}
        <div className="flex-1 space-y-2">
          {filtered.slice(0, 40).map(t => (
            <div key={t.ticket_id} onClick={() => selectTicket(t)}
              className={`bg-white border rounded-lg p-4 cursor-pointer transition-colors ${
                selected?.ticket_id === t.ticket_id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${PRI_COLORS[t.priority]}`}>{t.priority}</span>
                    <span className="font-mono text-xs text-gray-400">{t.ticket_id}</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.domain}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLORS[t.severity] || ''}`}>{t.severity}</span>
                  <span className="text-xs text-gray-400">{t.environment}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No tickets in this category.</p>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-96 bg-white border border-gray-200 rounded-lg p-5 shrink-0 self-start sticky top-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="font-mono text-xs text-gray-400">{selected.ticket_id}</span>
                <div className="flex gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLORS[selected.severity] || ''}`}>{selected.severity}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${PRI_COLORS[selected.priority]}`}>{selected.priority}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <h3 className="font-semibold text-gray-900 mb-4">{selected.title}</h3>

            {[['Description', selected.description], ['Symptoms', selected.symptoms], ['Impact', selected.impact]].map(([l, v]) => v && (
              <div key={l} className="mb-3">
                <p className="text-xs text-gray-400 mb-1">{l}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{v}</p>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              {[['Domain', selected.domain], ['Env', selected.environment], ['True Cat.', selected.true_category], ['Pred. Cat.', selected.predicted_category]].map(([l, v]) => v && (
                <div key={l}>
                  <span className="text-gray-400">{l}: </span>
                  <span className="text-gray-700 font-medium">{v}</span>
                </div>
              ))}
            </div>

            {/* Similar tickets */}
            {simLoad && <p className="text-xs text-gray-400 mb-3">Finding similar incidents...</p>}
            {similar.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Similar Past Incidents</p>
                {similar.slice(0, 3).map(s => (
                  <div key={s.ticket_id} className="mb-3 bg-gray-50 rounded p-2.5">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-gray-800">{s.ticket_id} — {s.title}</span>
                      <span className="text-xs text-blue-600 shrink-0 ml-1">{Math.round(s.similarity_score * 100)}%</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.resolution_steps?.slice(0, 120)}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}