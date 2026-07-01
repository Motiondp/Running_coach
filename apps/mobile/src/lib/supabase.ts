/**
 * Supabase client — single seeded user, real RLS, no login screen (yet).
 *
 * "RLS-ready, defer login" means there IS a real Supabase auth user (created by
 * scripts/db-seed.ts) so auth.uid() and row-level security are genuine — the app
 * just signs in as that user automatically instead of showing a login form. When
 * Phase 1+ adds real onboarding/auth, replace `signInSeedUser` with a proper flow;
 * nothing else changes since every table is already keyed on user_id.
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

const SEED_EMAIL = "dan@motiondp.com";
const SEED_PASSWORD = "ROTATED-REDACTED-PASSWORD";

/** Signs in as the single seeded athlete if no session exists yet. No-op if unconfigured. */
export async function signInSeedUser(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data } = await supabase.auth.getSession();
  if (data.session) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  });
  if (error) {
    console.warn("Crucible: seed sign-in failed —", error.message);
  }
}
