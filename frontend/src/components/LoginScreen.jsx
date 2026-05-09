// ── LoginScreen.jsx ───────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';

export default function LoginScreen({ onLogin, onBack }) {
  const [pw, setPw]         = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus on desktop; skip on mobile (avoids keyboard pop)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile && inputRef.current) inputRef.current.focus();
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (!pw.trim() || loading) return;
    if (attempts >= 5) { setError('Too many attempts. Refresh to try again.'); return; }

    setLoading(true);
    setError('');
    try {
      await onLogin(pw.trim());
    } catch (err) {
      setAttempts(a => a + 1);
      setError(err.message || 'Invalid password');
      setPw('');
      // Vibrate on error (Android)
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#030308',
      backgroundImage: 'radial-gradient(ellipse at 30% 30%, rgba(139,0,255,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(0,212,255,0.08) 0%, transparent 60%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          left: 'max(16px, env(safe-area-inset-left))',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)',
          padding: '8px 14px', borderRadius: 8,
          fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
        }}
      >← BACK</button>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeIn .5s ease' }}>
        <div style={{
          fontSize: 'clamp(2.2rem, 10vw, 3.5rem)',
          fontWeight: 900, letterSpacing: '0.2em',
          color: '#00d4ff',
          textShadow: '0 0 40px #00d4ff88, 0 0 80px #8b00ff44',
        }}>LUMINOS</div>
        <div style={{ fontSize: 10, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
          ADMIN ACCESS
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 'clamp(20px, 5vw, 32px)',
        backdropFilter: 'blur(12px)',
        animation: 'scaleIn .4s ease',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
          ENTER ADMIN PASSWORD
        </div>

        {/* Password field */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Password"
            autoComplete="current-password"
            style={{
              width: '100%', padding: '14px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${error ? 'rgba(255,17,34,0.6)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10, color: '#fff',
              fontSize: 16, // 16px prevents iOS zoom
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.2em', outline: 'none',
              transition: 'border-color .2s',
              WebkitAppearance: 'none', // iOS fix
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,17,34,0.12)',
            border: '1px solid rgba(255,17,34,0.3)',
            borderRadius: 8, padding: '10px 14px',
            color: '#ff4455', fontSize: 11,
            letterSpacing: '0.1em', marginBottom: 16,
            animation: 'fadeIn .25s ease',
          }}>
            {error}
          </div>
        )}

        {/* Attempts warning */}
        {attempts > 2 && attempts < 5 && (
          <div style={{ color: 'rgba(255,170,0,0.8)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 12 }}>
            {5 - attempts} attempt{5 - attempts !== 1 ? 's' : ''} remaining
          </div>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={loading || !pw.trim() || attempts >= 5}
          style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(0,212,255,0.1)' : 'rgba(0,212,255,0.15)',
            border: '1px solid rgba(0,212,255,0.35)',
            borderRadius: 10, color: '#00d4ff',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.2em',
            cursor: loading || attempts >= 5 ? 'not-allowed' : 'pointer',
            opacity: attempts >= 5 ? 0.4 : 1,
            transition: 'all .2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading
            ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> AUTHENTICATING...</>
            : '→ ENTER DASHBOARD'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.15)', fontSize: 10, letterSpacing: '0.15em' }}>
          DEFAULT: admin123 · Change in backend .env
        </div>
      </div>
    </div>
  );
}
