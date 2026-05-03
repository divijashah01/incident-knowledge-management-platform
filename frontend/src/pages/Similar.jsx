import { useState } from 'react';
import { getSimilarTickets } from '../services/api';

const SEVERITY_COLORS = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
};

export default function Similar() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [topK,    setTopK]    = useState(5);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await getSimilarTickets(query, topK);
      setResults(r.data.results || []);
    } catch (e) {
      setError('Search failed. Make sure the backend is running and embeddings are generated.');
    } finally {
      setLoading(false);
    }
  };

  const EXAMPLES = [
    'Dashboard is timing out for all users',
    'Cannot connect to the database, connection pool exhausted',
    'Deployment pipeline is stuck and not completing',
    'Users are getting logged out unexpectedly',
    'TLS certificate error on main domain',
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Similar Incidents</h1>
      <p className="text-sm text-gray-500 mb-6">
        Describe your current incident and find the most semantically similar historical tickets.
      </p>

      {/* ── Search input ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe the incident
        </label>
        <textarea
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="e.g. Users are getting 504 gateway timeout errors on the dashboard..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.metaKey && search()}
        />
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Results:</label>
            <select
              className="border border-gray-200 rounded px-2 py-1 text-sm"
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}>
              {[3, 5, 8, 10].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* ── Example queries ──────────────────────────────────────── */}
      {results.length === 0 && !loading && (
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setQuery(ex)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* ── Results ──────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{results.length} similar incidents found</p>
          {results.map((r, i) => (
            <div key={r.ticket_id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <span className="font-mono text-xs text-gray-400">{r.ticket_id}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[r.severity] || 'bg-gray-100 text-gray-600'}`}>
                    {r.severity}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-16 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.similarity_score * 100}%` }} />
                  </div>
                  <span className="text-xs text-blue-600 font-medium">
                    {Math.round(r.similarity_score * 100)}%
                  </span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{r.title}</h3>
              <p className="text-xs text-gray-400 mb-3">{r.domain}</p>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Resolution Steps</p>
                <p className="text-sm text-gray-700 leading-relaxed">{r.resolution_steps}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}