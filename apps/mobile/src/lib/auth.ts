import { useEffect, useState } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Whether there's an active Supabase session right now. No polling — subscribes to auth changes. */
export function useSession(): { checking: boolean; signedIn: boolean } {
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSignedIn(Boolean(data.session));
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSignedIn(Boolean(session));
      setChecking(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { checking, signedIn };
}
