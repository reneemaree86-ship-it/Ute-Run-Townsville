import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

export default function PaymentReturn() {
  const router = useRouter();
  const { session_id, canceled } = useLocalSearchParams<{ session_id?: string; canceled?: string }>();
  const { refresh } = useAuth();
  const [state, setState] = useState<"loading" | "paid" | "pending" | "canceled">("loading");
  const [kind, setKind] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (canceled) { setState("canceled"); return; }
      if (!session_id) { setState("pending"); return; }
      try {
        const r = await api.verifyPayment(session_id);
        setKind(r.kind);
        setState(r.status === "paid" ? "paid" : "pending");
        await refresh();
      } catch {
        setState("pending");
      }
    })();
  }, [session_id, canceled, refresh]);

  const cfg = {
    loading: { icon: "hourglass-outline", color: colors.muted, title: "Confirming payment...", sub: "Hang tight, this only takes a sec." },
    paid: { icon: "checkmark-circle", color: colors.success, title: "Payment successful!", sub: kind === "subscription" ? "Your membership is now active." : "Your job fare has been paid." },
    pending: { icon: "time-outline", color: colors.warning, title: "Payment processing", sub: "We'll update your account once it's confirmed." },
    canceled: { icon: "close-circle", color: colors.error, title: "Payment canceled", sub: "No charge was made. You can try again anytime." },
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
          title="Back to app"
          icon="arrow-forward"
          onPress={() => router.replace("/(tabs)")}
          testID="payment-return-done"
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
