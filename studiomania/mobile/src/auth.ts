// 🍎 الدخول بـ Apple (الآيفون) وجوجل: نفس حساب الموقع.
// جوجل بيفتح صفحة الدخول في متصفح آمن جوه التطبيق، وبيرجع بكود مرة واحدة بنبدّله بجلسة ومعاه سر بيعرفه التطبيق بس (PKCE).
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { API_BASE, ApiError, api, json, setSession } from "./api";

const RETURN = "simsimkit://auth";
const b64url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const GOOGLE_ERR: Record<string, string> = {
  cancel: "ألغيت الدخول بجوجل.",
  denied: "رفضت جوجل الدخول بهذا الحساب. جرّب حسابًا آخر أو ادخل بالبريد الإلكتروني.",
  email: "بريد هذا الحساب في جوجل غير مؤكد. أكّده في جوجل أو ادخل بالبريد الإلكتروني.",
};

/** يرجّع true لو دخل، false لو ألغى، ويرمي خطأ برسالة واضحة لو فشل. */
export async function googleLogin(): Promise<boolean> {
  const bytes = Crypto.getRandomBytes(32);
  const verifier = b64url(btoa(String.fromCharCode(...bytes)));
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const r = await WebBrowser.openAuthSessionAsync(`${API_BASE}/auth/google?app=${challenge}`, RETURN);
  if (r.type !== "success") return false;
  // مش بنستخدم URL هنا: نسخة React Native منها ناقصة مع simsimkit://
  const q = new Map((r.url.split("?")[1] || "").split("&").filter(Boolean).map((kv) => kv.split("=").map(decodeURIComponent) as [string, string]));
  const err = q.get("err");
  if (err === "cancel") return false;
  if (err) throw new ApiError(GOOGLE_ERR[err] || "لم يكتمل الدخول بجوجل. حاول مرة أخرى.", 400);
  const code = q.get("code");
  if (!code) throw new ApiError("لم يكتمل الدخول بجوجل. حاول مرة أخرى.", 400);
  const d = await api<{ token: string }>("/api/auth/app-exchange", json({ code, verifier }));
  await setSession(d.token);
  return true;
}

export const appleAvailable = () => AppleAuthentication.isAvailableAsync().catch(() => false);

export async function appleLogin(): Promise<boolean> {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!c.identityToken) throw new ApiError("لم يكتمل الدخول بـ Apple. حاول مرة أخرى.", 400);
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(" ");
    const d = await api<{ token: string }>("/api/auth/apple", json({ identity_token: c.identityToken, name }));
    await setSession(d.token);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return false;
    throw e;
  }
}
