// Web fallback: react-native-maps has no web support, so reuse the styled MockMap.
import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { MockMap, MapMarker } from "@/src/components/MockMap";

export type { MapMarker } from "@/src/components/MockMap";

export function LiveMap({
  markers = [],
  style,
}: {
  markers?: MapMarker[];
  style?: StyleProp<ViewStyle>;
}) {
  return <MockMap markers={markers} style={style} />;
}
