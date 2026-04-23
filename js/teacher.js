/* BridgeLearn V15 — Teacher Dashboard
   Class codes · roster management · assignments · leaderboard · reports
*/
'use strict';

const BLTeacher = (() => {

  /* ── localStorage key ───────────────────────────────────────── */
  const TEACHER_KEY = 'bl15_teacher_data';
  const MODE_KEY    = 'bl15_teacher_mode';

  /* ── Internal helpers ───────────────────────────────────────── */
  function tryJSON(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function uuid() {
    return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // Generate a 6-char class code like 'BL7X9K'
  function _genClassCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit O, I, 0, 1
    let code = 'BL';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /* ── Data access ────────────────────────────────────────────── */
  function _load() {
    return tryJSON(localStorage.getItem(TEACHER_KEY), null);
  }

  function _save(data) {
    localStorage.setItem(TEACHER_KEY, JSON.stringify(data));
  }

  function _defaultData(name, code) {
    return {
      classCode:   code,
      className:   name,
      createdAt:   Date.now(),
      students:    [],
      assignments: [],
    };
  }

  /* ── Mode ───────────────────────────────────────────────────── */
  function isTeacherMode() {
    return localStorage.getItem(MODE_KEY) === 'true';
  }

  /* ── Class management ───────────────────────────────────────── */
  function createClass(name) {
    const code = _genClassCode();
    const data = _defaultData(String(name || 'My Class').trim(), code);
    _save(data);
    return data;
  }

  function getClassCode() {
    const data = _load();
    return data ? data.classCode : null;
  }

  // Students call this to join a class by code
  function joinClass(code, studentName) {
    const data = _load();
    if (!data) return { ok: false, error: 'No class exists.' };
    if (data.classCode !== String(code).trim().toUpperCase()) {
      return { ok: false, error: 'Invalid class code.' };
    }
    const existing = data.students.find(
      s => s.name.toLowerCase() === String(studentName).trim().toLowerCase()
    );
    if (existing) return { ok: true, student: existing }; // already joined

    const student = {
      id:          uuid(),
      name:        String(studentName).trim(),
      joinedAt:    Date.now(),
      xp:          0,
      lessonsCompleted: 0,
      quizzesCompleted: 0,
      completedAssignments: [],
    };
    data.students.push(student);
    _save(data);
    return { ok: true, student };
  }

  /* ── Student roster ─────────────────────────────────────────── */
  function getStudents() {
    const data = _load();
    return data ? data.students : [];
  }

  function getStudentProgress(studentId) {
    const data = _load();
    if (!data) return null;
    const student = data.students.find(s => s.id === studentId);
    if (!student) return null;

    const completed = (student.completedAssignments || []);
    const assignments = data.assignments || [];
    const assignmentStatus = assignments.map(a => ({
      assignmentId: a.id,
      topicId:      a.topicId,
      subjectId:    a.subjectId,
      done:         completed.includes(a.id),
    }));

    return {
      ...student,
      assignmentStatus,
      completionRate: assignments.length
        ? Math.round((completed.length / assignments.length) * 100)
        : 0,
    };
  }

  // Sync a student's XP/lesson stats from the gamification store
  // (useful when a student is on the same device)
  function _syncStudentFromGam(studentId) {
    const gam  = tryJSON(localStorage.getItem('bl15_gamification'), {});
    const data = _load();
    if (!data) return;
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;
    if (gam.xp !== undefined) student.xp = gam.xp;
    if (gam.lessonsCompleted !== undefined) student.lessonsCompleted = gam.lessonsCompleted;
    if (gam.quizzesCompleted !== undefined) student.quizzesCompleted = gam.quizzesCompleted;
    _save(data);
  }

  /* ── Assignments ────────────────────────────────────────────── */
  function createAssignment(subjectId, topicId, dueDate, note) {
    const data = _load();
    if (!data) return null;

    const assignment = {
      id:        uuid(),
      subjectId: String(subjectId || '').trim(),
      topicId:   String(topicId   || '').trim(),
      dueDate:   dueDate || null,
      note:      String(note || '').trim(),
      createdAt: Date.now(),
    };
    data.assignments.push(assignment);
    _save(data);
    return assignment;
  }

  function getAssignments() {
    const data = _load();
    return data ? data.assignments : [];
  }

  function markAssignmentComplete(assignmentId, studentId) {
    const data = _load();
    if (!data) return false;
    const student = data.students.find(s => s.id === studentId);
    if (!student) return false;
    if (!student.completedAssignments) student.completedAssignments = [];
    if (!student.completedAssignments.includes(assignmentId)) {
      student.completedAssignments.push(assignmentId);
      _save(data);
    }
    return true;
  }

  /* ── Leaderboard ────────────────────────────────────────────── */
  function getLeaderboard() {
    const students = getStudents();
    return [...students]
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10)
      .map((s, i) => ({ rank: i + 1, ...s }));
  }

  /* ── Export report ──────────────────────────────────────────── */
  function exportReport() {
    const data = _load();
    if (!data) return 'No class data found.';

    const students   = data.students  || [];
    const assignments = data.assignments || [];
    const totalXP    = students.reduce((n, s) => n + (s.xp || 0), 0);
    const avgXP      = students.length ? Math.round(totalXP / students.length) : 0;

    const lines = [];
    lines.push('BridgeLearn Class Report');
    lines.push('========================');
    lines.push(`Class: ${data.className} | Code: ${data.classCode} | Date: ${today()}`);
    lines.push(`Students: ${students.length} | Avg XP: ${avgXP} | Assignments: ${assignments.length}`);
    lines.push('');

    lines.push('Student Performance:');
    lines.push('--------------------');
    const sorted = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    sorted.forEach((s, i) => {
      lines.push(
        `${i + 1}. ${s.name} - XP: ${s.xp || 0}, ` +
        `Lessons: ${s.lessonsCompleted || 0}, ` +
        `Quizzes: ${s.quizzesCompleted || 0}`
      );
    });
    lines.push('');

    lines.push('Assignments:');
    lines.push('------------');
    if (!assignments.length) {
      lines.push('  (none)');
    } else {
      assignments.forEach(a => {
        const done  = students.filter(s =>
          (s.completedAssignments || []).includes(a.id)
        ).length;
        const due   = a.dueDate ? ` — Due: ${a.dueDate}` : '';
        const note  = a.note    ? ` [${a.note}]`           : '';
        lines.push(`- ${a.topicId} (${a.subjectId}) — ${done}/${students.length} complete${due}${note}`);
      });
    }

    return lines.join('\n');
  }

  /* ── Render helpers ─────────────────────────────────────────── */

  function _subjectLabel(id) {
    const map = {
      math: '🔢 Math', science: '🔬 Science', english: '📖 English',
      history: '🏛️ History', geography: '🌍 Geography', art: '🎨 Art',
      coding: '💻 Coding', music: '🎵 Music',
    };
    return map[id] || ('📚 ' + id.charAt(0).toUpperCase() + id.slice(1));
  }

  function _rankEmoji(rank) {
    return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  }

  // Injects tab content into the content pane
  function _showTab(tabName) {
    const tabs    = document.querySelectorAll('.td-tab');
    const content = document.getElementById('td-tab-content');
    if (!content) return;

    tabs.forEach(t => t.classList.toggle('td-tab-active', t.dataset.tab === tabName));

    if (tabName === 'roster')      content.innerHTML = _buildRosterHTML();
    else if (tabName === 'assign') content.innerHTML = _buildAssignmentsHTML();
    else if (tabName === 'leader') content.innerHTML = _buildLeaderboardHTML();
    else if (tabName === 'report') content.innerHTML = _buildReportHTML();
  }

  /* ── Roster HTML ────────────────────────────────────────────── */
  function _buildRosterHTML() {
    const students = getStudents();
    if (!students.length) {
      return `<div class="td-empty">
        <p>No students yet. Share the class code so students can join.</p>
      </div>`;
    }
    const rows = students.map(s => `
      <tr>
        <td>${esc(s.name)}</td>
        <td class="td-num">${s.xp || 0}</td>
        <td class="td-num">${s.lessonsCompleted || 0}</td>
        <td class="td-num">${s.quizzesCompleted || 0}</td>
        <td class="td-num">${(s.completedAssignments || []).length}</td>
      </tr>`).join('');
    return `
      <table class="td-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>XP</th>
            <th>Lessons</th>
            <th>Quizzes</th>
            <th>Assignments Done</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /* ── Assignments HTML ───────────────────────────────────────── */
  function _buildAssignmentsHTML() {
    const assignments = getAssignments();
    const students    = getStudents();
    const total       = students.length;

    const cards = assignments.length ? assignments.map(a => {
      const done  = students.filter(s =>
        (s.completedAssignments || []).includes(a.id)
      ).length;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
      const due   = a.dueDate
        ? `<span class="td-due">Due: ${esc(a.dueDate)}</span>`
        : '';
      const note  = a.note
        ? `<p class="td-note">${esc(a.note)}</p>`
        : '';
      const color = pct === 100 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#2196f3';
      return `
        <div class="td-assign-card">
          <div class="td-assign-head">
            <span class="td-assign-subj">${esc(_subjectLabel(a.subjectId))}</span>
            ${due}
          </div>
          <div class="td-assign-topic">${esc(a.topicId)}</div>
          ${note}
          <div class="td-assign-progress">
            <div class="td-assign-track">
              <div class="td-assign-fill" style="width:${pct}%;background:${color};"></div>
            </div>
            <span class="td-assign-count">${done}/${total} students done</span>
          </div>
        </div>`;
    }).join('') : '<p class="td-empty">No assignments yet. Create one below.</p>';

    return `
      <div class="td-assign-list">${cards}</div>

      <div class="td-assign-form">
        <h4>Create Assignment</h4>
        <div class="td-form-row">
          <input id="td-a-subject" type="text"   placeholder="Subject (e.g. math)" class="td-input" />
          <input id="td-a-topic"   type="text"   placeholder="Topic / title"        class="td-input" />
          <input id="td-a-due"     type="date"   class="td-input td-input-sm" />
          <input id="td-a-note"    type="text"   placeholder="Optional note"         class="td-input" />
          <button class="td-btn-primary" onclick="BLTeacher._submitCreateAssignment()">Assign</button>
        </div>
      </div>`;
  }

  /* ── Leaderboard HTML ───────────────────────────────────────── */
  function _buildLeaderboardHTML() {
    const board = getLeaderboard();
    if (!board.length) {
      return '<p class="td-empty">No students yet.</p>';
    }
    const rows = board.map(s => `
      <div class="td-lb-row${s.rank <= 3 ? ' td-lb-top' : ''}">
        <span class="td-lb-rank">${_rankEmoji(s.rank)}</span>
        <span class="td-lb-name">${esc(s.name)}</span>
        <span class="td-lb-xp">${s.xp || 0} XP</span>
        <span class="td-lb-lessons">${s.lessonsCompleted || 0} lessons</span>
      </div>`).join('');
    return `<div class="td-leaderboard">${rows}</div>`;
  }

  /* ── Report HTML ────────────────────────────────────────────── */
  function _buildReportHTML() {
    const text = exportReport();
    return `
      <div class="td-report-wrap">
        <pre class="td-report-pre">${esc(text)}</pre>
        <button class="td-btn-primary"
                onclick="BLTeacher._copyReport()">📋 Copy Report</button>
      </div>`;
  }

  /* ── Full dashboard HTML ────────────────────────────────────── */
  function renderTeacherDashboard(containerId) {
    const el = containerId
      ? document.getElementById(containerId)
      : document.getElementById('bl-teacher-dashboard');
    if (!el) return;

    const data = _load();
    if (!data) {
      el.innerHTML = `
        <div class="teacher-dash">
          <div class="td-header">
            <h2>🏫 Teacher Dashboard</h2>
            <button class="td-exit-btn" onclick="BLTeacher.exitTeacherMode()">✕ Exit</button>
          </div>
          <div class="td-setup">
            <h3>Create Your Class</h3>
            <input id="td-class-name" type="text" placeholder="Class name (e.g. Grade 4B)"
                   class="td-input" />
            <button class="td-btn-primary"
                    onclick="BLTeacher._submitCreateClass()">Create Class</button>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="teacher-dash">
        <div class="td-header">
          <div class="td-header-left">
            <h2>🏫 ${esc(data.className)}</h2>
            <div class="td-code-badge">
              Class Code: <strong>${esc(data.classCode)}</strong>
            </div>
          </div>
          <button class="td-exit-btn" onclick="BLTeacher.exitTeacherMode()">✕ Exit</button>
        </div>

        <nav class="td-tab-bar">
          <button class="td-tab td-tab-active" data-tab="roster"
                  onclick="BLTeacher._showTab('roster')">👥 Roster</button>
          <button class="td-tab" data-tab="assign"
                  onclick="BLTeacher._showTab('assign')">📋 Assignments</button>
          <button class="td-tab" data-tab="leader"
                  onclick="BLTeacher._showTab('leader')">🏆 Leaderboard</button>
          <button class="td-tab" data-tab="report"
                  onclick="BLTeacher._showTab('report')">📄 Report</button>
        </nav>

        <div id="td-tab-content" class="td-tab-content">
          ${_buildRosterHTML()}
        </div>
      </div>`;
  }

  function renderRoster(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = _buildRosterHTML();
  }

  function renderAssignments(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = _buildAssignmentsHTML();
  }

  function renderLeaderboard(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = _buildLeaderboardHTML();
  }

  /* ── Enter / exit ───────────────────────────────────────────── */
  function enterTeacherMode() {
    localStorage.setItem(MODE_KEY, 'true');

    const existing = document.getElementById('bl-teacher-dashboard');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'bl-teacher-dashboard';
    panel.style.cssText = [
      'position:fixed','inset:0','z-index:7000',
      'background:var(--bg,#f5f5f5)',
      'overflow-y:auto','padding:16px',
    ].join(';');
    document.body.appendChild(panel);
    renderTeacherDashboard('bl-teacher-dashboard');
  }

  function exitTeacherMode() {
    localStorage.setItem(MODE_KEY, 'false');
    const panel = document.getElementById('bl-teacher-dashboard');
    if (panel) panel.remove();
  }

  /* ── Inline-onclick helpers (exposed on public API) ─────────── */
  function _showTab(tabName) {
    const tabs    = document.querySelectorAll('.td-tab');
    const content = document.getElementById('td-tab-content');
    if (!content) return;
    tabs.forEach(t => t.classList.toggle('td-tab-active', t.dataset.tab === tabName));
    if      (tabName === 'roster') content.innerHTML = _buildRosterHTML();
    else if (tabName === 'assign') content.innerHTML = _buildAssignmentsHTML();
    else if (tabName === 'leader') content.innerHTML = _buildLeaderboardHTML();
    else if (tabName === 'report') content.innerHTML = _buildReportHTML();
  }

  function _submitCreateClass() {
    const inp = document.getElementById('td-class-name');
    const name = inp ? inp.value.trim() : '';
    if (!name) { alert('Please enter a class name.'); return; }
    createClass(name);
    renderTeacherDashboard('bl-teacher-dashboard');
  }

  function _submitCreateAssignment() {
    const subject = (document.getElementById('td-a-subject') || {}).value || '';
    const topic   = (document.getElementById('td-a-topic')   || {}).value || '';
    const due     = (document.getElementById('td-a-due')     || {}).value || null;
    const note    = (document.getElementById('td-a-note')    || {}).value || '';
    if (!subject.trim() || !topic.trim()) {
      alert('Please enter both a subject and a topic.');
      return;
    }
    createAssignment(subject, topic, due, note);
    // Refresh assignments tab
    const content = document.getElementById('td-tab-content');
    if (content) content.innerHTML = _buildAssignmentsHTML();
  }

  function _copyReport() {
    const text = exportReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert('Report copied to clipboard!'))
        .catch(() => _fallbackCopy(text));
    } else {
      _fallbackCopy(text);
    }
  }

  function _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('Report copied to clipboard!');
    } catch (_) {
      alert('Could not copy automatically — please select and copy the text manually.');
    }
    document.body.removeChild(ta);
  }

  /* ── Public API ─────────────────────────────────────────────── */
  return {
    isTeacherMode,
    enterTeacherMode,
    exitTeacherMode,

    createClass,
    getClassCode,
    joinClass,

    getStudents,
    getStudentProgress,

    createAssignment,
    getAssignments,
    markAssignmentComplete,

    getLeaderboard,
    exportReport,

    renderTeacherDashboard,
    renderRoster,
    renderAssignments,
    renderLeaderboard,

    // Exposed for inline onclick handlers
    _showTab,
    _submitCreateClass,
    _submitCreateAssignment,
    _copyReport,
  };
})();

window.BLTeacher = BLTeacher;
