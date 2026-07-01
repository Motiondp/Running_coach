import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { todayLocal } from "@core-direct/dates/localDate";
import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

interface RoutineRow {
  id: string;
  name: string;
  exercises: Array<{ exercise_id: string; target_sets: number; target_reps: number }>;
}

export default function RoutinePickerScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("routine")
      .select("id, name, exercises")
      .order("created_at", { ascending: true });
    if (!error && data) setRoutines(data as RoutineRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startSession(routine: RoutineRow) {
    setStarting(routine.id);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStarting(null);
      return;
    }

    const { data: session, error } = await supabase
      .from("lift_session")
      .insert({
        user_id: userData.user.id,
        routine_id: routine.id,
        date: todayLocal("Pacific/Auckland"),
        status: "in_progress",
      })
      .select("id")
      .single();

    setStarting(null);
    if (error || !session) {
      console.warn("Crucible: could not start session —", error?.message);
      return;
    }

    router.push({ pathname: "/lift/session", params: { sessionId: session.id, routineId: routine.id } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.mono, { color: color.endure }]}>‹ TODAY</Text>
        </Pressable>
        <Text style={styles.title}>Start a session</Text>

        {loading ? (
          <Text style={styles.empty}>Loading routines…</Text>
        ) : routines.length === 0 ? (
          <Text style={styles.empty}>No routines yet.</Text>
        ) : (
          routines.map((r) => (
            <Pressable
              key={r.id}
              style={styles.card}
              onPress={() => startSession(r)}
              disabled={starting !== null}
            >
              <View style={[styles.dot, { backgroundColor: color.strength }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardMeta}>{r.exercises.length} exercises</Text>
              </View>
              <Text style={[styles.mono, { color: color.strength }]}>
                {starting === r.id ? "STARTING…" : "START →"}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
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
    marginTop: 10,
    marginBottom: 20,
  },
  empty: { fontFamily: font.ui, fontSize: 13, color: color.ash, marginTop: 8 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderTopWidth: 2,
    borderTopColor: color.strength,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  cardName: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.bone },
  cardMeta: { fontFamily: font.mono, fontSize: 10, color: color.ash, marginTop: 3 },
});
