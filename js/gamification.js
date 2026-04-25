/* BridgeLearn V15 — Gamification Engine
   XP · Coins · Streaks · Badges · Levels · Daily Quests */
'use strict';

const BLGam = (() => {
  const KEY = 'bl15_gam';

  /* ── XP Levels ─────────────────────────────────────────────── */
  const LEVELS = [
    { level:1,  name:'Seedling',      emoji:'🌱', minXP:0      },
    { level:2,  name:'Sprout',        emoji:'🌿', minXP:200    },
    { level:3,  name:'Explorer',      emoji:'🔭', minXP:500    },
    { level:4,  name:'Learner',       emoji:'📚', minXP:1000   },
    { level:5,  name:'Scholar',       emoji:'🎓', minXP:2000   },
    { level:6,  name:'Champion',      emoji:'🏆', minXP:3500   },
    { level:7,  name:'Master',        emoji:'⚡', minXP:5500   },
    { level:8,  name:'Genius',        emoji:'🧠', minXP:8500   },
    { level:9,  name:'Legend',        emoji:'👑', minXP:13000  },
    { level:10, name:'Grand Master',  emoji:'🌟', minXP:20000  },
  ];

  /* ── Badges ─────────────────────────────────────────────────── */
  const BADGES = [
    // Milestone
    { id:'first_lesson',    name:'First Step',        emoji:'👣', desc:'Complete your first lesson',              xp:50  },
    { id:'lessons_10',      name:'Eager Learner',     emoji:'📚', desc:'Complete 10 lessons',                     xp:150 },
    { id:'lessons_50',      name:'Knowledge Seeker',  emoji:'🎓', desc:'Complete 50 lessons',                     xp:400 },
    { id:'lessons_100',     name:'Century Scholar',   emoji:'💯', desc:'Complete 100 lessons',                    xp:800 },
    // Quiz
    { id:'quiz_first',      name:'Quiz Starter',      emoji:'📝', desc:'Complete your first quiz',                xp:50  },
    { id:'quiz_master',     name:'Quiz Master',       emoji:'🏆', desc:'Complete 25 quizzes',                     xp:300 },
    { id:'perfect_quiz',    name:'Perfect Score',     emoji:'💯', desc:'Score 100% on any quiz',                  xp:200 },
    { id:'speed_demon',     name:'Speed Demon',       emoji:'⚡', desc:'Answer 5 questions in under 30s',          xp:200 },
    // Streak
    { id:'streak_3',        name:'On Fire',           emoji:'🔥', desc:'3-day learning streak',                   xp:100 },
    { id:'streak_7',        name:'Week Warrior',      emoji:'💪', desc:'7-day learning streak',                   xp:300 },
    { id:'streak_30',       name:'Monthly Legend',    emoji:'👑', desc:'30-day learning streak',                  xp:1000},
    // Language
    { id:'lang_start',      name:'Hello World',       emoji:'🌐', desc:'Start your first language session',       xp:80  },
    { id:'lang_sessions_5', name:'Polyglot',          emoji:'💬', desc:'Complete 5 language sessions',            xp:250 },
    { id:'bilingual',       name:'Bilingual',         emoji:'🗣️', desc:'Practice 2 different languages',           xp:400 },
    // Games
    { id:'game_first',      name:'Game On',           emoji:'🎮', desc:'Play your first game',                    xp:50  },
    { id:'game_win_5',      name:'Game Champion',     emoji:'🥇', desc:'Win 5 games',                             xp:200 },
    { id:'spelling_bee',    name:'Spelling Bee',      emoji:'🐝', desc:'Win Spelling Challenge',                  xp:150 },
    { id:'math_wizard',     name:'Math Wizard',       emoji:'🧙', desc:'Win Math Sprint on Hard',                 xp:200 },
    // Explorer
    { id:'explorer_10',     name:'World Explorer',    emoji:'🌍', desc:'Visit 10 different countries',            xp:200 },
    { id:'all_states',      name:'USA Expert',        emoji:'🦅', desc:'Visit all 50 US states',                  xp:500 },
    // Subjects
    { id:'subject_master',  name:'Subject Master',    emoji:'⭐', desc:'Complete all topics in one subject',      xp:500 },
    { id:'multi_subject',   name:'All-Rounder',       emoji:'🎯', desc:'Learn in 5 different subjects',           xp:300 },
    // Coins
    { id:'coins_100',       name:'Piggy Bank',        emoji:'🐷', desc:'Collect 100 coins',                       xp:0   },
    { id:'coins_500',       name:'Money Bags',        emoji:'💰', desc:'Collect 500 coins',                       xp:0   },
    // Special
    { id:'safety_pro',      name:'Safety Pro',        emoji:'🛡️', desc:'Read all safety rules',                   xp:100 },
    { id:'ai_friend',       name:'AI Friend',         emoji:'🤖', desc:'Have 10 AI tutor conversations',         xp:150 },
    { id:'night_owl',       name:'Night Owl',         emoji:'🦉', desc:'Study after 9pm',                         xp:80  },
    { id:'early_bird',      name:'Early Bird',        emoji:'🐦', desc:'Study before 7am',                        xp:80  },
    { id:'parent_share',    name:'Team Player',       emoji:'👨‍👩‍👦', desc:'Share progress with parent',              xp:100 },
  ];

  /* ── Daily quests ───────────────────────────────────────────── */
  const QUEST_POOL = [
    { id:'q_lessons_3',  desc:'Complete 3 lessons today',           target:3,  type:'lessons',  reward:{xp:60,  coins:20} },
    { id:'q_quiz_2',     desc:'Complete 2 quizzes today',           target:2,  type:'quizzes',  reward:{xp:50,  coins:15} },
    { id:'q_quiz_perfect',desc:'Get a perfect quiz score',          target:1,  type:'perfect',  reward:{xp:100, coins:30} },
    { id:'q_game_1',     desc:'Win a game today',                   target:1,  type:'game_win', reward:{xp:40,  coins:12} },
    { id:'q_lang_1',     desc:'Practice a language today',          target:1,  type:'lang',     reward:{xp:70,  coins:20} },
    { id:'q_ai_chat',    desc:'Have 3 AI tutor conversations',      target:3,  type:'ai_chat',  reward:{xp:45,  coins:15} },
    { id:'q_vocab',      desc:'Study 5 new vocabulary words',       target:5,  type:'vocab',    reward:{xp:35,  coins:10} },
    { id:'q_streak',     desc:'Keep your learning streak alive',    target:1,  type:'streak',   reward:{xp:30,  coins:8 } },
  ];

  /* ── State ──────────────────────────────────────────────────── */
  function defaultState() {
    return {
      xp:0, coins:0, streak:0, lastActive:null,
      badges:[], subjectsLearned:[], langsUsed:[],
      quizzesCompleted:0, perfectQuizzes:0, lessonsCompleted:0,
      gamesWon:0, gamesPlayed:0, langSessions:0,
      aiChats:0, countriesVisited:[], statesVisited:[],
      dailyQuests: null, questDate: null, questProgress:{},
      totalQuestionsCorrect:0, weeklyXP:0, weeklyDate:null,
      history:[],
    };
  }

  function load() { return BL.tryJSON(localStorage.getItem(KEY), null) || defaultState(); }
  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
    BLStorage.saveGam(s);
  }

  /* ── Init / restore ─────────────────────────────────────────── */
  function init() {
    const saved = BLStorage.loadGam();
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
    refreshDailyQuests();
  }

  /* ── XP + Coins ─────────────────────────────────────────────── */
  function addXP(amount, reason = '') {
    const s = load();
    const prevLevel = getLevel(s.xp);
    s.xp += amount;
    s.weeklyXP = (s.weeklyDate === BL.today() ? s.weeklyXP : 0) + amount;
    s.weeklyDate = BL.today();
    s.history.unshift({ type:'xp', amount, reason, ts: Date.now() });
    if (s.history.length > 80) s.history.pop();
    save(s);
    const newLevel = getLevel(s.xp);
    if (newLevel.level > prevLevel.level) {
      onLevelUp(newLevel);
    }
    showXPFloat(amount);
    BL.emit('gam:xp', { amount, total: s.xp });
    return s.xp;
  }

  function addCoins(amount, reason = '') {
    const s = load();
    s.coins += amount;
    save(s);
    checkBadge(s, 'coins_100', s.coins >= 100);
    checkBadge(s, 'coins_500', s.coins >= 500);
    BL.emit('gam:coins', { amount, total: s.coins });
    showCoinFloat(amount);
    return s.coins;
  }

  /* ── Streak ─────────────────────────────────────────────────── */
  function updateStreak() {
    const s = load();
    const today     = BL.today();
    const yesterday = BL.yesterday();
    if (s.lastActive === today) return s.streak;
    const isFirstEver = !s.lastActive; // true on very first session
    if (s.lastActive === yesterday) s.streak++;
    else s.streak = 1;
    s.lastActive = today;
    save(s);
    checkBadge(s, 'streak_3', s.streak >= 3);
    checkBadge(s, 'streak_7', s.streak >= 7);
    checkBadge(s, 'streak_30', s.streak >= 30);
    // Only award time-based badges after first session (so welcome boot is silent)
    if (!isFirstEver) {
      const h = new Date().getHours();
      if (h >= 21) checkBadge(s, 'night_owl', true);
      if (h < 7)   checkBadge(s, 'early_bird', true);
    }
    return s.streak;
  }

  /* ── Record actions ─────────────────────────────────────────── */
  function recordLesson(subjectId) {
    const s = load();
    s.lessonsCompleted++;
    if (subjectId && !s.subjectsLearned.includes(subjectId)) {
      s.subjectsLearned.push(subjectId);
      checkBadge(s, 'multi_subject', s.subjectsLearned.length >= 5);
    }
    save(s);
    checkBadge(s, 'first_lesson', s.lessonsCompleted >= 1);
    checkBadge(s, 'lessons_10',   s.lessonsCompleted >= 10);
    checkBadge(s, 'lessons_50',   s.lessonsCompleted >= 50);
    checkBadge(s, 'lessons_100',  s.lessonsCompleted >= 100);
    addXP(30, 'Lesson completed');
    addCoins(10);
    updateStreak();
    updateQuestProgress('lessons', 1);
  }

  function recordQuiz(score, total, isPerfect) {
    const s = load();
    s.quizzesCompleted++;
    s.totalQuestionsCorrect += score;
    if (isPerfect) s.perfectQuizzes++;
    save(s);
    checkBadge(s, 'quiz_first',  s.quizzesCompleted >= 1);
    checkBadge(s, 'quiz_master', s.quizzesCompleted >= 25);
    if (isPerfect) checkBadge(s, 'perfect_quiz', true);
    const xp = Math.round((score/total)*80) + (isPerfect ? 50 : 0);
    addXP(xp, `Quiz ${score}/${total}`);
    addCoins(score * 4);
    updateStreak();
    updateQuestProgress('quizzes', 1);
    if (isPerfect) updateQuestProgress('perfect', 1);
  }

  function recordGame(gameId, won = false) {
    const s = load();
    s.gamesPlayed++;
    if (won) s.gamesWon++;
    save(s);
    checkBadge(s, 'game_first',  s.gamesPlayed >= 1);
    checkBadge(s, 'game_win_5',  s.gamesWon >= 5);
    addXP(won ? 80 : 20, `Game: ${gameId}`);
    addCoins(won ? 25 : 5);
    updateQuestProgress('game_win', won ? 1 : 0);
  }

  function recordLangSession(langCode) {
    const s = load();
    s.langSessions++;
    if (langCode && !s.langsUsed.includes(langCode)) {
      s.langsUsed.push(langCode);
      if (s.langsUsed.length >= 2) checkBadge(s, 'bilingual', true);
    }
    save(s);
    checkBadge(s, 'lang_start',      s.langSessions >= 1);
    checkBadge(s, 'lang_sessions_5', s.langSessions >= 5);
    addXP(50, 'Language session');
    addCoins(15);
    updateStreak();
    updateQuestProgress('lang', 1);
  }

  function recordAIChat() {
    const s = load(); s.aiChats++; save(s);
    checkBadge(s, 'ai_friend', s.aiChats >= 10);
    updateQuestProgress('ai_chat', 1);
  }

  function recordCountryVisit(code) {
    const s = load();
    if (!s.countriesVisited.includes(code)) {
      s.countriesVisited.push(code);
      save(s);
      checkBadge(s, 'explorer_10', s.countriesVisited.length >= 10);
      addXP(15, `Explored ${code}`);
    }
  }

  function recordStateVisit(code) {
    const s = load();
    if (!s.statesVisited.includes(code)) {
      s.statesVisited.push(code);
      save(s);
      checkBadge(s, 'all_states', s.statesVisited.length >= 50);
      addXP(8, `Visited ${code}`);
    }
  }

  function recordSubjectComplete(subjectId) {
    checkBadge(load(), 'subject_master', true);
    addXP(300, `Mastered ${subjectId}`);
    addCoins(100);
  }

  /* ── Badge checker ─────────────────────────────────────────── */
  function checkBadge(s, id, condition) {
    if (!condition || s.badges.includes(id)) return;
    const badge = BADGES.find(b => b.id === id);
    if (!badge) return;
    s.badges.push(id);
    save(s);
    if (badge.xp > 0) addXP(badge.xp, `Badge: ${badge.name}`);
    showBadgeToast(badge);
    BL.emit('gam:badge', badge);
  }

  function earnBadge(id) {
    const s = load();
    checkBadge(s, id, true);
  }

  /* ── Level helpers ─────────────────────────────────────────── */
  function getLevel(xp) {
    let cur = LEVELS[0];
    for (const lv of LEVELS) { if (xp >= lv.minXP) cur = lv; else break; }
    return cur;
  }
  function getNextLevel(xp) {
    const idx = LEVELS.findIndex(l => l.minXP > xp);
    return idx === -1 ? null : LEVELS[idx];
  }
  function getLevelPct(xp) {
    const cur = getLevel(xp), nxt = getNextLevel(xp);
    if (!nxt) return 100;
    return BL.clamp(Math.round((xp - cur.minXP) / (nxt.minXP - cur.minXP) * 100), 0, 100);
  }

  function onLevelUp(level) {
    BL.toast(level.emoji, 'Level Up!', `You\'re now a ${level.name}!`, 'toast-gold');
    BL.confetti(30);
    BLVoice?.speak(`Congratulations! You reached level ${level.level}: ${level.name}!`, 'en');
    BL.emit('gam:levelup', level);
  }

  /* ── Daily quests ───────────────────────────────────────────── */
  function refreshDailyQuests() {
    const s = load();
    if (s.questDate === BL.today()) return;
    // Pick 3 random quests
    s.dailyQuests   = BL.shuffle(QUEST_POOL).slice(0, 3).map(q => q.id);
    s.questDate     = BL.today();
    s.questProgress = {};
    save(s);
  }

  function getDailyQuests() {
    const s = load();
    return (s.dailyQuests || []).map(id => {
      const q = QUEST_POOL.find(q => q.id === id);
      return { ...q, progress: s.questProgress[id] || 0, done: (s.questProgress[id] || 0) >= q.target };
    });
  }

  function updateQuestProgress(type, increment) {
    const s = load();
    (s.dailyQuests || []).forEach(id => {
      const q = QUEST_POOL.find(q => q.id === id);
      if (!q || q.type !== type) return;
      const prev = s.questProgress[id] || 0;
      if (prev >= q.target) return;
      s.questProgress[id] = prev + increment;
      if (s.questProgress[id] >= q.target) {
        // Quest complete!
        addXP(q.reward.xp, `Quest: ${q.desc}`);
        addCoins(q.reward.coins, 'Quest');
        BL.toast('🎯', 'Quest Complete!', q.desc, 'toast-gold');
        BL.emit('gam:quest', q);
      }
    });
    save(s);
  }

  /* ── Getters ────────────────────────────────────────────────── */
  function getStats() {
    const s = load();
    const lv = getLevel(s.xp);
    const nx = getNextLevel(s.xp);
    return {
      ...s,
      level: lv, nextLevel: nx,
      levelPct: getLevelPct(s.xp),
    };
  }
  function getAllBadges()   { return BADGES; }
  function getEarnedBadges(){ const s=load(); return BADGES.filter(b=>s.badges.includes(b.id)); }

  /* ── Toast helpers ──────────────────────────────────────────── */
  function showXPFloat(amount) {
    const el = document.createElement('div');
    el.textContent = `+${amount} XP`;
    el.style.cssText = 'position:fixed;top:70px;right:16px;background:var(--accent);color:#fff;padding:6px 14px;border-radius:20px;font-weight:800;font-size:13px;z-index:9999;animation:toastIn 0.3s ease,toastOut 0.3s ease 1.5s forwards;pointer-events:none';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
  function showCoinFloat(amount) {
    const el = document.createElement('div');
    el.textContent = `+${amount} 🪙`;
    el.style.cssText = 'position:fixed;top:110px;right:16px;background:#f9a825;color:#fff;padding:6px 14px;border-radius:20px;font-weight:800;font-size:13px;z-index:9999;animation:toastIn 0.3s ease,toastOut 0.3s ease 1.5s forwards;pointer-events:none';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
  function showBadgeToast(badge) {
    BL.toast(badge.emoji, 'Badge Earned!', badge.name, 'toast-gold');
    BL.confetti(20);
    BLVoice?.speak(`You earned the ${badge.name} badge!`, 'en', 1.0, 1.1);
  }

  return {
    init, getStats, getAllBadges, getEarnedBadges, getLevel, getNextLevel, getLevelPct,
    addXP, addCoins, updateStreak, earnBadge,
    recordLesson, recordQuiz, recordGame, recordLangSession, recordAIChat,
    recordCountryVisit, recordStateVisit, recordSubjectComplete,
    getDailyQuests, refreshDailyQuests, updateQuestProgress,
    LEVELS, BADGES,
  };
})();

window.BLGam = BLGam;
