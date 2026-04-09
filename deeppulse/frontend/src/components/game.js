// ======================================================
// DEEPPULSE — Game Engine
// ======================================================

const API_BASE = 'http://localhost:3001/api';

// ── Canvas Setup ──────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Color palette ─────────────────────────────────────
const C = {
  abyss:   '#010812',
  deep:    '#030f1e',
  mid:     '#061428',
  pulse:   '#00f5d4',
  pulseDim:'#00b89c',
  danger:  '#ff2d55',
  warn:    '#ffb800',
  energy:  '#7b2fff',
  text:    '#c8e6ff',
  textDim: '#5a7fa0',
};

// ── State ─────────────────────────────────────────────
let state = 'menu'; // menu | playing | paused | gameover
let keys  = {};
let lastTime = 0;
let gameTime = 0;

// ── Game Config ───────────────────────────────────────
const CFG = {
  probeSpeed:    220,
  probeRadius:   14,
  maxHealth:     100,
  maxShields:    3,
  shieldCooldown:8000,  // ms
  baseEnemySpeed:80,
  enemySpeedGrow:8,     // per wave
  waveEnemyBase: 4,
  waveEnemyGrow: 2,
  pickupChance:  0.35,
};

// ── Game Objects ──────────────────────────────────────
let probe      = {};
let enemies    = [];
let pickups    = [];
let particles  = [];
let projectiles= [];
let score      = 0;
let depth      = 0;
let wave       = 1;
let health     = 100;
let shields    = 3;
let shieldActive    = false;
let shieldTimer     = 0;
let shieldCooldown  = 0;
let waveTimer       = 0;
let waveTransition  = false;
let waveNotifyTimer = 0;
let enemiesKilled   = 0;
let enemiesForWave  = CFG.waveEnemyBase;

// ── Parallax bg layers ────────────────────────────────
const bgLayers = [
  { depth: 0.1, items: [] },
  { depth: 0.3, items: [] },
  { depth: 0.6, items: [] },
];

// ── Input ─────────────────────────────────────────────
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && state === 'playing') {
    e.preventDefault();
    activateShield();
  }
  if (e.code === 'Escape' && state === 'playing') togglePause();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Screen Manager ────────────────────────────────────
const screens = {
  menu:     document.getElementById('menu-screen'),
  lb:       document.getElementById('lb-screen'),
  gameover: document.getElementById('gameover-screen'),
};
const hud = document.getElementById('hud');

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  hud.classList.remove('visible');
  if (name && screens[name]) screens[name].classList.add('active');
  if (name === null) hud.classList.add('visible');
}

// ── Ambient Bubbles ───────────────────────────────────
function spawnAmbientBubbles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 4 + Math.random() * 14;
    b.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      animation-duration:${8 + Math.random()*14}s;
      animation-delay:-${Math.random()*15}s;
      opacity:${0.2 + Math.random()*0.4}
    `;
    container.appendChild(b);
  }
}
spawnAmbientBubbles();

// ── Utilities ─────────────────────────────────────────
const rnd  = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist  = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp  = (a, b, t) => a + (b - a) * t;

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

// ── Spawn a particle burst ────────────────────────────
function burst(x, y, color, count = 10, speed = 120) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = rnd(30, speed);
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1,
      decay: rnd(1.2, 2.5),
      r: rnd(1.5, 4),
      color,
    });
  }
}

// ── Background ────────────────────────────────────────
function initBg() {
  bgLayers.forEach((layer, li) => {
    layer.items = [];
    const count = li === 0 ? 60 : li === 1 ? 30 : 15;
    for (let i = 0; i < count; i++) {
      layer.items.push({
        x: rnd(0, canvas.width),
        y: rnd(0, canvas.height),
        r: rnd(0.5, li * 1.5 + 0.8),
        bright: rnd(0.1, 0.5),
        speed: rnd(8, 20) * layer.depth,
      });
    }
  });
}

function drawBg(dt) {
  // Deep ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0,   '#010e20');
  grad.addColorStop(0.5, '#010812');
  grad.addColorStop(1,   '#000508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Bioluminescent dots
  bgLayers.forEach(layer => {
    layer.items.forEach(item => {
      item.y += layer.depth * (depth * 0.001 + 1) * dt * 40;
      if (item.y > canvas.height + 10) item.y = -10;

      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,245,212,${item.bright})`;
      glow(ctx, C.pulse, item.r * 4);
      ctx.fill();
      noGlow(ctx);
    });
  });
}

