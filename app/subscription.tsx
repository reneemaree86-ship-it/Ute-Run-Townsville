import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button } from "@/src/components/ui";
import { colors, font, radius, spacing, shadow } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { startCheckout } from "@/src/utils/checkout";

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const isDriver = user?.active_role === "driver";

  const [plans, setPlans] = useState<any[]>([]);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const current = user?.subscription;
  const currentActive = current && current.status === "active";

  const load = useCallback(async () => {
    try {
      setPlans(await api.plans(isDriver ? "driver" : "customer"));
    } catch (e) { console.warn("Request failed:", e); }
    setLoading(false);
  }, [isDriver]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      const status = await startCheckout((base) => api.createSubCheckout(planId, billing, base));
      if (status === "paid") await refresh();
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(null);
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await api.cancelSubscription();
      await refresh();
    } catch (e) { console.warn("Request failed:", e); }
    setBusy(null);
  };

  const accent = isDriver ? colors.info : colors.brandPrimary;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="sub-back">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h3">{isDriver ? "Driver Membership" : "Business Plans"}</Txt>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"] }} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: colors.surfaceInverse }]}>
            <View style={[styles.heroBadge, { backgroundColor: accent }]}>
              <Ionicons name={isDriver ? "rocket" : "briefcase"} size={20} color="#fff" />
            </View>
            <Txt variant="h1" color="#fff" style={{ marginTop: spacing.md }}>
              {isDriver ? "Earn more,\nrun smarter" : "Move more,\npay less"}
            </Txt>
            <Txt variant="sub" color="rgba(255,255,255,0.8)" style={{ marginTop: 4 }}>
              {isDriver
                ? "Cut your commission and get priority on every job."
                : "Discounts, priority quoting and tools for your business."}
            </Txt>
          </View>

          {/* current sub banner */}
          {currentActive && (
            <View style={styles.currentBanner} testID="current-sub-banner">
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Txt variant="bodyBold">You're on {current.plan_name}</Txt>
                <Txt variant="caption">Renews {new Date(current.renews_at).toLocaleDateString()} · ${current.price}/{current.billing === "annual" ? "yr" : "mo"}</Txt>
              </View>
              <Pressable onPress={cancel} testID="cancel-sub" hitSlop={8}>
                {busy === "cancel" ? <ActivityIndicator size="small" color={colors.error} /> : <Txt variant="sub" color={colors.error}>Cancel</Txt>}
              </Pressable>
            </View>
          )}

          {/* billing toggle */}
          <View style={styles.billingToggle}>
            <Pressable testID="billing-monthly" onPress={() => setBilling("monthly")} style={[styles.billItem, billing === "monthly" && { backgroundColor: colors.surfaceInverse }]}>
              <Txt variant="bodyBold" color={billing === "monthly" ? "#fff" : colors.muted}>Monthly</Txt>
            </Pressable>
            <Pressable testID="billing-annual" onPress={() => setBilling("annual")} style={[styles.billItem, billing === "annual" && { backgroundColor: colors.surfaceInverse }]}>
              <Txt variant="bodyBold" color={billing === "annual" ? "#fff" : colors.muted}>Annual</Txt>
              <View style={styles.saveTag}><Txt variant="caption" color="#fff">Save 15%</Txt></View>
            </Pressable>
          </View>

          {plans.map((p) => {
            const price = billing === "annual" ? p.price_annual : p.price_monthly;
            const isCurrent = currentActive && current.plan_id === p.id;
            return (
              <View key={p.id} style={[styles.planCard, p.popular && { borderColor: accent, borderWidth: 2 }]} testID={`plan-${p.id}`}>
                {p.popular && (
                  <View style={[styles.popularTag, { backgroundColor: accent }]}>
                    <Txt variant="caption" color="#fff">MOST POPULAR</Txt>
                  </View>
                )}
                <View style={styles.planHead}>
                  <View>
                    <Txt variant="h2">{p.name}</Txt>
                    <Txt variant="caption">{p.tagline}</Txt>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Txt style={{ fontFamily: font.display, fontSize: 28, color: colors.onSurface }}>${price}</Txt>
                    <Txt variant="caption">/{billing === "annual" ? "yr" : "mo"}{p.per_vehicle ? " /ute" : ""}</Txt>
                  </View>
                </View>
                <View style={styles.divider} />
                {p.features.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={accent} />
                    <Txt variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>{f}</Txt>
                  </View>
                ))}
                <Button
                  title={isCurrent ? "Current plan" : "Choose " + p.name}
                  variant={isCurrent ? "secondary" : p.popular ? "primary" : "outline"}
                  onPress={() => subscribe(p.id)}
                  loading={busy === p.id}
                  disabled={isCurrent}
                  testID={`subscribe-${p.id}`}
                  style={{ marginTop: spacing.md, height: 48 }}
                />
              </View>
            );
          })}

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
            <Txt variant="caption" style={{ marginLeft: 6, flex: 1 }}>
              Secure card billing by Stripe. Cancel anytime from this screen.
            </Txt>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  hero: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  heroBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  currentBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#DCF1E4", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  billingToggle: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  billItem: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  saveTag: { backgroundColor: colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  planCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  popularTag: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginBottom: spacing.sm },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  noteRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs },
});
