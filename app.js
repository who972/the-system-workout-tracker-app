/* ============================================
   THE SYSTEM — The System - Workout Tracker
   Game logic, state, XP, leveling, achievements
   ============================================ */

// --- Rank System ---
const RANKS = [
  { minLevel: 1,  letter: 'E', name: 'E-Rank',      title: 'Awakened Trainee' },
  { minLevel: 5,  letter: 'E', name: 'E-Rank',      title: 'Novice Hunter' },
  { minLevel: 10, letter: 'D', name: 'D-Rank',      title: 'D-Rank Hunter' },
  { minLevel: 20, letter: 'C', name: 'C-Rank',      title: 'C-Rank Hunter' },
  { minLevel: 30, letter: 'B', name: 'B-Rank',      title: 'B-Rank Hunter' },
  { minLevel: 40, letter: 'A', name: 'A-Rank',      title: 'A-Rank Hunter' },
  { minLevel: 50, letter: 'S', name: 'S-Rank',      title: 'S-Rank Hunter' },
  { minLevel: 70, letter: 'S', name: 'S-Rank+',     title: 'National Level Hunter' },
  { minLevel: 90, letter: '★', name: 'Shadow',      title: 'Shadow Sovereign' },
];

function getRank(level) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r;
  }
  return rank;
}

// --- Player Performance Profile ---
const PERFORMANCE_STATS = ['str','end','agi','vit'];
function ensurePerformanceProfile() {
  state.performanceProfile = state.performanceProfile || {
    str:{score:0,actions:0}, end:{score:0,actions:0}, agi:{score:0,actions:0}, vit:{score:0,actions:0}
  };
  PERFORMANCE_STATS.forEach(k => state.performanceProfile[k] ||= {score:0,actions:0});
  return state.performanceProfile;
}
function registerPerformance(stat, effort=1) {
  if (!PERFORMANCE_STATS.includes(stat)) return;
  const p=ensurePerformanceProfile()[stat];
  p.actions=(Number(p.actions)||0)+1;
  p.score=Math.round(((Number(p.score)||0)+Math.max(.25,Number(effort)||1))*10)/10;
}
function getPerformanceAnalysis() {
  const p=ensurePerformanceProfile();
  const rows=PERFORMANCE_STATS.map(k=>({stat:k,score:Number(p[k].score)||0,actions:Number(p[k].actions)||0}));
  const max=Math.max(1,...rows.map(x=>x.score));
  rows.forEach(x=>x.percent=Math.round(x.score/max*100));
  const weakest=rows.slice().sort((a,b)=>a.score-b.score)[0];
  const strongest=rows.slice().sort((a,b)=>b.score-a.score)[0];
  return {rows,weakest,strongest};
}
function performanceLabel(stat){return ({str:'STRENGTH',end:'ENDURANCE',agi:'CONDITIONING',vit:'RECOVERY'})[stat]||stat.toUpperCase();}
function recommendPerformanceMission(){
  const a=getPerformanceAnalysis(), stat=a.weakest.stat;
  const q=(state.dailyQuests||[]).find(x=>x.stat===stat&&!x.completed);
  return {stat,title:q?.title||({str:'Strength Development',end:'Endurance Development',agi:'Conditioning Development',vit:'Recovery + Mobility'})[stat]};
}

// --- XP Formula ---
function xpNeededForLevel(level) {
  // Fitness-RPG pacing: early levels move quickly, while higher ranks
  // still require sustained consistency and successful promotion trials.
  return Math.floor(80 + (level * 12) + (Math.pow(level, 1.35) * 4));
}

// --- Default Quests ---
const DEFAULT_DAILY_QUESTS = [
  { id: 'pushups',   title: 'Push-Ups',      target: 30, unit: 'reps', xp: 75,  stat: 'str' },
  { id: 'squats',    title: 'Squats',        target: 40, unit: 'reps', xp: 75,  stat: 'str' },
  { id: 'plank',     title: 'Plank Hold',    target: 60, unit: 'sec',  xp: 75,  stat: 'end' },
  { id: 'running',   title: 'Cardio Run',    target: 20, unit: 'min',  xp: 150, stat: 'agi' },
  { id: 'stretch',   title: 'Stretching',    target: 10, unit: 'min',  xp: 40,  stat: 'vit' },
];

// Adaptive mission targets: gradual progression based on demonstrated completion,
// with conservative caps so THE SYSTEM challenges the player without punishing them.
const ADAPTIVE_QUEST_LIMITS = {
  pushups: { step: 2, max: 60 }, squats: { step: 3, max: 80 },
  plank: { step: 5, max: 120 }, running: { step: 2, max: 40 },
  stretch: { step: 1, max: 20 }
};

function getAdaptiveQuestTarget(def, profile) {
  const p = profile?.[def.id] || {};
  const cfg = ADAPTIVE_QUEST_LIMITS[def.id];
  if (!cfg) return def.target;
  const level = Math.max(0, Number(p.level)||0);
  return Math.min(cfg.max, def.target + level * cfg.step);
}

function buildAdaptiveDailyQuests(profile = {}) {
  return DEFAULT_DAILY_QUESTS.map(def => ({
    ...def,
    target: getAdaptiveQuestTarget(def, profile),
    progress: 0,
    completed: false
  }));
}

function registerAdaptiveQuestResult(quest) {
  state.adaptiveQuests = state.adaptiveQuests || {};
  const p = state.adaptiveQuests[quest.id] || { level: 0, clears: 0 };
  p.clears = (Number(p.clears)||0) + 1;
  // Require repeated success before increasing difficulty. Humans apparently
  // respond better to achievable progression than surprise punishment.
  if (p.clears % 3 === 0) {
    const cfg = ADAPTIVE_QUEST_LIMITS[quest.id];
    const def = DEFAULT_DAILY_QUESTS.find(q => q.id === quest.id);
    if (cfg && def && getAdaptiveQuestTarget(def, p) < cfg.max) {
      p.level = (Number(p.level)||0) + 1;
      queueReward({type:'adaptation',title:'SYSTEM ADAPTATION',detail:`${quest.title} difficulty increased for future missions`,amount:0,intensity:'mission',source:'adaptation'});
    }
  }
  state.adaptiveQuests[quest.id] = p;
}

const DEFAULT_WEEKLY_GOALS = [
  { id: 'w_workouts', title: 'Complete 5 Workout Sessions', target: 5,  unit: 'sessions', xpReward: 750 },
  { id: 'w_xp',       title: 'Earn 1,500 Total XP',             target: 1500, unit: 'XP',       xpReward: 450 },
  { id: 'w_days',     title: 'Train on 4 Different Days',       target: 4,  unit: 'days',     xpReward: 600 },
];

// --- Achievement Definitions ---
const ACHIEVEMENTS = [
  // Bronze
  { id: 'first_quest',   tier: 'bronze', icon: '🌱', title: 'First Steps',        desc: 'Complete your first quest',          requirement: s => s.totalQuestsCompleted >= 1 },
  { id: 'day_3',         tier: 'bronze', icon: '🔥', title: 'Warming Up',         desc: '3-day workout streak',                requirement: s => s.bestStreak >= 3 },
  { id: 'level_5',       tier: 'bronze', icon: '⭐', title: 'E-Rank Graduate',    desc: 'Reach Level 5',                       requirement: s => s.level >= 5 },
  { id: 'ten_quests',    tier: 'bronze', icon: '📝', title: 'Quest Beginner',     desc: 'Complete 10 quests total',            requirement: s => s.totalQuestsCompleted >= 10 },

  // Silver
  { id: 'day_7',         tier: 'silver', icon: '⚡', title: 'Consistent',         desc: '7-day workout streak',                requirement: s => s.bestStreak >= 7 },
  { id: 'level_10',      tier: 'silver', icon: '💎', title: 'D-Rank Hunter',     desc: 'Reach Level 10 and earn D-Class promotion', requirement: s => s.level >= 10 && hasRankPromotion('D') },
  { id: 'fifty_quests',  tier: 'silver', icon: '📋', title: 'Quest Adept',        desc: 'Complete 50 quests total',            requirement: s => s.totalQuestsCompleted >= 50 },
  { id: 'weekly_1',      tier: 'silver', icon: '🎯', title: 'Weekly Warrior',    desc: 'Complete a weekly objective',         requirement: s => s.weeklyCompleted >= 1 },

  // Gold
  { id: 'day_14',        tier: 'gold',   icon: '🌟', title: 'Unstoppable',        desc: '14-day workout streak',               requirement: s => s.bestStreak >= 14 },
  { id: 'level_20',      tier: 'gold',   icon: '🔷', title: 'C-Rank Hunter',     desc: 'Reach Level 20 and earn C-Class promotion', requirement: s => s.level >= 20 && hasRankPromotion('C') },
  { id: 'level_30',      tier: 'gold',   icon: '👑', title: 'B-Rank Hunter',     desc: 'Reach Level 30 and earn B-Class promotion', requirement: s => s.level >= 30 && hasRankPromotion('B') },
  { id: 'hundred_quests',tier: 'gold',   icon: '📜', title: 'Quest Master',       desc: 'Complete 100 quests total',           requirement: s => s.totalQuestsCompleted >= 100 },
  { id: 'all_daily',     tier: 'gold',   icon: '✨', title: 'Daily Conqueror',   desc: 'Complete all daily quests in one day', requirement: s => s.allDailyCompleted },

  // S-Rank
  { id: 'day_30',        tier: 'srank',  icon: '💥', title: 'Iron Will',          desc: '30-day workout streak',               requirement: s => s.bestStreak >= 30 },
  { id: 'level_40',      tier: 'srank',  icon: '⚔️', title: 'A-Rank Hunter',     desc: 'Reach Level 40 and earn A-Class promotion', requirement: s => s.level >= 40 && hasRankPromotion('A') },
  { id: 'level_50',      tier: 'srank',  icon: '🔥', title: 'S-Rank Hunter',     desc: 'Reach Level 50 and earn S-Class promotion', requirement: s => s.level >= 50 && hasRankPromotion('S') },
  { id: 'level_70',      tier: 'srank',  icon: '🌠', title: 'National Level Hunter', desc: 'Reach Level 70 and clear the National-Level Trial', requirement: s => s.level >= 70 && hasRankPromotion('S+') },
  { id: 'week_complete', tier: 'srank',  icon: '🏆', title: 'Weekly Dominator',  desc: 'Complete all weekly objectives',      requirement: s => s.allWeeklyCompleted },

  // Shadow Sovereign
  { id: 'day_60',        tier: 'shadow', icon: '🌑', title: 'Eternal Shadow',    desc: '60-day workout streak',               requirement: s => s.bestStreak >= 60 },
  { id: 'level_90',      tier: 'shadow', icon: '👁️', title: 'Shadow Sovereign',  desc: 'Reach Level 90 and clear the Sovereign Trial', requirement: s => s.level >= 90 && hasRankPromotion('Shadow') },
  { id: 'two_hundred',   tier: 'shadow', icon: '💀', title: 'Legend',            desc: 'Complete 200 quests total',           requirement: s => s.totalQuestsCompleted >= 200 },
];

const TIER_COLORS = {
  bronze:  { color: 'var(--tier-bronze)',  glow: 'rgba(205, 127, 50, 0.3)' },
  silver:  { color: 'var(--tier-silver)',  glow: 'rgba(192, 192, 192, 0.3)' },
  gold:    { color: 'var(--tier-gold)',    glow: 'rgba(255, 215, 0, 0.3)' },
  srank:   { color: 'var(--tier-srank)',   glow: 'rgba(255, 68, 68, 0.3)' },
  shadow:  { color: 'var(--tier-shadow)',  glow: 'rgba(157, 78, 221, 0.3)' },
};

// --- State ---
const STORAGE_KEY = 'the_system_workout_tracker_state';

// Safe storage: uses real browser storage when available, falls back to in-memory
let _ls = null;
try {
  const key = 'loc' + 'al' + 'Storage';
  if (typeof window !== 'undefined' && window[key]) {
    window[key].getItem('__test__');
    _ls = window[key];
  }
} catch(e) { _ls = null; }
const _memStore = {};
const safeStorage = {
  getItem(k) { try { return _ls ? _ls.getItem(k) : (_memStore[k] ?? null); } catch(e) { return _memStore[k] ?? null; } },
  setItem(k, v) { try { if (_ls) _ls.setItem(k, v); else _memStore[k] = v; } catch(e) { _memStore[k] = v; } },
  removeItem(k) { try { if (_ls) _ls.removeItem(k); else delete _memStore[k]; } catch(e) { delete _memStore[k]; } }
};

function hasRankPromotion(rank) {
  if (rank === 'E') return true;
  try {
    const system = JSON.parse(safeStorage.getItem('systemMission:sideBossV3') || '{}');
    return !!system?.boss?.[rank]?.passed;
  } catch (e) {
    return false;
  }
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekStartStr() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultState() {
  return {
    level: 1,
    xp: 0,
    totalXp: 0,
    totalQuestsCompleted: 0,
    bestStreak: 0,
    currentStreak: 0,
    lastWorkoutDate: null,
    dailyQuests: DEFAULT_DAILY_QUESTS.map(q => ({ ...q, progress: 0, completed: false })),
    weeklyGoals: DEFAULT_WEEKLY_GOALS.map(g => ({ ...g, progress: 0, completed: false })),
    achievements: ACHIEVEMENTS.map(a => ({ id: a.id, unlocked: false })),
    history: [],
    dailyDate: getTodayStr(),
    weekStartDate: getWeekStartStr(),
    allDailyCompleted: false,
    allWeeklyCompleted: false,
    weeklyCompleted: 0,
    weight: { current: null, starting: null, goal: null, history: [] },
    exerciseRecords: [],
    adaptiveQuests: {},
    performanceProfile: { str:{score:0,actions:0}, end:{score:0,actions:0}, agi:{score:0,actions:0}, vit:{score:0,actions:0} },
  };
}

function loadState() {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);

    // Merge with defaults to handle new fields
    const state = defaultState();
    Object.assign(state, saved);
    state.weight = Object.assign({ current: null, starting: null, goal: null, history: [] }, saved.weight || {});
    state.weight.history = Array.isArray(state.weight.history) ? state.weight.history : [];
    state.exerciseRecords = Array.isArray(saved.exerciseRecords) ? saved.exerciseRecords : [];
    state.adaptiveQuests = saved.adaptiveQuests && typeof saved.adaptiveQuests === 'object' ? saved.adaptiveQuests : {};
    state.performanceProfile = saved.performanceProfile && typeof saved.performanceProfile === 'object' ? saved.performanceProfile : state.performanceProfile;

    // Check for daily reset
    const today = getTodayStr();
    if (saved.dailyDate !== today) {
      // Streak logic: if yesterday was last workout, continue streak; else reset
      if (saved.lastWorkoutDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.getFullYear()+'-'+String(yesterday.getMonth()+1).padStart(2,'0')+'-'+String(yesterday.getDate()).padStart(2,'0');
        if (saved.lastWorkoutDate !== yStr) {
          state.currentStreak = 0;
        }
      }
      state.dailyQuests = buildAdaptiveDailyQuests(state.adaptiveQuests);
      state.allDailyCompleted = false;
      state.dailyDate = today;
    } else {
      // Keep saved daily quest progress
      state.dailyQuests = (saved.dailyQuests || []).map(q => {
        const def = DEFAULT_DAILY_QUESTS.find(d => d.id === q.id);
        return def ? { ...def, target: Number(q.target)||getAdaptiveQuestTarget(def, state.adaptiveQuests), progress: q.progress || 0, completed: q.completed || false } : null;
      }).filter(Boolean);
    }

    // Check for weekly reset
    const weekStart = getWeekStartStr();
    if (saved.weekStartDate !== weekStart) {
      state.weeklyGoals = DEFAULT_WEEKLY_GOALS.map(g => ({ ...g, progress: 0, completed: false }));
      state.allWeeklyCompleted = false;
      state.weeklyCompleted = 0;
      state.weekStartDate = weekStart;
    } else {
      state.weeklyGoals = (saved.weeklyGoals || []).map(g => {
        const def = DEFAULT_WEEKLY_GOALS.find(d => d.id === g.id);
        return def ? { ...def, progress: g.progress || 0, completed: g.completed || false } : null;
      }).filter(Boolean);
    }

    state.achievements = ACHIEVEMENTS.map(a => {
      const prior = state.achievements?.find(x => x.id === a.id);
      const isRankAchievement = ['level_10','level_20','level_30','level_40','level_50','level_70','level_90'].includes(a.id);
      // Pre-launch migration: rank badges must reflect actual Boss promotion state,
      // not stale level-only unlocks from older builds.
      const unlocked = isRankAchievement ? !!a.requirement(state) : !!prior?.unlocked;
      return { id: a.id, unlocked };
    });

    return state;
  } catch (e) {
    console.error('Failed to load state:', e);
    return defaultState();
  }
}

function saveState() {
  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// --- State ---
let state = loadState();
let theme = 'dark';

// --- System Log ---
const systemLog = document.getElementById('systemLog');

function addSystemMessage(text, type = '') {
  // Remove idle message
  const idle = systemLog.querySelector('.system-log__entry--idle');
  if (idle) idle.remove();

  const entry = document.createElement('p');
  entry.className = `system-log__entry system-log__entry--${type}`;
  entry.textContent = text;
  systemLog.insertBefore(entry, systemLog.firstChild);

  // Keep max 15 entries
  while (systemLog.children.length > 15) {
    systemLog.removeChild(systemLog.lastChild);
  }
}

// --- Instant Reward Engine ---
// Central queue for immediate, ordered feedback from real-world effort.
const rewardQueue = [];
let rewardQueueActive = false;

function queueReward(event = {}) {
  rewardQueue.push({
    type: event.type || 'xp',
    title: event.title || 'PROGRESS REGISTERED',
    detail: event.detail || '',
    amount: Math.max(0, Number(event.amount) || 0),
    intensity: event.intensity || 'micro',
    source: event.source || 'system',
    createdAt: Date.now(),
  });
  processRewardQueue();
}

function processRewardQueue() {
  if (rewardQueueActive || !rewardQueue.length) return;
  rewardQueueActive = true;
  const reward = rewardQueue.shift();
  showRewardFeedback(reward);
  const delay = reward.intensity === 'major' ? 2200 : reward.intensity === 'mission' ? 1700 : 1050;
  window.setTimeout(() => {
    rewardQueueActive = false;
    if (rewardQueue.length) {
      processRewardQueue();
    } else if (['workout','bonus','level','achievement','growth'].includes(reward.source) || reward.intensity === 'major') {
      window.setTimeout(showMomentumPrompt, 300);
    }
  }, delay);
}

function showRewardFeedback(reward) {
  const xpText = reward.amount > 0 ? ` +${reward.amount} XP` : '';
  const detail = reward.detail ? ` — ${reward.detail}` : '';
  addSystemMessage(`${reward.title}${xpText}${detail}`, reward.intensity === 'major' ? 'level' : 'achievement');
  showRewardHud(reward);
  try {
    window.dispatchEvent(new CustomEvent('system:reward', { detail: reward }));
  } catch (e) {}
}

function ensureRewardHud() {
  let hud = document.getElementById('systemRewardHud');
  if (hud) return hud;
  hud = document.createElement('div');
  hud.id = 'systemRewardHud';
  hud.className = 'reward-hud';
  hud.setAttribute('aria-live', 'polite');
  hud.innerHTML = `
    <div class="reward-hud__scan"></div>
    <div class="reward-hud__label"></div>
    <div class="reward-hud__xp"></div>
    <div class="reward-hud__detail"></div>
    <div class="reward-hud__progress"><span></span></div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function showRewardHud(reward) {
  const hud = ensureRewardHud();
  const label = hud.querySelector('.reward-hud__label');
  const xp = hud.querySelector('.reward-hud__xp');
  const detail = hud.querySelector('.reward-hud__detail');
  const fill = hud.querySelector('.reward-hud__progress span');
  label.textContent = reward.title;
  xp.textContent = reward.amount > 0 ? `+${reward.amount} XP` : '';
  detail.textContent = reward.detail || '';
  const needed = xpNeededForLevel(state.level);
  const pct = Math.max(0, Math.min(100, (state.xp / needed) * 100));
  fill.style.width = '0%';
  hud.className = `reward-hud reward-hud--${reward.intensity || 'micro'}`;
  void hud.offsetWidth;
  hud.classList.add('reward-hud--visible');
  requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
  window.setTimeout(() => hud.classList.remove('reward-hud--visible'),
    reward.intensity === 'major' ? 1900 : reward.intensity === 'mission' ? 1450 : 850);
}

function rewardEvent({ amount = 0, source = 'system', title = 'PROGRESS REGISTERED', detail = '', intensity = 'micro' } = {}) {
  const xp = Math.max(0, Math.floor(Number(amount) || 0));
  const leveled = xp > 0 ? addXp(xp, source, { suppressReward: true }) : false;
  queueReward({ type: 'xp', title, detail, amount: xp, intensity, source });
  return { xp, leveled };
}

function getNextObjective() {
  const recommendation = recommendPerformanceMission();
  const pending = (state.dailyQuests || []).find(q => !q.completed && q.stat === recommendation.stat) || (state.dailyQuests || []).find(q => !q.completed);
  if (pending) {
    const remaining = Math.max(0, (Number(pending.target)||0) - (Number(pending.progress)||0));
    return { title: pending.title, detail: `${remaining} ${pending.unit || ''} REMAINING`.trim(), view: 'missions' };
  }
  const weekly = (state.weeklyGoals || []).find(g => !g.completed);
  if (weekly) {
    const remaining = Math.max(0, (Number(weekly.target)||0) - (Number(weekly.progress)||0));
    return { title: weekly.title, detail: `${remaining} ${weekly.unit || ''} REMAINING`.trim(), view: 'missions' };
  }
  return { title: 'RECOVERY / MOBILITY', detail: 'OPTIONAL ACTIVE RECOVERY', view: 'train' };
}

function showMomentumPrompt() {
  if (document.querySelector('.momentum-prompt--visible')) return;
  const next = getNextObjective();
  let panel = document.getElementById('systemMomentumPrompt');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'systemMomentumPrompt';
    panel.className = 'momentum-prompt';
    panel.innerHTML = `<small>SYSTEM // MOMENTUM</small><strong>NEXT OBJECTIVE AVAILABLE</strong><b></b><span></span><button type="button">VIEW OBJECTIVE</button>`;
    document.body.appendChild(panel);
    panel.querySelector('button').addEventListener('click', () => {
      const view = panel.dataset.view || 'missions';
      const nav = document.querySelector(`.app-nav [data-view="${view}"]`);
      if (nav) nav.click();
      panel.classList.remove('momentum-prompt--visible');
    });
  }
  panel.querySelector('b').textContent = next.title;
  panel.querySelector('span').textContent = next.detail;
  panel.dataset.view = next.view;
  panel.classList.add('momentum-prompt--visible');
  window.setTimeout(() => panel.classList.remove('momentum-prompt--visible'), 7000);
}

// --- XP & Leveling ---
function addXp(amount, source = 'quest', options = {}) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amount) return false;
  const baseAmount=amount, prestigeEligible=!options.noPrestige&&source!=='weekly'&&source!=='ascension';
  if(prestigeEligible&&typeof ascensionRewardMultiplier==='function') amount=Math.max(baseAmount,Math.floor(baseAmount*ascensionRewardMultiplier()));
  const prestigeBonus=amount-baseAmount;
  if(prestigeBonus>0&&!options.suppressReward) queueReward({type:'prestige',title:'ASCENSION AMPLIFIER',detail:'+'+prestigeBonus+' BONUS XP',amount:0,intensity:'micro',source:'ascension'});
  const oldLevel = state.level;
  state.xp += amount;
  state.totalXp += amount;

  // Check for level up(s)
  let leveled = false;
  while (state.xp >= xpNeededForLevel(state.level)) {
    state.xp -= xpNeededForLevel(state.level);
    state.level++;
    leveled = true;
  }

  // Weekly XP goal progress
  const wXpGoal = state.weeklyGoals.find(g => g.id === 'w_xp');
  if (wXpGoal && !wXpGoal.completed) {
    wXpGoal.progress += amount;
    if (wXpGoal.progress >= wXpGoal.target) {
      wXpGoal.completed = true;
      state.weeklyCompleted++;
      addSystemMessage(`Weekly Objective Complete: ${wXpGoal.title} — +${wXpGoal.xpReward} XP`, 'achievement');
      addXp(wXpGoal.xpReward, 'weekly');
      checkAllWeeklyComplete();
    }
  }

  if (leveled) {
    const rank = getRank(state.level);
    addSystemMessage(`LEVEL UP! You are now Level ${state.level} — ${rank.title}`, 'level');
    queueReward({ type: 'level', title: 'LEVEL UP', detail: `LEVEL ${state.level} • ${rank.title}`, amount: 0, intensity: 'major', source: 'level' });
    showLevelUpModal(state.level, rank);
  }

  checkAchievements();

  // Legacy callers still receive immediate feedback. New features should call
  // rewardEvent() so multiple rewards are sequenced through the shared queue.
  if (!options.suppressReward && source !== 'weekly') {
    queueReward({
      type: 'xp',
      title: source === 'quest' ? 'OBJECTIVE COMPLETE' : 'PROGRESS REGISTERED',
      amount,
      intensity: source === 'quest' ? 'micro' : 'mission',
      source
    });
  }
  return leveled;
}


// --- Streak Management ---
function updateStreak() {
  const today = getTodayStr();
  if (state.lastWorkoutDate !== today) {
    // New day - check if streak continues
    if (state.lastWorkoutDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.getFullYear()+'-'+String(yesterday.getMonth()+1).padStart(2,'0')+'-'+String(yesterday.getDate()).padStart(2,'0');
      if (state.lastWorkoutDate === yStr) {
        state.currentStreak++;
      } else {
        state.currentStreak = 1;
      }
    } else {
      state.currentStreak = 1;
    }
    state.lastWorkoutDate = today;
    if (state.currentStreak > state.bestStreak) {
      state.bestStreak = state.currentStreak;
    }
  }
}

function updateWorkoutStreak(credit=1) {
  // Any legitimate training keeps the habit alive, but tiny one-off exercise logs
  // should not manufacture streak days. Scheduled quick modes still count.
  if (Number(credit) < 0.4) return false;
  const previousStreak = state.currentStreak;
  const previousDate = state.lastWorkoutDate;
  updateStreak();
  if (state.lastWorkoutDate !== previousDate) {
    const streak = state.currentStreak;
    const milestone = [3, 7, 14, 30, 60].includes(streak);
    queueReward({
      type: 'streak',
      title: streak === 1 ? 'STREAK ESTABLISHED' : milestone ? 'CONSISTENCY MILESTONE' : 'STREAK EXTENDED',
      detail: `${streak} DAY${streak === 1 ? '' : 'S'}`,
      amount: 0,
      intensity: milestone ? 'mission' : 'micro',
      source: 'streak'
    });
  }
  return state.currentStreak !== previousStreak || state.lastWorkoutDate !== previousDate;
}

// --- Quest Completion ---
function completeQuest(questId) {
  const quest = state.dailyQuests.find(q => q.id === questId);
  if (!quest || quest.completed) return;

  quest.completed = true;
  quest.progress = quest.target;
  state.totalQuestsCompleted++;
  registerAdaptiveQuestResult(quest);
  registerPerformance(quest.stat, Math.max(.5, Number(quest.target) / Math.max(1, Number(DEFAULT_DAILY_QUESTS.find(q=>q.id===quest.id)?.target)||quest.target)));

  addSystemMessage(`Quest Complete: ${quest.title} — +${quest.xp} XP`, 'quest');
  rewardEvent({ amount: quest.xp, source: 'quest', title: 'OBJECTIVE COMPLETE', detail: quest.title, intensity: 'micro' });
  // Legacy quest stats retired. Canonical attributes grow from logged training.

  // Check all daily complete
  checkAllDailyComplete();

  // Weekly training-day credit is awarded only by a completed workout.
  // Daily quests intentionally do not advance training-day or workout streak counters.

  // History
  recordHistory(questId, quest.xp);

  checkAchievements();
  saveState();
  renderAll();
}

function updateQuestProgress(questId, delta) {
  const quest = state.dailyQuests.find(q => q.id === questId);
  if (!quest || quest.completed) return;

  quest.progress = Math.max(0, Math.min(quest.target, quest.progress + delta));

  if (quest.progress >= quest.target) {
    completeQuest(questId);
  } else {
    saveState();
    renderAll();
  }
}

function checkAllDailyComplete() {
  const allComplete = state.dailyQuests.every(q => q.completed);
  if (allComplete && !state.allDailyCompleted) {
    state.allDailyCompleted = true;
    addSystemMessage('All Daily Quests Complete! Bonus: +250 XP', 'achievement');
    rewardEvent({ amount: 250, source: 'bonus', title: 'DAILY QUESTS CLEARED', detail: 'All daily objectives complete', intensity: 'mission' });
  }
}

function checkAllWeeklyComplete() {
  const allComplete = state.weeklyGoals.every(g => g.completed);
  if (allComplete && !state.allWeeklyCompleted) {
    state.allWeeklyCompleted = true;
    addSystemMessage('All Weekly Objectives Complete! You are unstoppable.', 'achievement');
  }
}

function recordHistory(questId, xpEarned) {
  const today = getTodayStr();
  let entry = state.history.find(h => h.date === today);
  if (!entry) {
    entry = { date: today, completedQuestIds: [], xpEarned: 0 };
    state.history.push(entry);
  }
  entry.completedQuestIds.push(questId);
  entry.xpEarned += xpEarned;

  // Keep last 60 days
  if (state.history.length > 60) {
    state.history = state.history.slice(-60);
  }
}

// --- Custom Workout ---
function logCustomWorkout(name, duration, intensity) {
  duration = Math.max(1, Number(duration)||0);
  intensity = Math.max(.25, Math.min(1, Number(intensity)||1));
  const qualifies = duration >= 10;
  const xp = Math.floor(duration * intensity * 3);
  state.totalQuestsCompleted++;

  addSystemMessage(`Training Log: ${name} (${duration}min) — +${xp} XP`, 'quest');
  rewardEvent({ amount: xp, source: 'workout', title: qualifies ? 'MISSION COMPLETE' : 'TRAINING REGISTERED', detail: `${name} • ${duration} MIN`, intensity: qualifies ? 'mission' : 'micro' });


  // Custom workout counts as one workout session for weekly goal
  const wWorkouts = state.weeklyGoals.find(g => g.id === 'w_workouts');
  if (qualifies && wWorkouts && !wWorkouts.completed) {
    wWorkouts.progress++;
    if (wWorkouts.progress >= wWorkouts.target) {
      wWorkouts.completed = true;
      state.weeklyCompleted++;
      addSystemMessage(`Weekly Objective Complete: ${wWorkouts.title} — +${wWorkouts.xpReward} XP`, 'achievement');
      addXp(wWorkouts.xpReward, 'weekly');
      checkAllWeeklyComplete();
    }
  }

  // Weekly training days (once per day)
  const wDays = state.weeklyGoals.find(g => g.id === 'w_days');
  if (wDays && !wDays.completed) {
    const today = getTodayStr();
    const trainedToday = state.history.some(h => h.date === today);
    if (!trainedToday) {
      wDays.progress++;
      if (wDays.progress >= wDays.target) {
        wDays.completed = true;
        state.weeklyCompleted++;
        addSystemMessage(`Weekly Objective Complete: ${wDays.title} — +${wDays.xpReward} XP`, 'achievement');
        addXp(wDays.xpReward, 'weekly');
        checkAllWeeklyComplete();
      }
    }
  }

  updateWorkoutStreak(qualifies?Math.min(1,duration/30):0);
  if (qualifies && window.SystemBuild && typeof window.SystemBuild.awardTraining === 'function') window.SystemBuild.awardTraining(name, duration, intensity);
  const sessions=workoutHistory();
  sessions.push({date:getTodayStr(),mission:name||'Custom Workout',seconds:Math.round(duration*60),xp,workoutMode:'custom',trainingCredit:qualifies?Math.min(1,duration/30):0,prs:[],sets:[]});
  localStorage.setItem('systemWorkoutSessions',JSON.stringify(sessions.slice(-365)));
  recordHistory('custom_' + Date.now(), xp);
  checkAchievements();
  saveState();
  renderAll();
}

// --- Achievements ---
function checkAchievements() {
  let unlocked = false;
  for (const ach of ACHIEVEMENTS) {
    const state2 = state.achievements.find(a => a.id === ach.id);
    if (state2 && !state2.unlocked && ach.requirement(state)) {
      state2.unlocked = true;
      unlocked = true;
      const tierName = ach.tier === 'srank' ? 'S-Rank' : ach.tier === 'shadow' ? 'Shadow Sovereign' : ach.tier.charAt(0).toUpperCase() + ach.tier.slice(1);
      addSystemMessage(`Achievement Unlocked [${tierName}]: ${ach.title} — ${ach.desc}`, 'achievement');
      queueReward({ type: 'achievement', title: 'ACHIEVEMENT UNLOCKED', detail: `${ach.title} • ${tierName}`, amount: 0, intensity: ach.tier === 'srank' || ach.tier === 'shadow' ? 'major' : 'mission', source: 'achievement' });
    }
  }
  if (unlocked) {
    saveState();
  }
}

// --- Workout Plan / Body / Exercise Tracking ---
const WORKOUT_PLAN = {
  0: { name: 'Recovery + Mobility', focus: 'VIT / END', exercises: [['Mobility Flow',10,'min'],['Stretching',10,'min'],['Easy Walk',10,'min']] },
  1: { name: 'Strength A', focus: 'STR / END', exercises: [['Push-Ups',3,'sets'],['Squats',3,'sets'],['Plank',3,'sets']] },
  2: { name: 'Cardio + Core', focus: 'AGI / END', exercises: [['Cardio',20,'min'],['Plank',3,'sets'],['Stretching',5,'min']] },
  3: { name: 'Strength B', focus: 'STR / VIT', exercises: [['Lunges',3,'sets'],['Dumbbell Press',3,'sets'],['Rows',3,'sets']] },
  4: { name: 'Active Recovery', focus: 'VIT / AGI', exercises: [['Easy Walk',20,'min'],['Mobility Flow',10,'min']] },
  5: { name: 'Full Body', focus: 'STR / END', exercises: [['Squats',3,'sets'],['Push-Ups',3,'sets'],['Rows',3,'sets'],['Plank',3,'sets']] },
  6: { name: 'Cardio + Mobility', focus: 'AGI / VIT', exercises: [['Cardio',20,'min'],['Stretching',10,'min']] }
};

function renderTodayPlan(){
  const el=document.getElementById('todayPlan'); if(!el) return;
  const plan=WORKOUT_PLAN[new Date().getDay()];
  el.innerHTML=`<div class="mission-item"><div><div class="mission-item__name">${plan.name}</div><div class="mission-item__meta">Focus: ${plan.focus}</div></div><span>30 MIN</span></div>`+
    plan.exercises.map(x=>`<div class="mission-item"><span class="mission-item__name">${x[0]}</span><span class="mission-item__meta">${x[1]} ${x[2]}</span></div>`).join('');
}
function updateWeight(current,goal){
  current=Number(current); goal=Number(goal); if(!current||!goal) return;
  if(!state.weight.starting) state.weight.starting=current;
  state.weight.current=current; state.weight.goal=goal;
  state.weight.history.push({date:getTodayStr(),weight:current});
  state.weight.history=state.weight.history.slice(-90);
  addSystemMessage(`Body scan updated: ${current} lb — Goal ${goal} lb`, 'quest');
  saveState(); renderAll(); if(typeof renderAnalytics==='function')renderAnalytics();
}
function renderBodyProgress(){
  const w=state.weight;
  document.getElementById('currentWeight').textContent=w.current?`${w.current} lb`:'--';
  document.getElementById('goalWeight').textContent=w.goal?`${w.goal} lb`:'--';
  document.getElementById('weightLost').textContent=(w.starting&&w.current)?`${Math.max(0,w.starting-w.current).toFixed(1)} lb`:'--';
}
function logExercise(name,sets,reps,weight){
  sets=Math.max(1,Number(sets)||1); reps=Math.max(1,Number(reps)||1); weight=Math.max(0,Number(weight)||0);
  const volume=sets*reps*weight;
  const previous=state.exerciseRecords.filter(r=>r.name===name);
  const previousBest=previous.length?Math.max(...previous.map(r=>Number(r.volume)||0)):0;
  const isPR=previous.length>0 && volume>previousBest;
  const firstRecord=!previous.length;
  const rec={date:getTodayStr(),name,sets,reps,weight,volume,isPR};
  state.exerciseRecords.push(rec); state.exerciseRecords=state.exerciseRecords.slice(-100);

  const baseXp=Math.max(10,Math.floor(sets*reps*2+(weight||0)*0.5));
  const growthXp=isPR?Math.max(10,Math.min(50,Math.round(baseXp*.2))):0;
  rewardEvent({amount:baseXp,source:'exercise',title:'TRAINING REGISTERED',detail:`${name} • ${sets}×${reps}${weight?' @ '+weight+' LB':''}`,intensity:'micro'});
  if(isPR){
    rewardEvent({amount:growthXp,source:'growth',title:'PERSONAL RECORD',detail:`${name} • ${Math.round(previousBest)} → ${Math.round(volume)} VOLUME`,intensity:'mission'});
  } else if(firstRecord){
    queueReward({type:'baseline',title:'BASELINE ESTABLISHED',detail:name,amount:0,intensity:'micro',source:'growth'});
  }

  if(window.SystemBuild?.awardTraining) window.SystemBuild.awardTraining(name,Math.max(5,sets*2),1);
  addSystemMessage(`${name} logged: ${sets} × ${reps}${weight?' @ '+weight+' lb':''} — +${baseXp} XP${isPR?` — NEW PR +${growthXp} Growth XP`:''}`,'quest');
  recordHistory('exercise_'+Date.now(), baseXp+growthXp); saveState(); renderAll(); if(typeof renderAnalytics==='function')renderAnalytics();
}
function renderExercises(){
  const el=document.getElementById('exerciseRecords'); if(!el) return;
  const recent=state.exerciseRecords.slice(-8).reverse();
  if(!recent.length){el.innerHTML='<div class="empty-state">No exercise records yet. Your first set starts the log.</div>';return;}
  el.innerHTML=recent.map(r=>`<div class="exercise-record"><div><div class="exercise-record__main">${r.name}</div><div class="exercise-record__detail">${r.sets} sets × ${r.reps} reps${r.weight?' @ '+r.weight+' lb':''} · ${r.date}</div></div>${r.isPR?'<span class="pr-badge">PR</span>':''}</div>`).join('');
}
function renderHistory(){
  const el=document.getElementById('historyList'); if(!el) return;
  const recent=state.history.slice(-7).reverse();
  document.getElementById('historyMeta').textContent=`${state.history.length} tracked days`;
  el.innerHTML=recent.length?recent.map(h=>`<div class="history-item"><strong>${h.xpEarned} XP</strong><span>${h.date} · ${h.completedQuestIds.length} entries</span></div>`).join(''):'<div class="empty-state">Complete a quest or log a workout to build your history.</div>';
}

// --- Rendering ---
function renderAll() {
  renderPlayerCard();
  renderDailyQuests();
  renderWeeklyGoals();
  renderAchievements();
  renderSystemLog();
  renderTodayPlan();
  renderBodyProgress();
  renderHistory();
  renderExercises();
}

