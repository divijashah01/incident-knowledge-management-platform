import { useState, useEffect, useRef } from 'react';
import { classifyTicket, predictMTTR, getSimilarTickets, submitTicket } from '../../services/api';

const DOMAINS = [
  'Application / Backend Issues','Infrastructure / Cloud Issues',
  'Database Issues','Network / Connectivity Issues',
  'CI/CD & Deployment Issues','Authentication / Authorization Issues',
  'Monitoring / Alert Noise','Misc / Edge / New Issues',
];
const PRIORITIES   = ['P1','P2','P3'];
const SEVERITIES   = ['Critical','High','Medium','Low'];
const ENVIRONMENTS = ['Production','Staging'];

const CONFIDENCE_COLOR = (s) =>
  s >= 0.8 ? 'text-emerald-600' : s >= 0.6 ? 'text-amber-600' : 'text-red-500';

const SEV_COLORS = {
  Critical: 'priority-critical',
  High:     'priority-high',
  Medium:   'priority-medium',
  Low:      'priority-low',
};

export default function SubmitTicket() {
  const [form, setForm] = useState({
    title: '', description: '', symptoms: '', impact: '',
    domain: DOMAINS[0], priority: 'P2', severity: 'Medium', environment: 'Production',
  });
  const [classification, setClassification] = useState(null);
  const [mttr,           setMttr]           = useState(null);
  const [similar,        setSimilar]        = useState([]);
  const [submitted,      setSubmitted]      = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState('');
  const [expanded,       setExpanded]       = useState({});
  const debounceRef = useRef(null);

  const toggleExpand = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Live classification while user types
  useEffect(() => {
    const text = `${form.title} ${form.description} ${form.symptoms}`.trim();
    if (text.length < 20) { setClassification(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await classifyTicket({
          title: form.title, description: form.description,
          symptoms: form.symptoms, impact: form.impact,
          domain: form.domain, priority: form.priority,
          severity: form.severity, environment: form.environment,
        });
        setClassification(r.data);
      } catch { setClassification(null); }
    }, 700);
  }, [form.title, form.description, form.symptoms, form.impact, form.domain, form.priority, form.severity]);

  // MTTR prediction
  useEffect(() => {
    if (!form.domain || !form.severity || !form.priority) return;
    predictMTTR({
      title: form.title, description: form.description,
      symptoms: form.symptoms, domain: form.domain,
      priority: form.priority, severity: form.severity,
      environment: form.environment,
    }).then(r => setMttr(r.data)).catch(() => setMttr(null));
  }, [form.domain, form.severity, form.priority]);

  // Similar tickets
  useEffect(() => {
    const text = `${form.title} ${form.description}`.trim();
    if (text.length < 30) { setSimilar([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      getSimilarTickets(text, 3)
        .then(r => setSimilar(r.data.results || []))
        .catch(() => setSimilar([]));
    }, 1000);
  }, [form.title, form.description]);

  const f = (key) => ({
    value:    form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
  });

  const handle = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await submitTicket({
        ...form,
        predicted_category: classification?.predicted_category || null,
        confidence_score:   classification?.confidence_score   || null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({ title:'', description:'', symptoms:'', impact:'', domain: DOMAINS[0], priority:'P2', severity:'Medium', environment:'Production' });
    setClassification(null); setMttr(null); setSimilar([]); setExpanded({});
  };

  // ── Success state ──
  if (submitted) return (
    <div className="max-w-md mx-auto mt-24 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'var(--brand-50)' }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ticket Submitted</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>An engineer will pick this up shortly.</p>
      <button onClick={resetForm} className="btn-primary px-6 py-2.5">
        Submit Another
      </button>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Submit a Ticket</h1>
        <p className="page-subtitle">Describe your issue and the AI will help categorise and route it.</p>
      </div>

      <div className="flex gap-6">

        {/* ── Form ── */}
        <form onSubmit={handle} className="flex-1 space-y-5 min-w-0">
          {error && <div className="alert-error">{error}</div>}

          <div>
            <label className="label">Title *</label>
            <input
              {...f('title')}
              required
              className="input"
              placeholder="Brief summary of the issue"
            />
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              {...f('description')}
              required
              rows={4}
              className="textarea"
              placeholder="What is happening? When did it start?"
            />
          </div>

          <div>
            <label className="label">Symptoms</label>
            <textarea
              {...f('symptoms')}
              rows={2}
              className="textarea"
              placeholder="Error messages, logs, observable behaviour"
            />
          </div>

          <div>
            <label className="label">Impact</label>
            <input
              {...f('impact')}
              className="input"
              placeholder="Who is affected and how?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['domain',      'Domain',      DOMAINS],
              ['environment', 'Environment', ENVIRONMENTS],
              ['priority',    'Priority',    PRIORITIES],
              ['severity',    'Severity',    SEVERITIES],
            ].map(([k, l, opts]) => (
              <div key={k} className={k === 'domain' ? 'col-span-2' : ''}>
                <label className="label">{l}</label>
                <select {...f(k)} className="select">
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full justify-center py-2.5 text-base"
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>

        {/* ── AI Panel ── */}
        <div className="w-80 shrink-0 space-y-4">

          {/* Classification */}
          {classification && (
            <div className="card p-4">
              <p className="section-title">AI Classification</p>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {classification.predicted_category}
                </span>
                <span className={`text-sm font-bold ${CONFIDENCE_COLOR(classification.confidence_score)}`}>
                  {Math.round(classification.confidence_score * 100)}%
                </span>
              </div>

              {/* Probability bars */}
              {Object.entries(classification.all_probabilities).map(([cls, prob]) => (
                <div key={cls} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs w-24 truncate" style={{ color: 'var(--text-secondary)' }}>{cls}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${prob * 100}%`, background: 'var(--brand-700)' }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(prob * 100)}%
                  </span>
                </div>
              ))}

              {/* Top keywords */}
              {classification.top_keywords?.length > 0 && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                    Key signals
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {classification.top_keywords.map(kw => (
                      <span
                        key={kw.word}
                        className="text-xs px-2 py-0.5 rounded-md font-medium"
                        style={{ background: 'var(--brand-50)', color: 'var(--brand-900)' }}
                      >
                        {kw.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MTTR */}
          {mttr && (
            <div className="card p-4">
              <p className="section-title">Expected Resolution Time</p>
              <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {mttr.predicted_readable}
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{mttr.context}</p>
              {mttr.similar_mttr_range && (
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Similar tickets: {mttr.similar_mttr_range.min_readable} – {mttr.similar_mttr_range.max_readable}
                </p>
              )}
              <span className={`badge text-xs ${
                mttr.confidence === 'high'   ? 'badge-green' :
                mttr.confidence === 'medium' ? 'badge-yellow' : 'badge-gray'
              }`}>
                {mttr.confidence} confidence
              </span>
            </div>
          )}

          {/* ── Similar Past Incidents ── */}
          {similar.length > 0 && (
            <div className="card p-4">
              <p className="section-title">Similar Past Incidents</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Does any of these already solve your issue?
              </p>

              <div className="space-y-2">
                {similar.map(s => {
                  const isOpen = expanded[s.ticket_id];
                  return (
                    <div
                      key={s.ticket_id}
                      className="rounded-xl overflow-hidden border"
                      style={{ borderColor: 'var(--border-light)' }}
                    >
                      {/* Clickable header row */}
                      <button
                        className="w-full text-left px-3 py-2.5 transition-colors"
                        style={{ background: 'var(--bg-page)' }}
                        onClick={() => toggleExpand(s.ticket_id)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-50)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-page)'}
                      >
                        {/* Ticket ID + match score row */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(112,145,230,0.12)', color: 'var(--brand-700)' }}
                          >
                            #{s.ticket_id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {s.severity && (
                              <span className={`${SEV_COLORS[s.severity] || 'badge'} text-[10px]`}>
                                {s.severity}
                              </span>
                            )}
                            <span
                              className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(112,145,230,0.12)', color: 'var(--brand-700)' }}
                            >
                              {Math.round(s.similarity_score * 100)}%
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              {isOpen ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {s.title}
                        </p>
                      </button>

                      {/* Expandable full detail */}
                      {isOpen && (
                        <div
                          className="px-3 pb-3 pt-2 border-t space-y-2"
                          style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
                        >
                          {s.description && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                                Description
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {s.description}
                              </p>
                            </div>
                          )}
                          {s.resolution_steps && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                                Resolution
                              </p>
                              <div
                                className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-2"
                                style={{
                                  background: 'var(--brand-50)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border-light)',
                                }}
                              >
                                {s.resolution_steps}
                              </div>
                            </div>
                          )}
                          {(s.domain || s.environment) && (
                            <div className="flex gap-3 pt-1">
                              {s.domain && (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {s.domain}
                                </span>
                              )}
                              {s.environment && (
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {s.environment}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}