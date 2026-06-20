import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Txt, Button, Field } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";
import { useAuth, Role } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

const HERO =
  "https://images.pexels.com/photos/7052312/pexels-photo-7052312.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=940";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email || !password || (mode === "signup" && (!name || !phone))) {
      setError("Please fill in all fields, mate.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.requestOtp(phone).catch(() => {});
        await signup({ email, password, full_name: name, phone, role });
      } else {
        await login(email, password);
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(44,42,40,0.15)", "rgba(44,42,40,0.85)", "#2C2A28"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="car-sport" size={20} color="#fff" />
            </View>
            <Txt variant="h2" color="#fff" style={{ fontFamily: font.display }}>
              UteRun
            </Txt>
          </View>
          <Txt variant="display" color="#fff" style={styles.heroTitle}>
            Townsville's mates{"\n"}with utes.
          </Txt>
          <Txt variant="body" color="rgba(255,255,255,0.85)">
            Same-day pickups, deliveries, moves & tip runs — sorted by trusted locals.
          </Txt>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheet}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.segment}>
            <Pressable
              testID="seg-login"
              onPress={() => setMode("login")}
              style={[styles.segItem, mode === "login" && styles.segItemActive]}
            >
              <Txt variant="bodyBold" color={mode === "login" ? "#fff" : colors.muted}>
                Log in
              </Txt>
            </Pressable>
            <Pressable
              testID="seg-signup"
              onPress={() => setMode("signup")}
              style={[styles.segItem, mode === "signup" && styles.segItemActive]}
            >
              <Txt variant="bodyBold" color={mode === "signup" ? "#fff" : colors.muted}>
                Sign up
              </Txt>
            </Pressable>
          </View>

          {mode === "signup" && (
            <>
              <Txt variant="sub" style={{ marginBottom: spacing.sm }}>
                I want to...
              </Txt>
              <View style={styles.roleRow}>
                <RoleCard
                  testID="role-customer"
                  active={role === "customer"}
                  icon="cube-outline"
                  title="Need a Ute"
                  sub="Post jobs"
                  onPress={() => setRole("customer")}
                />
                <RoleCard
                  testID="role-driver"
                  active={role === "driver"}
                  icon="car-sport-outline"
                  title="Drive a Ute"
                  sub="Earn cash"
                  onPress={() => setRole("driver")}
                />
              </View>
              <Field label="Full name" icon="person-outline" placeholder="Your name" value={name} onChangeText={setName} testID="input-name" />
              <Field label="Phone" icon="call-outline" placeholder="+61 4xx xxx xxx" keyboardType="phone-pad" value={phone} onChangeText={setPhone} testID="input-phone" />
            </>
          )}

          <Field label="Email" icon="mail-outline" placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="input-email" />
          <Field label="Password" icon="lock-closed-outline" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} testID="input-password" />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Txt variant="sub" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>
                {error}
              </Txt>
            </View>
          ) : null}

          <Button
            title={mode === "signup" ? "Create account" : "Log in"}
            onPress={submit}
            loading={loading}
            icon="arrow-forward"
            testID="auth-submit"
            style={{ marginTop: spacing.sm }}
          />
          {mode === "signup" && (
            <Txt variant="caption" style={{ textAlign: "center", marginTop: spacing.md }}>
              Phone verification uses code 123456 in this demo.
            </Txt>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RoleCard({ active, icon, title, sub, onPress, testID }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.roleCard, active && styles.roleCardActive]}
    >
      <Ionicons name={icon} size={26} color={active ? colors.brandPrimary : colors.muted} />
      <Txt variant="h3" style={{ marginTop: 6 }} color={active ? colors.onSurface : colors.onSurfaceTertiary}>
        {title}
      </Txt>
      <Txt variant="caption">{sub}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  heroWrap: { height: "40%", justifyContent: "flex-end" },
  heroContent: { padding: spacing.xl, paddingBottom: spacing["2xl"] },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  logoBadge: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginRight: spacing.sm,
  },
  heroTitle: { marginBottom: spacing.sm, fontSize: 30, lineHeight: 36 },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xl,
  },
  segItem: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segItemActive: { backgroundColor: colors.surfaceInverse },
  roleRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "flex-start",
  },
  roleCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBE3E3",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
