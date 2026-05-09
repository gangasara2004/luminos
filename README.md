# LUMINOS — Concert Phone Light Show System

Synchronized concert phone light show. Audience opens a web link, their phone becomes a live LED panel controlled from the admin dashboard.

**Stack:** React + Vite (frontend) · Node.js + Express + Socket.IO (backend)
**Hosting:** Cloudflare Pages (frontend) + Railway (backend) — both free

---

## PROJECT STRUCTURE

```
luminos/
├── backend/
│   ├── server.js          Express + Socket.IO + bcrypt auth + JWT + rate limiting
│   ├── package.json
│   ├── railway.json       Railway deploy config (auto-detected)
│   ├── Dockerfile         Optional Docker deploy
│   └── .env.example       All environment variables documented
└── frontend/
    ├── src/
    │   ├── App.jsx                  Root router (audience / login / admin)
    │   ├── components/
    │   │   ├── LoginScreen.jsx      Admin login, brute-force protected (5 attempts)
    │   │   ├── AudienceView.jsx     Fullscreen GPU-accelerated canvas
    │   │   ├── AdminDash.jsx        Full control dashboard
    │   │   ├── PreviewCanvas.jsx    Animated live preview
    │   │   ├── MosaicPanel.jsx      Mosaic mode controls + 8x8 crowd map
    │   │   └── AIPanel.jsx          AI preset generator (Claude API)
    │   ├── hooks/
    │   │   ├── useSocket.js         Socket.IO with reconnect + latency compensation
    │   │   └── useWakeLock.js       Screen-on: Wake Lock API + iOS video loop hack
    │   └── utils/
    │       ├── canvas.js            All drawing logic, GPU-accelerated
    │       └── constants.js         Modes, palettes, patterns, defaults
    ├── public/
    │   ├── manifest.json            PWA manifest
    │   ├── _headers                 Cloudflare Pages security headers
    │   └── _redirects               SPA routing fallback
    └── vite.config.js
```

---

## LOCAL DEVELOPMENT

```bash
# Install
npm install --prefix backend
npm install --prefix frontend

# Configure backend
cd backend && cp .env.example .env
# Edit .env: set ADMIN_PASSWORD, JWT_SECRET

# Configure frontend
cd frontend && cp .env.example .env
# VITE_BACKEND_URL=http://localhost:3001 (already the default)

# Run (two terminals)
cd backend  && node server.js       # http://localhost:3001
cd frontend && npm run dev          # http://localhost:3000
```

Admin: tap **ADMIN** button (desktop) or tap top-right corner 5x fast (phone).

---

## DEPLOYMENT: CLOUDFLARE PAGES + RAILWAY

### STEP 1 — Push to GitHub

```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/luminos.git
git push -u origin main
```

---

### STEP 2 — Backend on Railway

**Railway gives $5 free credit/month. This server uses ~$0.30–0.50/month — effectively always free.**

