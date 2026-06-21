import React, { useCallback, useState } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Button, StatusPill, Stars, VerifiedBadge } from "@/src/components/ui";
import { MockMap, MapMarker } from "@/src/components/MockMap";
import { colors, font, radius, spacing, JOB_TYPE_META, LOAD_META } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { startCheckout } from "@/src/utils/checkout";

const STEPS = ["accepted", "picked_up", "delivered", "completed"];
const STEP_LABEL: Record<string, string> = { accepted: "Accepted", picked_up: "Picked up", delivered: "Delivered", completed: "Completed" };

export default function JobDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");

  const load = useCallback(async () => {
    try { setJob(await api.getJob(id!)); } catch {}
    setLoading(false);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !job) {
    return <View style={[styles.screen, styles.center]}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const isDriver = job.driver_id === user?.id;
  const m = JOB_TYPE_META[job.job_type];
  const currentStepIdx = STEPS.indexOf(job.status);

  const advance = async (status: string) => {
    setBusy(true);
    try { setJob(await api.setJobStatus(id!, status)); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const cancel = async () => {
    setBusy(true);
    try { setJob(await api.cancelJob(id!)); } catch {}
    setBusy(false);
  };
  const payFare = async () => {
    setBusy(true);
    try {
      const status = await startCheckout((base) => api.createJobCheckout(id!, base));
      if (status === "paid") await load();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };
  const submitRating = async () => {
    setBusy(true);
    try { await api.rateJob(id!, stars, review); setRateOpen(false); await load(); } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const markers: MapMarker[] = [
    { lat: job.pickup_lat, lng: job.pickup_lng, kind: "pickup" },
    { lat: job.dropoff_lat, lng: job.dropoff_lng, kind: "dropoff" },
  ];

  const alreadyRated = isDriver ? job.driver_rated : job.customer_rated;
  const paid = job.payment?.status === "paid";

  return (
    <View style={styles.screen}>
      <View style={[styles.mapWrap, { height: 260 + insets.top }]}>
        <MockMap markers={markers} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} testID="job-back" hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <View style={styles.icon}><Ionicons name={m.icon as any} size={22} color={colors.brandSecondary} /></View>
            <View style={{ marginLeft: spacing.md }}>
              <Txt variant="h2">{m.label}</Txt>
              <Txt variant="sub">{LOAD_META[job.load_size].label} load · {job.distance_km} km</Txt>
            </View>
          </View>
          <StatusPill status={job.status} />
        </View>

        {/* Status tracker */}
        {job.status !== "open" && job.status !== "cancelled" && (
          <View style={styles.tracker}>
            {STEPS.map((s, i) => {
              const done = i <= currentStepIdx;
              return (
                <View key={s} style={styles.trackStep}>
                  <View style={[styles.trackDot, done && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  <Txt variant="caption" style={{ marginTop: 4, textAlign: "center" }} color={done ? colors.onSurface : colors.muted}>{STEP_LABEL[s]}</Txt>
                  {i < STEPS.length - 1 && <View style={[styles.trackLine, i < currentStepIdx && { backgroundColor: colors.brandPrimary }]} />}
                </View>
              );
            })}
          </View>
        )}

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <Ionicons name="ellipse" size={12} color={colors.brandPrimary} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Txt variant="caption">PICKUP</Txt>
              <Txt variant="bodyBold">{job.pickup_address}</Txt>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <Ionicons name="location" size={14} color={colors.success} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Txt variant="caption">DROP-OFF</Txt>
              <Txt variant="bodyBold">{job.dropoff_address}</Txt>
            </View>
          </View>
        </View>

        {job.description ? (
          <View style={styles.descCard}>
            <Txt variant="caption" style={{ marginBottom: 4 }}>DETAILS</Txt>
            <Txt variant="body">{job.description}</Txt>
          </View>
        ) : null}

        {job.photos?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
            {job.photos.map((p: string, i: number) => <Image key={i} source={{ uri: p }} style={styles.photo} contentFit="cover" />)}
          </ScrollView>
        ) : null}

        {/* Counterpart card */}
        {job.driver_id && (
          <View style={styles.personCard}>
            {(isDriver ? job.customer_avatar : job.driver_avatar) ? (
              <Image source={{ uri: isDriver ? job.customer_avatar : job.driver_avatar }} style={styles.personAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.personAvatar, styles.avatarFallback]}><Ionicons name="person" size={22} color={colors.brandPrimary} /></View>
            )}
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Txt variant="h3">{isDriver ? job.customer_name : job.driver_name}</Txt>
              <View style={styles.row}>
                {!isDriver && job.driver_profile_snapshot ? (
                  <>
                    <Txt variant="caption">{job.driver_profile_snapshot.ute_type} · </Txt>
                    <Stars value={job.driver_profile_snapshot.rating} size={11} />
                  </>
                ) : <Txt variant="caption">{isDriver ? "Customer" : "Driver"}</Txt>}
              </View>
            </View>
            <Pressable onPress={() => router.push(`/chat/${job.id}`)} style={styles.chatBtn} testID="open-chat">
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Fare */}
        <View style={styles.fareRow}>
          <Txt variant="sub">{isDriver ? "You earn" : "Total fare"}</Txt>
          <Txt variant="h2" color={colors.brandSecondary}>${isDriver ? job.fare.driver_earnings : job.fare.total}</Txt>
        </View>
      </ScrollView>

      {/* Action bar */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {isDriver ? (
          job.status === "accepted" ? <Button title="Mark picked up" icon="cube" onPress={() => advance("picked_up")} loading={busy} testID="mark-pickedup" />
          : job.status === "picked_up" ? <Button title="Mark delivered" icon="checkmark-done" onPress={() => advance("delivered")} loading={busy} testID="mark-delivered" />
          : job.status === "delivered" ? <Button title="Complete job" icon="flag" onPress={() => advance("completed")} loading={busy} testID="mark-completed" />
          : job.status === "completed" && !alreadyRated ? <Button title="Rate customer" icon="star" onPress={() => setRateOpen(true)} testID="rate-btn" />
          : <Button title="Back to runs" variant="outline" onPress={() => router.replace("/(tabs)/jobs")} />
        ) : (
          ["open", "accepted"].includes(job.status) ? <Button title="Cancel job" variant="outline" icon="close" onPress={cancel} loading={busy} testID="cancel-job" />
          : ["picked_up", "delivered"].includes(job.status) ? <Button title="Track delivery" variant="dark" icon="navigate" onPress={load} testID="track-btn" />
          : job.status === "completed" && !alreadyRated ? <Button title="Rate your driver" icon="star" onPress={() => setRateOpen(true)} testID="rate-btn" />
          : <Button title="Done" variant="outline" onPress={() => router.replace("/(tabs)")} />
        )}
      </View>

      {/* Rating modal */}
      <Modal visible={rateOpen} transparent animationType="slide" onRequestClose={() => setRateOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHandle} />
            <Txt variant="h2" style={{ textAlign: "center" }}>How was it?</Txt>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setStars(s)} testID={`star-${s}`} hitSlop={6}>
                  <Ionicons name={s <= stars ? "star" : "star-outline"} size={40} color={colors.warning} />
                </Pressable>
              ))}
            </View>
            <TextInput value={review} onChangeText={setReview} placeholder="Leave a review (optional)" placeholderTextColor={colors.muted} style={styles.reviewInput} multiline />
            <Button title="Submit rating" icon="checkmark" onPress={submitRating} loading={busy} testID="submit-rating" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  mapWrap: { backgroundColor: colors.surfaceTertiary },
  backBtn: { position: "absolute", left: spacing.lg, width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  icon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  tracker: { flexDirection: "row", marginTop: spacing.xl, marginBottom: spacing.sm },
  trackStep: { flex: 1, alignItems: "center", position: "relative" },
  trackDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", zIndex: 2 },
  trackLine: { position: "absolute", top: 12, left: "50%", right: "-50%", height: 3, backgroundColor: colors.border },
  routeCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.lg },
  routeRow: { flexDirection: "row", alignItems: "center" },
  routeConnector: { width: 2, height: 22, backgroundColor: colors.border, marginLeft: 5, marginVertical: 4 },
  descCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  photo: { width: 90, height: 90, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  personCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.lg },
  personAvatar: { width: 50, height: 50, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  avatarFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  chatBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  fareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl },
  actionBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl },
  modalHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.lg },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginVertical: spacing.xl },
  reviewInput: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, minHeight: 70, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface, marginBottom: spacing.lg, textAlignVertical: "top" },
});