function renderPlayerCard() {
  const rank = getRank(state.level);
  const xpNeeded = xpNeededForLevel(state.level);
  const xpPercent = Math.min(100, (state.xp / xpNeeded) * 100);

  document.getElementById('rankLetter').textContent = rank.letter;
  document.getElementById('rankLabel').textContent = rank.name;
  document.getElementById('playerName').textContent = rank.title;
  const equippedTitle=typeof getEquippedCombatTitle==='function'?getEquippedCombatTitle():null,titleEl=document.getElementById('playerCombatTitle');
  if(titleEl){titleEl.textContent=equippedTitle?.name||'';titleEl.hidden=!equippedTitle}
  document.getElementById('playerLevel').textContent = `Level ${state.level}`;
  document.getElementById('playerStreak').textContent = `🔥 ${state.currentStreak} day streak`;
  const legacyEl=document.getElementById('centralLegacyIdentity');
  if(legacyEl){
    const profile=typeof buildSocialIdentity==='function'?buildSocialIdentity():{level:state.level,missions:state.totalQuestsCompleted,streak:state.currentStreak,gates:0};
    const legacy=typeof hunterLegacyState==='function'?hunterLegacyState(profile,null,null):null,card=typeof getIdentityCard==='function'?getIdentityCard():{frame:'SYSTEM',emblem:'RANK'};
    if(legacy){legacyEl.className='central-legacy '+(legacy.active?'active':'dormant')+' frame-'+String(card.frame||'SYSTEM').toLowerCase();legacyEl.innerHTML='<span>'+escapeHtml(legacy.title)+'</span><b>LEGACY LV '+legacy.level+'</b><small>'+legacy.score.toLocaleString()+' LP'+(typeof legacyArtifact==='function'&&legacyArtifact().unlocked?' // NEXUS ONLINE':'')+(typeof ascensionRecord==='function'&&ascensionRecord().completed?' // A'+ascensionRecord().completed:'')+'</small>';document.getElementById('playerCard')?.setAttribute('data-legacy-tier',legacy.level>=10?'sovereign':legacy.level>=7?'mythic':legacy.level>=5?'veteran':legacy.level>=3?'ascendant':'awakened')}
  }
  document.getElementById('totalWorkouts').querySelector('.player-card__total-num').textContent = state.totalQuestsCompleted;
  document.getElementById('xpValues').textContent = `${state.xp} / ${xpNeeded}`;
  document.getElementById('xpBarFill').style.width = `${xpPercent}%`;

  const canonical=window.SystemBuild?.getBuild?.()?.stats;
  document.getElementById('statStr').textContent = canonical?.Strength ?? 0;
  document.getElementById('statEnd').textContent = canonical?.Endurance ?? 0;
  document.getElementById('statAgi').textContent = canonical?.Conditioning ?? 0;
  document.getElementById('statVit').textContent = canonical?.Recovery ?? 0;
}

function renderDailyQuests() {
  const list = document.getElementById('dailyQuestList');
  list.innerHTML = '';

  let completed = 0;
  for (const quest of state.dailyQuests) {
    if (quest.completed) completed++;

    const item = document.createElement('div');
    item.className = `quest-item${quest.completed ? ' quest-item--completed' : ''}`;

    const percent = Math.min(100, (quest.progress / quest.target) * 100);

    item.innerHTML = `
      <div class="quest-item__checkbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="quest-item__body">
        <div class="quest-item__title">${quest.title}</div>
        <div class="quest-item__progress-row">
          <div class="quest-item__progress-track">
            <div class="quest-item__progress-fill" style="width: ${percent}%"></div>
          </div>
          <span class="quest-item__progress-text">${quest.progress}/${quest.target} ${quest.unit}</span>
        </div>
      </div>
      <div class="quest-item__controls">
        <button class="quest-item__btn" data-action="dec" data-id="${quest.id}" ${quest.completed ? 'disabled' : ''}>−</button>
        <button class="quest-item__btn" data-action="inc" data-id="${quest.id}" ${quest.completed ? 'disabled' : ''}>+</button>
      </div>
      <div class="quest-item__xp">+${quest.xp} XP</div>
    `;

    // Click on checkbox or item to complete
    item.querySelector('.quest-item__checkbox').addEventListener('click', () => {
      if (!quest.completed) completeQuest(quest.id);
    });

    list.appendChild(item);
  }

  // Wire up +/- buttons
  list.querySelectorAll('.quest-item__btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const step = id === 'plank' ? 15 : id === 'running' || id === 'stretch' ? 5 : 5;
      updateQuestProgress(id, action === 'inc' ? step : -step);
    });
  });

  document.getElementById('dailyMeta').textContent = `${completed}/${state.dailyQuests.length} Complete`;

  // Daily bonus bar
  const bonusPercent = (completed / state.dailyQuests.length) * 100;
  document.getElementById('dailyBonusFill').style.width = `${bonusPercent}%`;
  const bonusText = document.getElementById('dailyBonusText');
  if (completed === state.dailyQuests.length) {
    bonusText.textContent = '✓ All Quests Complete — +250 XP Claimed!';
    bonusText.classList.add('daily-bonus__text--complete');
  } else {
    bonusText.textContent = `All Quests Complete Bonus: +250 XP (${completed}/${state.dailyQuests.length})`;
    bonusText.classList.remove('daily-bonus__text--complete');
  }
}

function renderWeeklyGoals() {
  const list = document.getElementById('weeklyQuestList');
  list.innerHTML = '';

  let completed = 0;
  for (const goal of state.weeklyGoals) {
    if (goal.completed) completed++;

    const item = document.createElement('div');
    item.className = `quest-item${goal.completed ? ' quest-item--completed' : ''}`;
    const percent = Math.min(100, (goal.progress / goal.target) * 100);

    item.innerHTML = `
      <div class="quest-item__checkbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="quest-item__body">
        <div class="quest-item__title">${goal.title}</div>
        <div class="quest-item__progress-row">
          <div class="quest-item__progress-track">
            <div class="quest-item__progress-fill" style="width: ${percent}%"></div>
          </div>
          <span class="quest-item__progress-text">${goal.progress}/${goal.target} ${goal.unit}</span>
        </div>
      </div>
      <div class="quest-item__xp">+${goal.xpReward} XP</div>
    `;

    list.appendChild(item);
  }

  const meta = document.getElementById('weeklyMeta');
  meta.textContent = `${completed}/${state.weeklyGoals.length} Complete`;
}

function renderAchievements() {
  const grid = document.getElementById('achievementGrid');
  grid.innerHTML = '';

  let unlocked = 0;
  for (const ach of ACHIEVEMENTS) {
    const state2 = state.achievements.find(a => a.id === ach.id);
    const isUnlocked = state2?.unlocked || false;
    if (isUnlocked) unlocked++;

    const tierInfo = TIER_COLORS[ach.tier];
    const tierName = ach.tier === 'srank' ? 'S-Rank' : ach.tier === 'shadow' ? 'Shadow' : ach.tier;

    const card = document.createElement('div');
    card.className = `achievement-card${isUnlocked ? ' achievement-card--unlocked' : ' achievement-card--locked'}`;
    card.style.setProperty('--tier-color', tierInfo.color);
    card.style.setProperty('--tier-glow', tierInfo.glow);

    card.innerHTML = `
      <div class="achievement-card__icon">${ach.icon}</div>
      <div class="achievement-card__title">${ach.title}</div>
      <div class="achievement-card__desc">${ach.desc}</div>
      <div class="achievement-card__tier">${tierName}</div>
    `;

    grid.appendChild(card);
  }

  document.getElementById('achievementMeta').textContent = `${unlocked} Unlocked`;
}

function renderSystemLog() {
  // Keep existing log entries; new ones are added via addSystemMessage
}

// --- Level-Up Modal ---
function showLevelUpModal(newLevel, rank) {
  const modal = document.getElementById('levelupModal');
  document.getElementById('levelupNewLevel').textContent = `Level ${newLevel}`;
  document.getElementById('levelupRank').textContent = `You are now ${rank.title}`;
  modal.setAttribute('aria-hidden', 'false');
}

document.getElementById('levelupClose').addEventListener('click', () => {
  document.getElementById('levelupModal').setAttribute('aria-hidden', 'true');
});

// --- Custom Workout Form ---
document.getElementById('customWorkoutForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('workoutName').value.trim();
  const duration = parseInt(document.getElementById('workoutDuration').value);
  const intensity = parseFloat(document.getElementById('workoutIntensity').value);

  if (!name || !duration || duration < 1) return;

  logCustomWorkout(name, duration, intensity);

  document.getElementById('workoutName').value = '';
  document.getElementById('workoutDuration').value = '';
  document.getElementById('workoutIntensity').value = '1.5';
});

// --- Dashboard Forms ---
document.getElementById('weightForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  updateWeight(document.getElementById('weightInput').value,document.getElementById('goalWeightInput').value);
  e.target.reset();
});
document.getElementById('exerciseForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  logExercise(document.getElementById('exerciseSelect').value,Number(document.getElementById('exerciseSets').value),Number(document.getElementById('exerciseReps').value),Number(document.getElementById('exerciseWeight').value)||0);
  e.target.reset();
});

// --- Reset ---
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'false');
});

document.getElementById('confirmNo').addEventListener('click', () => {
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'true');
});

document.getElementById('confirmBackdrop').addEventListener('click', () => {
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'true');
});

document.getElementById('confirmYes').addEventListener('click', () => {
  state = defaultState();
  saveState();
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'true');
  // Clear system log
  systemLog.innerHTML = '<p class="system-log__entry system-log__entry--idle">SYSTEM ONLINE. Complete your daily quests to grow stronger.</p>';
  renderAll();
  addSystemMessage('System reset. Your journey begins anew.', 'warning');
});

// --- Theme Toggle ---
(function() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let d = 'dark';
  root.setAttribute('data-theme', d);

  toggle.addEventListener('click', () => {
    d = d === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', d);
    toggle.setAttribute('aria-label', 'Switch to ' + (d === 'dark' ? 'light' : 'dark') + ' mode');
    toggle.innerHTML = d === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  });
})();

// --- Init ---
renderAll();

// Check achievements on load (for state restored from storage)
checkAchievements();
saveState();

// Welcome message
setTimeout(() => {
  if (state.totalQuestsCompleted === 0) {
    addSystemMessage('System initialized. Your awakening begins now.', 'level');
  } else {
    const rank = getRank(state.level);
    addSystemMessage(`Welcome back, ${rank.title}. Level ${state.level}.`, 'level');
  }
}, 500);


/* ===== THE SYSTEM: LIVE 30-MINUTE WORKOUT ENGINE ===== */
const SYSTEM_MISSIONS = [
 {day:0,name:"Recovery Protocol",focus:"Active recovery + mobility",stat:"Recovery",xp:250,exercises:[["Brisk Walk",1,"10 min",0],["Stretching",1,"10 min",0],["Glute Bridge",2,"15 reps",30],["Plank",2,"30 sec",30]]},
 {day:1,name:"Strength Awakening",focus:"Upper-body strength + core",stat:"Strength",xp:300,exercises:[["Push-Ups",3,"8-12 reps",45],["Bodyweight Squats",3,"12-15 reps",45],["Plank",3,"30 sec",30],["Incline Push-Ups",2,"10-15 reps",30],["March in Place",1,"5 min",0]]},
 {day:2,name:"Endurance Protocol",focus:"Cardio conditioning + endurance",stat:"Endurance",xp:300,exercises:[["Brisk Walk",1,"10 min",0],["High Knees",4,"30 sec",30],["Bodyweight Squats",3,"12 reps",30],["March in Place",1,"5 min",0],["Stretching",1,"5 min",0]]},
 {day:3,name:"Agility Protocol",focus:"Movement, coordination + speed",stat:"Conditioning",xp:300,exercises:[["High Knees",5,"30 sec",30],["Mountain Climbers",4,"30 sec",30],["Reverse Lunges",3,"10/leg",30],["March in Place",1,"5 min",0],["Stretching",1,"5 min",0]]},
 {day:4,name:"Vitality Recovery",focus:"Mobility, core + recovery",stat:"Recovery",xp:300,exercises:[["Plank",3,"30-45 sec",30],["Glute Bridge",3,"12-15 reps",30],["Bodyweight Squats",3,"12 reps",30],["Stretching",1,"10 min",0],["Brisk Walk",1,"5 min",0]]},
 {day:5,name:"Full Body Assault",focus:"Full-body conditioning",stat:"Strength",xp:350,exercises:[["Push-Ups",3,"8-12 reps",45],["Bodyweight Squats",3,"15 reps",45],["Reverse Lunges",3,"10/leg",30],["Mountain Climbers",3,"30 sec",30],["Plank",3,"30 sec",30]]},
 {day:6,name:"Cardio Challenge",focus:"Conditioning + calorie burn",stat:"Endurance",xp:350,exercises:[["Brisk Walk",1,"15 min",0],["High Knees",5,"30 sec",30],["Mountain Climbers",5,"30 sec",30],["March in Place",1,"5 min",0]]}
];
function systemMissionKey(){return getTodayStr();}
function systemPlayerProfile(){try{return JSON.parse(localStorage.getItem('systemPlayerBuildV1')||'{}')}catch(e){return {}}}
function systemTrainingSchedule(){
 const b=systemPlayerProfile(),days=Math.max(2,Math.min(7,Number(b.profile?.days)||4));
 const patterns={2:[1,4],3:[1,3,5],4:[1,2,4,6],5:[1,2,3,5,6],6:[1,2,3,4,5,6],7:[0,1,2,3,4,5,6]};
 return {days,trainingDays:patterns[days]||patterns[4],isTrainingDay:(patterns[days]||patterns[4]).includes(new Date().getDay())};
}
function adaptiveWeekStatus(){
 const schedule=systemTrainingSchedule(),today=new Date(),dow=today.getDay(),hist=workoutHistory(),weekStart=new Date(today);weekStart.setHours(0,0,0,0);weekStart.setDate(today.getDate()-((dow+6)%7));
 const completed=new Set(hist.filter(x=>dateLocal(x.date)>=weekStart).map(x=>dateLocal(x.date).getDay()));
 const missed=schedule.trainingDays.filter(d=>d<dow&&!completed.has(d));
 const future=schedule.trainingDays.filter(d=>d>dow&&!completed.has(d));
 const todayDone=completed.has(dow);
 let directive='';
 if(missed.length&&!schedule.isTrainingDay&&!todayDone)directive='RESCHEDULE RECOMMENDED • A scheduled mission was missed. Today can be used as a make-up session.';
 else if(missed.length&&schedule.isTrainingDay)directive='MISSION MISSED EARLIER • Complete today’s mission. Do not stack two full sessions.';
 else if(!schedule.isTrainingDay)directive='RECOVERY PROTECTED • Rest is part of progression. Optional training remains available.';
 else directive='SCHEDULE ON TRACK • Complete today’s training mission.';
 return {missed,future,todayDone,directive};
}
function adaptiveSystemMission(){
 const week=adaptiveWeekStatus(),dow=new Date().getDay(),sourceDay=(week.missed.length&&!systemTrainingSchedule().isTrainingDay&&!week.todayDone)?week.missed[0]:dow,base=SYSTEM_MISSIONS[sourceDay],b=systemPlayerProfile(),profile=b.profile||{},path=b.path||'Balanced',exp=profile.experience||'Beginner',gear=(profile.equipment&&profile.equipment.length?profile.equipment:['No Equipment']);
 const noGear=gear.includes('No Equipment')||(!gear.some(x=>['Dumbbells','Barbell','Resistance Bands','Cardio Machine','Full Gym'].includes(x))),has=x=>!noGear&&(gear.includes(x)||gear.includes('Full Gym')), levelScale=exp==='Advanced'?1.3:exp==='Intermediate'?1.12:.9;
 const swap={
  'Push-Ups':has('Barbell')?['Barbell Bench Press',3,'8-10 reps',75]:has('Dumbbells')?['Dumbbell Press',3,'8-12 reps',60]:has('Resistance Bands')?['Band Chest Press',3,'12-15 reps',45]:null,
  'Incline Push-Ups':has('Dumbbells')?['Dumbbell Press',2,'10-12 reps',60]:has('Resistance Bands')?['Band Chest Press',2,'12-15 reps',45]:null,
  'Bodyweight Squats':has('Barbell')?['Barbell Squat',3,'8-10 reps',90]:has('Dumbbells')?['Goblet Squat',3,'10-12 reps',60]:has('Resistance Bands')?['Band Squat',3,'12-15 reps',45]:null,
  'Glute Bridge':has('Barbell')?['Barbell Hip Thrust',3,'10-12 reps',75]:has('Dumbbells')?['Dumbbell Glute Bridge',3,'12-15 reps',60]:has('Resistance Bands')?['Band Glute Bridge',3,'15 reps',45]:null,
  'Brisk Walk':has('Cardio Machine')?['Cardio Machine',1,'10 min',0]:null,
  'March in Place':has('Cardio Machine')?['Cardio Machine',1,'5 min',0]:null
 };
 let exercises=base.exercises.map(e=>swap[e[0]]?[...swap[e[0]]]:[...e]);
 if(noGear){
  const bodyweight={'Push-Ups':['Push-Ups',3,'8-12 reps',45],'Incline Push-Ups':['Incline Push-Ups',2,'10-15 reps',30],'Bodyweight Squats':['Bodyweight Squats',3,'12-15 reps',45],'Glute Bridge':['Glute Bridge',3,'12-15 reps',30],'Brisk Walk':['Brisk Walk',1,'10 min',0],'March in Place':['March in Place',1,'5 min',0]};
  exercises=exercises.map(e=>bodyweight[e[0]]?[...bodyweight[e[0]]]:e);
 }
 exercises=exercises.map(e=>{
   let sets=e[1],rest=e[3];
   if(!/min/i.test(e[2]))sets=Math.max(1,Math.round(sets*levelScale));
   if(exp==='Beginner')rest=Math.round(rest*1.15);
   if(exp==='Advanced'&&rest)rest=Math.max(20,Math.round(rest*.9));
   if(path==='Strength'||path==='Muscle Building')rest=Math.max(rest,45);
   if(path==='Endurance'||path==='Fat Loss')rest=Math.max(0,Math.round(rest*.8));
   return [e[0],sets,e[2],rest];
 });
 if((path==='Endurance'||path==='Fat Loss')&&has('Cardio Machine')&&!exercises.some(e=>e[0]==='Cardio Machine'))exercises.push(['Cardio Machine',1,exp==='Advanced'?'15 min':exp==='Intermediate'?'12 min':'10 min',0]);
 const names={'Fat Loss':'Fat Loss Protocol','Muscle Building':'Hypertrophy Protocol',Strength:'Strength Protocol',Endurance:'Endurance Protocol',Balanced:base.name};
 const focus=path==='Balanced'?base.focus:path+' • '+base.focus;
 const volume=exercises.reduce((n,e)=>n+e[1],0),xp=Math.round((base.xp*(exp==='Advanced'?1.15:exp==='Intermediate'?1.07:1)+Math.max(0,volume-12)*3)/5)*5;
 const isMakeup=sourceDay!==dow,dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];return {...base,name:(isMakeup?'Make-Up: ':'')+(names[path]||base.name),focus,xp,exercises,sourceDay,isMakeup,makeupFor:isMakeup?dayNames[sourceDay]:null,profile:{path,experience:exp,equipment:gear,days:Number(profile.days)||4}};
}
const WORKOUT_MODES={full:{label:'FULL',credit:1,setScale:1,restScale:1},light:{label:'QUICK LIGHT',credit:.4,setScale:.5,restScale:1},intense:{label:'QUICK INTENSE',credit:.7,setScale:.65,restScale:.55}};
function workoutModeKey(){return 'systemWorkoutMode:'+systemMissionKey()}
function getWorkoutMode(){return localStorage.getItem(workoutModeKey())||'full'}
function setWorkoutMode(mode){if(!WORKOUT_MODES[mode])return;const old=getWorkoutMode();if(old===mode)return;const oldKey="systemMissionProgress:"+systemMissionKey()+':'+old,progress=(()=>{try{return JSON.parse(localStorage.getItem(oldKey))||{}}catch(e){return {}}})();if(Object.values(progress).some(x=>x?.done)&&!confirm('CHANGE WORKOUT MODE?\n\nYour completed sets in '+WORKOUT_MODES[old].label+' will stay saved, but progress does not transfer between workout modes.'))return;localStorage.setItem(workoutModeKey(),mode);renderSystemMission()}
function missionForMode(m,mode=getWorkoutMode()){const cfg=WORKOUT_MODES[mode]||WORKOUT_MODES.full;if(mode==='full')return {...m,mode,credit:1};const exercises=m.exercises.map(e=>[e[0],Math.max(1,Math.ceil(e[1]*cfg.setScale)),e[2],Math.round((e[3]||0)*cfg.restScale)]);return {...m,name:m.name+' • '+cfg.label,exercises,xp:Math.max(1,Math.round(m.xp*cfg.credit)),mode,credit:cfg.credit}}
function missionProgressKey(){return "systemMissionProgress:"+systemMissionKey()+':'+getWorkoutMode();}
function missionRecordsKey(){return "systemMissionRecords";}
function getMissionProgress(){try{return JSON.parse(localStorage.getItem(missionProgressKey()))||{};}catch(e){return {};}}
function saveMissionProgress(x){localStorage.setItem(missionProgressKey(),JSON.stringify(x));}
function getMissionRecords(){try{return JSON.parse(localStorage.getItem(missionRecordsKey()))||{};}catch(e){return {};}}
function workoutHistory(){try{return JSON.parse(localStorage.getItem('systemWorkoutSessions'))||[];}catch(e){return [];}}
function parseTargetReps(t){const m=String(t).match(/(\d+)(?:-(\d+))?\s*(?:reps|\/leg)/i);return m?Number(m[2]||m[1]):0;}
function flatSets(m){let a=[];m.exercises.forEach((e,i)=>{for(let s=0;s<e[1];s++)a.push({ei:i,si:s,name:e[0],target:e[2],rest:e[3]});});return a;}
let liveTimer=null,restTimer=null,workoutStartedAt=0,liveIndex=0;
function fmt(sec){sec=Math.max(0,Math.floor(sec));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
function renderDashboardStrip(){const hist=workoutHistory(),mins=Math.round(hist.reduce((a,x)=>a+(x.seconds||0),0)/60);document.getElementById('dashWorkouts').textContent=hist.length;document.getElementById('dashMinutes').textContent=mins+'m';document.getElementById('dashWeight').textContent=state.weight?.current?state.weight.current+' lb':'--';document.getElementById('dashGoal').textContent=state.weight?.goal?state.weight.goal+' lb':'--';}
function renderSystemMission(){const base=adaptiveSystemMission(),m=missionForMode(base),schedule=systemTrainingSchedule(),week=adaptiveWeekStatus(),completion=(()=>{try{return JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey())||'null')}catch(e){return null}})(),done=completion?.mode==='full',quickDone=completion&&completion.mode!=='full',p=getMissionProgress(),sets=flatSets(m),finished=sets.filter(x=>p[x.ei+'-'+x.si]?.done).length;document.getElementById('mission-title').textContent=m.name;document.getElementById('mission-focus').textContent=(schedule.isTrainingDay?'TRAINING DAY':week.missed.length?'MAKE-UP AVAILABLE':'OPTIONAL / RECOVERY DAY')+' • '+m.focus+' • '+finished+'/'+sets.length+' sets • '+week.directive;document.getElementById('mission-xp').textContent='+'+m.xp+' XP';document.getElementById('mission-exercises').innerHTML=m.exercises.map((e,i)=>`<div class="mission-exercise"><div class="mission-exercise__head"><strong>${e[0]}</strong><small>${e[1]} sets • ${e[2]}${e[3]?' • '+e[3]+'s rest':''}</small></div><div class="mission-summary">${Array.from({length:e[1]},(_,s)=>`<span class="mission-dot ${p[i+'-'+s]?.done?'done':''}">${s+1}</span>`).join('')}</div></div>`).join('');const b=document.getElementById('start-mission-btn');b.disabled=done;b.textContent=done?'FULL MISSION COMPLETE':finished?'RESUME WORKOUT':quickDone&&m.mode==='full'?'UPGRADE TO FULL WORKOUT':schedule.isTrainingDay?'START WORKOUT':week.missed.length?'MAKE UP WORKOUT':'OPTIONAL WORKOUT';b.onclick=startWorkoutMode;
 let modes=document.getElementById('missionModeChoices');if(!modes){modes=document.createElement('div');modes.id='missionModeChoices';modes.className='mission-mode-choices';b.parentNode.insertBefore(modes,b)}
 const active=getWorkoutMode();modes.innerHTML='<button data-mode="full">FULL<br><small>100% XP</small></button><button data-mode="light">QUICK LIGHT<br><small>40% XP</small></button><button data-mode="intense">QUICK INTENSE<br><small>70% XP</small></button>';modes.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('active',x.dataset.mode===active);x.disabled=done||(quickDone&&x.dataset.mode!=='full');x.onclick=()=>setWorkoutMode(x.dataset.mode)});
 renderDashboardStrip();renderLegacyMissions();}
function startWorkoutMode(){const m=missionForMode(adaptiveSystemMission()),completion=(()=>{try{return JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey())||'null')}catch(e){return null}})();if(completion?.mode==='full')return;const p=getMissionProgress(),sets=flatSets(m);liveIndex=Math.max(0,sets.findIndex(x=>!p[x.ei+'-'+x.si]?.done));if(liveIndex<0)liveIndex=sets.length-1;workoutStartedAt=Number(localStorage.getItem('workoutStartedAt:'+systemMissionKey()))||Date.now();localStorage.setItem('workoutStartedAt:'+systemMissionKey(),workoutStartedAt);document.getElementById('workoutMode').classList.add('active');document.getElementById('workoutMode').setAttribute('aria-hidden','false');document.body.classList.add('workout-open');document.getElementById('liveMissionName').textContent=m.name;clearInterval(liveTimer);liveTimer=setInterval(()=>document.getElementById('workoutClock').textContent=fmt((Date.now()-workoutStartedAt)/1000),1000);renderLiveSet();}
function renderLiveSet(){const m=missionForMode(adaptiveSystemMission()),sets=flatSets(m),x=sets[liveIndex],p=getMissionProgress(),rec=getMissionRecords()[x.name]||{};document.getElementById('liveExerciseCount').textContent=`SET ${liveIndex+1} OF ${sets.length}`;document.getElementById('liveExerciseName').textContent=x.name;document.getElementById('liveTarget').textContent=`Target: ${x.target}${rec.bestReps?' • Best: '+rec.bestReps+' reps':''}`;document.getElementById('liveReps').value=parseTargetReps(x.target)||'';document.getElementById('liveWeight').value='';document.getElementById('liveSetCount').textContent=Object.values(p).filter(v=>v.done).length+' sets complete';document.getElementById('liveXpPreview').textContent='+'+m.xp+' XP on completion';document.getElementById('workoutProgressFill').style.width=(Object.values(p).filter(v=>v.done).length/sets.length*100)+'%';}
function completeLiveSet(){const m=missionForMode(adaptiveSystemMission()),sets=flatSets(m),x=sets[liveIndex],p=getMissionProgress(),id=x.ei+'-'+x.si;p[id]={done:true,reps:Number(document.getElementById('liveReps').value)||0,weight:Number(document.getElementById('liveWeight').value)||0};saveMissionProgress(p);if(liveIndex>=sets.length-1){finishWorkout();return;}liveIndex++;if(x.rest>0)startRest(x.rest);else renderLiveSet();}
function startRest(sec){const panel=document.getElementById('restPanel');panel.hidden=false;let left=sec;document.getElementById('restClock').textContent=fmt(left);clearInterval(restTimer);restTimer=setInterval(()=>{left--;document.getElementById('restClock').textContent=fmt(left);if(left<=0)endRest();},1000);}
function endRest(){clearInterval(restTimer);document.getElementById('restPanel').hidden=true;renderLiveSet();}
function finishWorkout(){const m=missionForMode(adaptiveSystemMission()),p=getMissionProgress(),records=getMissionRecords();let prs=[];m.exercises.forEach((e,i)=>{let br=0,bw=0;for(let s=0;s<e[1];s++){const x=p[i+'-'+s]||{};br=Math.max(br,x.reps||0);bw=Math.max(bw,x.weight||0);}const old=records[e[0]]||{bestReps:0,bestWeight:0};if(br>old.bestReps||bw>old.bestWeight)prs.push(e[0]);records[e[0]]={bestReps:Math.max(br,old.bestReps),bestWeight:Math.max(bw,old.bestWeight)};});localStorage.setItem(missionRecordsKey(),JSON.stringify(records));const existing=(()=>{try{return JSON.parse(localStorage.getItem('systemMissionResult:'+systemMissionKey())||'null')}catch(e){return null}})(),isUpgrade=m.mode==='full'&&existing&&existing.mode!=='full',xpAward=isUpgrade?Math.max(0,m.xp-(Number(existing.xp)||0)):m.xp;localStorage.setItem('systemMissionResult:'+systemMissionKey(),JSON.stringify({mode:m.mode||'full',credit:m.credit||1,xp:m.xp,completedAt:new Date().toISOString()}));if(m.mode==='full')localStorage.setItem('systemMission:'+systemMissionKey(),'true');const seconds=Math.round((Date.now()-workoutStartedAt)/1000),hist=workoutHistory();hist.push({date:systemMissionKey(),mission:m.name,seconds,xp:m.xp,workoutMode:m.mode||'full',trainingCredit:m.credit||1,prs:[...prs],makeupFor:m.makeupFor||null,sourceDay:m.sourceDay,sets:flatSets(m).map(x=>{const r=p[x.ei+'-'+x.si]||{};return {name:x.name,reps:r.reps||0,weight:r.weight||0};})});localStorage.setItem('systemWorkoutSessions',JSON.stringify(hist.slice(-365)));localStorage.removeItem('workoutStartedAt:'+systemMissionKey());localStorage.removeItem(workoutModeKey());addXp(xpAward,'daily mission');if(window.SystemBuild?.awardTraining)window.SystemBuild.awardTraining(m.name,Math.max(5,Math.round(seconds/60)),m.credit||1);updateWorkoutStreak(m.credit||1);recordHistory('system_mission_'+systemMissionKey()+(isUpgrade?'_upgrade':''),xpAward);addSystemMessage(`${m.name} complete — ${fmt(seconds)} • +${xpAward} XP${prs.length?' • New PR: '+prs.join(', '):''}`,'quest');saveState();closeWorkout();renderAll();renderSystemMission();renderAnalytics();setTimeout(()=>showMissionDebrief(seconds,xpAward,prs),120);}
function closeWorkout(){clearInterval(liveTimer);clearInterval(restTimer);document.getElementById('workoutMode').classList.remove('active');document.getElementById('workoutMode').setAttribute('aria-hidden','true');document.body.classList.remove('workout-open');}
document.addEventListener('DOMContentLoaded',()=>{renderSystemMission();renderAnalytics();document.getElementById('completeLiveSet').onclick=completeLiveSet;document.getElementById('exitWorkoutBtn').onclick=closeWorkout;document.getElementById('skipRestBtn').onclick=endRest;});


/* ===== v7 PROGRESS & ANALYTICS ===== */
function dateLocal(s){const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d);}
function daysAgo(n){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-n);return d;}
function sessionSetHistory(){return workoutHistory().flatMap(s=>(s.sets||[]).map(x=>({...x,date:s.date,mission:s.mission})));}
function allExerciseNames(){const names=new Set();state.exerciseRecords.forEach(r=>names.add(r.name));sessionSetHistory().forEach(r=>names.add(r.name));Object.keys(getMissionRecords()).forEach(n=>names.add(n));return [...names].sort();}
function renderAnalytics(){
 const hist=workoutHistory(), now=new Date(), weekStart=daysAgo((now.getDay()+6)%7), monthStart=new Date(now.getFullYear(),now.getMonth(),1);
 const week=hist.filter(x=>dateLocal(x.date)>=weekStart).length, month=hist.filter(x=>dateLocal(x.date)>=monthStart).length;
 const mins=Math.round(hist.reduce((a,x)=>a+(x.seconds||0),0)/60);
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 set('analyticsWeek',week);set('analyticsMonth',month);set('analyticsMinutes',mins+'m');set('analyticsXp',state.totalXp||0);set('analyticsStreak',state.currentStreak||0);set('analyticsBestStreak',state.bestStreak||0);
 renderWeightAnalytics();renderTrainingCalendar();renderStrengthAnalytics();renderPRAnalytics();renderSystemInsights();
}
function renderWeightAnalytics(){
 const w=state.weight||{}, h=(w.history||[]).slice(-30), chart=document.getElementById('weightChart'); if(!chart)return;
 if(w.starting&&w.current&&w.goal){const denom=w.starting-w.goal, pct=denom===0?100:Math.max(0,Math.min(100,(w.starting-w.current)/denom*100));document.getElementById('weightGoalFill').style.width=pct+'%';document.getElementById('weightProgressText').textContent=`${w.current} lb • ${pct.toFixed(0)}% to ${w.goal} lb`;}else{document.getElementById('weightGoalFill').style.width='0%';document.getElementById('weightProgressText').textContent='Add weight data';}
 if(!h.length){chart.innerHTML='<div class="analytics-empty">Log your weight to build the trend.</div>';return;}
 const vals=h.map(x=>Number(x.weight)), lo=Math.min(...vals), hi=Math.max(...vals), span=Math.max(1,hi-lo);chart.innerHTML=h.map(x=>`<div class="weight-bar" data-tip="${x.date}: ${x.weight} lb" style="height:${25+(Number(x.weight)-lo)/span*75}%"></div>`).join('');
}
function renderTrainingCalendar(){
 const el=document.getElementById('trainingCalendar');if(!el)return;const now=new Date(),y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);document.getElementById('calendarMonth').textContent=now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const sessions=workoutHistory(), workoutDates=new Set(sessions.map(x=>x.date)), prDates=new Set(sessions.filter(x=>(x.prs||[]).length).map(x=>x.date));let out='';for(let i=0;i<(first.getDay()+6)%7;i++)out+='<div class="calendar-day muted"></div>';for(let d=1;d<=last.getDate();d++){const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;out+=`<div class="calendar-day ${workoutDates.has(key)?'workout':''} ${prDates.has(key)?'pr':''}">${d}</div>`;}el.innerHTML=out;
}
function renderStrengthAnalytics(){
 const sel=document.getElementById('strengthExercise');if(!sel)return;const names=allExerciseNames(), prior=sel.value;sel.innerHTML=names.length?names.map(n=>`<option>${n}</option>`).join(''):'<option>No exercise data</option>';if(names.includes(prior))sel.value=prior;const render=()=>{const name=sel.value, manual=state.exerciseRecords.filter(r=>r.name===name), sets=sessionSetHistory().filter(r=>r.name===name);let bestReps=0,bestWeight=0,bestVolume=0;manual.forEach(r=>{bestReps=Math.max(bestReps,Number(r.reps)||0);bestWeight=Math.max(bestWeight,Number(r.weight)||0);bestVolume=Math.max(bestVolume,Number(r.volume)||0)});sets.forEach(r=>{bestReps=Math.max(bestReps,Number(r.reps)||0);bestWeight=Math.max(bestWeight,Number(r.weight)||0);bestVolume=Math.max(bestVolume,(Number(r.reps)||0)*(Number(r.weight)||0))});const rec=getMissionRecords()[name]||{};bestReps=Math.max(bestReps,rec.bestReps||0);bestWeight=Math.max(bestWeight,rec.bestWeight||0);document.getElementById('strengthReps').textContent=bestReps||'--';document.getElementById('strengthWeight').textContent=bestWeight?bestWeight+' lb':'--';document.getElementById('strengthVolume').textContent=bestVolume?Math.round(bestVolume)+' lb':'--';const dates=new Set([...manual.map(r=>r.date),...sets.map(r=>r.date)]);document.getElementById('strengthSessions').textContent=dates.size;const vals=[...manual.map(r=>Number(r.volume)||Number(r.reps)||0),...sets.map(r=>(Number(r.weight)||1)*(Number(r.reps)||0))].slice(-16), max=Math.max(1,...vals);document.getElementById('strengthHistory').innerHTML=vals.length?vals.map(v=>`<div class="strength-history-bar" style="height:${Math.max(5,v/max*100)}%"></div>`).join(''):'<div class="analytics-empty">No history yet.</div>';};sel.onchange=render;render();
}
function renderPRAnalytics(){
 const el=document.getElementById('personalRecords');if(!el)return;const rec=getMissionRecords(), manual={};state.exerciseRecords.forEach(r=>{const x=manual[r.name]||(manual[r.name]={bestReps:0,bestWeight:0});x.bestReps=Math.max(x.bestReps,Number(r.reps)||0);x.bestWeight=Math.max(x.bestWeight,Number(r.weight)||0)});Object.entries(manual).forEach(([n,x])=>{const r=rec[n]||(rec[n]={bestReps:0,bestWeight:0});r.bestReps=Math.max(r.bestReps,x.bestReps);r.bestWeight=Math.max(r.bestWeight,x.bestWeight)});const entries=Object.entries(rec).filter(([,r])=>r.bestReps||r.bestWeight);document.getElementById('prCount').textContent=entries.length+' records';el.innerHTML=entries.length?entries.map(([n,r])=>`<div class="pr-card"><strong>${n}</strong><span>${r.bestReps?r.bestReps+' reps':''}${r.bestReps&&r.bestWeight?' • ':''}${r.bestWeight?r.bestWeight+' lb':''}</span></div>`).join(''):'<div class="analytics-empty">Complete workouts to establish personal records.</div>';
}
function renderSystemInsights(){
 const el=document.getElementById('systemInsights');if(!el)return;const hist=workoutHistory(), week=hist.filter(x=>dateLocal(x.date)>=daysAgo(6)).length, prior=hist.filter(x=>dateLocal(x.date)>=daysAgo(13)&&dateLocal(x.date)<daysAgo(6)).length, insights=[];insights.push(`${week} workout${week===1?'':'s'} completed in the last 7 days.`);if(prior>0){const change=Math.round((week-prior)/prior*100);insights.push(`Training frequency is ${change>=0?'up':'down'} ${Math.abs(change)}% versus the previous 7 days.`);}if(state.currentStreak)insights.push(`Current training streak: ${state.currentStreak} day${state.currentStreak===1?'':'s'}.`);const w=state.weight||{};if(w.starting&&w.current&&w.goal){const lost=w.starting-w.current, remain=w.current-w.goal;insights.push(`${Math.max(0,lost).toFixed(1)} lb down from your starting weight, with ${Math.max(0,remain).toFixed(1)} lb remaining to goal.`);}const recentPr=hist.slice(-5).flatMap(x=>x.prs||[]);if(recentPr.length)insights.push(`Recent PR activity: ${[...new Set(recentPr)].slice(0,3).join(', ')}.`);el.innerHTML=insights.map(x=>`<div class="insight">${x}</div>`).join('');
}

