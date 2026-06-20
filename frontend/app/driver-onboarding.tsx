import React, { useState } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button, Field } from "@/src/components/ui";
import { colors, radius, spacing } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

export default function DriverOnboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh } = useAuth();

  const [license, setLicense] = useState("");
  const [rego, setRego] = useState("");
  const [insurance, setInsurance] = useState("");
  const [uteType, setUteType] = useState("");
  const [abn, setAbn] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [permWarn, setPermWarn] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") status = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (status !== "granted") { setPermWarn(true); return; }
    setPermWarn(false);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${res.assets[0].base64}`]);
    }
  };

  const submit = async () => {
    setError("");
    if (!license || !rego || !insurance || !uteType) { setError("Please fill in all required fields."); return; }
    setSubmitting(true);
    try {
      await api.submitDriverProfile({
        license_no: license, rego, insurance, ute_type: uteType, abn: abn || null, ute_photos: photos,
      });
      await refresh();
      router.back();
    } catch (e: any) {
      setError(e.message);
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="onboard-close">
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h3">Driver verification</Txt>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <Txt variant="sub" style={{ marginLeft: spacing.md, flex: 1 }}>
              Verified drivers earn trust badges and get more jobs. Your details are kept private.
            </Txt>
          </View>

          <Field label="Driver licence no. *" icon="card-outline" placeholder="QLD12345678" value={license} onChangeText={setLicense} testID="input-license" />
          <Field label="Vehicle rego *" icon="car-outline" placeholder="ABC123" autoCapitalize="characters" value={rego} onChangeText={setRego} testID="input-rego" />
          <Field label="Insurance provider *" icon="document-text-outline" placeholder="e.g. Allianz" value={insurance} onChangeText={setInsurance} testID="input-insurance" />
          <Field label="Ute make & model *" icon="construct-outline" placeholder="e.g. Toyota HiLux" value={uteType} onChangeText={setUteType} testID="input-ute-type" />
          <Field label="ABN (optional)" icon="business-outline" placeholder="11 222 333 444" keyboardType="number-pad" value={abn} onChangeText={setAbn} testID="input-abn" />

          <Txt variant="sub" style={{ marginBottom: spacing.sm }}>Ute photos</Txt>
          <View style={styles.photoRow}>
            {photos.map((p, i) => <Image key={i} source={{ uri: p }} style={styles.photo} contentFit="cover" />)}
            <Pressable testID="add-ute-photo" onPress={pickImage} style={styles.addPhoto}>
              <Ionicons name="camera-outline" size={24} color={colors.brandPrimary} />
              <Txt variant="caption" color={colors.brandPrimary}>Add</Txt>
            </Pressable>
          </View>
          {permWarn && (
            <Pressable onPress={() => ImagePicker.requestMediaLibraryPermissionsAsync()}>
              <Txt variant="caption" color={colors.error} style={{ marginTop: 4 }}>Photo access denied. Tap to allow.</Txt>
            </Pressable>
          )}

          {error ? <Txt variant="sub" color={colors.error} style={{ marginTop: spacing.md }}>{error}</Txt> : null}

          <Button title="Submit & go live" icon="checkmark-circle" onPress={submit} loading={submitting} testID="submit-onboarding" style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  banner: { flexDirection: "row", alignItems: "center", backgroundColor: "#DCF1E4", borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 90, height: 90, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  addPhoto: { width: 90, height: 90, borderRadius: radius.md, borderWidth: 2, borderColor: colors.brandPrimary, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
});
