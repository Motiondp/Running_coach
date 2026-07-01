import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { color, font } from "@/theme/tokens";

export default function LogScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.col}>
        <MaterialCommunityIcons name="format-list-bulleted" size={28} color={color.ash} />
        <Text style={styles.mono}>LOG · COMING SOON</Text>
        <Text style={styles.title}>Your unified history</Text>
        <Text style={styles.lede}>
          Runs, lifts, check-ins, and body scans in one feed — stat tiles for endurance form,
          weekly tonnage, HRV trend, and intake vs. deficit. Arrives as we build this out.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void, justifyContent: "center", alignItems: "center", padding: 30 },
  col: { alignItems: "center", maxWidth: 320, gap: 10 },
  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash, marginTop: 4 },
  title: {
    fontFamily: font.display,
    fontWeight: "800",
    fontSize: 22,
    color: color.bone,
    textAlign: "center",
  },
  lede: { fontFamily: font.ui, fontSize: 13, color: color.fog, textAlign: "center", lineHeight: 19 },
});