/* ===== v8 CUSTOM WORKOUT BUILDER ===== */
const CUSTOM_WORKOUTS_KEY='theSystemCustomWorkouts';
function getCustomWorkouts(){try{return JSON.parse(localStorage.getItem(CUSTOM_WORKOUTS_KEY))||[];}catch(e){return[];}}
function saveCustomWorkouts(x){localStorage.setItem(CUSTOM_WORKOUTS_KEY,JSON.stringify(x));}
function builderRow(data={}){const d=document.createElement('div');d.className='builder-exercise';d.innerHTML=`<input class="form-input exercise-name" placeholder="Exercise" value="${data.name||''}" required><input class="form-input exercise-sets" type="number" min="1" max="20" value="${data.sets||3}" aria-label="Sets"><input class="form-input exercise-target" placeholder="8-12 reps" value="${data.target||'8-12 reps'}"><input class="form-input exercise-rest" type="number" min="0" max="600" value="${data.rest??45}" aria-label="Rest seconds"><button type="button" title="Remove">✕</button>`;d.querySelector('button').onclick=()=>d.remove();return d;}
function addBuilderExercise(data){const row=builderRow(data);document.getElementById('builderExercises')?.appendChild(row);const input=row.querySelector('.exercise-name');input?.addEventListener('change',()=>{const x=typeof exerciseLibrary==='function'?exerciseLibrary().find(e=>e.name.toLowerCase()===input.value.trim().toLowerCase()):null;if(!x)return;row.querySelector('.exercise-sets').value=x.sets;row.querySelector('.exercise-target').value=x.target;row.querySelector('.exercise-rest').value=x.rest;});}
function calculateCustomReward(exercises,minutes){const sets=exercises.reduce((a,e)=>a+e.sets,0);return Math.max(100,Math.min(800,Math.round((minutes*5+sets*8)/25)*25));}
function renderSavedWorkouts(){const el=document.getElementById('savedWorkouts');if(!el)return;const w=getCustomWorkouts();el.innerHTML=w.length?w.map(x=>`<div class="saved-workout"><div class="saved-workout__head"><strong>${x.name}</strong><span>+${x.xp} XP</span></div><div class="saved-workout__meta">${x.exercises.length} exercises • ${x.minutes} min • ${({str:'Strength',end:'Endurance',agi:'Conditioning',vit:'Recovery'}[x.stat]||x.stat)}${x.day==='any'?'':' • '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(x.day)]}</div><div class="saved-workout__actions"><button type="button" onclick="loadCustomWorkout('${x.id}')">Edit</button><button type="button" onclick="logCustomMission('${x.id}')">Complete</button><button type="button" onclick="deleteCustomWorkout('${x.id}')">Delete</button></div></div>`).join(''):'<div class="builder-empty">No custom missions yet. Build one and THE SYSTEM will stop pretending everyone trains exactly the same way.</div>';}
function loadCustomWorkout(id){const x=getCustomWorkouts().find(v=>v.id===id);if(!x)return;document.getElementById('builderName').value=x.name;document.getElementById('builderStat').value=x.stat;document.getElementById('builderDay').value=x.day;document.getElementById('builderMinutes').value=x.minutes;document.getElementById('builderForm').dataset.edit=id;const box=document.getElementById('builderExercises');box.innerHTML='';x.exercises.forEach(addBuilderExercise);document.getElementById('workoutBuilder').scrollIntoView({behavior:'smooth'});}
function deleteCustomWorkout(id){saveCustomWorkouts(getCustomWorkouts().filter(x=>x.id!==id));renderSavedWorkouts();}
function logCustomMission(id){const x=getCustomWorkouts().find(v=>v.id===id);if(!x)return;const today=getTodayStr(), key='customMissionDone:'+id+':'+today;if(localStorage.getItem(key)==='true'){alert('SYSTEM: This custom mission is already complete today.');return;}localStorage.setItem(key,'true');addXp(x.xp,'custom mission');if(window.SystemBuild?.awardTraining)window.SystemBuild.awardTraining(x.name,x.minutes,1);updateStreak();recordHistory('custom_mission_'+id+'_'+today,x.xp);const hist=workoutHistory();hist.push({date:today,mission:x.name,seconds:x.minutes*60,xp:x.xp,prs:[],sets:[]});localStorage.setItem('systemWorkoutSessions',JSON.stringify(hist.slice(-365)));addSystemMessage(`${x.name} complete — ${x.minutes} min • +${x.xp} XP`,'quest');saveState();renderAll();if(typeof renderAnalytics==='function')renderAnalytics();alert(`MISSION COMPLETE\n${x.name}\n+${x.xp} XP`);}
function initWorkoutBuilder(){const form=document.getElementById('builderForm');if(!form)return;const box=document.getElementById('builderExercises');if(!box.children.length){addBuilderExercise({name:'Push-Ups',sets:3,target:'8-12 reps',rest:45});addBuilderExercise({name:'Squats',sets:3,target:'12-15 reps',rest:45});}document.getElementById('addBuilderExercise').onclick=()=>addBuilderExercise();form.onsubmit=e=>{e.preventDefault();const exercises=[...box.querySelectorAll('.builder-exercise')].map(r=>({name:r.querySelector('.exercise-name').value.trim(),sets:Number(r.querySelector('.exercise-sets').value)||1,target:r.querySelector('.exercise-target').value.trim()||'reps',rest:Number(r.querySelector('.exercise-rest').value)||0})).filter(x=>x.name);if(!exercises.length)return;const minutes=Number(document.getElementById('builderMinutes').value)||30,id=form.dataset.edit||('cw_'+Date.now()),workouts=getCustomWorkouts(),obj={id,name:document.getElementById('builderName').value.trim(),stat:document.getElementById('builderStat').value,day:document.getElementById('builderDay').value,minutes,exercises,xp:calculateCustomReward(exercises,minutes)};const i=workouts.findIndex(x=>x.id===id);if(i>=0)workouts[i]=obj;else workouts.push(obj);saveCustomWorkouts(workouts);delete form.dataset.edit;form.reset();document.getElementById('builderMinutes').value=30;box.innerHTML='';addBuilderExercise();renderSavedWorkouts();addSystemMessage(`${obj.name} saved — ${obj.exercises.length} exercises • ${obj.xp} XP reward`,'quest');};renderSavedWorkouts();}
document.addEventListener('DOMContentLoaded',initWorkoutBuilder);


