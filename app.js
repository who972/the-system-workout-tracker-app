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
  // Level unlocks a promotion attempt; rank is only awarded after the gate is passed.
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel && hasRankPromotion(r.name==='S-Rank+'?'S+':r.name==='Shadow'?'Shadow':r.letter)) rank = r;
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
  // Backfill older/current assessment installs whose assessment was saved before
  // the performance HUD learned to use it.
  let assessment=null;try{assessment=JSON.parse(localStorage.getItem('systemAwakeningAssessmentV1')||'null')}catch(_){}
  const assessmentMap={str:'Strength',end:'Endurance',agi:'Conditioning',vit:'Recovery'};
  if(assessment?.scores){Object.entries(assessmentMap).forEach(([stat,key])=>{const measured=Math.max(0,Math.min(100,Number(assessment.scores[key])||0));if(measured>(Number(p[stat]?.score)||0)){p[stat]={...(p[stat]||{}),score:measured,actions:Math.max(Number(p[stat]?.actions)||0,1)};}});}
  const rows=PERFORMANCE_STATS.map(k=>({stat:k,score:Number(p[k].score)||0,actions:Number(p[k].actions)||0}));
  const max=100;
  rows.forEach(x=>x.percent=Math.max(0,Math.min(100,Math.round(x.score))));
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
  // Long-form progression: levels reward training, while rank still requires
  // physical standards plus a successful promotion gate.
  return Math.floor(260 + (level * 26) + (Math.pow(level, 1.42) * 7));
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
  const el=document.getElementById('exerciseRecords…109607 tokens truncated…form:uppercase}.hud-combat-title[hidden],.player-card__title[hidden]{display:none!important}

/* V41 // SOCIAL PLAYER SEARCH */
.social-player-search{grid-column:1/-1}.player-search-results{margin-top:10px}.player-search-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:14px;padding:10px;border-top:1px solid rgba(98,228,255,.1)}.player-search-row strong,.player-search-row small{display:block}.player-search-row small{margin-top:3px;font-size:7px;opacity:.55}.player-search-row>div:nth-child(2){text-align:right}.player-search-row button{padding:7px 10px;border:1px solid rgba(98,228,255,.3);background:rgba(60,210,255,.06);color:inherit;font:700 8px 'JetBrains Mono',monospace}@media(max-width:760px){.player-search-row{grid-template-columns:1fr auto}.player-search-row>div:nth-child(2){display:none}}

/* V42 // FRIEND NETWORK CONTROL */
.friend-pending>div,.friend-actions{display:flex;align-items:center;gap:7px}.friend-pending>div{justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(98,228,255,.08)}.friend-pending strong,.friend-pending small{display:block}.friend-pending small{font-size:7px;opacity:.5}.friend-pending button,.friend-actions button{padding:5px 7px;border:1px solid rgba(98,228,255,.22);background:rgba(60,210,255,.04);color:inherit;font:700 7px 'JetBrains Mono',monospace}.friend-actions{margin-left:auto}.friend-actions button:last-child{opacity:.55}.friend-leaderboard>div{gap:9px}

/* V43 // SQUAD IDENTITY + ROSTER */
.squad-identity{margin-top:12px}.squad-identity__head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:12px;border-bottom:1px solid rgba(98,228,255,.12)}.squad-identity__head small,.squad-identity__head span{display:block;font:700 7px 'JetBrains Mono',monospace;letter-spacing:.12em;opacity:.55}.squad-identity__head h3{margin:3px 0;font-size:17px;letter-spacing:.08em}.squad-identity__head>div:last-child{text-align:right}.squad-identity__head>div:last-child b{display:block;font-size:18px}.squad-roster article{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid rgba(98,228,255,.08)}.squad-roster article>b{font:800 9px 'JetBrains Mono',monospace;opacity:.55}.squad-roster strong,.squad-roster small{display:block}.squad-roster small{margin-top:3px;font-size:7px;opacity:.55}.squad-roster em{font-style:normal;font:700 8px 'JetBrains Mono',monospace}@media(max-width:760px){.squad-identity__head{gap:8px}.squad-roster article{grid-template-columns:24px 1fr}.squad-roster em{display:none}}

/* V44 // SQUAD PROGRESSION */
.squad-progression{margin-top:12px}.squad-level-track{display:grid;grid-template-columns:1fr 1.4fr;align-items:center;gap:16px;padding:10px 0 14px}.squad-level-track strong,.squad-level-track small{display:block}.squad-level-track small{margin-top:4px;font-size:7px;opacity:.55}.squad-level-track>span,.squad-missions article>span{height:5px;overflow:hidden;background:rgba(98,228,255,.08);border:1px solid rgba(98,228,255,.1)}.squad-level-track i,.squad-missions article>span i{display:block;height:100%;background:currentColor;box-shadow:0 0 10px currentColor}.squad-missions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.squad-missions article{display:grid;grid-template-columns:1fr auto;gap:8px;padding:9px;border:1px solid rgba(98,228,255,.12);background:rgba(0,14,22,.4)}.squad-missions strong,.squad-missions small{display:block}.squad-missions strong{font-size:8px;letter-spacing:.06em}.squad-missions small{margin-top:4px;font-size:7px;opacity:.5}.squad-missions article>b{font:700 8px 'JetBrains Mono',monospace}.squad-missions article>span{grid-column:1/-1}.squad-missions article.complete{border-color:rgba(98,228,255,.38);box-shadow:inset 0 0 16px rgba(70,220,255,.05)}@media(max-width:760px){.squad-level-track{grid-template-columns:1fr}.squad-missions{grid-template-columns:1fr}}

/* V45 // SQUAD GATE OPERATIONS */
.squad-gate{margin-top:12px}.squad-gate-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end}.squad-gate-head small,.squad-gate-head span{display:block;font:700 7px 'JetBrains Mono',monospace;opacity:.55}.squad-gate-head h3{margin:3px 0;font-size:18px;letter-spacing:.08em}.squad-gate-head>div:last-child{text-align:right}.squad-gate-head>div:last-child b{font-size:18px}.squad-gate-hp{height:8px;margin:12px 0 7px;background:rgba(98,228,255,.07);border:1px solid rgba(98,228,255,.15);overflow:hidden}.squad-gate-hp i{display:block;height:100%;background:currentColor;box-shadow:0 0 14px currentColor;transition:width .6s ease}.squad-gate-meta{display:flex;justify-content:space-between;gap:8px;font:700 7px 'JetBrains Mono',monospace;opacity:.65}.squad-contributors{margin-top:10px}.squad-contributors>div{display:grid;grid-template-columns:28px 1fr auto;gap:8px;padding:6px 0;border-top:1px solid rgba(98,228,255,.08);font-size:8px}.squad-contributors em{font-style:normal;font-family:'JetBrains Mono',monospace}@media(max-width:760px){.squad-gate-meta{display:grid;grid-template-columns:1fr 1fr}.squad-gate-meta span:last-child{grid-column:1/-1}}

/* V46 // SQUAD VICTORY RECORD */
.squad-victory-history{margin-top:12px;padding-top:10px;border-top:1px solid rgba(98,228,255,.12)}.squad-victory-history>strong{display:block;margin-bottom:6px;font:700 8px 'JetBrains Mono',monospace}.squad-victory-history>span{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid rgba(98,228,255,.06)}.squad-victory-history small{font-size:7px;opacity:.55}.squad-victory-fx{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;pointer-events:none;background:radial-gradient(circle,rgba(30,190,225,.12),rgba(0,5,10,.88));opacity:0;visibility:hidden;transition:.25s}.squad-victory-fx.active{opacity:1;visibility:visible}.squad-victory-fx>div{text-align:center;padding:30px 48px;border:1px solid rgba(110,235,255,.45);background:rgba(0,12,20,.9);box-shadow:0 0 45px rgba(70,220,255,.16)}.squad-victory-fx small,.squad-victory-fx span,.squad-victory-fx b{display:block;font-family:'JetBrains Mono',monospace}.squad-victory-fx h2{margin:8px 0;font-size:28px;letter-spacing:.14em}.squad-victory-fx strong{display:block;font-size:16px}.squad-victory-fx span{margin:10px 0;font-size:9px}@media(prefers-reduced-motion:reduce){.squad-victory-fx{transition:none}}

