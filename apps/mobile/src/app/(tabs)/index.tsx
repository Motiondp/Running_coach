import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { todayLocal } from "@core-direct/dates/localDate";
import { useSession } from "@/lib/auth";
import { useNeedsOnboarding } from "@/lib/onboarding";
import { useLatestSnapshot } from "@/lib/snapshot";
import { supabase } from "@/lib/supabase";
import { color, font, radius, verdictColor } from "@/theme/tokens";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const VERDICT_LABEL: Record<string, string> = {
  green: "Cleared to train",
  amber: "Train with care",
  red: "Back off today",
};

export default function TodayScreen() {
  const router = useRouter();
  const { checking: authChecking, signedIn } = useSession();
  const { checking: onboardingChecking, needsOnboarding } = useNeedsOnboarding();
  const { snapshot: s, readiness: r, isSample, loading } = useLatestSnapshot();
  const vColor = verdictColor[r.verdict];
  const e = s.endurance;
  const checkin = s.checkin_today;

  useEffect(() => {
    if (authChecking) return;
    if (!signedIn) {
      router.replace("/login");
      return;
    }
    if (!onboardingChecking && needsOnboarding) router.replace("/onboarding");
  }, [authChecking, signedIn, onboardingChecking, needsOnboarding]);

  if (authChecking || !signedIn || onboardingChecking || needsOnboarding) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.mono}>LOADING…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        {/* top bar */}
        <View style={styles.topbar}>
          <Text style={styles.mono}>
            TODAY · {shortDate(todayLocal("Pacific/Auckland")).toUpperCase()}
            {loading ? " · SYNCING…" : isSample ? " · SAMPLE" : ""}
          </Text>
          <Pressable onPress={() => router.push("/onboarding")}>
            {s.athlete.goal_race ? (
              <Text style={[styles.mono, { color: color.endure }]}>
                {s.athlete.goal_race.name.toUpperCase()} · {s.athlete.goal_race.days_out}D
              </Text>
            ) : (
              <Text style={[styles.mono, { color: color.endure }]}>SET GOALS →</Text>
            )}
          </Pressable>
        </View>

        {/* hero verdict */}
        <View style={styles.heroRow}>
          <View style={styles.scoreWrap}>
            <Text style={[styles.score, { color: vColor }]}>{r.score}</Text>
            <Text style={styles.scoreOf}>/ 100</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.verdictTag}>
              <View style={[styles.dot, { backgroundColor: vColor }]} />
              <Text style={[styles.verdictTagText, { color: vColor }]}>{r.verdict.toUpperCase()}</Text>
            </View>
            <Text style={styles.verdictLabel}>{VERDICT_LABEL[r.verdict]}</Text>
          </View>
        </View>

        {/* gauge bar */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${r.score}%`, backgroundColor: vColor }]} />
        </View>

        {/* rationale */}
        <Text style={styles.rationale}>
          {r.factors.map((f) => f.detail).join(" · ")}. Hold intensity on the hard reps.
        </Text>

        {/* subjective check-in */}
        <Pressable style={styles.checkinRow} onPress={() => router.push("/checkin")}>
          {checkin.present ? (
            <>
              <View style={[styles.dot, { backgroundColor: color.green }]} />
              <Text style={styles.checkinText}>
                Checked in · energy {checkin.energy}/5
                {checkin.pain.length > 0
                  ? ` · ${checkin.pain.map((p) => p.location.replace(/_/g, " ")).join(", ")}`
                  : " · no pain"}
              </Text>
              <Text style={[styles.mono, { color: color.endure }]}>EDIT</Text>
            </>
          ) : (
            <>
              <View style={[styles.dot, { backgroundColor: color.ash }]} />
              <Text style={styles.checkinText}>2-tap check-in · body + energy</Text>
              <Text style={[styles.mono, { color: color.endure }]}>LOG →</Text>
            </>
          )}
        </Pressable>

        {/* coach chat */}
        <Pressable style={styles.checkinRow} onPress={() => router.push("/coach")}>
          <View style={[styles.dot, { backgroundColor: color.strength }]} />
          <Text style={styles.checkinText}>Discuss or adjust today's plan</Text>
          <Text style={[styles.mono, { color: color.strength }]}>COACH →</Text>
        </Pressable>

        {/* body scan */}
        <Pressable style={styles.checkinRow} onPress={() => router.push("/scan")}>
          <View style={[styles.dot, { backgroundColor: color.amber }]} />
          <Text style={styles.checkinText}>
            {s.bodycomp.weight
              ? `Last scan: ${s.bodycomp.weight.value}kg · ${s.bodycomp.weight.date}`
              : "Log your quarterly body scan"}
          </Text>
          <Text style={[styles.mono, { color: color.amber }]}>SCAN →</Text>
        </Pressable>

        {/* engines */}
        <View style={styles.engineRow}>
          <View style={[styles.engineCard, { borderTopColor: color.endure }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardLabel, { color: color.endure }]}>ENDURANCE</Text>
              <Text style={[styles.pill, { color: isSample ? color.ash : color.green }]}>
                {isSample ? "SAMPLE" : "LIVE"}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Stat value={`${e.ctl}`} label="FIT" />
              <Stat value={`${e.atl}`} label="FATIG" />
              <Stat value={signed(e.tsb ?? 0)} label="FORM" valueColor={color.endure} />
            </View>
            <Text style={styles.engineSub}>
              HRV {e.hrv_last}ms{" "}
              <Text style={{ color: color.amber }}>↓{Math.abs(e.hrv_pct_delta ?? 0)}%</Text>
              {"\n"}
              SLEEP {e.sleep_hours_last}h · RHR {e.resting_hr}
            </Text>
          </View>

          <Pressable
            style={[styles.engineCard, { borderTopColor: color.strength }]}
            onPress={() => router.push("/lift")}
          >
            <View style={styles.cardHead}>
              <Text style={[styles.cardLabel, { color: color.strength }]}>STRENGTH</Text>
              <Text style={[styles.pill, { color: color.ash }]}>
                {s.strength.per_group.length > 0 ? "SYNCED" : "IDLE"}
              </Text>
            </View>
            {s.strength.per_group.length > 0 ? (
              <>
                <View style={styles.statRow}>
                  {s.strength.per_group.slice(0, 3).map((g) => (
                    <Stat key={g.group} value={signed(g.freshness)} label={g.group.slice(0, 6).toUpperCase()} valueColor={color.strength} />
                  ))}
                </View>
                <Text style={[styles.mono, { color: color.strength, fontSize: 10, marginTop: 11 }]}>
                  LOG A SESSION →
                </Text>
              </>
            ) : (
              <View style={styles.emptyEngine}>
                <Text style={styles.emptyText}>No lifts logged yet</Text>
                <Text style={[styles.mono, { color: color.strength, fontSize: 10 }]}>OPEN LOGGER →</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* recent */}
        <View style={styles.sectionLabel}>
          <Text style={styles.mono}>RECENT</Text>
          <View style={styles.hr} />
          <Text style={[styles.mono, { color: isSample ? color.ash : color.endure }]}>
            {isSample ? "SAMPLE" : "LIVE"}
          </Text>
        </View>

        {e.recent_runs.map((run) => (
          <View key={run.date} style={styles.runRow}>
            <View style={[styles.dot, { backgroundColor: color.endure }]} />
            <Text style={styles.runName}>
              {run.type} · {run.distance_km} km
            </Text>
            <Text style={styles.runMeta}>
              {shortDate(run.date)}
              {run.avg_hr ? ` · ${run.avg_hr}bpm` : ""}
            </Text>
            <Text style={styles.loadBadge}>{run.load}</Text>
          </View>
        ))}

        <Text style={styles.footer}>
          {isSample
            ? "Showing bundled sample data — Supabase isn't configured or has no snapshot yet."
            : "Endurance is live from your intervals.icu via Supabase."}{" "}
          Strength, body comp and today&apos;s session arrive as we build Phase 1–2.
        </Text>

        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          <Text style={[styles.mono, { marginTop: 14 }]}>SIGN OUT</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, valueColor }: { value: string; label: string; valueColor?: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 28, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },

  heroRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 20, marginBottom: 14 },
  scoreWrap: { alignItems: "center", width: 116 },
  score: { fontFamily: font.mono, fontSize: 52, fontWeight: "700", lineHeight: 56 },
  scoreOf: { fontFamily: font.mono, fontSize: 10, color: color.ash, marginTop: 2 },
  verdictTag: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  verdictTagText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.2 },
  verdictLabel: { fontFamily: font.display, fontWeight: "800", fontSize: 26, color: color.bone, lineHeight: 28 },
  dot: { width: 9, height: 9, borderRadius: 5 },

  track: { height: 6, backgroundColor: color.slate2, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill },

  rationale: { fontFamily: font.ui, fontSize: 13.5, lineHeight: 20, color: color.fog, marginTop: 14, marginBottom: 20 },

  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  checkinText: { fontFamily: font.ui, fontSize: 12.5, color: color.fog, flex: 1 },

  engineRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  engineCard: {
    flex: 1,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderTopWidth: 2,
    borderRadius: radius.md,
    padding: 13,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardLabel: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1 },
  pill: {
    fontFamily: font.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statValue: { fontFamily: font.mono, fontSize: 17, color: color.bone },
  statLabel: { fontFamily: font.mono, fontSize: 8, letterSpacing: 0.6, color: color.ash, marginTop: 2 },
  engineSub: { fontFamily: font.mono, fontSize: 10, lineHeight: 16, color: color.fog, marginTop: 11 },

  emptyEngine: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  emptyText: { fontFamily: font.ui, fontSize: 11, color: color.ash },

  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4, marginBottom: 10 },
  hr: { flex: 1, height: 1, backgroundColor: color.line },

  runRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 7,
  },
  runName: { fontFamily: font.ui, fontSize: 13, fontWeight: "500", color: color.bone, flex: 1 },
  runMeta: { fontFamily: font.mono, fontSize: 10, color: color.ash },
  loadBadge: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.bone,
    backgroundColor: color.slate2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  footer: {
    fontFamily: font.ui,
    fontSize: 11,
    lineHeight: 16,
    color: color.ash,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 11,
  },
});