// --- Exercise Library v10 ---
const BUILTIN_EXERCISES=[
{name:'Push-Ups',muscle:'Chest',equipment:'Bodyweight',difficulty:'Beginner',stat:'Strength',sets:3,target:'8-12 reps',rest:45},
{name:'Incline Push-Ups',muscle:'Chest',equipment:'Bodyweight',difficulty:'Beginner',stat:'Strength',sets:3,target:'10-15 reps',rest:45},
{name:'Bodyweight Squats',muscle:'Legs',equipment:'Bodyweight',difficulty:'Beginner',stat:'Strength',sets:3,target:'12-15 reps',rest:45},
{name:'Reverse Lunges',muscle:'Legs',equipment:'Bodyweight',difficulty:'Beginner',stat:'Conditioning',sets:3,target:'10/leg',rest:30},
{name:'Glute Bridge',muscle:'Glutes',equipment:'Bodyweight',difficulty:'Beginner',stat:'Recovery',sets:3,target:'12-15 reps',rest:30},
{name:'Plank',muscle:'Core',equipment:'Bodyweight',difficulty:'Beginner',stat:'Endurance',sets:3,target:'30-45 sec',rest:30},
{name:'Mountain Climbers',muscle:'Full Body',equipment:'Bodyweight',difficulty:'Intermediate',stat:'Conditioning',sets:4,target:'30 sec',rest:30},
{name:'High Knees',muscle:'Cardio',equipment:'Bodyweight',difficulty:'Beginner',stat:'Conditioning',sets:4,target:'30 sec',rest:30},
{name:'Brisk Walk',muscle:'Cardio',equipment:'None',difficulty:'Beginner',stat:'Endurance',sets:1,target:'10 min',rest:0},
{name:'Stretching',muscle:'Mobility',equipment:'None',difficulty:'Beginner',stat:'Recovery',sets:1,target:'10 min',rest:0},
{name:'Dumbbell Press',muscle:'Chest',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'8-12 reps',rest:60},
{name:'Dumbbell Rows',muscle:'Back',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'8-12 reps',rest:60},
{name:'Shoulder Press',muscle:'Shoulders',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'8-12 reps',rest:60},
{name:'Biceps Curls',muscle:'Arms',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'10-15 reps',rest:45},
{name:'Triceps Extensions',muscle:'Arms',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'10-15 reps',rest:45},
{name:'Dumbbell Glute Bridge',muscle:'Glutes',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'12-15 reps',rest:60},
{name:'Goblet Squat',muscle:'Legs',equipment:'Dumbbells',difficulty:'Beginner',stat:'Strength',sets:3,target:'10-12 reps',rest:60},
{name:'Barbell Bench Press',muscle:'Chest',equipment:'Barbell',difficulty:'Intermediate',stat:'Strength',sets:3,target:'8-10 reps',rest:75},
{name:'Barbell Squat',muscle:'Legs',equipment:'Barbell',difficulty:'Intermediate',stat:'Strength',sets:3,target:'8-10 reps',rest:90},
{name:'Barbell Hip Thrust',muscle:'Glutes',equipment:'Barbell',difficulty:'Intermediate',stat:'Strength',sets:3,target:'10-12 reps',rest:75},
{name:'Band Chest Press',muscle:'Chest',equipment:'Resistance Bands',difficulty:'Beginner',stat:'Strength',sets:3,target:'12-15 reps',rest:45},
{name:'Band Squat',muscle:'Legs',equipment:'Resistance Bands',difficulty:'Beginner',stat:'Strength',sets:3,target:'12-15 reps',rest:45},
{name:'Band Glute Bridge',muscle:'Glutes',equipment:'Resistance Bands',difficulty:'Beginner',stat:'Strength',sets:3,target:'15 reps',rest:45},
{name:'Cardio Machine',muscle:'Cardio',equipment:'Cardio Machine',difficulty:'Beginner',stat:'Endurance',sets:1,target:'10 min',rest:0}
];
function getCustomExercises(){try{return JSON.parse(localStorage.getItem('systemCustomExercises')||'[]')}catch(e){return []}}
function saveCustomExercises(x){localStorage.setItem('systemCustomExercises',JSON.stringify(x));}
function exerciseLibrary(){const m=new Map();[...BUILTIN_EXERCISES,...getCustomExercises()].forEach(x=>m.set(x.name.toLowerCase(),x));return [...m.values()];}
function addLibraryExerciseToBuilder(name){const x=exerciseLibrary().find(e=>e.name===name);if(!x)return;addBuilderExercise({name:x.name,sets:x.sets,target:x.target,rest:x.rest});document.getElementById('workoutBuilder')?.scrollIntoView({behavior:'smooth'});}
function deleteLibraryExercise(name){const x=getCustomExercises().filter(e=>e.name!==name);saveCustomExercises(x);renderExerciseLibrary();}
function renderExerciseLibrary(){const grid=document.getElementById('exerciseLibraryGrid');if(!grid)return;const all=exerciseLibrary(),q=(document.getElementById('librarySearch')?.value||'').toLowerCase(),mus=document.getElementById('libraryMuscle')?.value||'all',eq=document.getElementById('libraryEquipment')?.value||'all';const muscles=[...new Set(all.map(x=>x.muscle))].sort(),equip=[...new Set(all.map(x=>x.equipment))].sort();const ms=document.getElementById('libraryMuscle'),es=document.getElementById('libraryEquipment');if(ms&&ms.options.length<=1)ms.innerHTML='<option value="all">All muscle groups</option>'+muscles.map(x=>`<option>${x}</option>`).join('');if(es&&es.options.length<=1)es.innerHTML='<option value="all">All equipment</option>'+equip.map(x=>`<option>${x}</option>`).join('');const filtered=all.filter(x=>(!q||[x.name,x.muscle,x.equipment,x.stat].join(' ').toLowerCase().includes(q))&&(mus==='all'||x.muscle===mus)&&(eq==='all'||x.equipment===eq));grid.innerHTML=filtered.map(x=>`<article class="library-card"><div class="library-card__head"><h3>${x.name}</h3><span class="stat-chip">${x.stat}</span></div><div class="library-card__meta">${x.muscle} • ${x.equipment} • ${x.difficulty}</div><div class="library-card__defaults">${x.sets} sets • ${x.target} • ${x.rest}s rest</div><div class="library-card__actions"><button type="button" onclick="addLibraryExerciseToBuilder('${x.name.replace(/'/g,"\\'")}')">Add to Mission</button>${BUILTIN_EXERCISES.some(b=>b.name===x.name)?'':`<button type="button" onclick="deleteLibraryExercise('${x.name.replace(/'/g,"\\'")}')">Delete</button>`}</div></article>`).join('')||'<div class="builder-empty">No exercises match those filters.</div>';const dl=document.getElementById('exerciseLibraryNames');if(dl)dl.innerHTML=all.map(x=>`<option value="${x.name}"></option>`).join('');}
function initExerciseLibrary(){['librarySearch','libraryMuscle','libraryEquipment'].forEach(id=>document.getElementById(id)?.addEventListener(id==='librarySearch'?'input':'change',renderExerciseLibrary));const f=document.getElementById('libraryExerciseForm');if(f)f.onsubmit=e=>{e.preventDefault();const obj={name:document.getElementById('libName').value.trim(),muscle:document.getElementById('libMuscle').value.trim(),equipment:document.getElementById('libEquipment').value.trim(),difficulty:document.getElementById('libDifficulty').value,stat:document.getElementById('libStat').value,sets:Number(document.getElementById('libSets').value)||3,target:document.getElementById('libTarget').value.trim()||'8-12 reps',rest:Number(document.getElementById('libRest').value)||0};if(!obj.name)return;const a=getCustomExercises(),i=a.findIndex(x=>x.name.toLowerCase()===obj.name.toLowerCase());if(i>=0)a[i]=obj;else a.push(obj);saveCustomExercises(a);f.reset();document.getElementById('libSets').value=3;document.getElementById('libTarget').value='8-12 reps';document.getElementById('libRest').value=45;renderExerciseLibrary();addSystemMessage(`${obj.name} added to Exercise Library`,'quest');};renderExerciseLibrary();}
document.addEventListener('DOMContentLoaded',initExerciseLibrary);

/* ===== v10 ADAPTIVE PROGRESSION ===== */
function getProgressionOverrides(){try{return JSON.parse(localStorage.getItem('systemProgressionOverrides')||'{}')}catch(e){return {}}}
function saveProgressionOverrides(x){localStorage.setItem('systemProgressionOverrides',JSON.stringify(x));}
function getProgressionDecisions(){try{return JSON.parse(localStorage.getItem('systemProgressionDecisions')||'{}')}catch(e){return {}}}
function saveProgressionDecisions(x){localStorage.setItem('systemProgressionDecisions',JSON.stringify(x));}
function targetRange(t){const m=String(t).match(/(\d+)(?:-(\d+))?\s*(reps|\/leg|sec|min)/i);return m?{low:Number(m[1]),high:Number(m[2]||m[1]),unit:m[3].toLowerCase()}:null;}
function recentExerciseSessions(name,limit=3){return workoutHistory().slice().reverse().map(s=>({date:s.date,sets:(s.sets||[]).filter(x=>x.name===name)})).filter(x=>x.sets.length).slice(0,limit);}
function progressionRecommendation(ex){
 const range=targetRange(ex.target); if(!range)return null; const sessions=recentExerciseSessions(ex.name,3); if(!sessions.length)return null;
 const all=sessions.flatMap(s=>s.sets), reps=all.map(x=>Number(x.reps)||0), weights=all.map(x=>Number(x.weight)||0), avg=reps.reduce((a,b)=>a+b,0)/Math.max(1,reps.length), weighted=weights.some(w=>w>0), maxW=Math.max(0,...weights);
 const successful=sessions.length>=2&&sessions.every(s=>s.sets.every(x=>(Number(x.reps)||0)>=range.high));
 const struggling=sessions.length>=2&&sessions.slice(0,2).every(s=>s.sets.some(x=>(Number(x.reps)||0)<Math.max(1,range.low-1)));
 if(successful){if(weighted)return {name:ex.name,type:'progress',status:'PROGRESSION AVAILABLE',reason:`You reached the top of the target range in ${sessions.length} recent sessions.`,current:ex.target,suggestedTarget:ex.target,suggestedWeight:Math.round((maxW+5)*2)/2};const inc=range.unit==='sec'?5:range.unit==='min'?1:2;return {name:ex.name,type:'progress',status:'PROGRESSION AVAILABLE',reason:`You consistently reached the current target in ${sessions.length} recent sessions.`,current:ex.target,suggestedTarget:`${range.low+inc}-${range.high+inc} ${range.unit==='\/leg'?'/leg':range.unit}`,suggestedWeight:0};}
 if(struggling)return {name:ex.name,type:'recovery',status:'HOLD / RECOVER',reason:'Recent sets fell below the target range. Keep the current target and prioritize clean completion.',current:ex.target,suggestedTarget:ex.target,suggestedWeight:maxW};
 return {name:ex.name,type:'maintain',status:'MAINTAIN',reason:`Recent average: ${avg.toFixed(1)}. Build consistency before increasing difficulty.`,current:ex.target,suggestedTarget:ex.target,suggestedWeight:maxW};
}
function allProgressionRecommendations(){const seen=new Map();exerciseLibrary().forEach(ex=>{const r=progressionRecommendation(ex);if(r)seen.set(ex.name,r)});return [...seen.values()];}
function acceptProgression(name){const rec=allProgressionRecommendations().find(x=>x.name===name);if(!rec)return;const o=getProgressionOverrides();o[name]={target:rec.suggestedTarget,weight:rec.suggestedWeight||0,acceptedAt:getTodayStr()};saveProgressionOverrides(o);const d=getProgressionDecisions();d[name]={status:'accepted',date:getTodayStr()};saveProgressionDecisions(d);addSystemMessage(`${name} progression accepted — target ${rec.suggestedTarget}${rec.suggestedWeight?' @ '+rec.suggestedWeight+' lb':''}`,'quest');renderAdaptiveProgression();renderSystemMission();}
function rejectProgression(name){const d=getProgressionDecisions();d[name]={status:'rejected',date:getTodayStr()};saveProgressionDecisions(d);renderAdaptiveProgression();}
function renderAdaptiveProgression(){const el=document.getElementById('adaptiveRecommendations');if(!el)return;const decisions=getProgressionDecisions(),recs=allProgressionRecommendations();document.getElementById('adaptiveMeta').textContent=recs.length?`${recs.filter(x=>x.type==='progress').length} upgrades found`:'Waiting for training data';if(!recs.length){el.innerHTML='<div class="adaptive-empty">Complete at least two workouts for the same exercise and THE SYSTEM will begin comparing performance.</div>';return;}el.innerHTML=recs.map(r=>{const dec=decisions[r.name],accepted=dec?.status==='accepted';return `<article class="adaptive-card"><div class="adaptive-card__head"><h3>${r.name}</h3><span class="adaptive-status">${r.status}</span></div><p>${r.reason}</p><div class="adaptive-target">${r.suggestedTarget}${r.suggestedWeight?' • '+r.suggestedWeight+' lb':''}</div><div class="adaptive-actions">${r.type==='progress'&&!accepted?`<button class="accept" onclick="acceptProgression('${r.name.replace(/'/g,"\\'")}')">Accept</button><button onclick="rejectProgression('${r.name.replace(/'/g,"\\'")}')">Not now</button>`:accepted?'<span class="quest-section__meta">ACCEPTED</span>':'<span class="quest-section__meta">NO INCREASE</span>'}</div></article>`}).join('');}
function adaptiveTargetFor(name,fallback){const o=getProgressionOverrides()[name];return o?.target||fallback;}
function adaptiveWeightFor(name){return Number(getProgressionOverrides()[name]?.weight)||0;}
// Wrap mission rendering so accepted targets automatically feed future daily workouts.
const _v10RenderSystemMission=renderSystemMission;
renderSystemMission=function(){_v10RenderSystemMission();const m=adaptiveSystemMission();const cards=document.querySelectorAll('#mission-exercises .mission-exercise');m.exercises.forEach((e,i)=>{const o=getProgressionOverrides()[e[0]];if(o&&cards[i]){const sm=cards[i].querySelector('small');if(sm)sm.textContent=`${e[1]} sets • ${o.target||e[2]}${o.weight?' • '+o.weight+' lb':''}${e[3]?' • '+e[3]+'s rest':''}`;}});}
const _v10RenderLiveSet=renderLiveSet;
renderLiveSet=function(){_v10RenderLiveSet();const m=adaptiveSystemMission(),x=flatSets(m)[liveIndex],o=getProgressionOverrides()[x.name];if(o){document.getElementById('liveTarget').textContent=`Target: ${o.target}${o.weight?' @ '+o.weight+' lb':''}`;document.getElementById('liveReps').value=parseTargetReps(o.target)||document.getElementById('liveReps').value;if(o.weight)document.getElementById('liveWeight').value=o.weight;}}
document.addEventListener('DOMContentLoaded',renderAdaptiveProgression);


/* ===== v11 PROFILE, SETTINGS & DATA MANAGEMENT ===== */
const SETTINGS_KEY='theSystemSettings';
function getSystemSettings(){try{return Object.assign({name:'Player',units:'imperial',goal:'balanced',sounds:false},JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(e){return {name:'Player',units:'imperial',goal:'balanced',sounds:false}}}
function saveSystemSettings(x){localStorage.setItem(SETTINGS_KEY,JSON.stringify(x));}
function renderSystemSettings(){const x=getSystemSettings();const n=document.getElementById('profileName');if(!n)return;n.value=x.name;document.getElementById('unitSystem').value=x.units;document.getElementById('workoutGoal').value=x.goal;document.getElementById('soundSetting').checked=!!x.sounds;}
function systemBackup(){const data={app:'The System - Workout Tracker',version:11,exportedAt:new Date().toISOString(),localStorage:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);data.localStorage[k]=localStorage.getItem(k);}return data;}
function exportSystemBackup(){const blob=new Blob([JSON.stringify(systemBackup(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='the-system-workout-tracker-backup-'+getTodayStr()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('backupStatus').textContent='Backup exported successfully.';}
async function importSystemBackup(file){const status=document.getElementById('backupStatus');try{const data=JSON.parse(await file.text());if(!data||data.app!=='The System - Workout Tracker'||!data.localStorage)throw new Error('Invalid backup');if(!confirm('Import this backup? Current app data will be replaced.'))return;localStorage.clear();Object.entries(data.localStorage).forEach(([k,v])=>localStorage.setItem(k,v));status.textContent='Backup restored. Reloading…';setTimeout(()=>location.reload(),500);}catch(e){status.textContent='Backup could not be imported.';}}
function resetTrainingData(){if(!confirm('Reset workout history, missions, exercise records, streaks and progression? Profile/settings will be kept.'))return;['systemWorkoutSessions','systemMissionRecords','systemProgressionOverrides','systemProgressionDecisions','theSystemCustomWorkouts','systemCustomExercises'].forEach(k=>localStorage.removeItem(k));Object.keys(localStorage).filter(k=>k.startsWith('systemMission:')||k.startsWith('customMissionDone:')).forEach(k=>localStorage.removeItem(k));state.history=[];state.exerciseRecords=[];state.currentStreak=0;state.bestStreak=0;saveState();location.reload();}
function factoryResetSystem(){if(!confirm('FACTORY RESET: Delete ALL app data on this device? This cannot be undone unless you exported a backup.'))return;if(!confirm('Final confirmation: erase THE SYSTEM data?'))return;localStorage.clear();location.reload();}
function initSystemSettings(){renderSystemSettings();const f=document.getElementById('profileForm');if(f)f.onsubmit=e=>{e.preventDefault();const x={name:document.getElementById('profileName').value.trim()||'Player',units:document.getElementById('unitSystem').value,goal:document.getElementById('workoutGoal').value,sounds:document.getElementById('soundSetting').checked};saveSystemSettings(x);document.getElementById('backupStatus').textContent='Settings saved.';addSystemMessage(`Profile updated — ${x.name} • ${x.goal}`,'quest');};document.getElementById('exportDataBtn')?.addEventListener('click',exportSystemBackup);document.getElementById('importDataInput')?.addEventListener('change',e=>{if(e.target.files[0])importSystemBackup(e.target.files[0]);});document.getElementById('resetTrainingBtn')?.addEventListener('click',resetTrainingData);document.getElementById('resetAllBtn')?.addEventListener('click',factoryResetSystem);}
document.addEventListener('DOMContentLoaded',initSystemSettings);

// --- Shared Supabase Cloud Sync ---
const CLOUD_CONFIG_KEY='theSystemCloudConfig';
const CLOUD_SESSION_KEY='theSystemCloudSession';
const SYSTEM_CLOUD={url:'https://wczmxbvdfctffhpohnne.supabase.co',key:'sb_publishable_Pl0Ls17XrDeEHtt4n2UOPQ_PKyye8o1'};
function getCloudConfig(){return SYSTEM_CLOUD}
function getCloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null')}catch(e){return null}}
function cloudStatus(msg,ok=false){const e=document.getElementById('cloudStatus');if(e){e.textContent=msg;e.dataset.ok=ok?'1':'0';}}
async function cloudRequest(path,opts={}){const c=SYSTEM_CLOUD,s=getCloudSession();const h={'apikey':c.key,'Content-Type':'application/json',...(opts.headers||{})};if(s?.access_token)h.Authorization='Bearer '+s.access_token;const r=await fetch(c.url+path,{...opts,headers:h});const body=await r.text();let data={};try{data=body?JSON.parse(body):{}}catch(e){}if(!r.ok)throw new Error(data.msg||data.message||data.error_description||data.error||'Cloud request failed.');return data;}
async function cloudSignUp(){try{const emailEl=document.getElementById('cloudEmail'),passwordEl=document.getElementById('cloudPassword');if(!emailEl||!passwordEl){showAuthGate();throw new Error('Use the account screen to create your account.');}const email=emailEl.value.trim(),password=passwordEl.value;if(!email||password.length<6)throw new Error('Enter a valid email and a password of at least 6 characters.');cloudStatus('Creating account…');const s=await cloudRequest('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});if(s.access_token){localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(s));cloudStatus('Account created and signed in.',true);renderCloudAccount();}else cloudStatus('Account created. Check your email to confirm it, then sign in.',true);}catch(e){cloudStatus(e.message)}}
async function cloudSignIn(){try{const emailEl=document.getElementById('cloudEmail'),passwordEl=document.getElementById('cloudPassword');if(!emailEl||!passwordEl){showAuthGate();throw new Error('Use the account screen to sign in.');}const email=emailEl.value.trim(),password=passwordEl.value;if(!email||!password)throw new Error('Enter your email and password.');cloudStatus('Signing in…');const s=await cloudRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(s));cloudStatus('Signed in as '+(s.user?.email||email)+'.',true);renderCloudAccount();}catch(e){cloudStatus(e.message)}}
function cloudSignOut(){localStorage.removeItem(CLOUD_SESSION_KEY);cloudStatus('Signed out.');renderCloudAccount();showAuthGate();}
function cloudPayload(){const data=systemBackup();delete data.localStorage[CLOUD_CONFIG_KEY];delete data.localStorage[CLOUD_SESSION_KEY];return data;}
async function pushCloudBackup(){try{const s=getCloudSession();if(!s?.user?.id)throw new Error('Sign in first.');cloudStatus('Uploading…');syncLocalSocialIdentity();await cloudRequest('/rest/v1/workout_backups?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:s.user.id,data:cloudPayload(),updated_at:new Date().toISOString()})});localStorage.setItem('theSystemLastSync',new Date().toISOString());cloudStatus('Cloud backup uploaded.',true);pushSocialIdentity();renderCloudAccount();}catch(e){cloudStatus(e.message)}}
async function pullCloudBackup(){try{const s=getCloudSession();if(!s?.user?.id)throw new Error('Sign in first.');cloudStatus('Downloading…');const rows=await cloudRequest('/rest/v1/workout_backups?user_id=eq.'+encodeURIComponent(s.user.id)+'&select=data,updated_at&limit=1');if(!rows.length)throw new Error('No cloud backup found.');if(!confirm('Restore the cloud backup on this device? Current local training data will be replaced.'))return;const keepSession=localStorage.getItem(CLOUD_SESSION_KEY);localStorage.clear();Object.entries(rows[0].data.localStorage||{}).forEach(([k,v])=>localStorage.setItem(k,v));if(keepSession)localStorage.setItem(CLOUD_SESSION_KEY,keepSession);localStorage.setItem('theSystemLastSync',rows[0].updated_at||new Date().toISOString());location.reload();}catch(e){cloudStatus(e.message)}}
function renderCloudAccount(){const s=getCloudSession(),signed=document.getElementById('cloudSignedIn');if(signed)signed.textContent=s?.user?.email?'SIGNED IN: '+s.user.email.toUpperCase():'NOT SIGNED IN';const last=document.getElementById('lastCloudSync');if(last){const x=localStorage.getItem('theSystemLastSync');last.textContent=x?'Last sync: '+new Date(x).toLocaleString():'No cloud sync yet.';}}
function initCloudSync(){renderCloudAccount();document.getElementById('cloudSignUp')?.addEventListener('click',cloudSignUp);document.getElementById('cloudSignIn')?.addEventListener('click',cloudSignIn);document.getElementById('cloudSignOut')?.addEventListener('click',cloudSignOut);document.getElementById('cloudPush')?.addEventListener('click',pushCloudBackup);document.getElementById('cloudPull')?.addEventListener('click',pullCloudBackup);}
document.addEventListener('DOMContentLoaded',initCloudSync);
let authMode='signin';
function authGateStatus(msg,ok=false){const e=document.getElementById('authGateStatus');if(e){e.textContent=msg;e.dataset.ok=ok?'1':'0'}}
function showAuthGate(){const g=document.getElementById('authGate');if(g)g.hidden=false}
function hideAuthGate(){const g=document.getElementById('authGate');if(g)g.hidden=true}
function setAuthMode(mode){authMode=mode;document.getElementById('authShowSignIn')?.classList.toggle('active',mode==='signin');document.getElementById('authShowSignUp')?.classList.toggle('active',mode==='signup');const b=document.getElementById('authSubmit');if(b)b.textContent=mode==='signin'?'Sign In':'Create Account';authGateStatus('')}
async function authGateSubmit(e){e.preventDefault();const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;if(!email||password.length<6){authGateStatus('Enter a valid email and a password of at least 6 characters.');return}try{authGateStatus(authMode==='signin'?'Signing in…':'Creating account…');if(authMode==='signup'){const s=await cloudRequest('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});if(s.access_token){localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(s));authGateStatus('Account created.',true);renderCloudAccount();hideAuthGate()}else authGateStatus('Account created. Check your email to confirm it, then return here and sign in.',true)}else{const s=await cloudRequest('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(s));renderCloudAccount();hideAuthGate()}}catch(err){authGateStatus(err.message)}}
async function authForgot(){const email=document.getElementById('authEmail').value.trim();if(!email){authGateStatus('Enter your email first.');return}try{authGateStatus('Sending reset email…');const redirectTo=location.origin+location.pathname;await cloudRequest('/auth/v1/recover?redirect_to='+encodeURIComponent(redirectTo),{method:'POST',body:JSON.stringify({email})});authGateStatus('Password reset email sent.',true)}catch(err){authGateStatus(err.message)}}
function recoveryParams(){const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));return {type:q.get('type')||h.get('type'),access_token:q.get('access_token')||h.get('access_token'),refresh_token:q.get('refresh_token')||h.get('refresh_token')}}
function showRecovery(){showAuthGate();document.querySelector('.auth-tabs').hidden=true;document.getElementById('authGateForm').hidden=true;document.getElementById('authForgot').hidden=true;document.getElementById('recoveryForm').hidden=false;const title=document.querySelector('.auth-card h1');if(title)title.innerHTML='Set a new<br>password.';const copy=document.querySelector('.auth-copy');if(copy)copy.textContent='Choose a new password for your THE SYSTEM account.';authGateStatus('Recovery link verified.',true)}
async function submitRecovery(e){e.preventDefault();const p=document.getElementById('recoveryPassword').value,c=document.getElementById('recoveryPasswordConfirm').value;if(p.length<6){authGateStatus('Password must be at least 6 characters.');return}if(p!==c){authGateStatus('Passwords do not match.');return}const r=recoveryParams();if(!r.access_token){authGateStatus('This recovery link is invalid or expired.');return}try{authGateStatus('Updating password…');const res=await fetch(SYSTEM_CLOUD.url+'/auth/v1/user',{method:'PUT',headers:{apikey:SYSTEM_CLOUD.key,Authorization:'Bearer '+r.access_token,'Content-Type':'application/json'},body:JSON.stringify({password:p})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||data.msg||'Could not update password.');localStorage.removeItem(CLOUD_SESSION_KEY);history.replaceState({},'',location.pathname);authGateStatus('Password updated. You can now sign in.',true);setTimeout(()=>location.reload(),900)}catch(err){authGateStatus(err.message)}}
function initAuthGate(){const r=recoveryParams();if(r.type==='recovery'&&r.access_token){showRecovery()}else if(getCloudSession()?.access_token)hideAuthGate();else showAuthGate();document.getElementById('authShowSignIn')?.addEventListener('click',()=>setAuthMode('signin'));document.getElementById('authShowSignUp')?.addEventListener('click',()=>setAuthMode('signup'));document.getElementById('authGateForm')?.addEventListener('submit',authGateSubmit);document.getElementById('authForgot')?.addEventListener('click',authForgot);document.getElementById('recoveryForm')?.addEventListener('submit',submitRecovery)}
document.addEventListener('DOMContentLoaded',initAuthGate);

// RC1 navigation and lightweight production error handling
document.addEventListener('DOMContentLoaded',()=>{
  const buttons=[...document.querySelectorAll('.app-nav [data-target]')];
  buttons.forEach(btn=>btn.addEventListener('click',()=>{
    const el=document.getElementById(btn.dataset.target);
    if(el){el.scrollIntoView({behavior:'smooth',block:'start'});buttons.forEach(x=>x.classList.remove('active'));btn.classList.add('active');}
  }));
  if(buttons[0])buttons[0].classList.add('active');
});
window.addEventListener('error',e=>{console.error('THE SYSTEM runtime error:',e.error||e.message);});

// --- V3 Nutrition System ---
const NUTRITION_KEY='theSystemNutritionV1';
const DEFAULT_MEALS=[
 {name:'Greek Yogurt Power Bowl',type:'Breakfast',calories:410,protein:35,carbs:48,fat:9,ingredients:['Greek yogurt','oats','berries','honey']},
 {name:'Egg & Oat Breakfast',type:'Breakfast',calories:460,protein:32,carbs:45,fat:17,ingredients:['eggs','oats','banana']},
 {name:'Chicken Rice Bowl',type:'Lunch',calories:560,protein:52,carbs:61,fat:12,ingredients:['chicken breast','rice','mixed vegetables','salsa']},
 {name:'Turkey Wrap & Fruit',type:'Lunch',calories:490,protein:39,carbs:57,fat:12,ingredients:['turkey breast','whole wheat wraps','lettuce','tomato','fruit']},
 {name:'Lean Beef & Potato Plate',type:'Dinner',calories:620,protein:51,carbs:63,fat:18,ingredients:['lean ground beef','potatoes','green beans']},
 {name:'Chicken Pasta',type:'Dinner',calories:590,protein:49,carbs:70,fat:13,ingredients:['chicken breast','pasta','marinara sauce','spinach']},
 {name:'Protein Shake & Banana',type:'Snack',calories:280,protein:31,carbs:34,fat:3,ingredients:['protein powder','milk','banana']},
 {name:'Cottage Cheese & Berries',type:'Snack',calories:240,protein:27,carbs:25,fat:4,ingredients:['cottage cheese','berries']}
];
function nutritionState(){try{return JSON.parse(localStorage.getItem(NUTRITION_KEY))||{}}catch(e){return {}}}
function saveNutrition(s){localStorage.setItem(NUTRITION_KEY,JSON.stringify(s))}
function nutritionToday(){return new Date().toISOString().slice(0,10)}
function ensureNutrition(){const s=nutritionState();s.targets=s.targets||{calories:2000,protein:160,carbs:200,fat:65};s.days=s.days||{};s.groceryChecked=s.groceryChecked||{};s.days[nutritionToday()]=s.days[nutritionToday()]||[];return s}
function nutritionDate(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function generateNutritionWeek(){const s=ensureNutrition();for(let d=0;d<7;d++){const date=nutritionDate(d);s.days[date]=['Breakfast','Lunch','Dinner','Snack'].map((type,i)=>{const pool=DEFAULT_MEALS.filter(m=>m.type===type);return {...pool[(d+i)%pool.length],id:Date.now()+d*10+i}})}saveNutrition(s);renderNutrition()}
function clearNutritionWeek(){const s=ensureNutrition();for(let d=0;d<7;d++)delete s.days[nutritionDate(d)];s.days[nutritionToday()]=[];saveNutrition(s);renderNutrition()}
function toggleGrocery(name,checked){const s=ensureNutrition();s.groceryChecked[name]=checked;saveNutrition(s)}
function mealMacros(m){return m.calories+' cal • '+m.protein+'g protein • '+(m.carbs||0)+'g carbs • '+(m.fat||0)+'g fat'}
function addNutritionMeal(m){const s=ensureNutrition();s.days[nutritionToday()].push({...m,id:Date.now()+Math.random()});saveNutrition(s);renderNutrition()}
function removeNutritionMeal(id){const s=ensureNutrition();s.days[nutritionToday()]=s.days[nutritionToday()].filter(m=>m.id!==id);saveNutrition(s);renderNutrition()}
function renderNutrition(){const s=ensureNutrition(),t=s.targets,meals=s.days[nutritionToday()]||[];const total=k=>meals.reduce((a,m)=>a+(Number(m[k])||0),0);
 [['Calories','calories',''],['Protein','protein','g'],['Carbs','carbs','g'],['Fat','fat','g']].forEach(([label,k,u])=>{const e=document.getElementById('nutrition'+label);if(e)e.textContent=total(k)+' / '+t[k]+u;const b=document.getElementById('nutrition'+label+'Bar');if(b)b.style.width=Math.min(100,total(k)/t[k]*100)+'%';});
 ['Calories','Protein','Carbs','Fat'].forEach(x=>{const e=document.getElementById('target'+x);if(e)e.value=t[x.toLowerCase()]});
 const plan=document.getElementById('todayMeals');if(plan)plan.innerHTML=meals.length?meals.map(m=>'<div class="meal-item"><div class="meal-item__head"><strong>'+m.type+': '+m.name+'</strong><button type="button" data-remove-meal="'+m.id+'">Remove</button></div><div class="meal-macros">'+mealMacros(m)+'</div></div>').join(''):'<div class="builder-empty">No meals planned yet. Add a recommendation below.</div>';
 const rec=document.getElementById('mealRecommendations');if(rec)rec.innerHTML=DEFAULT_MEALS.map((m,i)=>'<div class="meal-rec"><div class="meal-rec__head"><strong>'+m.name+'</strong><span>'+m.type+'</span></div><div class="meal-macros">'+mealMacros(m)+'</div><div class="meal-actions"><button class="btn-primary" type="button" data-add-rec="'+i+'">Add to Today</button></div></div>').join('');
 document.querySelectorAll('[data-add-rec]').forEach(b=>b.onclick=()=>addNutritionMeal(DEFAULT_MEALS[Number(b.dataset.addRec)]));document.querySelectorAll('[data-remove-meal]').forEach(b=>b.onclick=()=>removeNutritionMeal(Number(b.dataset.removeMeal)));
 const weekly=document.getElementById('weeklyMealPlan');if(weekly)weekly.innerHTML=Array.from({length:7},(_,d)=>{const date=nutritionDate(d),list=s.days[date]||[],label=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});return '<div class="week-day"><div class="week-day__head"><strong>'+label+'</strong><span>'+list.reduce((a,m)=>a+(Number(m.calories)||0),0)+' cal</span></div><div class="week-day__meals">'+(list.length?list.map(m=>'<div class="week-meal"><span>'+m.type+': '+m.name+'</span><span>'+m.protein+'g P</span></div>').join(''):'<span class="builder-empty">No meals planned</span>')+'</div></div>'}).join('');
 const groceries={};for(let d=0;d<7;d++)(s.days[nutritionDate(d)]||[]).forEach(m=>(m.ingredients||[]).forEach(x=>groceries[x]=(groceries[x]||0)+1));const gl=document.getElementById('groceryList');if(gl)gl.innerHTML=Object.keys(groceries).length?Object.keys(groceries).sort().map(x=>'<label class="grocery-item"><input type="checkbox" data-grocery="'+x+'" '+(s.groceryChecked[x]?'checked':'')+'> '+x+' <small>×'+groceries[x]+'</small></label>').join(''):'<div class="builder-empty">Generate or add meals to build your grocery list.</div>';document.querySelectorAll('[data-grocery]').forEach(x=>x.onchange=()=>toggleGrocery(x.dataset.grocery,x.checked));
}
function initNutrition(){renderNutrition();document.getElementById('generateWeekBtn')?.addEventListener('click',generateNutritionWeek);document.getElementById('clearWeekBtn')?.addEventListener('click',clearNutritionWeek);document.getElementById('nutritionTargetForm')?.addEventListener('submit',e=>{e.preventDefault();const s=ensureNutrition();s.targets={calories:Number(document.getElementById('targetCalories').value)||2000,protein:Number(document.getElementById('targetProtein').value)||160,carbs:Number(document.getElementById('targetCarbs').value)||200,fat:Number(document.getElementById('targetFat').value)||65};saveNutrition(s);renderNutrition()});document.getElementById('customMealForm')?.addEventListener('submit',e=>{e.preventDefault();addNutritionMeal({name:document.getElementById('mealName').value.trim(),type:document.getElementById('mealType').value,calories:Number(document.getElementById('mealCalories').value),protein:Number(document.getElementById('mealProtein').value),carbs:Number(document.getElementById('mealCarbs').value)||0,fat:Number(document.getElementById('mealFat').value)||0});e.target.reset()})}
document.addEventListener('DOMContentLoaded',initNutrition);

// Password visibility controls
function initPasswordToggles(){document.querySelectorAll('[data-password-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const input=document.getElementById(btn.dataset.passwordToggle);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Hide':'Show';btn.setAttribute('aria-label',(show?'Hide ':'Show ')+(input.placeholder||'password').toLowerCase())}))}
document.addEventListener('DOMContentLoaded',initPasswordToggles);


/* ===== v11 COLLAPSIBLE EXERCISE LIBRARY ===== */
const EXERCISE_LIBRARY_OPEN_KEY='theSystemExerciseLibraryOpen';
function initExerciseLibraryCollapse(){const section=document.getElementById('exerciseLibrary'),toggle=document.getElementById('exerciseLibraryToggle'),body=document.getElementById('exerciseLibraryBody');if(!section||!toggle||!body)return;const setOpen=open=>{section.classList.toggle('is-collapsed',!open);toggle.setAttribute('aria-expanded',String(open));const state=toggle.querySelector('.library-collapse-state');if(state)state.textContent=open?'COLLAPSE ▴':'EXPAND ▾';localStorage.setItem(EXERCISE_LIBRARY_OPEN_KEY,open?'1':'0')};setOpen(localStorage.getItem(EXERCISE_LIBRARY_OPEN_KEY)==='1');toggle.onclick=()=>setOpen(toggle.getAttribute('aria-expanded')!=='true')}
document.addEventListener('DOMContentLoaded',initExerciseLibraryCollapse);

/* ===== HOME HUD QUICK COMMANDS ===== */
function initHudCommands(){document.querySelectorAll('[data-hud-target]').forEach(btn=>btn.addEventListener('click',()=>document.getElementById(btn.dataset.hudTarget)?.scrollIntoView({behavior:'smooth',block:'start'})));document.querySelectorAll('[data-hud-view]').forEach(btn=>btn.addEventListener('click',()=>{const nav=document.querySelector('.app-nav [data-view="'+btn.dataset.hudView+'"]');if(nav)nav.click()}))}
document.addEventListener('DOMContentLoaded',initHudCommands);

/* ===== V12 COMMAND HUD DATA BRIDGE ===== */
function renderCommandHud(){
  if(typeof state==='undefined')return;
  const rank=typeof getRank==='function'?getRank(state.level):{name:'E-Rank'};
  const need=typeof xpNeededForLevel==='function'?xpNeededForLevel(state.level):100;
  const pct=Math.min(100,Math.round((state.xp/Math.max(1,need))*100));
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('hudPlayerLevel','LV. '+state.level);set('hudPlayerRank',(rank.name||'E-RANK').toUpperCase());set('hudXpText',state.xp+' / '+need+' XP');
  const combatTitle=typeof getEquippedCombatTitle==='function'?getEquippedCombatTitle():null,hudTitle=document.getElementById('hudCombatTitle');if(hudTitle){hudTitle.textContent=combatTitle?.name||'';hudTitle.hidden=!combatTitle}
  const fill=document.getElementById('hudXpFill');if(fill)fill.style.width=pct+'%';
  set('hudStreak',state.currentStreak||0);set('hudWorkouts',state.totalQuestsCompleted||0);
  const plan=typeof WORKOUT_PLAN!=='undefined'?WORKOUT_PLAN[new Date().getDay()]:null;
  if(plan){set('hudMissionName',plan.name.toUpperCase());set('hudMissionFocus',plan.focus+' // 30 MIN');}
  const qs=state.dailyQuests||[],done=qs.filter(q=>q.completed).length,daily=qs.length?Math.round(done/qs.length*100):0;set('hudCorePercent',daily+'%');
  const pa=getPerformanceAnalysis(), rec=recommendPerformanceMission(); window.SystemPerformance={analysis:pa,recommendation:rec};
  const perfMap={str:'Str',end:'End',agi:'Agi',vit:'Vit'};
  pa.rows.forEach(x=>{const suf=perfMap[x.stat],bar=document.getElementById('hudPerf'+suf),val=document.getElementById('hudPerf'+suf+'Val');if(bar)bar.style.width=x.percent+'%';if(val)val.textContent=x.percent+'%'});
  set('hudPerfPriority',pa.rows.every(x=>x.score===0)?'ESTABLISHING BASELINE':performanceLabel(pa.weakest.stat)+' // '+rec.title.toUpperCase());
}
document.addEventListener('DOMContentLoaded',()=>{renderCommandHud();document.getElementById('hudBriefing')?.addEventListener('click',()=>document.getElementById('replayDailyBriefing')?.click());document.getElementById('hudPerfMission')?.addEventListener('click',()=>document.querySelector('.app-nav [data-view="missions"]')?.click())});
const _systemRenderAll=renderAll;renderAll=function(){_systemRenderAll();renderCommandHud()};

/* ===== V13 ORBITAL HOLOGRAM CONTROLLER ===== */
function initHologramCommandUnit(){
 const core=document.querySelector('.system-core'),win=document.getElementById('holoWindow'),title=document.getElementById('holoTitle'),kicker=document.getElementById('holoKicker'),body=document.getElementById('holoBody');
 if(!core||!win)return;
 const modules={
  player:()=>({k:'PLAYER // STATUS',t:'PLAYER PROFILE',b:'<div class="holo-data"><div>LEVEL<b>'+((state&&state.level)||1)+'</b></div><div>RANK<b>'+((typeof getRank==='function'?getRank(state.level).name:'E-Rank'))+'</b></div><div>XP<b>'+((state&&state.xp)||0)+'</b></div><div>STREAK<b>'+((state&&state.currentStreak)||0)+' DAYS</b></div></div><button class="holo-link" data-holo-view="profile">OPEN PROFILE</button>'}),
  missions:()=>({k:'MISSION // CONTROL',t:'TODAY’S MISSION',b:'<strong>'+((typeof WORKOUT_PLAN!=="undefined"&&WORKOUT_PLAN[new Date().getDay()])?WORKOUT_PLAN[new Date().getDay()].name:'TRAINING MISSION')+'</strong><br>Objectives ready for deployment.<button class="holo-link" data-holo-target="daily-mission">ENTER MISSION</button>'}),
  telemetry:()=>({k:'SYSTEM // TELEMETRY',t:'LIVE DATA',b:'<div class="holo-data"><div>STEPS<b>'+((document.getElementById("hudSteps")?.textContent)||"--")+'</b></div><div>ACTIVE<b>'+((document.getElementById("hudActive")?.textContent)||"--")+'</b></div><div>HEALTH LINK<b>READY</b></div><div>SYNC<b>ONLINE</b></div></div>'}),
  side:()=>({k:'OPTIONAL // OBJECTIVES',t:'SIDE MISSIONS',b:'Bonus objectives provide additional XP without replacing the primary mission.<button class="holo-link" data-holo-view="missions">VIEW SIDE MISSIONS</button>'}),
  boss:()=>({k:'GATE // DETECTED',t:'BOSS STAGE',b:'Weekly Gate encounters build combat progression. Rank Trials unlock only after promotion requirements are satisfied.<button class="holo-link" data-os-open="boss">ENTER BOSS STAGE</button>'}),
  progress:()=>({k:'CAMPAIGN // ANALYTICS',t:'PROGRESS',b:'<div class="holo-data"><div>MISSIONS<b>'+((state&&state.totalQuestsCompleted)||0)+'</b></div><div>LEVEL<b>'+((state&&state.level)||1)+'</b></div></div><button class="holo-link" data-holo-view="progress">OPEN ANALYTICS</button>'}),
  achievements:()=>({k:'SYSTEM // RECORDS',t:'ACHIEVEMENTS',b:'Unlocked achievements, rank milestones and personal records.<button class="holo-link" data-holo-view="progress">VIEW AWARDS</button>'}),
  profile:()=>({k:'SYSTEM // CONFIG',t:'PROFILE & SETTINGS',b:'Player identity, account sync and system configuration.<button class="holo-link" data-holo-view="profile">OPEN SETTINGS</button>'})
 };
 function close(){core.classList.remove('is-projecting');win.setAttribute('aria-hidden','true');document.querySelectorAll('[data-holo]').forEach(x=>x.classList.remove('active'))}
 function open(name,btn){const m=modules[name]?.();if(!m)return;kicker.textContent=m.k;title.textContent=m.t;body.innerHTML=m.b;core.classList.add('is-projecting');win.setAttribute('aria-hidden','false');document.querySelectorAll('[data-holo]').forEach(x=>x.classList.toggle('active',x===btn));bindInside()}
 function bindInside(){body.querySelectorAll('[data-holo-view]').forEach(b=>b.onclick=()=>{document.querySelector('.app-nav [data-view="'+b.dataset.holoView+'"]')?.click();close()});body.querySelectorAll('[data-holo-target]').forEach(b=>b.onclick=()=>{document.getElementById(b.dataset.holoTarget)?.scrollIntoView({behavior:'smooth',block:'start'});close()});body.querySelectorAll('[data-os-open]').forEach(b=>b.onclick=()=>{window.SystemOS?.open?.(b.dataset.osOpen);close()})}
 document.querySelectorAll('[data-holo]').forEach(b=>b.onclick=()=>open(b.dataset.holo,b));document.getElementById('holoClose')?.addEventListener('click',close);
}
document.addEventListener('DOMContentLoaded',initHologramCommandUnit);


/* ===== V14 THE SYSTEM OS WINDOW MANAGER ===== */
function initSystemOS(){
 document.body.classList.add('system-os-ready');
 const deck=document.getElementById('commandDeck'); if(!deck)return;
 const top=document.createElement('div');top.className='os-topbar';top.innerHTML='<span><b>THE SYSTEM OS</b> // CENTRAL COMMAND</span><span class="os-topbar__right"><i id="osNetwork">SYSTEM ONLINE</i><i id="osClock">--:--</i></span>';deck.appendChild(top);
 const stage=document.createElement('section');stage.className='os-module-stage';stage.setAttribute('aria-hidden','true');stage.innerHTML='<div class="os-module-scan"></div><header class="os-module-head"><div><small id="osModuleKicker">SYSTEM // MODULE</small><strong id="osModuleTitle">MODULE</strong></div><div class="os-module-controls"><button id="osModuleMin" type="button" aria-label="Minimize">−</button><button id="osModuleClose" type="button" aria-label="Close">×</button></div></header><div id="osModuleBody" class="os-module-body"></div>';deck.appendChild(stage);
 const body=document.getElementById('osModuleBody'),title=document.getElementById('osModuleTitle'),kicker=document.getElementById('osModuleKicker');
 let parked=null,current=null;
 const map={
  player:{title:'PLAYER STATUS',kicker:'PLAYER // IDENTITY',ids:['playerCard','statusScreen']},
  missions:{title:'MISSION CONTROL',kicker:'SYSTEM // MISSIONS',ids:['daily-mission','workoutBuilder','sideSystem']},
  side:{title:'SIDE MISSIONS',kicker:'OPTIONAL // OBJECTIVES',ids:['sideMissionSystem']},
  boss:{title:'BOSS STAGE',kicker:'GATE // ENCOUNTERS',ids:['bossStageSystem']},
  telemetry:{title:'HEALTH TELEMETRY',kicker:'BIOMETRIC // HEALTH LINK',ids:['exerciseTracker']},
  progress:{title:'CAMPAIGN PROGRESS',kicker:'SYSTEM // ANALYTICS',ids:['progressAnalytics','adaptiveProgression']},
  achievements:{title:'ACHIEVEMENTS',kicker:'SYSTEM // RECORDS',ids:['achievementGrid']},
  profile:{title:'SYSTEM CONFIGURATION',kicker:'PLAYER // SETTINGS',ids:['profileSettings']},
  nutrition:{title:'NUTRITION MODULE',kicker:'SYSTEM // FUEL',ids:['nutritionDashboard']},
  exercise:{title:'EXERCISE DATABASE',kicker:'SYSTEM // TRAINING ARCHIVE',ids:['exerciseLibrary']},
  social:{title:'SOCIAL COMMAND',kicker:'NETWORK // CHALLENGES',ids:['osSocialCommand']}
 };
 function restore(){if(!parked)return;parked.forEach(({el,parent,next})=>{if(next&&next.parentNode===parent)parent.insertBefore(el,next);else parent.appendChild(el)});parked=null}
 function setActive(name,on=true){document.querySelectorAll('[data-os-module],[data-holo]').forEach(x=>x.classList.toggle('os-active',on&&(x.dataset.osModule===name||x.dataset.holo===name)))}
 function close(){restore();setActive(current,false);current=null;stage.classList.remove('active','minimized');stage.setAttribute('aria-hidden','true');document.body.classList.remove('os-module-open')}
 function open(name){
  const m=map[name];if(!m)return;
  if(current===name&&stage.classList.contains('minimized')){stage.classList.remove('minimized');document.body.classList.add('os-module-open');return}
  restore();setActive(current,false);body.innerHTML='';parked=[];current=name;
  if(name==='social'){let social=document.getElementById('osSocialCommand');if(!social){social=document.createElement('section');social.id='osSocialCommand';document.body.appendChild(social)}renderSocialCommand()}
  m.ids.forEach(id=>{const el=document.getElementById(id);if(el){parked.push({el,parent:el.parentNode,next:el.nextSibling});body.appendChild(el)}});
  if(!parked.length)body.innerHTML='<div class="os-placeholder"><div><span class="os-status">MODULE ONLINE // LINK READY</span><strong>'+m.title+'</strong><p>This SYSTEM module is online and ready for its connected data.</p></div></div>';
  title.textContent=m.title;kicker.textContent=m.kicker;stage.classList.add('active');stage.classList.remove('minimized');stage.setAttribute('aria-hidden','false');document.body.classList.add('os-module-open');setActive(name,true);body.scrollTop=0;
  requestAnimationFrame(()=>{try{if(name==='boss'&&typeof renderBossCommand==='function')renderBossCommand();if(name==='side'&&typeof renderSideSystem==='function')renderSideSystem()}catch(err){console.error('SYSTEM module render failed',name,err);window.SystemOS?.notify?.('MODULE OPEN // DATA RENDER ERROR','SYSTEM // DIAGNOSTIC')}})
 }
 window.SystemOS={open,close};
 document.getElementById('osModuleClose').onclick=close;
 document.getElementById('osModuleMin').onclick=()=>{stage.classList.toggle('minimized');document.body.classList.toggle('os-module-open',!stage.classList.contains('minimized'))};
 document.querySelectorAll('[data-holo]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();const name=b.dataset.holo;if(name==='boss'||name==='side')open(name);else{const holo=document.getElementById('holoWindow');if(holo&&holo.getAttribute('aria-hidden')==='false')return;open(name)}},true));
 document.querySelectorAll('[data-hud-target]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open('missions')},true));
 document.querySelectorAll('[data-hud-view]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();open(b.dataset.hudView==='progress'?'progress':'missions')},true));
 const clock=()=>{const e=document.getElementById('osClock');if(e)e.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};clock();setInterval(clock,30000);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('active'))close()});
}
document.addEventListener('DOMContentLoaded',initSystemOS);


/* ===== V15 MISSION LAUNCH / DEBRIEF ===== */
function ensureMissionFx(){
 if(!document.getElementById('missionLaunchFlash')){const e=document.createElement('div');e.id='missionLaunchFlash';e.className='mission-launch-flash';e.innerHTML='<div><small>THE SYSTEM // MISSION CONTROL</small><strong>MISSION LAUNCH</strong><span>TRAINING LINK ESTABLISHED</span></div>';document.body.appendChild(e)}
 if(!document.getElementById('missionDebrief')){const e=document.createElement('div');e.id='missionDebrief';e.className='mission-debrief';e.innerHTML=`<div class="mission-debrief__card"><small>THE SYSTEM // AFTER ACTION REPORT</small><h1>MISSION COMPLETE</h1><div id="missionDebriefGrade" class="mission-debrief__grade">MISSION CLEARED</div><div class="mission-debrief__stats"><div><b id="missionDebriefXp">+0 XP</b><span>EXPERIENCE</span></div><div><b id="missionDebriefTime">00:00</b><span>TRAINING TIME</span></div><div><b id="missionDebriefPrCount">0</b><span>PERSONAL RECORDS</span></div><div><b id="missionDebriefStreak">0 DAYS</b><span>STREAK</span></div></div><div class="mission-debrief__growth"><small>ATTRIBUTE DEVELOPMENT</small><div id="missionDebriefGrowth"></div></div><p id="missionDebriefPr">ALL OBJECTIVES CLEARED</p><button type="button" id="missionDebriefClose">RETURN TO CENTRAL COMMAND</button></div>`;document.body.appendChild(e);document.getElementById('missionDebriefClose').onclick=()=>{e.classList.remove('active');setTimeout(showMomentumPrompt,250)}}
}
document.addEventListener('DOMContentLoaded',ensureMissionFx);
const _osStartWorkoutMode=startWorkoutMode;
startWorkoutMode=function(){ensureMissionFx();const f=document.getElementById('missionLaunchFlash');f.classList.remove('active');void f.offsetWidth;f.classList.add('active');setTimeout(()=>{_osStartWorkoutMode();f.classList.remove('active')},650)};
function calculateMissionPerformance(seconds,prs){
 const m=missionForMode(adaptiveSystemMission()),p=getMissionProgress(),sets=flatSets(m),completed=sets.filter(x=>p[x.ei+'-'+x.si]?.done).length;
 const completion=sets.length?completed/sets.length:1;
 let targetHits=0,targetCount=0;
 sets.forEach(x=>{const target=parseTargetReps(x.target),actual=Number(p[x.ei+'-'+x.si]?.reps)||0;if(target>0){targetCount++;if(actual>=target)targetHits++}});
 const targetRate=targetCount?targetHits/targetCount:completion;
 const prRate=Math.min(1,(prs?.length||0)/Math.max(1,m.exercises.length));
 const timeRate=Math.min(1,seconds/(30*60));
 const consistency=Math.min(1,(Number(state.currentStreak)||0)/7);
 const modeFactor=m.mode==='full'?1:m.mode==='intense'?.9:.78;
 // Completion matters most. Targets and consistency reward quality without encouraging unsafe speed.
 const raw=(completion*.45+targetRate*.25+prRate*.12+timeRate*.08+consistency*.10)*100*modeFactor;
 const score=Math.max(0,Math.min(100,Math.round(raw)));
 const grade=score>=90?'S-RANK PERFORMANCE':score>=80?'A-RANK PERFORMANCE':score>=68?'B-RANK PERFORMANCE':score>=55?'C-RANK PERFORMANCE':'D-RANK PERFORMANCE';
 return{score,grade,completion:Math.round(completion*100),targetRate:Math.round(targetRate*100),prRate:Math.round(prRate*100),consistency:Math.round(consistency*100),mode:m.mode||'full'};
}
function missionPerformanceGrade(seconds,prs){return calculateMissionPerformance(seconds,prs).grade}
function showBossCombatFx(hit){
 if(!hit||!hit.damage)return;
 let e=document.getElementById('bossCombatFx');
 if(!e){e=document.createElement('section');e.id='bossCombatFx';e.className='boss-combat-fx';e.innerHTML='<div class="bcf-scan"></div><div class="bcf-card"><small>THE SYSTEM // BOSS ENCOUNTER</small><div class="bcf-rank" id="bcfRank">E-RANK GATE</div><h2 id="bcfBoss">GATE BOSS</h2><div class="bcf-impact"><span id="bcfAttack">PLAYER ATTACK</span><b id="bcfDamage">-0</b></div><div class="bcf-hp-head"><span>BOSS HP</span><strong id="bcfHp">0 / 0</strong></div><div class="bcf-hp"><i id="bcfHpFill"></i></div><div id="bcfPhase" class="bcf-phase">PHASE I // ARMOR INTACT</div><div id="bcfResult" class="bcf-result"></div></div>';document.body.appendChild(e)}
 const hp=Math.max(0,Number(hit.hp)||0),max=Math.max(1,Number(hit.maxHp)||1),pct=Math.round(hp/max*100);
 document.getElementById('bcfRank').textContent=hit.encounterLabel?(hit.rank||'LEGACY')+' // '+hit.encounterLabel:(hit.rank||'E')+'-RANK GATE';
 document.getElementById('bcfBoss').textContent=hit.boss||'GATE BOSS';
 document.getElementById('bcfAttack').textContent=hit.attackLabel||(hit.critical?'CRITICAL HIT':'PLAYER ATTACK');
 document.getElementById('bcfDamage').textContent='-'+Number(hit.damage).toLocaleString();
 document.getElementById('bcfHp').textContent=hp.toLocaleString()+' / '+max.toLocaleString();
 const fill=document.getElementById('bcfHpFill');fill.style.width=Math.min(100,Math.round((hp+hit.damage)/max*100))+'%';
 document.getElementById('bcfPhase').textContent=hit.phaseLabel||(hit.defeated?'GATE CLEARED':pct>66?'PHASE I // ARMOR INTACT':pct>33?'PHASE II // DEFENSE BREAKING':'PHASE III // FINAL PHASE');
 document.getElementById('bcfResult').textContent=hit.resultLabel||(hit.defeated?'BOSS DEFEATED':'DAMAGE CONFIRMED');
 e.classList.remove('active','critical','defeated');if(hit.critical)e.classList.add('critical');if(hit.defeated)e.classList.add('defeated');void e.offsetWidth;e.classList.add('active');
 requestAnimationFrame(()=>requestAnimationFrame(()=>fill.style.width=pct+'%'));
 setTimeout(()=>e.classList.remove('active'),hit.defeated?3400:2400);
}
function showMissionDebrief(seconds,xp,prs){
 ensureMissionFx();prs=prs||[];
 const performance=calculateMissionPerformance(seconds,prs);
 document.getElementById('missionDebriefGrade').textContent=performance.grade+' // '+performance.score;
 window.SystemMissionPerformance=performance;const legacyTrialResult=typeof resolveActiveLegacyTrial==='function'?resolveActiveLegacyTrial(performance,seconds,prs):null;
 const bossHit=typeof applyMissionDamageToWeeklyGate==='function'?applyMissionDamageToWeeklyGate(performance,prs):null;
 const sessions=workoutHistory();if(sessions.length){sessions[sessions.length-1].performance={...performance};if(bossHit)sessions[sessions.length-1].bossDamage={...bossHit};if(legacyTrialResult)sessions[sessions.length-1].legacyTrial={chapter:legacyTrialResult.chapter,success:!!legacyTrialResult.success,damage:Number(legacyTrialResult.damage||legacyTrialResult.hit?.damage||0),score:Number(performance.score||0)};localStorage.setItem('systemWorkoutSessions',JSON.stringify(sessions.slice(-365)))}
 document.getElementById('missionDebriefTime').textContent=fmt(seconds);
 document.getElementById('missionDebriefXp').textContent='+'+xp+' XP';
 document.getElementById('missionDebriefPrCount').textContent=String(prs.length);
 document.getElementById('missionDebriefStreak').textContent=(state.currentStreak||0)+' DAYS';
 document.getElementById('missionDebriefPr').textContent=(bossHit?(bossHit.critical?'CRITICAL HIT // ':'BOSS HIT // ')+bossHit.damage.toLocaleString()+' DAMAGE • ':'')+(prs.length?'NEW PR // '+prs.join(' • '):'ALL OBJECTIVES CLEARED');
 const analysis=typeof getPerformanceAnalysis==='function'?getPerformanceAnalysis():null;
 const rows=analysis?.rows?.slice().sort((a,b)=>b.score-a.score).slice(0,2)||[];
 document.getElementById('missionDebriefGrowth').innerHTML=rows.length?rows.map(x=>'<span><b>'+performanceLabel(x.stat)+'</b><i>'+x.percent+'% DEVELOPMENT</i></span>').join(''):'<span><b>CALIBRATING</b><i>COMPLETE MORE MISSIONS</i></span>';
 document.getElementById('missionDebrief').classList.add('active');const trialHit=legacyTrialResult?.hit;if(trialHit?.damage){setTimeout(()=>showBossCombatFx(trialHit),260);if(bossHit?.damage)setTimeout(()=>showBossCombatFx(bossHit),legacyTrialResult.success?3900:2900)}else if(bossHit?.damage)setTimeout(()=>showBossCombatFx(bossHit),260);if(typeof applySquadGateDamage==='function')applySquadGateDamage(performance,prs);
}

/* ===== V16 CENTRAL COMMAND v2 CONTROLLER ===== */
document.addEventListener('DOMContentLoaded',()=>{
 const os=window.SystemOS;if(!os)return;
 const map={missions:'missions',exercise:'exercise',nutrition:'nutrition',telemetry:'telemetry',social:'social',progress:'progress',profile:'profile'};
 document.querySelectorAll('[data-os-module]').forEach(b=>b.onclick=e=>{e.preventDefault();os.open(map[b.dataset.osModule])});
 const stack=document.createElement('div');stack.className='os-toast-stack';document.body.appendChild(stack);
 window.SystemOS.notify=(message,label='SYSTEM // NOTIFICATION')=>{const n=document.createElement('div');n.className='os-toast';n.innerHTML='<small>'+label+'</small><strong>'+message+'</strong>';stack.appendChild(n);setTimeout(()=>n.remove(),3200)};
});


/* ===== V17 SOCIAL COMMAND DATA LAYER ===== */
const SOCIAL_KEY='theSystemSocialV1';
function getSocial(){try{return Object.assign({friends:[],challenges:[]},JSON.parse(localStorage.getItem(SOCIAL_KEY)||'{}'))}catch(e){return {friends:[],challenges:[]}}}
function saveSocial(x){localStorage.setItem(SOCIAL_KEY,JSON.stringify(x))}
function socialScore(){return Number(state?.totalXp||0)}
function buildSocialIdentity(){
 const me=getSystemSettings(),rank=getRank(state.level),title=typeof getEquippedCombatTitle==='function'?getEquippedCombatTitle():null;
 let side={};try{side=typeof loadSideSystem==='function'?loadSideSystem():{}}catch(e){}
 const victories=side.gateVictories||[],sessions=workoutHistory(),order=['E','D','C','B','A','S','S+','Shadow'],highest=victories.reduce((n,x)=>Math.max(n,order.indexOf(x.rank)),-1);
 return{name:me.name||'Player',xp:socialScore(),level:state.level,rank:rank.name,title:title?.name||'',streak:Number(state.currentStreak)||0,missions:Number(state.totalQuestsCompleted)||0,gates:victories.length,criticalHits:sessions.filter(x=>x?.bossDamage?.critical).length,bestScore:sessions.reduce((n,x)=>Math.max(n,Number(x?.performance?.score)||0),0),highestBoss:highest>=0?order[highest]:null,updatedAt:new Date().toISOString()}
}
function syncLocalSocialIdentity(){
 const s=getSocial(),identity=buildSocialIdentity();s.identity=identity;saveSocial(s);return identity
}
async function pushSocialIdentity(){
 const session=getCloudSession();if(!session?.user?.id)return false;const identity=syncLocalSocialIdentity();
 try{await cloudRequest('/rest/v1/player_profiles?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.user.id,profile:identity,updated_at:identity.updatedAt})});return true}catch(e){console.warn('Social identity sync unavailable',e);return false}
}

function renderSocialCommand(){
 const root=document.getElementById('osSocialCommand');if(!root)return;const s=getSocial(),me=syncLocalSocialIdentity(),rank=getRank(state.level);
 const players=[{...me,self:true},...s.friends].sort((a,b)=>(b.xp||0)-(a.xp||0));
 root.innerHTML='<div class="social-command"><section class="social-card"><div class="social-head"><span>FRIENDS // LEADERBOARD</span><b>'+players.length+' PLAYERS</b></div><div>'+players.map((p,i)=>'<div class="leader-row"><div class="leader-rank">#'+(i+1)+'</div><div class="leader-name"><strong>'+escapeHtml(p.name)+(p.self?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+(p.title?' • '+escapeHtml(p.title):'')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('')+'</div></section><section class="social-card"><div class="social-head"><span>HEAD-TO-HEAD // CHALLENGE</span><b>DUEL LINK</b></div><form id="challengeForm" class="challenge-form"><input id="challengePlayer" placeholder="Player name" required><select id="challengeType"><option value="xp">XP Sprint</option><option value="workouts">Mission Count</option><option value="streak">Streak Battle</option></select><select id="challengeLength"><option value="1">24 Hours</option><option value="3">3 Days</option><option value="7">7 Days</option></select><button type="submit">ISSUE CHALLENGE</button></form></section><section class="social-card social-card--wide"><div class="social-head"><span>ACTIVE // CHALLENGES</span><b>'+s.challenges.length+' ACTIVE</b></div><div class="challenge-list">'+(s.challenges.length?s.challenges.map(x=>'<div class="challenge-item"><strong>'+escapeHtml(x.opponent)+' // '+escapeHtml(x.type.toUpperCase())+'</strong><small>'+x.days+' DAY CHALLENGE • CREATED '+new Date(x.created).toLocaleDateString()+' • LOCAL DRAFT</small></div>').join(''):'<div class="social-empty">NO ACTIVE CHALLENGES // ISSUE A DUEL TO BEGIN</div>')+'</div></section></div>';
 document.getElementById('challengeForm').onsubmit=e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;const x=getSocial();x.challenges.unshift({id:Date.now(),opponent:name,type:document.getElementById('challengeType').value,days:Number(document.getElementById('challengeLength').value),created:new Date().toISOString(),status:'draft'});saveSocial(x);renderSocialCommand();window.SystemOS?.notify('CHALLENGE CREATED // '+name.toUpperCase(),'SOCIAL // HEAD-TO-HEAD')};
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}


/* ===== V19 SYSTEM OS WINDOW SWITCHER + TASKBAR ===== */
document.addEventListener('DOMContentLoaded',()=>{
 const os=window.SystemOS,deck=document.getElementById('commandDeck');if(!os||!deck)return;
 const dock=deck.querySelector('.os-dock');if(!dock)return;
 const task=document.createElement('div');task.className='os-taskbar';task.innerHTML='<span class="os-taskbar__label">ACTIVE MODULE</span><button id="osTaskCurrent" type="button"><b>◇</b><span>CENTRAL COMMAND</span></button><span class="os-taskbar__hint">ALT + 1–7 // QUICK SWITCH</span>';deck.appendChild(task);
 const current=document.getElementById('osTaskCurrent');
 const names={missions:'MISSION CONTROL',exercise:'EXERCISE DATABASE',nutrition:'NUTRITION',telemetry:'HEALTH TELEMETRY',social:'SOCIAL COMMAND',progress:'CAMPAIGN PROGRESS',profile:'SYSTEM CONFIG',player:'PLAYER STATUS',side:'SIDE MISSIONS',boss:'BOSS STAGE',achievements:'ACHIEVEMENTS'};
 const icons={missions:'◆',exercise:'⌁',nutrition:'◫',telemetry:'⌾',social:'◎',progress:'▥',profile:'⚙',player:'◈',side:'✦',boss:'⚠',achievements:'★'};
 const baseOpen=os.open,baseClose=os.close;let active=null;
 os.open=name=>{active=name;baseOpen(name);current.innerHTML='<b>'+(icons[name]||'◇')+'</b><span>'+(names[name]||'SYSTEM MODULE')+'</span>';task.classList.add('has-task')};
 os.close=()=>{baseClose();active=null;current.innerHTML='<b>◇</b><span>CENTRAL COMMAND</span>';task.classList.remove('has-task')};
 document.querySelectorAll('[data-os-module]').forEach(b=>b.onclick=e=>{e.preventDefault();os.open(b.dataset.osModule)});
 current.onclick=()=>{if(active)os.open(active)};
 const quick=['missions','exercise','nutrition','telemetry','social','progress','profile'];
 document.addEventListener('keydown',e=>{if(e.altKey&&/^[1-7]$/.test(e.key)){e.preventDefault();os.open(quick[Number(e.key)-1])}});
});


/* ===== V22 MISSION CONTROL // TACTICAL LAUNCH ===== */
function initMissionControlV22(){
 const start=document.getElementById('start-mission-btn'),live=document.getElementById('workoutMode');if(!start||!live)return;
 let confirm=document.getElementById('missionLaunchConfirm');
 if(!confirm){confirm=document.createElement('section');confirm.id='missionLaunchConfirm';confirm.className='mission-launch-confirm';confirm.setAttribute('aria-hidden','true');confirm.innerHTML='<div class="mlc-card"><header><div><small>SYSTEM // MISSION CONTROL</small><h2>MISSION BRIEFING</h2></div><button id="mlcClose" type="button">×</button></header><div class="mlc-grid"><article><span>PRIMARY OBJECTIVE</span><strong id="mlcName">TRAINING MISSION</strong><small id="mlcFocus">SYSTEM ASSIGNED</small></article><article><span>LOADOUT</span><strong id="mlcLoadout">FULL PROTOCOL</strong><small id="mlcSets">0 SETS</small></article><article><span>REWARD</span><strong id="mlcXp">+0 XP</strong><small>MISSION COMPLETION</small></article><article><span>STATUS</span><strong class="mlc-ready">READY</strong><small>TRAINING LINK AVAILABLE</small></article></div><div class="mlc-objectives" id="mlcObjectives"></div><button id="mlcLaunch" class="mlc-launch" type="button">LAUNCH MISSION</button></div>';document.body.appendChild(confirm)}
 const original=start.onclick;
 function openBrief(){const m=missionForMode(adaptiveSystemMission()),sets=flatSets(m);document.getElementById('mlcName').textContent=m.name;document.getElementById('mlcFocus').textContent=(m.focus||'TRAINING').toUpperCase();document.getElementById('mlcLoadout').textContent=(m.mode||'full').toUpperCase()+' PROTOCOL';document.getElementById('mlcSets').textContent=sets.length+' SETS // '+m.exercises.length+' EXERCISES';document.getElementById('mlcXp').textContent='+'+m.xp+' XP';document.getElementById('mlcObjectives').innerHTML=m.exercises.map((e,i)=>'<div><b>0'+(i+1)+'</b><span><strong>'+escapeHtml(e[0])+'</strong><small>'+e[1]+' SETS // '+escapeHtml(String(e[2]))+'</small></span></div>').join('');confirm.classList.add('active');confirm.setAttribute('aria-hidden','false');document.body.classList.add('mission-brief-open')}
 start.onclick=openBrief;
 document.getElementById('mlcClose').onclick=()=>{confirm.classList.remove('active');confirm.setAttribute('aria-hidden','true');document.body.classList.remove('mission-brief-open')};
 document.getElementById('mlcLaunch').onclick=()=>{confirm.classList.add('launching');setTimeout(()=>{confirm.classList.remove('active','launching');confirm.setAttribute('aria-hidden','true');document.body.classList.remove('mission-brief-open');(original||startWorkoutMode)()},280)};
 if(!live.querySelector('.combat-hud'))live.insertAdjacentHTML('afterbegin','<div class="combat-hud"><span><i></i> MISSION ACTIVE</span><b id="combatProtocol">TRAINING PROTOCOL</b><span>LINK // STABLE</span></div>');
 const oldRender=renderLiveSet;renderLiveSet=function(){oldRender();const m=missionForMode(adaptiveSystemMission()),sets=flatSets(m),p=getMissionProgress(),done=Object.values(p).filter(v=>v.done).length,left=Math.max(0,sets.length-done),proto=document.getElementById('combatProtocol');if(proto)proto.textContent=left+' OBJECTIVE'+(left===1?'':'S')+' REMAINING'};
}
document.addEventListener('DOMContentLoaded',initMissionControlV22);


/* ===== V23 PROGRESSION EVENT SYSTEM ===== */
function ensureProgressionFx(){
 if(document.getElementById('progressionEvent'))return;
 const e=document.createElement('section');e.id='progressionEvent';e.className='progression-event';e.setAttribute('aria-hidden','true');e.innerHTML='<div class="progression-rings"></div><div class="progression-card"><small id="progressionKicker">SYSTEM // PROGRESSION</small><div id="progressionGlyph" class="progression-glyph">↑</div><h1 id="progressionTitle">LEVEL UP</h1><strong id="progressionValue">LEVEL 2</strong><p id="progressionCopy">SYSTEM CAPABILITY INCREASED</p><button id="progressionClose" type="button">CONTINUE</button></div>';document.body.appendChild(e);document.getElementById('progressionClose').onclick=()=>{e.classList.remove('active');e.setAttribute('aria-hidden','true')}
}
function showProgressionEvent(type,title,value,copy){
 ensureProgressionFx();const e=document.getElementById('progressionEvent'),glyph={level:'↑',rank:'◆',achievement:'★',boss:'⚠',xp:'+'}[type]||'◇';e.dataset.type=type;document.getElementById('progressionKicker').textContent=type==='boss'?'SYSTEM // CRITICAL EVENT':'SYSTEM // PROGRESSION';document.getElementById('progressionGlyph').textContent=glyph;document.getElementById('progressionTitle').textContent=title;document.getElementById('progressionValue').textContent=value;document.getElementById('progressionCopy').textContent=copy;e.classList.remove('active');void e.offsetWidth;e.classList.add('active');e.setAttribute('aria-hidden','false');document.getElementById('commandDeck')?.classList.add('progression-pulse');setTimeout(()=>document.getElementById('commandDeck')?.classList.remove('progression-pulse'),900)
}
document.addEventListener('DOMContentLoaded',ensureProgressionFx);
const _v23LevelUp=showLevelUpModal;
showLevelUpModal=function(newLevel,rank){const oldRank=getRank(Math.max(1,newLevel-1));const promoted=oldRank.name!==rank.name;showProgressionEvent(promoted?'rank':'level',promoted?'RANK PROMOTION':'LEVEL UP',promoted?rank.name.toUpperCase():'LEVEL '+newLevel,promoted?rank.title.toUpperCase():'SYSTEM CAPABILITY INCREASED // '+rank.title.toUpperCase())};
const _v23CheckAchievements=checkAchievements;
checkAchievements=function(){const before=new Set(state.achievements.filter(a=>a.unlocked).map(a=>a.id));_v23CheckAchievements();const fresh=state.achievements.find(a=>a.unlocked&&!before.has(a.id));if(fresh){const def=ACHIEVEMENTS.find(a=>a.id===fresh.id);if(def)showProgressionEvent('achievement','ACHIEVEMENT UNLOCKED',def.title.toUpperCase(),def.desc.toUpperCase())}};
window.SystemProgression={show:showProgressionEvent,bossUnlocked:(name='BOSS STAGE')=>showProgressionEvent('boss','BOSS STAGE UNLOCKED',name.toUpperCase(),'HIGH-VALUE CHALLENGE AVAILABLE // PREPARE FOR DEPLOYMENT')};


/* ===== V25 SOCIAL COMMAND // COMPETITIVE NETWORK ===== */
function challengeMetric(type){if(type==='workouts')return Number(state?.totalQuestsCompleted||0);if(type==='streak')return Number(state?.currentStreak||0);return socialScore()}
function challengeLabel(type){return type==='workouts'?'MISSIONS':type==='streak'?'DAY STREAK':'XP'}
function renderSocialCommandV25(){
 const root=document.getElementById('osSocialCommand');if(!root)return;const s=getSocial(),me=syncLocalSocialIdentity(),rank=getRank(state.level),combatTitle=typeof getEquippedCombatTitle==='function'?getEquippedCombatTitle():null,players=[{...me,self:true},...s.friends].sort((a,b)=>(b.xp||0)-(a.xp||0)),myPos=Math.max(1,players.findIndex(p=>p.self)+1);
 root.innerHTML='<div class="social-command social-v25"><section class="social-network-head"><div><small>NETWORK // COMPETITIVE LINK</small><h2>SOCIAL COMMAND</h2><p>FRIEND RANKINGS // HEAD-TO-HEAD OPERATIONS</p></div><div class="social-network-stat"><b>#'+myPos+'</b><span>YOUR POSITION</span></div><div class="social-network-stat"><b>'+players.length+'</b><span>LINKED PLAYERS</span></div><div class="social-network-stat"><b>'+s.challenges.length+'</b><span>ACTIVE DUELS</span></div></section><div class="social-v25-grid"><section class="social-card social-rank-card"><div class="social-head"><span>FRIENDS // LEADERBOARD</span><b>XP RANKING</b></div><div class="leader-podium">'+players.slice(0,3).map((p,i)=>'<div class="podium p'+(i+1)+(p.self?' self':'')+'"><i>#'+(i+1)+'</i><strong>'+escapeHtml(p.name)+'</strong><small>LV '+(p.level||1)+(p.title?' • '+escapeHtml(p.title):'')+'</small><b>'+Number(p.xp||0).toLocaleString()+' XP</b></div>').join('')+'</div><div class="leader-table">'+players.slice(3).map((p,i)=>'<div class="leader-row '+(p.self?'self':'')+'"><div class="leader-rank">#'+(i+4)+'</div><div class="leader-name"><strong>'+escapeHtml(p.name)+(p.self?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+(p.title?' • '+escapeHtml(p.title):'')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('')+'</div></section><section class="social-card duel-console"><div class="social-head"><span>HEAD-TO-HEAD // CHALLENGE</span><b>DUEL CONSOLE</b></div><form id="challengeForm" class="challenge-form"><label>OPPONENT<input id="challengePlayer" placeholder="Player name" required></label><label>PROTOCOL<select id="challengeType"><option value="xp">XP Sprint</option><option value="workouts">Mission Count</option><option value="streak">Streak Battle</option></select></label><label>DURATION<select id="challengeLength"><option value="1">24 Hours</option><option value="3">3 Days</option><option value="7">7 Days</option></select></label><button type="submit">ISSUE CHALLENGE</button></form><div class="duel-note">LOCAL SIMULATION // NETWORK BACKEND PENDING</div></section></div><section class="social-card social-card--wide"><div class="social-head"><span>ACTIVE // CHALLENGES</span><b>'+s.challenges.length+' OPERATIONS</b></div><div class="challenge-list">'+(s.challenges.length?s.challenges.map(x=>{const mine=challengeMetric(x.type),target=Number(x.opponentScore||0),total=Math.max(1,mine+target),pct=Math.round(mine/total*100);return '<article class="challenge-item duel-item"><div class="duel-versus"><span>YOU</span><b>VS</b><span>'+escapeHtml(x.opponent)+'</span></div><div class="duel-meta"><strong>'+escapeHtml(x.type.toUpperCase())+' // '+x.days+' DAY OPERATION</strong><small>'+challengeLabel(x.type)+' • LOCAL DRAFT • '+new Date(x.created).toLocaleDateString()+'</small></div><div class="duel-score"><b>'+mine.toLocaleString()+'</b><div><i style="width:'+pct+'%"></i></div><b>'+target.toLocaleString()+'</b></div></article>'}).join(''):'<div class="social-empty">NO ACTIVE DUELS // ISSUE A CHALLENGE TO OPEN A COMPETITIVE LINK</div>')+'</div></section></div>';
 document.getElementById('challengeForm').onsubmit=e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;const x=getSocial(),type=document.getElementById('challengeType').value;x.challenges.unshift({id:Date.now(),opponent:name,type,days:Number(document.getElementById('challengeLength').value),created:new Date().toISOString(),status:'draft',startScore:challengeMetric(type),opponentScore:0});saveSocial(x);renderSocialCommandV25();window.SystemOS?.notify('DUEL LINK CREATED // '+name.toUpperCase(),'SOCIAL // HEAD-TO-HEAD')};
}
const _v25Social=renderSocialCommand;renderSocialCommand=renderSocialCommandV25;


/* ===== V26 SOCIAL CLOUD NETWORK ===== */
const SOCIAL_CLOUD_TABLE='social_profiles',SOCIAL_CHALLENGE_TABLE='social_challenges';
function socialCloudUser(){return getCloudSession()?.user||null}
function socialHandle(){const u=socialCloudUser(),me=getSystemSettings();return (me.name||u?.email?.split('@')[0]||'Player').trim()}
let socialProfileSyncBusy=false,socialIdentityRefreshBusy=false;
async function syncSocialProfile(options={}){
 const u=socialCloudUser();if(!u?.id||socialProfileSyncBusy)return false;const identity=buildSocialIdentity();socialProfileSyncBusy=true;
 try{await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:u.id,display_name:identity.name,xp:identity.xp,level:identity.level,rank:identity.rank,missions:identity.missions,streak:identity.streak,title:identity.title||null,gates:identity.gates||0,critical_hits:identity.criticalHits||0,best_score:identity.bestScore||0,highest_boss:identity.highestBoss||null,updated_at:identity.updatedAt})});if(options.refreshUnlocks!==false&&!socialIdentityRefreshBusy)setTimeout(()=>refreshIdentityUnlocks(),0);return true}finally{socialProfileSyncBusy=false}
}
async function fetchSocialNetwork(options={}){
 const u=socialCloudUser();if(!u?.id)return null;
 try{if(options.sync!==false)await syncSocialProfile({refreshUnlocks:false});const [profiles,challenges]=await Promise.all([cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?select=user_id,display_name,xp,level,rank,missions,streak,title,gates,critical_hits,best_score,highest_boss,updated_at&order=xp.desc&limit=100'),cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?or=(challenger_id.eq.'+encodeURIComponent(u.id)+',opponent_id.eq.'+encodeURIComponent(u.id)+')&select=*&order=created_at.desc&limit=50')]);return{profiles,challenges}}catch(e){window.SystemOS?.notify('NETWORK LINK UNAVAILABLE // USING LOCAL DATA','SOCIAL // CLOUD');return null}
}
async function renderSocialCloud(){
 const root=document.getElementById('osSocialCommand');if(!root)return;renderSocialCommandV25();const u=socialCloudUser();
 const head=root.querySelector('.social-network-head');if(head)head.insertAdjacentHTML('beforeend','<div class="social-cloud-state '+(u?'online':'offline')+'"><i></i><span>'+(u?'CLOUD LINK':'LOCAL MODE')+'</span></div>');
 if(!u){root.querySelector('.duel-note').textContent='SIGN IN REQUIRED FOR LIVE NETWORK // LOCAL SIMULATION ACTIVE';return}
 const net=await fetchSocialNetwork();if(!net||!document.body.contains(root))return;installPlayerSearch(root);
 const profiles=net.profiles||[],mine=profiles.findIndex(p=>p.user_id===u.id),rankCard=root.querySelector('.social-rank-card');
 if(rankCard){const podium=profiles.slice(0,3).map((p,i)=>'<div class="podium p'+(i+1)+(p.user_id===u.id?' self':'')+'"><i>#'+(i+1)+'</i><strong>'+escapeHtml(p.display_name)+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+(p.title?' • '+escapeHtml(p.title):'')+'</small><b>'+Number(p.xp||0).toLocaleString()+' XP</b></div>').join(''),rows=profiles.slice(3).map((p,i)=>'<div class="leader-row '+(p.user_id===u.id?'self':'')+'"><div class="leader-rank">#'+(i+4)+'</div><div class="leader-name"><strong>'+escapeHtml(p.display_name)+(p.user_id===u.id?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+(p.title?' • '+escapeHtml(p.title):'')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('');rankCard.querySelector('.leader-podium').innerHTML=podium;rankCard.querySelector('.leader-table').innerHTML=rows}
 const stats=root.querySelectorAll('.social-network-stat b');if(stats[0])stats[0].textContent='#'+(mine>=0?mine+1:'--');if(stats[1])stats[1].textContent=profiles.length;if(stats[2])stats[2].textContent=net.challenges.length;
 const note=root.querySelector('.duel-note');if(note)note.textContent='CLOUD NETWORK ONLINE // LIVE ACCOUNT LINK';
 const form=document.getElementById('challengeForm');if(form)form.onsubmit=async e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;try{const matches=await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?display_name=ilike.'+encodeURIComponent(name)+'&select=user_id,display_name&limit=1');if(!matches.length)throw new Error('Player not found on the network.');if(matches[0].user_id===u.id)throw new Error('You cannot challenge yourself. Humanity has invented mirrors for that.');const type=document.getElementById('challengeType').value,days=Number(document.getElementById('challengeLength').value);await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({challenger_id:u.id,opponent_id:matches[0].user_id,challenger_name:socialHandle(),opponent_name:matches[0].display_name,type,duration_days:days,status:'pending',challenger_start:challengeMetric(type),opponent_start:0,created_at:new Date().toISOString()})});window.SystemOS?.notify('CHALLENGE TRANSMITTED // '+matches[0].display_name.toUpperCase(),'SOCIAL // NETWORK');renderSocialCloud()}catch(err){window.SystemOS?.notify(err.message.toUpperCase(),'SOCIAL // NETWORK ERROR')}};
}
async function searchSocialPlayers(query){
 const u=socialCloudUser();if(!u?.id||!query?.trim())return[];const q=query.trim();return cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?display_name=ilike.*'+encodeURIComponent(q)+'*&select=user_id,display_name,level,rank,title,xp,gates,best_score,highest_boss&order=xp.desc&limit=12')
}
function installPlayerSearch(root){
 if(!socialCloudUser()?.id||root.querySelector('.social-player-search'))return;const grid=root.querySelector('.social-v25-grid');if(!grid)return;
 const box=document.createElement('section');box.className='social-card social-player-search';box.innerHTML='<div class="social-head"><span>NETWORK // PLAYER SEARCH</span><b>FIND HUNTERS</b></div><form id="playerSearchForm" class="challenge-form"><label>PLAYER NAME<input id="playerSearchInput" placeholder="Search network" autocomplete="off"></label><button type="submit">SEARCH</button></form><div id="playerSearchResults" class="player-search-results"><div class="social-empty">ENTER A PLAYER NAME // NETWORK SEARCH READY</div></div>';grid.appendChild(box);
 box.querySelector('form').onsubmit=async e=>{e.preventDefault();const out=box.querySelector('#playerSearchResults');out.innerHTML='<div class="social-empty">SCANNING NETWORK...</div>';try{const rows=await searchSocialPlayers(box.querySelector('input').value),me=socialCloudUser().id;out.innerHTML=rows.filter(p=>p.user_id!==me).map(p=>'<article class="player-search-row" data-dossier-player="'+p.user_id+'"><div><strong>'+escapeHtml(p.display_name)+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+(p.title?' • '+escapeHtml(p.title):'')+'</small></div><div><b>'+Number(p.xp||0).toLocaleString()+' XP</b><small>'+Number(p.gates||0)+' GATES • BEST '+Number(p.best_score||0)+'</small></div><button type="button" data-challenge-player="'+escapeHtml(p.display_name)+'">CHALLENGE</button></article>').join('')||'<div class="social-empty">NO PLAYERS FOUND</div>';out.querySelectorAll('[data-dossier-player]').forEach(r=>r.onclick=e=>{if(!e.target.closest('[data-challenge-player]'))openPlayerDossier(r.dataset.dossierPlayer)});out.querySelectorAll('[data-challenge-player]').forEach(b=>b.onclick=()=>{const input=document.getElementById('challengePlayer');if(input){input.value=b.dataset.challengePlayer;input.focus()}})}catch(err){out.innerHTML='<div class="social-empty">NETWORK SEARCH UNAVAILABLE</div>'}};
}
renderSocialCommand=renderSocialCloud;
const _v26Push=pushCloudBackup;pushCloudBackup=async function(){const r=await _v26Push();try{await syncSocialProfile()}catch(e){}return r};


/* ===== V27 SOCIAL COMMAND // LIVE DUELS ===== */
function duelProfileMetric(p,type){return Number(type==='workouts'?p?.missions:type==='streak'?p?.streak:p?.xp)||0}
function duelEndsAt(x){const start=new Date(x.accepted_at||x.created_at).getTime();return start+(Number(x.duration_days)||1)*86400000}
function duelState(x){if(x.status!=='active')return x.status;return Date.now()>=duelEndsAt(x)?'completed':'active'}
function duelDelta(current,start){return Math.max(0,Number(current||0)-Number(start||0))}
async function patchChallenge(id,body){await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
async function respondToChallenge(id,accept){
 const u=socialCloudUser();if(!u?.id)return;
 const rows=await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id)+'&select=*');const x=rows[0];if(!x||x.opponent_id!==u.id||x.status!=='pending')return;
 if(!accept){await patchChallenge(id,{status:'declined'});window.SystemOS?.notify('CHALLENGE DECLINED','SOCIAL // DUEL');return renderSocialCloud()}
 await syncSocialProfile();const p=(await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?user_id=eq.'+encodeURIComponent(u.id)+'&select=xp,missions,streak&limit=1'))[0]||{};
 await patchChallenge(id,{status:'active',opponent_start:duelProfileMetric(p,x.type),accepted_at:new Date().toISOString()});window.SystemOS?.notify('DUEL ACCEPTED // OPERATION ACTIVE','SOCIAL // DUEL');renderSocialCloud()
}
async function cancelChallenge(id){const u=socialCloudUser();if(!u?.id)return;const rows=await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id)+'&select=challenger_id,status');const x=rows[0];if(x?.challenger_id===u.id&&x.status==='pending'){await patchChallenge(id,{status:'cancelled'});renderSocialCloud()}}
function liveDuelCard(x,profiles,u){
 const mine=x.challenger_id===u.id,otherId=mine?x.opponent_id:x.challenger_id,otherName=mine?x.opponent_name:x.challenger_name,me=profiles.find(p=>p.user_id===u.id)||{},other=profiles.find(p=>p.user_id===otherId)||{},stateNow=duelState(x),myStart=mine?x.challenger_start:x.opponent_start,theirStart=mine?x.opponent_start:x.challenger_start,myScore=duelDelta(duelProfileMetric(me,x.type),myStart),theirScore=duelDelta(duelProfileMetric(other,x.type),theirStart),total=Math.max(1,myScore+theirScore),pct=Math.round(myScore/total*100),end=duelEndsAt(x),remaining=Math.max(0,end-Date.now()),hours=Math.ceil(remaining/36e5);
 if(x.status==='pending'){const incoming=x.opponent_id===u.id;return '<article class="challenge-item network-request '+(incoming?'incoming':'outgoing')+'"><div class="duel-versus"><span>'+escapeHtml(x.challenger_name)+'</span><b>VS</b><span>'+escapeHtml(x.opponent_name)+'</span></div><div class="duel-meta"><strong>'+challengeLabel(x.type)+' // '+x.duration_days+' DAY CHALLENGE</strong><small>'+(incoming?'INCOMING CHALLENGE':'AWAITING RESPONSE')+'</small></div><div class="duel-actions">'+(incoming?'<button data-duel-accept="'+x.id+'">ACCEPT</button><button data-duel-decline="'+x.id+'">DECLINE</button>':'<button data-duel-cancel="'+x.id+'">CANCEL</button>')+'</div></article>'}
 if(!['active','completed'].includes(stateNow))return '';
 const finished=stateNow==='completed',result=myScore===theirScore?'DRAW':myScore>theirScore?'VICTORY':'DEFEAT';
 return '<article class="challenge-item duel-item live-duel '+(finished?'duel-finished':'')+'"><div class="duel-versus"><span>YOU</span><b>VS</b><span>'+escapeHtml(otherName)+'</span></div><div class="duel-meta"><strong>'+challengeLabel(x.type)+' // '+(finished?result:'LIVE OPERATION')+'</strong><small>'+(finished?'FINAL SCORE':hours+'H REMAINING • '+x.duration_days+' DAY DUEL')+'</small></div><div class="duel-score"><b>'+myScore.toLocaleString()+'</b><div><i style="width:'+pct+'%"></i></div><b>'+theirScore.toLocaleString()+'</b></div></article>'
}
async function renderSocialCloudV27(){
 const root=document.getElementById('osSocialCommand');if(!root)return;await renderSocialCloud();const u=socialCloudUser();if(!u||!document.body.contains(root))return;
 const net=await fetchSocialNetwork();if(!net)return;const profiles=net.profiles||[],challenges=net.challenges||[];
 const consoleCard=root.querySelector('.duel-console');if(consoleCard){const form=consoleCard.querySelector('#challengeForm');form?.insertAdjacentHTML('beforebegin','<div class="player-search"><label>PLAYER DISCOVERY<input id="networkPlayerSearch" placeholder="Search network callsign"></label><div id="playerSearchResults"></div></div>');const search=document.getElementById('networkPlayerSearch'),results=document.getElementById('playerSearchResults');let t;search.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{const q=search.value.trim().toLowerCase();results.innerHTML=q.length<2?'':profiles.filter(p=>p.user_id!==u.id&&p.display_name.toLowerCase().includes(q)).slice(0,6).map(p=>'<button type="button" data-player-pick="'+escapeHtml(p.display_name)+'"><span>'+escapeHtml(p.display_name)+'</span><small>LV '+p.level+' • '+escapeHtml(p.rank)+' • '+Number(p.xp).toLocaleString()+' XP</small></button>').join('')||'<small class="no-player">NO MATCHING PLAYER</small>';results.querySelectorAll('[data-player-pick]').forEach(b=>b.onclick=()=>{document.getElementById('challengePlayer').value=b.dataset.playerPick;search.value=b.dataset.playerPick;results.innerHTML=''})},220)}}
 const list=root.querySelector('.challenge-list'),head=root.querySelector('.social-card--wide .social-head b');if(list){const cards=challenges.map(x=>liveDuelCard(x,profiles,u)).filter(Boolean);list.innerHTML=cards.join('')||'<div class="social-empty">NO ACTIVE NETWORK OPERATIONS</div>';if(head)head.textContent=cards.length+' OPERATIONS';list.querySelectorAll('[data-duel-accept]').forEach(b=>b.onclick=()=>respondToChallenge(b.dataset.duelAccept,true));list.querySelectorAll('[data-duel-decline]').forEach(b=>b.onclick=()=>respondToChallenge(b.dataset.duelDecline,false));list.querySelectorAll('[data-duel-cancel]').forEach(b=>b.onclick=()=>cancelChallenge(b.dataset.duelCancel))}
}
renderSocialCommand=renderSocialCloudV27;


/* ===== V28 SOCIAL COMMAND // FRIENDS + SQUADS ===== */
const SOCIAL_FRIEND_TABLE='social_friendships',SOCIAL_SQUAD_TABLE='social_squads',SOCIAL_MEMBER_TABLE='social_squad_members';
async function fetchCommunityNetwork(){
 const u=socialCloudUser();if(!u?.id)return null;try{const [friends,squads,members]=await Promise.all([
 cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE+'?or=(requester_id.eq.'+encodeURIComponent(u.id)+',addressee_id.eq.'+encodeURIComponent(u.id)+')&select=*&order=created_at.desc'),
 cloudRequest('/rest/v1/'+SOCIAL_SQUAD_TABLE+'?select=*&order=created_at.desc&limit=100'),
 cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE+'?select=squad_id,user_id,display_name,role,joined_at')
 ]);return{friends,squads,members}}catch(e){return null}
}
function friendshipPeerId(f,userId){return f.requester_id===userId?f.addressee_id:f.requester_id}
function friendshipStatusFor(userId,friendships,peerId){
 const f=friendships.find(x=>friendshipPeerId(x,userId)===peerId&&['pending','accepted'].includes(x.status));if(!f)return null;
 return{...f,incoming:f.status==='pending'&&f.addressee_id===userId,outgoing:f.status==='pending'&&f.requester_id===userId}
}
async function removeFriend(id){const u=socialCloudUser();if(!u?.id)return;await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE+'?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});window.SystemOS?.notify('FRIEND LINK REMOVED','SOCIAL // FRIENDS');renderSocialCommand()}
async function sendFriendRequest(userId,name){const u=socialCloudUser();if(!u?.id||userId===u.id)return;try{await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({requester_id:u.id,addressee_id:userId,requester_name:socialHandle(),addressee_name:name,status:'pending'})});window.SystemOS?.notify('FRIEND REQUEST SENT // '+name.toUpperCase(),'SOCIAL // FRIEND LINK');renderSocialCommand()}catch(e){window.SystemOS?.notify((e.message||'FRIEND LINK FAILED').toUpperCase(),'SOCIAL // NETWORK')}}
async function respondFriend(id,status){await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,accepted_at:status==='accepted'?new Date().toISOString():null})});renderSocialCommand()}
function squadMemberProfiles(squadId,members,profiles){const rows=members.filter(m=>m.squad_id===squadId);return rows.map(m=>({member:m,profile:profiles.find(p=>p.user_id===m.user_id)||{user_id:m.user_id,display_name:m.display_name,level:1,rank:'E-Rank',xp:0}})).sort((a,b)=>Number(b.profile.xp||0)-Number(a.profile.xp||0))}
async function createSquad(name){const u=socialCloudUser();if(!u?.id)return;const rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_TABLE,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,owner_id:u.id})});const sq=rows[0];if(sq)await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({squad_id:sq.id,user_id:u.id,display_name:socialHandle(),role:'owner'})});window.SystemOS?.notify('SQUAD CREATED // '+name.toUpperCase(),'SOCIAL // SQUAD');renderSocialCommand()}
async function joinSquad(id){const u=socialCloudUser();if(!u?.id)return;try{await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({squad_id:id,user_id:u.id,display_name:socialHandle(),role:'member'})});window.SystemOS?.notify('SQUAD LINK ESTABLISHED','SOCIAL // SQUAD');renderSocialCommand()}catch(e){window.SystemOS?.notify((e.message||'SQUAD LINK FAILED').toUpperCase(),'SOCIAL // SQUAD')}}
async function leaveSquad(id){const u=socialCloudUser();if(!u?.id)return;await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE+'?squad_id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(u.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});renderSocialCommand()}
async function renderCommunityV28(){
 const root=document.getElementById('osSocialCommand');if(!root)return;await renderSocialCloudV27();const u=socialCloudUser();if(!u||!document.body.contains(root))return;
 const [net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);if(!net||!community)return;const profiles=net.profiles||[],friends=community.friends||[],squads=community.squads||[],members=community.members||[],squadLegacy=await squadLegacyMap(squads),accepted=friends.filter(f=>f.status==='accepted'),friendIds=new Set(accepted.map(f=>f.requester_id===u.id?f.addressee_id:f.requester_id)),incoming=friends.filter(f=>f.status==='pending'&&f.addressee_id===u.id);
 const shell=root.querySelector('.social-v25');if(!shell)return;
 const friendProfiles=profiles.filter(p=>p.user_id===u.id||friendIds.has(p.user_id)).sort((a,b)=>b.xp-a.xp),outgoing=friends.filter(f=>f.status==='pending'&&f.requester_id===u.id);
 shell.insertAdjacentHTML('beforeend','<section class="community-grid"><article class="social-card friend-command"><div class="social-head"><span>FRIENDS // NETWORK</span><b>'+accepted.length+' LINKED</b></div><div class="friend-requests">'+(incoming.length?incoming.map(f=>'<div><span><strong>'+escapeHtml(f.requester_name)+'</strong><small>REQUESTING FRIEND LINK</small></span><span><button data-friend-accept="'+f.id+'">ACCEPT</button><button data-friend-decline="'+f.id+'">DECLINE</button></span></div>').join(''):'<small>NO INCOMING FRIEND REQUESTS</small>')+'</div><div class="friend-pending">'+(outgoing.length?outgoing.map(f=>'<div><span><strong>'+escapeHtml(f.addressee_name)+'</strong><small>REQUEST PENDING</small></span><button data-friend-cancel="'+f.id+'">CANCEL</button></div>').join(''):'')+'</div><div class="friend-leaderboard">'+friendProfiles.map((p,i)=>{const link=p.user_id===u.id?null:accepted.find(f=>friendshipPeerId(f,u.id)===p.user_id);return '<div><b>#'+(i+1)+'</b><span><strong>'+escapeHtml(p.display_name)+(p.user_id===u.id?' // YOU':'')+'</strong><small>LV '+p.level+' • '+escapeHtml(p.rank)+(p.title?' • '+escapeHtml(p.title):'')+'</small></span><em>'+Number(p.xp).toLocaleString()+' XP</em>'+(link?'<span class="friend-actions"><button data-friend-challenge="'+escapeHtml(p.display_name)+'">DUEL</button><button data-friend-remove="'+link.id+'">REMOVE</button></span>':'')+'</div>'}).join('')+'</div></article><article class="social-card squad-command"><div class="social-head"><span>SQUADS // GROUP OPS</span><b>'+squads.length+' ONLINE</b></div><form id="squadCreateForm"><input id="squadName" maxlength="40" placeholder="New squad name" required><button>CREATE SQUAD</button></form><div class="squad-list">'+squads.map(s=>{const sm=members.filter(m=>m.squad_id===s.id),mine=sm.some(m=>m.user_id===u.id);return '<div class="squad-row" data-dossier-squad="'+s.id+'"><span><strong>'+escapeHtml(s.name)+'</strong><small>'+sm.length+' MEMBER'+(sm.length===1?'':'S')+' • '+(s.owner_id===u.id?'COMMANDER':'GROUP')+' • '+escapeHtml(squadLegacy[s.id]?.title||'UNPROVEN UNIT')+'</small></span><button '+(s.owner_id===u.id?'disabled':mine?'data-squad-leave="'+s.id+'"':'data-squad-join="'+s.id+'"')+'>'+(s.owner_id===u.id?'YOUR SQUAD':mine?'LEAVE':'JOIN')+'</button></div>'}).join('')+'</div></article></section>');
 const discovery=document.getElementById('playerSearchResults');if(discovery){const search=document.getElementById('networkPlayerSearch');let t;search.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{const q=search.value.trim().toLowerCase();discovery.innerHTML=q.length<2?'':profiles.filter(p=>p.user_id!==u.id&&p.display_name.toLowerCase().includes(q)).slice(0,6).map(p=>'<div class="player-result"><button type="button" data-player-pick="'+escapeHtml(p.display_name)+'"><span>'+escapeHtml(p.display_name)+'</span><small>LV '+p.level+' • '+escapeHtml(p.rank)+'</small></button>'+(()=>{const fs=friendshipStatusFor(u.id,friends,p.user_id);return fs?.status==='accepted'?'<b>FRIEND</b>':fs?.incoming?'<b>REQUEST RECEIVED</b>':fs?.outgoing?'<b>PENDING</b>':'<button class="friend-add" data-friend-id="'+p.user_id+'" data-friend-name="'+escapeHtml(p.display_name)+'">+ FRIEND</button>'})()+'</div>').join('')||'<small class="no-player">NO MATCHING PLAYER</small>';discovery.querySelectorAll('[data-player-pick]').forEach(b=>b.onclick=()=>{document.getElementById('challengePlayer').value=b.dataset.playerPick;search.value=b.dataset.playerPick;discovery.innerHTML=''});discovery.querySelectorAll('[data-friend-id]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.friendId,b.dataset.friendName))},180)}}
 root.querySelectorAll('[data-friend-accept]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.friendAccept,'accepted'));root.querySelectorAll('[data-friend-decline]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.friendDecline,'declined'));root.querySelectorAll('[data-friend-cancel]').forEach(b=>b.onclick=()=>removeFriend(b.dataset.friendCancel));root.querySelectorAll('[data-friend-remove]').forEach(b=>b.onclick=()=>{if(confirm('Remove this friend link?'))removeFriend(b.dataset.friendRemove)});root.querySelectorAll('[data-friend-challenge]').forEach(b=>b.onclick=()=>{const input=document.getElementById('challengePlayer');if(input){input.value=b.dataset.friendChallenge;input.focus()}});root.querySelectorAll('[data-dossier-squad]').forEach(r=>r.onclick=e=>{if(!e.target.closest('button'))openSquadDossier(r.dataset.dossierSquad)});document.getElementById('squadCreateForm').onsubmit=e=>{e.preventDefault();const n=document.getElementById('squadName').value.trim();if(n.length>=2)createSquad(n)};root.querySelectorAll('[data-squad-join]').forEach(b=>b.onclick=()=>joinSquad(b.dataset.squadJoin));root.querySelectorAll('[data-squad-leave]').forEach(b=>b.onclick=()=>leaveSquad(b.dataset.squadLeave));
}
renderSocialCommand=renderCommunityV28;


/* ===== V29 SQUAD COMMAND // COMPETITIVE OPERATIONS ===== */
const SOCIAL_SQUAD_CHALLENGE_TABLE='social_squad_challenges';
function squadTotals(squadId,members,profiles){const ids=new Set(members.filter(m=>m.squad_id===squadId).map(m=>m.user_id)),ps=profiles.filter(p=>ids.has(p.user_id));return{members:ps.length,xp:ps.reduce((a,p)=>a+Number(p.xp||0),0),workouts:ps.reduce((a,p)=>a+Number(p.missions||0),0),level:ps.length?Math.round(ps.reduce((a,p)=>a+Number(p.level||1),0)/ps.length):0}}
function squadProgress(total){
 const xp=Math.max(0,Number(total?.xp)||0),missions=Math.max(0,Number(total?.workouts)||0),members=Math.max(0,Number(total?.members)||0);
 const level=Math.max(1,Math.floor(Math.sqrt(xp/2500))+1),base=Math.pow(level-1,2)*2500,next=Math.pow(level,2)*2500,pct=Math.max(0,Math.min(100,Math.round((xp-base)/Math.max(1,next-base)*100)));
 const title=level>=10?'APEX UNIT':level>=7?'ELITE STRIKE TEAM':level>=5?'VANGUARD':level>=3?'ACTIVE HUNTERS':'AWAKENED UNIT';
 const missionsList=[{name:'UNIT DEPLOYMENT',detail:'Complete 10 squad missions',value:missions,target:10},{name:'FORCE ASSEMBLY',detail:'Reach 25,000 combined XP',value:xp,target:25000},{name:'FULL PARTY',detail:'Recruit 4 squad members',value:members,target:4}].map(x=>({...x,pct:Math.min(100,Math.round(x.value/x.target*100)),complete:x.value>=x.target}));
 return{level,title,xp,base,next,pct,missions:missionsList}
}
const SOCIAL_SQUAD_GATE_TABLE='social_squad_gates',SOCIAL_SQUAD_HIT_TABLE='social_squad_gate_hits',SOCIAL_SQUAD_VICTORY_TABLE='social_squad_gate_victories';
function squadWeekKey(){const d=new Date(),x=new Date(d);x.setHours(0,0,0,0);x.setDate(d.getDate()-((d.getDay()+6)%7));return x.toISOString().slice(0,10)}
function squadBossForLevel(level){if(level>=10)return{name:'ECLIPSE COLOSSUS',tier:'APEX RAID',hp:240000};if(level>=7)return{name:'ABYSSAL WARDEN',tier:'ELITE RAID',hp:150000};if(level>=5)return{name:'IRON TYRANT',tier:'VANGUARD RAID',hp:90000};if(level>=3)return{name:'GATE DEVOURER',tier:'STRIKE RAID',hp:55000};return{name:'DUNGEON BEHEMOTH',tier:'SQUAD RAID',hp:30000}}
async function ensureSquadGate(squad,total){
 const week=squadWeekKey(),progress=squadProgress(total),boss=squadBossForLevel(progress.level);let rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_GATE_TABLE+'?squad_id=eq.'+encodeURIComponent(squad.id)+'&week_key=eq.'+week+'&select=*&limit=1');
 if(rows.length)return rows[0];rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_GATE_TABLE,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({squad_id:squad.id,week_key:week,boss_name:boss.name,boss_tier:boss.tier,max_hp:boss.hp,damage:0,defeated:false})});return rows[0]||null
}
async function fetchSquadVictories(squadId){try{return await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_VICTORY_TABLE+'?squad_id=eq.'+encodeURIComponent(squadId)+'&select=*&order=cleared_at.desc&limit=20')}catch(e){return[]}}
async function recordSquadGateVictory(squad,gate){
 try{const old=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_VICTORY_TABLE+'?gate_id=eq.'+encodeURIComponent(gate.id)+'&select=id&limit=1');if(old.length)return old[0];const hits=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_HIT_TABLE+'?gate_id=eq.'+encodeURIComponent(gate.id)+'&select=*'),by={};hits.forEach(h=>{by[h.user_id]=by[h.user_id]||{user_id:h.user_id,name:h.display_name,damage:0};by[h.user_id].damage+=Number(h.damage||0)});const c=Object.values(by).sort((x,y)=>y.damage-x.damage),m=c[0]||null,rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_VICTORY_TABLE,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({gate_id:gate.id,squad_id:squad.id,week_key:gate.week_key,boss_name:gate.boss_name,boss_tier:gate.boss_tier,max_hp:gate.max_hp,total_damage:gate.max_hp,mvp_user_id:m?.user_id||null,mvp_name:m?.name||null,mvp_damage:m?.damage||0,contributors:c.length,cleared_at:new Date().toISOString()})});return rows[0]||null}catch(e){return null}
}
function showSquadVictoryFx(hit){let e=document.getElementById('squadVictoryFx');if(!e){e=document.createElement('div');e.id='squadVictoryFx';e.className='squad-victory-fx';e.innerHTML='<div><small>SQUAD // GATE OPERATION</small><h2>RAID CLEARED</h2><strong id="svBoss"></strong><span id="svMvp"></span><b>UNIT VICTORY RECORDED</b></div>';document.body.appendChild(e)}document.getElementById('svBoss').textContent=hit.boss;document.getElementById('svMvp').textContent=hit.mvp?'MVP // '+hit.mvp:'SQUAD VICTORY';e.classList.remove('active');void e.offsetWidth;e.classList.add('active');setTimeout(()=>e.classList.remove('active'),3400)}
async function applySquadGateDamage(performance,prs=[]){
 const u=socialCloudUser();if(!u?.id||!performance)return null;try{const [community,net]=await Promise.all([fetchCommunityNetwork(),fetchSocialNetwork()]);if(!community||!net)return null;const membership=community.members.find(m=>m.user_id===u.id),squad=membership&&community.squads.find(s=>s.id===membership.squad_id);if(!squad)return null;const total=squadTotals(squad.id,community.members,net.profiles),gate=await ensureSquadGate(squad,total);if(!gate||gate.defeated)return null;
 const run=(workoutHistory().slice(-1)[0]||{}),runKey=[u.id,run.date||systemMissionKey(),run.mission||'mission',run.seconds||0,run.workoutMode||'full'].join(':');const prior=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_HIT_TABLE+'?gate_id=eq.'+encodeURIComponent(gate.id)+'&run_key=eq.'+encodeURIComponent(runKey)+'&select=id&limit=1');if(prior.length)return null;
 const critical=prs.length>0,damage=Math.max(250,Math.round((Number(performance.score)||0)*55*(critical?1.2:1))),next=Math.min(Number(gate.max_hp)||0,Number(gate.damage||0)+damage),defeated=next>=Number(gate.max_hp||0);
 await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_HIT_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({gate_id:gate.id,squad_id:squad.id,user_id:u.id,display_name:socialHandle(),run_key:runKey,damage,critical,score:Number(performance.score)||0})});
 await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_GATE_TABLE+'?id=eq.'+encodeURIComponent(gate.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({damage:next,defeated,defeated_at:defeated?new Date().toISOString():null})});
 let victory=null;if(defeated){victory=await recordSquadGateVictory(squad,{...gate,damage:next,defeated:true});setTimeout(refreshIdentityUnlocks,800);queueReward({title:'SQUAD GATE CLEARED',detail:gate.boss_name,amount:0,intensity:'major',source:'achievement'});showSquadVictoryFx({boss:gate.boss_name,mvp:victory?.mvp_name||null})}
 window.SystemOS?.notify((defeated?'SQUAD BOSS DEFEATED // ':'SQUAD HIT // ')+damage.toLocaleString()+' DAMAGE','SQUAD // GATE OPERATION');return{damage,critical,defeated,hp:Math.max(0,gate.max_hp-next),maxHp:gate.max_hp,boss:gate.boss_name}
 }catch(e){return null}
}
async function fetchSquadGateIntel(squad,total){
 try{const gate=await ensureSquadGate(squad,total);if(!gate)return null;const [hits,victories]=await Promise.all([cloudRequest('/rest/v1/'+SOCIAL_SQUAD_HIT_TABLE+'?gate_id=eq.'+encodeURIComponent(gate.id)+'&select=*&order=damage.desc'),fetchSquadVictories(squad.id)]);const by={};hits.forEach(h=>{const k=h.user_id;by[k]=by[k]||{name:h.display_name,damage:0,hits:0};by[k].damage+=Number(h.damage||0);by[k].hits++});return{gate,contributors:Object.values(by).sort((a,b)=>b.damage-a.damage),victories}
 }catch(e){return null}
}
async function fetchSquadChallenges(squadIds){if(!squadIds.length)return[];return cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE+'?or=('+squadIds.map(id=>'challenger_squad_id.eq.'+encodeURIComponent(id)+',opponent_squad_id.eq.'+encodeURIComponent(id)).join(',')+')&select=*&order=created_at.desc&limit=50')}
async function squadChallenge(id,type,days){const u=socialCloudUser(),community=await fetchCommunityNetwork(),net=await fetchSocialNetwork();if(!u||!community||!net)return;const mine=community.squads.find(s=>s.owner_id===u.id),opp=community.squads.find(s=>s.id===id);if(!mine||!opp)return;const a=squadTotals(mine.id,community.members,net.profiles),b=squadTotals(opp.id,community.members,net.profiles),metric=type==='workouts'?'workouts':'xp';await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({challenger_squad_id:mine.id,opponent_squad_id:opp.id,challenger_name:mine.name,opponent_name:opp.name,type,duration_days:Number(days),status:'pending',challenger_start:a[metric],opponent_start:b[metric],created_by:u.id})});window.SystemOS?.notify('SQUAD CHALLENGE TRANSMITTED // '+opp.name.toUpperCase(),'SOCIAL // SQUAD OPS');renderSocialCommand()}
async function respondSquadChallenge(id,accept){const u=socialCloudUser(),community=await fetchCommunityNetwork(),net=await fetchSocialNetwork();if(!u||!community||!net)return;const rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id)+'&select=*'),x=rows[0],owned=community.squads.find(s=>s.id===x?.opponent_squad_id&&s.owner_id===u.id);if(!x||!owned||x.status!=='pending')return;const total=squadTotals(owned.id,community.members,net.profiles),metric=x.type==='workouts'?'workouts':'xp';await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(accept?{status:'active',opponent_start:total[metric],accepted_at:new Date().toISOString()}:{status:'declined'})});renderSocialCommand()}
const SQUAD_ACHIEVEMENTS=[{id:'first_raid',name:'FIRST RAID',desc:'Clear the first Squad Gate.',test:v=>v.length>=1},{id:'gatebreakers',name:'GATEBREAKERS',desc:'Clear 5 Squad Gates.',test:v=>v.length>=5},{id:'apex_raiders',name:'APEX RAIDERS',desc:'Clear an Apex Raid.',test:v=>v.some(x=>String(x.boss_tier).includes('APEX'))},{id:'raid_veterans',name:'RAID VETERANS',desc:'Clear 10 Squad Gates.',test:v=>v.length>=10}];
function squadRaidStreak(v){if(!v.length)return 0;const w=[...new Set(v.map(x=>x.week_key).filter(Boolean))].sort().reverse();let n=1;for(let i=1;i<w.length;i++){if(Math.round((new Date(w[i-1]+'T00:00:00')-new Date(w[i]+'T00:00:00'))/86400000)===7)n++;else break}return n}
function squadAchievementState(v,u){const streak=squadRaidStreak(v),unlocked=SQUAD_ACHIEVEMENTS.filter(x=>x.test(v)).map(x=>x.id);if(streak>=3)unlocked.push('weekly_dominance');const mvp=v.filter(x=>x.mvp_user_id===u).length;return{unlocked,streak,mvp,title:v.some(x=>String(x.boss_tier).includes('APEX'))?'APEX RAIDERS':v.length>=10?'RAID VETERANS':v.length>=5?'GATEBREAKERS':v.length?'GATEBREAKERS INITIATE':'UNPROVEN UNIT'}}
function squadAchievementCatalog(s){return[...SQUAD_ACHIEVEMENTS,{id:'weekly_dominance',name:'WEEKLY DOMINANCE',desc:'Clear Squad Gates 3 consecutive weeks.'}].map(x=>({...x,unlocked:s.unlocked.includes(x.id)}))}
const SOCIAL_IDENTITY_KEY='systemSocialIdentityCard';
function getIdentityCard(){try{return Object.assign({callsign:'',motto:'',frame:'SYSTEM',emblem:'RANK'},JSON.parse(localStorage.getItem(SOCIAL_IDENTITY_KEY)||'{}'))}catch(e){return{callsign:'',motto:'',frame:'SYSTEM',emblem:'RANK'}}}
function saveIdentityCard(x){localStorage.setItem(SOCIAL_IDENTITY_KEY,JSON.stringify(x));return x}
function socialCallsign(profile){const c=getIdentityCard();return profile?.user_id===socialCloudUser()?.id&&c.callsign?c.callsign:(profile?.display_name||'HUNTER')}
function renderIdentityCard(profile,squad,legacy){
 const c=profile?.user_id===socialCloudUser()?.id?getIdentityCard():{},name=socialCallsign(profile),rank=profile?.rank||'E-Rank',letter=identityEmblem(c,profile);
 const ar=profile?.user_id===socialCloudUser()?.id?ascensionRecord():null,prestige=ar?ascensionRewardProfile():null;return '<div class="hunter-id-card frame-'+escapeHtml(c.frame||'SYSTEM').toLowerCase()+'"><div class="hunter-id-card__emblem">'+escapeHtml(letter)+'</div><div><small>THE SYSTEM // HUNTER ID</small><h3>'+escapeHtml(name)+'</h3><strong>'+escapeHtml(rank)+' • LV '+Number(profile?.level||1)+'</strong>'+(profile?.title?'<span>'+escapeHtml(profile.title)+'</span>':'')+(squad?'<em>'+escapeHtml(squad.name)+' // '+escapeHtml(legacy?.title||'UNPROVEN UNIT')+'</em>':'')+(ar?.completed?'<i class="hunter-id-card__ascension">ASCENSION '+ar.completed+' // '+ar.tier+(prestige?' // '+prestige.title+' // +'+prestige.xpBonus+'% XP':'')+'</i>':'')+(c.motto?'<p>“'+escapeHtml(c.motto)+'”</p>':'')+'</div></div>'
}
const IDENTITY_UNLOCK_SEEN_KEY='systemIdentityUnlocksSeen',IDENTITY_EARNED_KEY='systemIdentityEarnedV1';
function identityOwnerKey(){return socialCloudUser()?.id||'local'}
function identityEarnedLedger(){try{const all=JSON.parse(localStorage.getItem(IDENTITY_EARNED_KEY)||'{}');return Array.isArray(all[identityOwnerKey()])?all[identityOwnerKey()]:[]}catch(e){return[]}}
function saveIdentityEarnedLedger(ids){let all={};try{all=JSON.parse(localStorage.getItem(IDENTITY_EARNED_KEY)||'{}')||{}}catch(e){}all[identityOwnerKey()]=[...new Set(ids)];localStorage.setItem(IDENTITY_EARNED_KEY,JSON.stringify(all));return all[identityOwnerKey()]}
function identitySeenKey(){return IDENTITY_UNLOCK_SEEN_KEY+':'+identityOwnerKey()}
function identityUnlockIds(s){return[...s.frames,...s.emblems].filter(x=>x.unlocked).map(x=>x.id)}
function showIdentityUnlockFx(item,type){
 let e=document.getElementById('identityUnlockFx');if(!e){e=document.createElement('div');e.id='identityUnlockFx';e.className='identity-unlock-fx';e.innerHTML='<div><small>SYSTEM // REWARD ACQUIRED</small><h2>NEW IDENTITY UNLOCK</h2><div id="iuIcon"></div><strong id="iuName"></strong><span id="iuType"></span><p id="iuWhy"></p></div>';document.body.appendChild(e)}
 document.getElementById('iuIcon').textContent=type==='FRAME'?'▱':'◆';document.getElementById('iuName').textContent=item.name;document.getElementById('iuType').textContent=type+' // COSMETIC REWARD';document.getElementById('iuWhy').textContent=item.why;e.classList.remove('active');void e.offsetWidth;e.classList.add('active');setTimeout(()=>e.classList.remove('active'),3000)
}
function checkIdentityUnlockTransitions(profile,legacy,trophies=null,hunterLegacy=null,{initialize=false}={}){
 const s=identityUnlockState(profile,legacy,trophies,hunterLegacy),all=[...s.frames.map(x=>({...x,type:'FRAME'})),...s.emblems.map(x=>({...x,type:'EMBLEM'}))],ids=identityUnlockIds(s),earned=saveIdentityEarnedLedger([...identityEarnedLedger(),...ids]),seenKey=identitySeenKey();let seen;try{seen=JSON.parse(localStorage.getItem(seenKey)||'null')}catch(e){seen=null}
 if(!Array.isArray(seen)||initialize){localStorage.setItem(seenKey,JSON.stringify(earned));return[]}
 const fresh=all.filter(x=>x.unlocked&&!seen.includes(x.id));if(fresh.length){localStorage.setItem(seenKey,JSON.stringify([...new Set([...seen,...earned])]));fresh.forEach((x,i)=>setTimeout(()=>{queueReward({title:'NEW SYSTEM REWARD',detail:x.name+' '+x.type,amount:0,intensity:'major',source:'achievement'});showIdentityUnlockFx(x,x.type)},i*2300))}
 return fresh
}
async function refreshIdentityUnlocks(){
 if(socialIdentityRefreshBusy)return;socialIdentityRefreshBusy=true;
 try{const u=socialCloudUser();if(!u?.id)return;const [net,community]=await Promise.all([fetchSocialNetwork({sync:false}),fetchCommunityNetwork()]),p=net?.profiles?.find(x=>x.user_id===u.id);if(!p)return;const m=community?.members?.find(x=>x.user_id===u.id),sq=m&&community.squads.find(x=>x.id===m.squad_id),victories=sq?await fetchSquadVictories(sq.id):[],legacy=sq?{...(await squadLegacyMap([sq]))[sq.id],victories:victories.length}:null;const trophies=trophyCollection(victories),ctx=saveLegacyContext(p,trophies,legacy);checkIdentityUnlockTransitions(p,legacy,trophies,ctx.hunter)}catch(e){}finally{socialIdentityRefreshBusy=false}
}
function identityUnlockState(profile,legacy,trophies=null,hunterLegacy=null){
 const level=Number(profile?.level||state.level||1),gates=Number(profile?.gates||0),streak=Number(profile?.streak||state.currentStreak||0),mvp=Number(legacy?.mvp||0),raids=Number(legacy?.victories||0);
 const frames=[{id:'SYSTEM',name:'SYSTEM',unlocked:true,why:'Standard issue'},{id:'RAID',name:'RAID',unlocked:gates>=1||raids>=1,why:'Clear a Gate'},{id:'VANGUARD',name:'VANGUARD',unlocked:level>=20,why:'Reach C-Rank / LV 20'},{id:'ELITE',name:'ELITE',unlocked:level>=50,why:'Reach S-Rank / LV 50'},{id:'MVP',name:'MVP',unlocked:mvp>=1,why:'Earn a Squad Raid MVP'},{id:'SHADOW',name:'SHADOW',unlocked:level>=90,why:'Reach Shadow / LV 90'},{id:'ARCHIVE',name:'ARCHIVE',unlocked:!!trophies?.sets?.find(x=>x.id==='raid_collector'&&x.unlocked),why:'Collect 4 Boss trophy classes'},{id:'ASCENDANT',name:'ASCENDANT',unlocked:Number(hunterLegacy?.level||0)>=3,why:'Reach Legacy Level 3'},{id:'VETERAN',name:'VETERAN',unlocked:Number(hunterLegacy?.level||0)>=5,why:'Reach Legacy Level 5'},{id:'MYTHIC',name:'MYTHIC',unlocked:Number(hunterLegacy?.level||0)>=7,why:'Reach Legacy Level 7'},{id:'SOVEREIGN',name:'SOVEREIGN',unlocked:Number(hunterLegacy?.level||0)>=10,why:'Reach Legacy Level 10'},{id:'TRIALBORN',name:'TRIALBORN',unlocked:legacyTrialWins().includes(2),why:'Clear the Trial of Command'},{id:'OVERLORD',name:'OVERLORD',unlocked:legacyTrialWins().includes(3),why:'Conquer the Sovereign Trial'},{id:'NEXUS',name:'NEXUS',unlocked:legacyArtifact().unlocked,why:'Forge the complete Legacy Nexus'},{id:'ASCENDED',name:'ASCENDED',unlocked:ascensionRecord().completed>=1,why:'Complete 1 Legacy Ascension'},{id:'ASCENSION_MASTER',name:'ASCENSION MASTER',unlocked:ascensionRecord().completed>=3,why:'Complete 3 Legacy Ascensions'},{id:'EXALTED',name:'EXALTED',unlocked:ascensionRecord().completed>=5,why:'Complete 5 Legacy Ascensions'},{id:'ETERNAL',name:'ETERNAL',unlocked:ascensionRecord().completed>=10,why:'Complete 10 Legacy Ascensions'}];
 const emblems=[{id:'RANK',name:'RANK',unlocked:true,why:'Standard rank emblem'},{id:'GATE',name:'GATE',unlocked:gates>=5,why:'Clear 5 Gates'},{id:'STREAK',name:'STREAK',unlocked:streak>=30,why:'30-day streak'},{id:'APEX',name:'APEX',unlocked:legacy?.title==='APEX RAIDERS',why:'Join an Apex Raider unit'},{id:'SCOUT',name:'SCOUT',unlocked:!!trophies?.sets?.find(x=>x.id==='gate_scout'&&x.unlocked),why:'Collect 2 Boss trophy classes'},{id:'CROWN',name:'CROWN',unlocked:!!trophies?.complete,why:'Complete all 5 Boss trophy classes'},{id:'LEGACY',name:'LEGACY',unlocked:Number(hunterLegacy?.level||0)>=5,why:'Reach Legacy Level 5'},{id:'SOVEREIGN_SIGIL',name:'SOVEREIGN SIGIL',unlocked:Number(hunterLegacy?.level||0)>=10,why:'Reach Legacy Level 10'},{id:'RESOLVE',name:'RESOLVE',unlocked:legacyTrialWins().includes(1),why:'Clear the Trial of Resolve'},{id:'CORE',name:'SOVEREIGN CORE',unlocked:legacyTrialWins().includes(3),why:'Conquer the Sovereign Trial'},{id:'NEXUS_CORE',name:'NEXUS CORE',unlocked:legacyArtifact().unlocked,why:'Forge the complete Legacy Nexus'},{id:'ASCENSION',name:'ASCENSION',unlocked:ascensionRecord().completed>=1,why:'Complete 1 Legacy Ascension'},{id:'MASTER_MARK',name:'MASTER MARK',unlocked:ascensionRecord().completed>=3,why:'Complete 3 Legacy Ascensions'},{id:'ETERNAL_MARK',name:'ETERNAL MARK',unlocked:ascensionRecord().completed>=10,why:'Complete 10 Legacy Ascensions'}];
 const earned=new Set(identityEarnedLedger());frames.forEach(x=>x.unlocked=!!x.unlocked||earned.has(x.id));emblems.forEach(x=>x.unlocked=!!x.unlocked||earned.has(x.id));
 return{frames,emblems,level,gates,streak,mvp,raids}
}
function identityEmblem(c,profile){if(c.emblem==='GATE')return '◇';if(c.emblem==='STREAK')return '✦';if(c.emblem==='APEX')return '▲';if(c.emblem==='SCOUT')return '◈';if(c.emblem==='CROWN')return '♛';if(c.emblem==='LEGACY')return '✧';if(c.emblem==='SOVEREIGN_SIGIL')return '♜';if(c.emblem==='RESOLVE')return 'Ⅰ';if(c.emblem==='CORE')return 'Ⅲ';if(c.emblem==='NEXUS_CORE')return '◆';if(c.emblem==='ASCENSION')return 'A'+ascensionRecord().completed;if(c.emblem==='MASTER_MARK')return 'Ⅲ';if(c.emblem==='ETERNAL_MARK')return '∞';const rank=profile?.rank||'E-Rank';return rank.replace('-Rank','').replace('+','⁺').slice(0,6)}
async function installIdentityEditor(){
 const root=document.getElementById('osSocialCommand');if(!root||root.querySelector('.identity-editor'))return;const c=getIdentityCard(),shell=root.querySelector('.social-v25');if(!shell)return;let profile=null,legacy=null;try{const u=socialCloudUser(),[net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);profile=net?.profiles?.find(p=>p.user_id===u?.id)||null;const m=community?.members?.find(x=>x.user_id===u?.id),sq=m&&community.squads.find(x=>x.id===m.squad_id);if(sq){const v=await fetchSquadVictories(sq.id);legacy={...(await squadLegacyMap([sq]))[sq.id],victories:v.length,trophies:trophyCollection(v)}}}catch(e){}
 const hunterLegacy=hunterLegacyState(profile,legacy?.trophies,legacy),unlocks=identityUnlockState(profile,legacy,legacy?.trophies,hunterLegacy);checkIdentityUnlockTransitions(profile,legacy,legacy?.trophies,hunterLegacy,{initialize:!localStorage.getItem(identitySeenKey())});const frame=unlocks.frames.find(x=>x.id===c.frame&&x.unlocked)?c.frame:'SYSTEM',emblem=unlocks.emblems.find(x=>x.id===c.emblem&&x.unlocked)?c.emblem:'RANK';if(frame!==c.frame||emblem!==c.emblem)saveIdentityCard({...c,frame,emblem});
 const options=x=>x.map(v=>'<option value="'+v.id+'" '+(!v.unlocked?'disabled':'')+'>'+v.name+(v.unlocked?'':' // LOCKED')+'</option>').join('');
 const s=document.createElement('section');s.className='social-card identity-editor';s.innerHTML='<div class="social-head"><span>IDENTITY // HUNTER CARD</span><b>ACCOMPLISHMENT UNLOCKS</b></div><form id="identityCardForm"><label>CALLSIGN<input id="identityCallsign" maxlength="24" value="'+escapeHtml(c.callsign)+'" placeholder="'+escapeHtml(socialHandle())+'"></label><label>MOTTO<input id="identityMotto" maxlength="64" value="'+escapeHtml(c.motto)+'" placeholder="Optional field motto"></label><label>FRAME<select id="identityFrame">'+options(unlocks.frames)+'</select></label><label>EMBLEM<select id="identityEmblem">'+options(unlocks.emblems)+'</select></label><button>SAVE IDENTITY</button></form><div class="identity-unlocks">'+[...unlocks.frames,...unlocks.emblems].map(x=>'<span class="'+(x.unlocked?'unlocked':'locked')+'"><b>'+x.name+'</b><small>'+escapeHtml(x.why)+'</small></span>').join('')+'</div><small>COSMETIC ONLY // UNLOCKED BY TRAINING // NO COMBAT OR XP BONUS</small>';shell.insertBefore(s,shell.firstChild);s.querySelector('#identityFrame').value=frame;s.querySelector('#identityEmblem').value=emblem;s.querySelector('form').onsubmit=e=>{e.preventDefault();saveIdentityCard({callsign:s.querySelector('#identityCallsign').value.trim(),motto:s.querySelector('#identityMotto').value.trim(),frame:s.querySelector('#identityFrame').value,emblem:s.querySelector('#identityEmblem').value});window.SystemOS?.notify('HUNTER IDENTITY UPDATED','SOCIAL // IDENTITY')}
}
function ensureRewardVault(){let e=document.getElementById('systemRewardVault');if(e)return e;e=document.createElement('aside');e.id='systemRewardVault';e.className='reward-vault';e.setAttribute('aria-hidden','true');e.innerHTML='<header><div><small>SYSTEM // COLLECTION ARCHIVE</small><h2>REWARD VAULT</h2></div><button aria-label="Close reward vault">×</button></header><div id="rewardVaultBody"></div>';document.body.appendChild(e);e.querySelector('header button').onclick=()=>{e.classList.remove('active');e.setAttribute('aria-hidden','true')};return e}
const TROPHY_CLASSES=[
 {id:'DUNGEON',tier:'SQUAD RAID',name:'DUNGEON',mark:'I'},
 {id:'STRIKE',tier:'STRIKE RAID',name:'STRIKE',mark:'II'},
 {id:'VANGUARD',tier:'VANGUARD RAID',name:'VANGUARD',mark:'III'},
 {id:'ELITE',tier:'ELITE RAID',name:'ELITE',mark:'IV'},
 {id:'APEX',tier:'APEX RAID',name:'APEX',mark:'V'}
];
function trophyClass(tier){return TROPHY_CLASSES.find(x=>x.tier===tier)||TROPHY_CLASSES[0]}
function trophyCollection(victories){
 const classes=TROPHY_CLASSES.map(c=>{const rows=victories.filter(v=>v.boss_tier===c.tier);return{...c,count:rows.length,unlocked:rows.length>0,detail:rows.length?rows.length+' RAID CLEAR'+(rows.length===1?'':'S'):'Defeat a '+c.tier+' boss'}});
 const unique=classes.filter(x=>x.unlocked).length,total=victories.length;
 const sets=[{id:'gate_scout',name:'GATE SCOUT',detail:'Collect 2 trophy classes',unlocked:unique>=2},{id:'raid_collector',name:'RAID COLLECTOR',detail:'Collect 4 trophy classes',unlocked:unique>=4},{id:'complete_archive',name:'COMPLETE RAID ARCHIVE',detail:'Collect all 5 trophy classes',unlocked:unique>=5}];
 return{classes,sets,unique,total,complete:unique===TROPHY_CLASSES.length}
}
const LEGACY_CONTEXT_KEY='systemLegacyContextV1';
function cachedLegacyContext(){
 try{const x=JSON.parse(localStorage.getItem(LEGACY_CONTEXT_KEY)||'null');if(x?.hunter)return x}catch(e){}
 const profile=typeof buildSocialIdentity==='function'?buildSocialIdentity():null,hunter=hunterLegacyState(profile,null,null);return{profile,trophies:null,squad:null,hunter,updatedAt:null}
}
function saveLegacyContext(profile,trophies,squad){
 const ctx={profile:profile||null,trophies:trophies||null,squad:squad||null,hunter:hunterLegacyState(profile,trophies,squad),updatedAt:new Date().toISOString()};localStorage.setItem(LEGACY_CONTEXT_KEY,JSON.stringify(ctx));return ctx
}
async function refreshLegacyContext(){
 const u=socialCloudUser?.(),fallback=typeof buildSocialIdentity==='function'?buildSocialIdentity():null;if(!u?.id)return saveLegacyContext(fallback,null,null);
 try{const [net,community]=await Promise.all([fetchSocialNetwork({sync:false}),fetchCommunityNetwork()]),profile=net?.profiles?.find(x=>x.user_id===u.id)||fallback,m=community?.members?.find(x=>x.user_id===u.id),sq=m&&community?.squads?.find(x=>x.id===m.squad_id),victories=sq?await fetchSquadVictories(sq.id):[],squad=sq?{...squadAchievementState(victories,u.id),victories:victories.length}:null,trophies=trophyCollection(victories),ctx=saveLegacyContext(profile,trophies,squad);renderLegacyMissions?.();return ctx}catch(e){return cachedLegacyContext()}
}
function currentHunterLegacy(){return cachedLegacyContext().hunter||hunterLegacyState(typeof buildSocialIdentity==='function'?buildSocialIdentity():null,null,null)}
function hunterLegacyState(profile,trophies=null,legacy=null){
 const level=Number(profile?.level||state.level||1),streak=Number(profile?.streak||state.currentStreak||0),missions=Number(profile?.missions||state.totalQuestsCompleted||0),gates=Number(profile?.gates||0),classes=Number(trophies?.unique||0),raids=Number(trophies?.total||legacy?.victories||0),mvp=Number(legacy?.mvp||0);
 const score=Math.max(0,(level>=50?(level-49)*20:0)+(missions*3)+(gates*25)+(streak*8)+(classes*250)+(raids*80)+(mvp*150));
 const lvl=Math.floor(Math.sqrt(score/500))+1,base=Math.pow(lvl-1,2)*500,next=Math.pow(lvl,2)*500,progress=next>base?Math.max(0,Math.min(100,((score-base)/(next-base))*100)):100;
 const title=lvl>=10?'SOVEREIGN LEGACY':lvl>=7?'MYTHIC HUNTER':lvl>=5?'VETERAN HUNTER':lvl>=3?'ASCENDANT':'AWAKENED LEGACY';
 return{score,level:lvl,title,progress,next:Math.max(0,next-score),components:{missions,gates,streak,classes,raids,mvp},active:level>=50||classes>=2}
}
const LEGACY_ASCENSION_KEY='systemLegacyAscension';
function legacyAscension(){try{return Object.assign({cycle:0,history:[],baseline:null},JSON.parse(localStorage.getItem(LEGACY_ASCENSION_KEY)||'{}'))}catch(e){return{cycle:0,history:[],baseline:null}}}
function ascensionRecord(){
 const a=legacyAscension(),completed=(a.history||[]).filter(x=>Number(x.cycle)>=1),marks=completed.length;
 const tier=marks>=10?'ETERNAL':marks>=5?'EXALTED':marks>=3?'MASTER':marks>=1?'ASCENDED':'UNASCENDED';
 return{current:Number(a.cycle||0),completed:marks,tier,history:completed,mark:'A'+marks}
}
function ascensionRewardProfile(){
 const r=ascensionRecord(),marks=Number(r.completed||0),current=Number(r.current||0);
 const xpBonus=Math.min(25,marks*2),legacyBonus=Math.min(50,marks*5);
 const title=marks>=10?'ETERNAL ASCENDANT':marks>=5?'EXALTED HUNTER':marks>=3?'ASCENSION MASTER':marks>=1?'ASCENDED HUNTER':'UNASCENDED';
 const rewards=[
  {at:1,name:'ASCENDED HUNTER',detail:'+2% XP bonus • Ascended identity frame',unlocked:marks>=1},
  {at:3,name:'ASCENSION MASTER',detail:'+6% XP bonus • Master prestige emblem',unlocked:marks>=3},
  {at:5,name:'EXALTED HUNTER',detail:'+10% XP bonus • Exalted identity frame',unlocked:marks>=5},
  {at:10,name:'ETERNAL ASCENDANT',detail:'+20% XP bonus • Eternal prestige aura',unlocked:marks>=10}
 ];
 return{marks,current,title,xpBonus,legacyBonus,rewards,next:rewards.find(x=>!x.unlocked)||null};
}
function ascensionRewardMultiplier(){return 1+(ascensionRewardProfile().xpBonus/100)}
function ascensionRewardPanel(){
 const p=ascensionRewardProfile(),next=p.next;
 return '<div class="ascension-rewards"><strong>ASCENSION // PRESTIGE</strong><span><small>PRESTIGE TITLE</small><b>'+escapeHtml(p.title)+'</b></span><span><small>ASCENSION MARKS</small><b>'+p.marks+'</b></span><span><small>XP AMPLIFIER</small><b>+'+p.xpBonus+'%</b></span><span><small>LEGACY BONUS</small><b>+'+p.legacyBonus+'%</b></span>'+(next?'<p>NEXT REWARD // A'+next.at+' • '+escapeHtml(next.name)+'<br><small>'+escapeHtml(next.detail)+'</small></p>':'<p>MAXIMUM PRESTIGE // ETERNAL REWARD TRACK COMPLETE</p>')+'</div>';
}
const ASCENSION_REWARD_SEEN_KEY='systemAscensionRewardSeenV1';
function checkAscensionPrestigeUnlocks(){
 const unlocked=ascensionPrestigeRewards().filter(x=>x.unlocked),ids=unlocked.map(x=>x.id);let seen=[];try{seen=JSON.parse(localStorage.getItem(ASCENSION_REWARD_SEEN_KEY)||'[]')}catch(e){}
 const fresh=unlocked.filter(x=>!seen.includes(x.id));if(fresh.length){localStorage.setItem(ASCENSION_REWARD_SEEN_KEY,JSON.stringify([...new Set([...seen,...ids])]));fresh.forEach((x,i)=>setTimeout(()=>queueReward({title:'PRESTIGE REWARD UNLOCKED',detail:x.name+' • '+x.detail,amount:0,intensity:'major',source:'ascension'}),i*1200))}return fresh;
}
function ascensionPrestigeRewards(){
 const p=ascensionRewardProfile();return p.rewards.map(x=>({id:'prestige_'+x.at,name:x.name,detail:x.detail,unlocked:x.unlocked,kind:'ASCENSION PRESTIGE',mark:'A'+x.at,stat:x.unlocked?'PERMANENT REWARD ACTIVE':'COMPLETE ASCENSION '+x.at}));
}
function ascensionHistoryRewards(){
 const rows=ascensionRecord().history||[];return rows.slice().reverse().map(x=>({id:'ascension_history_'+x.cycle,name:'ASCENSION '+x.cycle+' COMPLETE',detail:(x.prestigeTitle||'ASCENDED HUNTER')+' • +'+Number(x.xpBonus||0)+'% XP recorded',unlocked:true,kind:'ASCENSION RECORD',earnedAt:x.completedAt,stat:'A'+x.cycle}));
}
function ascensionMarks(){
 const r=ascensionRecord();return[
  {id:'ascension_1',name:'ASCENSION MARK I',detail:'Complete the first Legacy cycle',unlocked:r.completed>=1,kind:'ASCENSION MARK',mark:'Ⅰ'},
  {id:'ascension_3',name:'ASCENSION MARK III',detail:'Complete 3 Legacy cycles',unlocked:r.completed>=3,kind:'ASCENSION MARK',mark:'Ⅲ'},
  {id:'ascension_5',name:'ASCENSION MARK V',detail:'Complete 5 Legacy cycles',unlocked:r.completed>=5,kind:'ASCENSION MARK',mark:'Ⅴ'},
  {id:'ascension_10',name:'ETERNAL MARK',detail:'Complete 10 Legacy cycles',unlocked:r.completed>=10,kind:'ASCENSION MARK',mark:'Ⅹ'}
 ]}
