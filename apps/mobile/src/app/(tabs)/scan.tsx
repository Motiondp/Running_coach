import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { BodyCompMetric } from "@crucible/core";
import { todayLocal } from "@core-direct/dates/localDate";
import { useLatestSnapshot } from "@/lib/snapshot";
import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

interface CoreFieldSpec {
  metric: BodyCompMetric;
  name: string;
  unit: string;
  placeholder: string;
  why?: string;
}

const CORE_FIELDS: CoreFieldSpec[] = [
  { metric: "weight", name: "Weight", unit: "kg", placeholder: "91.5" },
  { metric: "fat_pct", name: "Body fat", unit: "%", placeholder: "28.0" },
  { metric: "muscle", name: "Muscle mass", unit: "kg", placeholder: "63.5" },
  { metric: "bmr", name: "BMR", unit: "kcal", placeholder: "1978", why: "sets your deficit" },
];

const FULL_PANEL_FIELDS: CoreFieldSpec[] = [
  { metric: "ffm", name: "Fat free mass", unit: "kg", placeholder: "66.8" },
  { metric: "visceral", name: "Visceral fat", unit: "lvl", placeholder: "12" },
  { metric: "tbw_pct", name: "Total body water", unit: "%", placeholder: "53.2" },
  { metric: "bone", name: "Bone mass", unit: "kg", placeholder: "3.3" },
  { metric: "icw", name: "Intracellular water", unit: "kg", placeholder: "29.8" },
  { metric: "ecw", name: "Extracellular water", unit: "kg", placeholder: "19.6" },
  { metric: "bmi", name: "BMI", unit: "", placeholder: "31.7" },
];

interface Prev {
  value: number;
  unit: string;
  date: string;
}

