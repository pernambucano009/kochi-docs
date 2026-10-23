// التصوير بالسكريبت: إيه اللي مستني يتصوّر (من الأوتوبايلوت أو من مشاريع «تصوير بالجوال»)، واللقطات اللي اتصوّرت، والرفع للمشروع
import { useSyncExternalStore } from "react";
import { api, fileField } from "./api";

export type Target = { kind: "pilot" | "flow" | "free"; id: string; title: string };
export type Shot = { name: string; line: string; uri: string | null; secs: number; takes: number };
export type Session = { target: Target; shots: Shot[] };

type PilotJob = { id: string; kind: string; status: string; fid?: string; title?: string; script?: string[] };
type FlowRow = { id: string; template?: { kind?: string; name?: string }; stage?: string; title?: string };
type FlowFull = { scenario?: { title?: string; beats?: { say?: string; text?: string }[] }; idea?: { title?: string }; footage?: { main?: unknown } };

// التيلي برومتر يعرض الكلام اللي هيتقال بس: من غير (وقفة) أو [تعليمات] أو *ملاحظات*
export function spoken(s: string) {
  return s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();
}

function shotName(i: number, n: number) {
  if (i === 0) return "الهوك";
  if (i === n - 1 && n > 2) return "الدعوة";
  return "المحتوى";
}

export function makeShots(lines: string[]): Shot[] {
  const clean = lines.map(spoken).filter(Boolean);
  return clean.map((line, i) => ({ name: shotName(i, clean.length), line, uri: null, secs: 0, takes: 0 }));
}

// النص الحر (لما مفيش مشروع): كل سطر أو جملة لقطة
export function splitScript(text: string): string[] {
  const parts = text.split(/\n+|(?<=[.!؟?])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

export type Todo = Target & { lines: string[] };

// كل المشاريع اللي مستنية فيديو منك، الأوتوبايلوت الأول لأنه بيستنى عشان ينزّل في ميعاده
export async function toShoot(): Promise<Todo[]> {
  const out: Todo[] = [];
  const seen = new Set<string>();
  try {
    const p = await api<{ jobs: PilotJob[] }>("/api/pilot");
    for (const j of p.jobs || []) {
      if (j.status !== "cam" || !j.script?.length) continue;
      out.push({ kind: "pilot", id: j.id, title: j.title || "فيديو الأوتوبايلوت", lines: j.script });
      if (j.fid) seen.add(j.fid);
    }
  } catch {
    // الأوتوبايلوت مش متفعّل: عادي
  }
  const flows = await api<FlowRow[]>("/api/flows").catch(() => [] as FlowRow[]);
  for (const f of flows) {
    if (f.template?.kind !== "phone" || f.stage !== "shoot" || seen.has(f.id)) continue;
    const d = await api<FlowFull>(`/api/flows/${f.id}`).catch(() => null);
    if (!d || d.footage?.main) continue;
    const lines = (d.scenario?.beats || []).map((b) => b.say || b.text || "").filter(Boolean);
    if (lines.length) out.push({ kind: "flow", id: f.id, title: d.scenario?.title || d.idea?.title || f.title || "تصوير بالجوال", lines });
  }
  return out;
}

export async function uploadShots(s: Session) {
  const fd = new FormData();
  s.shots.forEach((x, i) => { if (x.uri) fd.append("files", fileField(x.uri, `shot${i + 1}.mp4`, "video/mp4")); });
  const path = s.target.kind === "pilot" ? `/api/pilot/jobs/${s.target.id}/footage/shots` : `/api/flows/${s.target.id}/footage/shots`;
  await api(path, { method: "POST", body: fd });
}

// الجلسة الحالية (بين شاشة التيلي برومتر وشاشة اللقطات)
let cur: Session | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const shoot = {
  start(target: Target, lines: string[]) { cur = { target, shots: makeShots(lines) }; emit(); },
  setTake(i: number, uri: string, secs: number) {
    if (!cur) return;
    cur = { ...cur, shots: cur.shots.map((x, k) => (k === i ? { ...x, uri, secs, takes: x.takes + 1 } : x)) };
    emit();
  },
  clear() { cur = null; emit(); },
  get: () => cur,
};

export function useShoot() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur);
}
