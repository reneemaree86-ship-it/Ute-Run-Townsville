import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, VerifiedBadge, Button } from "@/src/components/ui";
import { ReviewsSection, ReviewsData } from "@/src/components/ReviewsSection";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

export default function DriverProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<(ReviewsData & { name: string; verified: boolean; ute_type?: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api.getReviews(id!)); } catch (e) { console.warn("Request failed:", e); }
      setLoading(false);
    })();
  }, [id]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="driver-back">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h2" style={{ marginLeft: spacing.md }}>Driver profile</Txt>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : !data ? (
        <View style={styles.center}><Txt variant="sub">Could not load this driver.</Txt></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Card style={{ alignItems: "center" }}>
            <View style={styles.avatar}><Ionicons name="person" size={34} color={colors.brandPrimary} /></View>
            <Txt variant="h2" style={{ marginTop: spacing.md }}>{data.name}</Txt>
            <View style={styles.metaRow}>
              {!!data.ute_type && <Txt variant="sub">{data.ute_type}</Txt>}
              {data.verified ? <View style={{ marginLeft: spacing.sm }}><VerifiedBadge /></View> : null}
            </View>
          </Card>

          <Txt variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>Ratings & reviews</Txt>
          <Card>
            <ReviewsSection data={data} emptyHint="This driver has no reviews yet." />
          </Card>

          {user?.active_role === "customer" && (
            <Button
              title={`Request ${data.name?.split(" ")[0] || "this driver"}`}
              icon="paper-plane"
              testID="request-driver-btn"
              onPress={() => router.push(`/post-job?preferred_driver_id=${id}&preferred_driver_name=${encodeURIComponent(data.name || "Driver")}`)}
              style={{ marginTop: spacing.xl }}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
});
