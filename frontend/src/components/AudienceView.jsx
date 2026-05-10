// ── AudienceView.jsx ──────────────────────────────────────────────────────────
// Beat mode is activated by admin via the shared state flag `beatMode`.
// When beatMode=true, ALL audience phones automatically switch to BeatView.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket }        from '../hooks/useSocket.js';
import { useWakeLock }      from '../hooks/useWakeLock.js';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer.js';
import { drawFrame, createParticles, createLasers, hexToRgb, lerp, rand } from '../utils/canvas.js';

const TOTAL_DEVICES = 100;

// ── BEAT PALETTES (used when beatMode is active)
const BEAT_PALETTES = [
  ['#ff00cc','#8b00ff','#00d4ff','#ff1122'],
  ['#ff1122','#ff4400','#ff8800','#ffcc00'],
  ['#00d4ff','#0088ff','#0044cc','#00ffee'],
  ['#39ff14','#00ffee','#8b00ff','#00d4ff'],
];

export default function AudienceView({ onAdminTap }) {
  // ── CANVAS STATE
  const canvasRef      = useRef(null);
  const animRef        = useRef(null);
  const stateRef       = useRef(null);
  const particlesRef   = useRef([]);
  const lasersRef      = useRef([]);
  const shockwaveRef   = useRef(null);
  const timeRef        = useRef(0);
  const beatPhaseRef   = useRef(0);
  const lastTSRef      = useRef(0);
  const spinRef        = useRef(0);

  // ── BEAT MODE STATE
  const flashRef       = useRef(0);
  const levelSmoothRef = useRef(0);
  const beatCoolRef    = useRef(0);
  const beatParticles  = useRef([]);
  const beatRings      = useRef([]);
  const bpmHistory     = useRef([]);

  // ── UI STATE
  const adminTapCount  = useRef(0);
  const adminTapTimer  = useRef(null);
  const [joined,   setJoined]   = useState(false);
  const [showJoin, setShowJoin] = useState(true);
  const [offline,  setOffline]  = useState(false);
  const [micError, setMicError] = useState('');
  const [bpmEst,   setBpmEst]   = useState(0);
  const [beatCount,setBeatCount]= useState(0);
  const [paletteIdx, setPaletteIdx] = useState(0);

  const { connected, state, deviceId, stats, onBeat } = useSocket({ role: 'audience' });
  const { active: micActive, error: micErr, level, isBeat, start: startMic, stop: stopMic, getFreqData } = useAudioAnalyzer();

  useEffect(() => { stateRef.current = state; }, [state]);
  useWakeLock(true);

  // ── WHEN ADMIN ENABLES BEAT MODE — auto-request mic
  useEffect(() => {
    if (state.beatMode && !micActive && !micErr) {
      startMic().catch(() => {});
    }
    if (!state.beatMode && micActive) {
      stopMic();
      setBpmEst(0); setBeatCount(0);
      bpmHistory.current = [];
      beatParticles.current = [];
      beatRings.current = [];
    }
  }, [state.beatMode]);

  useEffect(() => {
    if (micErr) setMicError(micErr);
  }, [micErr]);

  // ── BEAT REACTION (mic-detected beats in beat mode)
  useEffect(() => {
    if (!isBeat || !state.beatMode) return;
    if (beatCoolRef.current > 0) return;
    beatCoolRef.current = 10;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const pal = BEAT_PALETTES[paletteIdx];
    const color = pal[Math.floor(Math.random() * pal.length)];

    // Particle burst
    for (let i = 0; i < 22; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(3, 11);
      beatParticles.current.push({
        x: W/2 + rand(-W*0.12, W*0.12),
        y: H/2 + rand(-H*0.12, H*0.12),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(2, 6),
        life: 1, decay: rand(0.018, 0.045),
        color,
      });
    }

    // Shockwave ring
    beatRings.current.push({
      x: W/2, y: H/2, r: 0,
      maxR: Math.max(W,H) * 0.9,
      life: 1, color: pal[0],
    });

    flashRef.current = 0.75;

    // BPM estimate
    const now = performance.now();
    bpmHistory.current.push(now);
    if (bpmHistory.current.length > 10) bpmHistory.current.shift();
    if (bpmHistory.current.length >= 4) {
      const intervals = [];
      for (let i = 1; i < bpmHistory.current.length; i++)
        intervals.push(bpmHistory.current[i] - bpmHistory.current[i-1]);
      const avg = intervals.reduce((a,b)=>a+b,0)/intervals.length;
      setBpmEst(Math.round(60000/avg));
    }
    setBeatCount(c => c+1);
    if (navigator.vibrate) navigator.vibrate(20);
  }, [isBeat, paletteIdx, state.beatMode]);

  // ── SERVER BEAT (for non-beat-mode animations)
  useEffect(() => {
    onBeat(() => {
      const s = stateRef.current;
      if (!s || s.beatMode) return;
      if (s.mode === 'bassdrop' || s.mode === 'strobe') {
        shockwaveRef.current = {
          x: window.innerWidth/2, y: window.innerHeight/2,
          r: 0, maxR: Math.max(window.innerWidth, window.innerHeight)*1.35,
          born: performance.now(),
        };
      }
      if (s.mode === 'bassdrop' && navigator.vibrate) navigator.vibrate(40);
    });
  }, [onBeat]);

  // ── FULLSCREEN
  const tryFullscreen = useCallback(() => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) req.call(el).catch(() => {});
    else window.scrollTo(0, 1);
  }, []);

  useEffect(() => {
    if (connected && !joined) {
      setJoined(true); setOffline(false);
      setTimeout(() => setShowJoin(false), 3000);
    }
    if (!connected && joined) setOffline(true);
    if (connected) setOffline(false);
  }, [connected, joined]);

  useEffect(() => {
    particlesRef.current = createParticles(90, window.innerWidth, window.innerHeight);
    lasersRef.current    = createLasers(7);
  }, []);

  // ── MAIN CANVAS LOOP
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
    window.addEventListener('orientationchange', () => setTimeout(resize, 300));
    lastTSRef.current = performance.now();

    const draw = (ts) => {
      const dt = Math.min((ts - lastTSRef.current)/1000, 0.05);
      lastTSRef.current = ts;
      timeRef.current  += dt;
      const t = timeRef.current;
      const W = canvas.width, H = canvas.height;
      const s = stateRef.current;
      if (!s) { animRef.current = requestAnimationFrame(draw); return; }

      if (beatCoolRef.current > 0) beatCoolRef.current--;

      // ── BEAT MODE RENDERING
      if (s.beatMode) {
        levelSmoothRef.current = lerp(levelSmoothRef.current, level, 0.12);
        const lv    = Math.min(levelSmoothRef.current * 2, 1);
        const flash = flashRef.current;
        flashRef.current = lerp(flashRef.current, 0, 0.13);
        const pal = BEAT_PALETTES[paletteIdx];
        const freqData = getFreqData();

        // Background with motion blur
        ctx.fillStyle = `rgba(0,0,0,${lerp(0.88, 0.5, lv)})`;
        ctx.fillRect(0, 0, W, H);

        // Flash overlay
        if (flash > 0.04) {
          const rgb = hexToRgb(pal[0]);
          ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${flash*0.4})`;
          ctx.fillRect(0, 0, W, H);
        }

        // Spectrum bars (background layer)
        if (freqData) {
          const bars = freqData.length;
          const bw = W / bars;
          for (let i = 0; i < bars; i++) {
            const v  = freqData[i]/255;
            const bh = v * H * 0.6 * (1 + lv*0.5);
            const hue = (i/bars)*260 + t*20;
            ctx.fillStyle = `hsla(${hue},100%,${45+v*30}%,${0.5+v*0.3})`;
            ctx.fillRect(i*bw, H-bh, bw-1, bh);
          }
        }

        // Ambient glow
        const rgb0 = hexToRgb(pal[0]);
        const g = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.6);
        g.addColorStop(0,   `rgba(${rgb0.r},${rgb0.g},${rgb0.b},${0.08+lv*0.22})`);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

        // Beat rings
        beatRings.current = beatRings.current.filter(r => r.life > 0.01);
        beatRings.current.forEach(ring => {
          ring.r    = lerp(ring.r, ring.maxR, 0.07);
          ring.life = lerp(ring.life, 0, 0.05);
          const rgb = hexToRgb(ring.color);
          ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${ring.life*0.9})`;
          ctx.lineWidth   = 4*ring.life;
          ctx.shadowColor = ring.color; ctx.shadowBlur = 20*ring.life;
          ctx.stroke(); ctx.shadowBlur = 0;
        });

        // Beat particles
        beatParticles.current = beatParticles.current.filter(p => p.life > 0.01);
        beatParticles.current.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          p.vy += 0.12; p.vx *= 0.97;
          p.life -= p.decay;
          const rgb = hexToRgb(p.color);
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(p.size*p.life, 0.5), 0, Math.PI*2);
          ctx.fillStyle   = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.life})`;
          ctx.shadowColor = p.color; ctx.shadowBlur = p.size*3;
          ctx.fill(); ctx.shadowBlur = 0;
        });

        // Level bar
        if (micActive) {
          const barGrad = ctx.createLinearGradient(0,0,W,0);
          barGrad.addColorStop(0, pal[0]); barGrad.addColorStop(0.5, pal[1]||pal[0]); barGrad.addColorStop(1, pal[2]||pal[0]);
          ctx.fillStyle = barGrad; ctx.globalAlpha = 0.7;
          ctx.fillRect(0, H-4, W*levelSmoothRef.current*2, 4);
          ctx.globalAlpha = 1;
        }

        // Vignette
        const vig = ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.9);
        vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.6)');
        ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);

        animRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── NORMAL MODE RENDERING
      beatPhaseRef.current = (beatPhaseRef.current + dt/(60/Math.max(s.bpm,1))) % 1;
      if (s.mosaicRotate) spinRef.current += dt * s.mosaicRotateSpeed;
      drawFrame(ctx, W, H, t, beatPhaseRef.current, dt, s, {
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
  }, [deviceId, level, micActive, paletteIdx, getFreqData]);

  // ── SECRET ADMIN TAP
  const handleSecretTap = useCallback(() => {
    adminTapCount.current += 1;
    clearTimeout(adminTapTimer.current);
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 2000);
    if (adminTapCount.current >= 5) { adminTapCount.current = 0; onAdminTap(); }
  }, [onAdminTap]);

  const handleTap = useCallback(() => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) tryFullscreen();
  }, [tryFullscreen]);

  const modeLabel = state?.beatMode ? 'BEAT MODE' : state?.blackout ? 'BLACKOUT' : (state?.mode || '').toUpperCase();
  const isBeatMode = state?.beatMode;

  return (
    <div onClick={handleTap} style={{
      position: 'fixed', inset: 0,
      width: '100vw', height: '100dvh',
      background: '#000', overflow: 'hidden',
      touchAction: 'none',
      WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%', display: 'block',
        willChange: 'transform',
      }} />

      {/* JOIN OVERLAY */}
      {showJoin && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10, animation: 'scaleIn .5s ease',
          padding: '24px 24px max(32px,env(safe-area-inset-bottom))',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: "'Courier New',monospace" }}>
            <div style={{
              fontSize: 'clamp(2.8rem,14vw,5.5rem)',
              fontWeight: 900, letterSpacing: '0.18em',
              color: '#00d4ff',
              textShadow: '0 0 40px #00d4ff, 0 0 80px #8b00ff',
              marginBottom: 8,
            }}>LUMINOS</div>
            <div style={{ fontSize: 'clamp(9px,2.5vw,13px)', letterSpacing: '0.38em', color: 'rgba(0,212,255,0.85)' }}>
              CONCERT LIGHT SYSTEM
            </div>
            <div style={{ marginTop: 44, marginBottom: 4 }}>
              <div style={{
                fontSize: 'clamp(3.5rem,18vw,7rem)',
                fontWeight: 900, lineHeight: 1,
                color: '#39ff14',
                textShadow: '0 0 30px #39ff14, 0 0 70px #39ff14aa',
                fontFamily: "'Courier New',monospace",
                transition: 'all 0.4s ease',
              }}>
                {connected ? stats.total : '·'}
              </div>
              <div style={{
                fontSize: 'clamp(9px,2.5vw,12px)', letterSpacing: '0.35em',
                color: connected ? 'rgba(57,255,20,0.65)' : 'rgba(255,170,0,0.7)',
                marginTop: 6,
              }}>
                {connected ? `DEVICE${stats.total!==1?'S':''} CONNECTED` : 'CONNECTING…'}
              </div>
            </div>
            {connected && (
              <div style={{ marginTop: 20, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.22)' }}>
                YOU ARE DEVICE #{deviceId}
              </div>
            )}
            <div style={{ marginTop: 28, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.15)', animation: 'blink 2s infinite' }}>
              TAP SCREEN FOR FULLSCREEN
            </div>
          </div>
        </div>
      )}

      {/* BEAT MODE OVERLAY — mic permission prompt */}
      {isBeatMode && !micActive && !showJoin && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 15, padding: 24,
          fontFamily: "'Courier New',monospace",
        }}>
          <div style={{ fontSize: 'clamp(1.8rem,8vw,3rem)', fontWeight:900, letterSpacing:'0.2em', color:'#ff00cc', textShadow:'0 0 40px #ff00cc88', marginBottom:8 }}>
            BEAT MODE
          </div>
          <div style={{ fontSize:10, letterSpacing:'0.3em', color:'rgba(255,0,204,0.6)', marginBottom:32 }}>
            ACTIVATED BY ADMIN
          </div>
          {micError ? (
            <>
              <div style={{ fontSize:11, color:'#ff4455', letterSpacing:'0.12em', textAlign:'center', lineHeight:1.8, marginBottom:24, maxWidth:280 }}>
                ⚠ {micError}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textAlign:'center', maxWidth:260 }}>
                Allow microphone access in your browser settings, then refresh the page.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', letterSpacing:'0.12em', textAlign:'center', lineHeight:1.8, marginBottom:32, maxWidth:280 }}>
                The admin has switched to Beat Mode. Allow microphone access so your phone can react to the music in real time.
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); startMic(); }}
                style={{
                  background:'rgba(255,0,204,0.15)', border:'2px solid #ff00cc',
                  color:'#ff00cc', padding:'16px 40px', borderRadius:12,
                  fontSize:13, fontWeight:700, letterSpacing:'0.2em',
                  cursor:'pointer', fontFamily:"'Courier New',monospace",
                  boxShadow:'0 0 30px #ff00cc44',
                  animation: 'blink 1.5s infinite',
                }}
              >
                ♪ ALLOW MICROPHONE
              </button>
            </>
          )}
        </div>
      )}

      {/* OFFLINE */}
      {offline && !showJoin && (
        <div style={{
          position:'absolute', top:'env(safe-area-inset-top,0px)', left:0, right:0,
          background:'rgba(255,100,0,0.92)', padding:'10px 16px', textAlign:'center',
          fontSize:11, letterSpacing:'0.2em', color:'#000',
          fontFamily:"'Courier New',monospace", fontWeight:700, zIndex:20,
        }}>
          ⚠ RECONNECTING…
        </div>
      )}

      {/* MODE LABEL */}
      {!showJoin && (
        <div style={{
          position:'absolute',
          top:'max(12px,env(safe-area-inset-top))',
          left:'50%', transform:'translateX(-50%)',
          color: isBeatMode ? 'rgba(255,0,204,0.35)' : 'rgba(255,255,255,0.1)',
          fontSize:9, letterSpacing:'0.4em',
          fontFamily:"'Courier New',monospace",
          pointerEvents:'none', zIndex:5,
          textShadow: isBeatMode ? '0 0 10px #ff00cc88' : 'none',
        }}>
          {modeLabel}
        </div>
      )}

      {/* LIVE COUNT DOT */}
      {!showJoin && connected && (
        <div style={{
          position:'absolute',
          top:'max(12px,env(safe-area-inset-top))',
          right:'max(12px,env(safe-area-inset-right))',
          display:'flex', alignItems:'center', gap:5,
          pointerEvents:'none', zIndex:5,
        }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#39ff14', boxShadow:'0 0 6px #39ff14', animation:'blink 2s infinite' }} />
          <span style={{ fontSize:9, letterSpacing:'0.15em', color:'rgba(255,255,255,0.18)', fontFamily:"'Courier New',monospace" }}>
            {stats.total}
          </span>
        </div>
      )}

      {/* BEAT MODE: live BPM indicator */}
      {isBeatMode && micActive && !showJoin && (
        <div style={{
          position:'absolute',
          bottom:'max(20px,env(safe-area-inset-bottom))',
          left:'50%', transform:'translateX(-50%)',
          display:'flex', alignItems:'center', gap:10,
          pointerEvents:'none', zIndex:5,
          fontFamily:"'Courier New',monospace",
        }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#ff00cc', boxShadow:'0 0 10px #ff00cc', animation:'blink 0.5s infinite' }} />
          <span style={{ fontSize:10, letterSpacing:'0.2em', color:'rgba(255,0,204,0.6)' }}>
            {bpmEst ? `${bpmEst} BPM` : 'LISTENING…'}
          </span>
        </div>
      )}

      {/* SECRET ADMIN TAP ZONE */}
      <div onClick={(e) => { e.stopPropagation(); handleSecretTap(); }}
        style={{ position:'absolute', top:0, right:0, width:88, height:88, zIndex:30 }} />

      {/* Device # */}
      {!showJoin && (
        <div style={{
          position:'absolute',
          bottom:'max(10px,env(safe-area-inset-bottom))',
          left:'max(10px,env(safe-area-inset-left))',
          color:'rgba(255,255,255,0.07)', fontSize:9,
          letterSpacing:'0.12em', fontFamily:"'Courier New',monospace",
          pointerEvents:'none',
        }}>
          #{deviceId}
        </div>
      )}

      <style>{`
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}
