import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";
import { ABOUT } from "@/src/constants/about";

const HERO =
  "https://images.unsplash.com/photo-1686507445019-e4939c9de8c4?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing["2xl"] }} showsVerticalScrollIndicator={false} testID="about-scroll">
        <View style={styles.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(44,42,40,0.25)", "rgba(44,42,40,0.9)", "#2C2A28"]} style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} hitSlop={10} testID="about-back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.heroContent}>
            <View style={styles.logoBadge}>
              <Ionicons name="car-sport" size={20} color="#fff" />
            </View>
            <Txt variant="display" color="#fff" style={{ marginTop: spacing.md }}>About UteRun</Txt>
            <Txt variant="sub" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>{ABOUT.tagline}</Txt>
          </View>
        </View>

        <View style={styles.body}>
          <Section heading={ABOUT.why.heading} body={ABOUT.why.body} />
          <Section heading={ABOUT.story.heading} body={ABOUT.story.body} />
          <Section heading={ABOUT.mission.heading} body={ABOUT.mission.body} />

          <Txt variant="h2" style={styles.sectionTitle}>What Makes Us Different</Txt>
          <View style={styles.diffCard}>
            {ABOUT.different.map((d, i) => (
              <View key={i} style={[styles.diffRow, i < ABOUT.different.length - 1 && styles.diffBorder]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Txt variant="bodyBold" style={{ flex: 1, marginLeft: spacing.md }}>{d}</Txt>
              </View>
            ))}
          </View>

          <Txt variant="h2" style={styles.sectionTitle}>Our Values</Txt>
          <View style={styles.valueGrid}>
            {ABOUT.values.map((v) => (
              <View key={v.label} style={styles.valueChip}>
                <Ionicons name={v.icon as any} size={18} color={colors.brandSecondary} />
                <Txt variant="sub" color={colors.onSurface} style={{ marginLeft: 8 }}>{v.label}</Txt>
              </View>
            ))}
          </View>

          <View style={styles.quote}>
            <Txt variant="h3" color="#fff" style={{ textAlign: "center" }}>
              More than an app — a community platform built by locals, for locals.
            </Txt>
            <Txt variant="sub" color="rgba(255,255,255,0.8)" style={{ textAlign: "center", marginTop: spacing.sm }}>
              {ABOUT.location}
            </Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Txt variant="h2" style={{ marginBottom: spacing.sm }}>{heading}</Txt>
      <Txt variant="body" color={colors.onSurfaceTertiary} style={{ lineHeight: 22 }}>{body}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 300, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: spacing.lg, width: 42, height: 42, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroContent: { padding: spacing.xl },
  logoBadge: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg },
  sectionTitle: { marginTop: spacing.sm, marginBottom: spacing.md },
  diffCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  diffRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  diffBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  valueGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  valueChip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  quote: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.sm },
});
