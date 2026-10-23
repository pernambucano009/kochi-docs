// الكلام مع simsimkit.com: نفس حساب الويب (كوكي الجلسة)، فكل اللي بيتعمل هنا بيظهر على الويب والعكس
import Constants from "expo-constants";

export const API_BASE: string = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase || "https://simsimkit.com";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, { credentials: "include", ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    throw new ApiError(typeof detail === "string" ? detail : "حصلت مشكلة، جرّب مرة تانية", res.status);
  }
  return data as T;
}

export const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type AuthState = { logged_in: boolean; google?: boolean; user?: { email: string; name?: string } };

export const authState = () => api<AuthState>("/api/auth/state");
export const login = (email: string, password: string) => api<{ verify?: boolean }>("/api/auth/login", json({ email, password }));
export const logout = () => api("/api/auth/logout", { method: "POST" });

// ملف من الموبايل (صوت أو فيديو) جوه FormData
export function fileField(uri: string, name: string, type: string) {
  return { uri, name, type } as unknown as Blob;
}
