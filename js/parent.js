/* BridgeLearn V15 — Parent Dashboard
   PIN-protected parent mode with child profiles, screen time,
   progress reports, subject bar charts, and weekly summaries.
*/
'use strict';

const BLParent = (() => {

  /* ── localStorage keys ──────────────────────────────────────── */
  const PIN_KEY      = 'bl15_parent_pin';
  const PROFILES_KEY = 'bl15_child_profiles';
  const SCREEN_KEY   = 'bl15_screen_time';
  const LIMIT_KEY    = 'bl15_screen_limit';
  const ACTIVE_KEY   = 'bl15_active_child';
  const MODE_KEY     = 'bl15_parent_mode';

  /* ── Internal helpers ───────────────────────────────────────── */
  function today() {
    return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  }

  function tryJSON(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
  }

  function uuid() {
    return 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── PIN management ─────────────────────────────────────────── */
  function isParentMode() {
    return localStorage.getItem(MODE_KEY) === 'true';
  }

  function setParentPin(pin) {
    const str = String(pin).trim();
    if (!/^\d{4}$/.test(str)) {
      throw new Error('PIN must be exactly 4 digits.');
    }
    localStorage.setItem(PIN_KEY, str);
  }

  function checkParentPin(pin) {
    const stored = localStorage.getItem(PIN_KEY);
    // If no PIN has been set yet, any valid 4-digit entry acts as setup
    if (!stored) {
      const str = String(pin).trim();
      if (/^\d{4}$/.test(str)) {
        setParentPin(str);
        return true;
      }
      return false;
    }
    return String(pin).trim() === stored;
  }

  /* ── Child profiles ─────────────────────────────────────────── */
  function getChildProfiles() {
    return tryJSON(localStorage.getItem(PROFILES_KEY), []);
  }

  function saveChildProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  function addChildProfile(name, age, country) {
    const profiles = getChildProfiles();
    const child = {
      id:      uuid(),
      name:    String(name).trim(),
      age:     parseInt(age, 10) || 8,
      country: String(country || 'USA').trim(),
      avatar:  ['🦁', '🐯', '🦊', '🐻', '🐼', '🦋', '🐸', '🐧'][profiles.length % 8],
      createdAt: Date.now(),
    };
    profiles.push(child);
    saveChildProfiles(profiles);
    return child;
  }

  function getActiveChildId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function switchToChild(childId) {
    const profiles = getChildProfiles();
    const child = profiles.find(c => c.id === childId);
    if (!child) return false;
    localStorage.setItem(ACTIVE_KEY, childId);
    // Exit parent mode and reload app for this child context
    localStorage.setItem(MODE_KEY, 'false');
    _rerenderApp();
    return true;
  }

  /* ── Screen time ────────────────────────────────────────────── */
  function getScreenTimeToday() {
    const raw = tryJSON(localStorage.getItem(SCREEN_KEY), null);
    if (!raw || raw.date !== today()) {
      return { date: today(), minutes: 0 };
    }
    return raw;
  }

  function _saveScreenTime(obj) {
    localStorage.setItem(SCREEN_KEY, JSON.stringify(obj));
  }

  function setDailyLimit(minutes) {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins < 0) return;
    localStorage.setItem(LIMIT_KEY, String(mins));
  }

  function getDailyLimit() {
    const raw = localStorage.getItem(LIMIT_KEY);
    return raw ? parseInt(raw, 10) : 60; // default 60 min
  }

  function checkScreenTimeLimit() {
    const st = getScreenTimeToday();
    const limit = getDailyLimit();
    return st.minutes >= limit;
  }

  // Called every minute by the internal setInterval
  function tick() {
    const st = getScreenTimeToday();
    st.minutes += 1;
    _saveScreenTime(st);
    // Warn child if limit exceeded
    if (checkScreenTimeLimit()) {
      _maybeShowScreenTimeWarning();
    }
  }

  function _maybeShowScreenTimeWarning() {
    const banner = document.getElementById('bl-screen-limit-banner');
    if (banner) return; // already shown
    const div = document.createElement('div');
    div.id = 'bl-screen-limit-banner';
    div.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#ff6b35', 'color:#fff', 'text-align:center',
      'padding:12px 16px', 'font-size:15px', 'font-weight:600',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)',
    ].join(';');
    div.innerHTML = '⏱️ Screen time limit reached! Time to take a break. ' +
      '<button onclick="document.getElementById(\'bl-screen-limit-banner\').remove()" ' +
      'style="margin-left:12px;background:#fff;color:#ff6b35;border:none;' +
      'border-radius:4px;padding:2px 10px;cursor:pointer;font-weight:700">OK</button>';
    document.body.prepend(div);
  }

  /* ── Progress report ────────────────────────────────────────── */
  function getProgressReport(childId) {
    // Read from shared bl15_progress and bl15_gamification keys.
    // In a multi-child setup each child would have namespaced keys;
    // here we read the current active data (single-user PWA model).
    const prog = tryJSON(localStorage.getItem('bl15_progress'), {});
    const gam  = tryJSON(localStorage.getItem('bl15_gamification'), {});

    const subjects = [];
    for (const [key, val] of Object.entries(prog)) {
      if (key === 'daily' || key === 'roadmap') continue;
      if (key.startsWith('lang_')) continue;
      if (typeof val === 'object' && Array.isArray(val.topicsComplete)) {
        subjects.push({
          id:            key,
          topicsComplete: val.topicsComplete.length,
          masteryPct:    val.masteryPct || 0,
          quizAttempts:  Object.values(val.quizScores || {})
                               .reduce((n, q) => n + (q.attempts || 0), 0),
        });
      }
    }

    const daily = prog.daily || {};
    return {
      childId,
      date:             today(),
      lessonsToday:     daily.lessonsToday   || 0,
      quizzesToday:     daily.quizzesToday   || 0,
      totalXP:          gam.xp              || 0,
      streak:           gam.streak          || 0,
      lessonsCompleted: gam.lessonsCompleted || 0,
      quizzesCompleted: gam.quizzesCompleted || 0,
      subjects,
      screenTimeMin:    getScreenTimeToday().minutes,
      dailyLimitMin:    getDailyLimit(),
    };
  }

  /* ── Weekly summary ─────────────────────────────────────────── */
  function getWeeklySummary() {
    const gam  = tryJSON(localStorage.getItem('bl15_gamification'), {});
    const prog = tryJSON(localStorage.getItem('bl15_progress'), {});

    // Build a 7-day activity map from gam.history
    const history = gam.history || [];
    const days = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    history.forEach(h => {
      const d = new Date(h.ts).toISOString().slice(0, 10);
      if (d in days) days[d] += (h.amount || 0);
    });

    return {
      weeklyXP:    gam.weeklyXP || 0,
      totalXP:     gam.xp      || 0,
      streak:      gam.streak  || 0,
      lessonsCompleted: gam.lessonsCompleted || 0,
      quizzesCompleted: gam.quizzesCompleted || 0,
      dailyXP:     days, // { 'YYYY-MM-DD': xpEarned }
    };
  }

  /* ── App re-render helper ───────────────────────────────────── */
  function _rerenderApp() {
    // Signal BLApp to refresh if available
    if (window.BLApp && typeof window.BLApp.refresh === 'function') {
      window.BLApp.refresh();
    } else {
      window.location.reload();
    }
  }

  /* ── HTML generators ────────────────────────────────────────── */

  function _subjectLabel(id) {
    const map = {
      math: '🔢 Math', science: '🔬 Science', english: '📖 English',
      history: '🏛️ History', geography: '🌍 Geography', art: '🎨 Art',
      coding: '💻 Coding', music: '🎵 Music',
    };
    return map[id] || ('📚 ' + id.charAt(0).toUpperCase() + id.slice(1));
  }

  function _renderSubjectBars(subjects) {
    if (!subjects.length) {
      return '<p class="pd-empty">No subject activity yet.</p>';
    }
    return subjects.map(s => {
      const pct = Math.min(100, s.masteryPct || 0);
      const color = pct >= 80 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#2196f3';
      return `
        <div class="pd-bar-row">
          <div class="pd-bar-label">${esc(_subjectLabel(s.id))}</div>
          <div class="pd-bar-track">
            <div class="pd-bar-fill"
                 style="width:${pct}%;background:${color};"></div>
          </div>
          <div class="pd-bar-pct">${pct}%</div>
          <div class="pd-bar-meta">${s.topicsComplete} topics · ${s.quizAttempts} quizzes</div>
        </div>`;
    }).join('');
  }

  function _renderHeatmap(dailyXP) {
    const entries = Object.entries(dailyXP).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([date, xp]) => {
      const intensity = xp === 0 ? 0 : xp < 50 ? 1 : xp < 150 ? 2 : 3;
      const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `<div class="pd-heat-cell pd-heat-${intensity}" title="${esc(label)}: ${xp} XP">
        <span class="pd-heat-day">${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span class="pd-heat-xp">${xp > 0 ? xp : ''}</span>
      </div>`;
    }).join('');
  }

  function _renderScreenMeter(current, limit) {
    const pct  = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
    const over = current >= limit;
    const color = over ? '#f44336' : pct >= 75 ? '#ff9800' : '#4caf50';
    return `
      <div class="pd-screen-meter">
        <div class="pd-screen-track">
          <div class="pd-screen-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <p class="pd-screen-label">
          ${current} / ${limit} min used today
          ${over ? '<strong style="color:#f44336"> — Limit reached!</strong>' : ''}
        </p>
      </div>`;
  }

  function _renderChildChips(profiles, activeId) {
    if (!profiles.length) return '<p class="pd-empty">No child profiles added yet.</p>';
    return profiles.map(c => {
      const active = c.id === activeId;
      return `<button class="pd-chip${active ? ' pd-chip-active' : ''}"
                       onclick="BLParent.switchToChild('${esc(c.id)}')"
                       title="Switch to ${esc(c.name)}'s session">
        ${esc(c.avatar)} ${esc(c.name)}
      </button>`;
    }).join('');
  }

  function renderProgressReport(childId, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const r = getProgressReport(childId);
    el.innerHTML = `
      <div class="pd-report">
        <h3>📊 Progress Report — ${today()}</h3>
        <div class="pd-stat-row">
          <div class="pd-stat"><span class="pd-stat-n">${r.lessonsToday}</span><span class="pd-stat-l">Lessons Today</span></div>
          <div class="pd-stat"><span class="pd-stat-n">${r.quizzesToday}</span><span class="pd-stat-l">Quizzes Today</span></div>
          <div class="pd-stat"><span class="pd-stat-n">${r.totalXP}</span><span class="pd-stat-l">Total XP</span></div>
          <div class="pd-stat"><span class="pd-stat-n">${r.streak}🔥</span><span class="pd-stat-l">Day Streak</span></div>
        </div>
        <h4>Subject Mastery</h4>
        <div class="pd-bars">${_renderSubjectBars(r.subjects)}</div>
      </div>`;
  }

  /* ── Main dashboard render ──────────────────────────────────── */
  function renderParentDashboard() {
    const profiles   = getChildProfiles();
    const activeId   = getActiveChildId();
    const report     = getProgressReport(activeId);
    const weekly     = getWeeklySummary();
    const screenTime = getScreenTimeToday();
    const limit      = getDailyLimit();

    return `
<div class="parent-dash">

  <div class="parent-header">
    <h2>👨‍👩‍👧 Parent Dashboard</h2>
    <button class="pd-exit-btn" onclick="BLParent.exitParentMode()">✕ Exit</button>
  </div>

  <!-- Child selector chips -->
  <section class="pd-section">
    <h3 class="pd-section-title">Children</h3>
    <div class="pd-chips">
      ${_renderChildChips(profiles, activeId)}
    </div>
    <button class="pd-add-btn" onclick="BLParent.showAddChildForm()">+ Add Child Profile</button>
    <!-- Add child form (hidden by default) -->
    <div id="pd-add-child-form" class="pd-add-form" style="display:none;">
      <input id="pd-child-name"    type="text"   placeholder="Child's name"    class="pd-input" />
      <input id="pd-child-age"     type="number" placeholder="Age" min="4" max="18" class="pd-input pd-input-sm" />
      <input id="pd-child-country" type="text"   placeholder="Country (e.g. USA)" class="pd-input" />
      <div class="pd-form-btns">
        <button class="pd-btn-primary" onclick="BLParent._submitAddChild()">Save</button>
        <button class="pd-btn-ghost"   onclick="BLParent.hideAddChildForm()">Cancel</button>
      </div>
    </div>
  </section>

  <!-- Today's stats -->
  <section class="pd-section">
    <h3 class="pd-section-title">Today's Activity</h3>
    <div class="pd-stat-row">
      <div class="pd-stat">
        <span class="pd-stat-n">${report.lessonsToday}</span>
        <span class="pd-stat-l">Lessons</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-n">${report.quizzesToday}</span>
        <span class="pd-stat-l">Quizzes</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-n">${weekly.weeklyXP}</span>
        <span class="pd-stat-l">XP This Week</span>
      </div>
      <div class="pd-stat">
        <span class="pd-stat-n">${report.streak}🔥</span>
        <span class="pd-stat-l">Streak</span>
      </div>
    </div>
  </section>

  <!-- Subject progress bars (CSS only, no external libs) -->
  <section class="pd-section">
    <h3 class="pd-section-title">Subject Performance</h3>
    <div class="pd-bars">
      ${_renderSubjectBars(report.subjects)}
    </div>
  </section>

  <!-- Weekly activity heatmap (7-day grid) -->
  <section class="pd-section">
    <h3 class="pd-section-title">Weekly Activity</h3>
    <div class="pd-heatmap">
      ${_renderHeatmap(weekly.dailyXP)}
    </div>
    <div class="pd-heat-legend">
      <span class="pd-heat-cell pd-heat-0"></span> None
      <span class="pd-heat-cell pd-heat-1"></span> Low
      <span class="pd-heat-cell pd-heat-2"></span> Medium
      <span class="pd-heat-cell pd-heat-3"></span> High
    </div>
  </section>

  <!-- Screen time meter -->
  <section class="pd-section">
    <h3 class="pd-section-title">Screen Time</h3>
    ${_renderScreenMeter(screenTime.minutes, limit)}
  </section>

  <!-- Settings: daily limit, PIN -->
  <section class="pd-section pd-section-settings">
    <h3 class="pd-section-title">Settings</h3>
    <div class="pd-setting-row">
      <label for="pd-limit-input">Daily screen-time limit (minutes)</label>
      <input id="pd-limit-input" type="number" min="10" max="480" step="5"
             value="${limit}" class="pd-input pd-input-sm"
             onchange="BLParent.setDailyLimit(this.value)" />
    </div>
    <div class="pd-setting-row">
      <label>Change PIN</label>
      <button class="pd-btn-ghost" onclick="BLParent.showChangePinForm()">Change PIN</button>
    </div>
    <div id="pd-pin-form" class="pd-add-form" style="display:none;">
      <input id="pd-new-pin" type="password" inputmode="numeric" maxlength="4"
             placeholder="New 4-digit PIN" class="pd-input pd-input-sm" />
      <div class="pd-form-btns">
        <button class="pd-btn-primary" onclick="BLParent._submitChangePin()">Save PIN</button>
        <button class="pd-btn-ghost"   onclick="BLParent.hideChangePinForm()">Cancel</button>
      </div>
    </div>
  </section>

</div>`;
  }

  /* ── Enter / exit parent mode ───────────────────────────────── */
  function enterParentMode() {
    // Show PIN prompt overlay
    const existing = document.getElementById('bl-parent-overlay');
    if (existing) existing.remove();

    const pinSet = !!localStorage.getItem(PIN_KEY);
    const overlay = document.createElement('div');
    overlay.id = 'bl-parent-overlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:8000',
      'background:rgba(0,0,0,.7)','display:flex',
      'align-items:center','justify-content:center',
    ].join(';');

    overlay.innerHTML = `
      <div class="pd-pin-modal">
        <h3>${pinSet ? '🔐 Parent Access' : '🔐 Set Parent PIN'}</h3>
        <p class="pd-pin-hint">${pinSet
          ? 'Enter your 4-digit PIN to continue.'
          : 'Choose a 4-digit PIN to protect the parent dashboard.'}</p>
        <input id="bl-pin-input" type="password" inputmode="numeric"
               maxlength="4" placeholder="• • • •"
               class="pd-pin-input"
               onkeydown="if(event.key==='Enter')BLParent._submitPinEntry()" />
        <div id="bl-pin-error" class="pd-pin-error" style="display:none;">Incorrect PIN. Try again.</div>
        <div class="pd-form-btns">
          <button class="pd-btn-primary" onclick="BLParent._submitPinEntry()">
            ${pinSet ? 'Enter' : 'Set PIN'}
          </button>
          <button class="pd-btn-ghost"
                  onclick="document.getElementById('bl-parent-overlay').remove()">
            Cancel
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => {
      const inp = document.getElementById('bl-pin-input');
      if (inp) inp.focus();
    }, 50);
  }

  function _submitPinEntry() {
    const inp = document.getElementById('bl-pin-input');
    if (!inp) return;
    const pin = inp.value.trim();
    if (checkParentPin(pin)) {
      localStorage.setItem(MODE_KEY, 'true');
      const overlay = document.getElementById('bl-parent-overlay');
      if (overlay) overlay.remove();
      _mountDashboard();
    } else {
      const err = document.getElementById('bl-pin-error');
      if (err) { err.style.display = 'block'; }
      inp.value = '';
      inp.focus();
    }
  }

  function _mountDashboard() {
    const existing = document.getElementById('bl-parent-dashboard');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'bl-parent-dashboard';
    panel.style.cssText = [
      'position:fixed','inset:0','z-index:7000',
      'background:var(--bg,#f5f5f5)',
      'overflow-y:auto','padding:16px',
    ].join(';');
    panel.innerHTML = renderParentDashboard();
    document.body.appendChild(panel);
  }

  function exitParentMode() {
    localStorage.setItem(MODE_KEY, 'false');
    const panel = document.getElementById('bl-parent-dashboard');
    if (panel) panel.remove();
  }

  /* ── Form helpers (called from inline onclick) ──────────────── */
  function showAddChildForm() {
    const f = document.getElementById('pd-add-child-form');
    if (f) f.style.display = 'block';
  }

  function hideAddChildForm() {
    const f = document.getElementById('pd-add-child-form');
    if (f) f.style.display = 'none';
  }

  function _submitAddChild() {
    const name    = (document.getElementById('pd-child-name')    || {}).value || '';
    const age     = (document.getElementById('pd-child-age')     || {}).value || '8';
    const country = (document.getElementById('pd-child-country') || {}).value || 'USA';
    if (!name.trim()) {
      alert("Please enter the child's name.");
      return;
    }
    addChildProfile(name, age, country);
    // Refresh dashboard
    const panel = document.getElementById('bl-parent-dashboard');
    if (panel) panel.innerHTML = renderParentDashboard();
  }

  function showChangePinForm() {
    const f = document.getElementById('pd-pin-form');
    if (f) f.style.display = 'block';
  }

  function hideChangePinForm() {
    const f = document.getElementById('pd-pin-form');
    if (f) f.style.display = 'none';
  }

  function _submitChangePin() {
    const inp = document.getElementById('pd-new-pin');
    if (!inp) return;
    try {
      setParentPin(inp.value.trim());
      alert('PIN updated!');
      hideChangePinForm();
    } catch (e) {
      alert(e.message);
    }
  }

  /* ── Module init: start screen-time ticker ──────────────────── */
  setInterval(tick, 60 * 1000);

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    isParentMode,
    enterParentMode,
    exitParentMode,
    renderParentDashboard,

    setParentPin,
    checkParentPin,

    getChildProfiles,
    addChildProfile,
    switchToChild,

    getProgressReport,
    renderProgressReport,

    getScreenTimeToday,
    setDailyLimit,
    checkScreenTimeLimit,

    getWeeklySummary,

    tick,

    // Exposed form helpers (called from inline onclick)
    showAddChildForm,
    hideAddChildForm,
    _submitAddChild,
    showChangePinForm,
    hideChangePinForm,
    _submitChangePin,
    _submitPinEntry,
  };
})();

window.BLParent = BLParent;
