/* BridgeLearn V15 — Auth Module (Firebase + local fallback) */
'use strict';

const BLAuth = (() => {
  let firebaseApp  = null;
  let firebaseAuth = null;
  let currentUser  = null;
  let onAuthCb     = null;

  /* ── Firebase init ─────────────────────────────────────────── */
  async function initFirebase(config) {
    if (!config?.apiKey) return false;
    try {
      const { initializeApp }     = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
              signOut, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider,
              signInWithPopup, updateProfile, setPersistence, browserLocalPersistence }
            = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      firebaseApp = initializeApp(config);
      const auth  = getAuth(firebaseApp);
      const db    = getFirestore(firebaseApp);

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

  /* ── Auth state listener ───────────────────────────────────── */
  function onAuthChange(cb) {
    onAuthCb = cb;
    if (currentUser !== null) cb(currentUser); // already resolved
  }

  /* ── Email sign up ─────────────────────────────────────────── */
  async function signUp(email, password, name) {
    if (BLAuth._fb) {
      const { auth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = BLAuth._fb;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      try { await sendEmailVerification(cred.user); } catch {}
      return { uid: cred.user.uid, email, name, provider: 'firebase' };
    }
    return localSignUp(email, password, name);
  }

  /* ── Email sign in ─────────────────────────────────────────── */
  async function signIn(email, password) {
    if (BLAuth._fb) {
      const { auth, signInWithEmailAndPassword } = BLAuth._fb;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName, provider: 'firebase' };
    }
    return localSignIn(email, password);
  }

  /* ── Google sign in ────────────────────────────────────────── */
  async function signInGoogle() {
    if (!BLAuth._fb) throw new Error('Firebase not configured');
    const { auth, GoogleAuthProvider, signInWithPopup } = BLAuth._fb;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName, provider: 'google' };
  }

  /* ── Sign out ──────────────────────────────────────────────── */
  async function signOutUser() {
    currentUser = null;
    if (BLAuth._fb) await BLAuth._fb.signOut(BLAuth._fb.auth);
    localStorage.removeItem('bl15_local_user');
    BL.emit('auth:signout');
  }

  /* ── Password reset ────────────────────────────────────────── */
  async function resetPassword(email) {
    if (BLAuth._fb) {
      await BLAuth._fb.sendPasswordResetEmail(BLAuth._fb.auth, email);
      return;
    }
    throw new Error('Password reset requires Firebase.');
  }

  /* ── Get current user ──────────────────────────────────────── */
  function getUser() { return currentUser; }
  function isLoggedIn() { return currentUser !== null || !!localStorage.getItem('bl15_local_user'); }
  function isGuest() {
    const lu = BL.tryJSON(localStorage.getItem('bl15_local_user'), null);
    return lu?.isGuest === true;
  }

  /* ── Local fallback auth (no Firebase) ─────────────────────── */
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

  /* ── Guest mode ────────────────────────────────────────────── */
  function guestLogin(name = 'Explorer') {
    const user = { uid: 'guest_' + Date.now(), email: '', name, provider: 'guest', isGuest: true };
    localStorage.setItem('bl15_local_user', JSON.stringify(user));
    currentUser = user;
    if (onAuthCb) onAuthCb(user);
    return user;
  }

  /* ── Check saved local session ─────────────────────────────── */
  function checkLocalSession() {
    if (!BLAuth._fb) {
      const saved = BL.tryJSON(localStorage.getItem('bl15_local_user'), null);
      // Only auto-login real accounts (not guest), and only if setupDone
      const profile = BL.tryJSON(localStorage.getItem('bl15_profile'), null);
      if (saved && !saved.isGuest && profile?.setupDone) {
        currentUser = saved;
        if (onAuthCb) setTimeout(() => onAuthCb(saved), 0);
      } else {
        // Always show welcome for guests / fresh installs
        if (onAuthCb) setTimeout(() => onAuthCb(null), 0);
      }
    }
  }

  return {
    initFirebase, onAuthChange, signUp, signIn, signInGoogle,
    signOutUser, resetPassword, guestLogin, getUser, isLoggedIn, isGuest,
    checkLocalSession,
  };
})();

window.BLAuth = BLAuth;
