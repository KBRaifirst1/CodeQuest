// src/lib/persistence.js
//
// The read/write layer behind useCloudSave.js. One row per user in the
// `codequest_state` table holds their whole saved CodeQuest state as a JSON
// blob.
//
// This table lives in Study It's Supabase project, namespaced `codequest_`
// so it sits alongside Study It's own tables (profiles / notebooks / feedback)
// without colliding. Row Level Security (codequest-supabase-schema.sql) scopes
// every row to its owner: a user can only read and write their own row.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE PASSES THE WHOLE STATE THROUGH INSTEAD OF LISTING KEYS
//
// saveState used to build its payload from an explicit list:
//
//     data: {
//       progress:      state.progress,
//       aiLessons:     state.aiLessons,
//       savedProjects: state.savedProjects,
//     }
//
// That was correct when CodeQuest had three pieces of saved state. The app
// grew to twelve and the list did not, so nine of them were silently thrown
// away on their way to the account:
//
//     lessonStats, profileDescription, projectConcepts, circuitDone,
//     aiDone, reviewSets, reviewMark, snippets, projectDrafts
//
// Nothing failed. buildSnapshot() collected all twelve, the upsert succeeded,
// and the row came back missing most of it — so signing in on a second device
// restored progress and lost everything else. Sandbox snippets and unfinished
// projects were part of that loss, but so were the learner's profile, their
// review schedule and every circuit they had built.
//
// A whitelist has to be updated by whoever adds the thirteenth key, and it
// gives no signal when they forget. Passing the object through has no such
// failure mode: new state syncs the day it exists.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";

const TABLE = "codequest_state";

// The shape a brand-new account starts from. Only the keys whose ABSENCE
// would break a caller expecting to iterate or index them — anything else can
// be undefined until the app writes it.
const EMPTY = { progress: {}, aiLessons: {}, savedProjects: [] };

// Postgres will take a large jsonb value, but a row that grows without limit
// eventually fails to write and takes the whole save with it — including the
// progress that was previously syncing fine. Snippets and project drafts carry
// full source code, so they are the realistic way to get there.
//
// At the cap the newest work is kept and the oldest dropped, and the failure
// is visible in the console rather than silent.
const MAX_BYTES = 4 * 1024 * 1024;

function trimToFit(data) {
  let out = data;
  let json = JSON.stringify(out);
  if (json.length <= MAX_BYTES) return out;

  // Drop the heaviest, most re-creatable things first, newest kept.
  for (const key of ["projectDrafts", "snippets"]) {
    if (!Array.isArray(out[key]) || !out[key].length) continue;
    const sorted = [...out[key]].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    for (let keep = Math.floor(sorted.length / 2); keep >= 0; keep = Math.floor(keep / 2)) {
      out = { ...out, [key]: sorted.slice(0, keep) };
      json = JSON.stringify(out);
      if (json.length <= MAX_BYTES) {
        console.warn(
          "[codequest] save was too large; kept the " + keep + " newest " + key + "."
        );
        return out;
      }
      if (keep === 0) break;
    }
  }
  console.warn("[codequest] save is still over the size cap after trimming.");
  return out;
}

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
  // Merge over EMPTY so a key the saved blob predates is filled honestly,
  // while everything the blob does carry comes through untouched.
  return saved ? { ...EMPTY, ...saved } : { ...EMPTY };
}

// Upsert a user's whole state. Debounced by the caller (useCloudSave).
export async function saveState(userId, state) {
  if (!userId) return;
  if (!state || typeof state !== "object") return;

  // Everything the app put in the snapshot, with the three long-standing keys
  // defaulted so an early save still has the shape loadState promises.
  const data = trimToFit({
    ...state,
    progress: state.progress || {},
    aiLessons: state.aiLessons || {},
    savedProjects: state.savedProjects || [],
  });

  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, data: data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}
