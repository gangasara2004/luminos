// ── LUMINOS CANVAS DRAWING ENGINE ─────────────────────────────────────────────
// All rendering logic isolated here for reuse in audience + preview canvases

import { MOSAIC_PALETTES, MOSAIC_PATTERNS } from './constants.js';

export function hexToRgb(hex) {
  if (!hex || hex.length < 7) return { r: 80, g: 80, b: 80 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b)    { return a + Math.random() * (b - a); }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function getDeviceColor(deviceId, totalDevices, spinOffset, state) {
  const palette = state.mosaicPalette === 'CUSTOM'
    ? state.mosaicCustomColors
    : (MOSAIC_PALETTES[state.mosaicPalette] || MOSAIC_PALETTES['SPECTRUM']);
  const patternFn = MOSAIC_PATTERNS[state.mosaicPattern] || MOSAIC_PATTERNS['RANDOM'];
  const effectiveId = Math.abs(Math.floor(deviceId + spinOffset)) % Math.max(totalDevices, 1);
  return patternFn(effectiveId, totalDevices, palette);
}

// ── PARTICLE FACTORY ──────────────────────────────────────────────────────────
export function createParticles(count, W, H) {
  return Array.from({ length: count }, () => ({
    x: rand(0, W), y: rand(0, H),
    vx: rand(-0.6, 0.6), vy: rand(-1.8, -0.3),
    size: rand(1.5, 5),
    life: rand(0, 1), maxLife: rand(0.5, 1),
    hue: rand(200, 330),
  }));
}

export function createLasers(count) {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2,
    speed: rand(0.004, 0.009),
    width: rand(1.5, 3),
    hue: 190 + i * 24,
  }));
}

