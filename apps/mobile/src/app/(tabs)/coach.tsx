import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { color, font, radius } from "@/theme/tokens";

// Single ongoing conversation for now — no thread-switching UI yet (single-user MVP).
const MAIN_THREAD_ID = "11111111-1111-4111-8111-111111111111";

interface Message {
  id: string;
  role: "user" | "coach" | "system";
  content: string;
}

export default function CoachScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    supabase
      .from("coach_message")
      .select("id, role, content")
      .eq("thread_id", MAIN_THREAD_ID)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
        setLoading(false);
      });
  }, []);

  function scrollToEnd() {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;

    setDraft("");
    setSending(true);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
    scrollToEnd();

    const { data: session } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("coach", {
      body: { message: text, thread_id: MAIN_THREAD_ID },
      headers: session.session ? { Authorization: `Bearer ${session.session.access_token}` } : undefined,
    });

    setSending(false);
    if (error || !data?.reply) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "system", content: "Coach is unavailable right now — try again shortly." },
      ]);
      scrollToEnd();
      return;
    }

    setMessages((prev) => [...prev, { id: `coach-${Date.now()}`, role: "coach", content: data.reply }]);
    if (data.injury_logged) {
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "system",
          content: `Logged: ${data.injury_logged.location.replace(/_/g, " ")}, severity ${data.injury_logged.severity}/10`,
        },
      ]);
    }
    scrollToEnd();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.mono, { color: color.endure }]}>‹ TODAY</Text>
        </Pressable>
        <Text style={styles.mono}>COACH</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToEnd}
      >
        {loading ? (
          <Text style={styles.empty}>Loading conversation…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.empty}>
            Ask about today's session, log an injury, or talk through your plan.
          </Text>
        ) : (
          messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === "user"
                  ? styles.bubbleUser
                  : m.role === "system"
                    ? styles.bubbleSystem
                    : styles.bubbleCoach,
              ]}
            >
              <Text style={m.role === "user" ? styles.bubbleTextUser : styles.bubbleText}>{m.content}</Text>
            </View>
          ))
        )}
        {sending ? <Text style={styles.thinking}>Coach is thinking…</Text> : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your coach…"
          placeholderTextColor={color.ash}
          multiline
          onSubmitEditing={send}
        />
        <Pressable style={styles.sendBtn} onPress={send} disabled={sending || !draft.trim()}>
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.void },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  mono: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, color: color.ash },

  messages: { flex: 1 },
  messagesContent: { padding: 18, paddingTop: 4, gap: 10 },
  empty: { fontFamily: font.ui, fontSize: 13, color: color.ash, textAlign: "center", marginTop: 30 },
  thinking: { fontFamily: font.mono, fontSize: 11, color: color.ash, marginTop: 4 },

  bubble: { maxWidth: "85%", borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: color.bone, alignSelf: "flex-end" },
  bubbleCoach: { backgroundColor: color.slate, borderWidth: 1, borderColor: color.line, alignSelf: "flex-start" },
  bubbleSystem: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: color.line,
    alignSelf: "center",
  },
  bubbleText: { fontFamily: font.ui, fontSize: 13.5, lineHeight: 19, color: color.bone },
  bubbleTextUser: { fontFamily: font.ui, fontSize: 13.5, lineHeight: 19, color: color.void },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  input: {
    flex: 1,
    backgroundColor: color.slate,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: font.ui,
    fontSize: 14,
    color: color.bone,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: color.bone,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  sendBtnText: { fontFamily: font.ui, fontWeight: "600", fontSize: 14, color: color.void },
});
