import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";

const PRODUCTION_URL = "https://quick-ute-run.preview.emergentagent.com";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || PRODUCTION_URL;

async function postDeletionRequest(body: object) {
  const res = await fetch(`${BASE}/api/data-deletion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Request failed");
}

export default function DataDeletionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() && !phone.trim()) {
      setError("Please provide either an email address or phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await postDeletionRequest({
        email: email.trim(),
        phone: phone.trim(),
        preferredContact: email.trim() ? "email" : "phone",
        reason: reason.trim(),
      });
      setSuccess(true);
      setEmail("");
      setPhone("");
      setReason("");
    } catch {
      setError("Failed to submit request. Please try again or email uteruntownsville@gmail.com");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Txt style={styles.title}>Data Deletion Request</Txt>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Txt style={styles.subtitle}>
          Submit a request to delete your Ute Run Townsville account and associated personal data.
        </Txt>

        {success && (
          <View style={styles.successBox}>
            <Txt style={styles.successText}>
              ✓ Your data deletion request has been received. We will process it as soon as possible.
            </Txt>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Txt style={styles.errorText}>{error}</Txt>
          </View>
        )}

        <Txt style={styles.label}>Email Address (optional)</Txt>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Txt style={styles.label}>Phone Number (optional)</Txt>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+61 7 XXXX XXXX"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />
        <Txt style={styles.hint}>Please provide at least one contact method.</Txt>

        <Txt style={styles.label}>Reason for Deletion (optional)</Txt>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="Please tell us why you'd like to delete your account..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />

        <Button
          title={loading ? "Submitting…" : "Submit Data Deletion Request"}
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitBtn}
        />

        <View style={styles.divider} />
        <Txt style={styles.sectionTitle}>Alternative Methods</Txt>
        <Txt style={styles.body}>You can also email:</Txt>
        <Pressable onPress={() => Linking.openURL("mailto:uteruntownsville@gmail.com?subject=Data%20Deletion%20Request")}>
          <Txt style={styles.link}>uteruntownsville@gmail.com</Txt>
        </Pressable>
        <Txt style={styles.body}>
          Please include the email address or phone number used in the app so we can locate your account.
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { marginRight: spacing.md },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  content: { padding: spacing.lg, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg },
  successBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#6EE7B7",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  successText: { color: "#065F46", fontSize: 14 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: { color: "#991B1B", fontSize: 14 },
  label: { fontSize: 14, fontWeight: "600", color: colors.onSurface, marginBottom: 4, marginTop: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  submitBtn: { marginTop: spacing.xl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  body: { fontSize: 14, color: colors.muted, marginBottom: spacing.sm },
  link: { fontSize: 14, color: colors.brandPrimary, fontWeight: "600", marginBottom: spacing.md },
});
