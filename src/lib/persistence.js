// src/lib/persistence.js
//
// The read/write layer behind useCloudSave.js. One row per user in the
// `codequest_state` table holds their whole saved CodeQuest state as a JSON
// blob: { progress, aiLessons, savedProjects }.
//
// This table lives in Study It's Supabase project, namespaced `codequest_`
// so it sits alongside Study It's own tables (profiles / notebooks / feedback)
// without colliding. Row Level Security (codequest-supabase-schema.sql) scopes
// every row to its owner: a user can only read and write their own row.

import { supabase } from "./supabase";

const TABLE = "codequest_state";

// The honest empty state — matches what useCloudSave falls back to on error.
const EMPTY = { progress: {}, aiLessons: {}, savedProjects: [] };

// Load a user's saved state. Returns the empty shape (never throws to the
// caller for a simply-absent row) so a brand-new account starts clean.
export async function loadState(userId) {
  if (!userId) return { ...EMPTY };
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const saved = data && data.data ? data.data : null;
  // Merge over EMPTY so any key the saved blob is missing is filled honestly.
  return saved ? { ...EMPTY, ...saved } : { ...EMPTY };
}

// Upsert a user's whole state. Debounced by the caller (useCloudSave).
export async function saveState(userId, state) {
  if (!userId) return;
  const payload = {
    user_id: userId,
    data: {
      progress: (state && state.progress) || {},
      aiLessons: (state && state.aiLessons) || {},
      savedProjects: (state && state.savedProjects) || [],
    },
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}