function ascendLegacy(){
 const artifact=legacyArtifact(),old=legacyAscension();if(!artifact.unlocked)return false;
 const ctx=cachedLegacyContext(),profile=ctx.profile||(typeof buildSocialIdentity==='function'?buildSocialIdentity():{missions:state.totalQuestsCompleted,gates:0,streak:state.currentStreak}),components=ctx.hunter?.components||{},base={missions:Number(profile.missions||components.missions||0),gates:Number(profile.gates||components.gates||0),streak:Number(profile.streak||components.streak||0),raids:Number(components.raids||0),mvp:Number(components.mvp||0)};
 const completedCycle=Number(old.cycle||0),reward=completedCycle>=1?ascensionRewardProfile():null; const next={cycle:completedCycle+1,baseline:base,history:[...(old.history||[]),...(completedCycle>=1?[{cycle:completedCycle,completedAt:new Date().toISOString(),prestigeTitle:reward?.title||'ASCENDED HUNTER',xpBonus:reward?.xpBonus||0}]:[])]};
 localStorage.setItem(LEGACY_ASCENSION_KEY,JSON.stringify(next));localStorage.setItem(LEGACY_TRIAL_KEY,'[]');localStorage.setItem(LEGACY_MISSION_KEY,'[]');
 queueReward({title:'LEGACY ASCENSION',detail:'ASCENSION '+next.cycle+' // NEW LEGACY CYCLE INITIALIZED',amount:0,intensity:'major',source:'achievement'}); const post=ascensionRewardProfile(); checkAscensionPrestigeUnlocks(); if(post.completed!==0||post.marks>0) queueReward({title:'PRESTIGE UPDATED',detail:post.title+' • +'+post.xpBonus+'% XP AMPLIFIER',amount:0,intensity:'major',source:'ascension'});window.SystemOS?.notify('ASCENSION '+next.cycle+' ONLINE','LEGACY // NEW CYCLE');renderLegacyMissions();return true
}
const LEGACY_MISSION_KEY='systemLegacyMissionClaims';
function legacyMissionClaims(){try{return JSON.parse(localStorage.getItem(LEGACY_MISSION_KEY)||'[]')}catch(e){return[]}}
function ascensionModifiers(){
 const n=Number(legacyAscension().cycle||0),mods=[];
 if(n>=1)mods.push({id:'precision',name:'PRECISION PROTOCOL',detail:'Mission targets scale with Ascension difficulty.',mult:1+.12*Math.min(n,5)});
 if(n>=2)mods.push({id:'consistency',name:'CONSISTENCY LOCK',detail:'Streak directives demand sustained deployment.',streakBonus:7*Math.min(n-1,4)});
 if(n>=3)mods.push({id:'gate',name:'GATE PRESSURE',detail:'Gate and raid directives receive an additional combat quota.',combatBonus:2*Math.min(n-2,4)});
 if(n>=5)mods.push({id:'sovereign',name:'SOVEREIGN CONDITION',detail:'Final Trial requires all directives plus a 30-day active streak.',trialStreak:30});
 return{cycle:n,mods,label:n>=5?'SOVEREIGN':n>=3?'ELITE':n>=1?'HARDENED':'STANDARD'}
}
function legacyMissions(x){
 const c=x.components||{},asc=legacyAscension(),n=asc.cycle||0,b=asc.baseline||{},baseScale=1+n*.2,mod=ascensionModifiers(),scale=baseScale*(mod.mods.find(x=>x.id==='precision')?.mult||1),delta=(k)=>n?Math.max(0,Number(c[k]||0)-Number(b[k]||0)):Number(c[k]||0),defs=[
  {id:'mission_100',chapter:1,name:'CENTURY OF DISCIPLINE',detail:'Complete 100 missions',value:delta('missions'),target:Math.round(100*scale),lp:300},
  {id:'streak_30',chapter:1,name:'UNBROKEN ROUTINE',detail:'Maintain a 30-day streak',value:n?Number(c.streak||0):delta('streak'),target:Math.round(30*scale)+(mod.mods.find(x=>x.id==='consistency')?.streakBonus||0),lp:350},
  {id:'gates_10',chapter:2,name:'GATE VETERAN',detail:'Record 10 Gate clears',value:delta('gates'),target:Math.round(10*scale)+(mod.mods.find(x=>x.id==='gate')?.combatBonus||0),lp:400},
  {id:'raids_10',chapter:2,name:'RAID CAMPAIGN',detail:'Complete 10 Squad raids',value:delta('raids'),target:Math.round(10*scale)+(mod.mods.find(x=>x.id==='gate')?.combatBonus||0),lp:500},
  {id:'classes_5',chapter:3,name:'ARCHIVE DOMINION',detail:'Collect all 5 Boss trophy classes',value:Number(c.classes||0),target:5,lp:600},
  {id:'mvp_3',chapter:3,name:'VANGUARD COMMAND',detail:'Earn 3 Squad Raid MVPs',value:delta('mvp'),target:Math.round(3*scale),lp:650}
 ];const claimed=legacyMissionClaims();return defs.map(m=>({...m,complete:Number(m.value)>=m.target,claimed:claimed.includes(m.id),progress:Math.min(100,Number(m.value)/m.target*100)}))
}
const LEGACY_TRIAL_KEY='systemLegacyTrials';
const LEGACY_CHAPTERS=[
 {id:1,name:'AWAKENING',subtitle:'Prove the discipline that created the Hunter.',trial:'TRIAL OF RESOLVE',guardian:'THE IRON SENTINEL'},
 {id:2,name:'GATEFRONT',subtitle:'Carry that discipline into Gate operations.',trial:'TRIAL OF COMMAND',guardian:'THE GATE WARDEN'},
 {id:3,name:'SOVEREIGN PATH',subtitle:'Master the raid archive and lead from the front.',trial:'SOVEREIGN TRIAL',guardian:'THE LEGACY SOVEREIGN'}
];
function legacyTrialWins(){try{return JSON.parse(localStorage.getItem(LEGACY_TRIAL_KEY)||'[]')}catch(e){return[]}}
function legacyTrialRewards(){
 const wins=legacyTrialWins();return[
  {id:'trial_resolve',name:'RESOLVE SIGIL',detail:'Clear the Trial of Resolve',unlocked:wins.includes(1),kind:'LEGACY RELIC',mark:'Ⅰ'},
  {id:'trial_command',name:'WARDEN CREST',detail:'Clear the Trial of Command',unlocked:wins.includes(2),kind:'LEGACY RELIC',mark:'Ⅱ'},
  {id:'trial_sovereign',name:'SOVEREIGN CORE',detail:'Clear the Sovereign Trial',unlocked:wins.includes(3),kind:'LEGACY RELIC',mark:'Ⅲ'}
 ]}
