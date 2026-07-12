import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  View,
  ViewStyle,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TextInputProps,
  StyleProp,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing, shadow } from "@/src/theme";

// ---------- Typography ----------
type TVariant = "display" | "h1" | "h2" | "h3" | "body" | "bodyBold" | "sub" | "caption";
const tStyles: Record<TVariant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 32, color: colors.onSurface, lineHeight: 38 },
  h1: { fontFamily: font.display, fontSize: 26, color: colors.onSurface, lineHeight: 32 },
  h2: { fontFamily: font.displaySemi, fontSize: 20, color: colors.onSurface, lineHeight: 26 },
  h3: { fontFamily: font.displaySemi, fontSize: 16, color: colors.onSurface, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  bodyBold: { fontFamily: font.bold, fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  sub: { fontFamily: font.semibold, fontSize: 13, color: colors.muted, lineHeight: 18 },
  caption: { fontFamily: font.semibold, fontSize: 11, color: colors.muted, lineHeight: 14 },
};

export function Txt({
  variant = "body",
  style,
  color,
  ...props
}: TextProps & { variant?: TVariant; color?: string }) {
  return <Text {...props} style={[tStyles[variant], color ? { color } : null, style]} />;
}

// ---------- Button ----------
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "dark";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const bg =
    variant === "primary" ? colors.brandPrimary
      : variant === "secondary" ? colors.brandTertiary
      : variant === "dark" ? colors.surfaceInverse
      : "transparent";
  const fg =
    variant === "primary" || variant === "dark" ? "#FFFFFF"
      : variant === "secondary" ? colors.onBrandTertiary
      : colors.brandPrimary;
  const border = variant === "outline" ? { borderWidth: 2, borderColor: colors.brandPrimary } : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        border,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: fg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------- Card ----------
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------- Chip ----------
export function Chip({
  label,
  active,
  onPress,
  icon,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.surfaceInverse : colors.surfaceSecondary,
          borderColor: active ? colors.surfaceInverse : colors.border,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={active ? "#fff" : colors.onSurfaceTertiary}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text
        style={{
          fontFamily: font.bold,
          fontSize: 13,
          color: active ? "#fff" : colors.onSurfaceTertiary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Badge ----------
export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <View style={styles.verified}>
      <Ionicons name="checkmark-circle" size={size} color={colors.success} />
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.success, marginLeft: 3 }}>
        Verified
      </Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; label: string }> = {
    open: { c: colors.info, bg: "#E5EFFB", label: "Open" },
    accepted: { c: colors.brandSecondary, bg: colors.brandTertiary, label: "Accepted" },
    picked_up: { c: colors.warning, bg: "#FCF1D6", label: "Picked up" },
    delivered: { c: colors.success, bg: "#DCF1E4", label: "Delivered" },
    completed: { c: colors.success, bg: "#DCF1E4", label: "Completed" },
    cancelled: { c: colors.error, bg: "#FBE3E3", label: "Cancelled" },
  };
  const m = map[status] || map.open;
  return (
    <View style={[styles.statusPill, { backgroundColor: m.bg }]}>
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: m.c }}>{m.label}</Text>
    </View>
  );
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons name="star" size={size} color={colors.warning} />
      <Text style={{ fontFamily: font.bold, fontSize: size, color: colors.onSurface, marginLeft: 3 }}>
        {Number(value || 0).toFixed(1)}
      </Text>
    </View>
  );
}

// ---------- Input ----------
export function Field({
  label,
  icon,
  style,
  ...props
}: TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Txt variant="sub" style={{ marginBottom: 6, color: colors.onSurfaceTertiary }}>{label}</Txt> : null}
      <View style={styles.field}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  chip: {
    height: 40,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    flexShrink: 0,
  },
  verified: { flexDirection: "row", alignItems: "center" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  input: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.onSurface, height: "100%" },
});