1. Go to **[railway.app](https://railway.app)** → sign up with GitHub
2. **New Project** → **Deploy from GitHub repo** → select your repo
3. If monorepo: Railway prompts for root directory → enter `backend`
4. Go to your service → **Variables** tab → **Raw Editor** → paste:

```env
ADMIN_PASSWORD=your-strong-password
JWT_SECRET=replace-with-64-random-chars
ALLOWED_ORIGINS=https://placeholder.pages.dev
SESSION_ID=luminos-live
NODE_ENV=production
```

> Generate JWT secret:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

5. Railway auto-detects Node.js and runs `node server.js` via `railway.json`
6. Wait ~60s → **Settings** tab → copy your public URL:
   `https://luminos-production-xxxx.up.railway.app`

7. Verify:
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
# {"status":"ok","devices":{"audience":0,"admins":0,"total":0},...}
```

---

### STEP 3 — Frontend on Cloudflare Pages

**Unlimited bandwidth. Global CDN. 300+ edge locations. Always free.**

1. Go to **[pages.cloudflare.com](https://pages.cloudflare.com)** → sign up (no credit card)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Authorize GitHub → select your repo
4. Set build settings:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | `frontend` (if monorepo) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version (env var) | `20` |

5. Add environment variable:

| Name | Value |
|---|---|
| `VITE_BACKEND_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |

> Set for both **Production** and **Preview** environments.

6. **Save and Deploy** → wait ~2 min
7. Your URL: `https://your-app.pages.dev`

---

### STEP 4 — Update Railway CORS

Back in Railway → Variables → update `ALLOWED_ORIGINS` with your real Cloudflare URL:

```env
ALLOWED_ORIGINS=https://your-app.pages.dev
```

Railway redeploys in ~30 seconds. Done — system is fully live.

---

### STEP 5 — Custom Domain (optional, free)

In Cloudflare Pages → your project → **Custom domains** → **Set up a custom domain**.

If your domain is already on Cloudflare: one click.
If not: add a CNAME `your-subdomain → your-app.pages.dev` at your registrar.

Then update Railway:
```env
ALLOWED_ORIGINS=https://your-app.pages.dev,https://luminos.yourdomain.com
```

---

### STEP 6 — Test

1. Open `https://your-app.pages.dev` on your phone → audience view
2. Open on a second device → both sync instantly
3. Tap **ADMIN** or tap top-right 5x on mobile → login
4. Change modes → all phones update in real time

---

## AUTO-DEPLOY ON PUSH

Both platforms redeploy on every `git push main`:
- Railway: backend live in ~30s
- Cloudflare Pages: frontend live in ~90s

```bash
git add . && git commit -m "update" && git push
```

---

## ENVIRONMENT VARIABLES

### backend/.env
| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Plain text (hashed at startup) |
| `ADMIN_PASSWORD_HASH` | Optional | Pre-hashed bcrypt (more secure) |
| `JWT_SECRET` | Yes | Long random string — always change |
| `ALLOWED_ORIGINS` | Yes | Comma-separated Cloudflare URLs |
| `SESSION_ID` | No | WebSocket room (default: luminos-live) |
| `NODE_ENV` | No | Set `production` on Railway |

### frontend/.env
| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Railway URL, no trailing slash |

---

## PRE-HASH YOUR PASSWORD (recommended)

```bash
cd backend
node -e "const b=require('bcryptjs'); console.log(b.hashSync('YOUR_PASSWORD', 12))"
# Copy output → set as ADMIN_PASSWORD_HASH in Railway
# Remove ADMIN_PASSWORD
```

---

## ANIMATION MODES

| Mode | Key | Description |
|---|---|---|
| PULSE | 1 | Screen pulses with BPM |
| STROBE | 2 | Fast flashes, adjustable speed |
| WAVE | 3 | Color wave sweeps left to right |
| BREATHING | 4 | Slow ambient glow |
| GALAXY | 5 | Cosmic nebula + stars |
| LASER | 6 | Rotating neon beams |
| BASS DROP | 7 | Shockwave ripple + flash |
| RAINBOW | 8 | Spectrum cycle |
| PARTICLES | 9 | Floating sparks |
| MOSAIC | M | Each phone unique color |
| BLACKOUT | 0/SPACE | All screens off |

---

## MOSAIC MODE

Devices 0–63 each show a unique color based on palette + pattern.

**Palettes:** SPECTRUM · FIRE & ICE · GALAXY · SUNSET · NEON CITY · OCEAN · FIRE · CUSTOM

**Patterns:** RANDOM · GRADIENT · ZEBRA · CHECKERBOARD · THIRDS · SPIRAL · WAVE MAP · QUADRANTS

Options: Beat Pulse (throb on BPM) · Rotate (colors cycle around crowd)

---

## MOBILE OPTIMIZATIONS

| Feature | iOS | Android |
|---|---|---|
| Screen stays on | Video loop hack | Wake Lock API |
| Notch / safe areas | env() insets | env() insets |
| No keyboard zoom | 16px inputs | 16px inputs |
| Secret admin (5x tap) | Yes | Yes |
| Vibration on drop | Yes | Yes |
| Auto-reconnect | Yes | Yes |
| PWA installable | Yes | Yes |

---

## WEBSOCKET EVENTS

**Server → Client:** `state` (full sync) · `beat` (BPM tick) · `deviceId` · `stats`

**Client → Server:** `adminAuth` · `stateUpdate` (admin) · `beatTick` (admin) · `ping`

---

## TROUBLESHOOTING

| Problem | Fix |
|---|---|
| Phones not syncing | Check `ALLOWED_ORIGINS` matches Cloudflare URL exactly, no trailing slash |
| 502 on Railway | Check logs, confirm `node server.js` start command, PORT not hardcoded |
| Screen dims on iOS | User must tap screen once first (browser security requirement) |
| Admin login "Network error" | First request after idle takes ~10s — wait and retry |
| Cloudflare build fails | Confirm Root directory = `frontend`, Build output = `dist` |
| CORS error in console | Add your exact Cloudflare URL to `ALLOWED_ORIGINS` in Railway and redeploy |

---

## LICENSE

MIT
