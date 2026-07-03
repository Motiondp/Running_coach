import type { PlannedSession, SessionKind } from "@crucible/core";
import { isoDateToUtcNoon, todayLocal } from "@core-direct/dates/localDate";
import { sessionTitle } from "@core-direct/plan/adjust";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePlanTemplate } from "@/lib/planTemplate";
import { color, font, radius } from "@/theme/tokens";

// Monday-first display order over the template's 0=Sun..6=Sat keys.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL: Record<number, string> = {
  0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT",
};

const KIND_COLOR: Record<SessionKind, string> = {
  run: color.endure,
  lift: color.strength,
  cross: color.endure,
  rest: color.ash,
};

const KIND_LABEL: Record<SessionKind, string> = {
  run: "RUN",
  lift: "LIFT",
  cross: "CROSS",
  rest: "REST",
};

function restSession(): PlannedSession {
  return { kind: "rest", title: "Rest day", detail: "Recovery", load: 0 };
}

export default function PlanScreen() {
  const router = useRouter();
  const { template, reload } = usePlanTemplate();
  const today = todayLocal("Pacific/Auckland");
  const todayWeekday = isoDateToUtcNoon(today).getUTCDay();

  // Refresh whenever the tab regains focus (e.g. returning from the edit modal).
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.col}>
        <Text style={styles.mono}>YOUR WEEK</Text>
        <Text style={styles.title}>Training plan</Text>
        <Text style={styles.lede}>
          Your weekly rhythm — tap any day to edit it. Each morning the coach adapts the day's session
          to your readiness; this is the baseline it works from.
        </Text>

        {WEEKDAY_ORDER.map((wd) => {
          const session = template[wd] ?? restSession();
          const isToday = wd === todayWeekday;
          const accent = KIND_COLOR[session.kind];
          const isRest = session.kind === "rest";

          return (
            <Pressable
              key={wd}
              onPress={() => router.push({ pathname: "/plan-edit", params: { weekday: String(wd) } })}
              style={[
                styles.dayRow,
                { borderLeftColor: accent },
                isToday ? styles.dayRowToday : null,
                isRest ? styles.dayRowRest : null,
              ]}
            >
              <View style={styles.dayLeft}>
                <Text style={[styles.dayLabel, isToday ? { color: color.bone } : null]}>
                  {WEEKDAY_LABEL[wd]}
                </Text>
                {isToday ? <Text style={styles.todayTag}>TODAY</Text> : null}
              </View>

              <View style={styles.dayBody}>
                <Text style={[styles.sessionTitle, isRest ? { color: color.ash } : null]}>
                  {sessionTitle(session)}
                </Text>
                {session.detail ? <Text style={styles.sessionDetail}>{session.detail}</Text> : null}
              </View>

              <View style={styles.dayRight}>
                <Text style={[styles.kindTag, { color: accent }]}>{KIND_LABEL[session.kind]}</Text>
                {!isRest ? <Text style={styles.loadTag}>{session.load}</Text> : null}
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.footer}>
          Edits save to your account and drive tomorrow's session. Race-anchored progression
          (a plan that builds toward race day) is next.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  content: { padding: 18, paddingTop: 24, paddingBottom: 40, alignItems: "center" },
  col: { width: "100%", maxWidth: 420 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },
  title: { fontFamily: font.display, fontWeight: "800", fontSize: 24, color: color.bone, marginTop: 6, marginBottom: 6 },
  lede: { fontFamily: font.ui, fontSize: 13, color: color.fog, marginBottom: 20, lineHeight: 18 },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  dayRowToday: { backgroundColor: color.slate2, borderColor: color.fog },
  dayRowRest: { opacity: 0.6 },

  dayLeft: { width: 44 },
  dayLabel: { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.5, color: color.ash },
  todayTag: { fontFamily: font.mono, fontSize: 8, letterSpacing: 0.5, color: color.green, marginTop: 3 },

  dayBody: { flex: 1 },
  sessionTitle: { fontFamily: font.ui, fontSize: 14, fontWeight: "600", color: color.bone },
  sessionDetail: { fontFamily: font.ui, fontSize: 11.5, color: color.fog, marginTop: 2 },

  dayRight: { alignItems: "flex-end", gap: 4 },
  kindTag: { fontFamily: font.mono, fontSize: 9, letterSpacing: 0.8 },
  loadTag: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.bone,
    backgroundColor: color.void,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  footer: {
    fontFamily: font.ui,
    fontSize: 11,
    lineHeight: 16,
    color: color.ash,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 11,
  },
});
