import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Txt, Card, VerifiedBadge, Stars, StatusPill, Button } from "@/src/components/ui";
import { LiveMap, MapMarker } from "@/src/components/LiveMap";
import { colors, font, radius, spacing, shadow, JOB_TYPE_META, LOAD_META } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { TSV_CENTER } from "@/src/constants/places";

export default function Home() {
  const { user } = useAuth();
  return user?.active_role === "driver" ? <DriverFeed /> : <CustomerHome />;
}

/* ------------------------- CUSTOMER HOME ------------------------- */
function CustomerHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [sort, setSort] = useState<"top" | "reviews">("top");
  const [jobs, setJobs] = useState<any[]>([]);

  const sortedDrivers = useMemo(() => {
    const arr = [...drivers];
    if (sort === "reviews") {
      arr.sort((a, b) => (b.num_ratings || 0) - (a.num_ratings || 0) || (b.rating || 0) - (a.rating || 0));
    } else {
      arr.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.num_ratings || 0) - (a.num_ratings || 0));
    }
    return arr;
  }, [drivers, sort]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, j] = await Promise.all([api.verifiedDrivers(), api.myJobs()]);
      setDrivers(d);
      setJobs(j);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const activeJob = jobs.find((j) => ["open", "accepted", "picked_up", "delivered"].includes(j.status));
  const types = Object.keys(JOB_TYPE_META);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Txt variant="caption">G'day,</Txt>
          <Txt variant="h2">{user?.full_name?.split(" ")[0] || "mate"} 👋</Txt>
        </View>
        <View style={styles.avatarSm}>
          <Ionicons name="person" size={20} color={colors.brandPrimary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <Txt variant="display" style={{ marginBottom: spacing.lg }}>
          What needs{"\n"}moving, mate?
        </Txt>

        <Pressable testID="post-job-cta" onPress={() => router.push("/post-job")} style={styles.bigCta}>
          <View style={styles.bigCtaIcon}>
            <Ionicons name="add" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h3" color="#fff">Post a Job</Txt>
            <Txt variant="sub" color="rgba(255,255,255,0.8)">Photos, addresses, instant fare</Txt>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#fff" />
        </Pressable>

        <View style={styles.tileGrid}>
          {types.map((t) => {
            const m = JOB_TYPE_META[t];
            return (
              <Pressable
                key={t}
                testID={`type-tile-${t}`}
                onPress={() => router.push({ pathname: "/post-job", params: { type: t } })}
                style={styles.tile}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name={m.icon as any} size={24} color={colors.brandSecondary} />
                </View>
                <Txt variant="h3">{m.label}</Txt>
              </Pressable>
            );
          })}
        </View>

        {activeJob && (
          <>
            <Txt variant="h2" style={styles.sectionTitle}>Your active job</Txt>
            <Pressable testID="active-job-card" onPress={() => router.push(`/job/${activeJob.id}`)}>
              <Card>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <View style={[styles.tileIcon, { width: 38, height: 38, backgroundColor: colors.brandTertiary }]}>
                      <Ionicons name={JOB_TYPE_META[activeJob.job_type].icon as any} size={20} color={colors.brandSecondary} />
                    </View>
                    <View style={{ marginLeft: spacing.md }}>
                      <Txt variant="h3">{JOB_TYPE_META[activeJob.job_type].label}</Txt>
                      <Txt variant="sub">{activeJob.pickup_address}</Txt>
                    </View>
                  </View>
                  <StatusPill status={activeJob.status} />
                </View>
              </Card>
            </Pressable>
          </>
        )}

        <View style={[styles.rowBetween, styles.sectionTitle]}>
          <Txt variant="h2">Verified local drivers</Txt>
          <Ionicons name="shield-checkmark" size={18} color={colors.success} />
        </View>

        <View style={styles.sortRow}>
          {([["top", "Top rated"], ["reviews", "Most reviews"]] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setSort(key)}
              testID={`sort-${key}`}
              style={[styles.sortChip, sort === key && styles.sortChipActive]}
            >
              <Txt variant="caption" color={sort === key ? "#fff" : colors.muted}>{label}</Txt>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.lg }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
            {sortedDrivers.map((d) => (
              <Pressable key={d.id} style={styles.driverCard} testID={`driver-card-${d.id}`} onPress={() => router.push(`/driver/${d.id}`)}>
                <Image source={{ uri: d.ute_photos?.[0] }} style={styles.driverUte} contentFit="cover" />
                <View style={{ padding: spacing.md }}>
                  <View style={styles.row}>
                    <Image source={{ uri: d.avatar }} style={styles.driverAvatar} contentFit="cover" />
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Txt variant="h3" numberOfLines={1}>{d.full_name}</Txt>
                      <Txt variant="caption" numberOfLines={1}>{d.ute_type}</Txt>
                    </View>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                    <View style={styles.row}>
                      <Stars value={d.rating} />
                      <Txt variant="caption" style={{ marginLeft: 6 }}>
                        {d.num_ratings ? `(${d.num_ratings})` : "New"}
                      </Txt>
                    </View>
                    <VerifiedBadge />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------- DRIVER FEED ------------------------- */
function DriverFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const dp = user?.driver_profile;
  const approved = dp?.verification_status === "approved";
  const available = !!dp?.available;

  const load = useCallback(async () => {
    try {
      const f = await api.jobsFeed();
      setFeed(f);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAvailable = async (v: boolean) => {
    try {
      await api.setAvailability(v);
      await refresh();
    } catch {}
  };

  const accept = async (id: string) => {
    setBusy(id);
    try {
      await api.acceptJob(id);
      router.push(`/job/${id}`);
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(null);
  };

  const markers: MapMarker[] = [
    { lat: dp?.current_lat || TSV_CENTER.lat, lng: dp?.current_lng || TSV_CENTER.lng, kind: "me" },
    ...feed.map((j) => ({ lat: j.pickup_lat, lng: j.pickup_lng, kind: "job" as const })),
  ];

  return (
    <View style={styles.screen}>
      <LiveMap markers={markers} style={StyleSheet.absoluteFill} />

      {/* top availability bar */}
      <View style={[styles.driverTopBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.availPill}>
          <View style={[styles.dot, { backgroundColor: available ? colors.success : colors.muted }]} />
          <Txt variant="bodyBold">{available ? "You're available" : "You're offline"}</Txt>
          <Switch
            testID="availability-switch"
            value={available}
            onValueChange={toggleAvailable}
            disabled={!approved}
            trackColor={{ true: colors.brandPrimary, false: colors.border }}
            thumbColor="#fff"
            style={{ marginLeft: "auto" }}
          />
        </View>
      </View>

      {/* bottom sheet panel */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.sheetHandle} />
        {!approved ? (
          <View style={{ padding: spacing.lg }}>
            <Txt variant="h3" style={{ marginBottom: 4 }}>Get verified to start earning</Txt>
            <Txt variant="sub" style={{ marginBottom: spacing.md }}>
              {dp ? "Your application is under review." : "Add your licence, rego & ute photos to go live."}
            </Txt>
            {!dp && (
              <Button title="Complete verification" icon="shield-checkmark" onPress={() => router.push("/driver-onboarding")} testID="go-verify" />
            )}
          </View>
        ) : (
          <>
            <View style={styles.sheetHeader}>
              <Txt variant="h2">Nearby jobs</Txt>
              <View style={styles.countPill}>
                <Txt variant="caption" color={colors.brandSecondary}>{feed.length} open</Txt>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
            ) : feed.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cafe-outline" size={36} color={colors.muted} />
                <Txt variant="sub" style={{ marginTop: spacing.sm, textAlign: "center" }}>
                  No jobs nearby yet.{"\n"}Grab a cuppa and hang tight.
                </Txt>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}>
                {feed.map((j) => {
                  const m = JOB_TYPE_META[j.job_type];
                  return (
                    <View key={j.id} style={styles.feedCard} testID={`feed-job-${j.id}`}>
                      <View style={styles.rowBetween}>
                        <View style={styles.row}>
                          <View style={[styles.tileIcon, { width: 40, height: 40, backgroundColor: colors.brandTertiary }]}>
                            <Ionicons name={m.icon as any} size={20} color={colors.brandSecondary} />
                          </View>
                          <View style={{ marginLeft: spacing.md }}>
                            <Txt variant="h3">{m.label}</Txt>
                            <Txt variant="caption">{LOAD_META[j.load_size].label} load · {j.driver_distance_km} km away</Txt>
                          </View>
                        </View>
                        <Txt variant="h2" color={colors.brandSecondary}>${j.fare.driver_earnings}</Txt>
                      </View>
                      <View style={styles.routeRow}>
                        <Ionicons name="ellipse" size={10} color={colors.brandPrimary} />
                        <Txt variant="sub" numberOfLines={1} style={{ flex: 1, marginLeft: 6 }}>{j.pickup_address}</Txt>
                      </View>
                      <View style={styles.routeRow}>
                        <Ionicons name="location" size={12} color={colors.success} />
                        <Txt variant="sub" numberOfLines={1} style={{ flex: 1, marginLeft: 5 }}>{j.dropoff_address}</Txt>
                      </View>
                      <Button
                        title="Accept job"
                        onPress={() => accept(j.id)}
                        loading={busy === j.id}
                        testID={`accept-${j.id}`}
                        style={{ marginTop: spacing.md, height: 46 }}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  avatarSm: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  bigCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  bigCtaIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  tile: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow.card,
  },
  tileIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  sortRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  sortChipActive: { backgroundColor: colors.brandPrimary },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  driverCard: {
    width: 220,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  driverUte: { width: "100%", height: 110, backgroundColor: colors.surfaceTertiary },
  driverAvatar: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  // Driver feed
  driverTopBar: { paddingHorizontal: spacing.lg },
  availPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.float,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    maxHeight: "62%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadow.float,
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong,
    alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  countPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  feedCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  routeRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  empty: { alignItems: "center", padding: spacing["2xl"] },
});
