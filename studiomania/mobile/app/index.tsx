// أول ما التطبيق يفتح: لو داخل بحسابه يروح على الكاميرا على طول، وإلا شاشة البداية والدخول (مفيش لاندينج في الموبايل)
import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { authState } from "../src/api";
import { registerPush } from "../src/push";

export default function Index() {
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    authState().then((s) => { setTo(s.logged_in ? "/camera" : "/welcome"); if (s.logged_in) registerPush(); }).catch(() => setTo("/welcome"));
  }, []);
  return to ? <Redirect href={to as "/welcome"} /> : null;
}
