import React, { useMemo, useRef, useEffect } from "react";
import { StyleProp, ViewStyle, View, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/theme";
import { MapMarker } from "@/src/components/MockMap";

export type { MapMarker } from "@/src/components/MockMap";

const TSV_CENTER = { latitude: -19.2589, longitude: 146.8169 };

const MARKER: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pickup: { color: colors.brandPrimary, icon: "ellipse" },
  dropoff: { color: colors.success, icon: "location" },
  driver: { color: colors.surfaceInverse, icon: "car-sport" },
  job: { color: colors.brandPrimary, icon: "cube" },
  me: { color: colors.info, icon: "navigate-circle" },
};

export function LiveMap({
  markers = [],
  style,
}: {
  markers?: MapMarker[];
  style?: StyleProp<ViewStyle>;
}) {
  const mapRef = useRef<MapView>(null);

  const coords = useMemo(
    () => markers.map((m) => ({ latitude: m.lat, longitude: m.lng })),
    [markers]
  );

  const initialRegion = useMemo(
    () => ({
      latitude: coords[0]?.latitude ?? TSV_CENTER.latitude,
      longitude: coords[0]?.longitude ?? TSV_CENTER.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [coords]
  );

  useEffect(() => {
    if (coords.length > 1) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
    }
  }, [coords]);

  return (
    <MapView
      ref={mapRef}
      style={style as any}
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation={false}
      toolbarEnabled={false}
    >
      {markers.map((m, i) => {
        const meta = MARKER[m.kind];
        return (
          <Marker
            key={i}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            title={m.label}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.pinDot, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={14} color="#fff" />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinDot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...Platform.select({
      android: { elevation: 4 },
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    }),
  },
});
