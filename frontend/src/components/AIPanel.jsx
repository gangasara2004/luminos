// ── AIPanel.jsx ───────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { BACKEND_URL } from '../utils/constants.js';

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

const EXAMPLE_PROMPTS = [
  'Opening ceremony: epic, cosmic, slow build',
  'EDM drop: violent flash, electric chaos',
  'Astronomy night: deep space, nebula, calm',
  'Festival peak: rainbow crowd, maximum energy',
  'Slow romantic ballad: warm breathing glow',
];

export default function AIPanel({ state, dispatch, setSeqSteps, showToast }) {
  const [prompt, setPrompt]   = useState('');
  const [loading, setLoading] = useState(false);
  const [preset, setPreset]   = useState(null);

  const generate = async () => {
    if (!prompt.trim()) { showToast('Enter a vibe description', 'warn'); return; }
    if (loading) return;
    setLoading(true);
    setPreset(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a professional concert lighting designer AI for the LUMINOS system.
Generate a complete lighting preset for this vibe/event: "${prompt}"

Available modes: pulse, strobe, wave, breathing, galaxy, laser, bassdrop, rainbow, particles, mosaic, blackout
Available mosaic palettes: SPECTRUM, FIRE & ICE, GALAXY, SUNSET, NEON CITY, OCEAN, FIRE, CUSTOM
Available mosaic patterns: RANDOM, GRADIENT, ZEBRA, CHECKERBOARD, THIRDS, SPIRAL, WAVE MAP, QUADRANTS

Respond ONLY with a single valid JSON object. No markdown, no code blocks, no explanation:
{
  "name": "PRESET NAME IN CAPS",
  "mode": "pulse",
  "color": "#ff00cc",
  "color2": "#00d4ff",
  "bpm": 128,
  "brightness": 90,
  "intensity": 80,
  "mosaicPalette": "SPECTRUM",
  "mosaicPattern": "GRADIENT",
  "mosaicBeat": true,
  "mosaicRotate": false,
  "mosaicRotateSpeed": 1,
  "description": "One evocative sentence about this lighting design.",
  "sequence": [
    { "mode": "breathing", "color": "#8b00ff", "bpm": 80, "duration": 8 },
    { "mode": "pulse",     "color": "#ff00cc", "bpm": 128, "duration": 16 },
    { "mode": "bassdrop",  "color": "#ff1122", "bpm": 160, "duration": 8 }
  ]
}

The sequence should have 3-6 steps that build dramatically toward the climax.`
          }],
        }),
      });

      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text || '';
      // Strip any accidental markdown
      const clean = text.replace(/```json|```/g, '').trim();
      const p = JSON.parse(clean);
      setPreset(p);
      showToast(`AI preset ready: ${p.name}`);
    } catch (err) {
      showToast('AI generation failed. Check console.', 'error');
      console.error('AI error:', err);
    }
    setLoading(false);
  };

  const applyPreset = () => {
    if (!preset) return;
    dispatch({
      mode: preset.mode,
      color: preset.color,
      color2: preset.color2,
      bpm: preset.bpm,
      brightness: preset.brightness,
      intensity: preset.intensity,
      mosaicPalette: preset.mosaicPalette || 'SPECTRUM',
      mosaicPattern: preset.mosaicPattern || 'RANDOM',
      mosaicBeat: preset.mosaicBeat || false,
      mosaicRotate: preset.mosaicRotate || false,
      mosaicRotateSpeed: preset.mosaicRotateSpeed || 1,
    });
    if (preset.sequence) {
      setSeqSteps(preset.sequence.map(s => ({ ...s, color: s.color || preset.color })));
    }
    showToast(`Applied: ${preset.name}`);
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)' }}>AI PRESET GENERATOR</div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', lineHeight: 1.7 }}>
        Describe the energy, theme, or moment — AI generates a complete lighting design including mode, colors, BPM, and a full show sequence.
      </div>

      {/* Example prompts */}
      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>EXAMPLES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {EXAMPLE_PROMPTS.map(p => (
            <button key={p} onClick={() => setPrompt(p)}
              style={{ ...btn(prompt === p), padding: '6px 10px', fontSize: 9, textAlign: 'left', letterSpacing: '0.05em' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); }}
        placeholder="Describe the vibe, event, or mood…"
        style={{ minHeight: 72, fontSize: 13 }}
      />

      {/* Generate button */}
      <button onClick={generate} disabled={loading || !prompt.trim()}
        style={{
          ...btn(false, '#8b00ff'), padding: 13, fontSize: 12, fontWeight: 700,
          letterSpacing: '0.15em', opacity: loading || !prompt.trim() ? 0.6 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
        {loading
          ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> GENERATING…</>
          : '✦ GENERATE WITH AI  (CTRL+ENTER)'}
      </button>

      {/* Result */}
      {preset && (
        <div style={{
          background: 'rgba(139,0,255,0.08)', border: '1px solid rgba(139,0,255,0.3)',
          borderRadius: 10, padding: 14, animation: 'fadeIn .3s ease',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8b00ff', letterSpacing: '0.18em', marginBottom: 5, textShadow: '0 0 15px #8b00ff88' }}>
            {preset.name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 12, lineHeight: 1.6 }}>
            {preset.description}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            {[
              ['MODE',   preset.mode?.toUpperCase()],
              ['BPM',    preset.bpm],
              ['BRIGHT', preset.brightness + '%'],
              ['INTENS', preset.intensity + '%'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Color swatches */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: preset.color, boxShadow: `0 0 12px ${preset.color}` }} />
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: preset.color2, boxShadow: `0 0 12px ${preset.color2}` }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>PRIMARY · SECONDARY</span>
          </div>

          {/* Sequence preview */}
          {preset.sequence && (
            <>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)', marginBottom: 7 }}>
                SEQUENCE · {preset.sequence.length} STEPS
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {preset.sequence.map((s, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '7px 3px', textAlign: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color || preset.color, margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>{s.mode}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{s.duration}s</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={applyPreset}
            style={{ ...btn(false, '#8b00ff'), width: '100%', padding: 11, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}>
            ▶ APPLY PRESET + LOAD SEQUENCE
          </button>
        </div>
      )}
    </div>
  );
}
