import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

interface RoutineExerciseSpec {
  exercise_id: string;
  target_sets: number;
  target_reps: number;
}

interface ExerciseInfo {
  id: string;
  name: string;
  muscle_groups: string[];
}

interface SetSlot {
  weight: string;
  reps: string;
  rpe: number;
  completed: boolean;
}

interface ExerciseBlock {
  spec: RoutineExerciseSpec;
  info: ExerciseInfo;
  slots: SetSlot[];
}

const DEFAULT_RPE = 8;
const REST_SECONDS = 90;

export default function LiftSessionScreen() {
  const router = useRouter();
  const { sessionId, routineId } = useLocalSearchParams<{ sessionId: string; routineId: string }>();

  const [routineName, setRoutineName] = useState("");
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: routine, error: routineErr } = await supabase
        .from("routine")
        .select("name, exercises")
        .eq("id", routineId)
        .single();
      if (routineErr || !routine || cancelled) return;

      const specs = routine.exercises as RoutineExerciseSpec[];
      const exerciseIds = specs.map((s) => s.exercise_id);

      const { data: exercises } = await supabase
        .from("exercise")
        .select("id, name, muscle_groups")
        .in("id", exerciseIds);
      const infoById = new Map((exercises ?? []).map((e: any) => [e.id, e as ExerciseInfo]));

      const { data: history } = await supabase
        .from("set_log")
        .select("exercise_id, weight, reps, rpe, created_at")
        .in("exercise_id", exerciseIds)
        .eq("completed", true)
        .order("created_at", { ascending: false })
        .limit(100);

      const lastByExercise = new Map<string, Array<{ weight: number; reps: number; rpe: number | null }>>();
      for (const row of (history ?? []) as any[]) {
        const list = lastByExercise.get(row.exercise_id) ?? [];
        list.push({ weight: Number(row.weight), reps: row.reps, rpe: row.rpe != null ? Number(row.rpe) : null });
        lastByExercise.set(row.exercise_id, list);
      }

      if (cancelled) return;
      setRoutineName(routine.name);
      setBlocks(
        specs.map((spec) => {
          const info = infoById.get(spec.exercise_id) ?? {
            id: spec.exercise_id,
            name: "Unknown exercise",
            muscle_groups: [],
          };
          const last = lastByExercise.get(spec.exercise_id) ?? [];
          const slots: SetSlot[] = Array.from({ length: spec.target_sets }, (_, i) => {
            const prior = last[i];
            return {
              weight: prior ? String(prior.weight) : "",
              reps: prior ? String(prior.reps) : String(spec.target_reps),
              rpe: prior?.rpe ?? DEFAULT_RPE,
              completed: false,
            };
          });
          return { spec, info, slots };
        }),
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  // Rest timer countdown.
  useEffect(() => {
    if (restSecondsLeft === null) return;
    if (restSecondsLeft <= 0) {
      setRestSecondsLeft(null);
      return;
    }
    const t = setTimeout(() => setRestSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [restSecondsLeft]);

  function updateSlot(exIdx: number, setIdx: number, patch: Partial<SetSlot>) {
    setBlocks((prev) => {
      const next = [...prev];
      const slots = [...next[exIdx].slots];
      slots[setIdx] = { ...slots[setIdx], ...patch };
      next[exIdx] = { ...next[exIdx], slots };
      return next;
    });
  }

  async function logSet(exIdx: number, setIdx: number) {
    const block = blocks[exIdx];
    const slot = block.slots[setIdx];
    const weight = Number(slot.weight);
    const reps = Number(slot.reps);
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from("set_log").insert({
      session_id: sessionId,
      user_id: userData.user.id,
      exercise_id: block.info.id,
      weight,
      reps,
      rpe: slot.rpe,
      completed: true,
    });
    if (error) {
      console.warn("Crucible: set log failed —", error.message);
      return;
    }

    updateSlot(exIdx, setIdx, { completed: true });
    setRestSecondsLeft(REST_SECONDS);
  }

  async function finishSession() {
    setFinishing(true);
    await supabase.from("lift_session").update({ status: "completed" }).eq("id", sessionId);
    setFinishing(false);
    router.push("/");
  }

  const totalSets = useMemo(() => blocks.reduce((n, b) => n + b.slots.length, 0), [blocks]);
  const completedSets = useMemo(
    () => blocks.reduce((n, b) => n + b.slots.filter((s) => s.completed).length, 0),
    [blocks],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <View style={styles.topbar}>
          <Text style={[styles.mono, { color: color.strength }]}>
            {routineName ? routineName.toUpperCase() : "SESSION"}
          </Text>
          <Text style={styles.mono}>{completedSets}/{totalSets} SETS</Text>
        </View>

        {restSecondsLeft !== null ? (
          <Pressable style={styles.restChip} onPress={() => setRestSecondsLeft(null)}>
            <Text style={styles.restText}>Resting · {restSecondsLeft}s · tap to skip</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <Text style={styles.empty}>Loading session…</Text>
        ) : (
          blocks.map((block, exIdx) => (
            <View key={block.info.id} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{block.info.name}</Text>
              {block.slots.map((slot, setIdx) => (
                <View key={setIdx} style={[styles.setRow, slot.completed ? styles.setRowDone : null]}>
                  <Text style={styles.setIndex}>{setIdx + 1}</Text>

                  <TextInput
                    style={styles.input}
                    value={slot.weight}
                    onChangeText={(v) => updateSlot(exIdx, setIdx, { weight: v })}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={color.ash}
                    editable={!slot.completed}
                  />
                  <TextInput
                    style={styles.input}
                    value={slot.reps}
                    onChangeText={(v) => updateSlot(exIdx, setIdx, { reps: v })}
                    keyboardType="number-pad"
                    placeholder="reps"
                    placeholderTextColor={color.ash}
                    editable={!slot.completed}
                  />

                  <View style={styles.rpeStepper}>
                    <Pressable
                      disabled={slot.completed}
                      onPress={() => updateSlot(exIdx, setIdx, { rpe: Math.max(1, slot.rpe - 1) })}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.rpeValue}>{slot.rpe}</Text>
                    <Pressable
                      disabled={slot.completed}
                      onPress={() => updateSlot(exIdx, setIdx, { rpe: Math.min(10, slot.rpe + 1) })}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={[styles.logBtn, slot.completed ? styles.logBtnDone : null]}
                    onPress={() => logSet(exIdx, setIdx)}
                    disabled={slot.completed}
                  >
                    <Text style={styles.logBtnText}>{slot.completed ? "✓" : "LOG"}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))
        )}

        <Pressable style={styles.finishBtn} onPress={finishSession} disabled={finishing}>
          <Text style={styles.finishBtnText}>{finishing ? "Finishing…" : "Finish session"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 24, paddingBottom: 60, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },
  empty: { fontFamily: font.ui, fontSize: 13, color: color.ash, marginTop: 8 },

  restChip: {
    backgroundColor: color.slate2,
    borderWidth: 1,
    borderColor: color.strength,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  restText: { fontFamily: font.mono, fontSize: 12, color: color.strength },

  exerciseCard: {
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderTopWidth: 2,
    borderTopColor: color.strength,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  exerciseName: { fontFamily: font.ui, fontWeight: "600", fontSize: 14, color: color.bone, marginBottom: 10 },

  setRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  setRowDone: { opacity: 0.55 },
  setIndex: { fontFamily: font.mono, fontSize: 11, color: color.ash, width: 14 },

  input: {
    flex: 1,
    backgroundColor: color.void,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: font.mono,
    fontSize: 13,
    color: color.bone,
  },

  rpeStepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBtnText: { fontFamily: font.mono, fontSize: 16, color: color.bone, paddingHorizontal: 4 },
  rpeValue: { fontFamily: font.mono, fontSize: 13, color: color.fog, minWidth: 16, textAlign: "center" },

  logBtn: {
    backgroundColor: color.slate2,
    borderWidth: 1,
    borderColor: color.strength,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logBtnDone: { borderColor: color.green, backgroundColor: color.slate2 },
  logBtnText: { fontFamily: font.mono, fontSize: 12, color: color.bone },

  finishBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  finishBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
