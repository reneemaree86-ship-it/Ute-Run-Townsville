import { useEffect, useRef, useState, useCallback } from "react";
import { getToken } from "@/src/api/client";

export interface DriverLoc {
  lat: number;
  lng: number;
  heading?: number | null;
  ts?: string;
}

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "https://quick-ute-run.preview.emergentagent.com";
const WS_BASE = BASE.replace(/^http/, "ws");

/**
 * Live job tracking over WebSocket. Customers receive driver location updates;
 * drivers can push their location via `sendLocation`. Auto-reconnects.
 */
export function useJobTracking(jobId?: string, enabled = true) {
  const [driverLoc, setDriverLoc] = useState<DriverLoc | null>(null);
  const [live, setLive] = useState(false);
  const [role, setRole] = useState<"driver" | "customer" | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);

  const connect = useCallback(async () => {
    if (!jobId || !enabled) return;
    const token = await getToken();
    if (!token) return;
    const url = `${WS_BASE}/api/ws/track/${jobId}?token=${encodeURIComponent(token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setLive(true);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "location") {
          setDriverLoc({ lat: msg.lat, lng: msg.lng, heading: msg.heading, ts: msg.ts });
        } else if (msg.type === "ready") {
          setRole(msg.role);
        }
      } catch (e) { console.warn("Operation failed:", e); }
    };
    ws.onclose = () => {
      setLive(false);
      if (!closedRef.current && enabled) {
        retryRef.current = setTimeout(connect, 3000);
      }
    };
    ws.onerror = () => {
      try { ws.close(); } catch (e) { console.warn("Operation failed:", e); }
    };
  }, [jobId, enabled]);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      try { wsRef.current?.close(); } catch (e) { console.warn("Operation failed:", e); }
    };
  }, [connect]);

  const sendLocation = useCallback((lat: number, lng: number, heading?: number | null) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "location", lat, lng, heading }));
    }
  }, []);

  return { driverLoc, live, role, sendLocation };
}
