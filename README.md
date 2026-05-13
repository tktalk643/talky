# 🎙 Talky — Real-Time Voice Chat

A voice-only random chat app with WebRTC peer-to-peer audio, a Node.js signaling server, and a free Metered TURN server for production reliability.

---

## 📁 Project Structure

```
talky/
├── server.js          ← Node.js signaling server (Socket.io + TURN API)
├── package.json       ← Dependencies
├── .env.example       ← Copy to .env and fill in your keys
├── .env               ← Your secrets (never commit this)
├── .gitignore
└── public/
    └── index.html     ← Frontend (served by the server)
```

---

## 🔑 Step 1 — Get Free Metered TURN Credentials

Without a TURN server, users behind strict firewalls or corporate NATs can't connect.
Metered offers a **free tier with 500 GB/month** of relay bandwidth.

1. Sign up at **[https://www.metered.ca/stun-turn](https://www.metered.ca/stun-turn)**
2. Create a new app (e.g. `talky`)
3. From your dashboard, copy:
   - **API Key** (looks like `abc123def456...`)
   - **App name** (the subdomain, e.g. `talky` → `talky.metered.live`)
4. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
METERED_API_KEY=your_api_key_here
METERED_APP_NAME=your-app-name
```

> The API key lives only on your server — it is **never sent to the browser**.
> The frontend calls `/api/turn` to get short-lived ICE credentials instead.

---

## 🚀 Run Locally

**1. Install dependencies**
```bash
npm install
```

**2. Start the server**
```bash
npm start
```

**3. Open your browser**
```
http://localhost:3000
```

> Open two browser tabs to test matching between two "users".

---

## ☁️ Deploy to Render (Free)

1. Push this folder to a **GitHub repo** (`.env` is gitignored — don't commit it)
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Set these values:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Add **Environment Variables** in the Render dashboard:
   - `METERED_API_KEY` → your key
   - `METERED_APP_NAME` → your app name
6. Click **Deploy** — Render gives you a live `https://` URL

---

## ☁️ Deploy to Railway (Free)

1. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub**
2. Connect your repo
3. Go to **Variables** tab and add `METERED_API_KEY` and `METERED_APP_NAME`
4. Railway auto-detects Node.js and runs `npm start`
5. Done — live URL provided instantly

---

## ☁️ Deploy to Glitch (Easiest)

1. Go to [glitch.com](https://glitch.com) → **New Project** → Import from GitHub
2. Paste your repo URL
3. Open `.env` in the Glitch editor (private by default) and add your keys
4. Your app is live at `https://your-project-name.glitch.me`

---

## 🔧 How It Works

```
User A                    Talky Server                  User B
  |                            |                           |
  |── GET /api/turn ──────────>|── fetch Metered API       |
  |<── ICE servers ────────────|                           |
  |── find_match ─────────────>|<──────── find_match ──────|
  |<── matched (initiator) ───|── matched (receiver) ────>|
  |── signal (offer) ─────────>|── signal (offer) ────────>|
  |<── signal (answer) ────────|<── signal (answer) ───────|
  |── signal (ICE) ────────────|── signal (ICE) ────────── |
  |                            |                           |
  |<══════ Direct P2P WebRTC Audio (or via TURN relay) ══>|
```

- **STUN** (Google): helps most users connect directly
- **TURN** (Metered): relays audio for users behind strict firewalls/NATs
- Once connected, **all audio is peer-to-peer** — server only handles signaling

---

## ⚠️ Notes

- **Microphone permission** is required — browsers will prompt the user
- Works best on **Chrome or Firefox**
- TURN credentials are **fetched server-side** and cached for 1 hour — your API key is never exposed to the browser
- The app gracefully falls back to STUN-only if TURN credentials are unavailable

---

## 🛠 Tech Stack

| Part | Technology |
|------|-----------|
| Signaling server | Node.js + Express + Socket.io |
| Voice calls | WebRTC (browser native) |
| TURN relay | Metered.ca (free tier) |
| Waiting music | Web Audio API (synthesized) |
| Frontend | Vanilla HTML/CSS/JS |
| Friends storage | localStorage |
