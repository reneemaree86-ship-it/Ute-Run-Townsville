import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/src/api/client";

type CheckoutResult = "paid" | "pending" | "canceled";

/**
 * Opens Stripe Checkout. On web we full-page redirect (the /payment-return
 * route finishes the flow). On native we open an in-app browser, then verify
 * the session once the user returns.
 */
export async function startCheckout(
  create: (returnBase?: string) => Promise<{ url: string; session_id: string }>
): Promise<CheckoutResult> {
  const returnBase =
    Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined;
  const { url, session_id } = await create(returnBase);

  if (Platform.OS === "web") {
    // eslint-disable-next-line no-undef
    window.location.href = url;
    return "pending";
  }

  await WebBrowser.openBrowserAsync(url);
  // Confirm payment (webhook-less): retry a few times.
  for (let i = 0; i < 4; i++) {
    try {
      const r = await api.verifyPayment(session_id);
      if (r.status === "paid") return "paid";
    } catch (e) { console.warn("Operation failed:", e); }
    await new Promise((res) => setTimeout(res, 1200));
  }
  return "pending";
}
