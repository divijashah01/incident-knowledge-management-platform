import { useState, useRef, useEffect } from 'react';
import { sendChatQuery } from '../../services/api';

const STARTERS = [
  'How do I resolve a connection pool exhaustion issue?',
  'What are common causes of dashboard timeouts?',
  'How should I handle a TLS certificate expiry incident?',
  'What is the runbook for Kubernetes node failures?',
  'What postmortem actions were taken for Critical incidents?',
];

const QUALITY_STYLES = {
  good:     'text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded',
  moderate: 'text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded',
  low:      'text-[10px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded',
};

/* ── Bot avatar — matches the "IK" logo mark used in Login/loading ── */
function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: 'var(--brand-900)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, alignSelf: 'flex-end',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>IK</span>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex items-end gap-2.5 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <BotAvatar />}

      <div
        className={`max-w-[78%] lg:max-w-[70%] px-5 py-4 text-[13px] leading-relaxed ${
          isUser
            ? 'text-white rounded-[18px] rounded-br-[4px]'
            : 'border rounded-[18px] rounded-bl-[4px]'
        }`}
        style={
          isUser
            ? { background: 'var(--brand-700)' }
            : { background: 'var(--bg-card)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }
        }
      >
        <p className="whitespace-pre-wrap m-0">{msg.content}</p>

        {/* Sources */}
        {!isUser && msg.sources?.length > 0 && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider m-0" style={{ color: 'var(--text-muted)' }}>
                Sources
              </p>
              {msg.retrieval_quality && (
                <span className={QUALITY_STYLES[msg.retrieval_quality] ?? QUALITY_STYLES.moderate}>
                  {msg.retrieval_quality} match
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {msg.sources.map(s => (
                <div key={s.ticket_id} className="flex items-baseline gap-2">
                  <span
                    className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
                  >
                    #{s.ticket_id}
                  </span>
                  <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {s.title}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(s.similarity_score * 100)}% match
                  </span>
                </div>
              ))}
            </div>

            {/* Runbooks */}
            {msg.runbooks_used?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 m-0" style={{ color: 'var(--text-muted)' }}>
                  Runbooks Cited
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {msg.runbooks_used.map(r => (
                    <span
                      key={r.title}
                      className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-md"
                      style={{ background: 'var(--brand-50)', color: 'var(--brand-900)' }}
                    >
                      {r.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insufficient context warning */}
        {!isUser && msg.insufficient && (
          <div className="mt-3 pt-3 border-t flex items-center gap-1.5" style={{ borderColor: 'var(--border-light)' }}>
            <span className="text-amber-500">⚠</span>
            <p className="text-[11px] text-amber-600 font-medium m-0">
              Limited knowledge base matches found for this query.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-4">
      <BotAvatar />
      <div
        className="flex items-center gap-1.5 px-5 py-4 rounded-[18px] rounded-bl-[4px] border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
      >
        {[0, 150, 300].map(d => (
          <div
            key={d}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: 'var(--brand-300)', animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [topK,     setTopK]     = useState(5);
  const bottomRef  = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const query = (text || input).trim();
    if (!query || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setLoading(true);
    try {
      const r = await sendChatQuery(query, topK);
      const isInsufficient = r.data.answer?.startsWith('INSUFFICIENT_CONTEXT:');
      setMessages(prev => [...prev, {
        role:              'assistant',
        content:           isInsufficient
          ? r.data.answer.replace('INSUFFICIENT_CONTEXT:', '').trim()
          : r.data.answer,
        sources:           r.data.sources,
        runbooks_used:     r.data.runbooks_used,
        retrieval_quality: r.data.retrieval_quality,
        insufficient:      isInsufficient,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Something went wrong. Make sure the backend is running and GEMINI_API_KEY is set.',
        sources: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto" style={{ height: 'calc(100vh - 6rem)' }}>

      {/* Page header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">Chat Assistant</h1>
        <p className="page-subtitle">Ask questions grounded in your historical incident knowledge base.</p>
      </div>

      {/* Chat container */}
      <div
        className="flex-1 flex flex-col rounded-2xl overflow-hidden shadow-sm"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >

        {/* ── Message area ── */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--bg-page)' }}
        >
          {messages.length === 0 ? (

            /* Empty / starter state */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                How can I help you resolve today?
              </h2>
              <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                I can search past incidents, suggest runbooks, or summarize postmortems.
                Pick a starter below or ask your own question.
              </p>

              <div className="flex flex-col gap-2.5 w-full">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all duration-150 group"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--brand-300)';
                      e.currentTarget.style.background  = 'var(--brand-50)';
                      e.currentTarget.style.color       = 'var(--brand-900)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.background  = 'var(--bg-card)';
                      e.currentTarget.style.color       = 'var(--text-secondary)';
                    }}
                  >
                    <span className="flex-1">{s}</span>
                    <span style={{ color: 'var(--brand-700)', fontSize: 14, opacity: 0.6 }}>↗</span>
                  </button>
                ))}
              </div>
            </div>

          ) : (
            <>
              {messages.map((m, i) => <Message key={i} msg={m} />)}
              {loading && <TypingIndicator />}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* ── Input area ── */}
        <div
          className="shrink-0 p-4"
          style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)' }}
        >
          {/* Textarea + controls */}
          <div
            className="flex items-end gap-3 rounded-xl p-2 transition-all duration-150"
            style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)' }}
            onFocusCapture={e => {
              e.currentTarget.style.borderColor = 'var(--brand-700)';
              e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(112,145,230,0.12)';
            }}
            onBlurCapture={e => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
          >
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none bg-transparent text-[13px] px-3 py-2 focus:outline-none placeholder-slate-400 max-h-32"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Ask about an incident, error, or resolution…"
              value={input}
              rows={1}
              onChange={handleTextareaChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />

            <div className="flex items-center gap-2 shrink-0 pb-1 pr-1">
              <select
                className="text-xs font-semibold bg-transparent border-none focus:outline-none cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                value={topK}
                onChange={e => setTopK(Number(e.target.value))}
                title="Number of sources to retrieve"
              >
                {[3, 5, 8].map(k => <option key={k} value={k}>Top {k}</option>)}
              </select>

              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="btn-primary rounded-lg px-4 py-1.5 text-sm"
              >
                Send
              </button>
            </div>
          </div>

          {/* Footer hints */}
          <div className="flex justify-between items-center mt-2 px-1">
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              AI can make mistakes — verify critical actions against active runbooks.
            </p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              <kbd
                className="font-sans px-1 py-0.5 rounded mr-1"
                style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}
              >
                Enter
              </kbd>
              to send
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}