// ── Probe ─────────────────────────────────────────────
function initProbe() {
  probe = {
    x: canvas.width  / 2,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    r: CFG.probeRadius,
    trail: [],
    thrustTime: 0,
  };
}

function updateProbe(dt) {
  let ax = 0, ay = 0;
  if (keys['KeyW'] || keys['ArrowUp'])    ay -= 1;
  if (keys['KeyS'] || keys['ArrowDown'])  ay += 1;
  if (keys['KeyA'] || keys['ArrowLeft'])  ax -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ax += 1;

  const mag = Math.hypot(ax, ay);
  if (mag > 0) { ax /= mag; ay /= mag; probe.thrustTime += dt; }
  else         { probe.thrustTime = 0; }

  probe.vx = lerp(probe.vx, ax * CFG.probeSpeed, 8 * dt);
  probe.vy = lerp(probe.vy, ay * CFG.probeSpeed, 8 * dt);

  probe.x = clamp(probe.x + probe.vx * dt, probe.r, canvas.width  - probe.r);
  probe.y = clamp(probe.y + probe.vy * dt, probe.r, canvas.height - probe.r);

  // Trail
  probe.trail.push({ x: probe.x, y: probe.y });
  if (probe.trail.length > 18) probe.trail.shift();
}

function drawProbe() {
  const { x, y, r, thrustTime } = probe;

  // Trail
  probe.trail.forEach((pt, i) => {
    const alpha = (i / probe.trail.length) * 0.35;
    const rad   = r * 0.5 * (i / probe.trail.length);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,245,212,${alpha})`;
    ctx.fill();
  });

  // Shield effect
  if (shieldActive) {
    ctx.beginPath();
    ctx.arc(x, y, r + 12 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(123,47,255,0.8)`;
    ctx.lineWidth = 2;
    glow(ctx, C.energy, 20);
    ctx.stroke();
    noGlow(ctx);
  }

  // Body
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  bodyGrad.addColorStop(0, '#0d2a50');
  bodyGrad.addColorStop(1, '#061428');
  ctx.fillStyle = bodyGrad;
  glow(ctx, C.pulse, 20);
  ctx.fill();

  // Rim
  ctx.strokeStyle = C.pulse;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  noGlow(ctx);

  // Window
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,245,212,0.12)';
  ctx.strokeStyle = 'rgba(0,245,212,0.5)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  // Inner glow dot
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,245,212,0.8)';
  glow(ctx, C.pulse, 10);
  ctx.fill();
  noGlow(ctx);

  // Thrusters (animated when moving)
  const thrust = Math.min(thrustTime * 4, 1);
  const thrustLen = r * 0.8 * thrust;
  [-r * 0.6, r * 0.6].forEach(ox => {
    ctx.beginPath();
    ctx.moveTo(x + ox, y + r);
    ctx.lineTo(x + ox, y + r + thrustLen + Math.random() * 4);
    ctx.strokeStyle = `rgba(0,245,212,${0.6 * thrust})`;
    ctx.lineWidth = 3;
    glow(ctx, C.pulse, 8);
    ctx.stroke();
    noGlow(ctx);
  });
}

