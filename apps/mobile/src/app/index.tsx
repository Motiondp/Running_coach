import { ScrollView, StyleSheet, Text, View } from "react-native";

import { sampleReadiness, sampleSnapshot } from "@/data/sampleSnapshot";
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
  const s = sampleSnapshot;
  const r = sampleReadiness;
  const vColor = verdictColor[r.verdict];
  const e = s.endurance;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        {/* top bar */}
        <View style={styles.topbar}>
          <Text style={styles.mono}>TODAY · {shortDate(s.local_date).toUpperCase()}</Text>
          {s.athlete.goal_race ? (
            <Text style={[styles.mono, { color: color.endure }]}>
              {s.athlete.goal_race.name.toUpperCase()} · {s.athlete.goal_race.days_out}D
            </Text>
          ) : null}
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

        {/* engines */}
        <View style={styles.engineRow}>
          <View style={[styles.engineCard, { borderTopColor: color.endure }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardLabel, { color: color.endure }]}>ENDURANCE</Text>
              <Text style={[styles.pill, { color: color.green }]}>LIVE</Text>
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

          <View style={[styles.engineCard, { borderTopColor: color.strength }]}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardLabel, { color: color.strength }]}>STRENGTH</Text>
              <Text style={[styles.pill, { color: color.ash }]}>IDLE</Text>
            </View>
            <View style={styles.emptyEngine}>
              <Text style={styles.emptyText}>No lifts logged yet</Text>
              <Text style={[styles.mono, { color: color.strength, fontSize: 10 }]}>OPEN LOGGER →</Text>
            </View>
          </View>
        </View>

        {/* recent */}
        <View style={styles.sectionLabel}>
          <Text style={styles.mono}>RECENT</Text>
          <View style={styles.hr} />
          <Text style={[styles.mono, { color: color.endure }]}>LIVE</Text>
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
          Endurance is live from your intervals.icu. Strength, body comp and today&apos;s session
          arrive as we build Phase 1–2.
        </Text>
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