function legacyArtifact(){
 const relics=legacyTrialRewards(),complete=relics.every(x=>x.unlocked);return{id:'legacy_nexus',name:'LEGACY NEXUS',detail:'Forged from the Resolve Sigil, Warden Crest and Sovereign Core.',unlocked:complete,kind:'LEGACY ARTIFACT',mark:'◆',components:relics.length}
}

function ascensionTrialProfile(chapter){
 const n=Number(legacyAscension().cycle||0),base=[0,120,180,260][Number(chapter.id)||0]||120,mult=1+Math.min(n,10)*.18,maxHp=Math.round(base*mult);
 const affixes=[];if(n>=1)affixes.push('HARDENED');if(n>=3)affixes.push('ENRAGED');if(n>=5&&chapter.id===3)affixes.push('SOVEREIGN');if(n>=7)affixes.push('RELENTLESS');
 return{maxHp,affixes,rank:n?'ASCENSION '+n:'LEGACY',guardian:n?chapter.guardian+' // A'+n:chapter.guardian}
}
const LEGACY_TRIAL_HISTORY_KEY='systemLegacyTrialHistory';
function legacyTrialHistory(){try{return JSON.parse(localStorage.getItem(LEGACY_TRIAL_HISTORY_KEY)||'[]')}catch(e){return[]}}
function recordLegacyTrial(c,trial,meta={}){
 const rows=legacyTrialHistory(),asc=legacyAscension(),entry={id:'trial-'+Date.now(),chapter:c.id,trial:c.trial,guardian:trial.guardian,ascension:Number(asc.cycle||0),difficulty:ascensionModifiers().label,maxHp:trial.maxHp,affixes:[...trial.affixes],attempts:Number(meta.attempts||1),totalDamage:Number(meta.totalDamage||trial.maxHp||0),armedAt:meta.armedAt||null,combatSeconds:meta.armedAt?Math.max(0,Math.round((Date.now()-new Date(meta.armedAt).getTime())/1000)):0,clearedAt:new Date().toISOString()};
 rows.push(entry);localStorage.setItem(LEGACY_TRIAL_HISTORY_KEY,JSON.stringify(rows.slice(-100)));return entry
}
function legacyTrialRecord(){
 const rows=legacyTrialHistory(),highest=rows.reduce((n,x)=>Math.max(n,Number(x.ascension||0)),0),sovereign=rows.filter(x=>x.chapter===3).length,scored=rows.filter(x=>Number.isFinite(Number(x.performanceScore))),best=scored.reduce((n,x)=>Math.max(n,Number(x.performanceScore||0)),0),withAttempts=rows.filter(x=>Number(x.attempts)>0),fewestAttempts=withAttempts.length?Math.min(...withAttempts.map(x=>Number(x.attempts))):0,withTime=rows.filter(x=>Number(x.combatSeconds)>0),fastestSeconds=withTime.length?Math.min(...withTime.map(x=>Number(x.combatSeconds))):0,avgAttempts=withAttempts.length?withAttempts.reduce((n,x)=>n+Number(x.attempts),0)/withAttempts.length:0;
 return{clears:rows.length,highestAscension:highest,sovereignClears:sovereign,bestPerformance:best,fewestAttempts,fastestSeconds,avgAttempts,recent:rows.slice(-5).reverse()}
}
function legacyTrialAchievements(){
 const rows=legacyTrialHistory(),has=p=>rows.some(p);return[
  {id:'trial_first_blood',name:'GUARDIAN BREAKER',detail:'Clear your first Legacy Trial',unlocked:rows.length>=1,kind:'TRIAL ACHIEVEMENT',mark:'Ⅰ'},
  {id:'trial_one_shot',name:'ONE-SHOT CLEAR',detail:'Defeat a Guardian in a single workout',unlocked:has(x=>Number(x.attempts)===1),kind:'TRIAL ACHIEVEMENT',mark:'1X'},
  {id:'trial_perfect',name:'PERFECT EXECUTION',detail:'Clear a Trial with a 95+ performance score and 100% completion',unlocked:has(x=>Number(x.performanceScore)>=95&&Number(x.completion)>=100),kind:'TRIAL ACHIEVEMENT',mark:'S'},
  {id:'trial_sovereign',name:'SOVEREIGN SLAYER',detail:'Clear the Sovereign Trial',unlocked:has(x=>Number(x.chapter)===3),kind:'TRIAL ACHIEVEMENT',mark:'Ⅲ'},
  {id:'trial_ascended',name:'ASCENDED GUARDIAN',detail:'Clear a Legacy Trial during Ascension 1 or higher',unlocked:has(x=>Number(x.ascension)>=1),kind:'TRIAL ACHIEVEMENT',mark:'A'},
  {id:'trial_veteran',name:'TRIAL VETERAN',detail:'Record 10 Legacy Trial clears',unlocked:rows.length>=10,kind:'TRIAL ACHIEVEMENT',mark:'X'}
 ]}
