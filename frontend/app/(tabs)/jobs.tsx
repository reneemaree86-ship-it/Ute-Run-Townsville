import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, StatusPill, Chip } from "@/src/components/ui";
import { colors, radius, spacing, JOB_TYPE_META, LOAD_META } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

const FILTERS = ["all", "active", "completed"];

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isDriver = user?.active_role === "driver";
  const [jobs, setJobs] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = isDriver ? await api.activeJobs() : await api.myJobs();
      setJobs(data);
    } catch {}
    setLoading(false);
  }, [isDriver]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = jobs.filter((j) => {
    if (filter === "all") return true;
    if (filter === "completed") return ["completed", "cancelled"].includes(j.status);
    return ["open", "accepted", "picked_up", "delivered"].includes(j.status);
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt variant="h1">{isDriver ? "My Runs" : "My Jobs"}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} testID={`filter-${f}`} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={44} color={colors.muted} />
              <Txt variant="h3" style={{ marginTop: spacing.md }}>No jobs here yet</Txt>
              <Txt variant="sub" style={{ textAlign: "center", marginTop: 4 }}>
                {isDriver ? "Accept jobs from the map to see them here." : "Post your first job to get started."}
              </Txt>
            </View>
          ) : (
            filtered.map((j) => {
              const m = JOB_TYPE_META[j.job_type];
              return (
                <Pressable key={j.id} testID={`job-row-${j.id}`} onPress={() => router.push(`/job/${j.id}`)} style={{ marginBottom: spacing.md }}>
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={styles.row}>
                        <View style={styles.icon}>
                          <Ionicons name={m.icon as any} size={20} color={colors.brandSecondary} />
                        </View>
                        <View style={{ marginLeft: spacing.md }}>
                          <Txt variant="h3">{m.label}</Txt>
                          <Txt variant="caption">{LOAD_META[j.load_size].label} · {j.distance_km} km</Txt>
                        </View>
                      </View>
                      <StatusPill status={j.status} />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.rowBetween}>
                      <Txt variant="sub" numberOfLines={1} style={{ flex: 1 }}>
                        {j.pickup_address} → {j.dropoff_address}
                      </Txt>
                      <Txt variant="bodyBold" color={colors.brandSecondary} style={{ marginLeft: spacing.sm }}>
                        ${isDriver ? j.fare.driver_earnings : j.fare.total}
                      </Txt>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing["3xl"] },
});
