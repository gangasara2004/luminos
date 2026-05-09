// ── PreviewCanvas.jsx ─────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { drawFrame, drawPreviewGrid, createParticles, createLasers, hexToRgb, lerp } from '../utils/canvas.js';

export default function PreviewCanvas({ state }) {
  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const timeRef    = useRef(0);
  const lastRef    = useRef(0);
  const beatRef    = useRef(0);
  const spinRef    = useRef(0);
  const assetsRef  = useRef({ particles: [], lasers: [], shockwaveRef: { current: null }, spinOffset: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      assetsRef.current.particles = createParticles(40, W, H);
    };

    resize();
    assetsRef.current.lasers = createLasers(5);
    lastRef.current = performance.now();

    const draw = (ts) => {
      const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
      lastRef.current = ts;
      timeRef.current += dt;
      const t = timeRef.current;

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const s = state; // comes from props — latest ref

      const bI = 60 / Math.max(s.bpm, 1);
      beatRef.current = (beatRef.current + dt / bI) % 1;

      if (s.mosaicRotate) spinRef.current += dt * s.mosaicRotateSpeed;
      assetsRef.current.spinOffset = spinRef.current;

      ctx.clearRect(0, 0, W, H);

      if (s.mode === 'mosaic') {
        drawPreviewGrid(ctx, W, H, t, beatRef.current, s, spinRef.current);
      } else {
        drawFrame(ctx, W, H, t, beatRef.current, dt, s, assetsRef.current, 0);
      }

      // Overlay: mini phone silhouettes
      if (s.mode !== 'mosaic' && !s.blackout && s.mode !== 'blackout') {
        const rgb = hexToRgb(s.color);
        const bp  = Math.pow(Math.sin(beatRef.current * Math.PI), 3);
        const a   = lerp(0.5, 0.9, bp) * (s.brightness / 100);
        for (let i = 0; i < 5; i++) {
          const dx = W / 6 * (i + 1);
          const dy = H / 2 + Math.sin(t * 2.2 + i) * 4;
          const grd = ctx.createRadialGradient(dx, dy, 0, dx, dy, 10);
          grd.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.roundRect(dx - 5, dy - 9, 10, 18, 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []); // mount only — state is read via closure from parent re-renders

  // Update state ref on prop change without restarting loop
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '9/16', maxHeight: 200, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', willChange: 'transform' }}
      />
      <div style={{ position: 'absolute', bottom: 5, left: 6, fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.28)', fontFamily: "'Courier New', monospace" }}>
        {state.mode.toUpperCase()} · {state.bpm}BPM
      </div>
    </div>
  );
}
