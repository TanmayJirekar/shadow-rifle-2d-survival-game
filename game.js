// game.js — Core game engine
import { Player, Enemy, Bullet, Coin, Particle, DamageNumber } from './entities.js';
import { WEAPONS, getLevelDef } from './weapons.js';
import { loadGame, saveGame } from './storage.js';

const VW = 800, VH = 450, GROUND_Y = 385, LEVEL_W = 2400;

const IMG_URLS = {
  bg:    'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/951ef58c-4a52-4158-b63d-3c337f2aff30.png',
  player:'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/cab3dcb0-9f34-4410-81e3-a68c9f7c2c10.png',
  basic: 'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/9aa07b6c-3157-4a4b-9b90-b180c5d80178.png',
  fast:  'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/e132b9fc-7333-486a-b1d6-1d73b0c4a02b.png',
  tank:  'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/ab42527f-6ec0-4503-ae9e-2e67c4b9ad17.png',
  boss:  'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/707936c8-016a-414b-b828-34ebf30a4d91.png',
};
const SFX_URLS = {
  shoot: 'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/fbf31bf3-84ad-4eef-9a27-4b8f204d20df.mp3',
  death: 'https://vtelpopqybfytrgzkomj.supabase.co/storage/v1/object/public/game-assets/public/cd73d7b8-bbe0-486f-bb70-e1cb23326e77/4c97b18f-305a-4342-85f1-68244e4cbeb4/e324fb2f-fc6f-4fab-94e7-d16621b1b043.mp3',
};

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VW; canvas.height = VH;
    this.running = false; this.paused = false; this.rafId = null;
    this.player = null;
    this.enemies = []; this.bullets = []; this.coins = [];
    this.particles = []; this.dmgNums = [];
    this.level = 1; this.wave = 0; this.waveDef = [];
    this.spawnQueue = []; this.spawnTimer = 0;
    this.waitingForWave = false; this.waveDelayTimer = 0;
    this.cameraX = 0; this.keys = {};
    this.mouse = { x: 400, y: 225, pressing: false };
    this.shootRequest = false; this.lastTime = 0;
    this.sessionKills = 0; this.sessionCoins = 0; this.score = 0;
    this.saveData = loadGame();
    this.imgs = {}; this.sfx = {}; this.audioCtx = null;
    this.onGameOver = null; this.onLevelComplete = null; this.onStatsUpdate = null;
    this._loadAssets(); this._setupInput();
  }

  _loadAssets() {
    for (const [k, url] of Object.entries(IMG_URLS)) { const i = new Image(); i.src = url; this.imgs[k] = i; }
    for (const [k, url] of Object.entries(SFX_URLS)) { const a = new Audio(url); a.volume = 0.3; this.sfx[k] = a; }
    try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }

  _playSound(key) {
    const s = this.sfx[key]; if (!s) return;
    try { const c = s.cloneNode(); c.volume = 0.25; c.play().catch(() => {}); } catch(e) {}
  }

  _playTone(freq, dur, type = 'square') {
    if (!this.audioCtx) return;
    try {
      const o = this.audioCtx.createOscillator(), g = this.audioCtx.createGain();
      o.connect(g); g.connect(this.audioCtx.destination);
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + dur);
      o.start(); o.stop(this.audioCtx.currentTime + dur);
    } catch(e) {}
  }

  _setupInput() {
    this._kd = (e) => { this.keys[e.code] = true; if (e.code === 'Space') { e.preventDefault(); this.shootRequest = true; } if (e.code === 'KeyR' && this.player) this.player.startReload(); };
    this._ku = (e) => { this.keys[e.code] = false; };
    this._mm = (e) => { const r = this.canvas.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) * (VW / r.width) + this.cameraX; this.mouse.y = (e.clientY - r.top) * (VH / r.height); };
    this._md = (e) => { this.mouse.pressing = true; this.shootRequest = true; };
    this._mu = () => { this.mouse.pressing = false; };
    this._ts = (e) => { e.preventDefault(); const t = e.touches[0], r = this.canvas.getBoundingClientRect(); this.mouse.x = (t.clientX - r.left) * (VW / r.width) + this.cameraX; this.mouse.y = (t.clientY - r.top) * (VH / r.height); this.mouse.pressing = true; this.shootRequest = true; };
    this._tm = (e) => { e.preventDefault(); const t = e.touches[0], r = this.canvas.getBoundingClientRect(); this.mouse.x = (t.clientX - r.left) * (VW / r.width) + this.cameraX; this.mouse.y = (t.clientY - r.top) * (VH / r.height); };
    this._te = () => { this.mouse.pressing = false; };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
    this.canvas.addEventListener('mousemove', this._mm);
    this.canvas.addEventListener('mousedown', this._md);
    document.addEventListener('mouseup', this._mu);
    this.canvas.addEventListener('touchstart', this._ts, { passive: false });
    this.canvas.addEventListener('touchmove', this._tm, { passive: false });
    this.canvas.addEventListener('touchend', this._te);
  }

  removeInput() {
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('keyup', this._ku);
    document.removeEventListener('mouseup', this._mu);
    this.canvas.removeEventListener('mousemove', this._mm);
    this.canvas.removeEventListener('mousedown', this._md);
    this.canvas.removeEventListener('touchstart', this._ts);
    this.canvas.removeEventListener('touchmove', this._tm);
    this.canvas.removeEventListener('touchend', this._te);
  }

  init(level) {
    this.level = level; this.wave = 0;
    this.enemies = []; this.bullets = []; this.coins = [];
    this.particles = []; this.dmgNums = [];
    this.spawnQueue = []; this.sessionKills = 0;
    this.sessionCoins = 0; this.score = 0; this.cameraX = 0;
    this.saveData = loadGame();
    const wpId = this.saveData.equippedWeapon || 'rifle';
    const wp = WEAPONS[wpId];
    this.player = new Player(160, 0);
    this.player.weapon = wp; this.player.ammo = wp.maxAmmo;
    this.player.img = this.imgs.player;
    const def = getLevelDef(level);
    this.waveDef = def.waves;
    this.waitingForWave = true; this.waveDelayTimer = 3000;
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const maxW = wrap.clientWidth, maxH = wrap.clientHeight;
    const ratio = Math.min(maxW / VW, maxH / VH);
    this.canvas.style.width = Math.floor(VW * ratio) + 'px';
    this.canvas.style.height = Math.floor(VH * ratio) + 'px';
  }

  start() { this.running = true; this.paused = false; this.lastTime = performance.now(); this.rafId = requestAnimationFrame(t => this._loop(t)); }
  stop() { this.running = false; cancelAnimationFrame(this.rafId); this.rafId = null; }
  pause() { this.paused = true; }
  resume() { this.paused = false; this.lastTime = performance.now(); }

  _loop(ts) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(t => this._loop(t));
    if (this.paused) return;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt); this.draw();
    this.shootRequest = false;
  }

  update(dt) {
    const p = this.player;
    if (this.waitingForWave) {
      this.waveDelayTimer -= dt * 1000;
      if (this.waveDelayTimer <= 0) { this.waitingForWave = false; this._spawnNextWave(); }
      p.update(dt, this.keys, GROUND_Y, 0, LEVEL_W); this._updateCamera(); this._emitStats(); return;
    }
    const autoFire = p.weapon && p.weapon.fireRate < 150;
    if (this.shootRequest || (autoFire && this.mouse.pressing)) {
      const bs = p.shoot(this.mouse.x, this.mouse.y);
      if (bs) { this.bullets.push(...bs); this._playSound('shoot'); }
    }
    p.update(dt, this.keys, GROUND_Y, 0, LEVEL_W);
    // Enemies
    for (const e of this.enemies) {
      e.update(dt, p.x + p.w / 2, p.y + p.h / 2, GROUND_Y);
      if (e.canAttack()) {
        e.attack(); p.takeDamage(e.damage);
        this.dmgNums.push(new DamageNumber(p.x + p.w / 2, p.y, e.damage, true));
        if (p.health <= 0) { this._handleGameOver(); return; }
      }
    }
    // Bullets
    for (const b of this.bullets) {
      b.update(dt);
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (this._overlap(b.x - 8, b.y - 3, 16, 6, e.x, e.y, e.w, e.h)) {
          b.alive = false;
          this.dmgNums.push(new DamageNumber(e.x + e.w / 2, e.y, b.damage, false));
          for (let i = 0; i < 5; i++) this.particles.push(new Particle(b.x, b.y, '#ffff44'));
          if (e.takeDamage(b.damage)) this._onEnemyKilled(e);
          break;
        }
      }
    }
    // Coins
    for (const c of this.coins) {
      c.update(dt, GROUND_Y);
      if (c.alive && this._overlap(p.x, p.y, p.w, p.h, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2)) {
        c.alive = false; this.sessionCoins += c.value;
        this.score += c.value * 10; this._playTone(660, 0.08);
      }
    }
    // Particles and damage numbers
    for (const pt of this.particles) pt.update(dt);
    for (const d of this.dmgNums) d.update(dt);
    // Spawn queue
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt * 1000;
      if (this.spawnTimer <= 0) { this._spawnEnemy(this.spawnQueue.shift()); this.spawnTimer = 850; }
    }
    // Cleanup
    this.bullets = this.bullets.filter(b => b.alive);
    this.enemies = this.enemies.filter(e => e.health > 0);
    this.coins = this.coins.filter(c => c.alive);
    this.particles = this.particles.filter(p => p.alive);
    this.dmgNums = this.dmgNums.filter(d => d.alive);
    // Wave complete check
    if (!this.waitingForWave && this.spawnQueue.length === 0 && this.enemies.length === 0) this._onWaveComplete();
    this._updateCamera(); this._emitStats();
  }

  _spawnNextWave() { this.spawnQueue = [...this.waveDef[this.wave]]; this.spawnTimer = 400; }
  _spawnEnemy(type) {
    const spawnX = this.cameraX + VW + 60;
    const imgMap = { basic: 'basic', fast: 'fast', tank: 'tank', boss: 'boss' };
    const e = new Enemy(spawnX, 0, type, this.level);
    e.img = this.imgs[imgMap[type]];
    this.enemies.push(e);
  }

  _onEnemyKilled(e) {
    this.sessionKills++; this.score += e.scoreValue;
    this._playSound('death');
    for (let i = 0; i < 10; i++) this.particles.push(new Particle(e.x + e.w / 2, e.y + e.h / 2, i < 7 ? '#ff4433' : '#ff8800'));
    const n = Math.ceil(e.coinReward / 5);
    for (let i = 0; i < n; i++) this.coins.push(new Coin(e.x + e.w / 2 + (Math.random() - 0.5) * 30, e.y + e.h / 2, 5));
  }

  _onWaveComplete() {
    this.wave++;
    if (this.wave >= this.waveDef.length) { this._handleLevelComplete(); }
    else { this.waitingForWave = true; this.waveDelayTimer = 3500; this._playTone(440, 0.3, 'sine'); }
  }

  _handleGameOver() {
    this.stop();
    const s = loadGame();
    s.stats.kills = (s.stats.kills || 0) + this.sessionKills;
    s.coins = (s.coins || 0) + this.sessionCoins;
    s.stats.totalCoinsEarned = (s.stats.totalCoinsEarned || 0) + this.sessionCoins;
    s.stats.highScore = Math.max(s.stats.highScore || 0, this.score);
    saveGame(s);
    if (this.onGameOver) this.onGameOver({ score: this.score, kills: this.sessionKills, coins: this.sessionCoins, level: this.level });
  }

  _handleLevelComplete() {
    this.stop();
    const reward = 50 + this.level * 25;
    const s = loadGame();
    s.stats.kills = (s.stats.kills || 0) + this.sessionKills;
    s.coins = (s.coins || 0) + this.sessionCoins + reward;
    s.stats.totalCoinsEarned = (s.stats.totalCoinsEarned || 0) + this.sessionCoins + reward;
    s.stats.levelsCompleted = Math.max(s.stats.levelsCompleted || 0, this.level);
    s.stats.highScore = Math.max(s.stats.highScore || 0, this.score);
    s.level = Math.max(s.level || 1, this.level + 1);
    saveGame(s);
    this._playTone(523, 0.5, 'sine');
    if (this.onLevelComplete) this.onLevelComplete({ score: this.score, kills: this.sessionKills, reward, level: this.level });
  }

  _updateCamera() {
    const target = this.player.x + this.player.w / 2 - VW * 0.38;
    this.cameraX += (Math.max(0, Math.min(LEVEL_W - VW, target)) - this.cameraX) * 0.1;
  }

  _overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _emitStats() {
    if (!this.onStatsUpdate) return;
    const p = this.player;
    this.onStatsUpdate({
      health: p.health, maxHealth: p.maxHealth,
      ammo: p.ammo, maxAmmo: p.weapon ? p.weapon.maxAmmo : 30,
      reloading: p.reloading,
      coins: this.sessionCoins + (this.saveData.coins || 0),
      level: this.level, wave: this.wave + 1, totalWaves: this.waveDef.length,
      weapon: p.weapon ? p.weapon.name : 'Rifle'
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VW, VH);
    this._drawBg(ctx);
    for (const c of this.coins) c.draw(ctx, this.cameraX);
    for (const pt of this.particles) pt.draw(ctx, this.cameraX);
    for (const e of this.enemies) e.draw(ctx, this.cameraX);
    this.player.draw(ctx, this.cameraX);
    for (const b of this.bullets) b.draw(ctx, this.cameraX);
    for (const d of this.dmgNums) d.draw(ctx, this.cameraX);
    if (this.waitingForWave) this._drawCountdown(ctx);
  }

  _drawBg(ctx) {
    const bg = this.imgs.bg;
    if (bg && bg.complete && bg.naturalWidth > 0) {
      const p = this.cameraX * 0.18, bw = bg.width || VW;
      for (let x = -(p % bw) - bw; x < VW + bw; x += bw) ctx.drawImage(bg, x, 0, bw, VH);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, '#040b05'); g.addColorStop(0.6, '#081208'); g.addColorStop(1, '#101e10');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = 'rgba(100,255,100,0.25)';
      for (let i = 0; i < 55; i++) ctx.fillRect((i * 167 + 11) % VW, (i * 83 + 5) % (VH * 0.55), 1.5, 1.5);
    }
    ctx.fillStyle = '#111c10'; ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
    ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#00ff41'; ctx.fillRect(0, GROUND_Y, VW, 2);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,255,65,0.07)'; ctx.lineWidth = 1;
    const goff = -(this.cameraX * 0.65) % 55;
    for (let x = goff; x < VW; x += 55) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, VH); ctx.stroke(); }
  }

  _drawCountdown(ctx) {
    const secs = Math.ceil(this.waveDelayTimer / 1000);
    const msg = this.wave === 0 ? 'MISSION START' : `WAVE ${this.wave + 1} INCOMING!`;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(VW / 2 - 180, VH / 2 - 55, 360, 110);
    ctx.strokeStyle = '#00ff41'; ctx.lineWidth = 1.5; ctx.strokeRect(VW / 2 - 180, VH / 2 - 55, 360, 110);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff41'; ctx.font = 'bold 22px Courier New'; ctx.fillText(msg, VW / 2, VH / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Courier New'; ctx.fillText(secs > 0 ? secs : 'GO!', VW / 2, VH / 2 + 42);
    ctx.restore();
  }
}