// ── Enemies ───────────────────────────────────────────
const ENEMY_TYPES = [
  {
    name: 'jellyfish',
    color: '#ff2d55',
    gColor: '#c01a3a',
    r: 18,
    hp: 1,
    dmg: 20,
    points: 100,
    speed: 1.0,
    draw(ctx, e) {
      const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.003 + e.phase);
      const r = e.r * pulse;
      // Bell
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,45,85,0.3)`;
      glow(ctx, e.type.color, 18);
      ctx.fill();
      ctx.strokeStyle = e.type.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      noGlow(ctx);
      // Tentacles
      for (let i = 0; i < 5; i++) {
        const tx = e.x + (i - 2) * (r * 0.4);
        const ty = e.y;
        const tlen = r * 0.8 + Math.sin(Date.now() * 0.004 + i + e.phase) * 6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.sin(Date.now() * 0.003 + i) * 4, ty + tlen);
        ctx.strokeStyle = `rgba(255,45,85,0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  },
  {
    name: 'angler',
    color: '#ffb800',
    gColor: '#cc9200',
    r: 14,
    hp: 2,
    dmg: 30,
    points: 200,
    speed: 1.3,
    draw(ctx, e) {
      const r = e.r;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, r * 1.4, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,184,0,0.2)`;
      glow(ctx, e.type.color, 15);
      ctx.fill();
      ctx.strokeStyle = e.type.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Lure
      const lx = e.x - r * 1.6;
      const ly = e.y - r * 0.5 + Math.sin(Date.now() * 0.005 + e.phase) * 4;
      ctx.beginPath();
      ctx.moveTo(e.x - r, e.y - r * 0.3);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = `rgba(255,184,0,0.5)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb800';
      glow(ctx, '#ffb800', 12);
      ctx.fill();
      noGlow(ctx);
    }
  },
  {
    name: 'leviathan',
    color: '#7b2fff',
    gColor: '#5a20cc',
    r: 26,
    hp: 4,
    dmg: 40,
    points: 500,
    speed: 0.7,
    draw(ctx, e) {
      const r = e.r;
      const t = Date.now() * 0.002 + e.phase;
      // Body
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, r * 1.2, r * 0.8, Math.sin(t * 0.5) * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(123,47,255,0.25)`;
      glow(ctx, e.type.color, 25);
      ctx.fill();
      ctx.strokeStyle = e.type.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      noGlow(ctx);
      // Eye
      ctx.beginPath();
      ctx.arc(e.x + r * 0.5, e.y - r * 0.1, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(123,47,255,0.8)';
      glow(ctx, C.energy, 15);
      ctx.fill();
      noGlow(ctx);
      // Fins
      ctx.beginPath();
      ctx.moveTo(e.x + r * 1.1, e.y);
      ctx.lineTo(e.x + r * 1.8, e.y - r * 0.6 + Math.sin(t) * 5);
      ctx.lineTo(e.x + r * 1.8, e.y + r * 0.6 + Math.sin(t) * 5);
      ctx.closePath();
      ctx.fillStyle = `rgba(123,47,255,0.4)`;
      ctx.fill();
    }
  }
];

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const padding = 40;
  let x, y;
  if (side === 0) { x = rnd(0, canvas.width); y = -padding; }
  else if (side === 1) { x = canvas.width + padding; y = rnd(0, canvas.height); }
  else if (side === 2) { x = rnd(0, canvas.width); y = canvas.height + padding; }
  else { x = -padding; y = rnd(0, canvas.height); }

  const typeIdx = wave > 4
    ? Math.floor(rnd(0, ENEMY_TYPES.length))
    : Math.floor(rnd(0, Math.min(wave, ENEMY_TYPES.length)));

  const type = ENEMY_TYPES[typeIdx];
  const spd  = (CFG.baseEnemySpeed + wave * CFG.enemySpeedGrow) * type.speed;

  enemies.push({
    x, y,
    type,
    r: type.r,
    hp: type.hp + Math.floor(wave * 0.5),
    maxHp: type.hp + Math.floor(wave * 0.5),
    speed: spd,
    phase: Math.random() * Math.PI * 2,
    hitFlash: 0,
  });
}

function updateEnemies(dt) {
  enemies.forEach(e => {
    const angle = Math.atan2(probe.y - e.y, probe.x - e.x);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
    if (e.hitFlash > 0) e.hitFlash -= dt * 5;
  });

  // Spawn logic
  if (!waveTransition) {
    waveTimer += dt;
    const spawnInterval = Math.max(0.4, 2.0 - wave * 0.15);
    if (waveTimer >= spawnInterval && enemies.length < enemiesForWave + wave * 2) {
      waveTimer = 0;
      spawnEnemy();
    }
  }
}

function drawEnemies() {
  enemies.forEach(e => {
    ctx.save();
    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.5 + e.hitFlash * 0.5;
    }
    e.type.draw(ctx, e);
    ctx.restore();

    // HP bar
    if (e.hp < e.maxHp) {
      const bw = e.r * 2.2;
      const bx = e.x - bw / 2;
      const by = e.y - e.r - 10;
      ctx.fillStyle = 'rgba(255,45,85,0.2)';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = C.danger;
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    }
  });
}

// ── Pickups ───────────────────────────────────────────
function spawnPickup(x, y) {
  if (Math.random() > CFG.pickupChance) return;
  const types = ['energy', 'health', 'shield'];
  const t     = types[Math.floor(Math.random() * types.length)];
  pickups.push({ x, y, type: t, life: 12, pulse: 0 });
}

function updatePickups(dt) {
  pickups.forEach(p => { p.life -= dt; p.pulse += dt * 3; });
  pickups = pickups.filter(p => p.life > 0);
}

function drawPickups() {
  pickups.forEach(p => {
    const scale = 1 + 0.1 * Math.sin(p.pulse);
    const r = 10 * scale;
    const alpha = Math.min(1, p.life * 0.8);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);

    if (p.type === 'energy') {
      ctx.fillStyle = 'rgba(0,245,212,0.2)';
      ctx.strokeStyle = C.pulse;
      glow(ctx, C.pulse, 15);
    } else if (p.type === 'health') {
      ctx.fillStyle = 'rgba(255,45,85,0.2)';
      ctx.strokeStyle = C.danger;
      glow(ctx, C.danger, 15);
    } else {
      ctx.fillStyle = 'rgba(123,47,255,0.2)';
      ctx.strokeStyle = C.energy;
      glow(ctx, C.energy, 15);
    }

    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    noGlow(ctx);

    // Icon
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'energy' ? '⚡' : p.type === 'health' ? '♥' : '◈', 0, 0);

    ctx.restore();
  });
}

// ── Particles ─────────────────────────────────────────
function updateParticles(dt) {
  particles.forEach(p => {
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vx   *= 0.94;
    p.vy   *= 0.94;
    p.life -= p.decay * dt;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color.replace(')', `,${p.life})`).replace('rgb(', 'rgba(');
    if (!p.color.includes('rgba')) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ── Shield ────────────────────────────────────────────
function activateShield() {
  if (shieldActive || shields <= 0 || shieldCooldown > 0) return;
  shieldActive = true;
  shieldTimer  = 2500;
  shields--;
  updateShieldUI();
  burst(probe.x, probe.y, 'rgb(123,47,255)', 15, 150);
}

function updateShield(dt) {
  if (shieldActive) {
    shieldTimer -= dt * 1000;
    if (shieldTimer <= 0) {
      shieldActive = false;
      shieldCooldown = CFG.shieldCooldown;
    }
  }
  if (shieldCooldown > 0) {
    shieldCooldown -= dt * 1000;
    if (shieldCooldown <= 0 && shields < CFG.maxShields) {
      shields = Math.min(shields + 1, CFG.maxShields);
      shieldCooldown = shields < CFG.maxShields ? CFG.shieldCooldown : 0;
      updateShieldUI();
    }
  }
}

// ── Collisions ────────────────────────────────────────
function checkCollisions() {
  // Probe vs Enemies
  enemies = enemies.filter(e => {
    if (dist(probe, e) < probe.r + e.r) {
      if (shieldActive) {
        burst(e.x, e.y, 'rgb(123,47,255)', 12, 120);
        score += Math.floor(e.type.points * 0.5);
        return false;
      }
      health -= e.type.dmg;
      burst(e.x, e.y, 'rgb(255,45,85)', 14, 150);
      enemiesKilled++;
      score  += Math.floor(e.type.points * 0.3);
      if (health <= 0) { health = 0; endGame(); }
      updateHealthUI();
      return false;
    }
    return true;
  });

  // Probe vs Pickups
  pickups = pickups.filter(p => {
    if (dist(probe, p) < probe.r + 14) {
      applyPickup(p.type);
      burst(p.x, p.y,
        p.type === 'energy'  ? 'rgb(0,245,212)' :
        p.type === 'health'  ? 'rgb(255,45,85)' : 'rgb(123,47,255)',
        8, 80);
      return false;
    }
    return true;
  });
}

function applyPickup(type) {
  if (type === 'energy') {
    score += 250 + wave * 50;
  } else if (type === 'health') {
    health = Math.min(health + 30, CFG.maxHealth);
    updateHealthUI();
  } else {
    shields = Math.min(shields + 1, CFG.maxShields);
    updateShieldUI();
  }
}

// ── Wave System ───────────────────────────────────────
function checkWaveComplete() {
  if (!waveTransition && enemiesKilled >= enemiesForWave) {
    waveTransition = true;
    setTimeout(() => {
      wave++;
      enemiesForWave = CFG.waveEnemyBase + wave * CFG.waveEnemyGrow;
      enemiesKilled  = 0;
      waveTransition = false;
      showWaveNotify();
      updateHUD();
      // Bonus
      score += wave * 500;
      health = Math.min(health + 15, CFG.maxHealth);
      updateHealthUI();
    }, 1500);
  }
}

function showWaveNotify() {
  const el = document.getElementById('wave-notify');
  el.textContent = `WAVE ${wave}`;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ── HUD Updates ───────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-score').textContent = score.toLocaleString();
  document.getElementById('hud-depth').textContent = Math.floor(depth) + 'm';
  document.getElementById('hud-wave').textContent  = wave;
  updateHealthUI();
}

function updateHealthUI() {
  const pct = (health / CFG.maxHealth) * 100;
  document.getElementById('health-bar-inner').style.width = pct + '%';
  const val = document.getElementById('hud-score');
  val.className = 'hud-value' + (health < 30 ? ' danger' : health < 60 ? ' warn' : '');
}

function updateShieldUI() {
  const container = document.getElementById('shield-pips');
  container.innerHTML = '';
  for (let i = 0; i < CFG.maxShields; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (i >= shields ? ' empty' : '');
    container.appendChild(pip);
  }
}

// ── Score / Depth ─────────────────────────────────────
function updateScore(dt) {
  depth  += dt * (20 + wave * 5);
  score  += Math.floor(dt * (10 + wave * 3));
  document.getElementById('hud-score').textContent = Math.floor(score).toLocaleString();
  document.getElementById('hud-depth').textContent = Math.floor(depth) + 'm';
}

// ── Game Init ─────────────────────────────────────────
function initGame() {
  score      = 0;
  depth      = 0;
  wave       = 1;
  health     = CFG.maxHealth;
  shields    = CFG.maxShields;
  shieldActive    = false;
  shieldTimer     = 0;
  shieldCooldown  = 0;
  waveTimer       = 0;
  waveTransition  = false;
  enemiesKilled   = 0;
  enemiesForWave  = CFG.waveEnemyBase;
  enemies    = [];
  pickups    = [];
  particles  = [];
  gameTime   = 0;

  initProbe();
  initBg();
  updateShieldUI();
  updateHUD();

  setTimeout(showWaveNotify, 600);
}

// ── Pause ─────────────────────────────────────────────
let pauseOverlay = false;

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseOverlay = true;
  } else if (state === 'paused') {
    state = 'playing';
    pauseOverlay = false;
    lastTime = performance.now();
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(1,8,18,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold 32px 'Orbitron', monospace`;
  ctx.fillStyle = C.pulse;
  ctx.textAlign = 'center';
  ctx.shadowColor = C.pulse;
  ctx.shadowBlur  = 30;
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.shadowBlur = 0;
  ctx.font = `12px 'Share Tech Mono', monospace`;
  ctx.fillStyle = C.textDim;
  ctx.fillText('Press ESC to resume', canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = 'left';
}

// ── End Game ──────────────────────────────────────────
function endGame() {
  state = 'gameover';
  showScreen('gameover');

  document.getElementById('go-score').textContent = Math.floor(score).toLocaleString();
  document.getElementById('go-depth').textContent = Math.floor(depth) + 'm';
  document.getElementById('go-wave').textContent  = wave;
  document.getElementById('go-time').textContent  = Math.floor(gameTime) + 's';
  document.getElementById('rank-badge').textContent = '';

  // Restore stored name
  const stored = localStorage.getItem('dp_name');
  if (stored) document.getElementById('player-name').value = stored;
}

// ── Main Loop ─────────────────────────────────────────
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (state !== 'playing' && state !== 'paused') return;

  drawBg(dt);

  if (state === 'playing') {
    gameTime += dt;
    updateProbe(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateShield(dt);
    checkCollisions();
    checkWaveComplete();
    updateScore(dt);

    // Random pickup spawn on enemy defeat handled inside collision
  }

  drawEnemies();
  drawPickups();
  drawParticles();
  drawProbe();

  if (state === 'paused') drawPauseOverlay();
}

// ── Enemy death spawns pickup ─────────────────────────
// Override collision to also spawn pickups
const _origCheckCollisions = checkCollisions;

// ── API Calls ─────────────────────────────────────────
async function fetchLeaderboard() {
  try {
    const res  = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

async function submitScore(playerName) {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName,
        score: Math.floor(score),
        depth: Math.floor(depth),
        duration: Math.floor(gameTime),
        wave,
      })
    });
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

