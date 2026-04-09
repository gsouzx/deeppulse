# 🌊 DeepPulse — Ocean Survival Game

> A dark sci-fi ocean survival mini-game built with vanilla JS (frontend) and Node.js + Express (backend), featuring real-time leaderboards, progressive difficulty, and a stunning bioluminescent aesthetic.

![DeepPulse Banner](./frontend/public/preview.png)

## 🎮 Gameplay

Control a deep-sea probe navigating the abyss. Dodge hostile creatures, collect energy cores, and survive as long as possible. The deeper you go, the more dangerous it gets.

**Controls:**
- `WASD` or `Arrow Keys` — Move probe
- `Space` — Activate shield (limited uses)
- `Mouse` — Aim sonar pulse

## 🗂️ Project Structure

```
deeppulse/
├── frontend/          # Vanilla JS + Canvas game
│   ├── src/
│   │   ├── components/   # Game modules (entities, physics, UI)
│   │   ├── styles/       # CSS with custom properties
│   │   └── assets/       # Sprites, sounds (SVG-based)
│   └── public/
│       └── index.html
│
├── backend/           # Node.js + Express REST API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── controllers/  # Business logic
│   │   └── models/       # Data models (JSON storage)
│   └── config/
│
└── README.md
```

## 🚀 Running Locally

### Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

### Frontend
```bash
cd frontend
# Open public/index.html in browser
# Or use Live Server extension in VS Code
```

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS, HTML5 Canvas, CSS Custom Properties |
| Backend | Node.js, Express.js |
| Storage | JSON file (no DB needed — zero setup) |
| Animations | CSS keyframes + Canvas 2D API |

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leaderboard` | Get top 10 scores |
| `POST` | `/api/score` | Submit a new score |
| `GET` | `/api/stats` | Get global game stats |

## ✨ Features

- 🎮 Smooth 60fps Canvas gameplay
- 🌊 Procedurally generated obstacles
- 💀 Progressive difficulty system
- 🏆 Persistent leaderboard (backend)
- 📊 Global stats tracking
- 🌑 Bioluminescent dark UI
- 📱 Responsive design

## 👤 Author

Made with 💙 for portfolio purposes.  
Feel free to fork, star ⭐, and adapt!

## 📄 License

MIT — Use freely, credit appreciated.
