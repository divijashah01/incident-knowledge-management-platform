import { useState, useRef, useEffect } from 'react';
import { sendChatQuery } from '../services/api';
import ChatMessage from '../components/chat/ChatMessage';

const STARTERS = [
  'How do I resolve a connection pool exhaustion issue?',
  'What are common causes of dashboard timeouts?',
  'How should I handle a TLS certificate expiry incident?',
  'What is the runbook for Kubernetes node failures?',
  'What postmortem actions were taken for Critical incidents?',
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [topK,     setTopK]     = useState(5);
  const bottomRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const query = text || input.trim();
    if (!query || loading) return;

    const userMsg = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const r = await sendChatQuery(query, topK);
      const assistantMsg = {
        role:    'assistant',
        content: r.data.answer,
        sources: r.data.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Sorry, I encountered an error. Make sure the backend server is running and your GEMINI_API_KEY is set.',
        sources: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat Assistant</h1>
        <p className="text-sm text-gray-500">
          Ask questions about historical incidents. Answers are grounded in your knowledge base.
        </p>
      </div>

      {/* ── Chat window ──────────────────────────────────────────── */}
      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg overflow-y-auto p-5 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <p className="text-gray-400 text-sm mb-4">Start a conversation or try one of these:</p>
            <div className="flex flex-col gap-2 w-full max-w-lg">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-sm text-left px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white border border-gray-200 rounded-xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex gap-3 items-end">
          <textarea
            className="flex-1 resize-none text-sm px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-10 max-h-32"
            placeholder="Ask about an incident, error, or resolution..."
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <select className="text-xs border border-gray-200 rounded px-2 py-2" value={topK} onChange={e => setTopK(Number(e.target.value))}>
              {[3, 5, 8].map(k => <option key={k} value={k}>Top {k}</option>)}
            </select>
            <button onClick={() => send()}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Send
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}