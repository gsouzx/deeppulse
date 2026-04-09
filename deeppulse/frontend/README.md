# DeepPulse — Frontend

Vanilla JS + HTML5 Canvas game. No build step required.

## Running

Open `public/index.html` in your browser.  
Recommended: use **Live Server** (VS Code extension) for best experience.

```
Live Server → right-click index.html → Open with Live Server
```

Or with Python:
```bash
cd frontend/public
python3 -m http.server 5500
# Open http://localhost:5500
```

## Structure

```
frontend/
├── public/
│   └── index.html      # Entry point (all screens, HUD, styles)
└── src/
    └── components/
        └── game.js     # Full game engine (Canvas 2D)
```

## Game Engine Features

- 60fps Canvas 2D rendering loop
- Entity component system (probe, enemies, pickups, particles)
- Parallax bioluminescent background
- 3 enemy types (Jellyfish, Angler, Leviathan)
- Progressive wave system with difficulty scaling
- Shield mechanic with cooldown/recharge
- Pickup system (Energy, Health, Shield)
- Particle burst effects
- Fullscreen responsive canvas
- REST API integration (leaderboard submit/fetch)

## Connecting to Backend

The game connects to `http://localhost:3001/api` by default.  
Change `API_BASE` in `game.js` line 4 if your backend is on a different port.

If the backend is offline, the game still works fully — score submission shows a graceful fallback.
