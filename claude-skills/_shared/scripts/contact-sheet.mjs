#!/usr/bin/env node
// contact-sheet.mjs — N frames on one image, for review. Works on an HTML scene OR an encoded video.
//
//   node contact-sheet.mjs scene.html --out sheet.png [--every 1 | --times 0,1.5,3] [--cols 5] [--frames-dir dir]
//   node contact-sheet.mjs video.mp4  --out sheet.png [--every 1] [--cols 5] [--frames-dir dir]
//
// --frames-dir also keeps the full-size frames (feed them to palette-check.py).
// Always make the final sheet from the ENCODED MP4, not the HTML.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, openScene, captureFrames, loadPlaywright } from './render.mjs';

const a = parseArgs(process.argv.slice(2));
const src = a._[0];
if (!src) { console.error('usage: node contact-sheet.mjs <scene.html|video.mp4> --out sheet.png [--every 1] [--times a,b,c] [--cols 5]'); process.exit(1); }
const out = path.resolve(a.out || src.replace(/\.[^.]+$/, '') + '-sheet.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const dir = a['frames-dir'] ? path.resolve(a['frames-dir']) : fs.mkdtempSync(path.join(os.tmpdir(), 'kochi-sheet-'));
fs.mkdirSync(dir, { recursive: true });
const every = +(a.every || 1);
let frames = [], times = [], size;

if (/\.html?$/i.test(src)) {
  const { browser, page, scene } = await openScene(src, { w: a.w, h: a.h });
  size = { width: +(a.w || scene.width), height: +(a.h || scene.height) };
  times = a.times ? String(a.times).split(',').map(Number) : Array.from({ length: Math.floor(scene.duration / every) + 1 }, (_, i) => Math.min(i * every, scene.duration - 1 / 12));
  frames = await captureFrames(page, times, dir, size);
  await browser.close();
} else {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', src], { encoding: 'utf8' });
  const info = JSON.parse(probe.stdout); const st = info.streams[0];
  size = { width: st.width, height: st.height };
  const dur = +info.format.duration;
  const [fn, fd] = String(st.r_frame_rate).split('/').map(Number); const lastT = dur - 1 / ((fn / (fd || 1)) || 12);
  console.log(`video: ${st.width}x${st.height}  ${st.r_frame_rate} fps  ${dur.toFixed(2)}s  ${st.nb_frames || '?'} frames`);
  times = a.times ? String(a.times).split(',').map(Number) : Array.from({ length: Math.floor(dur / every) + 1 }, (_, i) => Math.min(i * every, lastT));
  times.forEach((t, i) => {
    const f = path.join(dir, String(i).padStart(5, '0') + '.png');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', f]);
    if (fs.existsSync(f)) frames.push(f); else console.warn(`  no frame at ${t}s (skipped)`);
  });
}

// Lay the frames out in a browser page (no font/ImageMagick dependency) and screenshot it.
const cols = +(a.cols || Math.min(frames.length, size.height > size.width ? 6 : 4));
const thumbW = +(a['thumb-w'] || (size.height > size.width ? 300 : 420));
const thumbH = Math.round(thumbW * size.height / size.width);
const rows = Math.ceil(frames.length / cols);
const W = cols * (thumbW + 12) + 12, H = rows * (thumbH + 34) + 12;
const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#1d1d22;font:600 13px system-ui,sans-serif;color:#ddd}
.g{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:12px 12px;padding:12px}.c img{width:${thumbW}px;height:${thumbH}px;display:block;outline:1px solid #333}.c div{height:22px;line-height:22px}</style>
<div class=g>${frames.map((f, i) => `<div class=c><div>${times[i].toFixed(2)}s</div><img src="${pathToFileURL(f).href}"></div>`).join('')}</div>`;
const htmlPath = path.join(dir, '_sheet.html'); fs.writeFileSync(htmlPath, html);
const { chromium } = await loadPlaywright();
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') && !process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await p.screenshot({ path: out, fullPage: true });
await b.close();
if (!a['frames-dir']) fs.rmSync(dir, { recursive: true, force: true });
console.log(`Contact sheet: ${out}  (${frames.length} frames)`);
