// ── useAudioAnalyzer.js ───────────────────────────────────────────────────────
// Captures mic audio, analyzes frequency data and detects beats in real time.
// Works on iOS Safari (with user gesture) and Android Chrome.

import { useRef, useState, useCallback } from 'react';

export function useAudioAnalyzer() {
  const ctxRef       = useRef(null);  // AudioContext
  const analyzerRef  = useRef(null);  // AnalyserNode
  const sourceRef    = useRef(null);  // MediaStreamSource
  const streamRef    = useRef(null);  // MediaStream (mic)
  const rafRef       = useRef(null);  // animation frame
  const dataRef      = useRef(null);  // Uint8Array freq data
  const historyRef   = useRef([]);    // recent energy history for beat detection
  const callbacksRef = useRef({ onBeat: null, onLevel: null });

  const [active,  setActive]  = useState(false);
  const [error,   setError]   = useState(null);
  const [level,   setLevel]   = useState(0);   // 0..1 RMS volume
  const [isBeat,  setIsBeat]  = useState(false);

  // ── ANALYSIS LOOP
  const startLoop = useCallback(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;
    const data = dataRef.current;

    const tick = () => {
      analyzer.getByteFrequencyData(data);

      // ── RMS energy (overall loudness)
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length) / 255;
      setLevel(rms);
      if (callbacksRef.current.onLevel) callbacksRef.current.onLevel(rms);

      // ── Bass energy (bins 0-10 ≈ 0-500 Hz) — best for beat detection
      let bass = 0;
      const bassEnd = Math.floor(data.length * 0.08);
      for (let i = 0; i < bassEnd; i++) bass += data[i];
      bass = bass / bassEnd / 255;

      // ── Beat detection: compare current bass to local average
      const history = historyRef.current;
      history.push(bass);
      if (history.length > 43) history.shift(); // ~1.4s window at 30fps

      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + (b - avg) ** 2, 0) / history.length;
      const threshold = avg + 1.5 * Math.sqrt(variance) + 0.05;

      const beat = bass > threshold && bass > 0.15;
      setIsBeat(beat);
      if (beat && callbacksRef.current.onBeat) callbacksRef.current.onBeat({ bass, rms });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── START MIC
  const start = useCallback(async () => {
    setError(null);
    try {
      // Request mic — triggers browser permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl:  false,
        },
        video: false,
      });
      streamRef.current = stream;

      // Build audio graph
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS requires resume after user gesture
      if (ctx.state === 'suspended') await ctx.resume();
      ctxRef.current = ctx;

      const analyzer = ctx.createAnalyser();
      analyzer.fftSize            = 256;   // 128 frequency bins
      analyzer.smoothingTimeConstant = 0.8; // smooth between frames
      analyzer.minDecibels        = -90;
      analyzer.maxDecibels        = -10;
      analyzerRef.current = analyzer;
      dataRef.current = new Uint8Array(analyzer.frequencyBinCount);

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyzer);
      // NOTE: do NOT connect analyzer to destination — avoids mic feedback
      sourceRef.current = source;

      setActive(true);
      startLoop();
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Allow mic in browser settings.'
        : err.name === 'NotFoundError'
        ? 'No microphone found on this device.'
        : `Mic error: ${err.message}`;
      setError(msg);
    }
  }, [startLoop]);

  // ── STOP MIC
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (sourceRef.current)  sourceRef.current.disconnect();
    if (streamRef.current)  streamRef.current.getTracks().forEach(t => t.stop());
    if (ctxRef.current)     ctxRef.current.close().catch(() => {});
    ctxRef.current = null; analyzerRef.current = null;
    sourceRef.current = null; streamRef.current = null;
    historyRef.current = [];
    setActive(false); setLevel(0); setIsBeat(false);
  }, []);

  // ── REGISTER CALLBACKS
  const onBeat  = useCallback((fn) => { callbacksRef.current.onBeat  = fn; }, []);
  const onLevel = useCallback((fn) => { callbacksRef.current.onLevel = fn; }, []);

  // ── GET RAW FREQUENCY DATA (for visualizer)
  const getFreqData = useCallback(() => dataRef.current, []);

  return { active, error, level, isBeat, start, stop, onBeat, onLevel, getFreqData };
}