/* V47 // SQUAD RAID LEGACY */
.squad-achievements{margin-top:12px;padding-top:10px;border-top:1px solid rgba(98,228,255,.12)}.squad-achievements__head{display:flex;align-items:end;justify-content:space-between;gap:12px}.squad-achievements__head small,.squad-achievements__head strong{display:block}.squad-achievements__head small{font:700 7px 'JetBrains Mono',monospace;opacity:.5}.squad-achievements__head strong{margin-top:3px;font-size:11px;letter-spacing:.1em}.squad-achievements__head em{font:700 7px 'JetBrains Mono',monospace;font-style:normal;opacity:.6}.squad-achievement-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:9px}.squad-achievement-grid article{padding:8px;border:1px solid rgba(98,228,255,.12);background:rgba(0,12,20,.35)}.squad-achievement-grid b,.squad-achievement-grid small,.squad-achievement-grid span{display:block}.squad-achievement-grid b{font-size:8px}.squad-achievement-grid small{min-height:28px;margin:4px 0;font-size:7px;line-height:1.35;opacity:.5}.squad-achievement-grid span{font:700 7px 'JetBrains Mono',monospace;opacity:.45}.squad-achievement-grid article.unlocked{border-color:rgba(98,228,255,.38);box-shadow:inset 0 0 15px rgba(70,220,255,.05)}.squad-achievement-grid article.unlocked span{opacity:1}@media(max-width:760px){.squad-achievement-grid{grid-template-columns:repeat(2,1fr)}.squad-achievements__head{align-items:start;flex-direction:column}}

/* V48 // SQUAD IDENTITY INTEGRATION */
.squad-legacy-badge{display:inline-block;margin:2px 0 5px;padding:3px 7px;border:1px solid rgba(98,228,255,.28);background:rgba(70,220,255,.05);font:800 7px 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;box-shadow:inset 0 0 10px rgba(70,220,255,.04)}.squad-rankings article small,.squad-battle small,.squad-row small{line-height:1.45}

/* V49 // SOCIAL DOSSIERS */
.social-dossier{position:fixed;top:4vh;right:3vw;bottom:4vh;z-index:9500;width:min(430px,92vw);padding:22px;overflow:auto;border:1px solid rgba(98,228,255,.35);background:rgba(0,10,18,.96);box-shadow:0 0 50px rgba(30,200,240,.15);transform:translateX(115%);transition:transform .28s ease}.social-dossier.active{transform:translateX(0)}.social-dossier__close{position:absolute;right:12px;top:10px;border:0;background:none;font-size:24px}.social-dossier h2{margin:5px 0;font-size:24px;letter-spacing:.08em}.social-dossier>div>small,.dossier-squad>small{font:700 7px 'JetBrains Mono',monospace;opacity:.5}.dossier-rank{font:800 9px 'JetBrains Mono',monospace}.dossier-title{display:inline-block;margin:8px 0;padding:4px 8px;border:1px solid rgba(98,228,255,.3);font:800 8px 'JetBrains Mono',monospace;letter-spacing:.1em}.dossier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.dossier-grid span{padding:10px;border:1px solid rgba(98,228,255,.12);text-align:center}.dossier-grid b,.dossier-grid small{display:block}.dossier-grid small{margin-top:3px;font-size:6px;opacity:.5}.dossier-squad{padding:11px;border-top:1px solid rgba(98,228,255,.12);border-bottom:1px solid rgba(98,228,255,.12)}.dossier-squad strong,.dossier-squad span{display:block}.dossier-squad span{font:700 7px 'JetBrains Mono',monospace;opacity:.65}.dossier-actions{margin-top:12px}.dossier-roster button{display:grid;width:100%;grid-template-columns:28px 1fr auto;gap:8px;padding:9px;border:0;border-top:1px solid rgba(98,228,255,.1);background:transparent;text-align:left}.social-dossier__loading{padding:40px 10px;text-align:center;font:700 9px 'JetBrains Mono',monospace}.squad-row[data-dossier-squad],.player-search-row[data-dossier-player]{cursor:pointer}@media(prefers-reduced-motion:reduce){.social-dossier{transition:none}}

/* V50 // HUNTER SOCIAL IDENTITY CARD */
.hunter-id-card{display:grid;grid-template-columns:74px 1fr;gap:14px;margin:4px 0 18px;padding:15px;border:1px solid rgba(98,228,255,.34);background:linear-gradient(135deg,rgba(10,35,48,.9),rgba(0,10,18,.92));box-shadow:inset 0 0 28px rgba(70,220,255,.04)}.hunter-id-card__emblem{display:grid;place-items:center;min-height:74px;border:1px solid currentColor;font-size:30px;font-weight:900}.hunter-id-card small,.hunter-id-card strong,.hunter-id-card span,.hunter-id-card em{display:block}.hunter-id-card small{font:700 6px 'JetBrains Mono',monospace;opacity:.5}.hunter-id-card h3{margin:3px 0;font-size:20px;letter-spacing:.08em}.hunter-id-card strong,.hunter-id-card span,.hunter-id-card em{font:700 7px 'JetBrains Mono',monospace}.hunter-id-card span{margin-top:5px}.hunter-id-card em{margin-top:4px;font-style:normal;opacity:.65}.hunter-id-card p{margin:8px 0 0;font-size:8px;opacity:.65}.hunter-id-card.frame-raid{box-shadow:inset 0 0 35px rgba(255,255,255,.07)}.hunter-id-card.frame-shadow{background:linear-gradient(135deg,rgba(22,15,35,.96),rgba(0,8,16,.95))}.identity-editor{margin-bottom:12px}.identity-editor form{display:grid;grid-template-columns:1fr 1.5fr .7fr auto;gap:7px;align-items:end}.identity-editor label{font:700 6px 'JetBrains Mono',monospace}.identity-editor input,.identity-editor select{display:block;width:100%;margin-top:3px}.identity-editor>small{display:block;margin-top:7px;font:700 6px 'JetBrains Mono',monospace;opacity:.45}@media(max-width:760px){.identity-editor form{grid-template-columns:1fr 1fr}.hunter-id-card{grid-template-columns:58px 1fr}.hunter-id-card__emblem{min-height:58px;font-size:24px}}

/* V51 // IDENTITY ACCOMPLISHMENT UNLOCKS */
.identity-editor form{grid-template-columns:1fr 1.35fr .65fr .65fr auto}.identity-unlocks{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:9px}.identity-unlocks span{padding:6px;border:1px solid rgba(98,228,255,.1)}.identity-unlocks b,.identity-unlocks small{display:block}.identity-unlocks b{font-size:7px}.identity-unlocks small{margin-top:2px;font-size:6px;line-height:1.3;opacity:.48}.identity-unlocks .locked{opacity:.35}.identity-unlocks .unlocked{border-color:rgba(98,228,255,.34);box-shadow:inset 0 0 12px rgba(70,220,255,.04)}.hunter-id-card.frame-vanguard{background:linear-gradient(135deg,rgba(10,32,25,.96),rgba(0,10,18,.95))}.hunter-id-card.frame-elite{box-shadow:inset 0 0 32px rgba(255,255,255,.1),0 0 20px rgba(70,220,255,.08)}.hunter-id-card.frame-mvp{border-style:double;border-width:3px}.hunter-id-card.frame-ascendant{box-shadow:inset 0 0 28px rgba(70,220,255,.08)}.hunter-id-card.frame-veteran{border-style:double;border-width:3px}.hunter-id-card.frame-mythic{box-shadow:inset 0 0 38px rgba(255,255,255,.1),0 0 24px rgba(70,220,255,.12)}.hunter-id-card.frame-sovereign{border-style:double;border-width:3px;box-shadow:inset 0 0 45px rgba(70,220,255,.14),0 0 32px rgba(70,220,255,.14)}.hunter-id-card.frame-archive{border-style:double;box-shadow:inset 0 0 34px rgba(70,220,255,.12),0 0 24px rgba(70,220,255,.09)}@media(max-width:760px){.identity-editor form{grid-template-columns:1fr 1fr}.identity-unlocks{grid-template-columns:repeat(2,1fr)}}

