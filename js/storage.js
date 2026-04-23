/* BridgeLearn V15 — Storage (Firebase + local fallback) */
'use strict';

const BLStorage = (() => {
  const LOCAL_KEY  = 'bl15_profile';
  const PROG_KEY   = 'bl15_progress';
  const GAM_KEY    = 'bl15_gamification';
  const OFFLINE_Q  = 'bl15_offline_queue';

  let db = null;
  let uid = null;

  /* ── Init Firestore ────────────────────────────────────────── */
  function initFirestore(firestore, userId) {
    db  = firestore;
    uid = userId;
    // Drain offline queue
    drainOfflineQueue();
  }

  /* ── Profile ───────────────────────────────────────────────── */
  async function saveProfile(profile) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
    if (db && uid) {
      try {
        await db.collection('users').doc(uid).set({ profile, updatedAt: Date.now() }, { merge: true });
      } catch (e) {
        queueOffline('saveProfile', { profile });
      }
    }
  }

  async function loadProfile() {
    if (db && uid) {
      try {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists) {
          const data = snap.data();
          if (data.profile) {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(data.profile));
            return data.profile;
          }
        }
      } catch (e) { /* fall through to local */ }
    }
    return BL.tryJSON(localStorage.getItem(LOCAL_KEY), null);
  }

  /* ── Progress ──────────────────────────────────────────────── */
  async function saveProgress(progress) {
    localStorage.setItem(PROG_KEY, JSON.stringify(progress));
    if (db && uid) {
      try {
        await db.collection('users').doc(uid).set({ progress, updatedAt: Date.now() }, { merge: true });
      } catch (e) {
        queueOffline('saveProgress', { progress });
      }
    }
  }

  function loadProgressLocal() {
    return BL.tryJSON(localStorage.getItem(PROG_KEY), {});
  }

  async function loadProgress() {
    if (db && uid) {
      try {
        const snap = await db.collection('users').doc(uid).get();
        if (snap.exists) {
          const data = snap.data();
          if (data.progress) {
            localStorage.setItem(PROG_KEY, JSON.stringify(data.progress));
            return data.progress;
          }
        }
      } catch (e) { /* fall through */ }
    }
    return loadProgressLocal();
  }

  /* ── Gamification state ────────────────────────────────────── */
  function saveGam(state) {
    localStorage.setItem(GAM_KEY, JSON.stringify(state));
    if (db && uid) {
      db.collection('users').doc(uid).set({ gamification: state, updatedAt: Date.now() }, { merge: true })
        .catch(() => queueOffline('saveGam', { state }));
    }
  }

  function loadGam() {
    return BL.tryJSON(localStorage.getItem(GAM_KEY), null);
  }

  /* ── App data (JSON files with SW caching) ─────────────────── */
  const dataCache = {};
  async function loadData(filename) {
    if (dataCache[filename]) return dataCache[filename];
    try {
      const data = await BL.fetchJSON(`/data/${filename}.json`);
      dataCache[filename] = data;
      return data;
    } catch (e) {
      console.warn(`[BL] Failed to load data/${filename}.json`, e);
      return null;
    }
  }

  async function loadAll() {
    const files = ['subjects','quiz','countries','states','languages','achievements'];
    const results = await Promise.allSettled(files.map(f => loadData(f)));
    const out = {};
    files.forEach((f, i) => {
      out[f] = results[i].status === 'fulfilled' ? results[i].value : null;
    });
    return out;
  }

  /* ── Offline queue ─────────────────────────────────────────── */
  function queueOffline(action, data) {
    const q = BL.tryJSON(localStorage.getItem(OFFLINE_Q), []);
    q.push({ action, data, ts: Date.now() });
    localStorage.setItem(OFFLINE_Q, JSON.stringify(q));
  }

  async function drainOfflineQueue() {
    if (!db || !uid) return;
    const q = BL.tryJSON(localStorage.getItem(OFFLINE_Q), []);
    if (!q.length) return;
    for (const item of q) {
      try {
        if (item.action === 'saveProfile')  await saveProfile(item.data.profile);
        if (item.action === 'saveProgress') await saveProgress(item.data.progress);
        if (item.action === 'saveGam')      saveGam(item.data.state);
      } catch (e) { return; } // stop on first failure
    }
    localStorage.removeItem(OFFLINE_Q);
  }

  /* ── Guest migration ────────────────────────────────────────── */
  async function migrateGuestToAccount(newUid) {
    uid = newUid;
    const profile  = BL.tryJSON(localStorage.getItem(LOCAL_KEY), null);
    const progress = loadProgressLocal();
    const gam      = loadGam();
    if (profile)  await saveProfile(profile);
    if (progress) await saveProgress(progress);
    if (gam)      saveGam(gam);
  }

  /* ── Clear all local ────────────────────────────────────────── */
  function clearLocal() {
    [LOCAL_KEY, PROG_KEY, GAM_KEY, OFFLINE_Q].forEach(k => localStorage.removeItem(k));
  }

  // Listen for SW sync messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SYNC_PROGRESS') drainOfflineQueue();
    });
  }

  return {
    initFirestore, saveProfile, loadProfile,
    saveProgress, loadProgress, loadProgressLocal,
    saveGam, loadGam,
    loadData, loadAll,
    migrateGuestToAccount, clearLocal,
  };
})();

window.BLStorage = BLStorage;
