// ── BeatView.jsx ──────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer.js';
import { useWakeLock }      from '../hooks/useWakeLock.js';
import { hexToRgb, lerp, rand } from '../utils/canvas.js';

const BEAT_PALETTES = [
  { name: 'PLASMA',  colors: ['#ff00cc','#8b00ff','#00d4ff','#ff1122'] },
  { name: 'FIRE',    colors: ['#ff1122','#ff4400','#ff8800','#ffcc00'] },
  { name: 'OCEAN',   colors: ['#00d4ff','#0088ff','#0044cc','#00ffee'] },
  { name: 'AURORA',  colors: ['#39ff14','#00ffee','#8b00ff','#00d4ff'] },
  { name: 'GOLD',    colors: ['#ffcc00','#ffaa00','#ff6600','#ffffff'] },
  { name: 'MONO',    colors: ['#ffffff','#cccccc','#888888','#ffffff'] },
];

const BEAT_MODES = [
  { id: 'explode',  label: 'EXPLODE'  },
  { id: 'ripple',   label: 'RIPPLE'   },
  { id: 'flash',    label: 'FLASH'    },
  { id: 'waveform', label: 'WAVEFORM' },
  { id: 'spectrum', label: 'SPECTRUM' },
];

export default function BeatView({ onBack }) {
  const canvasRef    = useRef(null);
  const animRef      = useRef(null);
  const timeRef      = useRef(0);
  const lastRef      = useRef(0);
  const particlesRef = useRef([]);
  const ringsRef     = useRef([]);
  const flashRef     = useRef(0);
  const levelSmoothRef = useRef(0);
  const beatCoolRef  = useRef(0);
  const bpmHistory   = useRef([]);
  const paletteRef   = useRef(BEAT_PALETTES[0]);
  const modeRef      = useRef('explode');
  const sensitivityRef = useRef(1.0);

  const [paletteIdx,  setPaletteIdx]  = useState(0);
  const [modeIdx,     setModeIdx]     = useState(0);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [showUI,      setShowUI]      = useState(true);
  const [beatCount,   setBeatCount]   = useState(0);
  const [bpmEst,      setBpmEst]      = useState(0);

  const { active, error, level, isBeat, start, stop, getFreqData } = useAudioAnalyzer();
  useWakeLock(true);

  // Keep refs in sync with state (so canvas loop always reads latest)
  useEffect(() => { paletteRef.current    = BEAT_PALETTES[paletteIdx]; }, [paletteIdx]);
  useEffect(() => { modeRef.current       = BEAT_MODES[modeIdx].id;    }, [modeIdx]);
  useEffect(() => { sensitivityRef.current = sensitivity;               }, [sensitivity]);

  // ── BEAT REACTION
  useEffect(() => {
    if (!isBeat) return;
    if (beatCoolRef.current > 0) return;
    beatCoolRef.current = 10;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const pal = paletteRef.current;
    const sens = sensitivityRef.current;
    const color = pal.colors[Math.floor(Math.random() * pal.colors.length)];

    // Particles burst
    const count = Math.floor(18 + sens * 28);
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(3, 9 + sens * 7);
      particlesRef.current.push({
        x: W/2 + rand(-W*0.1, W*0.1),
        y: H/2 + rand(-H*0.1, H*0.1),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(2, 5 + sens * 3),
        life: 1,
        decay: rand(0.018, 0.045),
        color,
      });
    }

    // Shockwave ring
    ringsRef.current.push({
      x: W/2, y: H/2,
      r: 0,
      maxR: Math.max(W, H) * 0.9,
      life: 1,
      color: pal.colors[0],
    });

    // Screen flash
    flashRef.current = Math.min(1, 0.55 + sens * 0.45);

    // BPM estimate
    const now = performance.now();
    bpmHistory.current.push(now);
    if (bpmHistory.current.length > 10) bpmHistory.current.shift();
    if (bpmHistory.current.length >= 4) {
      const intervals = [];
      for (let i = 1; i < bpmHistory.current.length; i++)
        intervals.push(bpmHistory.current[i] - bpmHistory.current[i-1]);
      const avg = intervals.reduce((a,b)=>a+b,0) / intervals.length;
      setBpmEst(Math.round(60000 / avg));
    }

    setBeatCount(c => c + 1);
    if (navigator.vibrate) navigator.vibrate(20);
  }, [isBeat]);

  // ── CANVAS LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 300));
    lastRef.current = performance.now();

    const draw = (ts) => {
      const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
      lastRef.current = ts;
      timeRef.current += dt;
      const t   = timeRef.current;
      const W   = canvas.width, H = canvas.height;
      const pal  = paletteRef.current;
      const mode = modeRef.current;
      const sens = sensitivityRef.current;

      if (beatCoolRef.current > 0) beatCoolRef.current--;

      // Smooth level
      levelSmoothRef.current = lerp(levelSmoothRef.current, level, 0.12);
      const lv = Math.min(levelSmoothRef.current * sens * 2, 1);

      // ── BACKGROUND (motion blur effect)
      const flash = flashRef.current;
      flashRef.current = lerp(flashRef.current, 0, 0.14);
      ctx.fillStyle = `rgba(0,0,0,${lerp(0.88, 0.5, lv)})`;
      ctx.fillRect(0, 0, W, H);

      // Flash overlay
      if (flash > 0.04) {
        const rgb = hexToRgb(pal.colors[0]);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${flash * 0.38})`;
        ctx.fillRect(0, 0, W, H);
      }

      const freqData = getFreqData();

      // ── SPECTRUM MODE
      if (mode === 'spectrum' && freqData) {
        const bars = freqData.length;
        const bw = W / bars;
        for (let i = 0; i < bars; i++) {
          const v  = freqData[i] / 255;
          const bh = v * H * 0.85 * (1 + lv * 0.5);
          const hue = (i / bars) * 260 + t * 25;
          ctx.fillStyle = `hsla(${hue},100%,${45 + v*35}%,${0.65 + v*0.35})`;
          // Bottom bar
          ctx.fillRect(i*bw, H-bh, bw-1.5, bh);
          // Mirror top (softer)
          ctx.fillStyle = `hsla(${hue},100%,${45+v*35}%,${(0.65+v*0.35)*0.4})`;
          ctx.fillRect(i*bw, 0, bw-1.5, bh*0.4);
        }
      }

      // ── WAVEFORM MODE
      if (mode === 'waveform' && freqData) {
        const drawWave = (yBase, scaleY, colorHex, alpha, lineW) => {
          ctx.beginPath();
          ctx.strokeStyle = colorHex;
          ctx.lineWidth   = lineW;
          ctx.globalAlpha = alpha;
          ctx.shadowColor = colorHex;
          ctx.shadowBlur  = 12 + lv * 18;
          for (let i = 0; i < freqData.length; i++) {
            const x = (i / freqData.length) * W;
            const v = freqData[i] / 255;
            const y = yBase + (v - 0.5) * H * scaleY * (1 + lv * 1.5);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.globalAlpha = 1;
        };
        drawWave(H/2,   0.65, pal.colors[0], 1.0, 2.5 + lv*3);
        drawWave(H/2,  -0.65, pal.colors[1] || pal.colors[0], 0.5, 1.5 + lv*2);
        drawWave(H*0.25, 0.3, pal.colors[2] || pal.colors[0], 0.3, 1);
        drawWave(H*0.75, 0.3, pal.colors[3] || pal.colors[0], 0.3, 1);
      }

      // ── FLASH MODE
      if (mode === 'flash') {
        const rgb = hexToRgb(pal.colors[Math.floor(t*2)%pal.colors.length]);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${lerp(0.05, 0.95, flash)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ── AMBIENT GLOW (all modes)
      const rgb0 = hexToRgb(pal.colors[0]);
      const rgb1 = hexToRgb(pal.colors[1] || pal.colors[0]);
      const glowA = 0.08 + lv * 0.25;
      const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.6);
      g.addColorStop(0,   `rgba(${rgb0.r},${rgb0.g},${rgb0.b},${glowA})`);
      g.addColorStop(0.5, `rgba(${rgb1.r},${rgb1.g},${rgb1.b},${glowA*0.4})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // ── RIPPLE / EXPLODE RINGS
      if (mode === 'ripple' || mode === 'explode') {
        ringsRef.current = ringsRef.current.filter(ring => ring.life > 0.01);
        ringsRef.current.forEach(ring => {
          ring.r    = lerp(ring.r, ring.maxR, 0.08);
          ring.life = lerp(ring.life, 0, 0.055);
          const rgb = hexToRgb(ring.color);
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${ring.life * 0.9})`;
          ctx.lineWidth   = 4 * ring.life;
          ctx.shadowColor = ring.color;
          ctx.shadowBlur  = 20 * ring.life;
          ctx.stroke();
          ctx.shadowBlur  = 0;
        });
      }

      // ── PARTICLES (explode mode + all on beat)
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.01);
      if (mode === 'explode' || mode === 'ripple') {
        particlesRef.current.forEach(p => {
          p.x    += p.vx;
          p.y    += p.vy;
          p.vy   += 0.12; // gravity
          p.vx   *= 0.97; // drag
          p.life -= p.decay;

          const rgb = hexToRgb(p.color);
          const a   = p.life;
          const sz  = p.size * p.life;

          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(sz, 0.5), 0, Math.PI*2);
          ctx.fillStyle   = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = sz * 3;
          ctx.fill();
          ctx.shadowBlur  = 0;
        });
      }

      // ── LEVEL BAR (bottom)
      if (active) {
        const barW = W * lv;
        const barGrad = ctx.createLinearGradient(0, 0, W, 0);
        barGrad.addColorStop(0,   pal.colors[0]);
        barGrad.addColorStop(0.5, pal.colors[1] || pal.colors[0]);
        barGrad.addColorStop(1,   pal.colors[2] || pal.colors[0]);
        ctx.fillStyle   = barGrad;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(0, H - 4, barW, 4);
        ctx.globalAlpha = 1;
      }

      // ── BEAT FLASH INDICATOR (center pulse)
      if (flash > 0.1) {
        ctx.beginPath();
        ctx.arc(W/2, H/2, 10 + flash * 30, 0, Math.PI*2);
        const rgb = hexToRgb(pal.colors[0]);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${flash*0.8})`;
        ctx.shadowColor = pal.colors[0];
        ctx.shadowBlur  = 30 * flash;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      // Vignette
      const vig = ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.9);
      vig.addColorStop(0,'rgba(0,0,0,0)');
      vig.addColorStop(1,'rgba(0,0,0,0.65)');
      ctx.fillStyle = vig;
      ctx.fillRect(0,0,W,H);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [active, level, getFreqData]);

  // Auto-hide UI after 4s of no interaction
  useEffect(() => {
    if (!showUI) return;
    const t = setTimeout(() => { if (active) setShowUI(false); }, 4000);
    return () => clearTimeout(t);
  }, [showUI, active]);

  return (
    <div
      onClick={() => setShowUI(v => !v)}
      style={{
        position: 'fixed', inset: 0,
        background: '#000', overflow: 'hidden',
        touchAction: 'none',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      {/* CANVAS */}
      <canvas ref={canvasRef} style={{ position:'absolute',inset:0,width:'100%',height:'100%',display:'block' }} />

      {/* ── START SCREEN */}
      {!active && !error && (
        <div style={{
          position:'absolute',inset:0,
          background:'rgba(0,0,0,0.88)',
          backdropFilter:'blur(14px)',
          WebkitBackdropFilter:'blur(14px)',
          display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',
          zIndex:20, padding:24,
          fontFamily:"'Courier New',monospace",
        }}>
          <div style={{ fontSize:'clamp(2rem,10vw,3.5rem)', fontWeight:900, letterSpacing:'0.2em', color:'#ff00cc', textShadow:'0 0 40px #ff00cc88,0 0 80px #8b00ff44', marginBottom:8 }}>
            BEAT
          </div>
          <div style={{ fontSize:10, letterSpacing:'0.35em', color:'rgba(255,0,204,0.7)', marginBottom:40 }}>
            REACTIVE MODE
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:'0.15em', textAlign:'center', lineHeight:1.8, marginBottom:36, maxWidth:280 }}>
            Your phone's microphone listens to the music and drives the visuals in real time.
            Point it toward the speakers for best results.
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); start(); }}
            style={{
              background:'rgba(255,0,204,0.15)',
              border:'2px solid #ff00cc',
              color:'#ff00cc',
              padding:'16px 40px',
              borderRadius:12,
              fontSize:13, fontWeight:700,
              letterSpacing:'0.2em',
              cursor:'pointer',
              fontFamily:"'Courier New',monospace",
              boxShadow:'0 0 30px #ff00cc44',
              marginBottom:16,
            }}
          >
            ♪ ENABLE MICROPHONE
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            style={{
              background:'transparent',
              border:'1px solid rgba(255,255,255,0.15)',
              color:'rgba(255,255,255,0.35)',
              padding:'10px 24px', borderRadius:8,
              fontSize:11, letterSpacing:'0.15em',
              cursor:'pointer', fontFamily:"'Courier New',monospace",
            }}
          >
            ← BACK
          </button>
        </div>
      )}

      {/* ── ERROR */}
      {error && (
        <div style={{
          position:'absolute',inset:0,
          background:'rgba(0,0,0,0.92)',
          display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',
          zIndex:20,padding:24,
          fontFamily:"'Courier New',monospace",
        }}>
          <div style={{ fontSize:13, color:'#ff4455', letterSpacing:'0.15em', textAlign:'center', lineHeight:1.8, marginBottom:28, maxWidth:300 }}>
            ⚠ {error}
          </div>
          <button onClick={(e)=>{e.stopPropagation();onBack();}} style={{
            background:'transparent',border:'1px solid rgba(255,255,255,0.2)',
            color:'rgba(255,255,255,0.5)',padding:'10px 24px',borderRadius:8,
            fontSize:11,letterSpacing:'0.15em',cursor:'pointer',fontFamily:"'Courier New',monospace",
          }}>← BACK</button>
        </div>
      )}

      {/* ── ACTIVE UI (tap to toggle) */}
      {active && showUI && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'absolute',bottom:0,left:0,right:0,
            background:'rgba(0,0,0,0.75)',
            backdropFilter:'blur(16px)',
            WebkitBackdropFilter:'blur(16px)',
            borderTop:'1px solid rgba(255,255,255,0.08)',
            padding:'16px max(16px,env(safe-area-inset-left)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-right))',
            zIndex:20,
            fontFamily:"'Courier New',monospace",
            animation:'slideUp .3s ease',
          }}
        >
          {/* BPM + beat counter */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', gap:16 }}>
              <div>
                <div style={{ fontSize:8, letterSpacing:'0.25em', color:'rgba(255,255,255,0.3)' }}>DETECTED BPM</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#ff00cc', textShadow:'0 0 15px #ff00cc88' }}>
                  {bpmEst || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize:8, letterSpacing:'0.25em', color:'rgba(255,255,255,0.3)' }}>BEATS</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#00d4ff' }}>{beatCount}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => { stop(); setBeatCount(0); setBpmEst(0); bpmHistory.current=[]; }}
                style={{
                  background:'rgba(255,17,34,0.15)', border:'1px solid rgba(255,17,34,0.4)',
                  color:'#ff4455', padding:'8px 14px', borderRadius:8,
                  fontSize:10, letterSpacing:'0.15em', cursor:'pointer',
                  fontFamily:"'Courier New',monospace",
                }}
              >⬛ STOP</button>
              <button
                onClick={onBack}
                style={{
                  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
                  color:'rgba(255,255,255,0.4)', padding:'8px 14px', borderRadius:8,
                  fontSize:10, letterSpacing:'0.15em', cursor:'pointer',
                  fontFamily:"'Courier New',monospace",
                }}
              >← BACK</button>
            </div>
          </div>

          {/* Palette */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:8, letterSpacing:'0.25em', color:'rgba(255,255,255,0.28)', marginBottom:6 }}>PALETTE</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {BEAT_PALETTES.map((p, i) => (
                <button key={p.name} onClick={() => setPaletteIdx(i)} style={{
                  background: i===paletteIdx ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i===paletteIdx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius:6, padding:'6px 10px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:5,
                  fontFamily:"'Courier New',monospace",
                }}>
                  <div style={{ display:'flex', gap:2 }}>
                    {p.colors.map((c,j) => <div key={j} style={{ width:7,height:7,borderRadius:'50%',background:c }} />)}
                  </div>
                  <span style={{ fontSize:8, letterSpacing:'0.1em', color: i===paletteIdx?'#fff':'rgba(255,255,255,0.4)' }}>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Mode */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:8, letterSpacing:'0.25em', color:'rgba(255,255,255,0.28)', marginBottom:6 }}>VISUAL MODE</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {BEAT_MODES.map((m, i) => (
                <button key={m.id} onClick={() => setModeIdx(i)} style={{
                  background: i===modeIdx ? 'rgba(255,0,204,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${i===modeIdx ? '#ff00cc' : 'rgba(255,255,255,0.1)'}`,
                  color: i===modeIdx ? '#ff00cc' : 'rgba(255,255,255,0.45)',
                  borderRadius:6, padding:'6px 12px', cursor:'pointer',
                  fontSize:9, letterSpacing:'0.12em',
                  fontFamily:"'Courier New',monospace",
                  boxShadow: i===modeIdx ? '0 0 12px #ff00cc33' : 'none',
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:8, letterSpacing:'0.25em', color:'rgba(255,255,255,0.28)' }}>SENSITIVITY</span>
              <span style={{ fontSize:11, fontWeight:700, color:'#ff00cc' }}>{sensitivity.toFixed(1)}x</span>
            </div>
            <input type="range" min={0.3} max={3.0} step={0.1} value={sensitivity}
              onInput={e => setSensitivity(parseFloat(e.target.value))}
              style={{ accentColor:'#ff00cc', width:'100%' }} />
          </div>

          <div style={{ marginTop:10, fontSize:9, color:'rgba(255,255,255,0.18)', letterSpacing:'0.12em', textAlign:'center' }}>
            TAP SCREEN TO HIDE CONTROLS
          </div>
        </div>
      )}

      {/* ── Minimal active indicator when UI hidden */}
      {active && !showUI && (
        <div style={{
          position:'absolute',
          bottom:'max(16px,env(safe-area-inset-bottom))',
          left:'50%', transform:'translateX(-50%)',
          display:'flex', alignItems:'center', gap:6,
          pointerEvents:'none', zIndex:5,
        }}>
          <div style={{ width:6,height:6,borderRadius:'50%',background:'#ff00cc',boxShadow:'0 0 8px #ff00cc',animation:'blink 1s infinite' }} />
          <span style={{ fontSize:9, letterSpacing:'0.2em', color:'rgba(255,255,255,0.2)', fontFamily:"'Courier New',monospace" }}>
            {bpmEst ? `${bpmEst} BPM` : 'LISTENING'}
          </span>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
