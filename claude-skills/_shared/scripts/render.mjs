#!/usr/bin/env node
// render.mjs — frame-exact HTML scene -> MP4 at 12 fps (H.264, yuv420p, +faststart).
//
// usage:
//   node render.mjs scene.html --out out.mp4 [--w 1080 --h 1920] [--duration 10]
//        [--fps 12] [--container-fps 24] [--frames-dir dir] [--keep-frames]
//        [--audio bed.wav] [--from 0 --to 10] [--crf 18]
//
// Rules:
//   * The scene must call KM.mount(...) (or define window.seek(t) + window.SCENE).
//   * Animation is sampled at --fps (default 12): t = frame / 12. That IS the motion rate.
//   * --container-fps 24|30 only repeats frames so platforms that dislike 12 fps accept the file;
//     motion stays 12 poses per second (24 = every frame twice; 30 = 3-2-3-2 cadence, avoid if you can).
//   * --audio is loudness-normalised to -14 LUFS and trimmed to the video length.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const roots = [];
  try { roots.push(spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).stdout.trim()); } catch {}
  roots.push(path.join(process.cwd(), 'node_modules'));
  for (const r of roots) {
    try { const req = createRequire(path.join(r, 'noop.js')); return req(req.resolve('playwright', { paths: [r] })); } catch {}
  }
  console.error('Playwright not found. Install it once:  npm i -g playwright  &&  npx playwright install chromium');
  process.exit(2);
}

export function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } }
    else a._.push(k);
  }
  return a;
}

export async function openScene(html, { w, h, params = '' } = {}) {
  const { chromium } = await loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') && !process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text'] });
  // Probe size from the scene unless given
  const url = pathToFileURL(path.resolve(html)).href + '?render=1' + (w ? `&w=${w}` : '') + (h ? `&h=${h}` : '') + params;
  const page = await browser.newPage({ viewport: { width: +(w || 1080), height: +(h || 1920) }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.sceneReady !== undefined || typeof window.seek === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.sceneReady);
  const scene = await page.evaluate(() => window.SCENE || {});
  if (!w && scene.width && (scene.width !== 1080 || scene.height !== 1920)) await page.setViewportSize({ width: scene.width, height: scene.height });
  if (errors.length) { console.error('Scene errors:\n  ' + errors.join('\n  ')); }
  return { browser, page, scene, errors };
}

export async function captureFrames(page, times, dir, size) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < times.length; i++) {
    await page.evaluate((t) => window.seek(t), times[i]);
    // two rAFs so layout/fonts settle for this t
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const f = path.join(dir, String(i).padStart(5, '0') + '.png');
    await page.screenshot({ path: f, clip: { x: 0, y: 0, width: size.width, height: size.height } });
    files.push(f);
    if (i % 24 === 0) process.stdout.write(`\r  frame ${i + 1}/${times.length}`);
  }
  process.stdout.write(`\r  frame ${times.length}/${times.length}\n`);
  return files;
}

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const html = a._[0];
  if (!html) { console.error('usage: node render.mjs scene.html --out out.mp4 [--fps 12] [--container-fps 24] [--w 1080 --h 1920] [--audio file]'); process.exit(1); }
  const fps = +(a.fps || 12);
  if (fps !== 12) console.warn(`WARNING: --fps ${fps}. KOCHI house rule is 12 poses per second; use --container-fps for delivery instead.`);
  const cfps = +(a['container-fps'] || fps);
  const out = path.resolve(a.out || html.replace(/\.html?$/, '') + '.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { browser, page, scene } = await openScene(html, { w: a.w, h: a.h });
  const size = { width: +(a.w || scene.width || 1080), height: +(a.h || scene.height || 1920) };
  const dur = +(a.duration || scene.duration);
  if (!dur) { console.error('No duration: pass --duration or set it in KM.mount'); process.exit(1); }
  const from = +(a.from || 0), to = Math.min(+(a.to || dur), dur);
  const n = Math.round((to - from) * fps);
  const times = Array.from({ length: n }, (_, i) => from + i / fps);
  const dir = a['frames-dir'] ? path.resolve(a['frames-dir']) : fs.mkdtempSync(path.join(os.tmpdir(), 'kochi-frames-'));
  console.log(`Rendering ${path.basename(html)}  ${size.width}x${size.height}  ${(to - from).toFixed(2)}s  ${n} frames @ ${fps} fps -> ${path.basename(out)}${cfps !== fps ? ` (container ${cfps} fps)` : ''}`);
  await captureFrames(page, times, dir, size);
  await browser.close();

  const vf = [`scale=${size.width}:${size.height}:flags=lanczos`, 'format=yuv420p'];
  if (cfps !== fps) vf.unshift(`fps=${cfps}`);
  const args = ['-framerate', String(fps), '-i', path.join(dir, '%05d.png')];
  if (a.audio) args.push('-i', path.resolve(a.audio));
  args.push('-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(a.crf || 18), '-pix_fmt', 'yuv420p', '-r', String(cfps), '-movflags', '+faststart');
  if (a.audio) args.push('-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest');
  args.push(out);
  ff(args);
  if (!a['frames-dir'] && !a['keep-frames']) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Done: ${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
