/**
 * Supabase client — single seeded user, real RLS, real login screen.
 *
 * "RLS-ready" means there is one real Supabase auth user (created by
 * scripts/db-seed.ts) so auth.uid() and row-level security are genuine, not faked.
 * There used to be a hardcoded auto-sign-in here for local-only convenience; it was
 * removed because the credential ends up in the public JS bundle the moment this app
 * is deployed anywhere reachable — see apps/mobile/src/app/login.tsx instead.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// A placeholder URL keeps createClient() from throwing when env vars are absent
// (e.g. this first Expo milestone, before Supabase credentials are wired in) — the
// app falls back to the bundled sample snapshot in that case (see data/liveSnapshot.ts).
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  {
    auth: {
      // AsyncStorage's web shim reaches for `window` unconditionally, which throws
      // during Expo Router's server-side prerender (no window in that Node context).
      // On web, omit `storage` entirely — supabase-js's own default resolution
      // already guards with `typeof window !== 'undefined'` and falls back safely.
      storage: Platform.OS === "web" ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

