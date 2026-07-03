import type { PlannedSession, SessionKind, WeeklyTemplate } from "@crucible/core";
import { mergeWeeklyTemplate } from "@core-direct/plan/defaultTemplate";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};

const KINDS: { value: SessionKind; label: string }[] = [
  { value: "run", label: "Run" },
  { value: "lift", label: "Lift" },
  { value: "cross", label: "Cross" },
  { value: "rest", label: "Rest" },
];

export default function PlanEditScreen() {
  const router = useRouter();
  const { weekday: weekdayParam } = useLocalSearchParams<{ weekday: string }>();
  const weekday = Number(weekdayParam);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<SessionKind>("run");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    supabase
      .from("athlete")
      .select("plan_template")
      .maybeSingle()
      .then(({ data }) => {
        const merged = mergeWeeklyTemplate((data?.plan_template ?? null) as Partial<WeeklyTemplate> | null);
        const s = merged[weekday];
        if (s) {
          setKind(s.kind);
          setTitle(s.title ?? "");
          setDetail(s.detail ?? "");
          setLoad(s.load ? String(s.load) : "");
          setReps(s.reps != null ? String(s.reps) : "");
          setUnit(s.unit ?? "");
        }
        setLoading(false);
      });
  }, [weekday]);

  async function save() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }

    const session: PlannedSession =
      kind === "rest"
        ? { kind: "rest", title: title.trim() || "Rest day", detail: detail.trim() || undefined, load: 0 }
        : {
            kind,
            title: title.trim(),
            detail: detail.trim() || undefined,
            load: Number(load) || 0,
            ...(kind === "run" && reps.trim() && unit.trim()
              ? { reps: Number(reps), unit: unit.trim() }
              : {}),
          };

    // Read the current stored template, patch this day, write the full 7-day object back.
    const { data: cur } = await supabase.from("athlete").select("plan_template").maybeSingle();
    const merged = mergeWeeklyTemplate((cur?.plan_template ?? null) as Partial<WeeklyTemplate> | null);
    const next: WeeklyTemplate = { ...merged, [weekday]: session };

    const { error } = await supabase.from("athlete").upsert({ id: userData.user.id, plan_template: next });
    setSaving(false);
    if (error) {
      console.warn("Crucible: plan save failed —", error.message);
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.mono}>LOADING…</Text>
      </View>
    );
  }

  const isRest = kind === "rest";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.mono, { color: color.endure }]}>‹ CANCEL</Text>
        </Pressable>
        <Text style={styles.mono}>{(WEEKDAY_LABEL[weekday] ?? "Day").toUpperCase()}</Text>
        <Text style={styles.title}>Edit session</Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.value}
              style={[styles.chip, kind === k.value ? styles.chipActive : null]}
              onPress={() => setKind(k.value)}
            >
              <Text style={[styles.chipText, kind === k.value ? styles.chipTextActive : null]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        {!isRest ? (
          <>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={kind === "run" ? "Easy 6 km" : "Lower strength"}
              placeholderTextColor={color.ash}
            />

            <Text style={styles.label}>Detail</Text>
            <TextInput
              style={styles.input}
              value={detail}
              onChangeText={setDetail}
              placeholder="Zone 2, conversational"
              placeholderTextColor={color.ash}
            />

            <Text style={styles.label}>Target load</Text>
            <TextInput
              style={styles.input}
              value={load}
              onChangeText={setLoad}
              keyboardType="number-pad"
              placeholder="40"
              placeholderTextColor={color.ash}
            />

            {kind === "run" ? (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Reps (intervals)</Text>
                  <TextInput
                    style={styles.input}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="number-pad"
                    placeholder="5"
                    placeholderTextColor={color.ash}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>Per rep</Text>
                  <TextInput
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="1 km @ threshold"
                    placeholderTextColor={color.ash}
                  />
                </View>
              </View>
            ) : null}
            {kind === "run" ? (
              <Text style={styles.hint}>
                Fill reps + per-rep for interval sessions (shows as “5×1 km…” and lets the coach cut reps
                on hard days). Leave blank for steady runs.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>Rest day — no session. Recovery only.</Text>
        )}

        <Pressable style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save day"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 24, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash, marginBottom: 4 },
  title: { fontFamily: font.display, fontWeight: "800", fontSize: 24, color: color.bone, marginTop: 2, marginBottom: 20 },

  label: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, color: color.ash, marginBottom: 7, marginTop: 6 },
  input: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontFamily: font.ui,
    fontSize: 15,
    color: color.bone,
    marginBottom: 8,
  },
  row2: { flexDirection: "row", gap: 10 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.slate,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  chipActive: { backgroundColor: color.slate2, borderColor: color.fog },
  chipText: { fontFamily: font.ui, fontSize: 13, color: color.fog },
  chipTextActive: { color: color.bone, fontWeight: "600" },

  hint: { fontFamily: font.ui, fontSize: 11.5, color: color.ash, lineHeight: 16, marginTop: 4, marginBottom: 8 },

  saveBtn: { backgroundColor: color.bone, borderRadius: radius.sm, paddingVertical: 15, alignItems: "center", marginTop: 14 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
