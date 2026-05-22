import { useEffect, useState } from 'react';
import { getRunbooks, getPostmortems } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Knowledge() {
  const [tab,         setTab]         = useState('runbooks');
  const [runbooks,    setRunbooks]    = useState([]);
  const [postmortems, setPostmortems] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [openRb,      setOpenRb]      = useState(null);
  const [openPm,      setOpenPm]      = useState(null);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    Promise.all([getRunbooks(), getPostmortems()])
      .then(([r, p]) => {
        setRunbooks(r.data.runbooks     || []);
        setPostmortems(p.data.postmortems || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading knowledge base..." />;

  const filteredRb = runbooks.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()));
  const filteredPm = postmortems.filter(p =>
    p.ticket_title.toLowerCase().includes(search.toLowerCase()) ||
    p.ticket_id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Knowledge Base</h1>
      <p className="text-sm text-gray-500 mb-5">AI-generated runbooks and postmortems from historical incidents.</p>

      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[['runbooks',`Runbooks (${runbooks.length})`],['postmortems',`Postmortems (${postmortems.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSearch(''); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <input className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Runbooks */}
      {tab === 'runbooks' && (
        <div className="flex gap-5">
          <div className="flex-1 space-y-2">
            {filteredRb.length === 0
              ? <p className="text-sm text-gray-400">No runbooks found.</p>
              : filteredRb.map(rb => (
                <button key={rb.runbook_id} onClick={() => setOpenRb(rb)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    openRb?.runbook_id === rb.runbook_id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm text-gray-900">{rb.title}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-gray-400">v{rb.version}</span>
                      {rb.approved && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Approved</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Cluster {rb.cluster_id} · by {rb.created_by}</p>
                </button>
              ))
            }
          </div>
          {openRb && (
            <div className="w-96 bg-white border border-gray-200 rounded-lg p-5 shrink-0 self-start sticky top-8 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{openRb.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">v{openRb.version} · Cluster {openRb.cluster_id}</p>
                </div>
                <button onClick={() => setOpenRb(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-3 rounded">
                {openRb.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Postmortems */}
      {tab === 'postmortems' && (
        <div className="flex gap-5">
          <div className="flex-1 space-y-2">
            {filteredPm.length === 0
              ? <p className="text-sm text-gray-400">No postmortems found.</p>
              : filteredPm.map(pm => (
                <button key={pm.postmortem_id} onClick={() => setOpenPm(pm)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    openPm?.postmortem_id === pm.postmortem_id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm text-gray-900 truncate">{pm.ticket_title}</p>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded ml-2 shrink-0">
                      {pm.severity_snapshot}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pm.ticket_id} · {pm.domain} · {new Date(pm.generated_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            }
          </div>
          {openPm && (
            <div className="w-96 bg-white border border-gray-200 rounded-lg p-5 shrink-0 self-start sticky top-8 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{openPm.ticket_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{openPm.ticket_id} · {openPm.severity_snapshot}</p>
                </div>
                <button onClick={() => setOpenPm(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-3 rounded">
                {openPm.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}