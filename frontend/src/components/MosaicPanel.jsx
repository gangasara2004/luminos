// ── MosaicPanel.jsx ───────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { MOSAIC_PALETTES, MOSAIC_PATTERNS } from '../utils/constants.js';
import { getDeviceColor } from '../utils/canvas.js';

function btn(active, color = '#00d4ff') {
  return {
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
    color: active ? color : 'rgba(255,255,255,0.55)',
    borderRadius: 8, cursor: 'pointer',
    fontFamily: "'Courier New', monospace", letterSpacing: '0.08em',
    transition: 'all .17s', outline: 'none',
    minHeight: 36, touchAction: 'manipulation',
  };
}

const G = {
  glass: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
};

const TOTAL = 64;

export default function MosaicPanel({ state, dispatch, showToast }) {
  const [spinOffset] = useState(0);

  const updateCustomColor = (i, val) => {
    const cols = [...state.mosaicCustomColors];
    cols[i] = val;
    dispatch({ mosaicCustomColors: cols });
  };

  const patternFn = MOSAIC_PATTERNS[state.mosaicPattern] || MOSAIC_PATTERNS['RANDOM'];
  const palette   = state.mosaicPalette === 'CUSTOM'
    ? state.mosaicCustomColors
    : (MOSAIC_PALETTES[state.mosaicPalette] || MOSAIC_PALETTES['SPECTRUM']);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ ...G.glass, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Activate button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)' }}>MOSAIC MODE</div>
          <button onClick={() => { dispatch({ mode: 'mosaic' }); showToast('Mosaic activated'); }}
            style={{ ...btn(state.mode === 'mosaic', '#ff00cc'), padding: '7px 14px', fontSize: 10, fontWeight: 700 }}>
            ⊞ {state.mode === 'mosaic' ? 'ACTIVE' : 'ACTIVATE'}
          </button>
        </div>

        {/* Info */}
        <div style={{ background: 'rgba(255,0,200,0.06)', border: '1px solid rgba(255,0,200,0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 10, color: 'rgba(255,255,255,0.42)', lineHeight: 1.7 }}>
          Each phone gets a <span style={{ color: '#ff00cc' }}>unique color slot</span> (0–63) based on their device number. The crowd forms a living color mosaic visible from stage.
        </div>

        {/* Palette selector */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.32)', marginBottom: 8 }}>COLOR PALETTE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {Object.keys(MOSAIC_PALETTES).map(name => (
              <button key={name} onClick={() => dispatch({ mosaicPalette: name })}
                style={{ ...btn(state.mosaicPalette === name), padding: '7px 4px', fontSize: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {MOSAIC_PALETTES[name].slice(0, 4).map((c, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: 7, letterSpacing: '0.04em' }}>{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pattern selector */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.32)', marginBottom: 8 }}>DISTRIBUTION PATTERN</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {Object.keys(MOSAIC_PATTERNS).map(name => (
              <button key={name} onClick={() => dispatch({ mosaicPattern: name })}
                style={{ ...btn(state.mosaicPattern === name), padding: '7px 4px', fontSize: 8, width: '100%', letterSpacing: '0.05em' }}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Beat + Rotate toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => dispatch({ mosaicBeat: !state.mosaicBeat })}
            style={{ ...btn(state.mosaicBeat, '#ff00cc'), padding: '9px 8px', fontSize: 10 }}>
            ♪ BEAT PULSE
          </button>
          <button onClick={() => dispatch({ mosaicRotate: !state.mosaicRotate })}
            style={{ ...btn(state.mosaicRotate, '#ffaa00'), padding: '9px 8px', fontSize: 10 }}>
            ↻ ROTATE
          </button>
        </div>

        {/* Rotate speed */}
        {state.mosaicRotate && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.38)' }}>ROTATE SPEED</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ffaa00' }}>{state.mosaicRotateSpeed.toFixed(1)}x</span>
            </div>
            <input type="range" min={0.1} max={8} step={0.1} value={state.mosaicRotateSpeed}
              onInput={e => dispatch({ mosaicRotateSpeed: parseFloat(e.target.value) })}
              style={{ accentColor: '#ffaa00' }} />
          </div>
        )}

        {/* Custom palette */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.32)' }}>CUSTOM PALETTE (8 COLORS)</div>
            <button onClick={() => dispatch({ mosaicPalette: 'CUSTOM' })}
              style={{ ...btn(state.mosaicPalette === 'CUSTOM'), padding: '4px 10px', fontSize: 9 }}>
              USE
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {state.mosaicCustomColors.map((c, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <input type="color" value={c} onInput={e => updateCustomColor(i, e.target.value)}
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', padding: 2 }} />
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Crowd Map (8×8 grid) */}
      <div style={{ ...G.glass, padding: 13 }}>
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.32)', marginBottom: 8 }}>
          CROWD MAP  ·  8 × 8 = 64 DEVICES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {Array.from({ length: TOTAL }, (_, id) => {
            const hex = getDeviceColor(id, TOTAL, spinOffset, state);
            return (
              <div
                key={id}
                title={`Device #${id}`}
                style={{
                  aspectRatio: '1',
                  background: hex,
                  opacity: state.mode === 'mosaic' ? 0.92 : 0.38,
                  transition: 'opacity .3s',
                }}
              />
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'center', letterSpacing: '0.12em' }}>
          Each cell = one phone · Pattern: {state.mosaicPattern}
        </div>
      </div>
    </div>
  );
}