// ── MAIN DRAW FUNCTION ────────────────────────────────────────────────────────
export function drawFrame(ctx, W, H, t, beatPhase, dt, state, assets, deviceId = 0) {
  const { particles, lasers, shockwaveRef } = assets;
  const br  = clamp(state.brightness / 100, 0, 1);
  const it  = clamp(state.intensity  / 100, 0, 1);
  const bp  = Math.pow(Math.sin(beatPhase * Math.PI), 3); // beat pulse 0..1
  const mode = state.blackout ? 'blackout' : state.mode;

  // ── BLACKOUT
  if (mode === 'blackout') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  ctx.clearRect(0, 0, W, H);
  const rgb  = hexToRgb(state.color);
  const rgb2 = hexToRgb(state.color2);

  // ── MOSAIC MODE
  if (mode === 'mosaic') {
    const TOTAL = 64;
    const myHex = getDeviceColor(deviceId, TOTAL, assets.spinOffset || 0, state);
    const myRgb = hexToRgb(myHex);
    const pA = state.mosaicBeat ? lerp(0.65, 1.0, bp) * br : 0.9 * br;

    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0,   `rgba(${myRgb.r},${myRgb.g},${myRgb.b},${pA})`);
    g.addColorStop(0.65,`rgba(${Math.round(myRgb.r*.65)},${Math.round(myRgb.g*.65)},${Math.round(myRgb.b*.65)},${pA*.9})`);
    g.addColorStop(1,   `rgba(${Math.round(myRgb.r*.15)},${Math.round(myRgb.g*.15)},${Math.round(myRgb.b*.15)},${pA})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Shimmer
    const sh = ctx.createRadialGradient(W * .5, H * .28, 0, W * .5, H * .28, W * .55);
    sh.addColorStop(0, `rgba(255,255,255,${0.14 * br})`);
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);

    // Beat rings
    if (state.mosaicBeat) {
      for (let i = 0; i < 2; i++) {
        const ph = (beatPhase + i * .5) % 1;
        const r  = ph * Math.max(W, H) * .8;
        const a  = (1 - ph) * .55 * br;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 3 * (1 - ph); ctx.stroke();
      }
    }
    drawVignette(ctx, W, H);
    return;
  }

  // ── BACKGROUND LAYER
  switch (mode) {
    case 'wave': {
      const wp = (t * .55) % 2 - .5;
      const wg = ctx.createLinearGradient(0, 0, W, 0);
      wg.addColorStop(Math.max(0, wp - .3), 'rgba(0,0,0,.95)');
      wg.addColorStop(clamp(wp, 0, 1),      `rgba(${rgb.r},${rgb.g},${rgb.b},${br})`);
      wg.addColorStop(clamp(wp + .3, 0, 1), `rgba(${rgb2.r},${rgb2.g},${rgb2.b},${.55 * br})`);
      wg.addColorStop(clamp(wp + .7, 0, 1), 'rgba(0,0,0,.95)');
      ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'strobe': {
      const on = (t * state.strobeSpeed) % 1 > .5;
      ctx.fillStyle = on
        ? `rgba(${rgb.r},${rgb.g},${rgb.b},${br})`
        : 'rgba(0,0,0,.98)';
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'rainbow': {
      const h = (t * 45) % 360;
      const rg = ctx.createLinearGradient(0, 0, W, H);
      rg.addColorStop(0,   `hsla(${h},100%,52%,${br})`);
      rg.addColorStop(.5,  `hsla(${(h+120)%360},100%,45%,${.75*br})`);
      rg.addColorStop(1,   `hsla(${(h+240)%360},100%,38%,${br})`);
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      break;
    }
    default: {
      // pulse, breathing, galaxy, bassdrop, laser, particles
      let a;
      if (mode === 'pulse')     a = lerp(.35, .98, bp) * br;
      else if (mode === 'breathing') a = lerp(.28, .82, (Math.sin(t * state.bpm / 140) + 1) / 2) * br;
      else if (mode === 'bassdrop')  a = lerp(.45, 1.0, bp) * br;
      else a = .85 * br;

      const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H) * .88);
      if (mode === 'galaxy') {
        bg.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
        bg.addColorStop(.45, `rgba(20,0,40,${.9*br})`);
        bg.addColorStop(1,   `rgba(0,0,10,.98)`);
      } else {
        bg.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`);
        bg.addColorStop(.55, `rgba(${rgb2.r},${rgb2.g},${rgb2.b},${a*.38})`);
        bg.addColorStop(1,   'rgba(0,0,5,.97)');
      }
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    }
  }

  // ── GALAXY STARS
  if (mode === 'galaxy' || mode === 'breathing' || mode === 'particles') {
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.508 * 9) % W);
      const sy = ((i * 97.3 * 11)   % H);
      const sz = .4 + (i % 3) * .9;
      const fl = (Math.sin(t * 1.8 + i) + 1) / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, sz * (.5 + fl * .5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${.25 + fl * .75})`;
      ctx.fill();
    }
    if (mode === 'galaxy') {
      const ng = ctx.createRadialGradient(W*.3, H*.4, 0, W*.3, H*.4, W*.55);
      ng.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${.13*br})`);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
      const ng2 = ctx.createRadialGradient(W*.72, H*.62, 0, W*.72, H*.62, W*.4);
      ng2.addColorStop(0, `rgba(${rgb2.r},${rgb2.g},${rgb2.b},${.1*br})`);
      ng2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng2; ctx.fillRect(0, 0, W, H);
    }
  }

  // ── LASERS
  if (mode === 'laser' || mode === 'bassdrop') {
    ctx.save();
    lasers.forEach(l => {
      l.angle += l.speed;
      const cx = W / 2, cy = H * .12;
      const len = Math.sqrt(W * W + H * H);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(l.angle) * len, cy + Math.sin(l.angle) * len);
      ctx.strokeStyle = `hsla(${l.hue},100%,65%,${.55*br*it})`;
      ctx.lineWidth = l.width; ctx.shadowColor = `hsl(${l.hue},100%,70%)`; ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx - Math.cos(l.angle) * len, cy + Math.sin(l.angle) * len);
      ctx.strokeStyle = `hsla(${(l.hue+45)%360},100%,58%,${.38*br*it})`;
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── PARTICLES
  if (mode === 'particles' || mode === 'galaxy' || mode === 'rainbow' || mode === 'breathing') {
    ctx.save();
    particles.forEach(p => {
      p.life += dt * .28;
      if (p.life > p.maxLife) {
        p.life = 0; p.x = rand(0, W); p.y = H + 10;
        p.vx = rand(-0.6, 0.6); p.vy = rand(-1.8, -0.3);
      }
      p.x += p.vx * (1 + bp * 1.8);
      p.y += p.vy * (1 + bp * 1.5);
      const lr = p.life / p.maxLife;
      const a  = Math.sin(lr * Math.PI) * br;
      const h  = mode === 'rainbow' ? (p.hue + t * 35) % 360 : p.hue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - lr * .4), 0, Math.PI * 2);
      ctx.fillStyle    = `hsla(${h},100%,72%,${a})`;
      ctx.shadowColor  = `hsl(${h},100%,80%)`;
      ctx.shadowBlur   = p.size * 3;
      ctx.fill();
    });
    ctx.restore();
  }

  // ── PULSE RINGS
  if (mode === 'pulse' || mode === 'bassdrop') {
    ctx.save();
    const rings = mode === 'bassdrop' ? 5 : 3;
    for (let i = 0; i < rings; i++) {
      const ph = (beatPhase + i / rings) % 1;
      const r  = ph * Math.max(W, H) * .9;
      const a  = (1 - ph) * .65 * br * it;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
      ctx.lineWidth   = 3 * (1 - ph);
      ctx.shadowColor = state.color; ctx.shadowBlur = 18;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── SHOCKWAVE
  if (shockwaveRef && shockwaveRef.current) {
    const sw = shockwaveRef.current;
    const el = (performance.now() - sw.born) / 1000;
    if (el < 0.65) {
      sw.r = (el / 0.65) * sw.maxR;
      const a = (1 - el / 0.65) * .85 * br;
      ctx.save();
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,90,40,${a})`;
      ctx.lineWidth   = 9 * (1 - el / 0.65);
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 45;
      ctx.stroke(); ctx.restore();
    } else {
      shockwaveRef.current = null;
    }
  }

  drawVignette(ctx, W, H);
}

function drawVignette(ctx, W, H) {
  const vig = ctx.createRadialGradient(W/2, H/2, H*.18, W/2, H/2, H*.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// ── PREVIEW MOSAIC GRID ───────────────────────────────────────────────────────
export function drawPreviewGrid(ctx, W, H, t, beatPhase, state, spinOffset) {
  const COLS = 8, ROWS = 8, TOTAL = 64;
  const br = state.brightness / 100;
  const bp = Math.pow(Math.sin(beatPhase * Math.PI), 3);
  const cw = W / COLS, ch = H / ROWS;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const id  = row * COLS + col;
      const hex = getDeviceColor(id, TOTAL, spinOffset, state);
      const rgb = hexToRgb(hex);
      const pulse = state.mosaicBeat ? lerp(.7, 1.0, bp) : .92;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${pulse * br})`;
      ctx.fillRect(col * cw + .5, row * ch + .5, cw - 1, ch - 1);
    }
  }
  // subtle grid lines
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .5;
  for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i*cw,0); ctx.lineTo(i*cw,H); ctx.stroke(); }
  for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0,i*ch); ctx.lineTo(W,i*ch); ctx.stroke(); }
}