function formatTrialTime(seconds){const s=Math.max(0,Number(seconds||0));if(!s)return'--';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?h+'H '+m+'M':Math.max(1,m)+'M'}

function attachPerformanceToTrialEntry(id,performance,seconds,prs){
 const rows=legacyTrialHistory(),x=rows.find(r=>r.id===id);if(!x||!performance)return false;Object.assign(x,{performanceScore:Number(performance.score||0),performanceGrade:performance.grade||'',completion:Number(performance.completion||0),targetRate:Number(performance.targetRate||0),missionMode:performance.mode||'full',durationSeconds:Number(seconds||0),personalRecords:Number(prs?.length||0)});localStorage.setItem(LEGACY_TRIAL_HISTORY_KEY,JSON.stringify(rows.slice(-100)));return true
}
function attachPerformanceToLatestTrial(performance,seconds,prs){
 const rows=legacyTrialHistory();if(!rows.length||!performance)return false;const x=rows[rows.length-1],age=Date.now()-new Date(x.clearedAt).getTime();if(age>10*60*1000||x.performanceScore!=null)return false;
 Object.assign(x,{performanceScore:Number(performance.score||0),performanceGrade:performance.grade||'',completion:Number(performance.completion||0),targetRate:Number(performance.targetRate||0),missionMode:performance.mode||'full',durationSeconds:Number(seconds||0),personalRecords:Number(prs?.length||0)});
 localStorage.setItem(LEGACY_TRIAL_HISTORY_KEY,JSON.stringify(rows.slice(-100)));return true
}
const LEGACY_ACTIVE_TRIAL_KEY='systemLegacyActiveTrial';
function activeLegacyTrial(){try{return JSON.parse(localStorage.getItem(LEGACY_ACTIVE_TRIAL_KEY)||'null')}catch(e){return null}}
function clearActiveLegacyTrial(){localStorage.removeItem(LEGACY_ACTIVE_TRIAL_KEY)}
function legacyTrialPhase(active){
 if(!active?.trial)return null;const max=Math.max(1,Number(active.trial.maxHp||1)),hp=Math.max(0,max-Number(active.damage||0)),pct=hp/max;
 return pct<=.25?{id:3,name:'FINAL PHASE',mult:1.2,objective:'FINISH STRONG',hint:'High completion and a strong score maximize final damage.'}:pct<=.6?{id:2,name:'BREAK PHASE',mult:1.1,objective:'BREAK THE GUARD',hint:'Consistent mission execution receives increased damage.'}:{id:1,name:'OPENING PHASE',mult:1,objective:'ESTABLISH PRESSURE',hint:'Complete the mission cleanly to strip Guardian HP.'}
}
function legacyTrialCombatState(active=activeLegacyTrial()){
 if(!active?.trial)return null;const phase=legacyTrialPhase(active),max=active.trial.maxHp,hp=Math.max(0,max-Number(active.damage||0));return{...phase,hp,maxHp:max,pct:Math.round(hp/max*100),attempts:Number(active.attempts||0),lastScore:Number(active.lastScore||0),combo:Number(active.combo||0),lastAttack:active.lastAttack||'',lastSpecial:active.lastSpecial||''}
}
function legacyTrialCombo(active=activeLegacyTrial()){
 const attempts=Number(active?.attempts||0),last=Number(active?.lastScore||0),combo=Number(active?.combo||0);
 return{count:combo,mult:1+Math.min(combo,5)*.05,lastScore:last,attempts}
}
function legacyTrialAttackRating(performance,phase,combo){
 const score=Number(performance?.score||0),completion=Number(performance?.completion||0),prs=Number(performance?.personalRecords||0);
 const quality=score>=95&&completion>=100?'PERFECT STRIKE':score>=88?'CRITICAL STRIKE':score>=75?'HEAVY STRIKE':'STANDARD STRIKE';
 return{quality,critical:score>=88,mult:(score>=95?1.12:score>=88?1.07:1)*(combo?.mult||1)*(phase?.mult||1)}
}
function legacyTrialSpecial(active,performance){
 const phase=legacyTrialPhase(active),score=Number(performance?.score||0),completion=Number(performance?.completion||0),combo=Number(active?.combo||0),chapter=Number(active?.chapter||0);
 if(phase?.id===3&&score>=90&&completion>=95)return{name:'EXECUTION',mult:1.25,detail:'Final-phase precision bonus'};
 if(chapter===2&&combo>=3&&score>=82)return{name:'GUARD BREAK',mult:1.18,detail:'Command Trial combo breach'};
 if(chapter===3&&score>=88&&completion>=100)return{name:'SOVEREIGN STRIKE',mult:1.22,detail:'Perfect completion against Sovereign guardian'};
 if(score>=92)return{name:'OVERDRIVE',mult:1.12,detail:'Elite mission performance'};
 return{name:'',mult:1,detail:''}
}
function resolveActiveLegacyTrial(performance,seconds,prs){
 const active=activeLegacyTrial();if(!active||!performance)return null;
 const required=[0,65,75,85][Number(active.chapter)||0]+Math.min(Number(active.ascension||0),5)*2,trial=active.trial,c={id:active.chapter,trial:active.trialName,guardian:active.guardianBase},previous=Math.max(0,Number(active.damage||0)),phase=legacyTrialPhase(active),combo=legacyTrialCombo(active),attack=legacyTrialAttackRating(performance,phase,combo),special=legacyTrialSpecial(active,performance),missionDamage=Math.max(1,Math.round(trial.maxHp*(Number(performance.score||0)/Math.max(100,required+15))*attack.mult*special.mult)),total=Math.min(trial.maxHp,previous+missionDamage),remaining=Math.max(0,trial.maxHp-total),success=(Number(performance.score||0)>=required&&Number(performance.completion||0)>=90)||remaining===0;
 if(!success){active.damage=total;active.attempts=Number(active.attempts||0)+1;active.combo=Number(performance.score||0)>=70?Math.min(5,Number(active.combo||0)+1):0;active.lastScore=Number(performance.score||0);active.lastAttack=special.name?attack.quality+' // '+special.name:attack.quality;active.lastSpecial=special.name;localStorage.setItem(LEGACY_ACTIVE_TRIAL_KEY,JSON.stringify(active));const hit={rank:trial.rank,boss:trial.guardian,damage:missionDamage,maxHp:trial.maxHp,hp:remaining,critical:attack.critical,attackLabel:special.name||attack.quality,specialLabel:special.detail,defeated:false,encounterLabel:'LEGACY TRIAL',phaseLabel:phase.name+' // '+phase.objective+(special.name?' // '+special.name:''),resultLabel:'GUARDIAN DAMAGED'};window.SystemOS?.notify('TRIAL CONTINUES // '+remaining+' HP REMAINING','LEGACY // SCORE '+performance.score+' / '+required);setTimeout(renderLegacyMissions,350);return{success:false,required,remaining,damage:missionDamage,special:special.name,chapter:c.id,hit}}
 const wins=legacyTrialWins(),finalAttempts=Number(active.attempts||0)+1;localStorage.setItem(LEGACY_TRIAL_KEY,JSON.stringify([...new Set([...wins,c.id])]));const entry=recordLegacyTrial(c,trial,{attempts:finalAttempts,totalDamage:trial.maxHp,armedAt:active.armedAt});attachPerformanceToTrialEntry(entry.id,performance,seconds,prs);clearActiveLegacyTrial();
 const hit={rank:trial.rank,boss:trial.guardian,damage:Math.max(1,trial.maxHp-previous),maxHp:trial.maxHp,hp:0,critical:c.id===3||trial.affixes.includes('ENRAGED')||special.mult>1,attackLabel:special.name||attack.quality,defeated:true,encounterLabel:'LEGACY TRIAL',phaseLabel:'GUARDIAN DEFEATED',resultLabel:'GUARDIAN DEFEATED'};
 queueReward({title:c.id===3?'SOVEREIGN TRIAL CLEARED':'LEGACY TRIAL CLEARED',detail:c.trial+' • '+trial.guardian+' • SCORE '+performance.score+(special.name?' • '+special.name:''),amount:0,intensity:'major',source:'achievement'});
 const relic=legacyTrialRewards().find(r=>r.id==='trial_'+(c.id===1?'resolve':c.id===2?'command':'sovereign'));if(relic)setTimeout(()=>queueReward({title:'LEGACY RELIC ACQUIRED',detail:relic.name+' • '+relic.detail,amount:0,intensity:'major',source:'achievement'}),700);if(c.id===3&&legacyArtifact().unlocked)setTimeout(()=>queueReward({title:'LEGACY ARTIFACT FORGED',detail:'LEGACY NEXUS • CAMPAIGN RELICS SYNCHRONIZED',amount:0,intensity:'major',source:'achievement'}),1500);setTimeout(()=>{renderLegacyMissions();refreshIdentityUnlocks?.()},450);return{success:true,required,attempts:finalAttempts,chapter:c.id,damage:hit.damage,hit}
}
function legacyCampaign(ms){
 const wins=legacyTrialWins();let previous=true;const chapters=LEGACY_CHAPTERS.map(c=>{const missions=ms.filter(m=>m.chapter===c.id),directivesComplete=missions.every(m=>m.complete),trialCleared=wins.includes(c.id),unlocked=c.id===1||previous,modifier=ascensionModifiers(),trialCondition=c.id!==3||!modifier.mods.find(x=>x.id==='sovereign')||Number(state.currentStreak||0)>=30,trialUnlocked=unlocked&&directivesComplete&&trialCondition,complete=directivesComplete&&trialCleared,missionProgress=missions.length?missions.reduce((n,m)=>n+m.progress,0)/missions.length:0,progress=Math.min(100,missionProgress*.8+(trialCleared?20:0));previous=previous&&complete;return{...c,missions,directivesComplete,trialCleared,trialUnlocked,trialCondition,complete,unlocked,progress}});const active=chapters.find(c=>c.unlocked&&!c.complete)||chapters[chapters.length-1];return{chapters,active,complete:chapters.every(c=>c.complete)}
}
function runLegacyTrial(id){
 const x=currentHunterLegacy(),ms=legacyMissions(x),campaign=legacyCampaign(ms),c=campaign.chapters.find(z=>z.id===Number(id));if(!c?.trialUnlocked||c.trialCleared)return;
 const trial=ascensionTrialProfile(c),asc=legacyAscension();localStorage.setItem(LEGACY_ACTIVE_TRIAL_KEY,JSON.stringify({chapter:c.id,trialName:c.trial,guardianBase:c.guardian,ascension:Number(asc.cycle||0),trial,damage:0,attempts:0,combo:0,armedAt:new Date().toISOString()}));
 queueReward({title:'LEGACY TRIAL ARMED',detail:c.trial+' • COMPLETE A SYSTEM MISSION TO ENGAGE '+trial.guardian,amount:0,intensity:'major',source:'achievement'});window.SystemOS?.notify('TRIAL ARMED // COMPLETE A SYSTEM MISSION','LEGACY // '+c.trial);renderLegacyMissions()
}
function renderLegacyMissions(){
 const panel=document.getElementById('legacyMissions'),list=document.getElementById('legacyMissionList'),meta=document.getElementById('legacyMissionMeta');if(!panel||!list)return;
 const x=currentHunterLegacy(),trialRecord=legacyTrialRecord(),armed=activeLegacyTrial(),combat=legacyTrialCombatState(armed);panel.hidden=!x.active;if(!x.active)return;const ms=legacyMissions(x),campaign=legacyCampaign(ms);const asc=legacyAscension(),mods=ascensionModifiers();meta.textContent=(asc.cycle?'ASCENSION '+asc.cycle+' // '+mods.label+' // ':'')+(campaign.complete?'CAMPAIGN COMPLETE':'CHAPTER '+campaign.active.id+' // '+campaign.active.name);
 list.innerHTML=ascensionRewardPanel()+(armed&&combat?'<section class="legacy-combat-brief"><div><small>ACTIVE LEGACY ENCOUNTER</small><h3>'+escapeHtml(armed.trialName)+'</h3><b>'+escapeHtml(armed.trial.guardian)+'</b></div><div class="legacy-combat-brief__stats"><span><small>GUARDIAN HP</small><strong>'+combat.hp+' / '+combat.maxHp+'</strong></span><span><small>PHASE</small><strong>'+escapeHtml(combat.name)+'</strong></span><span><small>ATTEMPTS</small><strong>'+combat.attempts+'</strong></span><span><small>LAST SCORE</small><strong>'+(combat.lastScore||'--')+'</strong></span><span><small>COMBO</small><strong>'+(combat.combo?'x'+combat.combo:'--')+'</strong></span><span><small>LAST ATTACK</small><strong>'+escapeHtml(combat.lastAttack||'--')+'</strong></span></div><div class="legacy-combat-brief__hp"><i style="width:'+combat.pct+'%"></i></div><p><strong>'+escapeHtml(combat.objective)+'</strong> // '+escapeHtml(combat.hint)+'</p></section>':'')+(trialRecord.clears?'<div class="legacy-trial-record"><span><small>TRIAL CLEARS</small><b>'+trialRecord.clears+'</b></span><span><small>SOVEREIGN CLEARS</small><b>'+trialRecord.sovereignClears+'</b></span><span><small>HIGHEST ASCENSION</small><b>A'+trialRecord.highestAscension+'</b></span><span><small>BEST TRIAL SCORE</small><b>'+trialRecord.bestPerformance+'</b></span><span><small>FEWEST ATTEMPTS</small><b>'+(trialRecord.fewestAttempts||'--')+'</b></span><span><small>FASTEST CLEAR</small><b>'+formatTrialTime(trialRecord.fastestSeconds)+'</b></span><span><small>AVG ATTEMPTS</small><b>'+(trialRecord.avgAttempts?trialRecord.avgAttempts.toFixed(1):'--')+'</b></span></div>':'')+(mods.mods.length?'<div class="ascension-modifiers"><strong>ASCENSION CONDITIONS</strong>'+mods.mods.map(m=>'<span><b>'+escapeHtml(m.name)+'</b><small>'+escapeHtml(m.detail)+'</small></span>').join('')+'</div>':'')+'<div class="legacy-campaign-map">'+campaign.chapters.map(c=>'<section class="legacy-chapter '+(c.complete?'complete ':c.unlocked?'active ':'locked ')+'"><header><span>CHAPTER '+String(c.id).padStart(2,'0')+'</span><b>'+escapeHtml(c.name)+'</b><small>'+escapeHtml(c.subtitle)+'</small><em>'+Math.round(c.progress)+'%</em></header><div class="legacy-chapter-track"><i style="width:'+c.progress+'%"></i></div>'+c.missions.map(m=>'<article class="'+(m.complete?'complete ':'')+(m.claimed?'claimed':'')+(c.unlocked?'':' chapter-locked')+'"><div><small>LEGACY DIRECTIVE // +'+m.lp+' LP MILESTONE</small><b>'+escapeHtml(m.name)+'</b><span>'+escapeHtml(m.detail)+'</span></div><strong>'+Math.min(m.target,Number(m.value||0))+' / '+m.target+'</strong><div class="legacy-mission-track"><i style="width:'+m.progress+'%"></i></div><em>'+(m.claimed?'RECORDED':m.complete?'DIRECTIVE COMPLETE':c.unlocked?'IN PROGRESS':'CHAPTER LOCKED')+'</em></article>').join('')+(c.trialUnlocked?'<button class="legacy-trial-btn" data-legacy-trial="'+c.id+'">'+(c.trialCleared?'TRIAL CLEARED':armed?.chapter===c.id?'TRIAL ARMED // COMPLETE SYSTEM MISSION':'BEGIN '+escapeHtml(c.trial))+'<small>'+escapeHtml(ascensionTrialProfile(c).guardian)+' • '+(armed?.chapter===c.id?Math.max(0,ascensionTrialProfile(c).maxHp-Number(armed.damage||0))+' / ':'')+ascensionTrialProfile(c).maxHp+' HP'+(armed?.chapter===c.id&&armed.attempts?' • '+armed.attempts+' ATTEMPT'+(armed.attempts===1?'':'S'):'')+(armed?.chapter===c.id&&combat?' • '+combat.name:'')+(ascensionTrialProfile(c).affixes.length?' • '+ascensionTrialProfile(c).affixes.join(' / '):'')+'</small></button>':'<div class="legacy-trial-lock">FINAL TRIAL // '+(c.directivesComplete?'AWAITING PREVIOUS CHAPTER':'COMPLETE ALL CHAPTER DIRECTIVES')+(c.directivesComplete&&!c.trialCondition?' // 30-DAY STREAK REQUIRED':'')+'</div>')+(campaign.complete&&legacyArtifact().unlocked?'<button class="legacy-ascend-btn" id="legacyAscendBtn">INITIATE LEGACY ASCENSION<small>PRESERVE IDENTITY • TROPHIES • HISTORY // RESET CAMPAIGN ONLY</small></button>':'')+'</div>';
 const ascendBtn=document.getElementById('legacyAscendBtn');if(ascendBtn)ascendBtn.onclick=()=>{if(confirm('Begin a new Legacy Ascension cycle? Campaign directives and Trials reset. Identity, trophies and training history are preserved.'))ascendLegacy()};
 list.querySelectorAll('[data-legacy-trial]').forEach(b=>{b.disabled=b.textContent.includes('CLEARED');b.onclick=()=>runLegacyTrial(b.dataset.legacyTrial)});
 const claims=legacyMissionClaims(),fresh=ms.filter(m=>m.complete&&!m.claimed);if(fresh.length){localStorage.setItem(LEGACY_MISSION_KEY,JSON.stringify([...claims,...fresh.map(m=>m.id)]));fresh.forEach((m,i)=>setTimeout(()=>queueReward({title:'LEGACY DIRECTIVE COMPLETE',detail:m.name+' • +'+m.lp+' LP MILESTONE',amount:0,intensity:'major',source:'achievement'}),i*900))}
}
function legacyPanel(x){return '<section class="hunter-legacy '+(x.active?'active':'dormant')+'"><div><small>HUNTER // PERMANENT LEGACY</small><h3>'+escapeHtml(x.title)+'</h3><strong>LEGACY LV '+x.level+'</strong></div><b>'+x.score.toLocaleString()+' LP</b><div class="hunter-legacy__track"><i style="width:'+x.progress+'%"></i></div><span>'+(x.active?x.next.toLocaleString()+' LP TO NEXT LEGACY LEVEL':'REACH S-RANK OR COLLECT 2 TROPHY CLASSES TO AWAKEN')+'</span></section>'}
function ensureVaultDetail(){let e=document.getElementById('vaultRewardDetail');if(e)return e;e=document.createElement('div');e.id='vaultRewardDetail';e.className='vault-detail';e.setAttribute('aria-hidden','true');e.innerHTML='<div class="vault-detail__panel"><button class="vault-detail__close" aria-label="Close reward detail">×</button><div id="vaultDetailBody"></div></div>';document.body.appendChild(e);e.querySelector('button').onclick=()=>{e.classList.remove('active');e.setAttribute('aria-hidden','true')};return e}
function openVaultDetail(item){
 const e=ensureVaultDetail(),body=document.getElementById('vaultDetailBody'),earned=item.earnedAt?new Date(item.earnedAt).toLocaleDateString():null;
 body.innerHTML='<small>SYSTEM // REWARD ANALYSIS</small><div class="vault-detail__icon">'+(item.kind==='TROPHY'?'▲':item.unlocked?'◆':'◇')+'</div><h2>'+escapeHtml(item.name)+'</h2><strong>'+escapeHtml(item.kind||'REWARD')+(item.class?' // '+escapeHtml(item.class):'')+' // '+(item.unlocked?'ACQUIRED':'LOCKED')+'</strong><p>'+escapeHtml(item.detail||'No additional data recorded.')+'</p><div class="vault-detail__meta"><span><small>STATUS</small><b>'+(item.unlocked?'UNLOCKED':'REQUIREMENT INCOMPLETE')+'</b></span>'+(earned?'<span><small>DATE RECORDED</small><b>'+earned+'</b></span>':'')+(item.stat?'<span><small>RECORD</small><b>'+escapeHtml(item.stat)+'</b></span>':'')+'</div>'+(item.equip?'<button id="vaultEquipReward">EQUIP '+escapeHtml(item.kind)+'</button>':'');
 e.classList.add('active');e.setAttribute('aria-hidden','false');const b=document.getElementById('vaultEquipReward');if(b)b.onclick=()=>{const c=getIdentityCard();saveIdentityCard({...c,[item.kind==='FRAME'?'frame':'emblem']:item.id});b.textContent='EQUIPPED';window.SystemOS?.notify(item.name+' EQUIPPED','REWARD VAULT')}
}
async function openRewardVault(){
 const e=ensureRewardVault(),body=document.getElementById('rewardVaultBody');e.classList.add('active');e.setAttribute('aria-hidden','false');body.innerHTML='<div class="vault-loading">SYSTEM // INDEXING REWARDS</div>';
 let legacy=null,victories=[];try{const u=socialCloudUser(),community=await fetchCommunityNetwork(),m=community?.members?.find(x=>x.user_id===u?.id),sq=m&&community.squads.find(x=>x.id===m.squad_id);if(sq){victories=await fetchSquadVictories(sq.id);legacy={...squadAchievementState(victories,u.id),victories:victories.length}}}catch(e){}
 const relics=legacyTrialRewards(),artifact=legacyArtifact(),ascension=ascensionMarks(),prestige=ascensionPrestigeRewards(),ascensionHistory=ascensionHistoryRewards(),trialAchievements=legacyTrialAchievements(),trialRecord=legacyTrialRecord(),trialHistory=trialRecord.recent.map(x=>({id:x.id,name:x.trial,detail:x.guardian+' • '+x.difficulty+(x.affixes.length?' • '+x.affixes.join(' / '):'')+(x.performanceScore!=null?' • SCORE '+x.performanceScore+' • '+Math.round((x.durationSeconds||0)/60)+' MIN':' • PERFORMANCE PENDING'),unlocked:true,kind:'TRIAL CLEAR',earnedAt:x.clearedAt,stat:'A'+x.ascension+' • '+x.maxHp+' HP'+(x.personalRecords?' • '+x.personalRecords+' PR':'')})),trophies=trophyCollection(victories),hunterLegacy=hunterLegacyState(buildSocialIdentity(),trophies,legacy),identity=identityUnlockState(buildSocialIdentity(),legacy,trophies,hunterLegacy),achievements=ACHIEVEMENTS.map(x=>({id:x.id,name:x.title,detail:x.desc,unlocked:!!state.achievements?.includes?.(x.id)||!!x.requirement(state),kind:'ACHIEVEMENT'})),squad=squadAchievementCatalog(legacy||{unlocked:[]}).map(x=>({...x,kind:'SQUAD LEGACY'})),bosses=victories.slice(0,12).map(x=>({id:x.id,name:x.boss_name,detail:x.boss_tier+' Squad Gate cleared',unlocked:true,kind:'TROPHY',class:trophyClass(x.boss_tier).name,earnedAt:x.cleared_at,stat:Number(x.max_hp||0).toLocaleString()+' HP'}));
 const registry={},key=x=>{const k='v'+Object.keys(registry).length;registry[k]=x;return k},section=(title,items)=>'<section><div class="vault-head"><strong>'+title+'</strong><b>'+items.filter(x=>x.unlocked).length+' / '+items.length+' UNLOCKED</b></div><div class="vault-grid">'+items.map(x=>{const k=key(x);return '<article tabindex="0" data-vault-item="'+k+'" class="'+(x.unlocked?'unlocked':'locked')+'"><span>'+(x.unlocked?'◆':'◇')+'</span><div><b>'+escapeHtml(x.name)+'</b><small>'+escapeHtml(x.detail||x.why||'')+'</small></div><em>'+(x.unlocked?'ACQUIRED':'LOCKED')+'</em></article>'}).join('')+'</div></section>';
 const frames=identity.frames.map(x=>({...x,kind:'FRAME',detail:x.why,equip:x.unlocked})),emblems=identity.emblems.map(x=>({...x,kind:'EMBLEM',detail:x.why,equip:x.unlocked}));
 body.innerHTML=legacyPanel(hunterLegacy)+section('IDENTITY // FRAMES',frames)+section('IDENTITY // EMBLEMS',emblems)+section('HUNTER // ACHIEVEMENTS',achievements)+section('SQUAD // LEGACY',squad)+section('LEGACY // TRIAL RELICS',relics)+section('LEGACY // ARTIFACT',[artifact])+section('LEGACY // ASCENSION MARKS',ascension)+section('ASCENSION // PRESTIGE REWARDS',prestige)+section('ASCENSION // HISTORY',ascensionHistory)+section('LEGACY // TRIAL ACHIEVEMENTS',trialAchievements)+section('LEGACY // TRIAL HISTORY',trialHistory)+section('TROPHY // COLLECTION CLASSES',trophies.classes.map(x=>({...x,kind:'TROPHY CLASS'})))+section('TROPHY // SET REWARDS',trophies.sets.map(x=>({...x,kind:'COLLECTION'})))+'<section><div class="vault-head"><strong>BOSS // TROPHY ARCHIVE</strong><b>'+bosses.length+' RECORDED</b></div><div class="vault-trophies">'+(bosses.length?bosses.map(x=>{const k=key(x);return '<article tabindex="0" data-vault-item="'+k+'"><span>▲</span><div><b>'+escapeHtml(x.name)+'</b><small>'+escapeHtml(x.detail)+' • '+new Date(x.earnedAt).toLocaleDateString()+'</small></div></article>'}).join(''):'<div class="vault-empty">NO SQUAD BOSS TROPHIES RECORDED</div>')+'</div></section>';
 body.querySelectorAll('[data-vault-item]').forEach(n=>{const open=()=>openVaultDetail(registry[n.dataset.vaultItem]);n.onclick=open;n.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();open()}}})
}
function installRewardVaultButton(){const root=document.getElementById('osSocialCommand');if(!root||root.querySelector('[data-reward-vault]'))return;const shell=root.querySelector('.social-v25');if(!shell)return;const b=document.createElement('button');b.className='reward-vault-launch';b.dataset.rewardVault='1';b.innerHTML='<span>◆</span><div><b>SYSTEM REWARD VAULT</b><small>FRAMES • EMBLEMS • ACHIEVEMENTS • RAID TROPHIES</small></div><em>OPEN ARCHIVE</em>';b.onclick=openRewardVault;shell.insertBefore(b,shell.firstChild)}
function ensureSocialDossier(){let e=document.getElementById('socialDossier');if(e)return e;e=document.createElement('aside');e.id='socialDossier';e.className='social-dossier';e.setAttribute('aria-hidden','true');e.innerHTML='<button class="social-dossier__close" aria-label="Close dossier">×</button><div id="socialDossierBody"></div>';document.body.appendChild(e);e.querySelector('button').onclick=()=>{e.classList.remove('active');e.setAttribute('aria-hidden','true')};return e}
async function openPlayerDossier(userId){
 const e=ensureSocialDossier(),body=document.getElementById('socialDossierBody');body.innerHTML='<div class="social-dossier__loading">SYSTEM // RETRIEVING HUNTER DOSSIER</div>';e.classList.add('active');e.setAttribute('aria-hidden','false');
 try{const [net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);const p=net?.profiles?.find(x=>x.user_id===userId);if(!p)throw Error();const membership=community?.members?.find(m=>m.user_id===userId),squad=membership&&community.squads.find(s=>s.id===membership.squad_id),legacy=squad?(await squadLegacyMap([squad]))[squad.id]:null;
 const victories=squad?await fetchSquadVictories(squad.id):[],hunterLegacy=hunterLegacyState(p,trophyCollection(victories),legacy);body.innerHTML=renderIdentityCard(p,squad,legacy)+legacyPanel(hunterLegacy)+'<small>SYSTEM // HUNTER DOSSIER</small><h2>'+escapeHtml(p.display_name)+'</h2><div class="dossier-rank">'+escapeHtml(p.rank||'E-Rank')+' • LEVEL '+Number(p.level||1)+'</div>'+(p.title?'<div class="dossier-title">'+escapeHtml(p.title)+'</div>':'')+'<div class="dossier-grid"><span><b>'+Number(p.xp||0).toLocaleString()+'</b><small>TOTAL XP</small></span><span><b>'+Number(p.missions||0)+'</b><small>MISSIONS</small></span><span><b>'+Number(p.gates||0)+'</b><small>GATES</small></span><span><b>'+Number(p.best_score||0)+'</b><small>BEST SCORE</small></span><span><b>'+Number(p.critical_hits||0)+'</b><small>CRITICALS</small></span><span><b>'+Number(p.streak||0)+'</b><small>DAY STREAK</small></span></div><div class="dossier-squad"><small>SQUAD AFFILIATION</small><strong>'+(squad?escapeHtml(squad.name):'UNAFFILIATED')+'</strong><span>'+(squad?escapeHtml(legacy?.title||'UNPROVEN UNIT'):'NO ACTIVE UNIT')+'</span></div><div class="dossier-actions"><button data-dossier-duel="'+escapeHtml(p.display_name)+'">ISSUE DUEL</button></div>';
 body.querySelector('[data-dossier-duel]').onclick=()=>{const input=document.getElementById('challengePlayer');if(input){input.value=p.display_name;e.classList.remove('active');input.focus()}}
 }catch(err){body.innerHTML='<div class="social-dossier__loading">DOSSIER UNAVAILABLE</div>'}
}
async function openSquadDossier(squadId){
 const e=ensureSocialDossier(),body=document.getElementById('socialDossierBody');body.innerHTML='<div class="social-dossier__loading">SYSTEM // RETRIEVING UNIT DOSSIER</div>';e.classList.add('active');e.setAttribute('aria-hidden','false');
 try{const [net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]),s=community?.squads?.find(x=>x.id===squadId);if(!s)throw Error();const total=squadTotals(s.id,community.members,net.profiles),progress=squadProgress(total),victories=await fetchSquadVictories(s.id),legacy=squadAchievementState(victories,null),roster=squadMemberProfiles(s.id,community.members,net.profiles);
 body.innerHTML='<small>SYSTEM // SQUAD DOSSIER</small><h2>'+escapeHtml(s.name)+'</h2><div class="dossier-title">'+escapeHtml(legacy.title)+'</div><div class="dossier-grid"><span><b>'+progress.level+'</b><small>UNIT LEVEL</small></span><span><b>'+total.members+'</b><small>OPERATIVES</small></span><span><b>'+total.xp.toLocaleString()+'</b><small>TOTAL XP</small></span><span><b>'+victories.length+'</b><small>RAID CLEARS</small></span><span><b>'+legacy.streak+'</b><small>RAID STREAK</small></span><span><b>'+legacy.unlocked.length+'</b><small>ACHIEVEMENTS</small></span></div><div class="dossier-roster">'+roster.map((x,i)=>'<button data-dossier-player="'+x.profile.user_id+'"><b>#'+(i+1)+'</b><span>'+escapeHtml(x.profile.display_name)+'</span><small>LV '+Number(x.profile.level||1)+' • '+escapeHtml(x.profile.rank||'E-Rank')+'</small></button>').join('')+'</div>';
 body.querySelectorAll('[data-dossier-player]').forEach(b=>b.onclick=()=>openPlayerDossier(b.dataset.dossierPlayer))
 }catch(err){body.innerHTML='<div class="social-dossier__loading">DOSSIER UNAVAILABLE</div>'}
}
async function squadLegacyMap(squads){const out={};await Promise.all(squads.map(async s=>{const v=await fetchSquadVictories(s.id);out[s.id]={...squadAchievementState(v,null),victories:v.length}}));return out}
async function renderSquadCommandV29(){
 const root=document.getElementById('osSocialCommand');if(!root)return;await renderCommunityV28();installIdentityEditor();installRewardVaultButton();const u=socialCloudUser();if(!u||!document.body.contains(root))return;const [net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);if(!net||!community)return;const profiles=net.profiles||[],members=community.members||[],squads=community.squads||[],myMemberships=members.filter(m=>m.user_id===u.id),myIds=myMemberships.map(m=>m.squad_id),challenges=await fetchSquadChallenges(myIds);
 const legacy=await squadLegacyMap(squads),ranked=squads.map(s=>({s,...squadTotals(s.id,members,profiles),legacy:legacy[s.id]})).sort((a,b)=>b.xp-a.xp);const shell=root.querySelector('.social-v25');if(!shell)return;const primary=myIds.length?squads.find(s=>s.id===myIds[0]):null,primaryRoster=primary?squadMemberProfiles(primary.id,members,profiles):[],primaryTotals=primary?squadTotals(primary.id,members,profiles):null,primaryProgress=primary?squadProgress(primaryTotals):null;
 if(primary){fetchSquadGateIntel(primary,primaryTotals).then(intel=>{if(!intel||!document.body.contains(shell))return;const g=intel.gate,pct=Math.max(0,Math.min(100,Math.round(Number(g.damage||0)/Math.max(1,Number(g.max_hp||1))*100))),mvp=intel.contributors[0],ach=squadAchievementState(intel.victories,u.id),catalog=squadAchievementCatalog(ach);const card=document.createElement('section');card.className='social-card squad-gate';card.innerHTML='<div class="social-head"><span>SQUAD // WEEKLY GATE</span><b>'+(g.defeated?'CLEARED':'ACTIVE RAID')+'</b></div><div class="squad-gate-head"><div><small>'+escapeHtml(g.boss_tier)+'</small><h3>'+escapeHtml(g.boss_name)+'</h3></div><div><b>'+Math.max(0,Number(g.max_hp)-Number(g.damage)).toLocaleString()+'</b><span>HP REMAINING</span></div></div><div class="squad-gate-hp"><i style="width:'+(100-pct)+'%"></i></div><div class="squad-gate-meta"><span>'+Number(g.damage||0).toLocaleString()+' DAMAGE</span><span>'+pct+'% CLEARED</span><span>'+(mvp?'MVP // '+escapeHtml(mvp.name)+' • '+mvp.damage.toLocaleString():'NO HITS RECORDED')+'</span></div><div class="squad-contributors">'+intel.contributors.slice(0,5).map((x,i)=>'<div><b>#'+(i+1)+'</b><span>'+escapeHtml(x.name)+'</span><em>'+x.damage.toLocaleString()+' DMG</em></div>').join('')+'</div><div class="squad-victory-history"><strong>VICTORY RECORD // '+intel.victories.length+' CLEARS</strong>'+intel.victories.slice(0,3).map(v=>'<span><b>'+escapeHtml(v.boss_name)+'</b><small>'+escapeHtml(v.boss_tier)+' • MVP '+escapeHtml(v.mvp_name||'SQUAD')+'</small></span>').join('')+'</div><div class="squad-achievements"><div class="squad-achievements__head"><span><small>SQUAD // LEGACY</small><strong>'+ach.title+'</strong></span><em>'+ach.streak+' WEEK RAID STREAK • '+ach.mvp+' MVP'+(ach.mvp===1?'':'S')+'</em></div><div class="squad-achievement-grid">'+catalog.map(x=>'<article class="'+(x.unlocked?'unlocked':'locked')+'"><b>'+x.name+'</b><small>'+x.desc+'</small><span>'+(x.unlocked?'UNLOCKED':'LOCKED')+'</span></article>').join('')+'</div></div>';const before=shell.querySelector('.squad-ops');shell.insertBefore(card,before||null)});}
 if(primary)shell.insertAdjacentHTML('beforeend','<section class="social-card squad-identity"><div class="squad-identity__head"><div><small>SQUAD // ACTIVE UNIT</small><h3>'+escapeHtml(primary.name)+'</h3><div class="squad-legacy-badge">'+escapeHtml(legacy[primary.id]?.title||'UNPROVEN UNIT')+'</div><p>'+(primary.owner_id===u.id?'COMMANDER ACCESS':'MEMBER ACCESS')+' • '+primaryRoster.length+' OPERATIVES</p></div><div><b>'+squadTotals(primary.id,members,profiles).xp.toLocaleString()+'</b><span>TOTAL XP</span></div></div><div class="squad-roster">'+primaryRoster.map((x,i)=>'<article><b>#'+(i+1)+'</b><span><strong>'+escapeHtml(x.profile.display_name)+(x.profile.user_id===u.id?' // YOU':'')+'</strong><small>'+escapeHtml(x.member.role||'member').toUpperCase()+' • LV '+Number(x.profile.level||1)+' • '+escapeHtml(x.profile.rank||'E-Rank')+(x.profile.title?' • '+escapeHtml(x.profile.title):'')+'</small></span><em>'+Number(x.profile.xp||0).toLocaleString()+' XP</em></article>').join('')+'</div></section>');
 if(primaryProgress)shell.insertAdjacentHTML('beforeend','<section class="social-card squad-progression"><div class="social-head"><span>SQUAD // PROGRESSION</span><b>LV '+primaryProgress.level+' • '+primaryProgress.title+'</b></div><div class="squad-level-track"><div><strong>UNIT LEVEL '+primaryProgress.level+'</strong><small>'+primaryProgress.xp.toLocaleString()+' XP • NEXT '+primaryProgress.next.toLocaleString()+'</small></div><span><i style="width:'+primaryProgress.pct+'%"></i></span></div><div class="squad-missions">'+primaryProgress.missions.map(x=>'<article class="'+(x.complete?'complete':'')+'"><div><strong>'+x.name+'</strong><small>'+x.detail+'</small></div><b>'+Math.min(x.value,x.target).toLocaleString()+' / '+x.target.toLocaleString()+'</b><span><i style="width:'+x.pct+'%"></i></span></article>').join('')+'</div></section>');
 shell.insertAdjacentHTML('beforeend','<section class="squad-ops social-card"><div class="social-head"><span>SQUAD COMMAND // COMPETITIVE OPERATIONS</span><b>'+ranked.length+' SQUADS</b></div><div class="squad-ops-grid"><div><div class="squad-rankings">'+ranked.map((x,i)=>'<article class="'+(myIds.includes(x.s.id)?'mine':'')+'"><b>#'+(i+1)+'</b><span><strong>'+escapeHtml(x.s.name)+'</strong><small>'+x.members+' MEMBERS • AVG LV '+x.level+' • '+escapeHtml(x.legacy?.title||'UNPROVEN UNIT')+'</small></span><em>'+x.xp.toLocaleString()+' XP</em>'+(community.squads.some(s=>s.owner_id===u.id)&&!myIds.includes(x.s.id)?'<button data-squad-target="'+x.s.id+'" data-squad-name="'+escapeHtml(x.s.name)+'">CHALLENGE</button>':'')+'</article>').join('')+'</div></div><div class="squad-battles"><h4>GROUP OPERATIONS</h4>'+(challenges.length?challenges.map(x=>{const mine=x.challenger_squad_id;const a=squadTotals(x.challenger_squad_id,members,profiles),b=squadTotals(x.opponent_squad_id,members,profiles),metric=x.type==='workouts'?'workouts':'xp',as=Math.max(0,a[metric]-Number(x.challenger_start||0)),bs=Math.max(0,b[metric]-Number(x.opponent_start||0)),incoming=community.squads.some(s=>s.id===x.opponent_squad_id&&s.owner_id===u.id);return '<article class="squad-battle"><strong>'+escapeHtml(x.challenger_name)+' <i>VS</i> '+escapeHtml(x.opponent_name)+'</strong><small>'+escapeHtml(legacy[x.challenger_squad_id]?.title||'UNPROVEN UNIT')+' VS '+escapeHtml(legacy[x.opponent_squad_id]?.title||'UNPROVEN UNIT')+' • '+challengeLabel(x.type)+' • '+x.duration_days+' DAY • '+x.status.toUpperCase()+'</small>'+(x.status==='active'?'<div><b>'+as.toLocaleString()+'</b><span>LIVE</span><b>'+bs.toLocaleString()+'</b></div>':x.status==='pending'&&incoming?'<div class="squad-response"><button data-squad-accept="'+x.id+'">ACCEPT</button><button data-squad-decline="'+x.id+'">DECLINE</button></div>':'')+'</article>'}).join(''):'<div class="social-empty">NO SQUAD OPERATIONS ACTIVE</div>')+'</div></div><form id="squadChallengeForm" class="squad-challenge-form" hidden><strong id="squadTargetLabel">CHALLENGE SQUAD</strong><input id="squadTargetId" type="hidden"><select id="squadChallengeType"><option value="xp">Squad XP</option><option value="workouts">Mission Count</option></select><select id="squadChallengeDays"><option value="1">24 Hours</option><option value="3">3 Days</option><option value="7">7 Days</option></select><button>TRANSMIT CHALLENGE</button></form></section>');
 root.querySelectorAll('[data-squad-target]').forEach(b=>b.onclick=()=>{const f=document.getElementById('squadChallengeForm');f.hidden=false;document.getElementById('squadTargetId').value=b.dataset.squadTarget;document.getElementById('squadTargetLabel').textContent='TARGET // '+b.dataset.squadName.toUpperCase()});document.getElementById('squadChallengeForm').onsubmit=e=>{e.preventDefault();squadChallenge(document.getElementById('squadTargetId').value,document.getElementById('squadChallengeType').value,document.getElementById('squadChallengeDays').value)};root.querySelectorAll('[data-squad-accept]').forEach(b=>b.onclick=()=>respondSquadChallenge(b.dataset.squadAccept,true));root.querySelectorAll('[data-squad-decline]').forEach(b=>b.onclick=()=>respondSquadChallenge(b.dataset.squadDecline,false));
}
renderSocialCommand=renderSquadCommandV29;


