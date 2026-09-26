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
  updateStreak();
  return true;
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
  // Legacy quest stats retired. Canonical attributes grow from logged training.

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

  // Daily quests do not advance the workout streak.

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
  duration = Math.max(1, Number(duration)||0);
  intensity = Math.max(.25, Math.min(1, Number(intensity)||1));
  const qualifies = duration >= 10;
  const xp = Math.floor(duration * intensity * 3);
  state.totalQuestsCompleted++;

  addSystemMessage(`Training Log: ${name} (${duration}min) — +${xp} XP`, 'quest');
  addXp(xp);


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
  if(window.SystemBuild?.awardTraining) window.SystemBuild.awardTraining(name,Math.max(5,sets*2),1);
  addSystemMessage(`${name} logged: ${sets} × ${reps}${weight?' @ '+weight+' lb':''} — +${xp} XP${isPR?' — NEW PR':''}`,'quest');
  recordHistory('exercise_'+Date.now(), xp); saveState(); renderAll(); if(typeof renderAnalytics==='function')renderAnalytics();
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
 renderDashboardStrip();}
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
  const fill=document.getElementById('hudXpFill');if(fill)fill.style.width=pct+'%';
  set('hudStreak',state.currentStreak||0);set('hudWorkouts',state.totalQuestsCompleted||0);
  const plan=typeof WORKOUT_PLAN!=='undefined'?WORKOUT_PLAN[new Date().getDay()]:null;
  if(plan){set('hudMissionName',plan.name.toUpperCase());set('hudMissionFocus',plan.focus+' // 30 MIN');}
  const qs=state.dailyQuests||[],done=qs.filter(q=>q.completed).length,daily=qs.length?Math.round(done/qs.length*100):0;set('hudCorePercent',daily+'%');
}
document.addEventListener('DOMContentLoaded',()=>{renderCommandHud();document.getElementById('hudBriefing')?.addEventListener('click',()=>document.getElementById('replayDailyBriefing')?.click())});
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
  boss:()=>({k:'WEEKLY // CHALLENGE',t:'BOSS STAGE',b:'High-value weekly challenge. Complete objectives to claim the Boss Stage reward.<button class="holo-link" data-holo-view="missions">ENTER BOSS STAGE</button>'}),
  progress:()=>({k:'CAMPAIGN // ANALYTICS',t:'PROGRESS',b:'<div class="holo-data"><div>MISSIONS<b>'+((state&&state.totalQuestsCompleted)||0)+'</b></div><div>LEVEL<b>'+((state&&state.level)||1)+'</b></div></div><button class="holo-link" data-holo-view="progress">OPEN ANALYTICS</button>'}),
  achievements:()=>({k:'SYSTEM // RECORDS',t:'ACHIEVEMENTS',b:'Unlocked achievements, rank milestones and personal records.<button class="holo-link" data-holo-view="progress">VIEW AWARDS</button>'}),
  profile:()=>({k:'SYSTEM // CONFIG',t:'PROFILE & SETTINGS',b:'Player identity, account sync and system configuration.<button class="holo-link" data-holo-view="profile">OPEN SETTINGS</button>'})
 };
 function close(){core.classList.remove('is-projecting');win.setAttribute('aria-hidden','true');document.querySelectorAll('[data-holo]').forEach(x=>x.classList.remove('active'))}
 function open(name,btn){const m=modules[name]?.();if(!m)return;kicker.textContent=m.k;title.textContent=m.t;body.innerHTML=m.b;core.classList.add('is-projecting');win.setAttribute('aria-hidden','false');document.querySelectorAll('[data-holo]').forEach(x=>x.classList.toggle('active',x===btn));bindInside()}
 function bindInside(){body.querySelectorAll('[data-holo-view]').forEach(b=>b.onclick=()=>{document.querySelector('.app-nav [data-view="'+b.dataset.holoView+'"]')?.click();close()});body.querySelectorAll('[data-holo-target]').forEach(b=>b.onclick=()=>{document.getElementById(b.dataset.holoTarget)?.scrollIntoView({behavior:'smooth',block:'start'});close()})}
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
  boss:{title:'BOSS STAGE',kicker:'WEEKLY // CHALLENGE',ids:['sideMissionSystem']},
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
  title.textContent=m.title;kicker.textContent=m.kicker;stage.classList.add('active');stage.classList.remove('minimized');stage.setAttribute('aria-hidden','false');document.body.classList.add('os-module-open');setActive(name,true);body.scrollTop=0
 }
 window.SystemOS={open,close};
 document.getElementById('osModuleClose').onclick=close;
 document.getElementById('osModuleMin').onclick=()=>{stage.classList.toggle('minimized');document.body.classList.toggle('os-module-open',!stage.classList.contains('minimized'))};
 document.querySelectorAll('[data-holo]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open(b.dataset.holo)},true));
 document.querySelectorAll('[data-hud-target]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open('missions')},true));
 document.querySelectorAll('[data-hud-view]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();open(b.dataset.hudView==='progress'?'progress':'missions')},true));
 const clock=()=>{const e=document.getElementById('osClock');if(e)e.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};clock();setInterval(clock,30000);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('active'))close()});
}
document.addEventListener('DOMContentLoaded',initSystemOS);


