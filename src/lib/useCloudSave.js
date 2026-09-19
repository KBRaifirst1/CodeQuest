// src/lib/useCloudSave.js
// A single hook that gives your App component everything it needs for
// "everything saves": the signed-in user, their loaded state, and an
// autosave that pushes changes to Supabase (debounced so it doesn't spam).
//
//   const { user, loading, initialState, save, signOut } = useCloudSave();
//
// Same interface as before, so whatever mounts the app does not change.
// If the user isn't signed in, `user` is null — show <AuthGate/> in that case.
//
// ---------------------------------------------------------------------------
// WHAT CHANGED AND WHY
//
// 1. Coming back to the tab no longer reloads the app.
//    Supabase (auth-js) re-emits SIGNED_IN every time a tab becomes visible
//    again, with a freshly parsed user object. The load effect was keyed on
//    that object, so every return to the tab set `loading`, showed the
//    loading screen and remounted the whole app — losing whatever was on
//    screen. It is now keyed on the user's ID, and the user object is only
//    replaced when the ID actually changes.
//
// 2. Coming back to the tab now brings in the other device's work, quietly.
//    Instead of a full reload, the account is fetched in the background and
//    handed to the app as a new `initialState`, which the app merges in.
//
// 3. A save made just before leaving is sent immediately.
//    Browsers freeze hidden tabs, so an 800ms timer started just before you
//    switch away may not run until you come back. Pending saves are now sent
//    the moment the tab is hidden or closed.
//
// 4. A failed load is never treated as an empty account.
//    It used to hand the app { progress: {}, ... } on any load error. The app
//    then saved that — over the real account. It now passes the same empty
//    shape marked `__unloaded: true`, which the app knows not to save over,
//    and keeps retrying until the real account arrives.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { loadState, saveState } from "./persistence";

const EMPTY = { progress: {}, aiLessons: {}, savedProjects: [] };
const SAVE_DELAY = 800;        // wait for typing to settle before a save
const REFRESH_MIN_GAP = 15000; // don't re-fetch on every quick tab flick
const RETRY_STEPS = [2000, 5000, 10000, 20000, 30000];

export function useCloudSave() {
  const [user, setUser] = useState(null);
  const [authKnown, setAuthKnown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialState, setInitialState] = useState(null);
  const saveTimer = useRef(null);
  const pending = useRef(null);      // { userId, state } not yet sent
  const lastFetch = useRef(0);
  /* True only once THIS user's account has actually been read. Until then
     nothing is saved: a save is a whole-row replace, so saving before reading
     would overwrite the account with this device's copy. Enforced here as well
     as in the app, so an older app build is protected too. */
  const ready = useRef(false);
  const userId = user ? user.id : null;

  // Keep the SAME user object while the ID is unchanged, so nothing keyed on
  // it re-runs when Supabase re-announces the session.
  const acceptUser = useCallback((u) => {
    setUser((prev) => {
      if (!u) return null;
      if (prev && prev.id === u.id) return prev;
      return u;
    });
  }, []);

  // Track auth state (login / logout / page refresh with an existing session).
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      acceptUser(data && data.session ? data.session.user : null);
      setAuthKnown(true);
    }).catch(() => { if (active) setAuthKnown(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      acceptUser(session ? session.user : null);
      setAuthKnown(true);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [acceptUser]);

  // Send whatever is waiting, now. Used by the timer and when the tab hides.
  const flush = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    saveState(p.userId, p.state).catch((e) => console.error("Save failed:", e));
  }, []);

  // Load the account once per signed-in user, retrying on failure.
  useEffect(() => {
    if (!authKnown) return undefined;           // not yet known who is signed in
    let active = true;
    let retryTimer = null;
    let attempt = 0;
    ready.current = false;
    if (!userId) { setInitialState(null); setLoading(false); return undefined; }

    const tryLoad = () => {
      loadState(userId)
        .then((state) => {
          if (!active) return;
          lastFetch.current = Date.now();
          ready.current = true;
          setInitialState(state);
          setLoading(false);
        })
        .catch((e) => {
          if (!active) return;
          console.error("Load failed:", e);
          /* Let the app run on this device's own save, but marked so it will
             not push anything until the real account has been read. */
          setInitialState((cur) => (cur && !cur.__unloaded ? cur : { ...EMPTY, __unloaded: true }));
          setLoading(false);
          const wait = RETRY_STEPS[Math.min(attempt, RETRY_STEPS.length - 1)];
          attempt++;
          retryTimer = setTimeout(tryLoad, wait);
        });
    };
    setLoading(true);
    tryLoad();
    const onOnline = () => { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; tryLoad(); } };
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
    };
  }, [userId, authKnown]);

  // Leaving the tab sends pending work; coming back fetches the other
  // device's, without the loading screen.
  useEffect(() => {
    if (!userId) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { flush(); return; }
      if (Date.now() - lastFetch.current < REFRESH_MIN_GAP) return;
      lastFetch.current = Date.now();
      loadState(userId)
        .then((state) => { ready.current = true; setInitialState(state); })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [userId, flush]);

  // Debounced save — call this whenever app state changes.
  const save = useCallback((state) => {
    if (!userId || !ready.current) return;
    pending.current = { userId, state };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DELAY);
  }, [userId, flush]);

  // Anything still waiting goes out before the session ends.
  const signOut = useCallback(() => { flush(); return supabase.auth.signOut(); }, [flush]);

  return { user, loading, initialState, save, signOut };
}
