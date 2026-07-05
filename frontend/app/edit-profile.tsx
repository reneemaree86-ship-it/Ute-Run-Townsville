import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Txt, Button } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name || "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pickAvatar = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (status !== "granted") { setError("Photo access is needed to change your picture."); return; }
    setError("");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setAvatar(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const save = async () => {
    if (!name.trim()) { setError("Please enter your name."); return; }
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateProfile({ full_name: name.trim(), avatar });
      setUser(updated);
      router.back();
    } catch (e: any) {
      setError(e.message || "Could not save changes");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="edit-back">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h2" style={{ marginLeft: spacing.md }}>Edit profile</Txt>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center" }}>
          <Pressable onPress={pickAvatar} style={styles.avatar} testID="edit-avatar">
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={44} color={colors.brandPrimary} />
            )}
            <View style={styles.camBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <Txt variant="caption" style={{ marginTop: spacing.sm }}>Tap to change photo</Txt>
        </View>

        <Txt variant="sub" style={styles.label}>Full name</Txt>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="edit-name"
        />

        <Txt variant="sub" style={styles.label}>Email</Txt>
        <View style={[styles.input, styles.readonly]}>
          <Txt variant="body" color={colors.muted}>{user?.email || "—"}</Txt>
        </View>

        {error ? <Txt variant="sub" color={colors.error} style={{ marginTop: spacing.md }}>{error}</Txt> : null}

        <Button title="Save changes" icon="checkmark" onPress={save} loading={saving} testID="save-profile" style={{ marginTop: spacing["2xl"] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  avatar: { width: 108, height: 108, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  camBadge: { position: "absolute", bottom: 4, right: 4, width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  label: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.muted },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52, fontFamily: font.regular, fontSize: 16, color: colors.onSurface, justifyContent: "center" },
  readonly: { backgroundColor: colors.surfaceTertiary },
});
