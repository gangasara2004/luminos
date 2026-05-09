require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// ── CORS ORIGINS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

// ── SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

// ── MIDDLEWARE
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// ── RATE LIMITING
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── CONFIG
const JWT_SECRET = process.env.JWT_SECRET || 'luminos-secret-change-in-production';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
const SESSION_ID = process.env.SESSION_ID || 'luminos-live';

// ── SHOW STATE (server-authoritative)
let showState = {
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
  serverTime: Date.now(),
};

// ── CONNECTED DEVICES
const connectedDevices = new Map(); // socketId -> { role, deviceId, joinedAt }
let deviceCounter = 0;

function getStats() {
  const audience = [...connectedDevices.values()].filter(d => d.role === 'audience').length;
  const admins = [...connectedDevices.values()].filter(d => d.role === 'admin').length;
  return { audience, admins, total: audience + admins };
}

// ── AUTH MIDDLEWARE for REST
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── ROUTES

// Health check (for free hosting keep-alive)
app.get('/', (req, res) => res.json({ status: 'ok', service: 'luminos', uptime: process.uptime() }));
app.get('/health', (req, res) => res.json({ status: 'ok', devices: getStats(), state: showState }));

// Admin login
app.post('/api/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, expiresIn: 43200 });
});

// Verify token
app.get('/api/verify', requireAuth, (req, res) => res.json({ valid: true }));

// Get current state (admin only)
app.get('/api/state', requireAuth, (req, res) => res.json({ state: showState, stats: getStats() }));

// Update state via REST (fallback for slow connections)
app.post('/api/state', requireAuth, (req, res) => {
  const patch = req.body;
  Object.assign(showState, patch, { serverTime: Date.now() });
  io.to(SESSION_ID).emit('state', showState);
  res.json({ ok: true, state: showState });
});

// ── SOCKET.IO
io.on('connection', (socket) => {
  const deviceId = deviceCounter++;

  // Assign audience role by default
  connectedDevices.set(socket.id, { role: 'audience', deviceId, joinedAt: Date.now() });
  socket.join(SESSION_ID);

  // Send current state immediately
  socket.emit('state', { ...showState, serverTime: Date.now() });
  socket.emit('deviceId', { id: deviceId % 64 });

  // Broadcast updated count
  io.to(SESSION_ID).emit('stats', getStats());

  // ── ADMIN AUTH via socket
  socket.on('adminAuth', ({ token }) => {
    try {
      jwt.verify(token, JWT_SECRET);
      connectedDevices.set(socket.id, { role: 'admin', deviceId, joinedAt: Date.now() });
      socket.emit('adminAuthResult', { ok: true });
      io.to(SESSION_ID).emit('stats', getStats());
    } catch {
      socket.emit('adminAuthResult', { ok: false, error: 'Invalid token' });
    }
  });

  // ── STATE UPDATE (admin only)
  socket.on('stateUpdate', (patch) => {
    const device = connectedDevices.get(socket.id);
    if (!device || device.role !== 'admin') {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }
    Object.assign(showState, patch, { serverTime: Date.now() });
    // Broadcast to ALL in session including sender
    io.to(SESSION_ID).emit('state', showState);
  });

  // ── BEAT TICK (admin triggers, server broadcasts with timestamp)
  socket.on('beatTick', () => {
    const device = connectedDevices.get(socket.id);
    if (!device || device.role !== 'admin') return;
    io.to(SESSION_ID).emit('beat', { t: Date.now() });
  });

  // ── DISCONNECT
  socket.on('disconnect', () => {
    connectedDevices.delete(socket.id);
    io.to(SESSION_ID).emit('stats', getStats());
  });
});

// ── SERVER BPM CLOCK (server-side beat broadcast)
let beatInterval = null;
function startBeatClock() {
  if (beatInterval) clearInterval(beatInterval);
  if (showState.bpm <= 0) return;
  const interval = Math.round((60 / showState.bpm) * 1000);
  beatInterval = setInterval(() => {
    io.to(SESSION_ID).emit('beat', { t: Date.now() });
  }, interval);
}
startBeatClock();

// Restart clock when BPM changes
setInterval(() => {
  const expected = Math.round((60 / showState.bpm) * 1000);
  const actual = beatInterval ? beatInterval._idleTimeout : 0;
  if (Math.abs(expected - actual) > 20) startBeatClock();
}, 2000);

// ── START
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎵 LUMINOS backend running on port ${PORT}`);
  console.log(`   Session: ${SESSION_ID}`);
  console.log(`   Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   Admin password hash configured: ${!!ADMIN_PASSWORD_HASH}`);
});
