/* BridgeLearn V15 — Main Application Controller */
'use strict';

const BLApp = (() => {

  /* ── State ───────────────────────────────────────────────────── */
  let profile = {
    name:'', age:10, country:'USA', avatar:'🦁',
    theme:'light', ageGroup:'9-12', setupDone:false,
    parentPin:'', isParent:false, isTeacher:false,
    tutorChar:'maya', voiceEnabled:true, muteAudio:false,
  };
  let data = { subjects:[], quiz:[], countries:[], states:[], languages:null, achievements:[] };
  let state = {
    currentSubject:null, currentTopic:null,
    currentLang:null, currentMode:null, currentLevel:'Beginner',
    quizQ:[], quizIdx:0, quizScore:0, quizAnswered:false,
    quizTimer:null, quizBattle:false,
    setupStep:1,
  };

  /* ── Boot ───────────────────────────────────────────────────── */
  async function boot() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Load config from window.BL_CONFIG or meta tags
    loadRuntimeConfig();

    // Apply saved theme
    const savedProfile = BL.tryJSON(localStorage.getItem('bl15_profile'), null);
    if (savedProfile?.theme) applyTheme(savedProfile.theme);

    // Load all JSON data
    showLoadingState(true);
    const raw = await BLStorage.loadAll();
    data.subjects    = raw.subjects?.subjects    || [];
    data.quiz        = raw.quiz?.questions       || [];
    data.countries   = raw.countries?.countries  || [];
    data.states      = raw.states?.states        || [];
    data.languages   = raw.languages             || null;
    data.achievements= raw.achievements?.badges  || [];

    // Init sub-systems
    BLGam.init();
    if (data.languages) BLLang.init(data.languages);

    showLoadingState(false);

    // Register auth change handler FIRST, then trigger session check
    BLAuth.onAuthChange(user => {
      if (user) onSignedIn(user);
      else      BL.showScreen('welcome');
    });

    // Init Firebase or check local session AFTER handler is registered
    const cfg = window.BL_CONFIG || {};
    if (cfg.FIREBASE_API_KEY) {
      await BLAuth.initFirebase({
        apiKey:            cfg.FIREBASE_API_KEY,
        authDomain:        cfg.FIREBASE_AUTH_DOMAIN,
        projectId:         cfg.FIREBASE_PROJECT_ID,
        storageBucket:     cfg.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: cfg.FIREBASE_MESSAGING_SENDER_ID,
        appId:             cfg.FIREBASE_APP_ID,
      });
    } else {
      BLAuth.checkLocalSession();
    }
  }

  function loadRuntimeConfig() {
    // Support meta tag injection: <meta name="bl-config" content='{"FIREBASE_API_KEY":"..."}'>
    const meta = document.querySelector('meta[name="bl-config"]');
    if (meta) {
      try { window.BL_CONFIG = { ...(window.BL_CONFIG||{}), ...JSON.parse(meta.content) }; } catch {}
    }
  }

  function showLoadingState(on) {
    const el = document.getElementById('app-loading');
    if (el) el.classList.toggle('hidden', !on);
  }

  /* ── Auth events ────────────────────────────────────────────── */
  async function onSignedIn(user) {
    const savedProfile = await BLStorage.loadProfile();
    if (savedProfile) {
      profile = { ...profile, ...savedProfile };
    } else {
      profile.name = user.name || user.displayName || 'Learner';
    }
    applyTheme(profile.theme || 'light');
    BLAI.init({ ...profile });
    BLVoice.setMuted(profile.muteAudio);

    if (profile.setupDone) {
      enterApp();
    } else {
      BL.showScreen('setup');
      initSetup();
    }
  }

  function enterApp() {
    BLGam.updateStreak();
    renderDashboard();
    BL.showScreen('dashboard');
    // Render welcome character
    BLChars.renderWelcomeChar('dash-char-container');
    // Emit app ready
    BL.emit('app:ready');
  }

  /* ════════════════════════════════════════════════════════════
     AUTH SCREENS
     ════════════════════════════════════════════════════════════ */
  async function doLogin() {
    const email = BL.$('login-email')?.value.trim();
    const pass  = BL.$('login-pass')?.value;
    if (!email || !pass) return showAuthMsg('login', 'Please enter email and password.');
    clearAuthMsg('login');
    setAuthLoading('login', true);
    try {
      await BLAuth.signIn(email, pass);
    } catch(e) {
      showAuthMsg('login', 'Login failed. Check your email and password.');
    } finally { setAuthLoading('login', false); }
  }

  async function doSignup() {
    const name  = BL.$('signup-name')?.value.trim();
    const email = BL.$('signup-email')?.value.trim();
    const pass  = BL.$('signup-pass')?.value;
    if (!name || !email || !pass) return showAuthMsg('signup', 'Please fill in all fields.');
    if (pass.length < 6) return showAuthMsg('signup', 'Password must be at least 6 characters.');
    clearAuthMsg('signup');
    setAuthLoading('signup', true);
    try {
      await BLAuth.signUp(email, pass, name);
    } catch(e) {
      showAuthMsg('signup', e.message || 'Sign-up failed. Try a different email.');
    } finally { setAuthLoading('signup', false); }
  }

  async function doGoogleLogin() {
    try { await BLAuth.signInGoogle(); }
    catch(e) { showAuthMsg('login', 'Google sign-in failed. Please try again.'); }
  }

  async function doForgot() {
    const email = BL.$('forgot-email')?.value.trim();
    if (!email) return;
    try {
      await BLAuth.resetPassword(email);
      BL.toast('📧', 'Email sent!', 'Check your inbox for the reset link.');
      BL.showScreen('login');
    } catch(e) { showAuthMsg('forgot', 'Failed. Is that email registered?'); }
  }

  function doGuestLogin() {
    const user = BLAuth.guestLogin('Explorer');
    onSignedIn(user);
  }

  async function doLogout() {
    await BLAuth.signOutUser();
    BLStorage.clearLocal();
    BL.showScreen('welcome');
  }

  function showAuthMsg(form, msg) {
    const el = BL.$(`${form}-msg`);
    if (el) { el.textContent = msg; el.className = 'error-banner'; el.style.display = 'flex'; }
  }
  function clearAuthMsg(form) {
    const el = BL.$(`${form}-msg`);
    if (el) el.style.display = 'none';
  }
  function setAuthLoading(form, on) {
    const btn = BL.$(`${form}-btn`);
    if (btn) { btn.disabled = on; btn.textContent = on ? 'Please wait…' : btn.dataset.label || 'Submit'; }
  }

  /* ════════════════════════════════════════════════════════════
     SETUP FLOW
     ════════════════════════════════════════════════════════════ */
  function initSetup() {
    state.setupStep = 1;
    renderSetupStep();
  }

  function setupNext() {
    if (state.setupStep === 1) {
      profile.name    = BL.$('setup-name')?.value.trim() || 'Learner';
      profile.age     = parseInt(BL.$('setup-age')?.value) || 10;
      profile.country = BL.$('setup-country')?.value || 'USA';
      profile.ageGroup= BL.ageGroup(profile.age);
    }
    if (state.setupStep < 3) { state.setupStep++; renderSetupStep(); }
    else finishSetup();
  }

  function setupBack() {
    if (state.setupStep > 1) { state.setupStep--; renderSetupStep(); }
    else BL.showScreen('welcome');
  }

  function renderSetupStep() {
    document.querySelectorAll('.setup-step').forEach((el,i) => {
      el.classList.toggle('active', i + 1 === state.setupStep);
    });
    document.querySelectorAll('.step-dot').forEach((el,i) => {
      el.classList.toggle('active', i < state.setupStep);
    });
    BL.setHTML('setup-next-btn', state.setupStep === 3 ? '🚀 Start Learning!' : 'Next →');
    BL.$('setup-back-btn').style.display = state.setupStep === 1 ? 'none' : '';
  }

  function selectAvatar(emoji, el) {
    document.querySelectorAll('.avatar-opt').forEach(a => a.classList.remove('selected'));
    el.classList.add('selected');
    profile.avatar = emoji;
  }

  function toggleInterest(subj, el) {
    el.classList.toggle('selected');
  }

  function selectTutor(charId, el) {
    document.querySelectorAll('.tutor-opt').forEach(a => a.classList.remove('selected'));
    el.classList.add('selected');
    profile.tutorChar = charId;
  }

  function finishSetup() {
    profile.setupDone = true;
    applyTheme(profile.theme || 'light');
    BLStorage.saveProfile(profile);
    BLAI.init({ ...profile });
    BL.celebrate(
      profile.avatar || '🎉',
      `Welcome, ${profile.name}! 🎉`,
      'Your learning adventure starts now. Let\'s explore!',
      'Start Learning →',
      () => enterApp()
    );
  }

  /* ════════════════════════════════════════════════════════════
     DASHBOARD
     ════════════════════════════════════════════════════════════ */
  function renderDashboard() {
    const g   = BLGam.getStats();
    const age = profile.age;
    const h   = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

    BL.setHTML('dash-greeting', `${greet}!`);
    BL.setHTML('dash-name', `${profile.avatar || '🌟'} ${profile.name}`);

    // XP bar
    BL.setHTML('dash-level', `${g.level.emoji} ${g.level.name}`);
    BL.setHTML('dash-xp-text', `${BL.fmtNum(g.xp)} / ${BL.fmtNum(g.nextLevel?.minXP || g.xp)} XP`);
    BL.setStyle('dash-xp-fill', 'width', `${g.levelPct}%`);

    // Stats
    BL.setHTML('dash-coins',  `🪙 ${BL.fmtNum(g.coins)}`);
    BL.setHTML('dash-streak', `🔥 ${g.streak}`);
    BL.setHTML('dash-badges', `🏅 ${g.badges.length}`);

    // Daily goal
    const goal = BLProg.getDailyGoal();
    BL.setHTML('dash-goal-text', `${goal.current}/${goal.target} lessons today`);
    BL.setStyle('dash-goal-fill', 'width', `${goal.pct}%`);

    // Continue card
    renderContinueCard();

    // Subject grid
    renderSubjectGrid();

    // Daily quests
    renderDailyQuests();

    // Recommended
    renderRecommended();

    // Update tutor character emotion
    BLChars.render(profile.tutorChar || 'maya', 'dash-char-container', 120, 'idle', 'anim-wave');
  }

  function renderContinueCard() {
    const prog = BLStorage.loadProgressLocal();
    // Find most recently visited subject
    let recent = null, recentTs = 0;
    data.subjects.forEach(s => {
      const sp = prog[s.id];
      if (sp?.lastVisited > recentTs) { recentTs = sp.lastVisited; recent = { subject: s, sp }; }
    });
    const el = BL.$('continue-card');
    if (!el) return;
    if (recent) {
      const done  = recent.sp.topicsComplete?.length || 0;
      const total = recent.subject.topics?.length || 1;
      el.innerHTML = `
        <div class="continue-icon">${recent.subject.emoji || recent.subject.icon || '📚'}</div>
        <div style="flex:1">
          <div class="continue-label">Continue Learning</div>
          <div class="continue-title">${recent.subject.name}</div>
          <div class="continue-prog">${done}/${total} topics · ${BL.pct(done,total)}% complete</div>
        </div>
        <div style="font-size:1.4rem">›</div>`;
      el.onclick = () => openSubject(recent.subject.id);
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  function renderSubjectGrid() {
    const grid = BL.$('subject-grid');
    if (!grid || !data.subjects.length) {
      if (grid) grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><p>Loading subjects…</p></div>';
      return;
    }
    const COLORS = {
      math:'#6c63ff', science:'#43e97b', english:'#f5576c', reading:'#f093fb',
      writing:'#4facfe', spelling:'#f9a825', grammar:'#56ccf2', history:'#ff6b35',
      geography:'#43e97b', civics:'#667eea', coding:'#4facfe', technology:'#00cec9',
      'ai-basics':'#a29bfe', robotics:'#fd79a8', space:'#2d3436', money:'#f9a825',
      health:'#00b894', safety:'#e17055', art:'#fd79a8', music:'#a29bfe',
      chess:'#2d3436', agriculture:'#55efc4', languages:'#667eea', default:'#6c63ff',
    };
    // Filter age-appropriate + country-appropriate subjects
    const visible = data.subjects.filter(s => {
      // Country filter: Hindi/Tamil default only for India
      if (['hindi','tamil'].includes(s.id) && !BL.isCountry(profile.country,'india')) return false;
      return true;
    });
    grid.innerHTML = visible.map(s => {
      const color = COLORS[s.id] || COLORS.default;
      const pct   = BLProg.getSubjectPct(s.id, s.topics?.length);
      return `<div class="subject-card card-lift" style="--subject-color:${color}" onclick="BLApp.openSubject('${s.id}')" data-subject="${s.id}">
        <div class="s-icon">${s.emoji || s.icon || '📚'}</div>
        <div class="s-name">${s.name}</div>
        <div class="s-bar"><div class="s-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  function renderDailyQuests() {
    const el = BL.$('daily-quests');
    if (!el) return;
    const quests = BLGam.getDailyQuests();
    el.innerHTML = quests.map(q => `
      <div class="topic-row ${q.done?'opacity-50':''}">
        <div class="tr-icon">${q.done ? '✅' : '🎯'}</div>
        <div class="tr-info">
          <div class="tr-title">${q.desc}</div>
          <div class="tr-meta">${q.progress}/${q.target} · +${q.reward.xp}XP · +${q.reward.coins}🪙</div>
        </div>
        ${q.done ? '' : '<div class="tr-status" style="font-size:0.7rem;background:var(--accent);color:#fff;padding:0.15rem 0.4rem;border-radius:6px">+${q.reward.xp}XP</div>'}
      </div>`).join('');
  }

  function renderRecommended() {
    const el = BL.$('recommended-list');
    if (!el) return;
    const recs = BLProg.getRecommended(data.subjects, profile.country, profile.ageGroup);
    if (!recs.length) { el.innerHTML = ''; return; }
    el.innerHTML = recs.map(r => `
      <div class="topic-row" onclick="BLApp.openTopic('${r.subject.id}','${r.topic.id}')">
        <div class="tr-icon">${r.subject.emoji || r.subject.icon || '📚'}</div>
        <div class="tr-info">
          <div class="tr-title">${r.topic.title}</div>
          <div class="tr-meta">${r.label} · ${r.subject.name}</div>
        </div>
        <div class="tr-status">›</div>
      </div>`).join('');
  }

  /* ════════════════════════════════════════════════════════════
     SUBJECT & LESSON
     ════════════════════════════════════════════════════════════ */
  function openSubject(subjectId) {
    const subject = data.subjects.find(s => s.id === subjectId);
    if (!subject) return BL.toast('⚠️', 'Subject not found', '');
    state.currentSubject = subject;

    BL.setHTML('subject-name', subject.name);
    BL.setHTML('subject-icon', subject.emoji || subject.icon || '📚');
    BL.setHTML('subject-desc', subject.desc || subject.description || `Explore ${subject.name} topics`);

    // Set tutor character for this subject
    const tutor = BLChars.tutorForSubject(subjectId);
    BLChars.render(tutor.name.toLowerCase().split(' ')[1] || profile.tutorChar,
                   'subject-char', 90, 'idle');

    renderTopicList(subject);
    BL.showScreen('subject');
  }

  function renderTopicList(subject) {
    const list = BL.$('topic-list');
    if (!list) return;
    const done = BLProg.getTopicsComplete(subject.id);
    const topics = (subject.topics || []).filter(t => {
      // Age-group filter
      if (t.age_group && !t.age_group.split(',').some(ag => ag.trim() === profile.ageGroup)) return false;
      return true;
    });

    if (!topics.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><p>No topics available for your age group yet.</p></div>';
      return;
    }

    list.innerHTML = topics.map((t, i) => {
      const isDone   = done.includes(t.id);
      const isLocked = i > 0 && !done.includes(topics[i-1]?.id) && !isDone;
      return `<div class="topic-row ${isLocked?'locked':''}"
        onclick="${isLocked ? '' : `BLApp.openTopic('${subject.id}','${t.id}')`}">
        <div class="tr-icon">${t.emoji || t.icon || (isDone ? '✅' : isLocked ? '🔒' : '📖')}</div>
        <div class="tr-info">
          <div class="tr-title">${t.title}</div>
          <div class="tr-meta">${t.age_group || 'All ages'}${t.duration ? ' · ' + t.duration + ' min' : ''}</div>
        </div>
        <div class="tr-status">${isDone ? '✅' : isLocked ? '🔒' : '›'}</div>
      </div>`;
    }).join('');
  }

  function openTopic(subjectId, topicId) {
    const subject = data.subjects.find(s => s.id === subjectId) || state.currentSubject;
    const topic   = subject?.topics?.find(t => t.id === topicId);
    if (!topic) return BL.toast('⚠️', 'Topic not found', '');
    state.currentSubject = subject;
    state.currentTopic   = topic;

    BL.setHTML('lesson-title',   topic.title);
    BL.setHTML('lesson-subject', subject.name);

    // Build lesson content
    let html = '';
    if (topic.intro) {
      html += `<div class="lesson-section">
        <div class="lesson-section-title">🎯 Introduction</div>
        <div class="lesson-text">${topic.intro}</div></div>`;
    }
    if (topic.content) {
      html += `<div class="lesson-section">
        <div class="lesson-section-title">📖 Lesson</div>
        <div class="lesson-text">${topic.content}</div></div>`;
    }
    if (topic.key_facts?.length) {
      html += `<div class="lesson-section">
        <div class="lesson-section-title">⚡ Key Facts</div>
        ${topic.key_facts.map(f => `<div class="key-fact"><span class="fact-icon">💡</span>${f}</div>`).join('')}
      </div>`;
    }
    if (topic.vocabulary?.length) {
      html += `<div class="lesson-section">
        <div class="lesson-section-title">📝 Vocabulary</div>
        <div class="vocab-grid">
          ${topic.vocabulary.map(v => `<div class="vocab-card">
            <div class="vocab-word">${v.word}</div>
            <div class="vocab-def">${v.definition}</div>
          </div>`).join('')}
        </div></div>`;
    }
    if (topic.fun_activity) {
      html += `<div class="lesson-section">
        <div class="lesson-section-title">🎮 Activity</div>
        <div class="activity-card"><p>${topic.fun_activity}</p></div>
      </div>`;
    }
    BL.setHTML('lesson-body', html || '<div class="empty-state"><div class="empty-icon">📖</div><p>Lesson content loading…</p></div>');

    // Mark complete + update AI
    BLProg.completeLesson(subject.id, topic.id);
    BLAI.setContext({ subjectId: subject.id, topicId: topic.id });

    // Render lesson tutor
    const tutor = BLChars.tutorForSubject(subject.id);
    BLChars.render(Object.keys(BLChars.CHARS).find(k => BLChars.CHARS[k].name === tutor.name) || 'maya',
                   'lesson-char', 80, 'idle');

    BL.showScreen('lesson');
  }

  /* ════════════════════════════════════════════════════════════
     QUIZ ENGINE
     ════════════════════════════════════════════════════════════ */
  function openQuizSelect() {
    const el = BL.$('quiz-categories');
    if (!el) { BL.showScreen('quiz-select'); return; }
    const subjects = [...new Set(data.quiz.map(q => q.subjectId || q.subject).filter(Boolean))];
    el.innerHTML = [
      { id:'all', icon:'🎲', name:'Mixed Quiz', count: data.quiz.length },
      ...subjects.map(s => {
        const sub = data.subjects.find(x => x.id === s);
        return { id:s, icon: sub?.emoji||sub?.icon||'📚', name: sub?.name||s, count: data.quiz.filter(q=>(q.subjectId||q.subject)===s).length };
      })
    ].map(c => `<div class="topic-row" onclick="BLApp.startQuizCategory('${c.id}')">
        <div class="tr-icon">${c.icon}</div>
        <div class="tr-info">
          <div class="tr-title">${c.name}</div>
          <div class="tr-meta">${c.count} questions</div>
        </div>
        <div class="tr-status">›</div>
      </div>`).join('');
    BL.showScreen('quiz-select');
  }

  function startQuizCategory(catId, isBattle = false) {
    let pool = catId === 'all' ? data.quiz : data.quiz.filter(q => (q.subjectId||q.subject) === catId);
    // Age-filter
    pool = pool.filter(q => !q.ageGroup || !profile.ageGroup || q.ageGroup === profile.ageGroup || q.ageGroup === 'all');
    pool = BL.shuffle(pool).slice(0, isBattle ? 10 : 15);
    if (!pool.length) { BL.toast('ℹ️','No questions','No quiz questions for this topic yet.'); return; }
    beginQuiz(pool, isBattle);
  }

  function beginQuiz(questions, isBattle = false) {
    state.quizQ       = questions;
    state.quizIdx     = 0;
    state.quizScore   = 0;
    state.quizAnswered= false;
    state.quizBattle  = isBattle;
    clearTimeout(state.quizTimer);
    BL.showScreen('quiz');
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    if (state.quizIdx >= state.quizQ.length) { showQuizResult(); return; }
    const q   = state.quizQ[state.quizIdx];
    const pct = BL.pct(state.quizIdx, state.quizQ.length);
    BL.setStyle('quiz-prog-fill', 'width', `${pct}%`);
    BL.setHTML('quiz-score-badge', `${state.quizScore}/${state.quizIdx}`);
    BL.setHTML('quiz-num', `Q${state.quizIdx+1} of ${state.quizQ.length}`);
    BL.setHTML('quiz-subject-tag', q.subjectId || q.subject || '');
    BL.setHTML('quiz-question', q.question);
    BL.$('quiz-explain').style.display = 'none';
    state.quizAnswered = false;

    const labels = ['A','B','C','D'];
    BL.setHTML('quiz-opts', (q.options||[]).map((opt,i) => `
      <button class="quiz-opt" onclick="BLApp.selectAnswer(${i})">
        <span class="opt-letter">${labels[i]}</span>
        <span>${opt}</span>
      </button>`).join(''));

    // Battle timer
    if (state.quizBattle) startBattleTimer();

    // Render thinking character
    BLChars.render(profile.tutorChar || 'maya', 'quiz-char', 80, 'think');
  }

  function selectAnswer(idx) {
    if (state.quizAnswered) return;
    state.quizAnswered = true;
    clearTimeout(state.quizTimer);

    const q       = state.quizQ[state.quizIdx];
    const correct = q.correct;
    const isRight = idx === correct;

    if (isRight) {
      state.quizScore++;
      BLVoice.speakCorrect();
      BLChars.render(profile.tutorChar || 'maya', 'quiz-char', 80, 'correct', 'anim-correct');
    } else {
      BLVoice.speakWrong();
      BLChars.render(profile.tutorChar || 'maya', 'quiz-char', 80, 'wrong', 'anim-support');
    }

    document.querySelectorAll('.quiz-opt').forEach((btn, i) => {
      btn.classList.add('disabled');
      if (i === correct) btn.classList.add('correct');
      if (i === idx && !isRight) btn.classList.add('wrong');
    });

    if (q.explanation) {
      BL.setHTML('quiz-explain', q.explanation);
      BL.$('quiz-explain').style.display = 'block';
    }

    setTimeout(() => { state.quizIdx++; renderQuizQuestion(); }, isRight ? 1100 : 2000);
  }

  function startBattleTimer() {
    let left = 12;
    BL.setHTML('quiz-timer', left + 's');
    BL.$('quiz-timer').classList.remove('urgent');
    state.quizTimer = setInterval(() => {
      left--;
      BL.setHTML('quiz-timer', left + 's');
      if (left <= 4) BL.$('quiz-timer')?.classList.add('urgent');
      if (left <= 0) {
        clearInterval(state.quizTimer);
        if (!state.quizAnswered) selectAnswer(-1); // timeout = wrong
      }
    }, 1000);
  }

  function showQuizResult() {
    const score = state.quizScore;
    const total = state.quizQ.length;
    const pct   = BL.pct(score, total);
    const isPerfect = pct === 100;

    BLProg.recordQuizScore(state.currentSubject?.id || 'general', 'quiz', score, total);

    const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪';
    const msg   = pct >= 90 ? 'Outstanding! You\'re a quiz champion!' :
                  pct >= 70 ? 'Great job! Keep it up!' :
                  pct >= 50 ? 'Good effort! Practice makes perfect.' : 'Keep studying — you\'ll get there!';

    BL.setHTML('screen-quiz', `
      <div class="quiz-result-screen">
        <div style="position:relative">
          <div class="celebrate-char" id="result-char"></div>
        </div>
        <div class="quiz-result-emoji">${emoji}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);font-weight:700;text-transform:uppercase">Quiz Complete</div>
        <div class="quiz-result-score">${score}/${total}</div>
        <p class="t-body t-muted t-center">${msg}</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;margin-top:0.5rem">
          <button class="btn btn-primary" onclick="BLApp.openQuizSelect()">Try Again 🔄</button>
          <button class="btn btn-secondary" onclick="BL.showScreen('dashboard');BLApp.renderDashboard()">Dashboard 🏠</button>
        </div>
      </div>`);

    BLChars.render(profile.tutorChar || 'maya', 'result-char', 160, isPerfect ? 'correct' : 'idle',
                   isPerfect ? 'anim-celebrate' : '');

    if (isPerfect) {
      BL.celebrate('🏆', 'Perfect Score!', 'You got every question right!', 'Amazing!');
    }
  }

  /* ════════════════════════════════════════════════════════════
     GAMES
     ════════════════════════════════════════════════════════════ */
  function openGames() {
    renderGamesHub();
    BL.showScreen('games');
  }

  function renderGamesHub() {
    const grid = BL.$('games-grid');
    if (!grid) return;
    const GAMES = [
      { id:'math-sprint',    icon:'⚡', name:'Math Sprint',      desc:'Race the clock on arithmetic!',    col:'#6c63ff' },
      { id:'spelling',       icon:'✍️',  name:'Spelling Challenge',desc:'Hear it and spell it right!',     col:'#f093fb' },
      { id:'planet-sort',    icon:'🪐', name:'Planet Sort',       desc:'Order planets from the Sun.',      col:'#4facfe' },
      { id:'quiz-battle',    icon:'⚔️',  name:'Quiz Battle',       desc:'10 questions, beat the clock!',   col:'#f9a825' },
      { id:'sentence-build', icon:'🔤', name:'Sentence Builder',  desc:'Drag words to build sentences.',  col:'#43e97b' },
      { id:'match-master',   icon:'🔗', name:'Match Master',      desc:'Match words to their meanings.',  col:'#ff6584' },
      { id:'flash-race',     icon:'🃏', name:'Flashcard Race',    desc:'Flip and memorise fast!',         col:'#f9a825' },
      { id:'speaking-coach', icon:'🎤', name:'Speaking Coach',    desc:'AI scores your pronunciation!',   col:'#667eea' },
      { id:'flag-match',     icon:'🌍', name:'Flag Match',        desc:'Match countries to their flags.',  col:'#00b894' },
      { id:'money-game',     icon:'💰', name:'Money Maths',       desc:'Real-world money problems.',       col:'#f9a825' },
    ];
    grid.innerHTML = GAMES.map(g => `
      <div class="game-card card-lift" style="--gc-col:${g.col}" onclick="BLApp.launchGame('${g.id}')">
        <div class="gc-icon">${g.icon}</div>
        <div class="gc-name">${g.name}</div>
        <div class="gc-desc">${g.desc}</div>
      </div>`).join('');
  }

  function launchGame(gameId) {
    BL.showScreen('game-play');
    BL.setHTML('game-play-title', document.querySelector(`[onclick="BLApp.launchGame('${gameId}')"] .gc-name`)?.textContent || 'Game');
    const area = BL.$('game-area');
    if (area) area.innerHTML = '<div class="loading-spin"></div>';
    setTimeout(() => {
      if (window.BLGames) window.BLGames.launch(gameId, { quiz: data.quiz, subjects: data.subjects, profile });
      else if (area) area.innerHTML = `<div class="empty-state"><div class="empty-icon">🎮</div><p>${gameId.replace(/-/g,' ')} loading…</p></div>`;
      BLGam.recordGame(gameId);
    }, 100);
  }

  function exitGame() {
    if (window.BLGames?.stop) window.BLGames.stop();
    BL.showScreen('games');
    renderDashboard();
  }

  /* ════════════════════════════════════════════════════════════
     LANGUAGE LEARNING
     ════════════════════════════════════════════════════════════ */
  function openLanguages() {
    BLLang.renderLangGrid('lang-grid');
    BL.showScreen('languages');
  }

  function selectLanguage(langCode) {
    state.currentLang = langCode;
    BLLang.renderModeGrid('mode-grid');
    BL.setHTML('lang-mode-heading', `Learn ${BLLang.getCoach(langCode).name.replace('Coach ','')}`);
    BL.showScreen('lang-mode');
  }

  function selectLangMode(modeId) {
    state.currentMode = modeId;
    BLLang.renderLevelGrid('level-grid');
    BL.showScreen('lang-level');
  }

  function selectLangLevel(level) {
    state.currentLevel = level;
    startLangSession();
  }

  function startLangSession() {
    const { langCode, mode, level } = { langCode: state.currentLang, mode: state.currentMode, level: state.currentLevel };
    const session = BLLang.startSession(langCode, mode, level);
    const coach   = session.coach;

    BLChars.render(coach.charId || 'maya', 'coach-char', 90, 'idle', 'anim-wave');
    BL.setHTML('coach-name',    coach.name);
    BL.setHTML('coach-level',   `${level} · ${mode.replace(/-/g,' ')}`);
    BL.setHTML('coach-tip',     session.tip ? `💡 ${session.tip}` : '');
    BL.$('lang-chat-area').innerHTML = '';
    addLangBubble('ai', session.starterMessage);
    BLProg.recordLangSession(langCode, mode, level);
    BL.showScreen('lang-session');
  }

  async function sendLangMessage() {
    const input = BL.$('lang-text-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    addLangBubble('user', text);
    const typing = addTypingBubble();
    const reply  = await BLLang.sendMessage(text);
    typing.remove();
    const msg = reply || BLAI.getFallback(text);
    addLangBubble('ai', msg);
    if (!BLVoice.isMuted()) BLVoice.speak(msg, state.currentLang, 0.85);
  }

  function addLangBubble(who, text) {
    const area = BL.$('lang-chat-area');
    if (!area) return null;
    const div  = document.createElement('div');
    div.className = `bubble ${who === 'ai' ? 'ai' : 'user'}`;
    div.textContent = text;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return div;
  }

  function addTypingBubble() {
    const area = BL.$('lang-chat-area');
    const div  = document.createElement('div');
    div.className = 'bubble ai typing-bubble';
    div.innerHTML  = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return div;
  }

  function startVoiceInput(targetInputId = 'lang-text-input') {
    if (!BLVoice.isSupported()) return BL.toast('🎤','Not supported','Please type your response.');
    const btn = BL.$('voice-btn');
    btn?.classList.add('listening');
    BLVoice.startListening(
      text => { const el = BL.$(targetInputId); if (el && text) { el.value = text; if (targetInputId === 'lang-text-input') sendLangMessage(); } },
      ()   => btn?.classList.remove('listening'),
      state.currentLang || 'en'
    );
  }

  /* ════════════════════════════════════════════════════════════
     AI TUTOR SCREEN
     ════════════════════════════════════════════════════════════ */
  function openAITutor() {
    const t = state.currentTopic;
    BL.setHTML('tutor-subject', t?.title || 'General Learning');
    const charId = Object.keys(BLChars.CHARS).find(k => BLChars.CHARS[k] === BLChars.tutorForSubject(state.currentSubject?.id)) || profile.tutorChar || 'maya';
    BLChars.render(charId, 'tutor-char', 90, 'idle', 'anim-wave');
    clearTutorChat();
    addTutorBubble('ai', `Hi ${profile.name}! 🌟 I'm here to help with "${t?.title || 'anything you want to learn'}". What would you like to know?`);
    BL.showScreen('ai-tutor');
  }

  async function sendTutorMessage() {
    const input = BL.$('tutor-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    addTutorBubble('user', text);
    BLChars.render(profile.tutorChar || 'maya', 'tutor-char', 90, 'think');
    const typing = addTutorTyping();
    const reply  = await BLAI.send(text);
    typing.remove();
    const msg = reply || BLAI.getFallback(text);
    addTutorBubble('ai', msg);
    BLChars.render(profile.tutorChar || 'maya', 'tutor-char', 90, 'idle', 'anim-speak');
    if (!BLVoice.isMuted()) BLVoice.speak(msg, 'en', 0.88);
    BLGam.recordAIChat();
  }

  function addTutorBubble(who, text) {
    const area = BL.$('tutor-chat-area');
    if (!area) return null;
    const div  = document.createElement('div');
    div.className = `bubble ${who === 'ai' ? 'ai' : 'user'}`;
    div.textContent = text;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return div;
  }

  function addTutorTyping() {
    const area = BL.$('tutor-chat-area');
    const div  = document.createElement('div');
    div.className = 'bubble ai typing-bubble';
    div.innerHTML  = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return div;
  }

  function clearTutorChat() { const a = BL.$('tutor-chat-area'); if (a) a.innerHTML = ''; BLAI.clearHistory(); }

  /* ════════════════════════════════════════════════════════════
     COUNTRIES / STATES / SPACE
     ════════════════════════════════════════════════════════════ */
  function openCountries() {
    renderCountryGrid(data.countries);
    BL.showScreen('countries');
  }

  function renderCountryGrid(countries) {
    const el = BL.$('country-grid');
    if (!el) return;
    el.innerHTML = (countries||[]).map(c => `
      <div class="explorer-card card-lift" onclick="BLApp.openCountryDetail('${c.code}')">
        <div class="ec-flag">${c.flag||'🌍'}</div>
        <div class="ec-name">${c.name}</div>
        <div class="ec-sub">🏙 ${c.capital||''}</div>
      </div>`).join('') || '<div class="empty-state"><div class="empty-icon">🌍</div><p>Countries loading…</p></div>';
  }

  function filterCountries(q) {
    const filtered = data.countries.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.capital||'').toLowerCase().includes(q.toLowerCase()));
    renderCountryGrid(filtered);
  }

  function openCountryDetail(code) {
    const c = data.countries.find(x => x.code === code);
    if (!c) return;
    BLGam.recordCountryVisit(code);
    const sheet = BL.$('country-sheet');
    BL.setHTML('cd-flag',  c.flag || '🌍');
    BL.setHTML('cd-name',  c.name);
    BL.setHTML('cd-cont',  c.continent || '');
    BL.setHTML('cd-cap',   c.capital   || '-');
    BL.setHTML('cd-pop',   c.population|| '-');
    BL.setHTML('cd-lang',  c.language  || '-');
    BL.setHTML('cd-curr',  `${c.currency||''} ${c.currency_symbol||''}`);
    BL.setHTML('cd-facts', (c.fun_facts||[]).map(f=>`<div class="fun-fact">✨ ${f}</div>`).join(''));
    openSheet('country-sheet');
  }

  function openStates() {
    renderStatesList(data.states);
    BL.showScreen('states');
  }

  function renderStatesList(states) {
    const el = BL.$('states-list');
    if (!el) return;
    el.innerHTML = (states||[]).map(s => `
      <div class="state-row" onclick="BLApp.openStateDetail('${s.code}')">
        <div class="state-code">${s.code}</div>
        <div class="state-name">${s.name}</div>
        <div class="state-cap">${s.capital||''}</div>
      </div>`).join('') || '<div class="empty-state"><div class="empty-icon">🗺️</div><p>States loading…</p></div>';
  }

  function filterStates(q) {
    const f = data.states.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || s.code.toLowerCase().includes(q.toLowerCase()));
    renderStatesList(f);
  }

  function openStateDetail(code) {
    const s = data.states.find(x => x.code === code);
    if (!s) return;
    BLGam.recordStateVisit(code);
    BL.setHTML('sd-code',  s.code);
    BL.setHTML('sd-name',  s.name);
    BL.setHTML('sd-nick',  s.nickname||'-');
    BL.setHTML('sd-cap',   s.capital||'-');
    BL.setHTML('sd-bird',  s.bird||'-');
    BL.setHTML('sd-flower',s.flower||'-');
    BL.setHTML('sd-pop',   s.population||'-');
    BL.setHTML('sd-year',  s.year_admitted||'-');
    BL.setHTML('sd-facts', (s.fun_facts||[]).map(f=>`<div class="fun-fact">✨ ${f}</div>`).join(''));
    openSheet('state-sheet');
  }

  /* ════════════════════════════════════════════════════════════
     PROFILE
     ════════════════════════════════════════════════════════════ */
  function openProfile() {
    const g   = BLGam.getStats();
    const all = BLProg.getOverallStats(data.subjects);
    BLChars.render(profile.tutorChar || 'maya', 'profile-char', 100, 'idle', 'anim-wave');
    BL.setHTML('profile-avatar-big',  profile.avatar || '🦁');
    BL.setHTML('profile-name-big',    profile.name);
    BL.setHTML('profile-level-tag',   `${g.level.emoji} ${g.level.name}`);
    BL.setStyle('profile-xp-fill',    'width', `${g.levelPct}%`);
    BL.setHTML('pstat-xp',     BL.fmtNum(g.xp));
    BL.setHTML('pstat-coins',  BL.fmtNum(g.coins));
    BL.setHTML('pstat-streak', g.streak);
    BL.setHTML('pstat-lessons',all.totalComplete);
    BL.setHTML('pstat-badges', g.badges.length);
    BL.setHTML('pstat-langs',  g.langSessions);
    renderBadgeRack(g.badges);
    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === profile.theme));
    BL.showScreen('profile');
  }

  function renderBadgeRack(earnedIds) {
    const rack = BL.$('badge-rack');
    if (!rack) return;
    const all = BLGam.getAllBadges();
    rack.innerHTML = all.map(b => {
      const earned = earnedIds.includes(b.id);
      return `<div class="badge-item ${earned?'earned':'locked'}" title="${b.name}: ${b.desc}">
        <span class="bi-emoji">${b.emoji}</span>
        <span class="bi-name">${b.name}</span>
      </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════
     SAFETY
     ════════════════════════════════════════════════════════════ */
  function openSafety() {
    const RULES = [
      { title:'Never share personal info', desc:'Don\'t share your full name, address, phone, or school online with strangers.' },
      { title:'Tell a trusted adult', desc:'If something online makes you uncomfortable, always tell a parent, teacher, or guardian.' },
      { title:'Use strong passwords', desc:'Create unique passwords with letters, numbers and symbols. Never share them with friends.' },
      { title:'Think before you click', desc:'Don\'t click on unknown links or download files from people you don\'t know.' },
      { title:'Be kind online', desc:'Treat people online exactly as you would in person. No bullying or mean comments.' },
      { title:'Protect your photos', desc:'Never send photos or videos to people you don\'t know in real life.' },
      { title:'Ask a parent first', desc:'Before signing up for any website or app, check with a parent or guardian.' },
      { title:'Report anything scary', desc:'If someone online threatens you or makes you feel unsafe, tell an adult immediately.' },
    ];
    const list = BL.$('safety-list');
    if (list) {
      list.innerHTML = RULES.map((r,i) => `
        <div class="safety-rule">
          <div class="safety-num">${i+1}</div>
          <div>
            <div class="safety-rule-title">${r.title}</div>
            <div class="safety-rule-desc">${r.desc}</div>
          </div>
        </div>`).join('');
    }
    BLGam.earnBadge('safety_pro');
    BL.showScreen('safety');
  }

  /* ════════════════════════════════════════════════════════════
     CAREERS
     ════════════════════════════════════════════════════════════ */
  function openCareers() {
    const CAREERS = [
      {icon:'👨‍⚕️',name:'Doctor',field:'Medicine'},{icon:'🧑‍💻',name:'Software Engineer',field:'Technology'},
      {icon:'👩‍🏫',name:'Teacher',field:'Education'},{icon:'🎨',name:'Artist',field:'Creative Arts'},
      {icon:'🚀',name:'Astronaut',field:'Space Science'},{icon:'🔬',name:'Scientist',field:'Research'},
      {icon:'⚖️',name:'Lawyer',field:'Law'},{icon:'📰',name:'Journalist',field:'Media'},
      {icon:'🏗️',name:'Architect',field:'Design'},{icon:'🌱',name:'Farmer',field:'Agriculture'},
      {icon:'🎵',name:'Musician',field:'Arts'},{icon:'🐕',name:'Veterinarian',field:'Animal Care'},
      {icon:'✈️',name:'Pilot',field:'Aviation'},{icon:'🍳',name:'Chef',field:'Culinary'},
      {icon:'💰',name:'Financial Analyst',field:'Finance'},{icon:'🌍',name:'Diplomat',field:'Global Affairs'},
      {icon:'📱',name:'App Developer',field:'Tech'},{icon:'🎬',name:'Film Director',field:'Media & Arts'},
      {icon:'🔧',name:'Mechanical Engineer',field:'Engineering'},{icon:'🏃',name:'Professional Athlete',field:'Sports'},
    ];
    const grid = BL.$('careers-grid');
    if (grid) {
      grid.innerHTML = CAREERS.map(c => `
        <div class="explorer-card card-lift" onclick="BLApp.openCareerDetail('${c.name}','${c.icon}','${c.field}')">
          <div class="ec-flag">${c.icon}</div>
          <div class="ec-name">${c.name}</div>
          <div class="ec-sub">${c.field}</div>
        </div>`).join('');
    }
    BL.showScreen('careers');
  }

  async function openCareerDetail(name, icon, field) {
    const msg = await BLAI.send(`In 2-3 sentences, tell a ${profile.age}-year-old about the career: ${name} in ${field}. Make it inspiring and age-appropriate.`);
    BL.toast(icon, name, (msg||`${name} — an exciting career in ${field}!`).slice(0, 100), 'toast-accent');
  }

  /* ── Nav helper ────────────────────────────────────────────── */
  function navTo(tab) {
    const map = {
      home: () => { renderDashboard(); BL.showScreen('dashboard'); },
      quiz: () => openQuizSelect(),
      games: () => openGames(),
      lang: () => openLanguages(),
      profile: () => openProfile(),
    };
    (map[tab] || map.home)();
    // Update active nav tab
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`nav-${tab}`);
    if (activeTab) activeTab.classList.add('active');
  }

  /* ════════════════════════════════════════════════════════════
     SHEET / MODAL helpers
     ════════════════════════════════════════════════════════════ */
  function openSheet(id) {
    const el = BL.$(id);
    if (el) { el.style.display = 'flex'; requestAnimationFrame(() => el.classList.add('open')); }
  }
  function closeSheet(id) {
    const el = BL.$(id);
    if (el) { el.classList.remove('open'); setTimeout(() => el.style.display='none', 300); }
  }
  function closeAllSheets() {
    document.querySelectorAll('.modal-overlay').forEach(m => { m.classList.remove('open'); m.style.display='none'; });
  }

  /* ════════════════════════════════════════════════════════════
     SETTINGS
     ════════════════════════════════════════════════════════════ */
  function openSettings() {
    BL.setHTML('settings-email', BLAuth.getUser()?.email || 'Guest mode');
    openSheet('settings-sheet');
  }

  async function saveSettings() {
    profile.muteAudio    = BL.$('toggle-mute')?.checked    || false;
    profile.voiceEnabled = BL.$('toggle-voice')?.checked   ?? true;
    BLVoice.setMuted(profile.muteAudio);
    BLStorage.saveProfile(profile);
    BL.toast('✅','Settings saved','');
    closeSheet('settings-sheet');
  }

  function openAdminLogin() {
    BL.$('admin-password').value = '';
    BL.remClass('admin-login-error', 'hidden'); // reset
    BL.addClass('admin-login-error', 'hidden');
    BL.showScreen('admin-login');
  }

  function adminLogin() {
    const pw = BL.$('admin-password')?.value;
    const stored = localStorage.getItem('bl15_admin_pw') || 'admin123';
    if (pw === stored) {
      BL.showScreen('admin');
      adminLoadConfig();
    } else {
      BL.remClass('admin-login-error', 'hidden');
    }
  }

  function adminLogout() {
    BL.showScreen('dashboard');
  }

  function adminLoadConfig() {
    const key = localStorage.getItem('bl15_claude_key') || localStorage.getItem('bl15_openai_key') || '';
    const provider = localStorage.getItem('bl15_ai_provider') || 'none';
    const endpoint = localStorage.getItem('bl15_endpoint') || '';
    if (BL.$('admin-ai-provider')) BL.$('admin-ai-provider').value = provider;
    if (BL.$('admin-api-key')) BL.$('admin-api-key').value = key ? '••••••••' : '';
    if (BL.$('admin-endpoint')) BL.$('admin-endpoint').value = endpoint;
  }

  function adminSaveAI() {
    const provider = BL.$('admin-ai-provider')?.value || 'none';
    const key = BL.$('admin-api-key')?.value.trim();
    const endpoint = BL.$('admin-endpoint')?.value.trim();
    localStorage.setItem('bl15_ai_provider', provider);
    if (key && !key.startsWith('••')) {
      if (provider === 'claude') localStorage.setItem('bl15_claude_key', key);
      if (provider === 'openai') localStorage.setItem('bl15_openai_key', key);
    }
    if (endpoint) localStorage.setItem('bl15_endpoint', endpoint);
    BLAI.updateConfig({ provider, claudeKey: provider==='claude'?key:'', openaiKey: provider==='openai'?key:'', backendUrl: endpoint });
    BL.remClass('admin-save-msg', 'hidden');
    setTimeout(() => BL.addClass('admin-save-msg', 'hidden'), 2000);
    BL.toast('✅', 'AI Config Saved', '');
  }

  function adminClearCache() {
    Object.keys(localStorage).filter(k => k.startsWith('bl15_cache_')).forEach(k => localStorage.removeItem(k));
    BL.toast('🧹', 'Cache cleared', '');
  }

  function adminResetProgress() {
    if (confirm('Reset ALL progress? This cannot be undone.')) {
      BLStorage.saveProgress({});
      BL.toast('🔄', 'Progress reset', '');
    }
  }

  async function testAIConnection() {
    BL.toast('🤖','Testing AI…','');
    const status = await BLAI.testConnection();
    const msgs = { backend:'🟢 Backend connected', claude:'🟢 Claude AI ready', openai:'🟢 OpenAI ready', offline:'🟡 Offline mode — add an API key for full AI.' };
    BL.toast('🤖', 'AI Status', msgs[status] || '❓ Unknown', 'toast-accent');
  }

  /* ════════════════════════════════════════════════════════════
     THEME
     ════════════════════════════════════════════════════════════ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'light');
    profile.theme = theme;
  }

  function changeTheme(theme) {
    applyTheme(theme);
    BLStorage.saveProfile(profile);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  }

  /* ════════════════════════════════════════════════════════════
     FUN FACTS (info div)
     ════════════════════════════════════════════════════════════ */
  function openFunFact(term) {
    BLAI.getWikiFact(term).then(fact => {
      if (fact) BL.toast('💡', term, fact, 'toast-accent');
    });
  }

  /* ── Assignments ─────────────────────────── */
  const MOCK_ASSIGNMENTS = [
    { id:1, title:'Complete 5 Math lessons', subject:'Mathematics', icon:'🔢', due:'2026-04-25', status:'active' },
    { id:2, title:'Take the Science Quiz', subject:'Science', icon:'🔬', due:'2026-04-24', status:'active' },
    { id:3, title:'Read English Story 3', subject:'English', icon:'📚', due:'2026-04-20', status:'overdue' },
    { id:4, title:'Finish Coding Module 1', subject:'Coding', icon:'💻', due:'2026-04-18', status:'completed' },
    { id:5, title:'Geography: Study 10 Countries', subject:'Geography', icon:'🌍', due:'2026-04-30', status:'active' },
    { id:6, title:'History Quiz: Ancient World', subject:'History', icon:'🏛️', due:'2026-04-17', status:'completed' },
  ];

  function openAssignments() {
    renderAssignments('active');
    BL.showScreen('assignments');
  }

  function filterAssignments(filter, btn) {
    document.querySelectorAll('.assign-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderAssignments(filter);
  }

  function renderAssignments(filter = 'active') {
    const el = BL.$('assignments-list');
    if (!el) return;
    let list = MOCK_ASSIGNMENTS;
    if (filter !== 'all') list = list.filter(a => a.status === filter);
    if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="es-icon">📋</div><div class="es-msg">No assignments here!</div></div>'; return; }
    el.innerHTML = list.map(a => `
      <div class="assign-card ${a.status}">
        <div class="assign-icon">${a.icon}</div>
        <div class="assign-info">
          <div class="assign-title">${a.title}</div>
          <div class="assign-subject">${a.subject}</div>
          <div class="assign-due ${a.status==='overdue'?'overdue':''}">Due: ${a.due}</div>
        </div>
        <div class="assign-badge ${a.status}">${a.status}</div>
      </div>`).join('');
  }

  /* ── Progress / Analytics ────────────────── */
  function openProgress() {
    const g = BLGam.getStats();
    const overall = BLProg.getOverallStats(data.subjects || []);
    BL.setHTML('prog-total-xp', BL.fmtNum(g.xp));
    BL.setHTML('prog-streak', g.streak);
    BL.setHTML('prog-lessons', overall.totalComplete || 0);
    const qHistory = BL.tryJSON(localStorage.getItem('bl15_quiz_history'), []);
    const avgScore = qHistory.length ? Math.round(qHistory.reduce((s,q) => s + (q.pct||0), 0) / qHistory.length) : 0;
    BL.setHTML('prog-quiz-avg', avgScore + '%');
    renderWeeklyChart();
    renderSubjectProgress();
    renderRecentActivity();
    BL.showScreen('progress');
  }

  function renderWeeklyChart() {
    const el = BL.$('weekly-chart');
    if (!el) return;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const todayIdx = (new Date().getDay() + 6) % 7;
    const weekData = BL.tryJSON(localStorage.getItem('bl15_weekly_xp'), Array(7).fill(0));
    const max = Math.max(...weekData, 1);
    el.innerHTML = days.map((d,i) => {
      const h = Math.round((weekData[i] / max) * 70);
      return `<div class="week-bar-wrap">
        <div class="week-bar ${i===todayIdx?'today':''}" style="height:${Math.max(h,4)}px"></div>
        <div class="week-day">${d}</div>
      </div>`;
    }).join('');
  }

  function renderSubjectProgress() {
    const el = BL.$('subject-progress-list');
    if (!el || !data.subjects?.length) return;
    el.innerHTML = data.subjects.slice(0,8).map(s => {
      const pct = BLProg.getSubjectPct(s.id, s.topics?.length);
      return `<div class="subj-prog-row">
        <div class="subj-prog-icon">${s.emoji||s.icon||'📚'}</div>
        <div class="subj-prog-info">
          <div class="subj-prog-name">${s.name}</div>
          <div class="subj-prog-bar-wrap"><div class="subj-prog-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="subj-prog-pct">${pct}%</div>
      </div>`;
    }).join('');
  }

  function renderRecentActivity() {
    const el = BL.$('recent-activity-list');
    if (!el) return;
    const stored = BL.tryJSON(localStorage.getItem('bl15_recent_activity'), []);
    const acts = stored.length ? stored : [
      { icon:'📖', title:'Completed: Counting to 10', time:'2 hours ago', xp:'+20 XP' },
      { icon:'🧪', title:'Quiz: Math Sprint — 8/10', time:'Yesterday', xp:'+50 XP' },
      { icon:'🌍', title:'Explored: 5 Countries', time:'2 days ago', xp:'+15 XP' },
      { icon:'🎮', title:'Game: Math Sprint ⚡', time:'2 days ago', xp:'+30 XP' },
    ];
    el.innerHTML = acts.map(a => `
      <div class="activity-item">
        <div class="activity-icon">${a.icon}</div>
        <div class="activity-info">
          <div class="activity-title">${a.title}</div>
          <div class="activity-time">${a.time}</div>
        </div>
        <div class="activity-xp">${a.xp}</div>
      </div>`).join('');
  }

  /* ── Messages ────────────────────────────── */
  const MOCK_MESSAGES = [
    { id:1, sender:'🧑‍🏫 Ms. Johnson', preview:'Great job on the Math quiz today! You scored 9/10...', time:'2h ago', unread:true },
    { id:2, sender:'🤖 AI Tutor Maya', preview:'I noticed you haven\'t practiced Science this week. Want to...', time:'Yesterday', unread:true },
    { id:3, sender:'👨‍👩‍👦 Parent: Dad', preview:'How was school today? I saw you completed 3 lessons!', time:'Yesterday', unread:false },
    { id:4, sender:'🏅 BridgeLearn', preview:'You earned a new badge: Knowledge Seeker! Keep going...', time:'2 days ago', unread:false },
    { id:5, sender:'🧑‍🏫 Mr. Patel', preview:'Your assignment on Ancient History is due tomorrow.', time:'3 days ago', unread:false },
  ];

  function openMessages() {
    const el = BL.$('messages-list');
    if (el) el.innerHTML = MOCK_MESSAGES.map(m => `
      <div class="msg-item ${m.unread?'unread':''}" onclick="BL.toast('💬','${m.sender}','${m.preview.slice(0,40)}...')">
        <div class="msg-avatar">${m.sender.slice(0,2)}</div>
        <div class="msg-info">
          <div class="msg-sender">${m.sender.slice(2).trim()} <span class="msg-time">${m.time}</span></div>
          <div class="msg-preview">${m.preview}</div>
        </div>
        ${m.unread ? '<div class="msg-unread-dot"></div>' : ''}
      </div>`).join('');
    BL.showScreen('messages');
  }

  /* ════════════════════════════════════════════════════════════
     EXPOSE PUBLIC API
     ════════════════════════════════════════════════════════════ */
  return {
    boot, profile, data, state,
    // Auth
    doLogin, doSignup, doGoogleLogin, doForgot, doGuestLogin, doLogout,
    // Setup
    setupNext, setupBack, selectAvatar, toggleInterest, selectTutor,
    // Dashboard
    renderDashboard,
    // Subjects
    openSubject, openTopic,
    // Quiz
    openQuizSelect, startQuizCategory, selectAnswer,
    // Games
    openGames, launchGame, exitGame,
    // Languages
    openLanguages, selectLanguage, selectLangMode, selectLangLevel,
    sendLangMessage, startVoiceInput,
    // AI Tutor
    openAITutor, sendTutorMessage, clearTutorChat,
    // Countries / States
    openCountries, filterCountries, openCountryDetail,
    openStates, filterStates, openStateDetail,
    // Safety / Careers
    openSafety, openCareers, openCareerDetail,
    // Profile
    openProfile, changeTheme,
    // Assignments / Progress / Messages
    openAssignments, filterAssignments, openProgress, openMessages,
    // Settings
    openSettings, saveSettings, testAIConnection,
    // Admin
    openAdminLogin, adminLogin, adminLogout, adminSaveAI, adminClearCache, adminResetProgress,
    // Sheets
    openSheet, closeSheet, closeAllSheets,
    // Utils
    openFunFact, applyTheme,
    navTo,
    closeCelebrate: () => { const ov = document.getElementById('celebrate-overlay'); if(ov) ov.classList.add('hidden'); },
    refresh: () => BLApp.renderDashboard(),
  };
})();

window.BLApp = BLApp;

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => BLApp.boot());
