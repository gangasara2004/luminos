// ── AdminDash.jsx ─────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket }   from '../hooks/useSocket.js';
import PreviewCanvas   from './PreviewCanvas.jsx';
import MosaicPanel     from './MosaicPanel.jsx';
import AIPanel         from './AIPanel.jsx';
import { ANIMATION_MODES, COLOR_PRESETS, SHOW_PRESETS, KB_SHORTCUTS } from '../utils/constants.js';

const G = {
  glass: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
};

function btn(active, color = '#00d4ff', extra = {}) {
  return {
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
    color: active ? color : 'rgba(255,255,255,0.58)',
    borderRadius: 8, cursor: 'pointer',
    fontFamily: "'Courier New', monospace",
    letterSpacing: '0.08em', transition: 'all 0.17s',
    boxShadow: active ? `0 0 16px ${color}33` : 'none',
    outline: 'none', minHeight: 36, touchAction: 'manipulation',
    ...extra,
  };
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  return { toast, show };
}

export default function AdminDash({ token, onLogout, onGoAudience }) {
  const { connected, state, stats, latency, dispatch } = useSocket({ role: 'admin', token });
  const { toast, show: showToast } = useToast();
  const [activeTab, setActiveTab]   = useState(0);
  const [seqSteps, setSeqSteps]     = useState([]);
  const [seqRunning, setSeqRunning] = useState(false);
  const [seqIdx, setSeqIdx]         = useState(0);
  const seqTimerRef = useRef(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const map = {
        ' ':  () => dispatch({ blackout: !state.blackout }),
        'b':  () => dispatch({ blackout: !state.blackout }),
        'm':  () => dispatch({ mode: 'mosaic' }),
        '1':  () => dispatch({ mode: 'pulse' }),
        '2':  () => dispatch({ mode: 'strobe' }),
        '3':  () => dispatch({ mode: 'wave' }),
        '4':  () => dispatch({ mode: 'breathing' }),
        '5':  () => dispatch({ mode: 'galaxy' }),
        '6':  () => dispatch({ mode: 'laser' }),
        '7':  () => dispatch({ mode: 'bassdrop' }),
        '8':  () => dispatch({ mode: 'rainbow' }),
        '9':  () => dispatch({ mode: 'particles' }),
        '0':  () => dispatch({ mode: 'blackout' }),
      };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.blackout, dispatch]);

  // Sequence
  const runSeq = useCallback(() => {
    if (!seqSteps.length) { showToast('Add steps first', 'warn'); return; }
    setSeqRunning(true); let i = 0;
    const step = () => {
      if (i >= seqSteps.length) { setSeqRunning(false); setSeqIdx(0); return; }
      const s = seqSteps[i];
      dispatch({ mode: s.mode, color: s.color, bpm: s.bpm });
      setSeqIdx(i); i++;
      seqTimerRef.current = setTimeout(step, s.duration * 1000);
    };
    step();
  }, [seqSteps, dispatch, showToast]);

  const stopSeq = useCallback(() => { clearTimeout(seqTimerRef.current); setSeqRunning(false); }, []);
  const addSeqStep  = (mode) => setSeqSteps(p => [...p, { mode, color: state.color, bpm: state.bpm, duration: 8 }]);
  const removeSeqStep = (i) => setSeqSteps(p => p.filter((_, j) => j !== i));

  const TABS = ['CONTROL', 'MOSAIC ⊞', 'SEQUENCE', 'AI ✦', 'KEYS'];

  return (
    <div style={{
      /* KEY: fixed + overflow scroll = proper mobile scroll without body scroll issues */
      position: 'fixed', inset: 0,
      background: '#030308',
      backgroundImage: 'radial-gradient(ellipse at 20% 20%,rgba(139,0,255,0.07) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(0,212,255,0.05) 0%,transparent 60%)',
      color: '#fff', fontFamily: "'Courier New', monospace",
      overflowY: 'scroll',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      paddingTop:    'max(14px, env(safe-area-inset-top))',
      paddingBottom: 'max(40px, env(safe-area-inset-bottom))',
      paddingLeft:   'max(14px, env(safe-area-inset-left))',
      paddingRight:  'max(14px, env(safe-area-inset-right))',
      boxSizing: 'border-box',
    }}>

      {/* TOAST */}
      {toast && (
        <div key={toast.id} style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toast.type==='error' ? 'rgba(255,20,20,0.95)' : toast.type==='warn' ? 'rgba(255,150,0,0.95)' : 'rgba(0,212,255,0.95)',
          color: '#000', padding: '10px 20px', borderRadius: 8,
          fontSize: 11, letterSpacing: '0.12em',
          fontFamily: "'Courier New', monospace",
          animation: 'slideDown .3s ease',
          maxWidth: 'calc(100vw - 32px)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 'clamp(1.1rem,4vw,1.7rem)', fontWeight: 900, letterSpacing: '0.22em', color: '#00d4ff', textShadow: '0 0 24px #00d4ff88' }}>LUMINOS</div>
          <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>CONCERT LIGHT CONTROL</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...G.glass, padding: '5px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#39ff14' : '#ff4400', boxShadow: `0 0 10px ${connected?'#39ff14':'#ff4400'}`, animation: 'blink 2s infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}>
              {connected ? `${stats.audience} LIVE · ${latency}ms` : 'OFFLINE'}
            </span>
          </div>
          <button onClick={onGoAudience} style={{ ...btn(false,'#39ff14'), padding: '8px 14px', fontSize: 11, fontWeight: 700 }}>▶ AUDIENCE</button>
          <button onClick={onLogout}     style={{ ...btn(false,'#ff1122'), padding: '8px 14px', fontSize: 11 }}>⎋ LOGOUT</button>
        </div>
      </div>

      {/* BLACKOUT */}
      <button onClick={() => dispatch({ blackout: !state.blackout })} style={{
        width: '100%', padding: 13, marginBottom: 14,
        background: state.blackout ? 'rgba(255,17,34,0.22)' : 'rgba(255,255,255,0.03)',
        border: `2px solid ${state.blackout ? '#ff1122' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 10,
        color: state.blackout ? '#ff4455' : 'rgba(255,255,255,0.38)',
        fontSize: 12, letterSpacing: '0.25em', cursor: 'pointer',
        fontFamily: "'Courier New', monospace",
        boxShadow: state.blackout ? '0 0 28px rgba(255,17,34,0.28)' : 'none',
        transition: 'all .2s',
      }}>
        {state.blackout ? '⬛ BLACKOUT ACTIVE — TAP TO RESTORE' : '⬛ EMERGENCY BLACKOUT  [SPACE]'}
      </button>


      {/* BEAT MODE TOGGLE */}
      <button
        onClick={() => dispatch({ beatMode: !state.beatMode })}
        style={{
          width: '100%', padding: 13, marginBottom: 14,
          background: state.beatMode ? 'rgba(255,0,204,0.2)' : 'rgba(255,255,255,0.03)',
          border: `2px solid ${state.beatMode ? '#ff00cc' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          color: state.beatMode ? '#ff00cc' : 'rgba(255,255,255,0.38)',
          fontSize: 12, letterSpacing: '0.25em', cursor: 'pointer',
          fontFamily: "'Courier New', monospace",
          boxShadow: state.beatMode ? '0 0 28px rgba(255,0,204,0.3)' : 'none',
          transition: 'all .2s',
        }}
      >
        {state.beatMode ? '♪ BEAT MODE ACTIVE — TAP TO DISABLE' : '♪ ENABLE BEAT MODE  (MIC REACTIVE)'}
      </button>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 13 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ ...G.glass, padding: 13 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginBottom: 9 }}>LIVE PREVIEW</div>
            <PreviewCanvas state={state} />
          </div>

          <div style={{ ...G.glass, padding: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['MODE',state.mode.toUpperCase()],['BPM',state.bpm],['BRIGHT',state.brightness+'%'],['DEVICES',stats.audience]].map(([l,v]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: l==='DEVICES'?'#39ff14':'#00d4ff' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ ...G.glass, padding: 13 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginBottom: 9 }}>SHOW PRESETS</div>
            {SHOW_PRESETS.map(p => (
              <button key={p.name} onClick={() => { dispatch({ mode:p.mode, color:p.color, color2:p.color2, bpm:p.bpm }); showToast(`Loaded: ${p.name}`); }}
                style={{ ...btn(false), padding: '8px 11px', fontSize: 10, textAlign: 'left', width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span>{p.name}</span><span style={{ opacity:.38, fontSize:9 }}>{p.bpm}BPM</span>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setActiveTab(i)}
                style={{ ...btn(activeTab===i), padding: '6px 10px', fontSize: 9, letterSpacing: '0.1em', flex: 1, minWidth: 55 }}>
                {t}
              </button>
            ))}
          </div>

          {/* TAB 0: CONTROL */}
          {activeTab === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ ...G.glass, padding: 13 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginBottom: 9 }}>ANIMATION MODE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  {ANIMATION_MODES.map(m => (
                    <button key={m.id} onClick={() => dispatch({ mode: m.id })}
                      style={{ ...btn(state.mode===m.id), padding: '8px 3px', fontSize: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '100%', fontWeight: state.mode===m.id?700:400 }}>
                      <span style={{ fontSize: 15 }}>{m.icon}</span><span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...G.glass, padding: 13 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginBottom: 9 }}>COLOUR PALETTE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 10 }}>
                  {COLOR_PRESETS.map(c => (
                    <button key={c.c} onClick={() => dispatch({ color: c.c })}
                      style={{ ...btn(state.color===c.c, c.c), padding: '8px 4px', fontSize: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: c.c, boxShadow: `0 0 10px ${c.g}` }} />
                      <span>{c.n}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)' }}>
                    PRIMARY
                    <input type="color" value={state.color} onInput={e => dispatch({ color: e.target.value })}
                      style={{ display: 'block', width: '100%', height: 28, marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)' }}>
                    SECONDARY
                    <input type="color" value={state.color2} onInput={e => dispatch({ color2: e.target.value })}
                      style={{ display: 'block', width: '100%', height: 28, marginTop: 4 }} />
                  </label>
                </div>
              </div>

              <div style={{ ...G.glass, padding: 13, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label:'BPM',        key:'bpm',         min:40,  max:220, step:1,   color:'#ff00cc', fmt:v=>v },
                  { label:'BRIGHTNESS', key:'brightness',  min:5,   max:100, step:1,   color:'#ffaa00', fmt:v=>v+'%' },
                  { label:'INTENSITY',  key:'intensity',   min:10,  max:100, step:1,   color:'#00d4ff', fmt:v=>v+'%' },
                  { label:'STROBE SPD', key:'strobeSpeed', min:2,   max:30,  step:0.5, color:'#ff1122', fmt:v=>v+'x' },
                ].map(sl => (
                  <div key={sl.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.38)' }}>{sl.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sl.color }}>{sl.fmt(state[sl.key])}</span>
                    </div>
                    <input type="range" min={sl.min} max={sl.max} step={sl.step} value={state[sl.key]}
                      onInput={e => dispatch({ [sl.key]: parseFloat(e.target.value) })}
                      style={{ accentColor: sl.color }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: MOSAIC */}
          {activeTab === 1 && <MosaicPanel state={state} dispatch={dispatch} showToast={showToast} />}

          {/* TAB 2: SEQUENCE */}
          {activeTab === 2 && (
            <div style={{ ...G.glass, padding: 13, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)' }}>TIMELINE SEQUENCER</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {seqSteps.length === 0
                  ? <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: '0.2em' }}>NO STEPS YET</div>
                  : seqSteps.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', marginBottom: 5,
                      background: seqRunning && seqIdx===i ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                      borderRadius: 6, border: `1px solid ${seqRunning && seqIdx===i ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, flex: 1, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.1em' }}>
                        {s.mode.toUpperCase()} · {s.bpm}BPM · {s.duration}s
                      </span>
                      <button onClick={() => removeSeqStep(i)} style={{ ...btn(false,'#ff1122'), padding: '2px 8px', fontSize: 10 }}>×</button>
                    </div>
                  ))
                }
              </div>
              <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)' }}>ADD STEP</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {['pulse','wave','galaxy','laser','bassdrop','rainbow','breathing','strobe','mosaic'].map(m => (
                  <button key={m} onClick={() => addSeqStep(m)} style={{ ...btn(false), padding: '7px 4px', fontSize: 9 }}>
                    + {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={seqRunning ? stopSeq : runSeq}
                  style={{ ...btn(!seqRunning, seqRunning?'#ff1122':'#39ff14'), flex:1, padding:10, fontSize:11, fontWeight:700 }}>
                  {seqRunning ? '⬛ STOP' : '▶ RUN SEQUENCE'}
                </button>
                <button onClick={() => setSeqSteps([])} style={{ ...btn(false,'#ff1122'), padding:'10px 14px', fontSize:11 }}>CLR</button>
              </div>
            </div>
          )}

          {/* TAB 3: AI */}
          {activeTab === 3 && <AIPanel state={state} dispatch={dispatch} setSeqSteps={setSeqSteps} showToast={showToast} />}

          {/* TAB 4: KEYS */}
          {activeTab === 4 && (
            <div style={{ ...G.glass, padding: 13 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', marginBottom: 14 }}>KEYBOARD SHORTCUTS</div>
              {KB_SHORTCUTS.map(([k, d]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <kbd style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 5, padding: '3px 10px', fontSize: 11, color: '#00d4ff', fontFamily: "'Courier New', monospace" }}>{k}</kbd>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>{d}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
                📱 Mobile: Tap top-right corner 5× fast to open admin login.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
