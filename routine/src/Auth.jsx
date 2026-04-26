import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAF7',
      fontFamily: "'Inter Tight', system-ui, sans-serif",
      display: 'grid', placeItems: 'center', padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&display=swap');
      `}</style>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: '#0A0A0A',
            display: 'inline-grid', placeItems: 'center', color: '#FF4D2E',
            fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 26, marginBottom: 16,
          }}>R</div>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontWeight: 600,
            fontSize: 32, margin: '0 0 4px 0', letterSpacing: '-0.02em',
          }}>
            Routine<span style={{ color: '#FF4D2E' }}>.</span>
          </h1>
          <p style={{ color: '#737373', fontSize: 14, margin: 0 }}>
            {isSignUp ? 'Create an account to get started' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'white', borderRadius: 20, padding: 24,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 20px -6px rgba(0,0,0,0.08)',
        }}>
          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', color: '#DC2626',
              padding: '10px 14px', borderRadius: 10, fontSize: 13,
              fontWeight: 500, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              color: '#737373', letterSpacing: '0.15em', fontWeight: 600,
              display: 'block', marginBottom: 6,
            }}>EMAIL</label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: '1.5px solid rgba(0,0,0,0.1)', background: 'white',
                fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0A0A0A'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              color: '#737373', letterSpacing: '0.15em', fontWeight: 600,
              display: 'block', marginBottom: 6,
            }}>PASSWORD</label>
            <input
              type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'Min 6 characters' : 'Your password'}
              minLength={6}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: '1.5px solid rgba(0,0,0,0.1)', background: 'white',
                fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0A0A0A'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.1)'}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px 18px', borderRadius: 999,
              background: '#0A0A0A', color: '#FAFAF7', border: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.background = '#FF4D2E'; }}
            onMouseLeave={(e) => { e.target.style.background = '#0A0A0A'; }}
          >
            {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#737373' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            style={{
              background: 'none', border: 'none', color: '#0A0A0A',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, textDecoration: 'underline', padding: 0,
            }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