function shortDate(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

export default function ScanScreen() {
  const router = useRouter();
  const { snapshot } = useLatestSnapshot();
  const today = todayLocal("Pacific/Auckland");

  const [tab, setTab] = useState<"log" | "derived">("log");
  const [prevByMetric, setPrevByMetric] = useState<Record<string, Prev>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [showFullPanel, setShowFullPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("body_scan")
      .select("metric, value, unit, date")
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Prev> = {};
        for (const row of data) {
          if (!map[row.metric]) map[row.metric] = { value: Number(row.value), unit: row.unit ?? "", date: row.date };
        }
        setPrevByMetric(map);
      });
  }, []);

  function setValue(metric: string, v: string) {
    setValues((prev) => ({ ...prev, [metric]: v }));
  }
  function dateFor(metric: string): string {
    return dates[metric] ?? today;
  }
  function setDate(metric: string, v: string) {
    setDates((prev) => ({ ...prev, [metric]: v }));
  }

  async function save() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const allFields = [...CORE_FIELDS, ...FULL_PANEL_FIELDS];
    const rows = allFields
      .filter((f) => values[f.metric]?.trim())
      .map((f) => ({
        user_id: userData.user!.id,
        metric: f.metric,
        value: Number(values[f.metric]),
        unit: f.unit,
        date: dateFor(f.metric),
        source: "manual" as const,
      }));

    // Derive fat_mass from weight + fat% when both are logged together (in kg,
    // same date as the fat% reading) — the HTML layout only asks for body fat %,
    // but the recomp insight (fat mass vs FFM) needs fat_mass explicitly.
    const weightVal = values.weight?.trim() ? Number(values.weight) : null;
    const fatPctVal = values.fat_pct?.trim() ? Number(values.fat_pct) : null;
    if (weightVal != null && fatPctVal != null) {
      rows.push({
        user_id: userData.user.id,
        metric: "fat_mass",
        value: Math.round(weightVal * (fatPctVal / 100) * 10) / 10,
        unit: "kg",
        date: dateFor("fat_pct"),
        source: "manual",
      });
    }

    if (rows.length === 0) return;

    setSaving(true);
    const { error } = await supabase.from("body_scan").insert(rows);
    setSaving(false);
    if (error) {
      console.warn("Crucible: scan save failed —", error.message);
      return;
    }

    setSaved(true);
    setTimeout(() => router.back(), 900);
  }

  const derived = snapshot.bodycomp.derived;
  const hasAnyValue = useMemo(
    () => [...CORE_FIELDS, ...FULL_PANEL_FIELDS].some((f) => values[f.metric]?.trim()),
    [values],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.mono, { color: color.endure }]}>‹ TODAY</Text>
        </Pressable>

        <View style={styles.switcher}>
          <Pressable style={[styles.switchBtn, tab === "log" ? styles.switchBtnActive : null]} onPress={() => setTab("log")}>
            <Text style={[styles.switchText, tab === "log" ? styles.switchTextActive : null]}>Log scan</Text>
          </Pressable>
          <Pressable style={[styles.switchBtn, tab === "derived" ? styles.switchBtnActive : null]} onPress={() => setTab("derived")}>
            <Text style={[styles.switchText, tab === "derived" ? styles.switchTextActive : null]}>What it computes</Text>
          </Pressable>
        </View>

        {tab === "log" ? (
          <>
            <Text style={styles.title}>Log body scan</Text>
            <Text style={styles.lede}>
              Core four drive your goals and coach. Add the full panel if you want it on your trends. Each
              metric keeps its own date — your composition and weight scans don't have to match.
            </Text>

            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Read these off your gym scale's printout or app screen — there's no clean export to pull
                from, so typing them in here is the primary way this data gets in.
              </Text>
            </View>

            <View style={styles.sectionLabel}>
              <Text style={styles.mono}>CORE FOUR</Text>
              <View style={styles.hr} />
              <Text style={[styles.mono, { color: color.green }]}>DRIVES COACH</Text>
            </View>

            {CORE_FIELDS.map((f) => (
              <View key={f.metric} style={styles.coreTile}>
                <View style={styles.ctTop}>
                  <Text style={styles.ctName}>
                    {f.name}
                    {f.why ? <Text style={styles.why}> ◆ {f.why.toUpperCase()}</Text> : null}
                  </Text>
                  {prevByMetric[f.metric] ? (
                    <Text style={styles.ctPrev}>
                      prev {prevByMetric[f.metric].value}
                      {prevByMetric[f.metric].unit} · {shortDate(prevByMetric[f.metric].date)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.ctIn}>
                  <View style={styles.withUnit}>
                    <TextInput
                      style={styles.input}
                      value={values[f.metric] ?? ""}
                      onChangeText={(v) => setValue(f.metric, v)}
                      keyboardType="decimal-pad"
                      placeholder={f.placeholder}
                      placeholderTextColor={color.ash}
                    />
                    <Text style={styles.unit}>{f.unit}</Text>
                  </View>
                  <TextInput
                    style={styles.ctDate}
                    value={dateFor(f.metric)}
                    onChangeText={(v) => setDate(f.metric, v)}
                  />
                </View>
              </View>
            ))}

            <Pressable style={styles.moreToggle} onPress={() => setShowFullPanel((v) => !v)}>
              <Text style={styles.moreToggleText}>
                {showFullPanel ? "– Hide full panel" : `+ Add full panel (${FULL_PANEL_FIELDS.length} more)`}
              </Text>
            </Pressable>

            {showFullPanel ? (
              <>
                <View style={styles.sectionLabel}>
                  <Text style={styles.mono}>FULL PANEL</Text>
                  <View style={styles.hr} />
                </View>
                <View style={styles.row2}>
                  {FULL_PANEL_FIELDS.map((f) => (
                    <View key={f.metric} style={[styles.fieldGroup, { flex: 1, minWidth: "45%" }]}>
                      <Text style={styles.label}>{f.name}</Text>
                      <View style={styles.withUnit}>
                        <TextInput
                          style={styles.input}
                          value={values[f.metric] ?? ""}
                          onChangeText={(v) => setValue(f.metric, v)}
                          keyboardType="decimal-pad"
                          placeholder={f.placeholder}
                          placeholderTextColor={color.ash}
                        />
                        <Text style={styles.unit}>{f.unit}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Pressable
              style={[styles.saveBtn, (!hasAnyValue || saving) ? styles.saveBtnDisabled : null]}
              onPress={save}
              disabled={!hasAnyValue || saving}
            >
              <Text style={styles.saveBtnText}>{saved ? "✓ Saved" : saving ? "Saving…" : "Save scan"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>What it computes</Text>
            <Text style={styles.lede}>
              Your scale gives raw numbers. Here's what the coach turns them into — the reason logging the
              full panel is worth it.
            </Text>

            <View style={styles.insight}>
              <View style={styles.ih}>
                <View style={[styles.idot, { backgroundColor: color.green }]} />
                <Text style={styles.iname}>Fueling target · from BMR</Text>
              </View>
              {derived.fueling_target_kcal != null ? (
                <>
                  <Text style={[styles.ibig, { color: color.green }]}>{derived.fueling_target_kcal} kcal/day</Text>
                  <Text style={styles.itext}>
                    Your BMR + training burn − a controlled deficit. This is the number Cronometer gets measured
                    against every day. Without your real BMR, the coach guesses; with it, the math is yours.
                  </Text>
                </>
              ) : (
                <Text style={styles.itext}>Log a BMR reading to unlock this.</Text>
              )}
            </View>

            <View style={styles.insight}>
              <View style={styles.ih}>
                <View style={[styles.idot, { backgroundColor: color.endure }]} />
                <Text style={styles.iname}>Recovery marker · ECW : TBW ratio</Text>
              </View>
              {derived.ecw_tbw_ratio != null ? (
                <>
                  <Text style={[styles.ibig, { color: color.endure }]}>{derived.ecw_tbw_ratio}</Text>
                  <Text style={styles.itext}>
                    Extracellular vs total water. When this climbs scan-to-scan, you're holding inflammatory
                    fluid — a sign of accumulated fatigue or under-recovery. A slow signal, not a daily one, so
                    it lives here on trends, not the morning verdict.
                  </Text>
                </>
              ) : (
                <Text style={styles.itext}>Log extracellular + total body water to unlock this.</Text>
              )}
            </View>

            <View style={styles.insight}>
              <View style={styles.ih}>
                <View style={[styles.idot, { backgroundColor: color.strength }]} />
                <Text style={styles.iname}>True progress · fat mass vs FFM</Text>
              </View>
              {derived.recomp_since_last != null ? (
                <>
                  <Text style={[styles.ibig, { color: color.strength }]}>
                    {derived.recomp_since_last.fat_kg}kg fat · {derived.recomp_since_last.lean_kg >= 0 ? "+" : ""}
                    {derived.recomp_since_last.lean_kg}kg lean
                  </Text>
                  <Text style={styles.itext}>
                    The scale weight hides the real story. Splitting fat mass from fat-free mass shows
                    recomposition the bathroom scale can't — losing fat while building lean is the win, even if
                    total weight barely moves.
                  </Text>
                </>
              ) : (
                <Text style={styles.itext}>Log at least two scans to see recomposition since last time.</Text>
              )}
            </View>

            <View style={styles.insight}>
              <View style={styles.ih}>
                <View style={[styles.idot, { backgroundColor: color.amber }]} />
                <Text style={styles.iname}>Honest note</Text>
              </View>
              <Text style={styles.itext}>
                Bioimpedance numbers drift with hydration, time of day, and food. The coach reads trends across
                scans, never a single reading — so one odd number won't throw off your plan. Scan under the
                same conditions each time for the cleanest line.
              </Text>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 20, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },

  switcher: { flexDirection: "row", gap: 6, marginTop: 14, marginBottom: 6 },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  switchBtnActive: { backgroundColor: color.slate2, borderColor: color.fog },
  switchText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.8, color: color.ash, textTransform: "uppercase" },
  switchTextActive: { color: color.bone },

  title: {
    fontFamily: font.display,
    fontWeight: "800",
    fontSize: 23,
    color: color.bone,
    marginTop: 16,
    marginBottom: 6,
  },
  lede: { fontFamily: font.ui, fontSize: 13.5, color: color.fog, marginBottom: 18, lineHeight: 19 },

  hintBox: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 18,
  },
  hintText: { fontFamily: font.mono, fontSize: 12, color: color.fog, lineHeight: 18 },

  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 6, marginBottom: 12 },
  hr: { flex: 1, height: 1, backgroundColor: color.line },

  coreTile: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    padding: 13,
    marginBottom: 11,
  },
  ctTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  ctName: { fontFamily: font.ui, fontSize: 13.5, fontWeight: "600", color: color.bone },
  why: { fontFamily: font.mono, fontSize: 9, color: color.strength, letterSpacing: 0.5 },
  ctPrev: { fontFamily: font.mono, fontSize: 10, color: color.ash },
  ctIn: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctDate: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.ash,
    backgroundColor: color.void,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 76,
    textAlign: "center",
  },

  withUnit: { flex: 1, position: "relative", justifyContent: "center" },
  input: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 15,
    paddingRight: 40,
    fontFamily: font.mono,
    fontSize: 15,
    color: color.bone,
  },
  unit: { position: "absolute", right: 14, fontFamily: font.mono, fontSize: 12, color: color.ash },

  moreToggle: {
    borderWidth: 1,
    borderColor: color.line,
    borderStyle: "dashed",
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginVertical: 6,
  },
  moreToggleText: { fontFamily: font.mono, fontSize: 11, color: color.fog, letterSpacing: 0.6 },

  row2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fieldGroup: { marginBottom: 14 },
  label: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.6, color: color.ash, marginBottom: 7 },

  insight: {
    backgroundColor: color.slate2,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  ih: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  idot: { width: 8, height: 8, borderRadius: 4 },
  iname: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: color.fog, textTransform: "uppercase" },
  ibig: { fontFamily: font.display, fontWeight: "700", fontSize: 22, marginBottom: 6 },
  itext: { fontFamily: font.ui, fontSize: 12.5, color: color.fog, lineHeight: 18 },

  saveBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
