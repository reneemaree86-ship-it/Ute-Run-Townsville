// UteRun Townsville design tokens — "Tactile / Playful" warm outback theme.
import { Platform } from "react-native";

export const colors = {
  surface: "#FAF8F5",
  onSurface: "#2C2A28",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#F2EBE3",
  onSurfaceTertiary: "#4A4641",
  surfaceInverse: "#2C2A28",
  onSurfaceInverse: "#FAF8F5",
  brand: "#F06B30",
  brandPrimary: "#F06B30",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D4561D",
  brandTertiary: "#FFDBCF",
  onBrandTertiary: "#BA3F00",
  success: "#329F5B",
  onSuccess: "#FFFFFF",
  warning: "#F4B942",
  onWarning: "#2C2A28",
  error: "#DE4E4E",
  onError: "#FFFFFF",
  info: "#4790E5",
  onInfo: "#FFFFFF",
  border: "#E8DED4",
  borderStrong: "#D1C3B4",
  divider: "#E8DED4",
  muted: "#8C857C",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  display: "Fredoka-Bold",
  displaySemi: "Fredoka-SemiBold",
  displayMed: "Fredoka-Medium",
  regular: "Nunito-Regular",
  semibold: "Nunito-SemiBold",
  bold: "Nunito-Bold",
  extrabold: "Nunito-ExtraBold",
};

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#2C2A28",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }) as object,
  float: Platform.select({
    ios: {
      shadowColor: "#2C2A28",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: {},
  }) as object,
};

export const JOB_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  pickup: { label: "Pickup", icon: "cube-outline", color: "#F06B30" },
  delivery: { label: "Delivery", icon: "cart-outline", color: "#4790E5" },
  move: { label: "Move", icon: "home-outline", color: "#329F5B" },
  tip_run: { label: "Tip Run", icon: "trash-outline", color: "#A06CD5" },
};

export const LOAD_META: Record<string, { label: string; sub: string }> = {
  small: { label: "Small", sub: "A few boxes" },
  medium: { label: "Medium", sub: "Furniture item" },
  large: { label: "Large", sub: "Room of stuff" },
  xl: { label: "XL", sub: "Whole load" },
};
