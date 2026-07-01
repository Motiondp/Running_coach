import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) return;
    setSigningIn(true);
    setError(null);

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSigningIn(false);
    if (signInErr) {
      setError("Couldn't sign in. Check your email and password.");
      return;
    }
    router.replace("/");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.col}>
        <Text style={styles.mono}>CRUCIBLE</Text>
        <Text style={styles.title}>Sign in</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={color.ash}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={color.ash}
            secureTextEntry
            onSubmitEditing={signIn}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.signInBtn, (signingIn || !email.trim() || !password) ? styles.signInBtnDisabled : null]}
          onPress={signIn}
          disabled={signingIn || !email.trim() || !password}
        >
          <Text style={styles.signInBtnText}>{signingIn ? "Signing in…" : "Sign in"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void, justifyContent: "center", alignItems: "center", padding: 18 },
  col: { width: "100%", maxWidth: 360 },

  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 2, color: color.ash, textAlign: "center" },
  title: {
    fontFamily: font.display,
    fontWeight: "800",
    fontSize: 26,
    color: color.bone,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },

  fieldGroup: { marginBottom: 14 },
  label: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, color: color.ash, marginBottom: 7 },
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
  },

  error: { fontFamily: font.ui, fontSize: 12.5, color: color.red, marginBottom: 12 },

  signInBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  signInBtnDisabled: { opacity: 0.4 },
  signInBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 15, color: color.void },
});
