import { useEffect, useState, useCallback } from 'react';
import { getRunbooks, getPostmortems, approveRunbook, getRunbookDiff, getRunbookVersions } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

/* ── Lightweight markdown renderer ──────────────────────────────────────────
   Handles: # headings, **bold**, *italic*, `code`, ``` blocks,
            - / * bullet lists, numbered lists, > blockquotes, --- hr,
            and bare line breaks.
   No external deps needed.
─────────────────────────────────────────────────────────────────────────── */
function renderMarkdown(md = '') {
  if (!md) return null;

  const lines = md.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  const inlineRender = (text) => {
    // split on **bold**, *italic*, `code`
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((p, pi) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={pi} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>;
      if (p.startsWith('*') && p.endsWith('*'))
        return <em key={pi} className="italic">{p.slice(1, -1)}</em>;
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={pi} className="bg-gray-100 text-blue-700 px-1 py-0.5 rounded text-[11px] font-mono">{p.slice(1, -1)}</code>;
      return <span key={pi}>{p}</span>;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.replace(/```/, '').trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className="bg-gray-900 text-green-300 rounded-lg p-4 my-3 overflow-x-auto text-xs font-mono leading-relaxed">
          {lang && <div className="text-gray-500 text-[10px] mb-2 uppercase tracking-widest">{lang}</div>}
          {codeLines.join('\n')}
        </pre>
      );
      i++;
      continue;
    }

    // hr
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="my-4 border-gray-200" />);
      i++; continue;
    }

    // headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) {
      elements.push(
        <h2 key={key++} className="text-lg font-bold text-gray-900 mt-6 mb-2 pb-1 border-b border-gray-100">
          {inlineRender(h1[1])}
        </h2>
      );
      i++; continue;
    }
    if (h2) {
      elements.push(
        <h3 key={key++} className="text-base font-semibold text-gray-800 mt-5 mb-1.5 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-blue-400 inline-block shrink-0" />
          {inlineRender(h2[1])}
        </h3>
      );
      i++; continue;
    }
    if (h3) {
      elements.push(
        <h4 key={key++} className="text-sm font-semibold text-gray-700 mt-4 mb-1">
          {inlineRender(h3[1])}
        </h4>
      );
      i++; continue;
    }

    // blockquote
    if (line.startsWith('>')) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-blue-300 bg-blue-50 pl-4 pr-2 py-2 my-2 text-sm text-gray-600 italic rounded-r">
          {inlineRender(line.slice(1).trim())}
        </blockquote>
      );
      i++; continue;
    }

    // bullet list — collect consecutive items
    if (/^(\s*[-*])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*[-*])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-none my-2 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span>{inlineRender(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push({ n: num++, text: lines[i].replace(/^\d+\.\s+/, '') });
        i++;
      }
      elements.push(
        <ol key={key++} className="my-2 space-y-1">
          {items.map((it) => (
            <li key={it.n} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 font-mono text-[11px] text-blue-500 w-4 shrink-0 text-right">{it.n}.</span>
              <span>{inlineRender(it.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // blank line → small spacer
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      i++; continue;
    }

    // paragraph
    elements.push(
      <p key={key++} className="text-sm text-gray-700 leading-relaxed">
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return elements;
}

/* ── Section heading (matches Dashboard style) ───────────────────────────── */
function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-1 h-4 rounded-full bg-blue-500 inline-block shrink-0" />
      <h2 className="text-sm font-semibold text-gray-700 tracking-wide">{children}</h2>
    </div>
  );
}

/* ── Full-screen modal ───────────────────────────────────────────────────── */
function ViewerModal({ title, subtitle, badge, onClose, children }) {
  // close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 leading-snug">{title}</p>
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {badge}
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm transition-colors"
                aria-label="Close"
              >✕</button>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function KnowledgeAdmin() {
  const [tab,         setTab]         = useState('runbooks');
  const [runbooks,    setRunbooks]    = useState([]);
  const [postmortems, setPostmortems] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [diff,        setDiff]        = useState(null);
  const [versions,    setVersions]    = useState([]);
  const [approving,   setApproving]   = useState(null);
  const [msg,         setMsg]         = useState('');
  const [modalOpen,   setModalOpen]   = useState(false);

  useEffect(() => {
    Promise.all([getRunbooks(), getPostmortems()])
      .then(([r, p]) => {
        setRunbooks(r.data.runbooks || []);
        setPostmortems(p.data.postmortems || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectRunbook = async (rb) => {
    setSelected(rb); setDiff(null); setVersions([]);
    try {
      const v = await getRunbookVersions(rb.cluster_id);
      setVersions(v.data.versions || []);
      if ((v.data.versions || []).length >= 2) {
        const d = await getRunbookDiff(rb.cluster_id);
        setDiff(d.data);
      }
    } catch { setVersions([]); }
    setModalOpen(true);
  };

  const selectPostmortem = (pm) => {
    setSelected(pm);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelected(null);
    setDiff(null);
    setVersions([]);
  }, []);

  const handleApprove = async (rbId, e) => {
    e?.stopPropagation();
    setApproving(rbId);
    try {
      await approveRunbook(rbId);
      setRunbooks(prev => prev.map(r => r.runbook_id === rbId ? { ...r, approved: true } : r));
      if (selected?.runbook_id === rbId) setSelected(prev => ({ ...prev, approved: true }));
      setMsg('Runbook approved successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('Approval failed.'); }
    finally { setApproving(null); }
  };

  if (loading) return <LoadingSpinner message="Loading knowledge admin..." />;

  return (
    <div>
      {/* ── Page heading (matches Dashboard) ─────────────────────────────── */}
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
          Knowledge Admin
        </h1>
        <div
          className="mt-1 h-0.5 w-16 rounded-full"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}
        />
        <p className="text-sm text-gray-400 mt-2">Review, approve, and compare runbook versions. Manage postmortems.</p>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 shadow-sm">
          {msg}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {[['runbooks', `Runbooks (${runbooks.length})`], ['postmortems', `Postmortems (${postmortems.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); closeModal(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{label}
          </button>
        ))}
      </div>

      {/* ── Runbooks list ─────────────────────────────────────────────────── */}
      {tab === 'runbooks' && (
        <div className="space-y-2">
          {runbooks.map(rb => (
            <div key={rb.runbook_id} onClick={() => selectRunbook(rb)}
              className="p-4 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{rb.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Cluster {rb.cluster_id} · v{rb.version} · {rb.created_by}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {rb.approved
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Approved</span>
                    : <button onClick={(e) => handleApprove(rb.runbook_id, e)}
                        disabled={approving === rb.runbook_id}
                        className="text-xs bg-blue-600 text-white px-3 py-0.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {approving === rb.runbook_id ? 'Approving…' : 'Approve'}
                      </button>
                  }
                  <span className="text-xs text-blue-500 underline underline-offset-2 cursor-pointer">View →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Postmortems list ──────────────────────────────────────────────── */}
      {tab === 'postmortems' && (
        <div className="space-y-2">
          {postmortems.map(pm => (
            <div key={pm.postmortem_id} onClick={() => selectPostmortem(pm)}
              className="p-4 rounded-xl border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-colors shadow-sm">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm text-gray-900 truncate">{pm.ticket_title}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{pm.severity_snapshot}</span>
                  <span className="text-xs text-blue-500 underline underline-offset-2">View →</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {pm.ticket_id} · {pm.domain} · {new Date(pm.generated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Runbook viewer ─────────────────────────────────────────── */}
      {modalOpen && selected && tab === 'runbooks' && (
        <ViewerModal
          title={selected.title}
          subtitle={`Cluster ${selected.cluster_id} · v${selected.version} · ${selected.created_by}`}
          onClose={closeModal}
          badge={
            selected.approved
              ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Approved</span>
              : <button onClick={(e) => handleApprove(selected.runbook_id, e)}
                  disabled={approving === selected.runbook_id}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {approving === selected.runbook_id ? 'Approving…' : 'Approve'}
                </button>
          }
        >
          {/* Version history */}
          {versions.length > 1 && (
            <div className="mb-5">
              <SectionHeading>Version History</SectionHeading>
              <div className="flex gap-1.5 flex-wrap">
                {versions.map(v => (
                  <span key={v.version} className={`text-xs px-2.5 py-0.5 rounded-full ${
                    v.runbook_id === selected.runbook_id
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    v{v.version}{v.approved ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Diff */}
          {diff && (
            <div className="mb-5">
              <SectionHeading>
                Diff: v{diff.old_version} → v{diff.new_version}&nbsp;
                <span className="text-green-600 font-semibold">+{diff.lines_added}</span>
                <span className="ml-1 text-red-500 font-semibold">-{diff.lines_removed}</span>
              </SectionHeading>
              <div className="bg-gray-900 rounded-xl p-3 max-h-52 overflow-y-auto font-mono text-xs leading-relaxed">
                {(diff.structured_diff || []).slice(0, 60).map((line, i) => (
                  <div key={i} className={`px-1 rounded ${
                    line.type === 'added'   ? 'text-green-400 bg-green-900/30' :
                    line.type === 'removed' ? 'text-red-400 bg-red-900/30'    :
                    line.type === 'meta'    ? 'text-blue-400'                 :
                    'text-gray-400'
                  }`}>
                    {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rendered markdown content */}
          <SectionHeading>Content</SectionHeading>
          <div className="prose-sm max-w-none">
            {renderMarkdown(selected.content)}
          </div>
        </ViewerModal>
      )}

      {/* ── Modal: Postmortem viewer ──────────────────────────────────────── */}
      {modalOpen && selected && tab === 'postmortems' && selected.content && (
        <ViewerModal
          title={selected.ticket_title}
          subtitle={`${selected.ticket_id} · ${selected.domain} · ${new Date(selected.generated_at).toLocaleDateString()}`}
          onClose={closeModal}
          badge={
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">
              {selected.severity_snapshot}
            </span>
          }
        >
          <div className="prose-sm max-w-none">
            {renderMarkdown(selected.content)}
          </div>
        </ViewerModal>
      )}
    </div>
  );
}