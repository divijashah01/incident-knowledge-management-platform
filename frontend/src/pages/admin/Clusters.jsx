import { useEffect, useState } from 'react';
import { getClusters } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Clusters() {
  const [clusters, setClusters] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getClusters()
      .then(r => setClusters(r.data.clusters || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading clusters..." />;

  const maxCount = clusters[0]?.ticket_count || 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Clusters</h1>
      <p className="text-sm text-gray-500 mb-6">
        {clusters.length} recurring incident patterns detected via K-Means clustering.
      </p>

      <div className="flex gap-5">
        {/* ── Cluster list ─────────────────────────────────────── */}
        <div className="flex-1 space-y-2">
          {clusters.map((c, i) => (
            <button key={c.cluster_id} onClick={() => setSelected(c)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selected?.cluster_id === c.cluster_id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                  <p className="font-medium text-sm text-gray-900 truncate max-w-sm">{c.label}</p>
                </div>
                <span className="text-sm font-semibold text-blue-600 shrink-0">{c.ticket_count} tickets</span>
              </div>
              <div className="flex items-center gap-3 ml-8">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${(c.ticket_count / maxCount) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 shrink-0">{c.algorithm}</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Detail panel ─────────────────────────────────────── */}
        {selected && (
          <div className="w-80 bg-white border border-gray-200 rounded-lg p-5 shrink-0 self-start sticky top-8">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Cluster {selected.cluster_id}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-700 font-medium mb-3">{selected.label}</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-blue-50 rounded p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{selected.ticket_count}</p>
                <p className="text-xs text-blue-400">tickets</p>
              </div>
              <div className="flex-1 bg-gray-50 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {Math.round((selected.ticket_count / clusters.reduce((s, c) => s + c.ticket_count, 0)) * 100)}%
                </p>
                <p className="text-xs text-gray-400">of corpus</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Sample Tickets</p>
              <div className="space-y-1">
                {(selected.sample_tickets || []).map((title, i) => (
                  <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                    {title}
                  </p>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Algorithm: {selected.algorithm}</p>
          </div>
        )}
      </div>
    </div>
  );
}