/* V52 // IDENTITY UNLOCK PRESENTATION */
.identity-unlock-fx{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;pointer-events:none;background:radial-gradient(circle,rgba(40,215,255,.13),rgba(0,6,12,.9));opacity:0;visibility:hidden;transition:.22s}.identity-unlock-fx.active{opacity:1;visibility:visible}.identity-unlock-fx>div{min-width:300px;padding:28px 42px;text-align:center;border:1px solid rgba(105,235,255,.48);background:rgba(0,13,22,.95);box-shadow:0 0 55px rgba(60,220,255,.18),inset 0 0 30px rgba(60,220,255,.05)}.identity-unlock-fx small,.identity-unlock-fx span{display:block;font:700 7px 'JetBrains Mono',monospace;letter-spacing:.14em}.identity-unlock-fx h2{margin:7px 0 13px;font-size:22px;letter-spacing:.12em}.identity-unlock-fx #iuIcon{width:64px;height:64px;display:grid;place-items:center;margin:0 auto 10px;border:1px solid currentColor;font-size:30px;box-shadow:0 0 20px rgba(80,225,255,.12)}.identity-unlock-fx strong{display:block;font-size:17px;letter-spacing:.12em}.identity-unlock-fx span{margin-top:5px;opacity:.7}.identity-unlock-fx p{margin:9px 0 0;font-size:8px;opacity:.55}@media(prefers-reduced-motion:reduce){.identity-unlock-fx{transition:none}}

