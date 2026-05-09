// ── LUMINOS CONSTANTS ─────────────────────────────────────────────────────────

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const ANIMATION_MODES = [
  { id: 'pulse',     icon: '⬤',  label: 'PULSE',    desc: 'Bass-synced heartbeat' },
  { id: 'strobe',    icon: '⚡',  label: 'STROBE',   desc: 'Drop flashes' },
  { id: 'wave',      icon: '〜',  label: 'WAVE',     desc: 'Arena ripple' },
  { id: 'breathing', icon: '◎',  label: 'BREATHE',  desc: 'Cinematic ambient' },
  { id: 'galaxy',    icon: '✦',  label: 'GALAXY',   desc: 'Cosmic nebula' },
  { id: 'laser',     icon: '▸',  label: 'LASER',    desc: 'Neon beams' },
  { id: 'bassdrop',  icon: '💥', label: 'DROP',     desc: 'Shockwave impact' },
  { id: 'rainbow',   icon: '◈',  label: 'RAINBOW',  desc: 'Spectrum cycle' },
  { id: 'particles', icon: '·',  label: 'SPARKS',   desc: 'Floating particles' },
  { id: 'mosaic',    icon: '⊞',  label: 'MOSAIC',   desc: 'Each phone unique color' },
  { id: 'blackout',  icon: '■',  label: 'DARK',     desc: 'Emergency off' },
];

export const COLOR_PRESETS = [
  { c: '#00d4ff', g: '#0088ff', n: 'ELECTRIC' },
  { c: '#ff00cc', g: '#cc0099', n: 'MAGENTA'  },
  { c: '#8b00ff', g: '#6600cc', n: 'COSMIC'   },
  { c: '#39ff14', g: '#00cc00', n: 'NEON'     },
  { c: '#ffaa00', g: '#ff7700', n: 'SOLAR'    },
  { c: '#ff1122', g: '#cc0011', n: 'RED'      },
  { c: '#ffffff', g: '#aaddff', n: 'WHITE'    },
  { c: '#00ffee', g: '#00ccbb', n: 'CYAN'     },
];

export const MOSAIC_PALETTES = {
  'SPECTRUM':    ['#ff1122','#ff6600','#ffcc00','#39ff14','#00d4ff','#8b00ff','#ff00cc','#ffffff'],
  'FIRE & ICE':  ['#ff1122','#ff4400','#ff8800','#ffaa00','#00aaff','#0044ff','#0011cc','#00d4ff'],
  'GALAXY':      ['#0d0020','#2a0060','#5500cc','#8b00ff','#00d4ff','#0088ff','#ff00cc','#ffffff'],
  'SUNSET':      ['#ff0066','#ff3300','#ff6600','#ffaa00','#ffdd00','#ff00aa','#cc0088','#880044'],
  'NEON CITY':   ['#ff00cc','#cc00ff','#0000ff','#00ccff','#00ffcc','#00ff66','#ffff00','#ff6600'],
  'OCEAN':       ['#001133','#002266','#0044aa','#0088cc','#00aadd','#00ccee','#00eeff','#88ffff'],
  'FIRE':        ['#1a0000','#4d0000','#990000','#cc2200','#ff4400','#ff7700','#ffaa00','#ffff00'],
  'CUSTOM':      ['#ff1122','#ff00cc','#8b00ff','#00d4ff','#39ff14','#ffaa00','#ffffff','#ff6600'],
};

export const MOSAIC_PATTERNS = {
  'RANDOM':       (id, total, palette) => palette[id % palette.length],
  'GRADIENT':     (id, total, palette) => palette[Math.floor((id / total) * palette.length)],
  'ZEBRA':        (id, total, palette) => palette[id % 2],
  'CHECKERBOARD': (id, total, palette) => { const cols=8; return palette[((id%cols)+Math.floor(id/cols))%2]; },
  'THIRDS':       (id, total, palette) => { const t=Math.floor(id/(total/3)); return palette[Math.min(t,palette.length-1)]; },
  'SPIRAL':       (id, total, palette) => palette[Math.floor((id*3)%palette.length)],
  'WAVE MAP':     (id, total, palette) => palette[Math.abs(Math.floor(Math.sin(id*0.5)*3.9))%palette.length],
  'QUADRANTS':    (id, total, palette) => { const cols=8; const row=Math.floor(id/cols); const col=id%cols; return palette[(row<4?0:2)+(col<4?0:1)]; },
};

export const SHOW_PRESETS = [
  { name: 'OPENING',     mode: 'breathing', color: '#00d4ff', color2: '#8b00ff', bpm: 100 },
  { name: 'EDM DROP',    mode: 'bassdrop',  color: '#ff00cc', color2: '#ff1122', bpm: 174 },
  { name: 'GALAXY NIGHT',mode: 'galaxy',    color: '#8b00ff', color2: '#00d4ff', bpm: 75  },
  { name: 'MOSAIC CROWD',mode: 'mosaic',    color: '#ff00cc', color2: '#00d4ff', bpm: 128 },
  { name: 'FESTIVAL',    mode: 'rainbow',   color: '#ffaa00', color2: '#ff00cc', bpm: 140 },
  { name: 'FINALE',      mode: 'strobe',    color: '#ffffff', color2: '#ffaa00', bpm: 160 },
];

export const DEFAULT_STATE = {
  mode: 'breathing',
  color: '#8b00ff',
  color2: '#00d4ff',
  bpm: 128,
  brightness: 88,
  intensity: 75,
  blackout: false,
  strobeSpeed: 9,
  mosaicPalette: 'SPECTRUM',
  mosaicPattern: 'RANDOM',
  mosaicBeat: false,
  mosaicRotate: false,
  mosaicRotateSpeed: 1,
  mosaicCustomColors: ['#ff1122','#ff00cc','#8b00ff','#00d4ff','#39ff14','#ffaa00','#ffffff','#ff6600'],
};

export const KB_SHORTCUTS = [
  ['SPACE / B', 'Toggle Blackout'],
  ['M',         'Mosaic Mode'],
  ['1',         'Pulse'],
  ['2',         'Strobe'],
  ['3',         'Wave'],
  ['4',         'Breathing'],
  ['5',         'Galaxy'],
  ['6',         'Laser'],
  ['7',         'Bass Drop'],
  ['8',         'Rainbow'],
  ['9',         'Particles'],
  ['0',         'Blackout'],
];
