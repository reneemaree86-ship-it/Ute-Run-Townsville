import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, Button } from "@/src/components/ui";
import { colors, font, radius, spacing, JOB_TYPE_META } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { startOnboarding } from "@/src/utils/connect";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function EarningsScreen() {
  const { user } = useAuth();
  return user?.active_role === "driver" ? <DriverEarnings /> : <CustomerPayments />;
}

function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [connect, setConnect] = useState<any>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.earnings()); } catch (e) { console.warn("Request failed:", e); }
    try { setConnect(await api.connectStatus()); } catch (e) { console.warn("Request failed:", e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onSetupPayouts = async () => {
    setOnboarding(true);
    const result = await startOnboarding();
    setOnboarding(false);
    if (result === "error") {
      Alert.alert("Payout setup", "We couldn't start Stripe onboarding. Please try again.");
      return;
    }
    await load();
  };

  if (loading) return <Center><ActivityIndicator color={colors.brandPrimary} /></Center>;

  const chart = data?.week_chart || [0, 0, 0, 0, 0, 0, 0];
  const maxV = Math.max(...chart, 1);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt variant="h1">Earnings</Txt>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.heroCard}>
          <Txt variant="sub" color="rgba(255,255,255,0.8)">Today's earnings</Txt>
          <Txt color="#fff" style={{ fontFamily: font.display, fontSize: 44, marginVertical: 4 }}>
            ${data?.today?.toFixed(2)}
          </Txt>
          <View style={styles.heroRow}>
            <View>
              <Txt variant="caption" color="rgba(255,255,255,0.7)">This week</Txt>
              <Txt variant="h3" color="#fff">${data?.week?.toFixed(2)}</Txt>
            </View>
            <View>
              <Txt variant="caption" color="rgba(255,255,255,0.7)">This month</Txt>
              <Txt variant="h3" color="#fff">${data?.month?.toFixed(2)}</Txt>
            </View>
            <View>
              <Txt variant="caption" color="rgba(255,255,255,0.7)">Trips</Txt>
              <Txt variant="h3" color="#fff">{data?.trips}</Txt>
            </View>
          </View>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <Txt variant="h3" style={{ marginBottom: spacing.lg }}>This week</Txt>
          <View style={styles.chart}>
            {chart.map((v: number, i: number) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: 8 + (v / maxV) * 110, backgroundColor: v > 0 ? colors.brandPrimary : colors.border }]} />
                <Txt variant="caption" style={{ marginTop: 6 }}>{DAYS[i]}</Txt>
              </View>
            ))}
          </View>
        </Card>

        {connect?.payouts_enabled ? (
          <View style={styles.payoutCard}>
            <View style={styles.row}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Txt variant="h3">Payouts active</Txt>
                <Txt variant="sub">Earnings are paid every Monday via Stripe</Txt>
              </View>
            </View>
          </View>
        ) : connect?.connected ? (
          <View style={styles.payoutSetup}>
            <View style={styles.row}>
              <Ionicons name="time-outline" size={22} color={colors.warning} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Txt variant="h3">Finish payout setup</Txt>
                <Txt variant="sub">Stripe needs a few more details before you can be paid.</Txt>
              </View>
            </View>
            <Button
              title="Continue setup"
              icon="arrow-forward"
              loading={onboarding}
              onPress={onSetupPayouts}
              testID="setup-payouts-btn"
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.payoutSetup}>
            <View style={styles.row}>
              <Ionicons name="cash-outline" size={22} color={colors.brandPrimary} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Txt variant="h3">Set up payouts</Txt>
                <Txt variant="sub">Connect your bank with Stripe to get paid weekly.</Txt>
              </View>
            </View>
            <Button
              title="Set up payouts"
              icon="card-outline"
              loading={onboarding}
              onPress={onSetupPayouts}
              testID="setup-payouts-btn"
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CustomerPayments() {
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setJobs(await api.myJobs()); } catch (e) { console.warn("Request failed:", e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const paid = jobs.filter((j) => j.status === "completed");
  const total = paid.reduce((s, j) => s + (j.fare?.total || 0), 0);

  if (loading) return <Center><ActivityIndicator color={colors.brandPrimary} /></Center>;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt variant="h1">Payments</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.heroCard}>
          <Txt variant="sub" color="rgba(255,255,255,0.8)">Total spent</Txt>
          <Txt color="#fff" style={{ fontFamily: font.display, fontSize: 40, marginVertical: 4 }}>${total.toFixed(2)}</Txt>
          <Txt variant="caption" color="rgba(255,255,255,0.7)">{paid.length} completed jobs · paid by card</Txt>
        </View>

        <Txt variant="h3" style={{ marginVertical: spacing.lg }}>Payment history</Txt>
        {paid.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={40} color={colors.muted} />
            <Txt variant="sub" style={{ marginTop: spacing.sm }}>No payments yet</Txt>
          </View>
        ) : (
          paid.map((j) => (
            <Card key={j.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <View style={styles.icon}>
                    <Ionicons name={JOB_TYPE_META[j.job_type].icon as any} size={18} color={colors.brandSecondary} />
                  </View>
                  <View style={{ marginLeft: spacing.md }}>
                    <Txt variant="h3">{JOB_TYPE_META[j.job_type].label}</Txt>
                    <Txt variant="caption">{j.driver_name || "Driver"}</Txt>
                  </View>
                </View>
                <Txt variant="h3" color={colors.onSurface}>${j.fare.total}</Txt>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  heroCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl },
  heroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 150 },
  barCol: { alignItems: "center", flex: 1 },
  bar: { width: 22, borderRadius: radius.sm },
  payoutCard: {
    backgroundColor: "#DCF1E4", borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg,
  },
  payoutSetup: {
    backgroundColor: colors.surfaceElevated || "#fff", borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  icon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: spacing["2xl"] },
});
