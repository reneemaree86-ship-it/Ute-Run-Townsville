import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/theme";

export interface MapMarker {
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "driver" | "job" | "me";
  label?: string;
}

// Bounding box roughly covering greater Townsville
const BBOX = { minLat: -19.42, maxLat: -19.1, minLng: 146.68, maxLng: 146.96 };

function pos(lat: number, lng: number) {
  const x = (lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng);
  const y = 1 - (lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat);
  return {
    left: `${Math.min(92, Math.max(6, x * 100))}%`,
    top: `${Math.min(90, Math.max(8, y * 100))}%`,
  };
}

const MARKER: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pickup: { color: colors.brandPrimary, icon: "ellipse" },
  dropoff: { color: colors.success, icon: "location" },
  driver: { color: colors.surfaceInverse, icon: "car-sport" },
  job: { color: colors.brandPrimary, icon: "cube" },
  me: { color: colors.info, icon: "navigate-circle" },
};

export function MockMap({
  markers = [],
  style,
}: {
  markers?: MapMarker[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.map, style]} testID="mock-map">
      {/* subtle road lines */}
      <View style={[styles.road, { top: "28%", transform: [{ rotate: "-8deg" }] }]} />
      <View style={[styles.road, { top: "62%", transform: [{ rotate: "6deg" }] }]} />
      <View style={[styles.roadV, { left: "38%" }]} />
      <View style={[styles.roadV, { left: "72%", transform: [{ rotate: "4deg" }] }]} />
      <View style={styles.river} />

      {markers.map((m, i) => {
        const meta = MARKER[m.kind];
        const p = pos(m.lat, m.lng);
        return (
          <View key={i} style={[styles.pin, { left: p.left as any, top: p.top as any }]}>
            <View style={[styles.pinDot, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={14} color="#fff" />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: "#E9EDE4",
    overflow: "hidden",
    position: "relative",
  },
  road: {
    position: "absolute",
    left: "-10%",
    width: "120%",
    height: 10,
    backgroundColor: "#FBFAF7",
    borderRadius: 4,
  },
  roadV: {
    position: "absolute",
    top: "-10%",
    height: "120%",
    width: 8,
    backgroundColor: "#FBFAF7",
    borderRadius: 4,
  },
  river: {
    position: "absolute",
    left: "5%",
    top: "5%",
    width: 40,
    height: "90%",
    backgroundColor: "#CBE3E8",
    borderRadius: 20,
    transform: [{ rotate: "18deg" }],
    opacity: 0.7,
  },
  pin: { position: "absolute", marginLeft: -16, marginTop: -16 },
  pinDot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
