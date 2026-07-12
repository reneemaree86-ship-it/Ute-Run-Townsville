import { useEffect, useRef, useState, useCallback } from "react";
import { Platform, Linking } from "react-native";
import * as Location from "expo-location";

type PermState = "undetermined" | "granted" | "denied";

/**
 * Streams the driver's live GPS location while `enabled`. Follows the
 * permission contract: checks first, requests on intent, and surfaces an
 * "Open Settings" path when permanently blocked.
 */
export function useDriverLocationStream(
  enabled: boolean,
  onUpdate: (lat: number, lng: number, heading?: number | null) => void
) {
  const [perm, setPerm] = useState<PermState>("undetermined");
  const [canAskAgain, setCanAskAgain] = useState(true);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  const startWatch = useCallback(async () => {
    if (subRef.current) return;
    try {
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 4000 },
        (pos) => cbRef.current(pos.coords.latitude, pos.coords.longitude, pos.coords.heading),
      );
    } catch (e) { console.warn("Operation failed:", e); }
  }, []);

  const stopWatch = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  // Check current permission status whenever streaming becomes enabled.
  useEffect(() => {
    if (!enabled) { stopWatch(); return; }
    let active = true;
    (async () => {
      const cur = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      setCanAskAgain(cur.canAskAgain);
      if (cur.granted) {
        setPerm("granted");
        startWatch();
      } else {
        setPerm(cur.status === "denied" ? "denied" : "undetermined");
      }
    })();
    return () => { active = false; stopWatch(); };
  }, [enabled, startWatch, stopWatch]);

  // Contextual request, called on explicit user intent.
  const requestPermission = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(res.canAskAgain);
    if (res.granted) {
      setPerm("granted");
      startWatch();
    } else {
      setPerm("denied");
      if (!res.canAskAgain) {
        // Permanently blocked — send the user to settings.
        if (Platform.OS !== "web") Linking.openSettings();
      }
    }
  }, [startWatch]);

  const openSettings = useCallback(() => {
    if (Platform.OS !== "web") Linking.openSettings();
  }, []);

  return { perm, canAskAgain, requestPermission, openSettings };
}
