import { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * Whether the athlete still needs to complete onboarding (age is the simplest
 * required field to check — the whole form saves together, so age null means
 * nothing's been saved yet).
 */
export function useNeedsOnboarding(): { checking: boolean; needsOnboarding: boolean } {
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const check = () => {
      supabase
        .from("athlete")
        .select("age")
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setNeedsOnboarding(!data || data.age == null);
          setChecking(false);
        });
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { checking, needsOnboarding };
}
