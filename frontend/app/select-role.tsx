import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { useAuth, Role } from "@/src/context/AuthContext";

export default function SelectRole() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, selectInitialRole } = useAuth();
  const [role, setRole] = useState<Role>("customer");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await selectInitialRole(role);
      router.replace("/(tabs)");
    } catch {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing["2xl"] }]}>
      <Txt variant="h1">G'day{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}! 👋</Txt>
      <Txt variant="sub" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        How do you want to use UteRun? You can switch anytime.
      </Txt>

      <Card active={role === "customer"} onPress={() => setRole("customer")} testID="pick-customer"
        icon="cube-outline" title="I need a ute" sub="Post pickups, deliveries, moves & tip runs" />
      <Card active={role === "driver"} onPress={() => setRole("driver")} testID="pick-driver"
        icon="car-sport-outline" title="I drive a ute" sub="Accept jobs and earn cash locally" />

      <Button title="Continue" icon="arrow-forward" onPress={submit} loading={loading} testID="select-role-continue" style={{ marginTop: spacing["2xl"] }} />
    </View>
  );
}

function Card({ active, icon, title, sub, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.card, active && styles.cardActive]}>
      <View style={[styles.iconWrap, active && { backgroundColor: colors.brandPrimary }]}>
        <Ionicons name={icon} size={26} color={active ? "#fff" : colors.brandPrimary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Txt variant="h3">{title}</Txt>
        <Txt variant="caption">{sub}</Txt>
      </View>
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? colors.brandPrimary : colors.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md },
  cardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  iconWrap: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
});
