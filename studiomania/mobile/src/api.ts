// الكلام مع simsimkit.com: نفس حساب الويب (كوكي الجلسة)، فكل اللي بيتعمل هنا بيظهر على الويب والعكس
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_BASE: string = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase || "https://simsimkit.com";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// 🔑 الجلسة: بعد الدخول بجوجل أو Apple بنحفظ توكن الجلسة في الخزنة الآمنة ونبعته مع كل طلب (والكوكي احتياطي للدخول بالإيميل)
const TOKEN_KEY = "session";
let session: string | null | undefined;
async function sessionToken(): Promise<string | null> {
  if (session === undefined) session = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  return session;
}
export async function setSession(tok: string | null) {
  session = tok;
  appTok = tok ? Promise.resolve(tok) : null;
  if (tok) await SecureStore.setItemAsync(TOKEN_KEY, tok).catch(() => null);
  else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => null);
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const tok = await sessionToken();
  const res = await fetch(API_BASE + path, { credentials: "include", ...init,
    headers: { Accept: "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(init.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    throw new ApiError(typeof detail === "string" ? detail : "حدثت مشكلة، حاول مرة أخرى", res.status);
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
export const logout = async () => { await api("/api/auth/logout", { method: "POST" }).catch(() => null); await setSession(null); };
export const deleteAccount = async () => { await api("/api/me/delete", json({ confirm: "DELETE" })); await setSession(null); };

// ملف من الموبايل (صوت أو فيديو) جوه FormData
export function fileField(uri: string, name: string, type: string) {
  return { uri, name, type } as unknown as Blob;
}

// مشغّل الفيديو والصور مابيبعتوش كوكي الجلسة، فبنجيب توكن الجلسة مرة ونبعته في Authorization
let appTok: Promise<string> | null = null;
export function mediaHeaders(): Promise<Record<string, string>> {
  appTok ||= api<{ token: string }>("/api/auth/app-token").then((r) => r.token).catch(() => { appTok = null; return ""; });
  return appTok.then((t): Record<string, string> => (t ? { Authorization: `Bearer ${t}` } : {}));
}
export const mediaUrl = (u: string) => (u.startsWith("http") ? u : API_BASE + u);
