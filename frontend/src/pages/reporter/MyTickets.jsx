import { useEffect, useState } from 'react';
import { getTickets } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_COLORS = {
  Resolved:      'bg-green-100 text-green-700',
  Closed:        'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
};
const SEV_COLORS = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
};

export default function MyTickets() {
  const { user }                = useAuth();
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    // In a real system this would filter by current user.
    // For now we show all tickets as a demo.
    getTickets()
      .then(r => setTickets(r.data.tickets || r.data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your tickets..." />;

  const resolved   = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Tickets</h1>
      <p className="text-sm text-gray-500 mb-6">Track the status of your submitted tickets.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
          <p className="text-xs text-blue-400 mt-1">In Progress</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{resolved}</p>
          <p className="text-xs text-green-400 mt-1">Resolved</p>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID','Title','Severity','Status','MTTR'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.slice(0, 30).map(t => (
                <tr key={t.ticket_id} onClick={() => setSelected(t)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected?.ticket_id === t.ticket_id ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.ticket_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLORS[t.severity] || ''}`}>{t.severity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] || ''}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.resolution_time_minutes ? `${t.resolution_time_minutes}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="w-72 bg-white border border-gray-200 rounded-lg p-4 shrink-0 self-start sticky top-8 text-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="font-mono text-xs text-gray-400">{selected.ticket_id}</span>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="font-semibold text-gray-900 mb-3">{selected.title}</p>
            <div className="flex gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${SEV_COLORS[selected.severity]}`}>{selected.severity}</span>
            </div>
            {selected.resolution_steps && selected.resolution_steps !== 'Pending investigation' && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Resolution</p>
                <p className="text-xs text-gray-700 leading-relaxed">{selected.resolution_steps}</p>
              </div>
            )}
            {selected.resolution_time_minutes && (
              <p className="text-xs text-gray-400 mt-3">Resolved in {selected.resolution_time_minutes} minutes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}