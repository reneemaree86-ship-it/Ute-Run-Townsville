import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { api } from "@/src/api/client";

export default function ConnectReturn() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "complete" | "pending">("loading");

  useEffect(() => {
    (async () => {
      try {
        const s = await api.connectStatus();
        setState(s?.payouts_enabled ? "complete" : "pending");
      } catch {
        setState("pending");
      }
    })();
  }, []);

  const cfg = {
    loading: { icon: "hourglass-outline", color: colors.muted, title: "Checking your account...", sub: "Confirming your payout details with Stripe." },
    complete: { icon: "checkmark-circle", color: colors.success, title: "Payouts enabled!", sub: "You're all set to receive your weekly earnings every Monday." },
    pending: { icon: "time-outline", color: colors.warning, title: "Almost there", sub: "Stripe is still verifying your details. This can take a few minutes — check back from the Earnings tab." },
  }[state];

  return (
    <View style={styles.screen}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + "22" }]}>
        {state === "loading" ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        ) : (
          <Ionicons name={cfg.icon as any} size={56} color={cfg.color} />
        )}
      </View>
      <Txt variant="h1" style={{ textAlign: "center", marginTop: spacing.xl }}>{cfg.title}</Txt>
      <Txt variant="sub" style={{ textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>{cfg.sub}</Txt>
      {state !== "loading" && (
        <Button
          title="Back to Earnings"
          icon="arrow-forward"
          onPress={() => router.replace("/(tabs)/earnings")}
          testID="connect-return-done"
          style={{ marginTop: spacing["2xl"], alignSelf: "stretch", marginHorizontal: spacing.xl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  iconWrap: { width: 110, height: 110, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
