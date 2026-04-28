// weapons.js — Weapon and enemy configuration data

export const WEAPONS = {
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    emoji: '🔫',
    damage: 25,
    fireRate: 380,    // ms between shots
    maxAmmo: 30,
    reloadTime: 1800,
    bulletSpeed: 900,
    cost: 0,
    color: '#88aacc',
    desc: 'Reliable, balanced. Good for all situations.',
    spread: 0
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Rifle',
    emoji: '🎯',
    damage: 120,
    fireRate: 1600,
    maxAmmo: 8,
    reloadTime: 2500,
    bulletSpeed: 1600,
    cost: 500,
    color: '#88ccaa',
    desc: 'One-shot power. Slow fire rate, limited ammo.',
    spread: 0
  },
  machinegun: {
    id: 'machinegun',
    name: 'Machine Gun',
    emoji: '💥',
    damage: 12,
    fireRate: 80,
    maxAmmo: 60,
    reloadTime: 3000,
    bulletSpeed: 800,
    cost: 800,
    color: '#cc8844',
    desc: 'Spray and pray! Rapid fire with high ammo.',
    spread: 0.1
  },
  shotgun: {
    id: 'shotgun',
    name: 'Combat Shotgun',
    emoji: '🌀',
    damage: 22,
    fireRate: 900,
    maxAmmo: 8,
    reloadTime: 2200,
    bulletSpeed: 700,
    cost: 600,
    color: '#cc6644',
    desc: 'Deadly at close range. 5-pellet spread.',
    spread: 0.25,
    pellets: 5
  }
};

export const ENEMY_CONFIGS = {
  basic: {
    w: 40, h: 54,
    speed: 80,
    health: 60,
    damage: 12,
    attackRange: 45,
    attackRate: 1200,
    coinReward: 5,
    scoreValue: 100,
    color: '#8B2222'
  },
  fast: {
    w: 34, h: 48,
    speed: 160,
    health: 35,
    damage: 8,
    attackRange: 40,
    attackRate: 700,
    coinReward: 8,
    scoreValue: 150,
    color: '#6622AA'
  },
  tank: {
    w: 52, h: 64,
    speed: 45,
    health: 220,
    damage: 25,
    attackRange: 50,
    attackRate: 2000,
    coinReward: 20,
    scoreValue: 300,
    color: '#444444'
  },
  boss: {
    w: 72, h: 80,
    speed: 60,
    health: 800,
    damage: 35,
    attackRange: 70,
    attackRate: 1800,
    coinReward: 100,
    scoreValue: 1000,
    color: '#220033'
  }
};

export function getLevelDef(level) {
  const isBoss = level % 5 === 0;
  const baseWaves = 3 + Math.floor(level / 4);
  const waves = [];

  for (let w = 0; w < baseWaves; w++) {
    const list = [];
    // Basic enemies always present
    const basic = 3 + level + Math.floor(w * 1.5);
    for (let i = 0; i < basic; i++) list.push('basic');
    // Fast enemies from level 2
    if (level >= 2) {
      const fast = Math.floor(level / 2) + w;
      for (let i = 0; i < fast; i++) list.push('fast');
    }
    // Tank enemies from level 3
    if (level >= 3) {
      const tanks = Math.floor((level - 2) / 2);
      for (let i = 0; i < tanks; i++) list.push('tank');
    }
    waves.push(list);
  }

  // Boss wave
  if (isBoss) {
    const bossWave = ['boss'];
    const support = 2 + level;
    for (let i = 0; i < support; i++) bossWave.push(i % 2 === 0 ? 'fast' : 'basic');
    waves.push(bossWave);
  }

  return { waves, isBoss };
}
