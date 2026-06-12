// src/lib/supabase.js
// The Supabase client. Reads your project URL + anon key from environment
// variables (set these in Vercel, and in a local .env file for development).
//
// IMPORTANT: the "anon" key is safe to expose in the browser — Row Level
// Security (see supabase-schema.sql) is what actually protects the data.
// NEVER put the "service_role" key in front-end code.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Helps you catch a missing env var early instead of a confusing runtime error.
  console.warn(
    "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "in your .env (local) and in Vercel → Project → Settings → Environment Variables."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
