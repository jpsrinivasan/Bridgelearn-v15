/* BridgeLearn V15 — Auth Module
 *
 * Three auth modes (auto-detected):
 *  1. API mode  — uses the BridgeLearn backend server (most secure)
 *  2. Firebase  — uses Firebase Auth (cloud, no backend needed)
 *  3. Local     — localStorage fallback (demo / offline only)
 *
 * Mode is chosen by what is configured in window.BL_CONFIG:
 *   API_URL          → API mode
 *   FIREBASE_API_KEY → Firebase mode
 *   (neither)        → Local mode
 */
'use strict';

const BLAuth = (() => {

  let currentUser  = null;
  let onAuthCb     = null;
  let apiBase      = null;   // e.g. "http://localhost:3001"

  /* ══════════════════════════════════════════════════════════════
     API MODE — secure server-side auth
     ══════════════════════════════════════════════════════════════ */

  function _isApiMode() { return !!apiBase; }

  /** Generic API fetch with credentials (sends httpOnly cookies automatically) */
  async function _apiFetch(path, options = {}) {
    const res = await fetch(apiBase + path, {
      ...options,
      credentials : 'include',                        // send/receive httpOnly cookies
      headers     : { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body        : options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, code: data.code });
    return data;
  }

  /** Silent token refresh — called automatically before token expiry */
  let _refreshTimer = null;
  function _scheduleRefresh(expiresInSeconds) {
    clearTimeout(_refreshTimer);
    const refreshAt = Math.max(10, expiresInSeconds - 60) * 1000; // 60s before expiry
    _refreshTimer = setTimeout(async () => {
      try {
        const data = await _apiFetch('/api/auth/refresh', { method: 'POST' });
        _scheduleRefresh(data.expiresIn || 900);
      } catch {
        // Refresh failed — user needs to log in again
        currentUser = null;
        if (onAuthCb) onAuthCb(null);
      }
    }, refreshAt);
  }

  async function apiInit(apiUrl) {
    apiBase = apiUrl.replace(/\/$/, '');
    try {
      // Try to restore session using existing cookies
      const data = await _apiFetch('/api/auth/me');
      currentUser = _mapApiUser(data.user);
      _scheduleRefresh(900);  // default 15-min access token
      if (onAuthCb) onAuthCb(currentUser);
    } catch (err) {
      if (err.status === 401) {
        // Try silent refresh first
        try {
          const data = await _apiFetch('/api/auth/refresh', { method: 'POST' });
          currentUser = _mapApiUser(data.user);
          _scheduleRefresh(data.expiresIn || 900);
          if (onAuthCb) onAuthCb(currentUser);
        } catch {
          if (onAuthCb) onAuthCb(null);  // not logged in
        }
      } else {
        if (onAuthCb) onAuthCb(null);
      }
    }
  }

  function _mapApiUser(u) {
    return {
      uid      : u.id,
      email    : u.email,
      name     : u.displayName,
      role     : u.role,
      verified : u.isVerified,
      provider : 'api',
    };
  }

  async function apiSignUp(email, password, name) {
    const data = await _apiFetch('/api/auth/register', {
      method : 'POST',
      body   : { email, password, displayName: name },
    });
    currentUser = _mapApiUser(data.user);
    _scheduleRefresh(data.expiresIn || 900);
    return currentUser;
  }

  async function apiSignIn(email, password) {
    const data = await _apiFetch('/api/auth/login', {
      method : 'POST',
      body   : { email, password },
    });
    currentUser = _mapApiUser(data.user);
    _scheduleRefresh(data.expiresIn || 900);
    return currentUser;
  }

  async function apiSignOut() {
    clearTimeout(_refreshTimer);
    currentUser = null;
    try { await _apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  }

  async function apiResetPassword(email) {
    await _apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } });
  }

  /* ══════════════════════════════════════════════════════════════
     FIREBASE MODE
     ══════════════════════════════════════════════════════════════ */

  async function initFirebase(config) {
    if (!config?.apiKey) return false;
    try {
      const { initializeApp }     = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
              signOut, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider,
              signInWithPopup, updateProfile, setPersistence, browserLocalPersistence }
            = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      const fbApp = initializeApp(config);
      const auth  = getAuth(fbApp);
      const db    = getFirestore(fbApp);

      await setPersistence(auth, browserLocalPersistence);

      BLAuth._fb = { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signOut, sendPasswordResetEmail, sendEmailVerification,
        GoogleAuthProvider, signInWithPopup, updateProfile, onAuthStateChanged, db };

      onAuthStateChanged(auth, async user => {
        currentUser = user;
        if (user) BLStorage.initFirestore(db, user.uid);
        if (onAuthCb) onAuthCb(user);
      });

      return true;
    } catch (e) {
      console.warn('[BL Auth] Firebase init failed:', e.message);
      return false;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LOCAL FALLBACK AUTH (no server, no Firebase)
     ══════════════════════════════════════════════════════════════ */

  function localSignUp(email, password, name) {
    const users = BL.tryJSON(localStorage.getItem('bl15_local_users'), {});
    if (users[email]) throw new Error('Email already in use.');
    const uid = 'local_' + Date.now();
    users[email] = { uid, password: btoa(password), name };
    localStorage.setItem('bl15_local_users', JSON.stringify(users));
    const user = { uid, email, name, provider: 'local' };
    localStorage.setItem('bl15_local_user', JSON.stringify(user));
    currentUser = user;
    return user;
  }

  function localSignIn(email, password) {
    const users = BL.tryJSON(localStorage.getItem('bl15_local_users'), {});
    const u = users[email];
    if (!u || atob(u.password) !== password) throw new Error('Invalid credentials.');
    const user = { uid: u.uid, email, name: u.name, provider: 'local' };
    localStorage.setItem('bl15_local_user', JSON.stringify(user));
    currentUser = user;
    if (onAuthCb) onAuthCb(user);
    return user;
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API — works for all three modes
     ══════════════════════════════════════════════════════════════ */

  function onAuthChange(cb) {
    onAuthCb = cb;
    if (currentUser !== null) cb(currentUser);
  }

  async function signUp(email, password, name) {
    if (_isApiMode())   return apiSignUp(email, password, name);
    if (BLAuth._fb) {
      const { auth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = BLAuth._fb;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      try { await sendEmailVerification(cred.user); } catch {}
      return { uid: cred.user.uid, email, name, provider: 'firebase' };
    }
    return localSignUp(email, password, name);
  }

  async function signIn(email, password) {
    if (_isApiMode())   return apiSignIn(email, password);
    if (BLAuth._fb) {
      const { auth, signInWithEmailAndPassword } = BLAuth._fb;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName, provider: 'firebase' };
    }
    return localSignIn(email, password);
  }

  async function signInGoogle() {
    if (!BLAuth._fb) throw new Error('Google sign-in requires Firebase.');
    const { auth, GoogleAuthProvider, signInWithPopup } = BLAuth._fb;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName, provider: 'google' };
  }

  async function signOutUser() {
    currentUser = null;
    if (_isApiMode())  { await apiSignOut(); }
    else if (BLAuth._fb) { await BLAuth._fb.signOut(BLAuth._fb.auth); }
    localStorage.removeItem('bl15_local_user');
    BL.emit('auth:signout');
  }

  async function resetPassword(email) {
    if (_isApiMode())   return apiResetPassword(email);
    if (BLAuth._fb)     return BLAuth._fb.sendPasswordResetEmail(BLAuth._fb.auth, email);
    throw new Error('Password reset requires the auth server or Firebase.');
  }

  function getUser()    { return currentUser; }
  function isLoggedIn() { return currentUser !== null || !!localStorage.getItem('bl15_local_user'); }
  function isGuest()    {
    const lu = BL.tryJSON(localStorage.getItem('bl15_local_user'), null);
    return lu?.isGuest === true;
  }

  /* ── Guest mode ─────────────────────────────────────────────────── */
  function guestLogin(name = 'Explorer') {
    const user = { uid: 'guest_' + Date.now(), email: '', name, provider: 'guest', isGuest: true };
    localStorage.setItem('bl15_local_user', JSON.stringify(user));
    currentUser = user;
    if (onAuthCb) onAuthCb(user);
    return user;
  }

  /* ── Check saved local session (non-Firebase, non-API) ─────────── */
  function checkLocalSession() {
    if (!BLAuth._fb && !_isApiMode()) {
      const saved   = BL.tryJSON(localStorage.getItem('bl15_local_user'), null);
      const profile = BL.tryJSON(localStorage.getItem('bl15_profile'), null);
      // Only auto-login real (non-guest) accounts that completed setup
      if (saved && !saved.isGuest && profile?.setupDone) {
        currentUser = saved;
        if (onAuthCb) setTimeout(() => onAuthCb(saved), 0);
      } else {
        // Guests and fresh installs always see the welcome screen
        if (onAuthCb) setTimeout(() => onAuthCb(null), 0);
      }
    }
  }

  return {
    // Init
    initFirebase, apiInit,
    // Auth lifecycle
    onAuthChange, signUp, signIn, signInGoogle,
    signOutUser, resetPassword, guestLogin,
    // State
    getUser, isLoggedIn, isGuest, checkLocalSession,
  };
})();

window.BLAuth = BLAuth;
