// ── AudienceView.jsx ──────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket }   from '../hooks/useSocket.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { drawFrame, createParticles, createLasers } from '../utils/canvas.js';

const TOTAL_DEVICES = 100;

export default function AudienceView({ onAdminTap, onBeatTap }) {
  const canvasRef     = useRef(null);
  const animRef       = useRef(null);
  const stateRef      = useRef(null);
  const particlesRef  = useRef([]);
  const lasersRef     = useRef([]);
  const shockwaveRef  = useRef(null);
  const timeRef       = useRef(0);
  const beatPhaseRef  = useRef(0);
  const lastTSRef     = useRef(0);
  const spinRef       = useRef(0);
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef(null);

  const [joined, setJoined]         = useState(false);
  const [showJoin, setShowJoin]     = useState(true);
  const [offline, setOffline]       = useState(false);
  const [fsError, setFsError]       = useState(false); // fullscreen unavailable

  const { connected, state, deviceId, stats, onBeat } = useSocket({ role: 'audience' });

  useEffect(() => { stateRef.current = state; }, [state]);
  useWakeLock(true);

  // ── FULLSCREEN — tries every vendor prefix + iOS workaround
  const tryFullscreen = useCallback(() => {
    const el = document.documentElement;
    const req =
      el.requestFullscreen        ||
      el.webkitRequestFullscreen  ||
      el.mozRequestFullScreen     ||
      el.msRequestFullscreen;

    if (req) {
      req.call(el).catch(() => setFsError(true));
    } else {
      // iOS Safari: no fullscreen API — hide address bar by scrolling
      setFsError(true);
      window.scrollTo(0, 1);
    }
  }, []);

  // ── BEAT
  useEffect(() => {
    onBeat(() => {
      const s = stateRef.current;
      if (!s) return;
      if (s.mode === 'bassdrop' || s.mode === 'strobe') {
        shockwaveRef.current = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          r: 0,
          maxR: Math.max(window.innerWidth, window.innerHeight) * 1.35,
          born: performance.now(),
        };
      }
      if (s.mode === 'bassdrop' && navigator.vibrate) navigator.vibrate(40);
    });
  }, [onBeat]);

  // ── JOIN
  useEffect(() => {
    if (connected && !joined) {
      setJoined(true);
      setOffline(false);
      setTimeout(() => setShowJoin(false), 3000);
    }
    if (!connected && joined) setOffline(true);
    if (connected) setOffline(false);
  }, [connected, joined]);

  // ── INIT ASSETS
  useEffect(() => {
    particlesRef.current = createParticles(90, window.innerWidth, window.innerHeight);
    lasersRef.current    = createLasers(7);
  }, []);

  // ── CANVAS LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = createParticles(90, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 350));
    lastTSRef.current = performance.now();

    const draw = (ts) => {
      const dt = Math.min((ts - lastTSRef.current) / 1000, 0.05);
      lastTSRef.current = ts;
      timeRef.current  += dt;
      const s = stateRef.current;
      if (!s) { animRef.current = requestAnimationFrame(draw); return; }
      const W = canvas.width, H = canvas.height;
      beatPhaseRef.current = (beatPhaseRef.current + dt / (60 / Math.max(s.bpm, 1))) % 1;
      if (s.mosaicRotate) spinRef.current += dt * s.mosaicRotateSpeed;
      drawFrame(ctx, W, H, timeRef.current, beatPhaseRef.current, dt, s, {
        particles:    particlesRef.current,
        lasers:       lasersRef.current,
        shockwaveRef: shockwaveRef,
        spinOffset:   spinRef.current,
      }, deviceId % TOTAL_DEVICES);
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [deviceId]);

  // ── SECRET ADMIN TAP (5× top-right)
  const handleSecretTap = useCallback(() => {
    adminTapCount.current += 1;
    clearTimeout(adminTapTimer.current);
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
    if (adminTapCount.current >= 5) { adminTapCount.current = 0; onAdminTap(); }
  }, [onAdminTap]);

  // ── TAP ANYWHERE to trigger fullscreen (required by browsers)
  const handleTap = useCallback(() => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      tryFullscreen();
    }
  }, [tryFullscreen]);

  const modeLabel = state?.blackout ? 'BLACKOUT' : (state?.mode || '').toUpperCase();

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'fixed', inset: 0,
        // iOS full-height fix
        width: '100vw',
        height: '100vh',
        height: '100dvh',
        background: '#000',
        overflow: 'hidden',
        touchAction: 'none',
        // Force GPU layer
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          display: 'block',
          willChange: 'transform',
        }}
      />

      {/* JOIN OVERLAY */}
      {showJoin && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10, animation: 'scaleIn .5s ease',
          padding: '24px max(24px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: "'Courier New', monospace" }}>

            {/* LOGO */}
            <div style={{
              fontSize: 'clamp(2.8rem, 14vw, 5.5rem)',
              fontWeight: 900, letterSpacing: '0.18em',
              color: '#00d4ff',
              textShadow: '0 0 40px #00d4ff, 0 0 80px #8b00ff',
              marginBottom: 8,
            }}>LUMINOS</div>

            <div style={{ fontSize: 'clamp(9px, 2.5vw, 13px)', letterSpacing: '0.38em', color: 'rgba(0,212,255,0.85)' }}>
              CONCERT LIGHT SYSTEM
            </div>

            {/* LIVE COUNT */}
            <div style={{ marginTop: 44, marginBottom: 4 }}>
              <div style={{
                fontSize: 'clamp(3.5rem, 18vw, 7rem)',
                fontWeight: 900, lineHeight: 1,
                color: '#39ff14',
                textShadow: '0 0 30px #39ff14, 0 0 70px #39ff14aa',
                fontFamily: "'Courier New', monospace",
                transition: 'all 0.4s ease',
              }}>
                {connected ? stats.total : '·'}
              </div>
              <div style={{
                fontSize: 'clamp(9px, 2.5vw, 12px)',
                letterSpacing: '0.35em',
                color: connected ? 'rgba(57,255,20,0.65)' : 'rgba(255,170,0,0.7)',
                marginTop: 6,
              }}>
                {connected
                  ? `DEVICE${stats.total !== 1 ? 'S' : ''} CONNECTED`
                  : 'CONNECTING…'}
              </div>
            </div>

            {/* Device ID */}
            {connected && (
              <div style={{ marginTop: 24, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.22)' }}>
                YOU ARE DEVICE #{deviceId}
              </div>
            )}

            {/* Tap hint */}
            <div style={{ marginTop: 32, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.18)', animation: 'blink 2s infinite' }}>
              TAP SCREEN FOR FULLSCREEN
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE BANNER */}
      {offline && !showJoin && (
        <div style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0, right: 0,
          background: 'rgba(255,100,0,0.92)',
          padding: '10px 16px', textAlign: 'center',
          fontSize: 11, letterSpacing: '0.2em',
          color: '#000', fontFamily: "'Courier New', monospace",
          fontWeight: 700, zIndex: 20,
        }}>
          ⚠ RECONNECTING…
        </div>
      )}

      {/* MODE LABEL */}
      {!showJoin && (
        <div style={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.1)',
          fontSize: 9, letterSpacing: '0.4em',
          fontFamily: "'Courier New', monospace",
          pointerEvents: 'none', zIndex: 5,
        }}>
          {modeLabel}
        </div>
      )}

      {/* LIVE COUNT (persistent dot) */}
      {!showJoin && connected && (
        <div style={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          right: 'max(12px, env(safe-area-inset-right))',
          display: 'flex', alignItems: 'center', gap: 5,
          pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#39ff14', boxShadow: '0 0 6px #39ff14', animation: 'blink 2s infinite' }} />
          <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.18)', fontFamily: "'Courier New', monospace" }}>
            {stats.total}
          </span>
        </div>
      )}

      {/* SECRET ADMIN TAP ZONE (top-right corner, invisible) */}
      <div
        onClick={(e) => { e.stopPropagation(); handleSecretTap(); }}
        style={{ position: 'absolute', top: 0, right: 0, width: 88, height: 88, zIndex: 30 }}
      />


      {/* BEAT MODE BUTTON */}
      {!showJoin && (
        <button
          onClick={(e) => { e.stopPropagation(); onBeatTap(); }}
          style={{
            position: 'absolute',
            bottom: 'max(16px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,0,204,0.12)',
            border: '1px solid rgba(255,0,204,0.35)',
            color: 'rgba(255,0,204,0.8)',
            padding: '8px 20px',
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2em',
            cursor: 'pointer',
            fontFamily: "'Courier New', monospace",
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          ♪ BEAT MODE
        </button>
      )}

      {/* Device # */}
      {!showJoin && (
        <div style={{
          position: 'absolute',
          bottom: 'max(10px, env(safe-area-inset-bottom))',
          left: 'max(10px, env(safe-area-inset-left))',
          color: 'rgba(255,255,255,0.07)',
          fontSize: 9, letterSpacing: '0.12em',
          fontFamily: "'Courier New', monospace",
          pointerEvents: 'none',
        }}>
          #{deviceId}
        </div>
      )}
    </div>
  );
}
