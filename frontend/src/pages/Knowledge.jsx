import { useEffect, useState } from 'react';
import { getRunbooks, getPostmortems } from '../services/api';
import RunbookCard from '../components/knowledge/RunbookCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function Knowledge() {
  const [tab,         setTab]         = useState('runbooks');
  const [runbooks,    setRunbooks]    = useState([]);
  const [postmortems, setPostmortems] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [pmSelected,  setPmSelected]  = useState(null);

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Knowledge Base</h1>
      <p className="text-sm text-gray-500 mb-6">
        LLM-generated runbooks and postmortems from historical incident patterns.
      </p>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {[
          { id: 'runbooks',    label: `Runbooks (${runbooks.length})` },
          { id: 'postmortems', label: `Postmortems (${postmortems.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Runbooks tab ─────────────────────────────────────────── */}
      {tab === 'runbooks' && (
        <div className="space-y-3">
          {runbooks.length === 0
            ? <p className="text-sm text-gray-400">No runbooks generated yet. Run generate_runbooks.</p>
            : runbooks.map(rb => <RunbookCard key={rb.runbook_id} runbook={rb} />)
          }
        </div>
      )}

      {/* ── Postmortems tab ──────────────────────────────────────── */}
      {tab === 'postmortems' && (
        <div className="flex gap-5">
          <div className="flex-1 space-y-2">
            {postmortems.length === 0
              ? <p className="text-sm text-gray-400">No postmortems generated yet. Run generate_postmortems.</p>
              : postmortems.map(pm => (
                <button key={pm.postmortem_id} onClick={() => setPmSelected(pm)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    pmSelected?.postmortem_id === pm.postmortem_id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900 truncate">{pm.ticket_title}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 ml-2 shrink-0">
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

          {pmSelected && (
            <div className="w-96 bg-white border border-gray-200 rounded-lg p-5 shrink-0 self-start sticky top-8 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{pmSelected.ticket_id}</p>
                  <p className="text-xs text-gray-500">{pmSelected.ticket_title}</p>
                </div>
                <button onClick={() => setPmSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                {pmSelected.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}