/* V53 // SYSTEM REWARD VAULT */
.reward-vault-launch{display:grid;width:100%;grid-template-columns:32px 1fr auto;align-items:center;gap:10px;margin-bottom:10px;padding:10px 13px;border:1px solid rgba(98,228,255,.25);background:rgba(5,25,35,.75);text-align:left}.reward-vault-launch>span{font-size:20px}.reward-vault-launch b,.reward-vault-launch small{display:block}.reward-vault-launch small{font-size:6px;opacity:.5}.reward-vault-launch em{font:700 7px 'JetBrains Mono',monospace;font-style:normal}.reward-vault{position:fixed;inset:3vh 3vw;z-index:9600;overflow:auto;padding:20px;border:1px solid rgba(98,228,255,.32);background:rgba(0,9,16,.98);box-shadow:0 0 70px rgba(30,200,240,.13);opacity:0;visibility:hidden;transform:scale(.985);transition:.2s}.reward-vault.active{opacity:1;visibility:visible;transform:scale(1)}.reward-vault header{display:flex;justify-content:space-between;align-items:start;position:sticky;top:-20px;z-index:2;padding:18px 0 10px;background:rgba(0,9,16,.96)}.reward-vault header small{font:700 7px 'JetBrains Mono',monospace;opacity:.5}.reward-vault header h2{margin:3px 0;font-size:25px}.reward-vault header button{border:0;background:none;font-size:25px}.reward-vault section{margin:14px 0 20px}.vault-head{display:flex;justify-content:space-between;margin-bottom:7px;font:700 8px 'JetBrains Mono',monospace}.vault-head b{opacity:.55}.vault-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.vault-grid article{display:grid;grid-template-columns:24px 1fr auto;gap:7px;align-items:center;padding:9px;border:1px solid rgba(98,228,255,.11)}.vault-grid article.locked{opacity:.38}.vault-grid article.unlocked{border-color:rgba(98,228,255,.32);background:rgba(70,220,255,.035)}.vault-grid b,.vault-grid small{display:block}.vault-grid b{font-size:8px}.vault-grid small{margin-top:2px;font-size:6px;line-height:1.3;opacity:.55}.vault-grid em{font:700 6px 'JetBrains Mono',monospace;font-style:normal}.vault-trophies{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.vault-trophies article{display:grid;grid-template-columns:30px 1fr;gap:8px;padding:10px;border:1px solid rgba(98,228,255,.18)}.vault-trophies b,.vault-trophies small{display:block}.vault-trophies small{font-size:6px;opacity:.5}.vault-empty,.vault-loading{padding:24px;text-align:center;font:700 8px 'JetBrains Mono',monospace;opacity:.5}@media(max-width:900px){.vault-grid{grid-template-columns:repeat(2,1fr)}.vault-trophies{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.reward-vault{transition:none}}

/* V54 // REWARD DETAIL INSPECTION */
.vault-grid article[data-vault-item],.vault-trophies article[data-vault-item]{cursor:pointer}.vault-grid article[data-vault-item]:focus,.vault-trophies article[data-vault-item]:focus{outline:1px solid currentColor;outline-offset:2px}.vault-detail{position:fixed;inset:0;z-index:10040;display:grid;place-items:center;padding:20px;background:rgba(0,5,10,.78);opacity:0;visibility:hidden;transition:.18s}.vault-detail.active{opacity:1;visibility:visible}.vault-detail__panel{position:relative;width:min(440px,92vw);padding:28px;border:1px solid rgba(98,228,255,.4);background:rgba(0,12,20,.98);box-shadow:0 0 60px rgba(50,220,255,.16)}.vault-detail__close{position:absolute;right:10px;top:8px;border:0;background:none;font-size:23px}.vault-detail__panel>small{font:700 7px 'JetBrains Mono',monospace;opacity:.5}.vault-detail__icon{display:grid;place-items:center;width:76px;height:76px;margin:18px auto 10px;border:1px solid currentColor;font-size:34px;box-shadow:0 0 25px rgba(70,220,255,.1)}.vault-detail h2{text-align:center;margin:7px 0;font-size:23px;letter-spacing:.1em}.vault-detail__panel>strong{display:block;text-align:center;font:800 8px 'JetBrains Mono',monospace}.vault-detail__panel>p{text-align:center;font-size:9px;opacity:.65}.vault-detail__meta{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:16px 0}.vault-detail__meta span{padding:9px;border:1px solid rgba(98,228,255,.12)}.vault-detail__meta small,.vault-detail__meta b{display:block}.vault-detail__meta small{font-size:6px;opacity:.45}.vault-detail__meta b{margin-top:3px;font-size:8px}.vault-detail #vaultEquipReward{width:100%;padding:10px}@media(prefers-reduced-motion:reduce){.vault-detail{transition:none}}

/* V55 // BOSS TROPHY COLLECTION */
.vault-grid article:has(b:first-child){position:relative}.vault-grid article.unlocked span:first-child{filter:drop-shadow(0 0 5px currentColor)}.vault-head strong{letter-spacing:.08em}.vault-trophies article span{display:grid;place-items:center;border:1px solid rgba(98,228,255,.24);min-height:32px}.vault-trophies article:hover,.vault-grid article[data-vault-item]:hover{border-color:rgba(98,228,255,.38);background:rgba(70,220,255,.04)}

/* V56 // HUNTER LEGACY PROGRESSION */
.hunter-legacy{display:grid;grid-template-columns:1fr auto;gap:8px;margin:10px 0 18px;padding:13px;border:1px solid rgba(98,228,255,.2);background:rgba(7,24,34,.68)}.hunter-legacy>div small{display:block;font:700 6px 'JetBrains Mono',monospace;opacity:.45}.hunter-legacy h3{margin:3px 0;font-size:14px;letter-spacing:.1em}.hunter-legacy>div strong,.hunter-legacy>b,.hunter-legacy>span{font:800 7px 'JetBrains Mono',monospace}.hunter-legacy>b{align-self:center;font-size:10px}.hunter-legacy__track{grid-column:1/-1;height:5px;background:rgba(98,228,255,.08)}.hunter-legacy__track i{display:block;height:100%;background:currentColor;box-shadow:0 0 9px currentColor}.hunter-legacy>span{grid-column:1/-1;opacity:.5}.hunter-legacy.dormant{opacity:.5}.hunter-legacy.active{border-color:rgba(98,228,255,.38);box-shadow:inset 0 0 20px rgba(70,220,255,.035)}

/* V57 // CENTRAL COMMAND LEGACY IDENTITY */
.central-legacy{display:flex;align-items:center;gap:7px;margin-top:5px;font:800 6px 'JetBrains Mono',monospace;letter-spacing:.08em}.central-legacy span{padding:3px 6px;border:1px solid rgba(98,228,255,.2)}.central-legacy b{font-size:7px}.central-legacy small{opacity:.5}.central-legacy.dormant{opacity:.4}.central-legacy.active span{border-color:rgba(98,228,255,.45);box-shadow:0 0 10px rgba(70,220,255,.08)}#playerCard[data-legacy-tier="ascendant"]{box-shadow:inset 0 0 30px rgba(70,220,255,.035)}#playerCard[data-legacy-tier="veteran"] .hud-label{border-bottom-color:rgba(98,228,255,.35)}#playerCard[data-legacy-tier="mythic"]{box-shadow:inset 0 0 42px rgba(70,220,255,.06),0 0 18px rgba(70,220,255,.04)}#playerCard[data-legacy-tier="sovereign"]{box-shadow:inset 0 0 52px rgba(70,220,255,.09),0 0 26px rgba(70,220,255,.07)}#playerCard[data-legacy-tier="sovereign"] .hud-label span:after{content:" // SOVEREIGN";opacity:.7}.central-legacy.frame-sovereign span,.central-legacy.frame-mythic span{border-style:double;border-width:3px}

/* V58 // LEGACY MISSIONS */
.legacy-missions-panel{border-color:rgba(98,228,255,.25)}.legacy-missions-panel[hidden]{display:none}.legacy-mission-list{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:12px}.legacy-mission-list article{display:grid;grid-template-columns:1fr auto;gap:6px;padding:11px;border:1px solid rgba(98,228,255,.12);background:rgba(5,22,31,.55)}.legacy-mission-list small,.legacy-mission-list b,.legacy-mission-list span{display:block}.legacy-mission-list small{font:700 6px 'JetBrains Mono',monospace;opacity:.45}.legacy-mission-list b{margin:3px 0;font-size:9px}.legacy-mission-list span{font-size:7px;opacity:.6}.legacy-mission-list strong{font:800 8px 'JetBrains Mono',monospace}.legacy-mission-track{grid-column:1/-1;height:4px;background:rgba(98,228,255,.08)}.legacy-mission-track i{display:block;height:100%;background:currentColor}.legacy-mission-list em{grid-column:1/-1;font:700 6px 'JetBrains Mono',monospace;font-style:normal;opacity:.5}.legacy-mission-list article.complete{border-color:rgba(98,228,255,.38)}.legacy-mission-list article.claimed em{opacity:.8}@media(max-width:760px){.legacy-mission-list{grid-template-columns:1fr}}

/* V59 // LEGACY CAMPAIGN CHAPTERS */
.legacy-campaign-map{display:grid;gap:10px}.legacy-chapter{padding:9px;border:1px solid rgba(98,228,255,.12);background:rgba(4,17,25,.45)}.legacy-chapter>header{display:grid;grid-template-columns:auto 1fr auto;gap:5px 9px;align-items:center}.legacy-chapter>header span,.legacy-chapter>header small,.legacy-chapter>header em{font:700 6px 'JetBrains Mono',monospace;font-style:normal}.legacy-chapter>header span{opacity:.55}.legacy-chapter>header b{font-size:10px;letter-spacing:.1em}.legacy-chapter>header small{grid-column:1/3;opacity:.45}.legacy-chapter>header em{grid-row:1/3;grid-column:3;align-self:center}.legacy-chapter-track{height:3px;margin:7px 0;background:rgba(98,228,255,.07)}.legacy-chapter-track i{display:block;height:100%;background:currentColor}.legacy-chapter.locked{opacity:.36;filter:saturate(.35)}.legacy-chapter.active{border-color:rgba(98,228,255,.28)}.legacy-chapter.complete{border-color:rgba(98,228,255,.42);box-shadow:inset 0 0 18px rgba(70,220,255,.035)}.legacy-chapter article{margin-top:6px}.legacy-chapter article.chapter-locked{pointer-events:none}

/* V60 // LEGACY CHAPTER TRIALS */
.legacy-trial-btn,.legacy-trial-lock{width:100%;margin-top:8px;padding:9px;border:1px solid rgba(98,228,255,.25);background:rgba(5,25,35,.72);font:800 7px 'JetBrains Mono',monospace;letter-spacing:.08em;color:inherit;text-align:left}.legacy-trial-btn{cursor:pointer;box-shadow:inset 0 0 14px rgba(70,220,255,.035)}.legacy-trial-btn small{display:block;margin-top:3px;font-size:6px;opacity:.5}.legacy-trial-btn:hover{border-color:rgba(98,228,255,.55);box-shadow:inset 0 0 22px rgba(70,220,255,.07)}.legacy-trial-btn:disabled{opacity:.55;cursor:default}.legacy-trial-lock{opacity:.35}.legacy-chapter.complete .legacy-trial-btn{border-color:rgba(98,228,255,.48)}

/* V61 // LEGACY TRIAL RELICS */
.hunter-id-card.frame-trialborn{border-style:double;border-width:3px;box-shadow:inset 0 0 34px rgba(70,220,255,.1)}.hunter-id-card.frame-overlord{border-style:double;border-width:4px;box-shadow:inset 0 0 54px rgba(255,255,255,.09),0 0 32px rgba(70,220,255,.13)}.vault-grid article.unlocked:has(b:first-child){text-shadow:0 0 7px rgba(98,228,255,.15)}

/* V62 // LEGACY NEXUS ARTIFACT */
.hunter-id-card.frame-nexus{border:3px double rgba(160,240,255,.75);box-shadow:inset 0 0 60px rgba(70,220,255,.14),0 0 38px rgba(70,220,255,.16)}#playerCard:has(.central-legacy.frame-nexus),#playerCard[data-legacy-tier="sovereign"]:has(.central-legacy.frame-nexus){box-shadow:inset 0 0 65px rgba(70,220,255,.13),0 0 32px rgba(70,220,255,.12)}.central-legacy.frame-nexus span{border:3px double rgba(160,240,255,.72);box-shadow:0 0 16px rgba(70,220,255,.14)}.central-legacy.frame-nexus:after{content:"◆ NEXUS ONLINE";font:800 6px 'JetBrains Mono',monospace;letter-spacing:.12em;opacity:.72}

/* V63 // LEGACY ASCENSION */
.legacy-ascend-btn{width:100%;padding:12px;margin-top:12px;border:3px double rgba(160,240,255,.6);background:rgba(5,26,37,.8);color:inherit;font:900 8px 'JetBrains Mono',monospace;letter-spacing:.12em;text-align:left;box-shadow:inset 0 0 28px rgba(70,220,255,.08),0 0 20px rgba(70,220,255,.06);cursor:pointer}.legacy-ascend-btn small{display:block;margin-top:4px;font-size:6px;opacity:.55}.legacy-ascend-btn:hover{box-shadow:inset 0 0 38px rgba(70,220,255,.13),0 0 28px rgba(70,220,255,.1)}

/* V64 // ASCENSION RECORDS */
.hunter-id-card__ascension{display:block;margin-top:4px;font:800 6px 'JetBrains Mono',monospace;font-style:normal;letter-spacing:.1em;opacity:.7}.hunter-id-card.frame-ascended{box-shadow:inset 0 0 38px rgba(70,220,255,.1)}.hunter-id-card.frame-exalted{border:3px double rgba(160,240,255,.62);box-shadow:inset 0 0 50px rgba(70,220,255,.12)}.hunter-id-card.frame-eternal{border:4px double rgba(210,250,255,.8);box-shadow:inset 0 0 70px rgba(255,255,255,.1),0 0 38px rgba(70,220,255,.16)}.central-legacy.frame-eternal:after{content:"∞ ETERNAL ASCENSION";font:900 6px 'JetBrains Mono',monospace;letter-spacing:.12em;opacity:.8}

/* V65 // ASCENSION DIFFICULTY MODIFIERS */
.ascension-modifiers{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px;padding:9px;border:1px solid rgba(98,228,255,.2);background:rgba(4,18,27,.6)}.ascension-modifiers>strong{grid-column:1/-1;font:900 7px 'JetBrains Mono',monospace;letter-spacing:.12em}.ascension-modifiers span{padding:7px;border-left:2px solid rgba(98,228,255,.32);background:rgba(70,220,255,.025)}.ascension-modifiers b,.ascension-modifiers small{display:block}.ascension-modifiers b{font:800 7px 'JetBrains Mono',monospace}.ascension-modifiers small{margin-top:3px;font-size:6px;opacity:.5}@media(max-width:760px){.ascension-modifiers{grid-template-columns:1fr}}

/* V66 // ASCENSION TRIAL PROFILES */
.legacy-trial-btn small{letter-spacing:.05em}.legacy-chapter.active .legacy-trial-btn:not(:disabled){background:linear-gradient(90deg,rgba(70,220,255,.07),rgba(5,25,35,.72));animation:trial-ready-pulse 2.6s ease-in-out infinite}@keyframes trial-ready-pulse{50%{box-shadow:inset 0 0 28px rgba(70,220,255,.11),0 0 13px rgba(70,220,255,.07)}}@media(prefers-reduced-motion:reduce){.legacy-chapter.active .legacy-trial-btn:not(:disabled){animation:none}}

/* V67 // LEGACY TRIAL RECORDS */
.legacy-trial-record{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px}.legacy-trial-record span{padding:8px;border:1px solid rgba(98,228,255,.16);background:rgba(5,22,31,.5)}.legacy-trial-record small,.legacy-trial-record b{display:block;font-family:'JetBrains Mono',monospace}.legacy-trial-record small{font-size:6px;opacity:.45}.legacy-trial-record b{margin-top:3px;font-size:11px}@media(max-width:640px){.legacy-trial-record{grid-template-columns:1fr}}

/* V68 // TRIAL PERFORMANCE RECORDS */
.legacy-trial-record span:last-child b{font-size:13px}.vault-grid article.unlocked small{line-height:1.35}

/* V69 // ARMED LEGACY TRIALS */
.legacy-trial-btn:has(small){position:relative}.legacy-trial-btn:not(:disabled){transition:box-shadow .2s ease}.legacy-trial-btn[data-legacy-trial]{text-transform:uppercase}.legacy-trial-btn[data-legacy-trial]:focus-visible{outline:2px solid currentColor;outline-offset:2px}

/* V70 // PERSISTENT TRIAL DAMAGE */
.legacy-trial-btn small{margin-top:4px}.legacy-trial-btn[data-legacy-trial]{overflow:hidden}.legacy-trial-btn[data-legacy-trial] small{opacity:.68}

/* V71 // LEGACY TRIAL PHASES */
.legacy-trial-btn small{display:block}.legacy-trial-btn:not(:disabled) small{font-variant-numeric:tabular-nums}.boss-combat-fx.active .bcf-phase{letter-spacing:.1em}

/* V72 // ACTIVE LEGACY COMBAT BRIEFING */
.legacy-combat-brief{margin-bottom:10px;padding:11px;border:1px solid rgba(98,228,255,.32);background:linear-gradient(135deg,rgba(5,27,39,.88),rgba(3,14,22,.76));box-shadow:inset 0 0 30px rgba(70,220,255,.05)}.legacy-combat-brief>div:first-child small,.legacy-combat-brief__stats small{display:block;font:700 6px 'JetBrains Mono',monospace;letter-spacing:.1em;opacity:.48}.legacy-combat-brief h3{margin:3px 0 1px;font-size:12px}.legacy-combat-brief>div:first-child>b{font:800 7px 'JetBrains Mono',monospace;opacity:.7}.legacy-combat-brief__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:9px}.legacy-combat-brief__stats span{padding:6px;background:rgba(70,220,255,.035);border:1px solid rgba(98,228,255,.1)}.legacy-combat-brief__stats strong{display:block;margin-top:2px;font:800 8px 'JetBrains Mono',monospace}.legacy-combat-brief__hp{height:4px;margin-top:8px;background:rgba(255,255,255,.07);overflow:hidden}.legacy-combat-brief__hp i{display:block;height:100%;background:currentColor;box-shadow:0 0 8px currentColor}.legacy-combat-brief p{margin:7px 0 0;font:600 7px 'JetBrains Mono',monospace;opacity:.7}@media(max-width:720px){.legacy-combat-brief__stats{grid-template-columns:repeat(2,1fr)}}

/* V73 // LEGACY COMBAT COMBOS */
.legacy-combat-brief__stats{grid-template-columns:repeat(3,1fr)}.legacy-combat-brief__stats span:nth-last-child(-n+2) strong{font-size:7px}.boss-combat-fx.critical .bcf-impact b{transform:scale(1.08)}@media(max-width:720px){.legacy-combat-brief__stats{grid-template-columns:repeat(2,1fr)}}

/* V74 // LEGACY SPECIAL ATTACKS */
.boss-combat-fx.critical .bcf-attack{text-shadow:0 0 12px currentColor}.legacy-combat-brief__stats strong{overflow-wrap:anywhere}

/* V77 // LEGACY TRIAL PERFORMANCE RECORDS */
.legacy-trial-record{grid-template-columns:repeat(7,minmax(0,1fr))}.legacy-trial-record span b{font-variant-numeric:tabular-nums}@media(max-width:900px){.legacy-trial-record{grid-template-columns:repeat(4,minmax(0,1fr))}}


/* V78 // ASCENSION PRESTIGE REWARDS */
.ascension-rewards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:10px 0;padding:10px;border:3px double rgba(160,240,255,.42);background:linear-gradient(135deg,rgba(6,29,41,.76),rgba(4,14,23,.72));box-shadow:inset 0 0 30px rgba(70,220,255,.06)}.ascension-rewards>strong{grid-column:1/-1;font:900 7px 'JetBrains Mono',monospace;letter-spacing:.14em}.ascension-rewards span{padding:8px;border:1px solid rgba(98,228,255,.13);background:rgba(70,220,255,.025)}.ascension-rewards small,.ascension-rewards b{display:block;font-family:'JetBrains Mono',monospace}.ascension-rewards small{font-size:6px;opacity:.48}.ascension-rewards b{margin-top:3px;font-size:9px}.ascension-rewards p{grid-column:1/-1;margin:2px 0 0;padding:8px;border-left:2px solid rgba(160,240,255,.45);font:800 7px 'JetBrains Mono',monospace;letter-spacing:.05em}@media(max-width:760px){.ascension-rewards{grid-template-columns:repeat(2,minmax(0,1fr))}}

