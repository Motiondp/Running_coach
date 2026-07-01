import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { PainPoint } from "@crucible/core";
// Direct path into core's source (not the package's "exports" map) — Metro has
// unstable_enablePackageExports disabled (see metro.config.js), so package.json
// subpath exports don't resolve here. This file has zero runtime imports of its own,
// so a plain relative/aliased path bundles safely. See lib/snapshot.ts for the twin case.
import { todayLocal } from "@core-direct/dates/localDate";
import { useCheckinStore } from "@/lib/checkinStore";
import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

const PAIN_LOCATIONS = [
  "Knee", "Ankle", "Hip", "Lower back", "Achilles", "Hamstring", "Shoulder", "Calf", "Foot",
];

const ENERGY_LABELS = ["Wrecked", "Low", "OK", "Good", "Fresh"];

export default function CheckinScreen() {
  const router = useRouter();
  const setTodaysCheckin = useCheckinStore((s) => s.setTodaysCheckin);

  const [pain, setPain] = useState<Record<string, number>>({});
  const [energy, setEnergy] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function togglePain(location: string) {
    setPain((prev) => {
      const next = { ...prev };
      if (location in next) delete next[location];
      else next[location] = 5;
      return next;
    });
  }

  function setSeverity(location: string, severity: number) {
    setPain((prev) => ({ ...prev, [location]: severity }));
  }

  async function save() {
    setSaving(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setSaving(false);
      console.warn("Crucible: check-in save failed — not signed in");
      return;
    }

    const painPoints: PainPoint[] = Object.entries(pain).map(([location, severity]) => ({
      location: location.toLowerCase().replace(/\s+/g, "_"),
      severity,
    }));
    const date = todayLocal("Pacific/Auckland");

    const { error } = await supabase
      .from("checkin")
      .upsert(
        { user_id: userData.user.id, date, energy, pain: painPoints },
        { onConflict: "user_id,date" },
      );

    setSaving(false);
    if (error) {
      console.warn("Crucible: check-in save failed —", error.message);
      return;
    }

    setTodaysCheckin({ present: true, energy, pain: painPoints });
    router.back();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Text style={styles.mono}>MORNING CHECK-IN</Text>
        <Text style={styles.title}>How are you today?</Text>

        <Text style={styles.sectionLabel}>Anything hurt?</Text>
        <View style={styles.chipRow}>
          {PAIN_LOCATIONS.map((loc) => {
            const active = loc in pain;
            return (
              <Pressable
                key={loc}
                onPress={() => togglePain(loc)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{loc}</Text>
              </Pressable>
            );
          })}
        </View>

        {Object.keys(pain).length > 0 ? (
          <View style={styles.severityBlock}>
            {Object.entries(pain).map(([loc, severity]) => (
              <View key={loc} style={styles.severityRow}>
                <Text style={styles.severityLabel}>{loc}</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setSeverity(loc, Math.max(0, severity - 1))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </Pressable>
                  <Text style={[styles.severityValue, { color: severityColor(severity) }]}>
                    {severity}
                  </Text>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => setSeverity(loc, Math.min(10, severity + 1))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Energy</Text>
        <View style={styles.energyRow}>
          {ENERGY_LABELS.map((label, i) => {
            const value = i + 1;
            const active = energy === value;
            return (
              <Pressable
                key={label}
                onPress={() => setEnergy(value)}
                style={[styles.energyBtn, active ? styles.energyBtnActive : null]}
              >
                <Text style={[styles.energyValue, active ? { color: color.bone } : null]}>{value}</Text>
                <Text style={[styles.energyLabel, active ? { color: color.fog } : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.saveBtn, (saving || energy === null) ? styles.saveBtnDisabled : null]}
          onPress={save}
          disabled={saving || energy === null}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save check-in"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function severityColor(severity: number): string {
  if (severity >= 7) return color.red;
  if (severity >= 4) return color.amber;
  return color.fog;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 24, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },
  title: {
    fontFamily: font.display,
    fontWeight: "800",
    fontSize: 24,
    color: color.bone,
    marginTop: 6,
    marginBottom: 22,
  },

  sectionLabel: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: color.ash,
    marginBottom: 12,
    marginTop: 8,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: {
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.slate,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: color.slate2, borderColor: color.red },
  chipText: { fontFamily: font.ui, fontSize: 13, color: color.fog },
  chipTextActive: { color: color.bone, fontWeight: "600" },

  severityBlock: { marginTop: 14, gap: 8 },
  severityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  severityLabel: { fontFamily: font.ui, fontSize: 13, color: color.bone },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontFamily: font.mono, fontSize: 15, color: color.bone },
  severityValue: { fontFamily: font.mono, fontSize: 15, minWidth: 20, textAlign: "center" },

  energyRow: { flexDirection: "row", gap: 8, marginBottom: 28 },
  energyBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.slate,
  },
  energyBtnActive: { borderColor: color.endure, backgroundColor: color.slate2 },
  energyValue: { fontFamily: font.mono, fontSize: 17, color: color.ash },
  energyLabel: { fontFamily: font.ui, fontSize: 10, color: color.ash },

  saveBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
