import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { LEGAL_SECTIONS, LEGAL_EFFECTIVE_DATE } from "@/src/constants/legal";

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="legal-back">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h3">Terms & Policies</Txt>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
        testID="legal-scroll"
      >
        <View style={styles.titleCard}>
          <View style={styles.logoBadge}>
            <Ionicons name="car-sport" size={20} color="#fff" />
          </View>
          <Txt variant="h1" style={{ marginTop: spacing.md }}>UteRun Townsville{"\n"}Terms and Policies</Txt>
          <Txt variant="sub" style={{ marginTop: spacing.xs }}>Effective date: {LEGAL_EFFECTIVE_DATE}</Txt>
        </View>

        {LEGAL_SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Txt variant="h3" style={{ marginBottom: s.body || s.bullets ? spacing.sm : 0 }}>
              {s.n ? `${s.n}. ` : ""}{s.heading}
            </Txt>
            {s.body ? (
              s.heading === "Contact Us" ? (
                <View>
                  <Txt variant="body" style={{ marginBottom: 4 }}>UteRun Townsville</Txt>
                  <Pressable onPress={() => Linking.openURL("mailto:support@uterun.com.au")} testID="legal-email">
                    <Txt variant="bodyBold" color={colors.brandPrimary}>support@uterun.com.au</Txt>
                  </Pressable>
                  <Txt variant="body" style={{ marginTop: 4 }}>Phone: 1300 UTE RUN</Txt>
                </View>
              ) : (
                <Txt variant="body" color={colors.onSurfaceTertiary}>{s.body}</Txt>
              )
            ) : null}
            {s.bullets?.map((b, j) => (
              <View key={j} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Txt variant="body" color={colors.onSurfaceTertiary} style={{ flex: 1 }}>{b}</Txt>
              </View>
            ))}
          </View>
        ))}

        <Txt variant="caption" style={{ textAlign: "center", marginTop: spacing.lg }}>
          © 2026 UteRun Townsville Pty Ltd · Queensland, Australia
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  titleCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  logoBadge: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: spacing.xl },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.sm },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 8, marginRight: spacing.md },
});
