import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', email: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(''); 
    setLoading(true);
    try {
      await registerUser(form);
      await login(form.username, form.password);
      navigate('/submit');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try a different username.');
    } finally {
      setLoading(false);
    }
  };

  const f = (key) => ({
    value: form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="min-h-screen flex bg-[var(--bg-page)]">
      
      {/* Left — Register Form */}
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
              Create an account
            </h2>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--brand-50)', border: '1px solid var(--border-light)',
              borderRadius: 20, padding: '4px 12px', marginTop: 4
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-700)', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--brand-900)', fontWeight: 600 }}>Registers as Reporter</span>
            </div>
          </div>

          <form onSubmit={handle} className="flex flex-col gap-5">
            {error && (
              <div className="alert-error">
                <span style={{ fontWeight: 'bold' }}>!</span>
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Full Name" hint="optional">
                <input className="input" placeholder="Jane Doe" {...f('full_name')} />
              </Field>
              <Field label="Username" hint="required">
                <input className="input" placeholder="jane_doe" required {...f('username')} />
              </Field>
            </div>

            <Field label="Email" hint="optional">
              <input type="email" className="input" placeholder="jane@company.com" {...f('email')} />
            </Field>

            <Field label="Password" hint="min 8 chars">
              <input type="password" className="input" placeholder="••••••••" required {...f('password')} />
            </Field>

            <button type="submit" disabled={loading} className="btn-primary mt-2 justify-center py-2.5 text-base">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand-700)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right — Branding Panel */}
      <div 
        className="hidden lg:flex flex-col justify-center px-16 flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-900) 100%)' }}
      >
        {/* Subtle background graphic */}
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div className="relative z-10 max-w-lg" style={{ marginLeft: 'auto' }}>
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
            Join the Intelligence<br />Network
          </h1>
          <p style={{ color: 'var(--brand-50)', fontSize: 16, lineHeight: 1.6, opacity: 0.9 }}>
            Empower your engineering team to resolve issues faster by tapping into automated runbooks and AI-driven insights.
          </p>

          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              'Accelerate MTTR by up to 40%',
              'Discover hidden incident clusters',
              'Streamline postmortem generation',
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

    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <label className="label" style={{ marginBottom: 0 }}>{label}</label>
        {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}