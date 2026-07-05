import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

const AUTH_BASE = "https://auth.emergentagent.com/";

/** Extract session_id from a redirect URL (supports #hash and ?query). */
export function parseSessionId(url?: string | null): string | null {
  if (!url) return null;
  const parts: string[] = [];
  const hashIdx = url.indexOf("#");
  if (hashIdx >= 0) parts.push(url.slice(hashIdx + 1));
  const qIdx = url.indexOf("?");
  if (qIdx >= 0) parts.push(url.slice(qIdx + 1).split("#")[0]);
  for (const p of parts) {
    const sid = new URLSearchParams(p).get("session_id");
    if (sid) return sid;
  }
  return null;
}

/**
 * Starts Emergent-managed Google sign-in.
 * - Web: full-page redirect (session_id returns to root and is handled on mount).
 * - Native: opens an auth session and returns the session_id from result.url.
 */
export async function startGoogleAuth(): Promise<string | null> {
  const redirectUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin + "/"
      : Linking.createURL("auth");
  const authUrl = `${AUTH_BASE}?redirect=${encodeURIComponent(redirectUrl)}`;

  if (Platform.OS === "web") {
    // eslint-disable-next-line no-undef
    window.location.href = authUrl;
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
  if (result.type !== "success") return null;
  return parseSessionId(result.url);
}

/** Read a session_id present in the current web URL (post-redirect). */
export function getWebSessionId(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const sid = parseSessionId(window.location.href);
  return sid;
}

/** Remove the session_id fragment/query from the web URL after processing. */
export function clearWebSessionId() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.history.replaceState(null, "", window.location.pathname);
  }
}
