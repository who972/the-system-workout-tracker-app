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
  { id: 'level_10',      tier: 'silver', icon: '💎', title: 'D-Rank Hunter',     desc: 'Reach Level 10',                      requirement: s => s.level >= 10 },
  { id: 'fifty_quests',  tier: 'silver', icon: '📋', title: 'Quest Adept',        desc: 'Complete 50 quests total',            requirement: s => s.totalQuestsCompleted >= 50 },
  { id: 'weekly_1',      tier: 'silver', icon: '🎯', title: 'Weekly Warrior',    desc: 'Complete a weekly objective',         requirement: s => s.weeklyCompleted >= 1 },

  // Gold
  { id: 'day_14',        tier: 'gold',   icon: '🌟', title: 'Unstoppable',        desc: '14-day workout streak',               requirement: s => s.bestStreak >= 14 },
  { id: 'level_25',      tier: 'gold',   icon: '👑', title: 'B-Rank Hunter',     desc: 'Reach Level 25',                      requirement: s => s.level >= 25 },
  { id: 'hundred_quests',tier: 'gold',   icon: '📜', title: 'Quest Master',       desc: 'Complete 100 quests total',           requirement: s => s.totalQuestsCompleted >= 100 },
  { id: 'all_daily',     tier: 'gold',   icon: '✨', title: 'Daily Conqueror',   desc: 'Complete all daily quests in one day', requirement: s => s.allDailyCompleted },

  // S-Rank
  { id: 'day_30',        tier: 'srank',  icon: '💥', title: 'Iron Will',          desc: '30-day workout streak',               requirement: s => s.bestStreak >= 30 },
  { id: 'level_50',      tier: 'srank',  icon: '🔥', title: 'S-Rank Hunter',     desc: 'Reach Level 50',                      requirement: s => s.level >= 50 },
  { id: 'week_complete', tier: 'srank',  icon: '🏆', title: 'Weekly Dominator',  desc: 'Complete all weekly objectives',      requirement: s => s.allWeeklyCompleted },

  // Shadow Sovereign
  { id: 'day_60',        tier: 'shadow', icon: '🌑', title: 'Eternal Shadow',    desc: '60-day workout streak',               requirement: s => s.bestStreak >= 60 },
  { id: 'level_90',      tier: 'shadow', icon: '👁️', title: 'Shadow Sovereign',  desc: 'Reach Level 90',                      requirement: s => s.level >= 90 },
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
    stats: { str: 0, end: 0, agi: 0, vit: 0 },
    dailyQuests: DEFAULT_DAILY_QUESTS.map(q => ({ ...q, progress: 0, completed: false })),
    weeklyGoals: DEFAULT_WEEKLY_GOALS.map(g => ({ ...g, progress: 0, completed: false })),
    achievements: ACHIEVEMENTS.map(a => ({ id: a.id, unlocked: false })),
    history: [],
    dailyDate: getTodayStr(),
    weekStartDate: getWeekStartStr(),
    allDailyCompleted: false,
    allWeeklyCompleted: false,
    weeklyCompleted: 0,
    statsEarned: { str: 0, end: 0, agi: 0, vit: 0 },
    weight: { current: null, starting: null, goal: null, history: [] },
    exerciseRecords: [],
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
    state.stats = Object.assign({ str: 0, end: 0, agi: 0, vit: 0 }, saved.stats || {});
    state.statsEarned = Object.assign({ str: 0, end: 0, agi: 0, vit: 0 }, saved.statsEarned || {});
    state.weight = Object.assign({ current: null, starting: null, goal: null, history: [] }, saved.weight || {});
    state.weight.history = Array.isArray(state.weight.history) ? state.weight.history : [];
    state.exerciseRecords = Array.isArray(saved.exerciseRecords) ? saved.exerciseRecords : [];

    // Check for daily reset
    const today = getTodayStr();
    if (saved.dailyDate !== today) {
      // Streak logic: if yesterday was last workout, continue streak; else reset
      if (saved.lastWorkoutDate) {
        const lastDate = new Date(saved.lastWorkoutDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const lastStr = lastDate.toISOString().split('T')[0];
        const yStr = yesterday.toISOString().split('T')[0];
        if (lastStr !== yStr) {
          state.currentStreak = 0;
        }
      }
      state.dailyQuests = DEFAULT_DAILY_QUESTS.map(q => ({ ...q, progress: 0, completed: false }));
      state.allDailyCompleted = false;
      state.dailyDate = today;
    } else {
      // Keep saved daily quest progress
      state.dailyQuests = (saved.dailyQuests || []).map(q => {
        const def = DEFAULT_DAILY_QUESTS.find(d => d.id === q.id);
        return def ? { ...def, progress: q.progress || 0, completed: q.completed || false } : null;
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
      const saved = state.achievements?.find(s => s.id === a.id);
      return { id: a.id, unlocked: saved?.unlocked || false };
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

// --- XP & Leveling ---
function addXp(amount, source = 'quest') {
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
    showLevelUpModal(state.level, rank);
  }

  checkAchievements();
  return leveled;
}

function addStat(statType, amount) {
  if (!(statType in state.stats)) return;
  state.stats[statType] += amount;
  state.statsEarned[statType] = (state.statsEarned[statType] || 0) + amount;
}

// --- Streak Management ---
function updateStreak() {
  const today = getTodayStr();
  if (state.lastWorkoutDate !== today) {
    // New day - check if streak continues
    if (state.lastWorkoutDate) {
      const lastDate = new Date(state.lastWorkoutDate);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastStr = lastDate.toISOString().split('T')[0];
      const yStr = yesterday.toISOString().split('T')[0];
      if (lastStr === yStr) {
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

// --- Quest Completion ---
function completeQuest(questId) {
  const quest = state.dailyQuests.find(q => q.id === questId);
  if (!quest || quest.completed) return;

  quest.completed = true;
  quest.progress = quest.target;
  state.totalQuestsCompleted++;

  addSystemMessage(`Quest Complete: ${quest.title} — +${quest.xp} XP`, 'quest');
  addXp(quest.xp);
  addStat(quest.stat, 1);

  // Check all daily complete
  checkAllDailyComplete();

  // If all daily quests done, increment weekly workout session
  if (state.allDailyCompleted) {
    const wWorkouts = state.weeklyGoals.find(g => g.id === 'w_workouts');
    if (wWorkouts && !wWorkouts.completed) {
      wWorkouts.progress++;
      if (wWorkouts.progress >= wWorkouts.target) {
        wWorkouts.completed = true;
        state.weeklyCompleted++;
        addSystemMessage(`Weekly Objective Complete: ${wWorkouts.title} — +${wWorkouts.xpReward} XP`, 'achievement');
        addXp(wWorkouts.xpReward, 'weekly');
        checkAllWeeklyComplete();
      }
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

  // Streak update
  updateStreak();

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
    addXp(250, 'bonus');
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
  const xp = Math.floor(duration * intensity * 3);
  state.totalQuestsCompleted++;

  addSystemMessage(`Training Log: ${name} (${duration}min) — +${xp} XP`, 'quest');
  addXp(xp);


  // Custom workout counts as one workout session for weekly goal
  const wWorkouts = state.weeklyGoals.find(g => g.id === 'w_workouts');
  if (wWorkouts && !wWorkouts.completed) {
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

  updateStreak();
  if (window.SystemBuild && typeof window.SystemBuild.awardTraining === 'function') window.SystemBuild.awardTraining(name, duration, intensity);
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
  const volume=sets*reps*weight;
  const previous=state.exerciseRecords.filter(r=>r.name===name);
  const isPR=!previous.length || volume>Math.max(...previous.map(r=>r.volume));
  const rec={date:getTodayStr(),name,sets,reps,weight,volume,isPR};
  state.exerciseRecords.push(rec); state.exerciseRecords=state.exerciseRecords.slice(-100);
  const xp=Math.max(10,Math.floor(sets*reps*2+(weight||0)*0.5)); addXp(xp,'exercise');
  addStat(name.match(/Push|Squat|Lunge|Press|Row|Curl|Extension/i)?'str':'end',1);
  addSystemMessage(`${name} logged: ${sets} × ${reps}${weight?' @ '+weight+' lb':''} — +${xp} XP${isPR?' — NEW PR':''}`,'quest');
  updateStreak(); recordHistory('exercise_'+Date.now(), xp); saveState(); renderAll(); if(typeof renderAnalytics==='function')renderAnalytics();
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
  document.getElementById('playerLevel').textContent = `Level ${state.level}`;
  document.getElementById('playerStreak').textContent = `🔥 ${state.currentStreak} day streak`;
  document.getElementById('totalWorkouts').querySelector('.player-card__total-num').textContent = state.totalQuestsCompleted;
  document.getElementById('xpValues').textContent = `${state.xp} / ${xpNeeded}`;
  document.getElementById('xpBarFill').style.width = `${xpPercent}%`;

  const canonical=window.SystemBuild?.getBuild?.()?.stats;
  document.getElementById('statStr').textContent = canonical?.Strength ?? state.stats.str;
  document.getElementById('statEnd').textContent = canonical?.Endurance ?? state.stats.end;
  document.getElementById('statAgi').textContent = canonical?.Conditioning ?? state.stats.agi;
  document.getElementById('statVit').textContent = canonical?.Recovery ?? state.stats.vit;
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
 {day:0,name:"Recovery Protocol",focus:"Active recovery + mobility",stat:"vit",xp:250,exercises:[["Brisk Walk",1,"10 min",0],["Stretching",1,"10 min",0],["Glute Bridge",2,"15 reps",30],["Plank",2,"30 sec",30]]},
 {day:1,name:"Strength Awakening",focus:"Upper-body strength + core",stat:"str",xp:300,exercises:[["Push-Ups",3,"8-12 reps",45],["Bodyweight Squats",3,"12-15 reps",45],["Plank",3,"30 sec",30],["Incline Push-Ups",2,"10-15 reps",30],["March in Place",1,"5 min",0]]},
 {day:2,name:"Endurance Protocol",focus:"Cardio conditioning + endurance",stat:"end",xp:300,exercises:[["Brisk Walk",1,"10 min",0],["High Knees",4,"30 sec",30],["Bodyweight Squats",3,"12 reps",30],["March in Place",1,"5 min",0],["Stretching",1,"5 min",0]]},
 {day:3,name:"Agility Protocol",focus:"Movement, coordination + speed",stat:"agi",xp:300,exercises:[["High Knees",5,"30 sec",30],["Mountain Climbers",4,"30 sec",30],["Reverse Lunges",3,"10/leg",30],["March in Place",1,"5 min",0],["Stretching",1,"5 min",0]]},
 {day:4,name:"Vitality Recovery",focus:"Mobility, core + recovery",stat:"vit",xp:300,exercises:[["Plank",3,"30-45 sec",30],["Glute Bridge",3,"12-15 reps",30],["Bodyweight Squats",3,"12 reps",30],["Stretching",1,"10 min",0],["Brisk Walk",1,"5 min",0]]},
 {day:5,name:"Full Body Assault",focus:"Full-body conditioning",stat:"str",xp:350,exercises:[["Push-Ups",3,"8-12 reps",45],["Bodyweight Squats",3,"15 reps",45],["Reverse Lunges",3,"10/leg",30],["Mountain Climbers",3,"30 sec",30],["Plank",3,"30 sec",30]]},
 {day:6,name:"Cardio Challenge",focus:"Conditioning + calorie burn",stat:"end",xp:350,exercises:[["Brisk Walk",1,"15 min",0],["High Knees",5,"30 sec",30],["Mountain Climbers",5,"30 sec",30],["March in Place",1,"5 min",0]]}
];
function systemMissionKey(){return getTodayStr();}
function systemPlayerProfile(){try{return JSON.parse(localStorage.getItem('systemPlayerBuildV1')||'{}')}catch(e){return {}}}
function adaptiveSystemMission(){
 const base=adaptiveSystemMission(),b=systemPlayerProfile(),profile=b.profile||{},path=b.path||'Balanced',exp=profile.experience||'Beginner',gear=profile.equipment||['Bodyweight'];
 const scale=exp==='Advanced'?1.25:exp==='Intermediate'?1.1:0.9, has=x=>gear.includes(x)||gear.includes('Full Gym');
 let exercises=base.exercises.map(e=>[...e]);
 if(has('Dumbbells')||has('Full Gym')){
   exercises=exercises.map(e=>e[0]==='Push-Ups'?['Dumbbell Press',e[1],e[2],Math.max(45,e[3])]:e[0]==='Glute Bridge'?['Dumbbell Rows',e[1],e[2],60]:e);
 }
 if(path==='Strength'||path==='Muscle Building'){
   exercises=exercises.map(e=>[e[0],Math.max(1,Math.round(e[1]*scale)),e[2],Math.max(e[3],45)]);
 }else if(path==='Endurance'||path==='Fat Loss'){
   exercises=exercises.map(e=>[e[0],e[1],e[2],Math.max(0,Math.round(e[3]*.8))]);
 }
 const names={'Fat Loss':'Fat Loss Protocol','Muscle Building':'Hypertrophy Protocol',Strength:'Strength Protocol',Endurance:'Endurance Protocol',Balanced:base.name};
 const focus=path==='Balanced'?base.focus:path+' • '+base.focus;
 return {...base,name:names[path]||base.name,focus,exercises,profile:{path,experience:exp,equipment:gear,days:Number(profile.days)||4}};
}
function missionProgressKey(){return "systemMissionProgress:"+systemMissionKey();}
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
function renderSystemMission(){const m=adaptiveSystemMission(),done=localStorage.getItem('systemMission:'+systemMissionKey())==='true',p=getMissionProgress(),sets=flatSets(m),finished=sets.filter(x=>p[x.ei+'-'+x.si]?.done).length;document.getElementById('mission-title').textContent=m.name;document.getElementById('mission-focus').textContent=m.focus+' • Primary stat: '+m.stat.toUpperCase()+' • '+finished+'/'+sets.length+' sets';document.getElementById('mission-xp').textContent='+'+m.xp+' XP';document.getElementById('mission-exercises').innerHTML=m.exercises.map((e,i)=>`<div class="mission-exercise"><div class="mission-exercise__head"><strong>${e[0]}</strong><small>${e[1]} sets • ${e[2]}${e[3]?' • '+e[3]+'s rest':''}</small></div><div class="mission-summary">${Array.from({length:e[1]},(_,s)=>`<span class="mission-dot ${p[i+'-'+s]?.done?'done':''}">${s+1}</span>`).join('')}</div></div>`).join('');const b=document.getElementById('start-mission-btn');b.disabled=done;b.textContent=done?'MISSION COMPLETE':finished?'RESUME WORKOUT':'START WORKOUT';b.onclick=startWorkoutMode;renderDashboardStrip();}
function startWorkoutMode(){const m=adaptiveSystemMission();if(localStorage.getItem('systemMission:'+systemMissionKey())==='true')return;const p=getMissionProgress(),sets=flatSets(m);liveIndex=Math.max(0,sets.findIndex(x=>!p[x.ei+'-'+x.si]?.done));if(liveIndex<0)liveIndex=sets.length-1;workoutStartedAt=Number(localStorage.getItem('workoutStartedAt:'+systemMissionKey()))||Date.now();localStorage.setItem('workoutStartedAt:'+systemMissionKey(),workoutStartedAt);document.getElementById('workoutMode').classList.add('active');document.getElementById('workoutMode').setAttribute('aria-hidden','false');document.body.classList.add('workout-open');document.getElementById('liveMissionName').textContent=m.name;clearInterval(liveTimer);liveTimer=setInterval(()=>document.getElementById('workoutClock').textContent=fmt((Date.now()-workoutStartedAt)/1000),1000);renderLiveSet();}
function renderLiveSet(){const m=adaptiveSystemMission(),sets=flatSets(m),x=sets[liveIndex],p=getMissionProgress(),rec=getMissionRecords()[x.name]||{};document.getElementById('liveExerciseCount').textContent=`SET ${liveIndex+1} OF ${sets.length}`;document.getElementById('liveExerciseName').textContent=x.name;document.getElementById('liveTarget').textContent=`Target: ${x.target}${rec.bestReps?' • Best: '+rec.bestReps+' reps':''}`;document.getElementById('liveReps').value=parseTargetReps(x.target)||'';document.getElementById('liveWeight').value='';document.getElementById('liveSetCount').textContent=Object.values(p).filter(v=>v.done).length+' sets complete';document.getElementById('liveXpPreview').textContent='+'+m.xp+' XP on completion';document.getElementById('workoutProgressFill').style.width=(Object.values(p).filter(v=>v.done).length/sets.length*100)+'%';}
function completeLiveSet(){const m=adaptiveSystemMission(),sets=flatSets(m),x=sets[liveIndex],p=getMissionProgress(),id=x.ei+'-'+x.si;p[id]={done:true,reps:Number(document.getElementById('liveReps').value)||0,weight:Number(document.getElementById('liveWeight').value)||0};saveMissionProgress(p);if(liveIndex>=sets.length-1){finishWorkout();return;}liveIndex++;if(x.rest>0)startRest(x.rest);else renderLiveSet();}
function startRest(sec){const panel=document.getElementById('restPanel');panel.hidden=false;let left=sec;document.getElementById('restClock').textContent=fmt(left);clearInterval(restTimer);restTimer=setInterval(()=>{left--;document.getElementById('restClock').textContent=fmt(left);if(left<=0)endRest();},1000);}
function endRest(){clearInterval(restTimer);document.getElementById('restPanel').hidden=true;renderLiveSet();}
function finishWorkout(){const m=adaptiveSystemMission(),p=getMissionProgress(),records=getMissionRecords();let prs=[];m.exercises.forEach((e,i)=>{let br=0,bw=0;for(let s=0;s<e[1];s++){const x=p[i+'-'+s]||{};br=Math.max(br,x.reps||0);bw=Math.max(bw,x.weight||0);}const old=records[e[0]]||{bestReps:0,bestWeight:0};if(br>old.bestReps||bw>old.bestWeight)prs.push(e[0]);records[e[0]]={bestReps:Math.max(br,old.bestReps),bestWeight:Math.max(bw,old.bestWeight)};});localStorage.setItem(missionRecordsKey(),JSON.stringify(records));localStorage.setItem('systemMission:'+systemMissionKey(),'true');const seconds=Math.round((Date.now()-workoutStartedAt)/1000),hist=workoutHistory();hist.push({date:systemMissionKey(),mission:m.name,seconds,xp:m.xp,prs:[...prs],sets:flatSets(m).map(x=>{const r=p[x.ei+'-'+x.si]||{};return {name:x.name,reps:r.reps||0,weight:r.weight||0};})});localStorage.setItem('systemWorkoutSessions',JSON.stringify(hist.slice(-365)));localStorage.removeItem('workoutStartedAt:'+systemMissionKey());addXp(m.xp,'daily mission');if(window.SystemBuild?.awardTraining)window.SystemBuild.awardTraining(m.name,Math.max(10,Math.round(seconds/60)),1);updateStreak();recordHistory('system_mission_'+systemMissionKey(),m.xp);addSystemMessage(`${m.name} complete — ${fmt(seconds)} • +${m.xp} XP${prs.length?' • New PR: '+prs.join(', '):''}`,'quest');saveState();closeWorkout();renderAll();renderSystemMission();renderAnalytics();setTimeout(()=>alert(`MISSION COMPLETE\n${fmt(seconds)} training time\n+${m.xp} XP${prs.length?'\nNEW PR: '+prs.join(', '):''}`),100);}
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
function renderSavedWorkouts(){const el=document.getElementById('savedWorkouts');if(!el)return;const w=getCustomWorkouts();el.innerHTML=w.length?w.map(x=>`<div class="saved-workout"><div class="saved-workout__head"><strong>${x.name}</strong><span>+${x.xp} XP</span></div><div class="saved-workout__meta">${x.exercises.length} exercises • ${x.minutes} min • ${x.stat.toUpperCase()}${x.day==='any'?'':' • '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][Number(x.day)]}</div><div class="saved-workout__actions"><button type="button" onclick="loadCustomWorkout('${x.id}')">Edit</button><button type="button" onclick="logCustomMission('${x.id}')">Complete</button><button type="button" onclick="deleteCustomWorkout('${x.id}')">Delete</button></div></div>`).join(''):'<div class="builder-empty">No custom missions yet. Build one and THE SYSTEM will stop pretending everyone trains exactly the same way.</div>';}
function loadCustomWorkout(id){const x=getCustomWorkouts().find(v=>v.id===id);if(!x)return;document.getElementById('builderName').value=x.name;document.getElementById('builderStat').value=x.stat;document.getElementById('builderDay').value=x.day;document.getElementById('builderMinutes').value=x.minutes;document.getElementById('builderForm').dataset.edit=id;const box=document.getElementById('builderExercises');box.innerHTML='';x.exercises.forEach(addBuilderExercise);document.getElementById('workoutBuilder').scrollIntoView({behavior:'smooth'});}
function deleteCustomWorkout(id){saveCustomWorkouts(getCustomWorkouts().filter(x=>x.id!==id));renderSavedWorkouts();}
function logCustomMission(id){const x=getCustomWorkouts().find(v=>v.id===id);if(!x)return;const today=getTodayStr(), key='customMissionDone:'+id+':'+today;if(localStorage.getItem(key)==='true'){alert('SYSTEM: This custom mission is already complete today.');return;}localStorage.setItem(key,'true');addXp(x.xp,'custom mission');if(window.SystemBuild?.awardTraining)window.SystemBuild.awardTraining(x.name,x.minutes,1);updateStreak();recordHistory('custom_mission_'+id+'_'+today,x.xp);const hist=workoutHistory();hist.push({date:today,mission:x.name,seconds:x.minutes*60,xp:x.xp,prs:[],sets:[]});localStorage.setItem('systemWorkoutSessions',JSON.stringify(hist.slice(-365)));addSystemMessage(`${x.name} complete — ${x.minutes} min • +${x.xp} XP`,'quest');saveState();renderAll();if(typeof renderAnalytics==='function')renderAnalytics();alert(`MISSION COMPLETE\n${x.name}\n+${x.xp} XP`);}
function initWorkoutBuilder(){const form=document.getElementById('builderForm');if(!form)return;const box=document.getElementById('builderExercises');if(!box.children.length){addBuilderExercise({name:'Push-Ups',sets:3,target:'8-12 reps',rest:45});addBuilderExercise({name:'Squats',sets:3,target:'12-15 reps',rest:45});}document.getElementById('addBuilderExercise').onclick=()=>addBuilderExercise();form.onsubmit=e=>{e.preventDefault();const exercises=[...box.querySelectorAll('.builder-exercise')].map(r=>({name:r.querySelector('.exercise-name').value.trim(),sets:Number(r.querySelector('.exercise-sets').value)||1,target:r.querySelector('.exercise-target').value.trim()||'reps',rest:Number(r.querySelector('.exercise-rest').value)||0})).filter(x=>x.name);if(!exercises.length)return;const minutes=Number(document.getElementById('builderMinutes').value)||30,id=form.dataset.edit||('cw_'+Date.now()),workouts=getCustomWorkouts(),obj={id,name:document.getElementById('builderName').value.trim(),stat:document.getElementById('builderStat').value,day:document.getElementById('builderDay').value,minutes,exercises,xp:calculateCustomReward(exercises,minutes)};const i=workouts.findIndex(x=>x.id===id);if(i>=0)workouts[i]=obj;else workouts.push(obj);saveCustomWorkouts(workouts);delete form.dataset.edit;form.reset();document.getElementById('builderMinutes').value=30;box.innerHTML='';addBuilderExercise();renderSavedWorkouts();addSystemMessage(`${obj.name} saved — ${obj.exercises.length} exercises • ${obj.xp} XP reward`,'quest');};renderSavedWorkouts();}
document.addEventListener('DOMContentLoaded',initWorkoutBuilder);


// --- Exercise Library v9 ---
const BUILTIN_EXERCISES=[
{name:'Push-Ups',muscle:'Chest',equipment:'Bodyweight',difficulty:'Beginner',stat:'str',sets:3,target:'8-12 reps',rest:45},
{name:'Incline Push-Ups',muscle:'Chest',equipment:'Bodyweight',difficulty:'Beginner',stat:'str',sets:3,target:'10-15 reps',rest:45},
{name:'Bodyweight Squats',muscle:'Legs',equipment:'Bodyweight',difficulty:'Beginner',stat:'str',sets:3,target:'12-15 reps',rest:45},
{name:'Reverse Lunges',muscle:'Legs',equipment:'Bodyweight',difficulty:'Beginner',stat:'agi',sets:3,target:'10/leg',rest:30},
{name:'Glute Bridge',muscle:'Glutes',equipment:'Bodyweight',difficulty:'Beginner',stat:'vit',sets:3,target:'12-15 reps',rest:30},
{name:'Plank',muscle:'Core',equipment:'Bodyweight',difficulty:'Beginner',stat:'end',sets:3,target:'30-45 sec',rest:30},
{name:'Mountain Climbers',muscle:'Full Body',equipment:'Bodyweight',difficulty:'Intermediate',stat:'agi',sets:4,target:'30 sec',rest:30},
{name:'High Knees',muscle:'Cardio',equipment:'Bodyweight',difficulty:'Beginner',stat:'agi',sets:4,target:'30 sec',rest:30},
{name:'Brisk Walk',muscle:'Cardio',equipment:'None',difficulty:'Beginner',stat:'end',sets:1,target:'10 min',rest:0},
{name:'Stretching',muscle:'Mobility',equipment:'None',difficulty:'Beginner',stat:'vit',sets:1,target:'10 min',rest:0},
{name:'Dumbbell Press',muscle:'Chest',equipment:'Dumbbells',difficulty:'Beginner',stat:'str',sets:3,target:'8-12 reps',rest:60},
{name:'Dumbbell Rows',muscle:'Back',equipment:'Dumbbells',difficulty:'Beginner',stat:'str',sets:3,target:'8-12 reps',rest:60},
{name:'Shoulder Press',muscle:'Shoulders',equipment:'Dumbbells',difficulty:'Beginner',stat:'str',sets:3,target:'8-12 reps',rest:60},
{name:'Biceps Curls',muscle:'Arms',equipment:'Dumbbells',difficulty:'Beginner',stat:'str',sets:3,target:'10-15 reps',rest:45},
{name:'Triceps Extensions',muscle:'Arms',equipment:'Dumbbells',difficulty:'Beginner',stat:'str',sets:3,target:'10-15 reps',rest:45}
];
function getCustomExercises(){try{return JSON.parse(localStorage.getItem('systemCustomExercises')||'[]')}catch(e){return []}}
function saveCustomExercises(x){localStorage.setItem('systemCustomExercises',JSON.stringify(x));}
function exerciseLibrary(){const m=new Map();[...BUILTIN_EXERCISES,...getCustomExercises()].forEach(x=>m.set(x.name.toLowerCase(),x));return [...m.values()];}
function addLibraryExerciseToBuilder(name){const x=exerciseLibrary().find(e=>e.name===name);if(!x)return;addBuilderExercise({name:x.name,sets:x.sets,target:x.target,rest:x.rest});document.getElementById('workoutBuilder')?.scrollIntoView({behavior:'smooth'});}
function deleteLibraryExercise(name){const x=getCustomExercises().filter(e=>e.name!==name);saveCustomExercises(x);renderExerciseLibrary();}
function renderExerciseLibrary(){const grid=document.getElementById('exerciseLibraryGrid');if(!grid)return;const all=exerciseLibrary(),q=(document.getElementById('librarySearch')?.value||'').toLowerCase(),mus=document.getElementById('libraryMuscle')?.value||'all',eq=document.getElementById('libraryEquipment')?.value||'all';const muscles=[...new Set(all.map(x=>x.muscle))].sort(),equip=[...new Set(all.map(x=>x.equipment))].sort();const ms=document.getElementById('libraryMuscle'),es=document.getElementById('libraryEquipment');if(ms&&ms.options.length<=1)ms.innerHTML='<option value="all">All muscle groups</option>'+muscles.map(x=>`<option>${x}</option>`).join('');if(es&&es.options.length<=1)es.innerHTML='<option value="all">All equipment</option>'+equip.map(x=>`<option>${x}</option>`).join('');const filtered=all.filter(x=>(!q||[x.name,x.muscle,x.equipment,x.stat].join(' ').toLowerCase().includes(q))&&(mus==='all'||x.muscle===mus)&&(eq==='all'||x.equipment===eq));grid.innerHTML=filtered.map(x=>`<article class="library-card"><div class="library-card__head"><h3>${x.name}</h3><span class="stat-chip">${x.stat.toUpperCase()}</span></div><div class="library-card__meta">${x.muscle} • ${x.equipment} • ${x.difficulty}</div><div class="library-card__defaults">${x.sets} sets • ${x.target} • ${x.rest}s rest</div><div class="library-card__actions"><button type="button" onclick="addLibraryExerciseToBuilder('${x.name.replace(/'/g,"\\'")}')">Add to Mission</button>${BUILTIN_EXERCISES.some(b=>b.name===x.name)?'':`<button type="button" onclick="deleteLibraryExercise('${x.name.replace(/'/g,"\\'")}')">Delete</button>`}</div></article>`).join('')||'<div class="builder-empty">No exercises match those filters.</div>';const dl=document.getElementById('exerciseLibraryNames');if(dl)dl.innerHTML=all.map(x=>`<option value="${x.name}"></option>`).join('');}
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
async function pushCloudBackup(){try{const s=getCloudSession();if(!s?.user?.id)throw new Error('Sign in first.');cloudStatus('Uploading…');await cloudRequest('/rest/v1/workout_backups?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:s.user.id,data:cloudPayload(),updated_at:new Date().toISOString()})});localStorage.setItem('theSystemLastSync',new Date().toISOString());cloudStatus('Cloud backup uploaded.',true);renderCloudAccount();}catch(e){cloudStatus(e.message)}}
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
