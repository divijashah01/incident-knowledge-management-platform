import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setError(''); 
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.role === 'admin') navigate('/dashboard');
      else if (user.role === 'engineer') navigate('/queue');
      else navigate('/submit');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-page)]">
      {/* Left — Branding Panel */}
      <div 
        className="hidden lg:flex flex-col justify-center px-16 flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)' }}
      >
        {/* Subtle background graphic */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div className="relative z-10 max-w-lg">
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: "'JetBrains Mono', monospace" }}>IK</span>
          </div>

          <h1 style={{ fontSize: 40, fontWeight: 700, color: '#ffffff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Incident Knowledge<br />Platform
          </h1>
          <p style={{ color: 'var(--brand-50)', fontSize: 16, lineHeight: 1.6, opacity: 0.9 }}>
            AI-powered incident intelligence. Classify, search, and resolve faster using your historical knowledge base.
          </p>

          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              'Auto-classify incoming tickets',
              'Semantic search across past incidents',
              'AI-generated runbooks & postmortems',
              'RAG chat assistant grounded in your data',
            ].map((text, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 24, height: 24, borderRadius: '50%', 
                  background: 'rgba(255,255,255,0.2)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <span style={{ color: '#fff', fontSize: 10 }}>✓</span>
                </div>
                <span style={{ color: '#ffffff', fontSize: 14, fontWeight: 500, opacity: 0.95 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md bg-white p-8 lg:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--border-light)]">
          
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--brand-900)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>IK</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Incident Knowledge</h1>
          </div>

          <div className="mb-8">
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
              Welcome back
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handle} className="flex flex-col gap-5">
            {error && (
              <div className="alert-error">
                <span style={{ fontWeight: 'bold' }}>!</span>
                <span>{error}</span>
              </div>
            )}

            <Field label="Username">
              <input
                className="input" 
                placeholder="Enter your username"
                value={username} 
                onChange={e => setUsername(e.target.value)}
                required 
                autoFocus
              />
            </Field>

            <Field label="Password">
              <input
                type="password" 
                className="input" 
                placeholder="••••••••"
                value={password} 
                onChange={e => setPassword(e.target.value)}
                required
              />
            </Field>

            <button type="submit" disabled={loading} className="btn-primary mt-2 justify-center py-2.5 text-base">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 24 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--brand-700)', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}