function renderLeaderboard(scores) {
  const tbody = document.getElementById('lb-body');
  if (!scores || scores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px">No scores yet. Be the first!</td></tr>`;
    return;
  }
  tbody.innerHTML = scores.map((s, i) => `
    <tr>
      <td><span class="rank-num ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i + 1}</span></td>
      <td>${s.playerName}</td>
      <td><span class="score-val">${s.score.toLocaleString()}</span></td>
      <td>${s.depth}m</td>
      <td>${s.wave}</td>
    </tr>
  `).join('');
}

// ── Button Handlers ───────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => {
  showScreen(null);
  state = 'playing';
  lastTime = performance.now();
  initGame();
});

document.getElementById('btn-lb').addEventListener('click', async () => {
  showScreen('lb');
  const scores = await fetchLeaderboard();
  renderLeaderboard(scores);
});

document.getElementById('btn-lb-back').addEventListener('click', () => {
  showScreen('menu');
});

document.getElementById('btn-submit').addEventListener('click', async () => {
  const name = document.getElementById('player-name').value.trim() || 'Anonymous';
  localStorage.setItem('dp_name', name);
  const btn = document.getElementById('btn-submit');
  btn.textContent = 'Transmitting...';
  btn.disabled = true;

  const result = await submitScore(name);
  if (result && result.rank) {
    document.getElementById('rank-badge').textContent = `🏆 You ranked #${result.rank} globally!`;
  } else if (result) {
    document.getElementById('rank-badge').textContent = `Score submitted to the abyss.`;
  } else {
    document.getElementById('rank-badge').textContent = `Server offline — score saved locally.`;
  }

  btn.textContent = 'Submitted';
});