/* ===== V15 MISSION LAUNCH / DEBRIEF ===== */
function ensureMissionFx(){
 if(!document.getElementById('missionLaunchFlash')){const e=document.createElement('div');e.id='missionLaunchFlash';e.className='mission-launch-flash';e.innerHTML='<div><small>THE SYSTEM // MISSION CONTROL</small><strong>MISSION LAUNCH</strong><span>TRAINING LINK ESTABLISHED</span></div>';document.body.appendChild(e)}
 if(!document.getElementById('missionDebrief')){const e=document.createElement('div');e.id='missionDebrief';e.className='mission-debrief';e.innerHTML='<div class="mission-debrief__card"><small>THE SYSTEM // DEBRIEF</small><h1>MISSION COMPLETE</h1><div id="missionDebriefTime">00:00</div><div id="missionDebriefXp" class="mission-debrief__xp">+0 XP</div><p id="missionDebriefPr">OBJECTIVES CLEARED</p><button type="button" id="missionDebriefClose">RETURN TO CENTRAL COMMAND</button></div>';document.body.appendChild(e);document.getElementById('missionDebriefClose').onclick=()=>e.classList.remove('active')}
}
document.addEventListener('DOMContentLoaded',ensureMissionFx);
const _osStartWorkoutMode=startWorkoutMode;
startWorkoutMode=function(){ensureMissionFx();const f=document.getElementById('missionLaunchFlash');f.classList.remove('active');void f.offsetWidth;f.classList.add('active');setTimeout(()=>{_osStartWorkoutMode();f.classList.remove('active')},650)};
function showMissionDebrief(seconds,xp,prs){ensureMissionFx();document.getElementById('missionDebriefTime').textContent=fmt(seconds)+' TRAINING TIME';document.getElementById('missionDebriefXp').textContent='+'+xp+' XP';document.getElementById('missionDebriefPr').textContent=prs&&prs.length?'NEW PR // '+prs.join(' • '):'ALL OBJECTIVES CLEARED';document.getElementById('missionDebrief').classList.add('active')}


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
function renderSocialCommand(){
 const root=document.getElementById('osSocialCommand');if(!root)return;const s=getSocial(),me=getSystemSettings(),rank=getRank(state.level);
 const players=[{name:me.name||'Player',xp:socialScore(),level:state.level,rank:rank.name,self:true},...s.friends].sort((a,b)=>(b.xp||0)-(a.xp||0));
 root.innerHTML='<div class="social-command"><section class="social-card"><div class="social-head"><span>FRIENDS // LEADERBOARD</span><b>'+players.length+' PLAYERS</b></div><div>'+players.map((p,i)=>'<div class="leader-row"><div class="leader-rank">#'+(i+1)+'</div><div class="leader-name"><strong>'+escapeHtml(p.name)+(p.self?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('')+'</div></section><section class="social-card"><div class="social-head"><span>HEAD-TO-HEAD // CHALLENGE</span><b>DUEL LINK</b></div><form id="challengeForm" class="challenge-form"><input id="challengePlayer" placeholder="Player name" required><select id="challengeType"><option value="xp">XP Sprint</option><option value="workouts">Mission Count</option><option value="streak">Streak Battle</option></select><select id="challengeLength"><option value="1">24 Hours</option><option value="3">3 Days</option><option value="7">7 Days</option></select><button type="submit">ISSUE CHALLENGE</button></form></section><section class="social-card social-card--wide"><div class="social-head"><span>ACTIVE // CHALLENGES</span><b>'+s.challenges.length+' ACTIVE</b></div><div class="challenge-list">'+(s.challenges.length?s.challenges.map(x=>'<div class="challenge-item"><strong>'+escapeHtml(x.opponent)+' // '+escapeHtml(x.type.toUpperCase())+'</strong><small>'+x.days+' DAY CHALLENGE • CREATED '+new Date(x.created).toLocaleDateString()+' • LOCAL DRAFT</small></div>').join(''):'<div class="social-empty">NO ACTIVE CHALLENGES // ISSUE A DUEL TO BEGIN</div>')+'</div></section></div>';
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
 live.insertAdjacentHTML('afterbegin','<div class="combat-hud"><span><i></i> MISSION ACTIVE</span><b id="combatProtocol">TRAINING PROTOCOL</b><span>LINK // STABLE</span></div>');
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
 const root=document.getElementById('osSocialCommand');if(!root)return;const s=getSocial(),me=getSystemSettings(),rank=getRank(state.level),players=[{name:me.name||'Player',xp:socialScore(),level:state.level,rank:rank.name,self:true},...s.friends].sort((a,b)=>(b.xp||0)-(a.xp||0)),myPos=Math.max(1,players.findIndex(p=>p.self)+1);
 root.innerHTML='<div class="social-command social-v25"><section class="social-network-head"><div><small>NETWORK // COMPETITIVE LINK</small><h2>SOCIAL COMMAND</h2><p>FRIEND RANKINGS // HEAD-TO-HEAD OPERATIONS</p></div><div class="social-network-stat"><b>#'+myPos+'</b><span>YOUR POSITION</span></div><div class="social-network-stat"><b>'+players.length+'</b><span>LINKED PLAYERS</span></div><div class="social-network-stat"><b>'+s.challenges.length+'</b><span>ACTIVE DUELS</span></div></section><div class="social-v25-grid"><section class="social-card social-rank-card"><div class="social-head"><span>FRIENDS // LEADERBOARD</span><b>XP RANKING</b></div><div class="leader-podium">'+players.slice(0,3).map((p,i)=>'<div class="podium p'+(i+1)+(p.self?' self':'')+'"><i>#'+(i+1)+'</i><strong>'+escapeHtml(p.name)+'</strong><small>LV '+(p.level||1)+'</small><b>'+Number(p.xp||0).toLocaleString()+' XP</b></div>').join('')+'</div><div class="leader-table">'+players.slice(3).map((p,i)=>'<div class="leader-row '+(p.self?'self':'')+'"><div class="leader-rank">#'+(i+4)+'</div><div class="leader-name"><strong>'+escapeHtml(p.name)+(p.self?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('')+'</div></section><section class="social-card duel-console"><div class="social-head"><span>HEAD-TO-HEAD // CHALLENGE</span><b>DUEL CONSOLE</b></div><form id="challengeForm" class="challenge-form"><label>OPPONENT<input id="challengePlayer" placeholder="Player name" required></label><label>PROTOCOL<select id="challengeType"><option value="xp">XP Sprint</option><option value="workouts">Mission Count</option><option value="streak">Streak Battle</option></select></label><label>DURATION<select id="challengeLength"><option value="1">24 Hours</option><option value="3">3 Days</option><option value="7">7 Days</option></select></label><button type="submit">ISSUE CHALLENGE</button></form><div class="duel-note">LOCAL SIMULATION // NETWORK BACKEND PENDING</div></section></div><section class="social-card social-card--wide"><div class="social-head"><span>ACTIVE // CHALLENGES</span><b>'+s.challenges.length+' OPERATIONS</b></div><div class="challenge-list">'+(s.challenges.length?s.challenges.map(x=>{const mine=challengeMetric(x.type),target=Number(x.opponentScore||0),total=Math.max(1,mine+target),pct=Math.round(mine/total*100);return '<article class="challenge-item duel-item"><div class="duel-versus"><span>YOU</span><b>VS</b><span>'+escapeHtml(x.opponent)+'</span></div><div class="duel-meta"><strong>'+escapeHtml(x.type.toUpperCase())+' // '+x.days+' DAY OPERATION</strong><small>'+challengeLabel(x.type)+' • LOCAL DRAFT • '+new Date(x.created).toLocaleDateString()+'</small></div><div class="duel-score"><b>'+mine.toLocaleString()+'</b><div><i style="width:'+pct+'%"></i></div><b>'+target.toLocaleString()+'</b></div></article>'}).join(''):'<div class="social-empty">NO ACTIVE DUELS // ISSUE A CHALLENGE TO OPEN A COMPETITIVE LINK</div>')+'</div></section></div>';
 document.getElementById('challengeForm').onsubmit=e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;const x=getSocial(),type=document.getElementById('challengeType').value;x.challenges.unshift({id:Date.now(),opponent:name,type,days:Number(document.getElementById('challengeLength').value),created:new Date().toISOString(),status:'draft',startScore:challengeMetric(type),opponentScore:0});saveSocial(x);renderSocialCommandV25();window.SystemOS?.notify('DUEL LINK CREATED // '+name.toUpperCase(),'SOCIAL // HEAD-TO-HEAD')};
}
const _v25Social=renderSocialCommand;renderSocialCommand=renderSocialCommandV25;


/* ===== V26 SOCIAL CLOUD NETWORK ===== */
const SOCIAL_CLOUD_TABLE='social_profiles',SOCIAL_CHALLENGE_TABLE='social_challenges';
function socialCloudUser(){return getCloudSession()?.user||null}
function socialHandle(){const u=socialCloudUser(),me=getSystemSettings();return (me.name||u?.email?.split('@')[0]||'Player').trim()}
async function syncSocialProfile(){
 const u=socialCloudUser();if(!u?.id)return false;const rank=getRank(state.level);
 await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:u.id,display_name:socialHandle(),xp:socialScore(),level:state.level,rank:rank.name,missions:Number(state.totalQuestsCompleted||0),streak:Number(state.currentStreak||0),updated_at:new Date().toISOString()})});return true
}
async function fetchSocialNetwork(){
 const u=socialCloudUser();if(!u?.id)return null;
 try{await syncSocialProfile();const [profiles,challenges]=await Promise.all([cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?select=user_id,display_name,xp,level,rank,missions,streak,updated_at&order=xp.desc&limit=100'),cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE+'?or=(challenger_id.eq.'+encodeURIComponent(u.id)+',opponent_id.eq.'+encodeURIComponent(u.id)+')&select=*&order=created_at.desc&limit=50')]);return{profiles,challenges}}catch(e){window.SystemOS?.notify('NETWORK LINK UNAVAILABLE // USING LOCAL DATA','SOCIAL // CLOUD');return null}
}
async function renderSocialCloud(){
 const root=document.getElementById('osSocialCommand');if(!root)return;renderSocialCommandV25();const u=socialCloudUser();
 const head=root.querySelector('.social-network-head');if(head)head.insertAdjacentHTML('beforeend','<div class="social-cloud-state '+(u?'online':'offline')+'"><i></i><span>'+(u?'CLOUD LINK':'LOCAL MODE')+'</span></div>');
 if(!u){root.querySelector('.duel-note').textContent='SIGN IN REQUIRED FOR LIVE NETWORK // LOCAL SIMULATION ACTIVE';return}
 const net=await fetchSocialNetwork();if(!net||!document.body.contains(root))return;
 const profiles=net.profiles||[],mine=profiles.findIndex(p=>p.user_id===u.id),rankCard=root.querySelector('.social-rank-card');
 if(rankCard){const podium=profiles.slice(0,3).map((p,i)=>'<div class="podium p'+(i+1)+(p.user_id===u.id?' self':'')+'"><i>#'+(i+1)+'</i><strong>'+escapeHtml(p.display_name)+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+'</small><b>'+Number(p.xp||0).toLocaleString()+' XP</b></div>').join(''),rows=profiles.slice(3).map((p,i)=>'<div class="leader-row '+(p.user_id===u.id?'self':'')+'"><div class="leader-rank">#'+(i+4)+'</div><div class="leader-name"><strong>'+escapeHtml(p.display_name)+(p.user_id===u.id?' // YOU':'')+'</strong><small>LV '+(p.level||1)+' • '+escapeHtml(p.rank||'E-Rank')+'</small></div><div class="leader-xp">'+Number(p.xp||0).toLocaleString()+' XP</div></div>').join('');rankCard.querySelector('.leader-podium').innerHTML=podium;rankCard.querySelector('.leader-table').innerHTML=rows}
 const stats=root.querySelectorAll('.social-network-stat b');if(stats[0])stats[0].textContent='#'+(mine>=0?mine+1:'--');if(stats[1])stats[1].textContent=profiles.length;if(stats[2])stats[2].textContent=net.challenges.length;
 const note=root.querySelector('.duel-note');if(note)note.textContent='CLOUD NETWORK ONLINE // LIVE ACCOUNT LINK';
 const form=document.getElementById('challengeForm');if(form)form.onsubmit=async e=>{e.preventDefault();const name=document.getElementById('challengePlayer').value.trim();if(!name)return;try{const matches=await cloudRequest('/rest/v1/'+SOCIAL_CLOUD_TABLE+'?display_name=ilike.'+encodeURIComponent(name)+'&select=user_id,display_name&limit=1');if(!matches.length)throw new Error('Player not found on the network.');if(matches[0].user_id===u.id)throw new Error('You cannot challenge yourself. Humanity has invented mirrors for that.');const type=document.getElementById('challengeType').value,days=Number(document.getElementById('challengeLength').value);await cloudRequest('/rest/v1/'+SOCIAL_CHALLENGE_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({challenger_id:u.id,opponent_id:matches[0].user_id,challenger_name:socialHandle(),opponent_name:matches[0].display_name,type,duration_days:days,status:'pending',challenger_start:challengeMetric(type),opponent_start:0,created_at:new Date().toISOString()})});window.SystemOS?.notify('CHALLENGE TRANSMITTED // '+matches[0].display_name.toUpperCase(),'SOCIAL // NETWORK');renderSocialCloud()}catch(err){window.SystemOS?.notify(err.message.toUpperCase(),'SOCIAL // NETWORK ERROR')}};
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
async function sendFriendRequest(userId,name){const u=socialCloudUser();if(!u?.id||userId===u.id)return;try{await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({requester_id:u.id,addressee_id:userId,requester_name:socialHandle(),addressee_name:name,status:'pending'})});window.SystemOS?.notify('FRIEND REQUEST SENT // '+name.toUpperCase(),'SOCIAL // FRIEND LINK');renderSocialCommand()}catch(e){window.SystemOS?.notify((e.message||'FRIEND LINK FAILED').toUpperCase(),'SOCIAL // NETWORK')}}
async function respondFriend(id,status){await cloudRequest('/rest/v1/'+SOCIAL_FRIEND_TABLE+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,accepted_at:status==='accepted'?new Date().toISOString():null})});renderSocialCommand()}
async function createSquad(name){const u=socialCloudUser();if(!u?.id)return;const rows=await cloudRequest('/rest/v1/'+SOCIAL_SQUAD_TABLE,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name,owner_id:u.id})});const sq=rows[0];if(sq)await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({squad_id:sq.id,user_id:u.id,display_name:socialHandle(),role:'owner'})});window.SystemOS?.notify('SQUAD CREATED // '+name.toUpperCase(),'SOCIAL // SQUAD');renderSocialCommand()}
async function joinSquad(id){const u=socialCloudUser();if(!u?.id)return;try{await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({squad_id:id,user_id:u.id,display_name:socialHandle(),role:'member'})});window.SystemOS?.notify('SQUAD LINK ESTABLISHED','SOCIAL // SQUAD');renderSocialCommand()}catch(e){window.SystemOS?.notify((e.message||'SQUAD LINK FAILED').toUpperCase(),'SOCIAL // SQUAD')}}
async function leaveSquad(id){const u=socialCloudUser();if(!u?.id)return;await cloudRequest('/rest/v1/'+SOCIAL_MEMBER_TABLE+'?squad_id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(u.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});renderSocialCommand()}
async function renderCommunityV28(){
 const root=document.getElementById('osSocialCommand');if(!root)return;await renderSocialCloudV27();const u=socialCloudUser();if(!u||!document.body.contains(root))return;
 const [net,community]=await Promise.all([fetchSocialNetwork(),fetchCommunityNetwork()]);if(!net||!community)return;const profiles=net.profiles||[],friends=community.friends||[],squads=community.squads||[],members=community.members||[],accepted=friends.filter(f=>f.status==='accepted'),friendIds=new Set(accepted.map(f=>f.requester_id===u.id?f.addressee_id:f.requester_id)),incoming=friends.filter(f=>f.status==='pending'&&f.addressee_id===u.id);
 const shell=root.querySelector('.social-v25');if(!shell)return;
 const friendProfiles=profiles.filter(p=>p.user_id===u.id||friendIds.has(p.user_id)).sort((a,b)=>b.xp-a.xp);
 shell.insertAdjacentHTML('beforeend','<section class="community-grid"><article class="social-card friend-command"><div class="social-head"><span>FRIENDS // NETWORK</span><b>'+accepted.length+' LINKED</b></div><div class="friend-requests">'+(incoming.length?incoming.map(f=>'<div><span><strong>'+escapeHtml(f.requester_name)+'</strong><small>REQUESTING FRIEND LINK</small></span><span><button data-friend-accept="'+f.id+'">ACCEPT</button><button data-friend-decline="'+f.id+'">DECLINE</button></span></div>').join(''):'<small>NO INCOMING FRIEND REQUESTS</small>')+'</div><div class="friend-leaderboard">'+friendProfiles.map((p,i)=>'<div><b>#'+(i+1)+'</b><span><strong>'+escapeHtml(p.display_name)+(p.user_id===u.id?' // YOU':'')+'</strong><small>LV '+p.level+' • '+escapeHtml(p.rank)+'</small></span><em>'+Number(p.xp).toLocaleString()+' XP</em></div>').join('')+'</div></article><article class="social-card squad-command"><div class="social-head"><span>SQUADS // GROUP OPS</span><b>'+squads.length+' ONLINE</b></div><form id="squadCreateForm"><input id="squadName" maxlength="40" placeholder="New squad name" required><button>CREATE SQUAD</button></form><div class="squad-list">'+squads.map(s=>{const sm=members.filter(m=>m.squad_id===s.id),mine=sm.some(m=>m.user_id===u.id);return '<div class="squad-row"><span><strong>'+escapeHtml(s.name)+'</strong><small>'+sm.length+' MEMBER'+(sm.length===1?'':'S')+' • '+(s.owner_id===u.id?'COMMANDER':'GROUP')+'</small></span><button '+(s.owner_id===u.id?'disabled':mine?'data-squad-leave="'+s.id+'"':'data-squad-join="'+s.id+'"')+'>'+(s.owner_id===u.id?'YOUR SQUAD':mine?'LEAVE':'JOIN')+'</button></div>'}).join('')+'</div></article></section>');
 const discovery=document.getElementById('playerSearchResults');if(discovery){const search=document.getElementById('networkPlayerSearch');let t;search.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{const q=search.value.trim().toLowerCase();discovery.innerHTML=q.length<2?'':profiles.filter(p=>p.user_id!==u.id&&p.display_name.toLowerCase().includes(q)).slice(0,6).map(p=>'<div class="player-result"><button type="button" data-player-pick="'+escapeHtml(p.display_name)+'"><span>'+escapeHtml(p.display_name)+'</span><small>LV '+p.level+' • '+escapeHtml(p.rank)+'</small></button>'+(friendIds.has(p.user_id)?'<b>FRIEND</b>':'<button class="friend-add" data-friend-id="'+p.user_id+'" data-friend-name="'+escapeHtml(p.display_name)+'">+ FRIEND</button>')+'</div>').join('')||'<small class="no-player">NO MATCHING PLAYER</small>';discovery.querySelectorAll('[data-player-pick]').forEach(b=>b.onclick=()=>{document.getElementById('challengePlayer').value=b.dataset.playerPick;search.value=b.dataset.playerPick;discovery.innerHTML=''});discovery.querySelectorAll('[data-friend-id]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.friendId,b.dataset.friendName))},180)}}
 root.querySelectorAll('[data-friend-accept]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.friendAccept,'accepted'));root.querySelectorAll('[data-friend-decline]').forEach(b=>b.onclick=()=>respondFriend(b.dataset.friendDecline,'declined'));document.getElementById('squadCreateForm').onsubmit=e=>{e.preventDefault();const n=document.getElementById('squadName').value.trim();if(n.length>=2)createSquad(n)};root.querySelectorAll('[data-squad-join]').forEach(b=>b.onclick=()=>joinSquad(b.dataset.squadJoin));root.querySelectorAll('[data-squad-leave]').forEach(b=>b.onclick=()=>leaveSquad(b.dataset.squadLeave));
}
renderSocialCommand=renderCommunityV28;
