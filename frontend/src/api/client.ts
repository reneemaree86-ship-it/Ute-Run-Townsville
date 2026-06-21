// API client for UteRun. Uses EXPO_PUBLIC_BACKEND_URL + /api prefix.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "uterun_token";

export async function getToken() {
  return storage.secureGet(TOKEN_KEY, "");
}
export async function setToken(t: string) {
  return storage.secureSet(TOKEN_KEY, t);
}
export async function clearToken() {
  return storage.secureRemove(TOKEN_KEY);
}

async function request(path: string, init: RequestInit = {}) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.detail || data.message)) || "Something went wrong");
  }
  return data;
}

export const api = {
  // auth
  signup: (body: any) => request("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: any) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/auth/me"),
  switchRole: (role: string) => request("/auth/role", { method: "PATCH", body: JSON.stringify({ role }) }),
  requestOtp: (phone: string) => request("/auth/request-otp", { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (phone: string, code: string) =>
    request("/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, code }) }),
  // driver
  submitDriverProfile: (body: any) => request("/driver/profile", { method: "POST", body: JSON.stringify(body) }),
  setAvailability: (available: boolean) =>
    request("/driver/availability", { method: "PATCH", body: JSON.stringify({ available }) }),
  verifiedDrivers: () => request("/drivers/verified"),
  earnings: () => request("/driver/earnings"),
  // fare
  fareEstimate: (body: any) => request("/fare/estimate", { method: "POST", body: JSON.stringify(body) }),
  // jobs
  createJob: (body: any) => request("/jobs", { method: "POST", body: JSON.stringify(body) }),
  myJobs: () => request("/jobs/my"),
  jobsFeed: () => request("/jobs/feed"),
  activeJobs: () => request("/jobs/active"),
  getJob: (id: string) => request(`/jobs/${id}`),
  acceptJob: (id: string) => request(`/jobs/${id}/accept`, { method: "POST" }),
  setJobStatus: (id: string, status: string) =>
    request(`/jobs/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  cancelJob: (id: string) => request(`/jobs/${id}/cancel`, { method: "POST" }),
  // messages
  getMessages: (id: string) => request(`/jobs/${id}/messages`),
  postMessage: (id: string, text: string) =>
    request(`/jobs/${id}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  conversations: () => request("/conversations"),
  // ratings
  rateJob: (id: string, stars: number, review: string) =>
    request(`/jobs/${id}/rate`, { method: "POST", body: JSON.stringify({ stars, review }) }),
  // subscriptions
  plans: (role: string) => request(`/plans?role=${role}`),
  getSubscription: () => request("/subscription"),
  subscribe: (plan_id: string, billing: string) =>
    request("/subscription/subscribe", { method: "POST", body: JSON.stringify({ plan_id, billing }) }),
  cancelSubscription: () => request("/subscription/cancel", { method: "POST" }),
};
