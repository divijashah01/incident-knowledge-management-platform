import { useEffect, useState } from 'react';
import { getTickets, getClusters, getRunbooks, getPostmortems, getKnowledgeGaps } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

/* ── colour map for stat cards ─────────────────────────────────────────── */
const CARD_STYLES = {
  blue:   { wrap: 'bg-blue-50   border-blue-200',   label: 'text-blue-400',   value: 'text-blue-800',   bar: 'bg-blue-400'   },
  green:  { wrap: 'bg-green-50  border-green-200',  label: 'text-green-400',  value: 'text-green-800',  bar: 'bg-green-400'  },
  yellow: { wrap: 'bg-yellow-50 border-yellow-200', label: 'text-yellow-500', value: 'text-yellow-800', bar: 'bg-yellow-400' },
  red:    { wrap: 'bg-red-50    border-red-200',     label: 'text-red-400',    value: 'text-red-800',    bar: 'bg-red-400'    },
  purple: { wrap: 'bg-purple-50 border-purple-200', label: 'text-purple-400', value: 'text-purple-800', bar: 'bg-purple-400' },
};

function StatCard({ label, value, sub, color = 'blue' }) {
  const s = CARD_STYLES[color] || CARD_STYLES.blue;
  return (
    <div className={`relative rounded-xl border ${s.wrap} p-4 shadow-sm overflow-hidden`}>
      {/* accent left bar */}
      <span className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${s.bar}`} />
      <p className={`text-[10px] font-bold uppercase tracking-widest ${s.label} pl-2`}>{label}</p>
      <p className={`text-3xl font-extrabold mt-1 pl-2 ${s.value}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 pl-2 opacity-50 ${s.value}`}>{sub}</p>}
    </div>
  );
}

/* ── small section-header with accent bar ───────────────────────────────── */
function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-1 h-4 rounded-full bg-blue-500 inline-block shrink-0" />
      <h2 className="text-sm font-semibold text-gray-700 tracking-wide">{children}</h2>
    </div>
  );
}

export default function Dashboard() {
  const [tickets,     setTickets]     = useState([]);
  const [clusters,    setClusters]    = useState([]);
  const [runbooks,    setRunbooks]    = useState([]);
  const [postmortems, setPostmortems] = useState([]);
  const [gaps,        setGaps]        = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([getTickets(), getClusters(), getRunbooks(), getPostmortems(), getKnowledgeGaps()])
      .then(([t, c, r, p, g]) => {
        setTickets(t.data.tickets         || t.data.results || []);
        setClusters(c.data.clusters       || []);
        setRunbooks(r.data.runbooks       || []);
        setPostmortems(p.data.postmortems || []);
        setGaps(g.data.knowledge_gaps     || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const resolved   = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status));
  const closedOnly = tickets.filter(t => t.status === 'Closed');

  const domainData = Object.entries(
    tickets.reduce((acc, t) => {
      const d = t.domain?.split('/')[0].trim() || 'Unknown';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {}))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const catData = Object.entries(
    tickets.reduce((acc, t) => {
      const c = t.true_category || 'Unknown';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {}))
    .map(([name, value]) => ({ name, value }));

  const sevData = Object.entries(
    tickets.reduce((acc, t) => {
      acc[t.severity] = (acc[t.severity] || 0) + 1;
      return acc;
    }, {}))
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1
          className="text-2xl font-extrabold tracking-tight"
          style={{
            background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Dashboard
        </h1>
        {/* thin accent underline */}
        <div
          className="mt-1 h-0.5 w-16 rounded-full"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}
        />
        <p className="text-sm text-gray-400 mt-2">Full platform analytics and health overview.</p>
      </div>

      {/* ── Knowledge gap alert ───────────────────────────────────────────── */}
      {gaps.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm">
              {gaps.length} Knowledge Gap{gaps.length > 1 ? 's' : ''} Detected
            </p>
            <p className="text-xs text-yellow-600 mt-0.5">
              {gaps.map(g => g.label).join(', ')} — these clusters have no runbook. Go to Clusters to address them.
            </p>
          </div>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tickets"  value={tickets.length}      color="blue" />
        <StatCard label="Clusters"       value={clusters.length}     color="purple" />
        <StatCard label="Knowledge Gaps" value={gaps.length}         color={gaps.length > 0 ? 'yellow' : 'green'} sub="clusters without runbook" />
        <StatCard label="Runbooks"       value={runbooks.length}     color="blue" sub={`${runbooks.filter(r => r.approved).length} approved`} />
        <StatCard label="Postmortems"    value={postmortems.length}  color="red" />
        <StatCard label="Resolved"       value={resolved.length}     color="green" />
        <StatCard label="Closed"         value={closedOnly.length}   color="green" sub="fully closed tickets" />
        <StatCard label="In Progress"    value={tickets.filter(t => t.status === 'In Progress').length} color="yellow" />
      </div>

      {/* ── Charts row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionHeading>Tickets by Domain</SectionHeading>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domainData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionHeading>Category Distribution</SectionHeading>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionHeading>Severity Distribution</SectionHeading>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sevData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionHeading>Top Clusters</SectionHeading>
          <div className="space-y-2">
            {clusters.slice(0, 6).map(c => (
              <div key={c.cluster_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-700 truncate max-w-48">{c.label}</span>
                    {c.knowledge_gap && (
                      <span className="text-yellow-600 text-xs shrink-0 ml-1">⚠ gap</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${(c.ticket_count / (clusters[0]?.ticket_count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-6 text-right">{c.ticket_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}