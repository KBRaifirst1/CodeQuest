// src/lib/persistence.js
// Loads and saves the user's entire CodeQuest state to Supabase.
//
// Your app keeps three pieces of state:
//   progress    = { classId: Set(doneStepIdx) }   <-- Sets aren't JSON, we convert
//   aiLessons   = { classId: [generatedStep, ...] }
//   savedProjects = [ finishedProjectPlan, ... ]
//
// These helpers convert to/from JSON-safe shapes and read/write the single
// user_state row (protected by Row Level Security so each user sees only theirs).

import { supabase } from "./supabase";

// ---- Set <-> array conversion for `progress` ----
export function serializeProgress(progress) {
  const out = {};
  for (const [k, v] of Object.entries(progress || {})) out[k] = Array.from(v);
  return out;
}
export function deserializeProgress(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = new Set(v);
  return out;
}

// ---- Load everything for the signed-in user ----
// Returns { progress, aiLessons, savedProjects } (with defaults if no row yet).
export async function loadState(userId) {
  const { data, error } = await supabase
    .from("user_state")
    .select("progress, ai_lessons, projects")
    .eq("user_id", userId)
    .maybeSingle(); // returns null instead of throwing when there's no row yet

  if (error) throw error;
  if (!data) {
    return { progress: {}, aiLessons: {}, savedProjects: [] };
  }
  return {
    progress: deserializeProgress(data.progress),
    aiLessons: data.ai_lessons || {},
    savedProjects: data.projects || [],
  };
}

// ---- Save everything for the signed-in user (upsert = insert or update) ----
export async function saveState(userId, { progress, aiLessons, savedProjects }) {
  const { error } = await supabase.from("user_state").upsert(
    {
      user_id: userId,
      progress: serializeProgress(progress),
      ai_lessons: aiLessons || {},
      projects: savedProjects || [],
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
