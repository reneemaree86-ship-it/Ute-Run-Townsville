import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, StatusPill } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [convos, setConvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setConvos(await api.conversations()); } catch (e) { console.warn("Request failed:", e); }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt variant="h1">Chat</Txt>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {convos.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={44} color={colors.muted} />
              <Txt variant="h3" style={{ marginTop: spacing.md }}>No chats yet</Txt>
              <Txt variant="sub" style={{ textAlign: "center", marginTop: 4 }}>
                Once a driver is matched, you can chat here.
              </Txt>
            </View>
          ) : (
            convos.map((c) => (
              <Pressable key={c.job_id} testID={`convo-${c.job_id}`} onPress={() => router.push(`/chat/${c.job_id}`)} style={styles.row}>
                {c.other_avatar ? (
                  <Image source={{ uri: c.other_avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="person" size={22} color={colors.brandPrimary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={styles.rowBetween}>
                    <Txt variant="h3" numberOfLines={1}>{c.other_name || "Driver"}</Txt>
                    <StatusPill status={c.status} />
                  </View>
                  <Txt variant="sub" numberOfLines={1} style={{ marginTop: 2 }}>
                    {c.last_message || "Say g'day to get started"}
                  </Txt>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  empty: { alignItems: "center", paddingVertical: spacing["3xl"] },
});
