# 🎙 Talky — Real-Time Voice Chat

A voice-only random chat app with WebRTC peer-to-peer audio and a Node.js signaling server.

---

## 📁 Project Structure

```
talky/
├── server.js          ← Node.js signaling server (Socket.io)
├── package.json       ← Dependencies
└── public/
    └── index.html     ← Frontend (served by the server)
```

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

1. Push this folder to a **GitHub repo**
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Set these values:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click **Deploy** — Render gives you a live `https://` URL

---

## ☁️ Deploy to Railway (Free)

1. Go to [railway.app](https://railway.app) → New Project → **Deploy from GitHub**
2. Connect your repo
3. Railway auto-detects Node.js and runs `npm start`
4. Done — live URL provided instantly

---

## ☁️ Deploy to Glitch (Easiest)

1. Go to [glitch.com](https://glitch.com) → **New Project** → Import from GitHub
2. Paste your repo URL
3. Your app is live at `https://your-project-name.glitch.me`

---

## 🔧 How It Works

```
User A                    Signaling Server              User B
  |                            |                           |
  |── find_match ─────────────>|                           |
  |                            |<──────── find_match ──────|
  |                            |                           |
  |<── matched (initiator) ───|── matched (receiver) ────>|
  |                            |                           |
  |── signal (offer) ─────────>|── signal (offer) ────────>|
  |<── signal (answer) ────────|<── signal (answer) ───────|
  |── signal (ICE) ────────────|── signal (ICE) ───────────|
  |                            |                           |
  |<════════ Direct P2P WebRTC Audio Connection ══════════>|
  |                            |                           |
```

Once matched, **all audio flows directly between users** (peer-to-peer). The server only handles matchmaking and signaling.

---

## ⚠️ Notes

- **Microphone permission** is required — browsers will prompt the user
- Works best on **Chrome or Firefox**
- For users behind strict firewalls, a **TURN server** may be needed (not included in this simple setup)
- The app uses **Google's public STUN servers** which work for most connections

---

## 🛠 Tech Stack

| Part | Technology |
|------|-----------|
| Signaling server | Node.js + Express + Socket.io |
| Voice calls | WebRTC (browser native) |
| Waiting music | Web Audio API (synthesized) |
| Frontend | Vanilla HTML/CSS/JS |
| Friends storage | localStorage |
