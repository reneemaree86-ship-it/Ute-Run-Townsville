import React, { useState, useEffect, useCallback } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform,
  ActivityIndicator, TextInput,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button, Chip } from "@/src/components/ui";
import { colors, font, radius, spacing, JOB_TYPE_META, LOAD_META } from "@/src/theme";
import { TOWNSVILLE_PLACES, Place } from "@/src/constants/places";
import { api } from "@/src/api/client";

const TIMES = ["ASAP", "Within 1 hr", "This arvo", "This evening"];

export default function PostJob() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();

  const [step, setStep] = useState(0);
  const [jobType, setJobType] = useState(params.type || "pickup");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [pickupAddr, setPickupAddr] = useState("");
  const [dropoffAddr, setDropoffAddr] = useState("");
  const [loadSize, setLoadSize] = useState("medium");
  const [time, setTime] = useState("ASAP");
  const [dispatch, setDispatch] = useState<"instant" | "offers">("instant");
  const [fare, setFare] = useState<any>(null);
  const [loadingFare, setLoadingFare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [permWarn, setPermWarn] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") { setPermWarn(true); return; }
    setPermWarn(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.5, base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${res.assets[0].base64}`]);
    }
  };

  const loadFare = useCallback(async () => {
    setLoadingFare(true);
    try {
      const f = await api.fareEstimate({
        job_type: jobType, load_size: loadSize,
        pickup_lat: pickup?.lat, pickup_lng: pickup?.lng,
        dropoff_lat: dropoff?.lat, dropoff_lng: dropoff?.lng,
      });
      setFare(f);
    } catch {}
    setLoadingFare(false);
  }, [jobType, loadSize, pickup, dropoff]);

  useEffect(() => { if (step === 3) loadFare(); }, [step, loadFare]);

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => (step === 0 ? router.back() : setStep((s) => s - 1));

  const canNext =
    step === 0 ? !!jobType && description.trim().length > 0
      : step === 1 ? !!pickup && !!dropoff
      : true;

  const submit = async () => {
    setSubmitting(true);
    try {
      const job = await api.createJob({
        job_type: jobType, description, photos,
        pickup_address: pickupAddr || pickup?.name || "", dropoff_address: dropoffAddr || dropoff?.name || "",
        pickup_lat: pickup?.lat, pickup_lng: pickup?.lng,
        dropoff_lat: dropoff?.lat, dropoff_lng: dropoff?.lng,
        load_size: loadSize, preferred_time: time, dispatch_mode: dispatch,
      });
      router.replace(`/job/${job.id}`);
    } catch (e: any) {
      alert(e.message);
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={back} testID="post-back" hitSlop={10}>
          <Ionicons name={step === 0 ? "close" : "arrow-back"} size={26} color={colors.onSurface} />
        </Pressable>
        <Txt variant="h3">Post a Job</Txt>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={10}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <>
              <Txt variant="h1" style={styles.qTitle}>What's the job?</Txt>
              <View style={styles.typeGrid}>
                {Object.keys(JOB_TYPE_META).map((t) => {
                  const m = JOB_TYPE_META[t];
                  const active = jobType === t;
                  return (
                    <Pressable key={t} testID={`jobtype-${t}`} onPress={() => setJobType(t)} style={[styles.typeCard, active && styles.typeCardActive]}>
                      <Ionicons name={m.icon as any} size={26} color={active ? colors.brandPrimary : colors.muted} />
                      <Txt variant="h3" style={{ marginTop: 6 }}>{m.label}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              <Txt variant="sub" style={styles.label}>Describe what's moving</Txt>
              <TextInput
                testID="job-description"
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Couch and 2 boxes from the garage"
                placeholderTextColor={colors.muted}
                multiline
                style={styles.textArea}
              />
              <Txt variant="sub" style={styles.label}>Add photos (optional)</Txt>
              <View style={styles.photoRow}>
                {photos.map((p, i) => (
                  <Image key={i} source={{ uri: p }} style={styles.photo} contentFit="cover" />
                ))}
                <Pressable testID="add-photo" onPress={pickImage} style={styles.addPhoto}>
                  <Ionicons name="camera-outline" size={24} color={colors.brandPrimary} />
                  <Txt variant="caption" color={colors.brandPrimary}>Add</Txt>
                </Pressable>
              </View>
              {permWarn && (
                <Pressable onPress={() => ImagePicker.requestMediaLibraryPermissionsAsync()}>
                  <Txt variant="caption" color={colors.error} style={{ marginTop: 4 }}>
                    Photo access denied. Tap to allow, or enable it in Settings.
                  </Txt>
                </Pressable>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Txt variant="h1" style={styles.qTitle}>Pickup & drop-off</Txt>
              <Txt variant="sub" style={styles.label}>Pickup suburb</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {TOWNSVILLE_PLACES.map((p) => (
                  <Chip key={p.name} label={p.name} active={pickup?.name === p.name} onPress={() => setPickup(p)} />
                ))}
              </ScrollView>
              <TextInput testID="pickup-address" value={pickupAddr} onChangeText={setPickupAddr} placeholder="Street address (optional)" placeholderTextColor={colors.muted} style={styles.input} />

              <Txt variant="sub" style={styles.label}>Drop-off suburb</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {TOWNSVILLE_PLACES.map((p) => (
                  <Chip key={p.name} label={p.name} active={dropoff?.name === p.name} onPress={() => setDropoff(p)} />
                ))}
              </ScrollView>
              <TextInput testID="dropoff-address" value={dropoffAddr} onChangeText={setDropoffAddr} placeholder="Street address (optional)" placeholderTextColor={colors.muted} style={styles.input} />
            </>
          )}

          {step === 2 && (
            <>
              <Txt variant="h1" style={styles.qTitle}>Load & timing</Txt>
              <Txt variant="sub" style={styles.label}>How big's the load?</Txt>
              <View style={styles.loadGrid}>
                {Object.keys(LOAD_META).map((l) => {
                  const active = loadSize === l;
                  return (
                    <Pressable key={l} testID={`load-${l}`} onPress={() => setLoadSize(l)} style={[styles.loadCard, active && styles.typeCardActive]}>
                      <Txt variant="h3">{LOAD_META[l].label}</Txt>
                      <Txt variant="caption">{LOAD_META[l].sub}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              <Txt variant="sub" style={styles.label}>When?</Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {TIMES.map((t) => <Chip key={t} label={t} active={time === t} onPress={() => setTime(t)} />)}
              </ScrollView>
              <Txt variant="sub" style={styles.label}>Dispatch</Txt>
              <View style={{ gap: spacing.sm }}>
                <DispatchOption active={dispatch === "instant"} onPress={() => setDispatch("instant")} icon="flash" title="Instant dispatch" sub="Match the nearest available driver" />
                <DispatchOption active={dispatch === "offers"} onPress={() => setDispatch("offers")} icon="list" title="Browse offers" sub="Let drivers send you offers" />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Txt variant="h1" style={styles.qTitle}>Review & post</Txt>
              <View style={styles.reviewCard}>
                <ReviewRow icon={JOB_TYPE_META[jobType].icon} label={JOB_TYPE_META[jobType].label} value={`${LOAD_META[loadSize].label} load`} />
                <ReviewRow icon="ellipse" label="Pickup" value={pickup?.name || ""} />
                <ReviewRow icon="location" label="Drop-off" value={dropoff?.name || ""} />
                <ReviewRow icon="time" label="When" value={time} last />
              </View>
              <View style={styles.fareCard}>
                {loadingFare || !fare ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Txt variant="sub" color="rgba(255,255,255,0.8)">Estimated fare ({fare.distance_km} km)</Txt>
                    <Txt color="#fff" style={{ fontFamily: font.display, fontSize: 40, marginVertical: 4 }}>${fare.total}</Txt>
                    <View style={styles.fareBreak}>
                      <Txt variant="caption" color="rgba(255,255,255,0.7)">Base ${fare.base_fare} · ×{fare.load_multiplier} load · incl. fee ${fare.platform_fee}</Txt>
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {step < 3 ? (
            <Button title="Continue" icon="arrow-forward" onPress={next} disabled={!canNext} testID="post-next" />
          ) : (
            <Button title={`Post job · $${fare?.total ?? "--"}`} icon="checkmark" onPress={submit} loading={submitting} testID="post-submit" />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function DispatchOption({ active, onPress, icon, title, sub }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.dispatch, active && styles.typeCardActive]}>
      <Ionicons name={icon} size={22} color={active ? colors.brandPrimary : colors.muted} />
      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Txt variant="h3">{title}</Txt>
        <Txt variant="caption">{sub}</Txt>
      </View>
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={20} color={active ? colors.brandPrimary : colors.muted} />
    </Pressable>
  );
}

function ReviewRow({ icon, label, value, last }: any) {
  return (
    <View style={[styles.reviewRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <Ionicons name={icon} size={18} color={colors.brandSecondary} />
      <Txt variant="sub" style={{ marginLeft: spacing.md, flex: 1 }}>{label}</Txt>
      <Txt variant="bodyBold" numberOfLines={1} style={{ maxWidth: "55%" }}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  progressTrack: { height: 5, backgroundColor: colors.surfaceTertiary, marginHorizontal: spacing.lg, borderRadius: 3 },
  progressFill: { height: 5, backgroundColor: colors.brandPrimary, borderRadius: 3 },
  qTitle: { marginBottom: spacing.lg },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  typeCard: { width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.lg, alignItems: "flex-start" },
  typeCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  textArea: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, minHeight: 90, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface, textAlignVertical: "top" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, height: 52, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface, marginTop: spacing.sm },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  addPhoto: { width: 76, height: 76, borderRadius: radius.md, borderWidth: 2, borderColor: colors.brandPrimary, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  chipScroll: { gap: spacing.sm, paddingRight: spacing.lg },
  loadGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  loadCard: { width: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.lg },
  dispatch: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.lg },
  reviewCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  reviewRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  fareCard: { backgroundColor: colors.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg, alignItems: "flex-start" },
  fareBreak: { marginTop: 4 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
