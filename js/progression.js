/* BridgeLearn V15 — Learning Progression Engine */
'use strict';

const BLProg = (() => {
  const PROG_KEY = 'bl15_progress';

  /* ── Progress data structure ─────────────────────────────────
   {
     subjectId: {
       topicsComplete: ['topic1','topic2'],
       quizScores: { topicId: { score, total, attempts } },
       lastVisited: timestamp,
       masteryPct: 0-100,
     },
     'lang_en': { sessions:0, mode:'daily-conversation', level:'Beginner' },
     daily: { date:'...', lessonsToday:0, goalMet: false },
     roadmap: { currentSubject, currentTopic, suggestedNext:[] },
   }
  ─────────────────────────────────────────────────────────── */

  function load()     { return BL.tryJSON(localStorage.getItem(PROG_KEY), {}); }
  function save(p)    { localStorage.setItem(PROG_KEY, JSON.stringify(p)); BLStorage.saveProgress(p); }

  /* ── Daily tracking ─────────────────────────────────────────── */
  function ensureDaily(p) {
    const today = BL.today();
    if (!p.daily || p.daily.date !== today) {
      p.daily = { date: today, lessonsToday: 0, quizzesToday: 0, goalMet: false };
    }
    return p;
  }

  function getDailyStats() {
    const p = load();
    const d = p.daily || {};
    return { lessonsToday: d.lessonsToday || 0, quizzesToday: d.quizzesToday || 0, goalMet: d.goalMet || false };
  }

  /* ── Lesson completion ──────────────────────────────────────── */
  function completeLesson(subjectId, topicId) {
    const p = ensureDaily(load());
    if (!p[subjectId]) p[subjectId] = { topicsComplete: [], quizScores: {}, lastVisited: 0, masteryPct: 0 };
    const sub = p[subjectId];
    if (!sub.topicsComplete.includes(topicId)) sub.topicsComplete.push(topicId);
    sub.lastVisited = Date.now();
    p.daily.lessonsToday++;
    if (p.daily.lessonsToday >= 3) p.daily.goalMet = true;
    // Update roadmap
    p.roadmap = updateRoadmap(p, subjectId, topicId);
    save(p);
    BLGam.recordLesson(subjectId);
    return sub;
  }

  /* ── Quiz score ─────────────────────────────────────────────── */
  function recordQuizScore(subjectId, topicId, score, total) {
    const p = ensureDaily(load());
    if (!p[subjectId]) p[subjectId] = { topicsComplete: [], quizScores: {}, lastVisited: 0, masteryPct: 0 };
    const sub = p[subjectId];
    const prev = sub.quizScores[topicId] || { score: 0, total: 0, attempts: 0 };
    sub.quizScores[topicId] = {
      score:    Math.max(prev.score, score), // keep best
      total,
      attempts: prev.attempts + 1,
      lastAttempt: Date.now(),
    };
    sub.masteryPct = calcMastery(sub);
    p.daily.quizzesToday++;
    save(p);
    BLGam.recordQuiz(score, total, score === total);
  }

  /* ── Mastery calculation ────────────────────────────────────── */
  function calcMastery(subState) {
    const scores = Object.values(subState.quizScores || {});
    if (!scores.length) return 0;
    const avg = scores.reduce((a, s) => a + BL.pct(s.score, s.total), 0) / scores.length;
    return Math.round(avg);
  }

  /* ── Subject progress ───────────────────────────────────────── */
  function getSubjectProgress(subjectId) {
    const p = load();
    return p[subjectId] || { topicsComplete: [], quizScores: {}, masteryPct: 0 };
  }

  function getTopicsComplete(subjectId) {
    return (load()[subjectId]?.topicsComplete) || [];
  }

  function isTopicComplete(subjectId, topicId) {
    return getTopicsComplete(subjectId).includes(topicId);
  }

  function getSubjectPct(subjectId, totalTopics) {
    const done = getTopicsComplete(subjectId).length;
    return BL.pct(done, totalTopics || 1);
  }

  /* ── Weak areas ─────────────────────────────────────────────── */
  function getWeakAreas(subjects) {
    const p = load();
    const weak = [];
    (subjects || []).forEach(s => {
      const sp = p[s.id];
      if (!sp) return;
      Object.entries(sp.quizScores || {}).forEach(([topicId, q]) => {
        if (BL.pct(q.score, q.total) < 60) {
          const topic = (s.topics || []).find(t => t.id === topicId);
          if (topic) weak.push({ subjectId: s.id, subjectName: s.name, topicId, topicTitle: topic.title, score: BL.pct(q.score, q.total) });
        }
      });
    });
    return weak.sort((a,b) => a.score - b.score).slice(0, 5);
  }

  /* ── Roadmap ────────────────────────────────────────────────── */
  function updateRoadmap(p, subjectId, completedTopicId) {
    return { currentSubject: subjectId, lastCompleted: completedTopicId, updatedAt: Date.now() };
  }

  function getRecommended(subjects, country, ageGroup) {
    const p = load();
    const suggestions = [];
    // Continue incomplete subjects
    (subjects || []).filter(s => {
      const sp = p[s.id];
      const done = sp?.topicsComplete?.length || 0;
      const total = s.topics?.length || 0;
      return done > 0 && done < total;
    }).slice(0, 2).forEach(s => {
      const sp = p[s.id];
      const nextTopic = s.topics?.find(t => !sp.topicsComplete.includes(t.id));
      if (nextTopic) suggestions.push({ type:'continue', subject: s, topic: nextTopic, label:'Continue' });
    });
    // Suggest weak areas
    const weak = getWeakAreas(subjects);
    if (weak[0]) {
      const sub = subjects.find(s => s.id === weak[0].subjectId);
      const topic = sub?.topics?.find(t => t.id === weak[0].topicId);
      if (sub && topic) suggestions.push({ type:'review', subject: sub, topic, label:'Review' });
    }
    return suggestions.slice(0, 3);
  }

  /* ── Language progress ──────────────────────────────────────── */
  function recordLangSession(langCode, mode, level) {
    const p = load();
    const key = `lang_${langCode}`;
    if (!p[key]) p[key] = { sessions: 0, mode, level };
    p[key].sessions++;
    p[key].mode  = mode;
    p[key].level = level;
    p[key].lastSession = Date.now();
    save(p);
  }

  function getLangProgress(langCode) {
    return load()[`lang_${langCode}`] || { sessions: 0 };
  }

  /* ── Overall stats ──────────────────────────────────────────── */
  function getOverallStats(subjects) {
    const p    = load();
    let totalComplete = 0, totalTopics = 0;
    (subjects || []).forEach(s => {
      totalComplete += (p[s.id]?.topicsComplete?.length || 0);
      totalTopics   += (s.topics?.length || 0);
    });
    return { totalComplete, totalTopics, overallPct: BL.pct(totalComplete, totalTopics) };
  }

  /* ── Daily goal ─────────────────────────────────────────────── */
  function getDailyGoal() {
    const { lessonsToday, goalMet } = getDailyStats();
    const target = 3;
    return { current: lessonsToday, target, pct: BL.pct(lessonsToday, target), met: goalMet };
  }

  return {
    completeLesson, recordQuizScore, recordLangSession,
    getSubjectProgress, getTopicsComplete, isTopicComplete, getSubjectPct,
    getWeakAreas, getRecommended, getOverallStats,
    getDailyStats, getDailyGoal, getLangProgress,
  };
})();

window.BLProg = BLProg;
