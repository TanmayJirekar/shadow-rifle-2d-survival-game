// main.js — App entry point, screen management, UI logic
import { GameEngine } from './game.js';
import { loadGame, saveGame, getRank, claimDailyReward } from './storage.js';
import { WEAPONS } from './weapons.js';

let engine = null;
let currentLevel = 1;
let lastResult = null;

// ── Screen Management ────────────────────────────────────────────────────────
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active', 'show'); s.style.display = ''; });
  const el = document.getElementById('screen-' + id);
  if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; el.classList.add('show'); }
}

// ── Home Screen Update ───────────────────────────────────────────────────────
function updateHome() {
  const s = loadGame();
  document.getElementById('home-coins').textContent = s.coins || 0;
  document.getElementById('home-kills').textContent = s.stats?.kills || 0;
  document.getElementById('home-level').textContent = s.level || 1;
  currentLevel = s.level || 1;
  const cont = document.getElementById('btn-continue');
  if (currentLevel > 1) {
    document.getElementById('continue-lvl').textContent = currentLevel;
    cont.classList.remove('hidden');
  } else {
    cont.classList.add('hidden');
  }
}

// ── Game Start ───────────────────────────────────────────────────────────────
function startGame(level) {
  showScreen('game');
  if (engine) { engine.stop(); engine.removeInput(); }
  const canvas = document.getElementById('game-canvas');
  engine = new GameEngine(canvas);
  engine.init(level);

  engine.onStatsUpdate = (stats) => {
    const pct = (stats.health / stats.maxHealth * 100).toFixed(1);
    document.getElementById('hp-bar').style.width = pct + '%';
    document.getElementById('hp-bar').style.background = stats.health > 40 ? 'linear-gradient(90deg,#00dd33,#88ff44)' : 'linear-gradient(90deg,#ff3300,#ff7700)';
    document.getElementById('hud-hp').textContent = stats.health;
    const reloadEl = document.getElementById('hud-reload');
    if (stats.reloading) { document.getElementById('hud-ammo').textContent = '---'; reloadEl.classList.remove('hidden'); }
    else { document.getElementById('hud-ammo').textContent = `${stats.ammo}/${stats.maxAmmo}`; reloadEl.classList.add('hidden'); }
    document.getElementById('hud-coins').textContent = stats.coins;
    document.getElementById('hud-level').textContent = stats.level;
    document.getElementById('hud-wave').textContent = stats.wave;
    document.getElementById('hud-waves').textContent = stats.totalWaves;
    document.getElementById('hud-wpn').textContent = stats.weapon.toUpperCase();
  };

  engine.onGameOver = (data) => {
    lastResult = { ...data, isGameOver: true };
    document.getElementById('go-score').textContent = data.score;
    document.getElementById('go-kills').textContent = data.kills;
    document.getElementById('go-coins').textContent = data.coins;
    document.getElementById('go-level').textContent = data.level;
    showScreen('gameover');
  };

  engine.onLevelComplete = (data) => {
    lastResult = { ...data, isGameOver: false };
    document.getElementById('v-score').textContent = data.score;
    document.getElementById('v-kills').textContent = data.kills;
    document.getElementById('v-reward').textContent = `+${data.reward} 💰`;
    showScreen('victory');
  };

  setupMobileControls();
  engine.start();
}