document.getElementById('btn-restart').addEventListener('click', () => {
  showScreen(null);
  state = 'playing';
  lastTime = performance.now();
  initGame();
});

document.getElementById('btn-menu').addEventListener('click', () => {
  state = 'menu';
  showScreen('menu');
});

// ── Enemy death spawn pickup patch ───────────────────
// Monkey-patch to spawn pickups on kill
const _origFilter = enemies.filter;

// Re-implement collision with pickup spawn
function checkCollisions() {
  const toRemove = [];
  enemies.forEach(e => {
    if (dist(probe, e) < probe.r + e.r) {
      if (shieldActive) {
        burst(e.x, e.y, 'rgb(123,47,255)', 12, 120);
        score += Math.floor(e.type.points * 0.5);
        toRemove.push(e);
        enemiesKilled++;
        spawnPickup(e.x, e.y);
        return;
      }
      e.hp -= 1;
      if (e.hp <= 0) {
        burst(e.x, e.y, 'rgb(255,45,85)', 14, 150);
        score += e.type.points;
        enemiesKilled++;
        spawnPickup(e.x, e.y);
        toRemove.push(e);
      } else {
        e.hitFlash = 1;
        health -= e.type.dmg * 0.5;
        burst(probe.x, probe.y, 'rgb(255,45,85)', 6, 80);
        if (health <= 0) { health = 0; endGame(); }
        updateHealthUI();
      }
    }
  });
  enemies = enemies.filter(e => !toRemove.includes(e));

  pickups = pickups.filter(p => {
    if (dist(probe, p) < probe.r + 14) {
      applyPickup(p.type);
      burst(p.x, p.y,
        p.type === 'energy'  ? 'rgb(0,245,212)' :
        p.type === 'health'  ? 'rgb(255,45,85)' : 'rgb(123,47,255)',
        8, 80);
      return false;
    }
    return true;
  });
}

// ── Start ─────────────────────────────────────────────
lastTime = performance.now();
requestAnimationFrame(loop);
console.log('%c🌊 DeepPulse Engine Initialized', 'color:#00f5d4;font-size:14px;font-weight:bold');
