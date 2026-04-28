// storage.js — LocalStorage save/load system

const SAVE_KEY = 'shadow_rifle_save';

const DEFAULT_SAVE = {
  username: 'Ghost',
  coins: 100,
  level: 1,
  weapons: ['rifle'],
  equippedWeapon: 'rifle',
  stats: {
    kills: 0,
    levelsCompleted: 0,
    highScore: 0,
    totalCoinsEarned: 100
  },
  dailyReward: null
};

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, stats: { ...DEFAULT_SAVE.stats } };
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle new fields
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      stats: { ...DEFAULT_SAVE.stats, ...parsed.stats }
    };
  } catch (e) {
    return { ...DEFAULT_SAVE, stats: { ...DEFAULT_SAVE.stats } };
  }
}

export function saveGame(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save game:', e);
  }
}

export function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  return { ...DEFAULT_SAVE, stats: { ...DEFAULT_SAVE.stats } };
}

export function getRank(kills) {
  if (kills >= 500) return 'GENERAL';
  if (kills >= 200) return 'COLONEL';
  if (kills >= 100) return 'MAJOR';
  if (kills >= 50)  return 'CAPTAIN';
  if (kills >= 20)  return 'SERGEANT';
  if (kills >= 5)   return 'CORPORAL';
  return 'PRIVATE';
}

export function claimDailyReward(save) {
  const today = new Date().toDateString();
  if (save.dailyReward === today) return null;
  const reward = 50;
  save.dailyReward = today;
  save.coins = (save.coins || 0) + reward;
  save.stats.totalCoinsEarned = (save.stats.totalCoinsEarned || 0) + reward;
  saveGame(save);
  return reward;
}
