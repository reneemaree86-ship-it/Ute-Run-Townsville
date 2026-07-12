import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [job, setJob] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const [msgs, j] = await Promise.all([api.getMessages(id!), api.getJob(id!)]);
      setMessages(msgs);
      setJob(j);
    } catch (e) { console.warn("Request failed:", e); }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const msg = await api.postMessage(id!, body);
      setMessages((m) => [...m, msg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) { console.warn("Request failed:", e); }
  };

  const otherName = user?.id === job?.driver_id ? job?.customer_name : job?.driver_name;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="chat-back">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ marginLeft: spacing.md }}>
          <Txt variant="h3">{otherName || "Chat"}</Txt>
          <Txt variant="caption">{job ? job.job_type.replace("_", " ") : ""}</Txt>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.muted} />
              <Txt variant="sub" style={{ marginTop: spacing.sm }}>Say g'day 👋</Txt>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <View key={m.id} style={[styles.bubbleWrap, mine ? styles.mine : styles.theirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Txt variant="body" color={mine ? "#fff" : colors.onSurface}>{m.text}</Txt>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable onPress={send} style={styles.sendBtn} testID="chat-send">
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surfaceSecondary },
  empty: { alignItems: "center", paddingVertical: spacing["3xl"] },
  bubbleWrap: { maxWidth: "80%" },
  mine: { alignSelf: "flex-end" },
  theirs: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, height: 48, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
