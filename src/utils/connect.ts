import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/src/api/client";

type ConnectResult = "complete" | "pending" | "error";

/**
 * Opens Stripe Connect Express onboarding. On web we full-page redirect (the
 * /connect-return route refreshes status). On native we open an in-app browser,
 * then re-fetch the account status once the user returns.
 */
export async function startOnboarding(): Promise<ConnectResult> {
  const returnBase =
    Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined;
  try {
    const { url } = await api.connectOnboardingLink(returnBase);
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-undef
      window.location.href = url;
      return "pending";
    }
    await WebBrowser.openBrowserAsync(url);
    const status = await api.connectStatus();
    return status?.payouts_enabled ? "complete" : "pending";
  } catch {
    return "error";
  }
}