.ascension-reward-track{display:block;height:4px;margin:7px 0 4px;border:1px solid rgba(160,240,255,.22);background:rgba(0,0,0,.3);overflow:hidden}.ascension-reward-track u{display:block;height:100%;background:linear-gradient(90deg,rgba(70,220,255,.45),rgba(190,250,255,.95));box-shadow:0 0 10px rgba(90,230,255,.55);text-decoration:none;transition:width .45s ease}

/* OPENING HERO // SYSTEM */
.system-boot__hero{position:relative;width:min(38vw,360px);height:min(30vh,250px);margin:2px auto 10px;display:grid;place-items:center;filter:drop-shadow(0 0 24px rgba(22,216,255,.32))}.system-boot__portal{position:absolute;width:82%;aspect-ratio:1;border-radius:50%;border:5px solid rgba(73,224,255,.92);box-shadow:0 0 14px #16d8ff,0 0 42px rgba(22,216,255,.75),inset 0 0 35px rgba(22,216,255,.35);background:radial-gradient(circle,rgba(28,151,255,.24),rgba(3,17,35,.05) 56%,transparent 58%);animation:bootPortal 3.2s ease-in-out infinite}.system-boot__hunter{position:absolute;bottom:0;width:46%;height:88%;filter:drop-shadow(0 0 8px rgba(19,171,255,.8))}.system-boot__hunter i{position:absolute;left:38%;top:7%;width:24%;height:25%;border-radius:48% 48% 42% 42%;background:#02050a;box-shadow:0 -6px 0 #07121e}.system-boot__hunter b{position:absolute;left:31%;top:28%;width:38%;height:63%;border-radius:42% 42% 18% 18%;background:linear-gradient(90deg,#010308,#07111d 48%,#010308)}.system-boot__hunter:before,.system-boot__hunter:after{content:"";position:absolute;top:31%;width:48%;height:22%;border:15px solid #02050a;border-bottom:0;border-radius:70% 70% 0 0}.system-boot__hunter:before{left:-2%;transform:rotate(-27deg)}.system-boot__hunter:after{right:-2%;transform:rotate(27deg)}.system-boot__brandmark{position:absolute;bottom:4%;width:28%;border-radius:22%;box-shadow:0 0 22px rgba(22,216,255,.55)}@keyframes bootPortal{50%{transform:scale(1.035);box-shadow:0 0 20px #16d8ff,0 0 60px rgba(22,216,255,.9),inset 0 0 45px rgba(22,216,255,.45)}}


/* V79 // MOBILE AUTH GATE FIT */
@media (max-width: 600px), (max-height: 760px) {
  .auth-gate{padding:max(10px,env(safe-area-inset-top)) 12px max(10px,env(safe-area-inset-bottom));overflow:hidden;align-items:center}
  .auth-card{width:min(420px,100%);max-height:calc(100dvh - 20px);padding:16px 18px;border-radius:14px;overflow:auto}
  .auth-mark{width:44px;height:44px;border-radius:11px;font-size:16px}
  .auth-kicker{margin:9px 0 3px;font-size:9px}
  .auth-card h1{font-size:clamp(24px,7vw,32px);line-height:1;margin-bottom:7px}
  .auth-copy{font-size:12px;line-height:1.3}
  .auth-tabs{margin:12px 0 9px;gap:6px}
  .auth-tabs button{min-height:38px;font-size:13px}
  .auth-form{gap:7px}
  .auth-form .form-input{padding-top:9px;padding-bottom:9px;min-height:42px;font-size:14px}
  .auth-form .btn-primary{min-height:42px;padding-top:9px;padding-bottom:9px}
  .auth-link{margin-top:7px;font-size:12px}
  .auth-gate .backup-status{min-height:12px;margin-top:6px;font-size:11px}
}
@media (max-height: 600px) {
  .auth-card{padding:10px 16px}
  .auth-mark{width:34px;height:34px;font-size:13px}
  .auth-kicker{margin:5px 0 2px}
  .auth-card h1{font-size:22px;margin-bottom:4px}
  .auth-copy{font-size:10px}
  .auth-tabs{margin:7px 0 6px}
  .auth-tabs button,.auth-form .form-input,.auth-form .btn-primary{min-height:36px}
}


/* V80 // AUTH REMEMBER + STARTUP PROGRESS HUD */
.auth-remember{display:flex;align-items:center;gap:8px;margin:2px 0 1px;font:600 11px 'JetBrains Mono',monospace;letter-spacing:.03em;opacity:.78;cursor:pointer}.auth-remember input{width:15px;height:15px;accent-color:var(--color-cyan)}
.auth-progress{display:grid;justify-items:center;gap:8px;padding:12px 8px 4px;text-align:center}.auth-progress[hidden]{display:none!important}.auth-progress__core{position:relative;width:54px;height:54px;display:grid;place-items:center}.auth-progress__core span{position:absolute;inset:0;border:1px solid rgba(98,228,255,.3);border-top-color:var(--color-cyan);border-radius:50%;box-shadow:0 0 18px rgba(70,220,255,.12);animation:authSpin 1s linear infinite}.auth-progress__core b{font:900 12px 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--color-cyan);text-shadow:0 0 10px rgba(70,220,255,.45)}.auth-progress p{margin:0;font:900 11px 'JetBrains Mono',monospace;letter-spacing:.16em;color:var(--color-cyan)}.auth-progress small{font:600 9px 'JetBrains Mono',monospace;opacity:.58}.auth-progress__track{width:100%;height:4px;background:rgba(98,228,255,.08);overflow:hidden}.auth-progress__track i{display:block;width:0;height:100%;background:linear-gradient(90deg,var(--color-cyan),var(--color-violet));box-shadow:0 0 10px rgba(70,220,255,.45);transition:width .35s ease}.auth-progress__steps{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.auth-progress__steps span{padding-top:5px;border-top:1px solid rgba(98,228,255,.1);font:700 7px 'JetBrains Mono',monospace;letter-spacing:.08em;opacity:.28;transition:.2s}.auth-progress__steps span.active{opacity:1;color:var(--color-cyan);border-top-color:var(--color-cyan);text-shadow:0 0 8px rgba(70,220,255,.3)}.auth-progress__steps span.done{opacity:.7;color:var(--color-success);border-top-color:var(--color-success)}.auth-card.auth-processing .auth-tabs,.auth-card.auth-processing #authGateForm,.auth-card.auth-processing #authForgot,.auth-card.auth-processing .auth-copy{display:none}.auth-card.auth-processing h1{font-size:clamp(24px,6vw,34px);margin-bottom:8px}.auth-card.auth-processing .auth-kicker{margin-bottom:5px}@keyframes authSpin{to{transform:rotate(360deg)}}
@media(max-width:600px),(max-height:760px){.auth-progress{padding:8px 4px 0;gap:6px}.auth-progress__core{width:44px;height:44px}.auth-progress p{font-size:9px}.auth-progress small{font-size:8px}.auth-remember{font-size:9px}}
@media(prefers-reduced-motion:reduce){.auth-progress__core span{animation:none}.auth-progress__track i,.auth-progress__steps span{transition:none}}


/* V81 // PRE-AUTH SYSTEM ENTRY SCREEN */
.system-entry-screen{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;background:#02060d;overflow:hidden}.system-entry-screen[hidden]{display:none!important}.system-entry-screen__art{position:absolute;inset:0;background:#02060d url('system-entry-hero.jpg') center center/contain no-repeat;filter:saturate(1.05) contrast(1.04)}.system-entry-screen:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 45%,rgba(0,0,0,.26) 100%);pointer-events:none}.system-entry-screen__enter{position:absolute;left:50%;top:82%;transform:translate(-50%,-50%);width:min(48vh,420px);min-width:260px;padding:14px 24px;border:2px solid rgba(94,225,255,.9);clip-path:polygon(6% 0,94% 0,100% 50%,94% 100%,6% 100%,0 50%);background:linear-gradient(180deg,rgba(15,66,139,.88),rgba(0,20,57,.94));box-shadow:0 0 10px rgba(45,195,255,.9),inset 0 0 22px rgba(45,195,255,.24),0 0 34px rgba(0,118,255,.35);color:#f3fdff;font:900 17px 'JetBrains Mono',monospace;letter-spacing:.08em;text-shadow:0 0 10px rgba(73,224,255,.75);cursor:pointer;animation:systemEntryPulse 2.2s ease-in-out infinite}.system-entry-screen__enter:active{transform:translate(-50%,-50%) scale(.985)}.system-entry-screen__status{position:absolute;right:18px;bottom:12px;font:700 8px 'JetBrains Mono',monospace;letter-spacing:.12em;color:rgba(122,234,255,.65)}body.system-entry-open{overflow:hidden}.auth-gate{z-index:13000;background:rgba(2,7,14,.86);backdrop-filter:blur(9px)}@keyframes systemEntryPulse{50%{box-shadow:0 0 18px rgba(45,195,255,1),inset 0 0 30px rgba(45,195,255,.34),0 0 50px rgba(0,118,255,.5)}}
@media(max-height:650px){.system-entry-screen__enter{top:80%;width:min(43vh,390px);padding:10px 20px;font-size:14px}.system-entry-screen__status{font-size:7px}}
@media(prefers-reduced-motion:reduce){.system-entry-screen__enter{animation:none}}


/* V82 // FINAL LANDSCAPE ENTRY HERO */
.system-entry-screen{position:fixed;inset:0;z-index:12000;display:block;background:#01040a;overflow:hidden}
.system-entry-screen[hidden]{display:none!important}
.system-entry-screen__art{position:absolute;inset:0;background:#01040a url('enter_the_system_landscape.jpg') center center/cover no-repeat;filter:none}
.system-entry-screen:before{display:none}
.system-entry-screen__status{display:none!important}
.system-entry-screen__enter{position:absolute;left:50%;top:84.2%;transform:translate(-50%,-50%);width:min(38vw,620px);height:min(9vw,118px);min-width:260px;z-index:4;border:0;clip-path:none;background:transparent!important;box-shadow:none!important;color:transparent!important;text-shadow:none!important;padding:0;cursor:pointer;animation:none!important}
.system-entry-screen__enter span{opacity:0!important;pointer-events:none}
.system-entry-screen__enter:active{transform:translate(-50%,-50%) scale(.985)}
.system-entry-screen__enter:focus-visible{outline:2px solid rgba(116,223,255,.95);outline-offset:4px;border-radius:18px}
@media(max-height:650px){.system-entry-screen__enter{top:84.2%;width:min(39vw,560px);height:min(9vw,100px);padding:0;font-size:0}}

/* V83 // ENTRY SCREEN CACHE KILL */
.system-entry-screen__art{background-image:url('enter_the_system_landscape.jpg?v=83')!important;background-position:center center!important;background-size:cover!important;background-repeat:no-repeat!important}
.system-entry-screen__status{display:none!important}


/* V84 // ROBUST ENTRY IMAGE RENDER */
.system-entry-screen__image{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center center;
  display:block;
  z-index:0;
}
.system-entry-screen__art{
  background:none!important;
  z-index:1;
  pointer-events:none;
}
.system-entry-screen__enter{z-index:3!important}

/* Use the button painted into the full-resolution entry artwork as the tap target. */
.system-entry-screen__enter{
  top:87%!important;
  width:40%!important;
  height:14%!important;
  min-width:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  clip-path:none!important;
  animation:none!important;
  color:transparent!important;
  text-shadow:none!important;
}
.system-entry-screen__enter:focus-visible{outline:2px solid #d5f8ff;outline-offset:3px}

.timed-set{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;align-items:center;margin:10px 0 0;padding:10px 14px;border:1px solid rgba(0,229,255,.35);border-radius:10px;background:rgba(0,229,255,.06)}
.timed-set[hidden]{display:none!important}
.timed-set>div:first-child{display:grid;gap:2px}
.timed-set small{font:700 10px var(--font-mono);letter-spacing:.08em;color:#8ddfee}
.timed-set strong{font:800 clamp(26px,4vw,46px) var(--font-mono);line-height:1;color:#e8fcff;font-variant-numeric:tabular-nums}
.timed-set__actions{display:flex;gap:8px;justify-content:flex-end}
.timed-set__actions button{min-height:38px;padding:7px 12px;border:1px solid rgba(0,229,255,.5);border-radius:7px;background:rgba(0,229,255,.12);color:#e8fcff;font:700 10px var(--font-mono);cursor:pointer}
.timed-set__actions button:disabled{opacity:.5;cursor:default}
.timed-set>small{grid-column:1/-1;letter-spacing:0}

/* Landscape workout: keep the timer and current set visible together. */
@media (orientation:landscape) and (min-width:700px) and (max-height:620px){
 body.workout-open #workoutMode.workout-mode.active{
  display:grid;grid-template-columns:minmax(230px,32%) minmax(0,1fr);
  grid-template-rows:auto minmax(0,1fr) auto;gap:10px 16px;
  align-items:stretch;overflow:hidden;box-sizing:border-box;
  padding:34px 18px max(12px,env(safe-area-inset-bottom));
 }
 body.workout-open .workout-mode__top{grid-column:1;grid-row:1;max-width:none;margin:0;padding:0 0 8px;min-width:0}
 body.workout-open .workout-mode__top h2{font-size:clamp(18px,2.7vw,28px);line-height:1.1}
 body.workout-open .workout-exit{position:fixed;right:16px;top:16px;z-index:5;width:38px;height:38px}
 body.workout-open .workout-clock{grid-column:1;grid-row:2;display:grid;place-items:center;min-width:0;margin:0;font-size:clamp(36px,6vw,72px)}
 body.workout-open .workout-progress{grid-column:1;grid-row:3;width:100%;max-width:none;margin:0;box-sizing:border-box}
 body.workout-open .workout-stage{grid-column:2;grid-row:1 / span 2;min-width:0;max-width:none;min-height:0;margin:0;padding:14px 18px;overflow-y:auto;display:flex;flex-direction:column;justify-content:center}
 body.workout-open .workout-stage h1{font-size:clamp(24px,4vw,44px);line-height:1.08;margin:4px 0}
 body.workout-open .workout-stage p{margin:2px 0}
 body.workout-open .live-set-grid{margin:12px 0;gap:8px}
 body.workout-open .timed-set{margin:6px 0 0;padding:7px 10px}
 body.workout-open .timed-set strong{font-size:clamp(24px,3vw,34px)}
 body.workout-open .timed-set__actions button{min-height:34px}
 body.workout-open #timedSet:not([hidden])+.live-set-grid{margin:7px 0}
 body.workout-open .live-set-grid input{padding:9px 11px;margin-top:4px;font-size:18px}
 body.workout-open .workout-main-btn{padding:11px;min-height:44px}
 body.workout-open .workout-live-stats{grid-column:2;grid-row:3;width:100%;max-width:none;margin:0;font-size:10px}
 body.system-os-ready .os-module-stage:not(.minimized){width:min(94vw,1200px);height:90dvh}
 body.system-os-ready .os-module-body{padding:8px 12px 10px}
 body.system-os-ready .os-module-body #daily-mission{padding:10px 14px!important}
 body.system-os-ready #daily-mission .section-header{margin-bottom:4px}
 body.system-os-ready #daily-mission .home-mission-summary{margin:5px 0;padding:7px 10px}
 body.system-os-ready #daily-mission .mission-mode-choices{margin:7px 0}
 body.system-os-ready #daily-mission .mission-mode-choices button{padding:7px 5px}
 body.system-os-ready #daily-mission #start-mission-btn{min-height:44px}
 .mlc-card{width:min(94vw,1100px);max-height:94dvh;padding:12px 16px}
 .mlc-objectives{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px}
 .mlc-objectives>div{min-width:0;margin:0}
}

/* Keep achievement badges in columns when their grid is moved into the OS window. */
body.system-os-ready .os-module-body > #achievementGrid{
 display:grid!important;
 grid-template-columns:repeat(3,minmax(0,1fr));
 gap:10px;
 align-content:start;
}
body.system-os-ready .os-module-body > #achievementGrid .achievement-card{
 min-width:0;
 min-height:112px;
 padding:12px 8px;
 box-sizing:border-box;
 justify-content:center;
}
body.system-os-ready .os-module-body > #achievementGrid .achievement-card--locked{opacity:.55}
@media(max-width:700px){
 body.system-os-ready .os-module-body > #achievementGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}

.account-danger{border:1px solid #f87171;padding:1rem;margin-top:1rem}.account-delete-dialog{background:#101923;color:#fff;border:1px solid #f87171;border-radius:12px;max-width:480px;max-height:85vh;overflow:auto}.account-delete-dialog::backdrop{background:#000b}


/* Account dialogs must remain visible above the OS while showModal blocks background taps. */
.account-delete-dialog[open]{display:block;position:fixed;inset:0;margin:auto;height:fit-content;box-sizing:border-box;width:min(480px,calc(100vw - 32px));padding:20px;max-height:calc(100dvh - 32px)}
.account-delete-dialog:not([open]){display:none}
.account-danger .danger-btn,.account-delete-dialog button{min-height:44px;padding:10px 14px;border:1px solid #f87171;border-radius:8px;background:rgba(248,113,113,.10);color:#fff;cursor:pointer}
.account-danger .danger-btn:focus-visible,.account-delete-dialog button:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}
.account-delete-dialog .settings-form{min-width:0}

/* Fit the complete 1672 x 941 artwork; keep its embedded button aligned. */
.system-entry-screen{display:grid;place-items:center}
.system-entry-screen__frame{position:relative;width:min(100vw,calc(100dvh * 1672 / 941));height:min(100dvh,calc(100vw * 941 / 1672));flex:none}
.system-entry-screen__frame .system-entry-screen__image{object-fit:contain;object-position:center}

/* Secondary cooperative launch, sized for landscape phones. */
.tt-secondary{display:block;width:100%;margin-top:8px;padding:10px;border:1px solid #4ddfff;background:#102338;color:#aeeeff;cursor:pointer}
#trainTogetherPanel{padding:12px;border:1px solid #4ddfff;margin-top:8px;max-height:35vh;overflow:auto}
#trainTogetherPanel button,#trainTogetherPanel input{padding:8px;margin:4px;max-width:100%}
#ttLive{position:relative;z-index:2;background:#102338;padding:8px;color:#aeeeff;text-align:center}
#ttLive[hidden],#trainTogetherPanel[hidden]{display:none}


/* V87 // CENTRAL COMMAND TOPBAR COLLISION FIX */
body.system-os-ready .hud-module--mission{padding-top:30px!important}
.os-topbar__right{position:absolute;right:8px;top:0;gap:14px;white-space:nowrap}
@media(max-height:520px){body.system-os-ready .hud-module--mission{padding-top:27px!important}.os-topbar__right{font-size:8px;gap:10px}}

/* ===== Progress History ===== */
.status-progress-actions{display:flex;justify-content:flex-end;margin:10px 0 14px}.status-progress-actions button{min-height:40px;padding:0 18px;border:1px solid rgba(103,222,255,.35);background:rgba(16,51,76,.45);color:#c9f7ff;font-weight:800;letter-spacing:.08em;cursor:pointer}
.progress-history-modal{position:fixed;inset:0;z-index:10040;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,5,12,.86);backdrop-filter:blur(8px)}.progress-history-modal.active{display:flex}.progress-history-card{width:min(1120px,96vw);max-height:92vh;overflow:auto;padding:22px;border:1px solid rgba(103,222,255,.35);background:linear-gradient(180deg,rgba(7,18,31,.99),rgba(5,12,23,.99));box-shadow:0 0 45px rgba(49,208,255,.12)}.progress-history-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(103,222,255,.15);padding-bottom:14px}.progress-history-head h2{margin:4px 0}.progress-history-head p{margin:0;opacity:.75}.progress-history-head>button{width:42px;height:42px;border:1px solid rgba(103,222,255,.3);background:transparent;color:#c9f7ff;font-size:1.1rem}.progress-history-layout{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(420px,1.5fr);gap:16px;margin-top:16px}.progress-history-layout aside,.progress-history-layout main,.progress-compare{border:1px solid rgba(103,222,255,.14);background:rgba(8,21,37,.62);padding:14px}.progress-history-layout aside button{display:block;width:100%;margin-top:8px;padding:11px;text-align:left;border:1px solid rgba(103,222,255,.14);background:rgba(3,12,23,.6);color:inherit}.progress-history-layout aside button.selected{border-color:rgba(103,222,255,.55);box-shadow:inset 3px 0 0 #7cecff}.progress-history-layout aside button span,.progress-history-layout aside button small{display:block;font-size:.65rem;letter-spacing:.08em;opacity:.7}.progress-history-layout aside button strong{display:block;margin:4px 0}.progress-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.progress-detail-grid article{padding:12px;border:1px solid rgba(103,222,255,.12);background:rgba(3,12,23,.55)}.progress-detail-grid span,.progress-detail-grid small{display:block;font-size:.64rem;letter-spacing:.09em;opacity:.7}.progress-detail-grid strong{display:block;margin:5px 0;font-size:1.15rem;color:#8deeff}.progress-raw{margin-top:12px;padding:12px;border:1px solid rgba(103,222,255,.12)}.progress-raw p{display:inline-block;margin:8px 18px 0 0}.progress-compare{margin-top:14px}.progress-compare>div{display:flex;align-items:center;gap:18px;margin-top:8px}.progress-compare article{display:flex;flex-direction:column}.progress-compare strong{font-size:1.2rem;color:#8deeff}.progress-focus{margin-top:14px}
@media(max-width:760px){.progress-history-modal{padding:8px}.progress-history-card{padding:14px}.progress-history-layout{grid-template-columns:1fr}.progress-history-layout aside{max-height:180px;overflow:auto}.progress-detail-grid{grid-template-columns:repeat(2,1fr)}}

.audio-settings{display:grid;grid-template-columns:1fr;gap:9px;margin:8px 0 4px;padding:12px;border:1px solid rgba(103,222,255,.18)}.audio-settings legend{padding:0 7px;color:#8deeff;font-size:.72rem;letter-spacing:.12em}.audio-settings>label:not(.settings-check){display:grid;grid-template-columns:70px 1fr;align-items:center;gap:10px;font-size:.78rem;opacity:.86}.audio-settings input[type=range]{width:100%;accent-color:#62ddff}.audio-settings button{min-height:34px;border:1px solid rgba(103,222,255,.28);background:rgba(12,45,67,.55);color:#c9f7ff;font-weight:800;letter-spacing:.08em}

/* Assessment landscape containment: never allow onboarding/trial cards to exceed the viewport width. */
.system-onboarding,.system-onboarding *{box-sizing:border-box}
.system-onboarding{width:100vw;max-width:100vw;overflow-x:hidden}
.system-onboarding .onboarding-card,.system-onboarding .ob-card,.system-onboarding>div{max-width:calc(100vw - 20px);min-width:0}
.system-onboarding .ob-fields,.system-onboarding .ob-options,.system-onboarding input{min-width:0;max-width:100%}
.system-onboarding .ob-options{grid-template-columns:repeat(2,minmax(0,1fr))}
.aw-push-block{display:grid;gap:8px}.aw-push-label{font-size:.68rem;font-weight:800;letter-spacing:.12em;color:#8deeff}.aw-push-options{grid-template-columns:repeat(4,minmax(0,1fr))!important}.aw-push-options button{min-width:0;padding-left:8px;padding-right:8px}
@media (max-height:520px) and (orientation:landscape){.system-onboarding .onboarding-card,.system-onboarding .ob-card{max-height:calc(100vh - 12px);overflow-y:auto}.system-onboarding h1{margin:.25rem 0}.system-onboarding p{margin:.35rem 0}.system-onboarding .ob-options{gap:6px}.system-onboarding .ob-options button{min-height:42px}}

.build-info{margin-top:10px;padding:9px 11px;border:1px solid rgba(103,222,255,.16);display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:.68rem;letter-spacing:.09em}.build-info span{opacity:.58}.build-info strong{color:#9befff}


/* Assessment baseline // Progress analytics */
.assessment-baseline-card{margin:0 0 14px;padding:18px;border:1px solid rgba(34,211,238,.28);border-radius:12px;background:linear-gradient(135deg,rgba(34,211,238,.055),rgba(255,255,255,.018))}
.assessment-baseline-card .analytics-card__head{margin-bottom:12px}.assessment-baseline-card .analytics-card__head h3{margin:2px 0 0;font-size:16px;text-transform:uppercase;letter-spacing:.08em}
.assessment-baseline-summary{display:flex;align-items:center;gap:16px;margin-bottom:14px;padding:10px 12px;border-left:2px solid currentColor;background:rgba(255,255,255,.025)}
.assessment-baseline-summary strong{font-size:20px;white-space:nowrap}.assessment-baseline-summary span{font-size:12px;opacity:.62}
.assessment-baseline-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.assessment-baseline-grid>div{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:rgba(255,255,255,.025)}
.assessment-baseline-grid span{display:block;font:9px var(--font-mono);letter-spacing:.1em;opacity:.58}.assessment-baseline-grid strong{display:block;margin:5px 0 8px;font-size:18px}.assessment-baseline-grid i{display:block;height:5px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.assessment-baseline-grid i b{display:block;height:100%;width:0;background:currentColor;transition:width .35s}
.assessment-baseline-empty .assessment-baseline-grid{opacity:.35}
@media(max-width:700px){.assessment-baseline-grid{grid-template-columns:repeat(2,1fr)}}

/* Expanded watch telemetry */
#healthConnectPanel .health-connect-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#healthConnectPanel .health-connect-grid strong{font-size:clamp(18px,2vw,30px)}
.health-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 20px}
.health-sync-note{color:#aebec8;font-size:13px;line-height:1.5;margin:10px 0}
.health-history-scroll{overflow-x:auto;margin-bottom:20px}
.health-history{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}
.health-history th,.health-history td{padding:10px;text-align:left;border-bottom:1px solid #29434f}
.health-history thead{color:#79dcf3}.health-workouts{display:grid;gap:8px}
.health-workouts article{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:12px;border:1px solid #29434f;border-radius:8px}
.health-workouts span{color:#aebec8}
