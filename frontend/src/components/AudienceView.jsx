// ── AudienceView.jsx ──────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket }   from '../hooks/useSocket.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { drawFrame, createParticles, createLasers } from '../utils/canvas.js';

const TOTAL_DEVICES = 64;

export default function AudienceView({ onAdminTap }) {
  const canvasRef      = useRef(null);
  const animRef        = useRef(null);
  const stateRef       = useRef(null);   // latest state without re-render
  const particlesRef   = useRef([]);
  const lasersRef      = useRef([]);
  const shockwaveRef   = useRef(null);
  const timeRef        = useRef(0);
  const beatPhaseRef   = useRef(0);
  const lastTSRef      = useRef(0);
  const spinRef        = useRef(0);
  const adminTapCount  = useRef(0);
  const adminTapTimer  = useRef(null);

  const [joined, setJoined]       = useState(false);
  const [showJoin, setShowJoin]   = useState(true);
  const [offline, setOffline]     = useState(false);

  // ── SOCKET
  const { connected, state, deviceId, onBeat } = useSocket({ role: 'audience' });

  // Keep stateRef in sync without causing re-renders in the draw loop
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── WAKE LOCK (prevent screen sleep)
  useWakeLock(true);

  // ── BEAT CALLBACK
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
      // Android vibration on bass drop
      if ((s.mode === 'bassdrop') && navigator.vibrate) {
        navigator.vibrate(40);
      }
    });
  }, [onBeat]);

  // ── FULLSCREEN on join (best-effort)
  const tryFullscreen = useCallback(() => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) req.call(el).catch(() => {});
  }, []);

  // ── JOIN
  useEffect(() => {
    if (connected && !joined) {
      setJoined(true);
      setOffline(false);
      setTimeout(() => setShowJoin(false), 2800);
      tryFullscreen();
    }
    if (!connected && joined) setOffline(true);
    if (connected) setOffline(false);
  }, [connected, joined, tryFullscreen]);

  // ── INIT ASSETS
  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight;
    particlesRef.current = createParticles(90, W, H);
    lasersRef.current    = createLasers(7);
  }, []);

  // ── MAIN DRAW LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      // Reinit particles on resize
      particlesRef.current = createParticles(90, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);
    // iOS orientation change
    window.addEventListener('orientationchange', () => setTimeout(resize, 300));

    lastTSRef.current = performance.now();

    const draw = (ts) => {
      const dt = Math.min((ts - lastTSRef.current) / 1000, 0.05);
      lastTSRef.current = ts;
      timeRef.current  += dt;

      const s = stateRef.current;
      if (!s) { animRef.current = requestAnimationFrame(draw); return; }

      const W = canvas.width, H = canvas.height;

      // Advance beat phase locally (server beats are the authority but we interpolate)
      const bpmInterval = 60 / Math.max(s.bpm, 1);
      beatPhaseRef.current = (beatPhaseRef.current + dt / bpmInterval) % 1;

      // Advance mosaic spin
      if (s.mosaicRotate) spinRef.current += dt * s.mosaicRotateSpeed;

      drawFrame(ctx, W, H, timeRef.current, beatPhaseRef.current, dt, s, {
        particles:    particlesRef.current,
        lasers:       lasersRef.current,
        shockwaveRef: shockwaveRef,
        spinOffset:   spinRef.current,
      }, deviceId);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [deviceId]);

  // ── SECRET ADMIN TAP (tap top-right corner 5× quickly)
  const handleSecretTap = useCallback(() => {
    adminTapCount.current += 1;
    clearTimeout(adminTapTimer.current);
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
    if (adminTapCount.current >= 5) {
      adminTapCount.current = 0;
      onAdminTap();
    }
  }, [onAdminTap]);

  const modeLabel = state?.blackout ? 'BLACKOUT' : (state?.mode || '').toUpperCase();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      overflow: 'hidden',
      touchAction: 'none', // prevent scroll on iOS
    }}>
      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          willChange: 'transform',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      />

      {/* JOIN OVERLAY */}
      {showJoin && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
          animation: 'scaleIn .5s ease',
          padding: 'max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: "'Courier New', monospace" }}>
            <div style={{
              fontSize: 'clamp(2.5rem, 12vw, 5rem)',
              fontWeight: 900, letterSpacing: '0.18em',
              color: '#00d4ff',
              textShadow: '0 0 40px #00d4ff, 0 0 80px #8b00ff',
              marginBottom: 10,
            }}>LUMINOS</div>
            <div style={{ fontSize: 'clamp(9px, 2.5vw, 13px)', letterSpacing: '0.35em', color: 'rgba(0,212,255,0.9)' }}>
              CONCERT LIGHT SYSTEM
            </div>
            {connected ? (
              <>
                <div style={{ marginTop: 32, fontSize: 12, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.5)' }}>
                  DEVICE #{deviceId} CONNECTED
                </div>
                <div style={{ marginTop: 6, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)' }}>
                  SYNCING WITH LIVE SHOW…
                </div>
              </>
            ) : (
              <div style={{ marginTop: 32, fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,170,0,0.7)' }}>
                CONNECTING…
              </div>
            )}
          </div>
        </div>
      )}

      {/* OFFLINE BANNER */}
      {offline && !showJoin && (
        <div style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top, 0)',
          left: 0, right: 0,
          background: 'rgba(255,100,0,0.9)',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: 11, letterSpacing: '0.2em',
          color: '#000', fontFamily: "'Courier New', monospace",
          fontWeight: 700, zIndex: 20,
        }}>
          RECONNECTING…
        </div>
      )}

      {/* MODE LABEL (very subtle) */}
      {!showJoin && (
        <div style={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.12)',
          fontSize: 9, letterSpacing: '0.4em',
          fontFamily: "'Courier New', monospace",
          pointerEvents: 'none', zIndex: 5,
        }}>
          {modeLabel}
        </div>
      )}

      {/* SECRET ADMIN TAP ZONE (top-right corner, invisible) */}
      <div
        onClick={handleSecretTap}
        style={{
          position: 'absolute',
          top: 0, right: 0,
          width: 72, height: 72,
          zIndex: 30,
          cursor: 'default',
        }}
      />

      {/* Device # (bottom-left, barely visible) */}
      {!showJoin && (
        <div style={{
          position: 'absolute',
          bottom: 'max(10px, env(safe-area-inset-bottom))',
          left: 'max(10px, env(safe-area-inset-left))',
          color: 'rgba(255,255,255,0.08)',
          fontSize: 9, letterSpacing: '0.15em',
          fontFamily: "'Courier New', monospace",
          pointerEvents: 'none',
        }}>
          #{deviceId}
        </div>
      )}
    </div>
  );
}
