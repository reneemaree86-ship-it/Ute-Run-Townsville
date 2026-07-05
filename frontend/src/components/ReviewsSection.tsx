import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Txt, Stars } from "@/src/components/ui";
import { colors, font, radius, spacing } from "@/src/theme";

export interface Review {
  id: string;
  stars: number;
  review: string;
  reviewer_name: string;
  reviewer_avatar?: string | null;
  created_at?: string;
}

export interface ReviewsData {
  rating: number;
  num_ratings: number;
  breakdown: Record<string, number>;
  reviews: Review[];
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ReviewsSection({ data, emptyHint }: { data: ReviewsData; emptyHint?: string }) {
  const total = data.num_ratings || 0;

  return (
    <View>
      <View style={styles.summary}>
        <View style={styles.scoreCol}>
          <Txt style={styles.bigScore}>{(data.rating || 0).toFixed(1)}</Txt>
          <Stars value={data.rating || 0} size={14} />
          <Txt variant="caption" style={{ marginTop: 4 }}>{total} review{total === 1 ? "" : "s"}</Txt>
        </View>
        <View style={styles.bars}>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = data.breakdown?.[String(s)] || 0;
            const pct = total ? (count / total) * 100 : 0;
            return (
              <View key={s} style={styles.barRow}>
                <Txt variant="caption" style={{ width: 12 }}>{s}</Txt>
                <Ionicons name="star" size={11} color={colors.warning} style={{ marginRight: 6 }} />
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {data.reviews.length === 0 ? (
        <Txt variant="sub" style={{ marginTop: spacing.lg }}>{emptyHint || "No reviews yet."}</Txt>
      ) : (
        data.reviews.map((r) => (
          <View key={r.id} style={styles.reviewItem}>
            <View style={styles.reviewHead}>
              <View style={styles.reviewerAvatar}>
                {r.reviewer_avatar ? (
                  <Image source={{ uri: r.reviewer_avatar }} style={styles.reviewerAvatarImg} contentFit="cover" />
                ) : (
                  <Txt variant="bodyBold" color={colors.brandPrimary}>{(r.reviewer_name || "U")[0].toUpperCase()}</Txt>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Txt variant="bodyBold">{r.reviewer_name}</Txt>
                <Stars value={r.stars} size={11} />
              </View>
              <Txt variant="caption">{timeAgo(r.created_at)}</Txt>
            </View>
            {!!r.review && <Txt variant="sub" style={{ marginTop: 6 }}>{r.review}</Txt>}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center" },
  scoreCol: { alignItems: "center", paddingRight: spacing.lg, marginRight: spacing.lg, borderRightWidth: 1, borderRightColor: colors.divider },
  bigScore: { fontFamily: font.bold, fontSize: 40, color: colors.onSurface, lineHeight: 44 },
  bars: { flex: 1 },
  barRow: { flexDirection: "row", alignItems: "center", marginVertical: 2 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.warning },
  reviewItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  reviewHead: { flexDirection: "row", alignItems: "center" },
  reviewerAvatar: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  reviewerAvatarImg: { width: "100%", height: "100%" },
});
