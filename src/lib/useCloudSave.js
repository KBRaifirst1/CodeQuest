// src/lib/useCloudSave.js
// A single hook that gives your App component everything it needs for
// "everything saves": the signed-in user, their loaded state, and an
// autosave that pushes changes to Supabase (debounced so it doesn't spam).
//
// HOW TO USE IT in your App() — see MIGRATION-GUIDE.md for the full diff.
//
//   const { user, loading, initialState, save } = useCloudSave();
//   // 1) seed your state from initialState once it loads
//   // 2) call save({ progress, aiLessons, savedProjects }) whenever state changes
//
// If the user isn't signed in, `user` is null — show <AuthGate/> in that case.

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { loadState, saveState } from "./persistence";

export function useCloudSave() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialState, setInitialState] = useState(null);
  const saveTimer = useRef(null);

  // Track auth state (login / logout / page refresh with an existing session).
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // When a user becomes known, load their saved state once.
  useEffect(() => {
    let active = true;
    if (!user) { setInitialState(null); setLoading(false); return; }
    setLoading(true);
    loadState(user.id)
      .then((state) => { if (active) setInitialState(state); })
      .catch((e) => { console.error("Load failed:", e); if (active) setInitialState({ progress: {}, aiLessons: {}, savedProjects: [] }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  // Debounced save — call this whenever app state changes.
  const save = useCallback((state) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(user.id, state).catch((e) => console.error("Save failed:", e));
    }, 800); // wait for activity to settle, then persist
  }, [user]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return { user, loading, initialState, save, signOut };
}
