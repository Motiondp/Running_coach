import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

const DISTANCE_PRESETS = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Half", km: 21.1 },
  { label: "Full", km: 42.2 },
];

const PRIORITIES = [
  { value: "fat_loss", label: "Fat loss" },
  { value: "muscle", label: "Muscle" },
  { value: "race", label: "Race" },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [age, setAge] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]["value"]>("fat_loss");

  const [raceName, setRaceName] = useState("");
  const [raceDistanceKm, setRaceDistanceKm] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [raceTargetTime, setRaceTargetTime] = useState("");

  const [targetWeight, setTargetWeight] = useState("");
  const [targetFatPct, setTargetFatPct] = useState("");
  const [targetMuscle, setTargetMuscle] = useState("");

  useEffect(() => {
    supabase
      .from("athlete")
      .select(
        "age, priority, goal_race_name, goal_race_distance_km, goal_race_date, goal_race_target_time, bodycomp_target_weight, bodycomp_target_fat_pct, bodycomp_target_muscle",
      )
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.age != null) setAge(String(data.age));
          if (data.priority) setPriority(data.priority);
          if (data.goal_race_name) setRaceName(data.goal_race_name);
          if (data.goal_race_distance_km != null) setRaceDistanceKm(String(data.goal_race_distance_km));
          if (data.goal_race_date) setRaceDate(data.goal_race_date);
          if (data.goal_race_target_time) setRaceTargetTime(data.goal_race_target_time);
          if (data.bodycomp_target_weight != null) setTargetWeight(String(data.bodycomp_target_weight));
          if (data.bodycomp_target_fat_pct != null) setTargetFatPct(String(data.bodycomp_target_fat_pct));
          if (data.bodycomp_target_muscle != null) setTargetMuscle(String(data.bodycomp_target_muscle));
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }

    const num = (s: string): number | null => (s.trim() ? Number(s) : null);

    const { error } = await supabase.from("athlete").upsert({
      id: userData.user.id,
      age: num(age),
      priority,
      goal_race_name: raceName.trim() || null,
      goal_race_distance_km: num(raceDistanceKm),
      goal_race_date: raceDate.trim() || null,
      goal_race_target_time: raceTargetTime.trim() || null,
      bodycomp_target_weight: num(targetWeight),
      bodycomp_target_fat_pct: num(targetFatPct),
      bodycomp_target_muscle: num(targetMuscle),
    });

    setSaving(false);
    if (error) {
      console.warn("Crucible: onboarding save failed —", error.message);
      return;
    }
    router.replace("/");
  }

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.mono}>LOADING…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.mono, { color: color.endure }]}>‹ TODAY</Text>
        </Pressable>
        <Text style={[styles.mono, { marginTop: 14 }]}>SET UP CRUCIBLE</Text>
        <Text style={styles.title}>Tell the coach about you</Text>
        <Text style={styles.lede}>
          This drives the daily verdict and every recommendation. Editable anytime from Today.
        </Text>

        <View style={styles.sectionLabel}>
          <Text style={styles.mono}>ABOUT YOU</Text>
          <View style={styles.hr} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="36"
            placeholderTextColor={color.ash}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p) => (
              <Pressable
                key={p.value}
                style={[styles.chip, priority === p.value ? styles.chipActive : null]}
                onPress={() => setPriority(p.value)}
              >
                <Text style={[styles.chipText, priority === p.value ? styles.chipTextActive : null]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={[styles.mono, { color: color.endure }]}>RACE GOAL</Text>
          <View style={styles.hr} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Race name</Text>
          <TextInput
            style={styles.input}
            value={raceName}
            onChangeText={setRaceName}
            placeholder="Auckland Marathon"
            placeholderTextColor={color.ash}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Distance</Text>
          <View style={styles.chipRow}>
            {DISTANCE_PRESETS.map((d) => (
              <Pressable
                key={d.label}
                style={[styles.chip, raceDistanceKm === String(d.km) ? styles.chipActive : null]}
                onPress={() => setRaceDistanceKm(String(d.km))}
              >
                <Text
                  style={[styles.chipText, raceDistanceKm === String(d.km) ? styles.chipTextActive : null]}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={raceDistanceKm}
            onChangeText={setRaceDistanceKm}
            keyboardType="decimal-pad"
            placeholder="custom km, e.g. 42.2"
            placeholderTextColor={color.ash}
          />
        </View>
        <View style={styles.row2}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Race date</Text>
            <TextInput
              style={styles.input}
              value={raceDate}
              onChangeText={setRaceDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={color.ash}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Target time</Text>
            <TextInput
              style={styles.input}
              value={raceTargetTime}
              onChangeText={setRaceTargetTime}
              placeholder="HH:MM:SS"
              placeholderTextColor={color.ash}
            />
          </View>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={[styles.mono, { color: color.strength }]}>BODY-COMP GOAL</Text>
          <View style={styles.hr} />
        </View>
        <View style={styles.row2}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Target weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              placeholder="85"
              placeholderTextColor={color.ash}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Target fat %</Text>
            <TextInput
              style={styles.input}
              value={targetFatPct}
              onChangeText={setTargetFatPct}
              keyboardType="decimal-pad"
              placeholder="18"
              placeholderTextColor={color.ash}
            />
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Target muscle mass (kg)</Text>
          <TextInput
            style={styles.input}
            value={targetMuscle}
            onChangeText={setTargetMuscle}
            keyboardType="decimal-pad"
            placeholder="65"
            placeholderTextColor={color.ash}
          />
        </View>

        <Pressable style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save and continue"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 30, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },
  title: {
    fontFamily: font.display,
    fontWeight: "800",
    fontSize: 24,
    color: color.bone,
    marginTop: 8,
    marginBottom: 6,
  },
  lede: { fontFamily: font.ui, fontSize: 13, color: color.fog, marginBottom: 24, lineHeight: 18 },

  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, marginBottom: 12 },
  hr: { flex: 1, height: 1, backgroundColor: color.line },

  fieldGroup: { marginBottom: 14 },
  label: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, color: color.ash, marginBottom: 7 },
  input: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontFamily: font.mono,
    fontSize: 15,
    color: color.bone,
  },
  row2: { flexDirection: "row", gap: 10 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.slate,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: color.slate2, borderColor: color.fog },
  chipText: { fontFamily: font.ui, fontSize: 13, color: color.fog },
  chipTextActive: { color: color.bone, fontWeight: "600" },

  saveBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
