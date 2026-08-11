// src/lib/supabase.js
//
// The Supabase client. CodeQuest now shares Study It's Supabase project so ONE
// account works across both apps (sign in on either, you're the same user).
//
// The URL + anon key below are Study It's project defaults. Env vars still win
// if you set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in Vercel or a local
// .env — handy for pointing a dev build at a throwaway project. If they're not
// set, the hardcoded defaults are used, so a plain GitHub deploy just works.
//
// IMPORTANT: the "anon" key is safe to expose in the browser — Row Level
// Security (see codequest-supabase-schema.sql) is what actually protects the
// data. NEVER put the "service_role" key in front-end code.

import { createClient } from "@supabase/supabase-js";

// Study It's project (the shared backend).
const DEFAULT_SUPABASE_URL = "https://nfbzmxuruxqgbeeypsoq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYnpteHVydXhxZ2JlZXlwc29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ0MTUsImV4cCI6MjA5NTU3MDQxNX0.NqQKeIO3pYOk5rbG4YtJApz1lnss_OZvhWuVkIY79-U";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const url = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey);
