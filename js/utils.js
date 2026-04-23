/* BridgeLearn V15 — Utilities */
'use strict';

const BL = {
  /* ── DOM helpers ───────────────────────────────────────────── */
  $:   id  => document.getElementById(id),
  $$:  sel => document.querySelectorAll(sel),
  qs:  sel => document.querySelector(sel),

  setHTML:  (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; },
  setText:  (id, txt)  => { const el = document.getElementById(id); if (el) el.textContent = txt; },
  setStyle: (id, p, v) => { const el = document.getElementById(id); if (el) el.style[p] = v; },
  show:     id => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); },
  hide:     id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); },
  toggle:   (id, cond) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !cond); },
  addClass: (id, cls) => { const el = document.getElementById(id); if (el) el.classList.add(cls); },
  remClass: (id, cls) => { const el = document.getElementById(id); if (el) el.classList.remove(cls); },
  hasClass: (el, cls) => el?.classList?.contains(cls),

  /* ── Screen router ─────────────────────────────────────────── */
  currentScreen: null,
  screenHistory: [],

  showScreen(id, pushHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id) || document.getElementById(id);
    if (!el) { console.warn('[BL] Screen not found:', id); return; }
    el.classList.add('active');
    el.scrollTop = 0;
    if (pushHistory && this.currentScreen && this.currentScreen !== id) {
      this.screenHistory.push(this.currentScreen);
      if (this.screenHistory.length > 10) this.screenHistory.shift();
    }
    this.currentScreen = id;
    // Nav visibility
    const noNav = ['welcome','login','signup','forgot','setup','game-play','lang-session','ai-tutor','quiz','lesson'];
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.toggle('hidden', noNav.includes(id));
    // Update active nav tab
    const navMap = { dashboard:'nav-home', quiz:'nav-quiz', games:'nav-games', languages:'nav-lang', profile:'nav-profile' };
    Object.entries(navMap).forEach(([screen, navId]) => {
      document.getElementById(navId)?.classList.toggle('active', screen === id);
    });
  },

  goBack() {
    const prev = this.screenHistory.pop();
    if (prev) this.showScreen(prev, false);
  },

  /* ── Array helpers ─────────────────────────────────────────── */
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  },

  /* ── Date helpers ──────────────────────────────────────────── */
  today:     () => new Date().toDateString(),
  yesterday: () => new Date(Date.now() - 86400000).toDateString(),
  timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400)return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  },

  /* ── Number helpers ────────────────────────────────────────── */
  clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
  pct:   (n, total) => total > 0 ? Math.round(n / total * 100) : 0,
  pad:   (n, len=2) => String(n).padStart(len, '0'),
  fmtNum(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
    return String(n);
  },

  /* ── String helpers ────────────────────────────────────────── */
  cap: s => s ? s[0].toUpperCase() + s.slice(1) : '',
  slug: s => s.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''),

  /* ── Age group from numeric age ────────────────────────────── */
  ageGroup(age) {
    const n = parseInt(age) || 10;
    if (n <= 5)  return '3-5';
    if (n <= 8)  return '6-8';
    if (n <= 12) return '9-12';
    if (n <= 15) return '13-15';
    return '16-18';
  },

  /* ── Country-aware content filter ─────────────────────────── */
  isCountry(country, ...targets) {
    return targets.some(t => (country||'').toLowerCase().includes(t.toLowerCase()));
  },

  /* ── Levenshtein distance (pronunciation scoring) ──────────── */
  levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, (_,i) => Array.from({length: n+1}, (_,j) => i===0?j:j===0?i:0));
    for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  },

  similarity(a, b) {
    const aa = a.toLowerCase().trim(), bb = b.toLowerCase().trim();
    const dist = this.levenshtein(aa, bb);
    const maxLen = Math.max(aa.length, bb.length);
    return maxLen === 0 ? 100 : Math.round((1 - dist/maxLen) * 100);
  },

  /* ── Toast notification ────────────────────────────────────── */
  toast(icon, title, sub = '', type = '') {
    const existing = document.querySelector('.achievement-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `achievement-toast ${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div><div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('remove'); setTimeout(() => el.remove(), 400); }, 2800);
  },

  /* ── Confetti ──────────────────────────────────────────────── */
  confetti(count = 45) {
    const colors = ['#6c63ff','#f5576c','#43e97b','#f9a825','#4facfe','#f093fb'];
    let container = document.getElementById('confetti-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'confetti-container';
      container.className = 'confetti-container';
      document.body.appendChild(container);
    }
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('div');
      bit.className = 'confetti-bit';
      const size = 6 + Math.random() * 8;
      bit.style.cssText = `
        left: ${Math.random()*100}vw;
        width: ${size}px; height: ${size}px;
        background: ${colors[Math.floor(Math.random()*colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        transform: rotate(${Math.random()*360}deg);
        animation-duration: ${0.9+Math.random()*1.5}s;
        animation-delay: ${Math.random()*0.4}s;
      `;
      container.appendChild(bit);
      setTimeout(() => bit.remove(), 2500);
    }
  },

  /* ── Celebration overlay ───────────────────────────────────── */
  celebrate(emoji, title, msg, btnText = 'Continue', onDone) {
    const ov = document.getElementById('celebrate-overlay');
    if (!ov) return;
    const charEl = document.getElementById('cel-char') || document.getElementById('celebrate-char');
    if (charEl) charEl.innerHTML = window.BLChars?.renderMini?.('maya','correct') || emoji;
    document.getElementById('cel-title').textContent = title;
    document.getElementById('cel-msg').textContent   = msg;
    document.getElementById('cel-btn').textContent   = btnText;
    document.getElementById('cel-btn').onclick = () => {
      ov.classList.add('hidden');
      if (onDone) onDone();
    };
    ov.classList.remove('hidden');
    this.confetti();
  },

  /* ── Debounce / throttle ───────────────────────────────────── */
  debounce(fn, ms = 300) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },
  throttle(fn, ms = 200) {
    let last = 0;
    return (...args) => { const now = Date.now(); if (now-last>=ms){ last=now; fn(...args); } };
  },

  /* ── Safe JSON parse ───────────────────────────────────────── */
  tryJSON(str, fallback = null) { try { const r = JSON.parse(str); return (r === null || r === undefined) ? fallback : r; } catch { return fallback; } },

  /* ── Fetch with timeout and retry ─────────────────────────── */
  async fetchJSON(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  /* ── Event bus ─────────────────────────────────────────────── */
  _listeners: {},
  on(event, fn)   { (this._listeners[event] = this._listeners[event] || []).push(fn); },
  off(event, fn)  { this._listeners[event] = (this._listeners[event]||[]).filter(f=>f!==fn); },
  emit(event, data) { (this._listeners[event]||[]).forEach(fn => fn(data)); },
};

window.BL = BL;
