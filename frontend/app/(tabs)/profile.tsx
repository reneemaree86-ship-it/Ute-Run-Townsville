import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, VerifiedBadge, Stars, Button } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";
import { useAuth, Role } from "@/src/context/AuthContext";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);

  const role = user?.active_role;
  const dp = user?.driver_profile;

  const doSwitch = async (r: Role) => {
    if (r === role) return;
    setSwitching(true);
    try { await switchRole(r); } catch {}
    setSwitching(false);
  };

  const vStatus = dp?.verification_status;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Txt variant="h1">Profile</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Card style={{ alignItems: "center" }}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={34} color={colors.brandPrimary} />
          </View>
          <Txt variant="h2" style={{ marginTop: spacing.md }}>{user?.full_name}</Txt>
          <Txt variant="sub">{user?.email}</Txt>
          <View style={styles.metaRow}>
            <Stars value={user?.rating || 5} />
            {user?.phone_verified ? <View style={{ marginLeft: spacing.md }}><VerifiedBadge /></View> : null}
          </View>
        </Card>

        {/* Role toggle */}
        <Txt variant="h3" style={styles.sectionTitle}>Mode</Txt>
        <View style={styles.segment}>
          <Pressable testID="mode-customer" onPress={() => doSwitch("customer")} disabled={switching}
            style={[styles.segItem, role === "customer" && styles.segActive]}>
            <Ionicons name="cube-outline" size={18} color={role === "customer" ? "#fff" : colors.muted} />
            <Txt variant="bodyBold" color={role === "customer" ? "#fff" : colors.muted} style={{ marginLeft: 6 }}>Customer</Txt>
          </Pressable>
          <Pressable testID="mode-driver" onPress={() => doSwitch("driver")} disabled={switching}
            style={[styles.segItem, role === "driver" && styles.segActive]}>
            <Ionicons name="car-sport-outline" size={18} color={role === "driver" ? "#fff" : colors.muted} />
            <Txt variant="bodyBold" color={role === "driver" ? "#fff" : colors.muted} style={{ marginLeft: 6 }}>Driver</Txt>
          </Pressable>
        </View>

        {/* Driver verification */}
        {role === "driver" && (
          <>
            <Txt variant="h3" style={styles.sectionTitle}>Driver status</Txt>
            <Card>
              {!dp ? (
                <>
                  <Txt variant="sub" style={{ marginBottom: spacing.md }}>You haven't submitted your driver details yet.</Txt>
                  <Button title="Start verification" icon="shield-checkmark" onPress={() => router.push("/driver-onboarding")} testID="start-verification" />
                </>
              ) : (
                <View style={styles.row}>
                  <Ionicons
                    name={vStatus === "approved" ? "checkmark-circle" : "time"}
                    size={26}
                    color={vStatus === "approved" ? colors.success : colors.warning}
                  />
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Txt variant="h3">{vStatus === "approved" ? "Verified driver" : "Under review"}</Txt>
                    <Txt variant="sub">{dp.ute_type} · Rego {dp.rego}</Txt>
                  </View>
                </View>
              )}
            </Card>
          </>
        )}

        <Pressable testID="open-subscription" onPress={() => router.push("/subscription")} style={[styles.subCard, { backgroundColor: role === "driver" ? colors.info : colors.brandPrimary }]}>
          <View style={styles.subIcon}>
            <Ionicons name={role === "driver" ? "rocket" : "briefcase"} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            {user?.subscription?.status === "active" ? (
              <>
                <Txt variant="h3" color="#fff">{user.subscription.plan_name} member</Txt>
                <Txt variant="caption" color="rgba(255,255,255,0.85)">Tap to manage your plan</Txt>
              </>
            ) : (
              <>
                <Txt variant="h3" color="#fff">{role === "driver" ? "Go Premium" : "UteRun for Business"}</Txt>
                <Txt variant="caption" color="rgba(255,255,255,0.85)">{role === "driver" ? "Lower commission & priority jobs" : "Save up to 25% on every job"}</Txt>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>

        <Txt variant="h3" style={styles.sectionTitle}>More</Txt>
        <Card style={{ padding: 0 }}>
          <MenuItem icon="help-buoy-outline" label="Help & Support" />
          <MenuItem icon="document-text-outline" label="Terms & Privacy" />
          <MenuItem icon="information-circle-outline" label="About UteRun" last />
        </Card>

        <Button title="Log out" variant="outline" icon="log-out-outline" onPress={logout} testID="logout-btn" style={{ marginTop: spacing.xl }} />
        <Txt variant="caption" style={{ textAlign: "center", marginTop: spacing.lg }}>UteRun Townsville · v1.0</Txt>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, last }: { icon: any; label: string; last?: boolean }) {
  return (
    <Pressable style={[styles.menuItem, !last && styles.menuBorder]}>
      <Ionicons name={icon} size={20} color={colors.onSurfaceTertiary} />
      <Txt variant="bodyBold" style={{ flex: 1, marginLeft: spacing.md }}>{label}</Txt>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  avatar: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  segItem: { flex: 1, height: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  segActive: { backgroundColor: colors.brandPrimary },
  subCard: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  subIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
});