// ── Mobile Controls ──────────────────────────────────────────────────────────
function setupMobileControls() {
  const mc = document.getElementById('mobile-controls');
  if ('ontouchstart' in window) mc.style.display = 'flex';
  const bind = (id, keyCode, press) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); if (engine) engine.keys[keyCode] = true; if (press && engine) { engine.shootRequest = true; engine.mouse.pressing = true; } }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); if (engine) engine.keys[keyCode] = false; if (press && engine) engine.mouse.pressing = false; }, { passive: false });
  };
  bind('mc-left-btn', 'ArrowLeft', false);
  bind('mc-right-btn', 'ArrowRight', false);
  bind('mc-jump-btn', 'Space', false);
  document.getElementById('mc-jump-btn')?.addEventListener('touchstart', e => { e.preventDefault(); if (engine) engine.keys['ArrowUp'] = true; }, { passive: false });
  document.getElementById('mc-jump-btn')?.addEventListener('touchend', e => { e.preventDefault(); if (engine) engine.keys['ArrowUp'] = false; }, { passive: false });
  const fireBtn = document.getElementById('mc-fire-btn');
  if (fireBtn) {
    fireBtn.addEventListener('touchstart', e => { e.preventDefault(); if (engine) { engine.shootRequest = true; engine.mouse.pressing = true; } }, { passive: false });
    fireBtn.addEventListener('touchend', e => { e.preventDefault(); if (engine) engine.mouse.pressing = false; }, { passive: false });
  }
  document.getElementById('mc-reload-btn')?.addEventListener('touchstart', e => { e.preventDefault(); if (engine && engine.player) engine.player.startReload(); }, { passive: false });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function openDashboard() {
  const s = loadGame();
  showScreen('dashboard');
  document.getElementById('username-input').value = s.username || 'Ghost';
  document.getElementById('d-rank').textContent = getRank(s.stats?.kills || 0);
  document.getElementById('d-coins').textContent = s.coins || 0;
  document.getElementById('d-level').textContent = s.level || 1;
  document.getElementById('d-weapon').textContent = WEAPONS[s.equippedWeapon || 'rifle']?.name || 'Rifle';
  document.getElementById('d-kills').textContent = s.stats?.kills || 0;
  document.getElementById('d-levels').textContent = s.stats?.levelsCompleted || 0;
  document.getElementById('d-score').textContent = s.stats?.highScore || 0;
  document.getElementById('d-total-coins').textContent = s.stats?.totalCoinsEarned || 0;
  // Inventory
  const inv = document.getElementById('inv-list');
  inv.innerHTML = '';
  (s.weapons || ['rifle']).forEach(id => {
    const w = WEAPONS[id]; if (!w) return;
    const div = document.createElement('div');
    div.className = 'inv-item' + (s.equippedWeapon === id ? ' equipped' : '');
    div.innerHTML = `<span class="inv-item-name">${w.emoji} ${w.name}</span><button class="btn-sm equip-btn" data-id="${id}">${s.equippedWeapon === id ? '✓ EQUIPPED' : 'EQUIP'}</button>`;
    div.querySelector('.equip-btn').addEventListener('click', () => {
      const save = loadGame(); save.equippedWeapon = id; saveGame(save); openDashboard();
    });
    inv.appendChild(div);
  });
  // Daily reward
  const today = new Date().toDateString();
  const dailyBtn = document.getElementById('btn-daily');
  if (s.dailyReward === today) {
    dailyBtn.disabled = true; dailyBtn.textContent = '✓ CLAIMED';
    document.getElementById('daily-text').textContent = 'Come back tomorrow!';
  } else {
    dailyBtn.disabled = false; dailyBtn.textContent = 'CLAIM 50 COINS';
    document.getElementById('daily-text').textContent = 'Claim your daily bonus!';
  }
}

