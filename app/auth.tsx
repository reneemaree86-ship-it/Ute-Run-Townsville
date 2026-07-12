import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
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

  const [mode, setModeRaw] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setMode = (m: "login" | "signup") => {
    setModeRaw(m);
    setStep("form");
    setOtp("");
    setError("");
  };

  // Step 1 (signup): send the SMS code, then move to OTP entry.
  const sendCode = async () => {
    setError("");
    if (!email || !password || !name || !phone) {
      setError("Please fill in all fields, mate.");
      return;
    }
    setLoading(true);
    try {
      await api.requestOtp(phone);
      setStep("otp");
    } catch (e: any) {
      setError(e.message || "Couldn't send the code. Check your number.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (signup): verify code by creating the account with it.
  const completeSignup = async () => {
    setError("");
    if (otp.trim().length < 4) {
      setError("Enter the 6-digit code we texted you.");
      return;
    }
    setLoading(true);
    try {
      await signup({ email, password, full_name: name, phone, role, otp_code: otp.trim() });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const doLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields, mate.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    if (mode === "login") return doLogin();
    return step === "form" ? sendCode() : completeSignup();
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
            Townsville’s mates{"\n"}with utes.
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

          {mode === "signup" && step === "form" && (
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

          {(mode === "login" || (mode === "signup" && step === "form")) && (
            <>
              <Field label="Email" icon="mail-outline" placeholder="you@email.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="input-email" />
              <Field label="Password" icon="lock-closed-outline" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} testID="input-password" />
            </>
          )}

          {mode === "signup" && step === "otp" && (
            <>
              <View style={styles.otpHeader}>
                <View style={styles.otpIcon}>
                  <Ionicons name="chatbox-ellipses-outline" size={26} color={colors.brandPrimary} />
                </View>
                <Txt variant="h2" style={{ marginTop: spacing.md }}>Enter the code</Txt>
                <Txt variant="sub" style={{ textAlign: "center", marginTop: 4 }}>
                  We texted a 6-digit code to{"\n"}{phone}
                </Txt>
              </View>
              <Field
                label="Verification code"
                icon="keypad-outline"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                testID="input-otp"
                style={{ letterSpacing: 6, fontSize: 18 }}
              />
              <View style={styles.otpActions}>
                <Pressable onPress={() => { setStep("form"); setOtp(""); setError(""); }} testID="otp-change-number">
                  <Txt variant="sub" color={colors.brandPrimary}>Change number</Txt>
                </Pressable>
                <Pressable onPress={sendCode} testID="otp-resend">
                  <Txt variant="sub" color={colors.brandPrimary}>Resend code</Txt>
                </Pressable>
              </View>
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Txt variant="sub" color={colors.error} style={{ marginLeft: 6, flex: 1 }}>
                {error}
              </Txt>
            </View>
          ) : null}

          <Button
            title={mode === "login" ? "Log in" : step === "form" ? "Send code" : "Verify & create account"}
            onPress={submit}
            loading={loading}
            icon={mode === "signup" && step === "form" ? "chatbubble-ellipses-outline" : "arrow-forward"}
            testID="auth-submit"
            style={{ marginTop: spacing.sm }}
          />
          {mode === "signup" && step === "form" && (
            <Txt variant="caption" style={{ textAlign: "center", marginTop: spacing.md }}>
              We’ll send a verification code by SMS to confirm your number.
            </Txt>
          )}
          {mode === "signup" && step === "form" && (
            <Pressable onPress={() => router.push("/legal")} testID="auth-terms-link">
              <Txt variant="caption" style={{ textAlign: "center", marginTop: spacing.sm }}>
                By creating an account you agree to our{" "}
                <Txt variant="caption" color={colors.brandPrimary}>Terms & Policies</Txt>
              </Txt>
            </Pressable>
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
  otpHeader: { alignItems: "center", marginBottom: spacing.lg },
  otpIcon: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  otpActions: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs, marginBottom: spacing.sm },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FBE3E3",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
