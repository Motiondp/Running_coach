/**
 * The athlete's editable weekly template, read live from `athlete.plan_template` and
 * merged over the built-in default. Exposes a `reload` so the Plan screen can refresh
 * after an edit. Falls back to the default template when Supabase isn't configured.
 */
import { useCallback, useEffect, useState } from "react";

import type { WeeklyTemplate } from "@crucible/core";
import { DEFAULT_WEEKLY_TEMPLATE, mergeWeeklyTemplate } from "@core-direct/plan/defaultTemplate";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function usePlanTemplate(): { template: WeeklyTemplate; reload: () => void } {
  const [template, setTemplate] = useState<WeeklyTemplate>(DEFAULT_WEEKLY_TEMPLATE);

  const reload = useCallback(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from("athlete")
      .select("plan_template")
      .maybeSingle()
      .then(({ data }) => {
        setTemplate(mergeWeeklyTemplate((data?.plan_template ?? null) as Partial<WeeklyTemplate> | null));
      });
  }, []);

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) reload();
    });
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  return { template, reload };
}