// ── Shop ─────────────────────────────────────────────────────────────────────
function openShop() {
  const s = loadGame();
  showScreen('shop');
  document.getElementById('shop-coins').textContent = s.coins || 0;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  Object.values(WEAPONS).forEach(w => {
    const owned = (s.weapons || ['rifle']).includes(w.id);
    const equipped = s.equippedWeapon === w.id;
    const canAfford = (s.coins || 0) >= w.cost;
    const card = document.createElement('div');
    card.className = `shop-card${owned ? ' owned' : ''}${equipped ? ' equipped-card' : ''}`;
    card.innerHTML = `
      ${owned ? `<div class="shop-badge${equipped ? ' eq' : ''}">${equipped ? 'EQUIPPED' : 'OWNED'}</div>` : ''}
      <div class="shop-emoji">${w.emoji}</div>
      <div class="shop-name">${w.name}</div>
      <div class="shop-desc">${w.desc}</div>
      <div class="shop-stats">
        <span>DMG: ${w.damage}${w.pellets ? ` × ${w.pellets}` : ''} | FIRE: ${(1000 / w.fireRate).toFixed(1)}/s</span>
        <span>AMMO: ${w.maxAmmo} | RELOAD: ${(w.reloadTime / 1000).toFixed(1)}s</span>
      </div>
      ${w.cost === 0 ? '<div class="shop-price">FREE</div>' : `<div class="shop-price">💰 ${w.cost}</div>`}
      ${owned
        ? `<button class="btn-main buy-btn equip-shop" data-id="${w.id}">${equipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`
        : `<button class="btn-main buy-btn" data-id="${w.id}" ${!canAfford ? 'disabled' : ''}>BUY${!canAfford ? ' (need ' + w.cost + ')' : ''}</button>`}
    `;
    const btn = card.querySelector('.buy-btn');
    btn?.addEventListener('click', () => {
      const save = loadGame();
      if (btn.classList.contains('equip-shop')) {
        save.equippedWeapon = w.id; saveGame(save); openShop();
      } else if ((save.coins || 0) >= w.cost) {
        save.coins -= w.cost;
        if (!save.weapons) save.weapons = ['rifle'];
        if (!save.weapons.includes(w.id)) save.weapons.push(w.id);
        save.equippedWeapon = w.id;
        saveGame(save); openShop();
      }
    });
    grid.appendChild(card);
  });
}

// ── Window resize ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => { if (engine) engine._resizeCanvas(); });

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateHome();
  showScreen('home');

  document.getElementById('btn-start').addEventListener('click', () => startGame(1));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(currentLevel));
  document.getElementById('btn-dashboard').addEventListener('click', openDashboard);
  document.getElementById('btn-shop').addEventListener('click', openShop);
  document.getElementById('dash-back').addEventListener('click', () => { updateHome(); showScreen('home'); });
  document.getElementById('shop-back').addEventListener('click', () => { updateHome(); showScreen('home'); });

  document.getElementById('btn-pause').addEventListener('click', () => {
    if (engine && !engine.paused) { engine.pause(); document.getElementById('pause-overlay').classList.remove('hidden'); }
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    document.getElementById('pause-overlay').classList.add('hidden'); engine?.resume();
  });
  document.getElementById('btn-quit-game').addEventListener('click', () => {
    engine?.stop(); engine?.removeInput(); engine = null;
    document.getElementById('pause-overlay').classList.add('hidden');
    updateHome(); showScreen('home');
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    if (lastResult) startGame(lastResult.level);
  });
  document.getElementById('btn-menu-go').addEventListener('click', () => { updateHome(); showScreen('home'); });
  document.getElementById('btn-next-lvl').addEventListener('click', () => {
    if (lastResult) startGame(lastResult.level + 1);
  });
  document.getElementById('btn-menu-v').addEventListener('click', () => { updateHome(); showScreen('home'); });

  document.getElementById('btn-save-name').addEventListener('click', () => {
    const name = document.getElementById('username-input').value.trim();
    if (name) { const s = loadGame(); s.username = name; saveGame(s); }
    openDashboard();
  });

  document.getElementById('btn-daily').addEventListener('click', () => {
    const s = loadGame();
    const reward = claimDailyReward(s);
    if (reward) {
      document.getElementById('daily-text').textContent = `+${reward} coins claimed! 🎉`;
      document.getElementById('btn-daily').disabled = true;
      document.getElementById('btn-daily').textContent = '✓ CLAIMED TODAY';
      document.getElementById('d-coins').textContent = s.coins;
    } else {
      document.getElementById('daily-text').textContent = 'Already claimed today!';
    }
  });
});
