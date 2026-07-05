import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, Button } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setStats(await api.adminStats()); } catch (e) { console.warn("Request failed:", e); }
    try { setPending(await api.adminPendingDrivers()); } catch (e) { console.warn("Request failed:", e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const review = async (uid: string, action: "approve" | "reject", name: string) => {
    setBusy(uid);
    try {
      await api.adminVerifyDriver(uid, action);
      setPending((p) => p.filter((d) => d.id !== uid));
      setStats((s: any) => s ? { ...s, pending: Math.max(0, s.pending - 1), [action === "approve" ? "approved" : "rejected"]: s[action === "approve" ? "approved" : "rejected"] + 1 } : s);
      Alert.alert("Done", `${name} ${action === "approve" ? "approved ✅" : "rejected"}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not update");
    }
    setBusy(null);
  };

  const confirmReject = (uid: string, name: string) =>
    Alert.alert("Reject driver?", `Reject ${name}'s application?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => review(uid, "reject", name) },
    ]);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }}>
        <Txt variant="h1">Admin</Txt>
        <Txt variant="sub">Driver verification</Txt>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.statRow}>
            {[["Pending", stats?.pending, colors.warning], ["Approved", stats?.approved, colors.success], ["Jobs", stats?.total_jobs, colors.brandPrimary]].map(([label, val, c]) => (
              <View key={label as string} style={styles.statCard}>
                <Txt style={[styles.statNum, { color: c as string }]}>{val ?? 0}</Txt>
                <Txt variant="caption">{label as string}</Txt>
              </View>
            ))}
          </View>

          <Txt variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            Pending applications {pending.length ? `(${pending.length})` : ""}
          </Txt>

          {pending.length === 0 ? (
            <Card style={{ alignItems: "center", paddingVertical: spacing["2xl"] }}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} />
              <Txt variant="sub" style={{ marginTop: spacing.sm }}>All caught up — no pending drivers.</Txt>
            </Card>
          ) : (
            pending.map((d) => {
              const dp = d.driver_profile || {};
              return (
                <Card key={d.id} style={{ marginBottom: spacing.lg }}>
                  <Txt variant="h3">{d.full_name}</Txt>
                  <Txt variant="caption">{d.email}{d.phone ? ` · ${d.phone}` : ""}</Txt>
                  <View style={styles.kv}><Txt variant="caption" style={styles.k}>Ute</Txt><Txt variant="sub">{dp.ute_type}</Txt></View>
                  <View style={styles.kv}><Txt variant="caption" style={styles.k}>Licence</Txt><Txt variant="sub">{dp.license_no}</Txt></View>
                  <View style={styles.kv}><Txt variant="caption" style={styles.k}>Rego</Txt><Txt variant="sub">{dp.rego}</Txt></View>
                  <View style={styles.kv}><Txt variant="caption" style={styles.k}>Insurer</Txt><Txt variant="sub">{dp.insurance}</Txt></View>
                  {!!dp.abn && <View style={styles.kv}><Txt variant="caption" style={styles.k}>ABN</Txt><Txt variant="sub">{dp.abn}</Txt></View>}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {[dp.license_photo, dp.rego_photo, ...(dp.ute_photos || [])].filter(Boolean).map((uri: string, i: number) => (
                      <Image key={i} source={{ uri }} style={styles.doc} contentFit="cover" />
                    ))}
                  </ScrollView>

                  <View style={styles.actions}>
                    <Button title="Reject" variant="secondary" onPress={() => confirmReject(d.id, d.full_name)} style={{ flex: 1 }} testID={`reject-${d.id}`} />
                    <Button title="Approve" loading={busy === d.id} onPress={() => review(d.id, "approve", d.full_name)} style={{ flex: 1 }} testID={`approve-${d.id}`} />
                  </View>
                </Card>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
  statNum: { fontSize: 26, fontWeight: "800" },
  kv: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  k: { color: colors.muted },
  doc: { width: 96, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
});