/* ===== V30 SYSTEM ALERT CENTER ===== */
const SYSTEM_NOTIFICATION_TABLE='system_notifications';
function localAlerts(){try{return JSON.parse(localStorage.getItem('systemAlertsV30')||'[]')}catch(e){return[]}}
function saveLocalAlerts(a){localStorage.setItem('systemAlertsV30',JSON.stringify(a.slice(0,100)))}
async function systemAlert(type,title,body='',sourceId='',module='social',targetUserId=null){
 const u=socialCloudUser(),id=targetUserId||u?.id;if(id){try{await cloudRequest('/rest/v1/'+SYSTEM_NOTIFICATION_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:id,type,title,body,source_id:String(sourceId||''),action_module:module})});return}catch(e){}}
 const a=localAlerts();a.unshift({id:'local-'+Date.now(),type,title,body,source_id:sourceId,action_module:module,created_at:new Date().toISOString(),read_at:null});saveLocalAlerts(a)
}
async function fetchSystemAlerts(){const u=socialCloudUser();if(!u)return localAlerts();try{return await cloudRequest('/rest/v1/'+SYSTEM_NOTIFICATION_TABLE+'?user_id=eq.'+encodeURIComponent(u.id)+'&select=*&order=created_at.desc&limit=100')}catch(e){return localAlerts()}}
async function markAlert(id,all=false){const u=socialCloudUser(),now=new Date().toISOString();if(u&&!String(id).startsWith('local-')){await cloudRequest('/rest/v1/'+SYSTEM_NOTIFICATION_TABLE+(all?'?user_id=eq.'+encodeURIComponent(u.id)+'&read_at=is.null':'?id=eq.'+encodeURIComponent(id)),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({read_at:now})})}else{const a=localAlerts().map(x=>(all||x.id===id)?{...x,read_at:now}:x);saveLocalAlerts(a)}renderAlertCenter()}
function ensureAlertCenter(){if(document.getElementById('systemAlertCenter'))return;const e=document.createElement('aside');e.id='systemAlertCenter';e.className='system-alert-center';e.setAttribute('aria-hidden','true');e.innerHTML='<header><div><small>SYSTEM // COMMUNICATIONS</small><h2>ALERT CENTER</h2></div><button id="alertCenterClose">×</button></header><div class="alert-tools"><span id="alertCount">0 UNREAD</span><button id="alertReadAll">MARK ALL READ</button></div><div id="alertFeed" class="alert-feed"></div>';document.body.appendChild(e);document.getElementById('alertCenterClose').onclick=()=>{e.classList.remove('active');e.setAttribute('aria-hidden','true')};document.getElementById('alertReadAll').onclick=()=>markAlert('',true)}
async function renderAlertCenter(){ensureAlertCenter();const a=await fetchSystemAlerts(),feed=document.getElementById('alertFeed'),unread=a.filter(x=>!x.read_at).length;document.getElementById('alertCount').textContent=unread+' UNREAD';document.querySelectorAll('.system-alert-badge').forEach(b=>{b.textContent=unread;b.hidden=!unread});feed.innerHTML=a.length?a.map(x=>'<article class="system-alert '+(!x.read_at?'unread':'')+'" data-alert-id="'+x.id+'" data-alert-module="'+escapeHtml(x.action_module||'social')+'"><i>'+({friend:'◎',duel:'⚔',squad:'◆',boss:'⚠',progress:'★',system:'◇'}[x.type]||'◇')+'</i><span><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(x.body||'')+'</p><small>'+new Date(x.created_at).toLocaleString()+'</small></span><b>›</b></article>').join(''):'<div class="social-empty">NO SYSTEM ALERTS</div>';feed.querySelectorAll('[data-alert-id]').forEach(x=>x.onclick=async()=>{await markAlert(x.dataset.alertId);document.getElementById('systemAlertCenter').classList.remove('active');window.SystemOS?.open(x.dataset.alertModule||'social')})}
async function openAlertCenter(){ensureAlertCenter();await renderAlertCenter();const e=document.getElementById('systemAlertCenter');e.classList.add('active');e.setAttribute('aria-hidden','false')}
function installAlertButton(){ensureAlertCenter();const deck=document.getElementById('commandDeck'),dock=deck?.querySelector('.os-dock');if(!dock||document.getElementById('systemAlertBtn'))return;const b=document.createElement('button');b.id='systemAlertBtn';b.className='system-alert-btn';b.innerHTML='<b>◉</b><span>ALERTS</span><i class="system-alert-badge" hidden>0</i>';b.onclick=openAlertCenter;dock.appendChild(b);renderAlertCenter()}
document.addEventListener('DOMContentLoaded',()=>{installAlertButton();setInterval(()=>{if(socialCloudUser())renderAlertCenter()},60000)});
const _v30Friend=sendFriendRequest;sendFriendRequest=async function(userId,name){await _v30Friend(userId,name);await systemAlert('friend','FRIEND LINK REQUEST',socialHandle()+' wants to connect.',userId,'social',userId)};
const _v30Challenge=squadChallenge;squadChallenge=async function(id,type,days){const c=await fetchCommunityNetwork(),target=c?.squads.find(s=>s.id===id),owner=target?.owner_id;await _v30Challenge(id,type,days);if(owner)await systemAlert('squad','SQUAD CHALLENGE INCOMING',socialHandle()+' issued a '+challengeLabel(type)+' squad challenge.',id,'social',owner)};
const _v30Duel=respondToChallenge;respondToChallenge=async function(id,accept){const rows=await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(id)+'&select=*'),x=rows[0];await _v30Duel(id,accept);if(x&&accept)await systemAlert('duel','DUEL ACCEPTED',socialHandle()+' accepted your challenge.',id,'social',x.challenger_id)};


/* ===== V31 HARDENING // INTEGRATION FIXES ===== */
// Keep OS taskbar synchronized even when the module's native close control is used.
document.addEventListener('DOMContentLoaded',()=>{const close=document.getElementById('osModuleClose'),task=document.getElementById('osTaskCurrent');if(close&&task)close.addEventListener('click',()=>{task.innerHTML='<b>◇</b><span>CENTRAL COMMAND</span>';task.closest('.os-taskbar')?.classList.remove('has-task')})});

// Daily quests are not training days. Weekly training-day credit comes from completed workouts.
function creditWeeklyTrainingDay(){
 const g=state.weeklyGoals.find(x=>x.id==='w_days');if(!g||g.completed)return;
 const key='weeklyTrainingCredit:'+getTodayStr();if(localStorage.getItem(key))return;
 localStorage.setItem(key,'1');g.progress++;if(g.progress>=g.target){g.completed=true;state.weeklyCompleted++;addSystemMessage('Weekly Objective Complete: '+g.title+' — +'+g.xpReward+' XP','achievement');addXp(g.xpReward,'weekly');checkAllWeeklyComplete()}
}
function creditWeeklyWorkout(){
 const g=state.weeklyGoals.find(x=>x.id==='w_workouts');if(!g||g.completed)return;
 const key='weeklyWorkoutCredit:'+systemMissionKey();if(localStorage.getItem(key))return;
 localStorage.setItem(key,'1');g.progress++;if(g.progress>=g.target){g.completed=true;state.weeklyCompleted++;addSystemMessage('Weekly Objective Complete: '+g.title+' — +'+g.xpReward+' XP','achievement');addXp(g.xpReward,'weekly');checkAllWeeklyComplete()}
}
const _v31FinishWorkout=finishWorkout;finishWorkout=function(){creditWeeklyTrainingDay();creditWeeklyWorkout();return _v31FinishWorkout()};

// Mission briefing remains attached after Mission Control rerenders.
const _v31RenderMission=renderSystemMission;renderSystemMission=function(){_v31RenderMission();const b=document.getElementById('start-mission-btn');if(b&&!b.disabled&&typeof initMissionControlV22==='function'){const prior=b.onclick;b.onclick=null;setTimeout(()=>initMissionControlV22(),0)}};

// Cross-user notifications are emitted by Supabase triggers. Avoid duplicate/failed client inserts.
sendFriendRequest=async function(userId,name){const u=socialCloudUser();if(!u?.id||userId===u.id)return;try{await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({requester_id:u.id,addressee_id:userId,requester_name:socialHandle(),addressee_name:name,status:'pending'})});window.SystemOS?.notify?.('FRIEND REQUEST SENT // '+name.toUpperCase(),'SOCIAL // FRIEND LINK');renderSocialCommand()}catch(e){window.SystemOS?.notify?.((e.message||'FRIEND LINK FAILED').toUpperCase(),'SOCIAL // NETWORK')}}
const _v31RespondDuel=respondToChallenge;respondToChallenge=async function(id,accept){return _v31RespondDuel(id,accept)};
const _v31SquadChallenge=squadChallenge;squadChallenge=async function(id,type,days){return _v31SquadChallenge(id,type,days)};

// Diagnostic self-check for the major runtime integrations.
window.SystemDiagnostics=async function(){
 const checks=[
  ['OS',!!window.SystemOS?.open],
  ['Mission Control',!!document.getElementById('start-mission-btn')],
  ['Workout HUD',!!document.getElementById('workoutMode')],
  ['Progression',!!window.SystemProgression?.show],
  ['Alert Center',!!document.getElementById('systemAlertCenter')],
  ['Cloud Session',!!socialCloudUser()]
 ];let cloud=false;try{if(socialCloudUser()){await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?select=user_id&limit=1');cloud=true}}catch(e){}
 checks.push(['Social Cloud',cloud]);return checks.map(([name,ok])=>({name,ok}))
};


/* ===== V33 SESSION + SOCIAL LIFECYCLE HARDENING ===== */
let cloudRefreshPromise=null;
function cloudSessionExpired(s=getCloudSession()){if(!s?.access_token)return true;const exp=Number(s.expires_at||0);if(exp)return Date.now()>=exp*1000-60000;try{const p=JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Date.now()>=Number(p.exp||0)*1000-60000}catch(e){return false}}
async function refreshCloudSession(){
 const s=getCloudSession();if(!s?.refresh_token)throw new Error('Session expired. Sign in again.');
 if(cloudRefreshPromise)return cloudRefreshPromise;
 cloudRefreshPromise=(async()=>{const r=await fetch(SYSTEM_CLOUD.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SYSTEM_CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.msg||data.message||data.error_description||'Session expired. Sign in again.');localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(data));return data})().finally(()=>cloudRefreshPromise=null);return cloudRefreshPromise
}
const _v33CloudRequest=cloudRequest;
cloudRequest=async function(path,opts={}){
 const authPath=path.startsWith('/auth/v1/');
 let s=getCloudSession();if(!authPath&&s?.refresh_token&&cloudSessionExpired(s)){try{await refreshCloudSession()}catch(e){localStorage.removeItem(CLOUD_SESSION_KEY);showAuthGate();throw e}}
 try{return await _v33CloudRequest(path,opts)}catch(e){
  const msg=String(e.message||'');s=getCloudSession();
  if(!authPath&&s?.refresh_token&&/jwt|token|expired|unauthorized|401/i.test(msg)){try{await refreshCloudSession();return await _v33CloudRequest(path,opts)}catch(x){localStorage.removeItem(CLOUD_SESSION_KEY);showAuthGate();throw x}}
  throw e
 }
};
async function validateCloudSession(){
 const s=getCloudSession();if(!s?.access_token)return false;
 try{if(cloudSessionExpired(s)&&s.refresh_token)await refreshCloudSession();await _v33CloudRequest('/auth/v1/user');return true}catch(e){localStorage.removeItem(CLOUD_SESSION_KEY);showAuthGate();renderCloudAccount();return false}
}
document.addEventListener('DOMContentLoaded',()=>{if(getCloudSession()?.access_token)validateCloudSession()});

// Canonical multiplayer "missions" metric is completed workout sessions, not daily quest cards.
function socialMissionCount(){return workoutHistory().length}
const _v33SyncSocialProfile=syncSocialProfile;
syncSocialProfile=async function(){
 const u=socialCloudUser();if(!u?.id)return false;const rank=getRank(state.level);
 await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:u.id,display_name:socialHandle(),xp:socialScore(),level:state.level,rank:rank.name,missions:socialMissionCount(),streak:Number(state.currentStreak||0),updated_at:new Date().toISOString()})});return true
};

// Keep cloud competitive stats fresh immediately after a workout instead of waiting for Social Command to open.
const _v33FinishWorkout=finishWorkout;
finishWorkout=function(){const result=_v33FinishWorkout();if(socialCloudUser()?.id)setTimeout(()=>syncSocialProfile().catch(()=>{}),250);return result};


/* ===== V34 SOCIAL LIFECYCLE INTEGRITY ===== */
function pairMatch(a,b,u,v){return (a===u&&b===v)||(a===v&&b===u)}
async function existingFriendLink(otherId){
 const u=socialCloudUser();if(!u?.id)return null;const rows=await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE+'?or=(and(requester_id.eq.'+encodeURIComponent(u.id)+',addressee_id.eq.'+encodeURIComponent(otherId)+'),and(requester_id.eq.'+encodeURIComponent(otherId)+',addressee_id.eq.'+encodeURIComponent(u.id)+'))&select=*&order=created_at.desc&limit=1');return rows[0]||null
}
sendFriendRequest=async function(userId,name){
 const u=socialCloudUser();if(!u?.id||userId===u.id)return;
 try{const old=await existingFriendLink(userId);if(old&&['pending','accepted'].includes(old.status)){window.SystemOS?.notify(old.status==='accepted'?'FRIEND LINK ALREADY ACTIVE':'FRIEND REQUEST ALREADY PENDING','SOCIAL // FRIEND LINK');return}
 await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({requester_id:u.id,addressee_id:userId,requester_name:socialHandle(),addressee_name:name,status:'pending'})});window.SystemOS?.notify('FRIEND REQUEST SENT // '+name.toUpperCase(),'SOCIAL // FRIEND LINK');renderSocialCommand()}catch(e){window.SystemOS?.notify((e.message||'FRIEND LINK FAILED').toUpperCase(),'SOCIAL // NETWORK')}
};
const _v34RenderSocialCloud=renderSocialCloud;
renderSocialCloud=async function(){
 await _v34RenderSocialCloud();const u=socialCloudUser(),form=document.getElementById('challengeForm');if(!u?.id||!form)return;
 form.onsubmit=async e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;try{
  const matches=await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?display_name=ilike.'+encodeURIComponent(name)+'&select=user_id,display_name&limit=1');if(!matches.length)throw new Error('Player not found on the network.');const opp=matches[0];if(opp.user_id===u.id)throw new Error('You cannot challenge yourself.');
  const pending=await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?or=(and(challenger_id.eq.'+encodeURIComponent(u.id)+',opponent_id.eq.'+encodeURIComponent(opp.user_id)+'),and(challenger_id.eq.'+encodeURIComponent(opp.user_id)+',opponent_id.eq.'+encodeURIComponent(u.id)+'))&status=in.(pending,active)&select=id,status&limit=1');if(pending.length)throw new Error('A duel with this player is already pending or active.');
  const type=document.getElementById('challengeType').value,days=Number(document.getElementById('challengeLength').value);await syncSocialProfile();await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({challenger_id:u.id,opponent_id:opp.user_id,challenger_name:socialHandle(),opponent_name:opp.display_name,type,duration_days:days,status:'pending',challenger_start:challengeMetric(type),opponent_start:0,created_at:new Date().toISOString()})});window.SystemOS?.notify('CHALLENGE TRANSMITTED // '+opp.display_name.toUpperCase(),'SOCIAL // NETWORK');renderSocialCommand()
 }catch(err){window.SystemOS?.notify(String(err.message||'DUEL FAILED').toUpperCase(),'SOCIAL // NETWORK ERROR')}}
};
async function finalizeExpiredDuels(challenges){
 const expired=(challenges||[]).filter(x=>x.status==='active'&&Date.now()>=duelEndsAt(x));if(!expired.length)return false;
 await Promise.all(expired.map(x=>patchChallenge(x.id,{status:'completed'}).catch(()=>null)));return true
}
const _v34FetchSocial=fetchSocialNetwork;
fetchSocialNetwork=async function(){let net=await _v34FetchSocial();if(net&&await finalizeExpiredDuels(net.challenges)){net=await _v34FetchSocial()}return net};

const _v34JoinSquad=joinSquad;
joinSquad=async function(id){const u=socialCloudUser();if(!u?.id)return;const c=await fetchCommunityNetwork();if(c?.members.some(m=>m.squad_id===id&&m.user_id===u.id)){window.SystemOS?.notify('SQUAD LINK ALREADY ACTIVE','SOCIAL // SQUAD');return}return _v34JoinSquad(id)};
const _v34SquadChallenge=squadChallenge;
squadChallenge=async function(id,type,days){const u=socialCloudUser(),c=await fetchCommunityNetwork();if(!u||!c)return;const mine=c.squads.find(s=>s.owner_id===u.id);if(!mine||mine.id===id)return;const existing=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE+'?or=(and(challenger_squad_id.eq.'+encodeURIComponent(mine.id)+',opponent_squad_id.eq.'+encodeURIComponent(id)+'),and(challenger_squad_id.eq.'+encodeURIComponent(id)+',opponent_squad_id.eq.'+encodeURIComponent(mine.id)+'))&status=in.(pending,active)&select=id&limit=1');if(existing.length){window.SystemOS?.notify('SQUAD OPERATION ALREADY PENDING OR ACTIVE','SOCIAL // SQUAD OPS');return}return _v34SquadChallenge(id,type,days)};


/* ===== V35 COMPETITIVE SCORING + FINAL RESULTS ===== */
challengeMetric=function(type){if(type==='workouts')return socialMissionCount();if(type==='streak')return Number(state?.currentStreak||0);return socialScore()};

async function finalizeExpiredDuels(challenges){
 const expired=(challenges||[]).filter(x=>x.status==='active'&&Date.now()>=duelEndsAt(x));if(!expired.length)return false;
 const profiles=await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?select=user_id,xp,missions,streak');
 for(const x of expired){const a=profiles.find(p=>p.user_id===x.challenger_id)||{},b=profiles.find(p=>p.user_id===x.opponent_id)||{},as=duelDelta(duelProfileMetric(a,x.type),x.challenger_start),bs=duelDelta(duelProfileMetric(b,x.type),x.opponent_start),result=as===bs?'draw':as>bs?'challenger':'opponent';await patchChallenge(x.id,{status:'completed',challenger_final:as,opponent_final:bs,result,completed_at:new Date().toISOString()})}
 return true
}
const _v35LiveDuelCard=liveDuelCard;
liveDuelCard=function(x,profiles,u){
 if(x.status!=='completed'||x.challenger_final==null||x.opponent_final==null)return _v35LiveDuelCard(x,profiles,u);
 const mine=x.challenger_id===u.id,otherName=mine?x.opponent_name:x.challenger_name,myScore=Number(mine?x.challenger_final:x.opponent_final),theirScore=Number(mine?x.opponent_final:x.challenger_final),total=Math.max(1,myScore+theirScore),pct=Math.round(myScore/total*100),result=myScore===theirScore?'DRAW':myScore>theirScore?'VICTORY':'DEFEAT';
 return '<article class="challenge-item duel-item live-duel duel-finished"><div class="duel-versus"><span>YOU</span><b>VS</b><span>'+escapeHtml(otherName)+'</span></div><div class="duel-meta"><strong>'+challengeLabel(x.type)+' // '+result+'</strong><small>FINAL SCORE // LOCKED</small></div><div class="duel-score"><b>'+myScore.toLocaleString()+'</b><div><i style="width:'+pct+'%"></i></div><b>'+theirScore.toLocaleString()+'</b></div></article>'
};
async function finalizeExpiredSquadChallenges(challenges,members,profiles){
 const now=Date.now(),expired=(challenges||[]).filter(x=>x.status==='active'&&now>=new Date(x.accepted_at||x.created_at).getTime()+(Number(x.duration_days)||1)*86400000);if(!expired.length)return false;
 for(const x of expired){const a=squadTotals(x.challenger_squad_id,members,profiles),b=squadTotals(x.opponent_squad_id,members,profiles),metric=x.type==='workouts'?'workouts':'xp',as=Math.max(0,a[metric]-Number(x.challenger_start||0)),bs=Math.max(0,b[metric]-Number(x.opponent_start||0)),result=as===bs?'draw':as>bs?'challenger':'opponent';await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_CHALLENGE_TABLE+'?id=eq.'+encodeURIComponent(x.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'completed',challenger_final:as,opponent_final:bs,result,completed_at:new Date().toISOString()})})}
 return true
}
const _v35FetchSquad=fetchSquadChallenges;
fetchSquadChallenges=async function(ids){let rows=await _v35FetchSquad(ids);if(!rows.length)return rows;try{const [net,c]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);if(net&&c&&await finalizeExpiredSquadChallenges(rows,c.members,net.profiles))rows=await _v35FetchSquad(ids)}catch(e){}return rows};

// Result alerts are local/account-specific and emitted once when completed results are observed.
function competitiveResultAlerts(duels=[],squads=[]){
 const u=socialCloudUser();if(!u?.id)return;const seenKey='competitiveResultsSeen:'+u.id,seen=new Set(JSON.parse(localStorage.getItem(seenKey)||'[]'));
 for(const x of duels.filter(x=>x.status==='completed'&&!seen.has('d:'+x.id))){const mine=x.challenger_id===u.id,win=x.result==='draw'?'DRAW':(x.result==='challenger')===mine?'VICTORY':'DEFEAT';systemAlert('duel','DUEL '+win,challengeLabel(x.type)+' // FINAL '+Number(mine?x.challenger_final:x.opponent_final||0)+' - '+Number(mine?x.opponent_final:x.challenger_final||0),x.id,'social');seen.add('d:'+x.id)}
 for(const x of squads.filter(x=>x.status==='completed'&&!seen.has('s:'+x.id))){systemAlert('squad','SQUAD OPERATION COMPLETE',escapeHtml(x.challenger_name)+' '+Number(x.challenger_final||0)+' - '+Number(x.opponent_final||0)+' '+escapeHtml(x.opponent_name),x.id,'social');seen.add('s:'+x.id)}
 localStorage.setItem(seenKey,JSON.stringify([...seen].slice(-200)))
}


/* ===== V36 COMBAT RECORD // COMPETITIVE HISTORY ===== */
function combatDate(x){const d=x.completed_at||x.created_at;try{return new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}catch(e){return 'ARCHIVED'}}
function duelHistoryRow(x,u){
 const mine=x.challenger_id===u.id,other=mine?x.opponent_name:x.challenger_name,my=Number(mine?x.challenger_final:x.opponent_final)||0,their=Number(mine?x.opponent_final:x.challenger_final)||0,result=my===their?'DRAW':my>their?'VICTORY':'DEFEAT';
 return '<article class="combat-record-row '+result.toLowerCase()+'"><i>⚔</i><span><strong>'+escapeHtml(other)+'</strong><small>'+challengeLabel(x.type)+' • '+combatDate(x)+'</small></span><b>'+result+'</b><em>'+my.toLocaleString()+' - '+their.toLocaleString()+'</em></article>'
}
function squadHistoryRow(x,myIds){
 const mineA=myIds.includes(x.challenger_squad_id),mineB=myIds.includes(x.opponent_squad_id),my=Number(mineA?x.challenger_final:x.opponent_final)||0,their=Number(mineA?x.opponent_final:x.challenger_final)||0,other=mineA?x.opponent_name:x.challenger_name,result=my===their?'DRAW':my>their?'VICTORY':'DEFEAT';
 return '<article class="combat-record-row squad '+result.toLowerCase()+'"><i>◆</i><span><strong>'+escapeHtml(other)+'</strong><small>SQUAD '+challengeLabel(x.type)+' • '+combatDate(x)+'</small></span><b>'+result+'</b><em>'+my.toLocaleString()+' - '+their.toLocaleString()+'</em></article>'
}
async function renderCombatRecordV36(){
 const root=document.getElementById('osSocialCommand'),u=socialCloudUser();if(!root||!u?.id)return;
 const [net,c]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);if(!net||!c)return;
 const myIds=c.members.filter(m=>m.user_id===u.id).map(m=>m.squad_id),squadRows=await fetchSquadChallenges(myIds),duels=(net.challenges||[]).filter(x=>x.status==='completed'&&x.challenger_final!=null&&x.opponent_final!=null),squads=(squadRows||[]).filter(x=>x.status==='completed'&&x.challenger_final!=null&&x.opponent_final!=null);
 competitiveResultAlerts(duels,squads);
 const old=root.querySelector('.combat-record');if(old)old.remove();
 const shell=root.querySelector('.social-v25');if(!shell)return;
 const all=[...duels.map(x=>({kind:'duel',x,t:new Date(x.completed_at||x.created_at).getTime()})),...squads.map(x=>({kind:'squad',x,t:new Date(x.completed_at||x.created_at).getTime()}))].sort((a,b)=>b.t-a.t);
 const wins=all.filter(r=>{if(r.kind==='duel'){const mine=r.x.challenger_id===u.id,a=Number(mine?r.x.challenger_final:r.x.opponent_final),b=Number(mine?r.x.opponent_final:r.x.challenger_final);return a>b}const mine=myIds.includes(r.x.challenger_squad_id),a=Number(mine?r.x.challenger_final:r.x.opponent_final),b=Number(mine?r.x.opponent_final:r.x.challenger_final);return a>b}).length;
 shell.insertAdjacentHTML('beforeend','<section class="combat-record social-card"><div class="social-head"><span>COMBAT RECORD // ARCHIVE</span><b>'+wins+' W // '+(all.length-wins)+' OTHER</b></div><div class="combat-record-tabs"><button class="active" data-record-filter="all">ALL</button><button data-record-filter="duel">DUELS</button><button data-record-filter="squad">SQUAD OPS</button></div><div id="combatRecordFeed" class="combat-record-feed">'+(all.length?all.map(r=>'<div data-record-kind="'+r.kind+'">'+(r.kind==='duel'?duelHistoryRow(r.x,u):squadHistoryRow(r.x,myIds))+'</div>').join(''):'<div class="social-empty">NO COMPLETED OPERATIONS // RECORD EMPTY</div>')+'</div></section>');
 root.querySelectorAll('[data-record-filter]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-record-filter]').forEach(x=>x.classList.toggle('active',x===b));root.querySelectorAll('[data-record-kind]').forEach(x=>x.hidden=b.dataset.recordFilter!=='all'&&x.dataset.recordKind!==b.dataset.recordFilter)})
}
const _v36RenderSocial=renderSocialCommand;
renderSocialCommand=async function(){await _v36RenderSocial();await renderCombatRecordV36()};


/* ===== V37 HEALTH CONNECT TELEMETRY ===== */
const HEALTH_TELEMETRY_KEY='systemHealthTelemetryV37';
function healthTelemetry(){try{return JSON.parse(localStorage.getItem(HEALTH_TELEMETRY_KEY)||'{}')}catch(e){return{}}}
function saveHealthTelemetry(v){const x={...healthTelemetry(),...v,syncedAt:new Date().toISOString()};localStorage.setItem(HEALTH_TELEMETRY_KEY,JSON.stringify(x));return x}
function renderHealthTelemetry(v=healthTelemetry()){
 const linked=v.status==='connected',steps=Number(v.steps||0),hs=document.getElementById('hudSteps'),ha=document.getElementById('hudActive');if(hs)hs.textContent=linked?steps.toLocaleString():'--';if(ha)ha.textContent=linked&&v.activeMinutes!=null?Number(v.activeMinutes)+' MIN':'--';
 const host=document.getElementById('exerciseTracker');if(!host)return;let root=document.getElementById('healthConnectPanel');if(!root){root=document.createElement('section');root.id='healthConnectPanel';root.className='health-connect-panel';host.prepend(root)}
 const native=!!window.AndroidHealthConnect;root.innerHTML='<div class="health-connect-head"><span>HEALTH CONNECT // ANDROID</span><b class="'+(linked?'online':'standby')+'">'+(linked?'LINK ONLINE':native?'LINK READY':'NATIVE LINK REQUIRED')+'</b></div><div class="health-connect-grid"><article><small>STEPS TODAY</small><strong>'+steps.toLocaleString()+'</strong></article><article><small>ACTIVE TIME</small><strong>'+(v.activeMinutes==null?'--':Number(v.activeMinutes)+' MIN')+'</strong></article><article><small>LAST SYNC</small><strong>'+(v.syncedAt?new Date(v.syncedAt).toLocaleTimeString():'--')+'</strong></article></div><button id="healthConnectAction" '+(!native?'disabled':'')+'>'+(linked?'SYNC HEALTH DATA':'CONNECT HEALTH CONNECT')+'</button>';
 document.getElementById('healthConnectAction')?.addEventListener('click',syncHealthConnect)
}
async function syncHealthConnect(){
 const h=window.AndroidHealthConnect;if(!h){renderHealthTelemetry({status:'native-required'});return}
 try{let v=healthTelemetry();if(v.status!=='connected'){const ok=await h.requestStepPermission();if(!ok){renderHealthTelemetry(saveHealthTelemetry({status:'permission-denied'}));return}}
 const r=await h.getTodaySteps(),steps=Number(r?.steps??r?.value??r??0);renderHealthTelemetry(saveHealthTelemetry({status:'connected',steps}))}catch(e){renderHealthTelemetry(saveHealthTelemetry({status:'error'}))}
}
document.addEventListener('DOMContentLoaded',()=>{renderHealthTelemetry();if(window.AndroidHealthConnect&&healthTelemetry().status==='connected')syncHealthConnect()});
window.addEventListener('focus',()=>{if(window.AndroidHealthConnect&&healthTelemetry().status==='connected')syncHealthConnect()});


/* ===== V40 TRUE 3D PLANETARY ORBIT CONTROLLER ===== */
function initPlanetaryCommandOrbit(){
 const core=document.querySelector('.system-core'),menu=core?.querySelector('.core-orbit-menu');
 if(!core||!menu||menu.dataset.planetaryReady==='1')return;
 menu.dataset.planetaryReady='1';
 const nodes=[...menu.querySelectorAll('button[data-holo]')];
 if(!nodes.length)return;
 // Separate stacking planes let modules genuinely pass behind AND in front of the core.
 const backPlane=menu;
 let frontPlane=core.querySelector('.core-orbit-front');
 if(!frontPlane){frontPlane=document.createElement('div');frontPlane.className='core-orbit-menu core-orbit-front';frontPlane.setAttribute('aria-hidden','true');core.appendChild(frontPlane)}
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let phase=-Math.PI/2,last=performance.now(),raf=0,paused=false;
 let dragging=false,dragPointer=null,dragLastX=0,dragLastT=0,velocity=0,resumeTimer=0;
 const speed=(Math.PI*2)/18;
 const dragSensitivity=.0105;
 function render(){
  const rect=core.getBoundingClientRect();
  const rx=Math.max(rect.width*.50,145),ry=Math.max(rect.height*.20,50);
  nodes.forEach((node,i)=>{
   const a=phase+i*(Math.PI*2/nodes.length);
   const x=Math.cos(a)*rx;
   const depth=Math.sin(a);
   const y=depth*ry;
   const t=(depth+1)/2;
   const scale=.54+t*.68;
   const opacity=.28+t*.72;
   node.style.setProperty('--orbit-x',x.toFixed(1)+'px');
   node.style.setProperty('--orbit-y',y.toFixed(1)+'px');
   node.style.setProperty('--orbit-depth',(depth*190).toFixed(1)+'px');
   node.style.setProperty('--orbit-scale',scale.toFixed(3));
   node.style.setProperty('--orbit-opacity',opacity.toFixed(3));
   node.style.setProperty('--orbit-glow',(.04+t*.38).toFixed(3));
   const isFront=depth>=0;
   node.style.setProperty('--orbit-z',String(10+Math.round(t*20)));
   node.classList.toggle('orbit-front',isFront);
   node.classList.toggle('orbit-back',!isFront);
   const plane=isFront?frontPlane:backPlane;
   if(node.parentElement!==plane)plane.appendChild(node);
  });
 }
 function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!dragging&&!paused&&!reduce){
   if(Math.abs(velocity)>.0001){phase=(phase+velocity*dt)%(Math.PI*2);velocity*=Math.pow(.045,dt)}
   else phase=(phase+speed*dt)%(Math.PI*2);
  }
  render();raf=requestAnimationFrame(frame);
 }
 function setPaused(v){paused=v;core.classList.toggle('orbit-paused',v)}
 function dragStart(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  dragging=true;dragPointer=e.pointerId;dragLastX=e.clientX;dragLastT=performance.now();velocity=0;
  clearTimeout(resumeTimer);core.classList.add('orbit-dragging');
  try{core.setPointerCapture(e.pointerId)}catch(_){}
 }
 function dragMove(e){
  if(!dragging||e.pointerId!==dragPointer)return;
  const now=performance.now(),dx=e.clientX-dragLastX,dt=Math.max(8,now-dragLastT);
  phase=(phase+dx*dragSensitivity)%(Math.PI*2);
  velocity=(dx*dragSensitivity)/(dt/1000);
  dragLastX=e.clientX;dragLastT=now;render();
 }
 function dragEnd(e){
  if(!dragging||e.pointerId!==dragPointer)return;
  dragging=false;dragPointer=null;core.classList.remove('orbit-dragging');
  try{core.releasePointerCapture(e.pointerId)}catch(_){}
  // Keep a little momentum, then return to automatic orbit.
  resumeTimer=setTimeout(()=>{velocity=0},1200);
 }
 core.addEventListener('pointerdown',dragStart);
 core.addEventListener('pointermove',dragMove);
 core.addEventListener('pointerup',dragEnd);
 core.addEventListener('pointercancel',dragEnd);
 nodes.forEach(node=>node.addEventListener('click',()=>{if(Math.abs(velocity)<.15)setPaused(true)}));
 document.getElementById('holoClose')?.addEventListener('click',()=>setPaused(false));
 document.getElementById('osModuleClose')?.addEventListener('click',()=>setPaused(false));
 window.addEventListener('resize',render,{passive:true});
 render();
 if(reduce){setPaused(true);return}
 raf=requestAnimationFrame(frame);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPlanetaryCommandOrbit);
else initPlanetaryCommandOrbit();


/* ===== V42 ORBIT RUNTIME PROBE ===== */
(function installOrbitRuntimeProbe(){
 function probe(){
  const core=document.querySelector('.system-core');
  if(!core)return;
  let badge=document.getElementById('orbitRuntimeProbe');
  if(!badge){
   badge=document.createElement('div');
   badge.id='orbitRuntimeProbe';
   badge.textContent='ORBIT V42 // BOOT';
   badge.style.cssText='position:absolute;right:8px;bottom:8px;z-index:9999;padding:3px 6px;border:1px solid rgba(57,255,136,.55);background:rgba(5,8,13,.82);color:#39ff88;font:700 6px monospace;letter-spacing:.12em;pointer-events:none';
   core.appendChild(badge);
  }
  const menu=core.querySelector('.core-orbit-menu');
  const ready=menu&&menu.dataset.planetaryReady==='1';
  badge.textContent=ready?'ORBIT V42 // LIVE':'ORBIT V42 // RETRY';
  if(!ready){
   try{initPlanetaryCommandOrbit()}catch(e){}
   setTimeout(probe,350);
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(probe,150));
 else setTimeout(probe,150);
})();

/* V40 // SOCIAL IDENTITY SYNC */
document.addEventListener('DOMContentLoaded',()=>{try{syncLocalSocialIdentity()}catch(e){}});
window.SystemSocialIdentity={get:buildSocialIdentity,sync:syncLocalSocialIdentity,push:pushSocialIdentity};

/* V41 // REAL SOCIAL IDENTITY NETWORK */
window.SystemSocialNetwork={search:searchSocialPlayers,sync:syncSocialProfile,refresh:renderSocialCloud};

/* V42 // FRIEND NETWORK CONTROL */
window.SystemFriends={request:sendFriendRequest,respond:respondFriend,remove:removeFriend,refresh:renderSocialCommand};

/* V43 // SQUAD IDENTITY + ROSTER */
window.SystemSquads={community:fetchCommunityNetwork,identity:getIdentityCard,identityUnlocks:identityUnlockState,rewardVault:openRewardVault,rewardDetail:openVaultDetail,trophies:trophyCollection,hunterLegacy:hunterLegacyState,legacyTrialRewards,legacyArtifact,legacyAscension,ascensionModifiers,ascensionRecord,ascensionMarks,ascendLegacy,legacyMissions,legacyCampaign,legacyTrialHistory,legacyTrialRecord,attachPerformanceToLatestTrial,activeLegacyTrial,legacyTrialCombatState,legacyTrialCombo,legacyTrialAttackRating,legacyTrialSpecial,resolveActiveLegacyTrial,legacyTrialRecord,legacyTrialAchievements,formatTrialTime,currentHunterLegacy,refreshLegacyContext,ascensionTrialProfile,runLegacyTrial,refreshIdentityUnlocks,openPlayer:openPlayerDossier,openSquad:openSquadDossier,legacy:squadLegacyMap,create:createSquad,join:joinSquad,leave:leaveSquad,challenge:squadChallenge,progress:squadProgress,achievements:squadAchievementState,gate:fetchSquadGateIntel,victories:fetchSquadVictories,attack:applySquadGateDamage,refresh:renderSocialCommand};
