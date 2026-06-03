// Drives the deployed app through the scene script while screen-recording.
// Logs the real start time of each scene so audio can be aligned afterwards
// (robust to variable OpenAI latency).
import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import fs from 'node:fs';
import path from 'node:path';
import { SCENES, URL } from './scenes.mjs';

const W = 1440, H = 900, PAD_MS = 700;
const durations = JSON.parse(fs.readFileSync(path.resolve('out/durations.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('.nav-item').length > 20, { timeout: 30000 });
await sleep(1500);

// ---- visible cursor ----
async function ensureCursor() {
  await page.evaluate(() => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    Object.assign(c.style, {
      position: 'fixed', width: '20px', height: '20px', borderRadius: '50%', left: '720px', top: '450px',
      background: 'rgba(255,90,110,0.55)', border: '2px solid #fff', zIndex: 2147483647, pointerEvents: 'none',
      transform: 'translate(-50%,-50%)', transition: 'left .45s ease, top .45s ease',
      boxShadow: '0 0 14px rgba(255,90,110,0.9)',
    });
    document.body.appendChild(c);
  });
}
async function moveCursor(x, y) {
  await ensureCursor();
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById('__cursor');
    if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
  }, { x, y });
  await page.mouse.move(x, y);
  await sleep(520);
}
async function clickAt(x, y) {
  await moveCursor(x, y);
  await page.mouse.click(x, y);
  await sleep(250);
}

// Find the smallest element whose text contains `text`, scroll it into view, return center.
async function rectOf(text, { scope } = {}) {
  return page.evaluate(({ text, scope }) => {
    const root = scope ? document.querySelector(scope) : document;
    if (!root) return null;
    const els = [...root.querySelectorAll('button, a, [role="button"], .nav-item, .card, span, div, td')]
      .filter((e) => (e.innerText || '').trim().toLowerCase().includes(text.toLowerCase()) && e.offsetParent !== null);
    els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    const el = els[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, { text, scope });
}

const h = {
  wait: sleep,
  async go(label) {
    const r = await rectOf(label, { scope: '.sidebar' });
    if (!r) throw new Error('nav not found: ' + label);
    await clickAt(r.x, Math.max(20, Math.min(H - 20, r.y)));
    await sleep(600);
  },
  async click(text) {
    const r = await rectOf(text);
    if (!r) throw new Error('click target not found: ' + text);
    await clickAt(r.x, Math.max(20, Math.min(H - 20, r.y)));
  },
  async clickSel(sel, nth = 0) {
    const r = await page.evaluate(({ sel, nth }) => {
      const el = document.querySelectorAll(sel)[nth];
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, { sel, nth });
    if (!r) throw new Error('selector not found: ' + sel);
    await clickAt(r.x, Math.max(20, Math.min(H - 20, r.y)));
  },
  async type(sel, text) {
    const r = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, sel);
    if (r) await moveCursor(r.x, r.y);
    await page.click(sel).catch(() => {});
    await page.type(sel, text, { delay: 28 });
  },
  async enter() { await page.keyboard.press('Enter'); },
  async waitText(substr, timeout = 20000) {
    return page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t), { timeout }, substr.toLowerCase());
  },
  async scroll(px) {
    await page.evaluate((y) => {
      const el = document.querySelector('.screen') || document.scrollingElement;
      if (el && el.scrollBy) el.scrollBy({ top: y, behavior: 'smooth' }); else window.scrollBy(0, y);
    }, px);
  },
  async dismissOnboarding() {
    const r = await rectOf('Skip for now');
    if (r) await clickAt(r.x, r.y);
  },
};

await ensureCursor();

const recorder = new PuppeteerScreenRecorder(page, { fps: 25, videoFrame: { width: W, height: H }, autopad: { fps: 25 } });
await recorder.start(path.resolve('out/screen.mp4'));
const recStart = Date.now();
const timeline = [];

for (const scene of SCENES) {
  const startMs = Date.now() - recStart;
  console.log(`▶ ${scene.id} @ ${(startMs / 1000).toFixed(1)}s`);
  try {
    await scene.run(h);
  } catch (e) {
    console.log(`  ! ${scene.id} action error (continuing): ${e.message}`);
  }
  timeline.push({ id: scene.id, startMs, audio: `out/audio/${scene.id}.mp3`, audioDur: durations[scene.id] });
  const audioMs = (durations[scene.id] || 5) * 1000;
  const elapsed = (Date.now() - recStart) - startMs;
  const remaining = audioMs + PAD_MS - elapsed;
  if (remaining > 0) await sleep(remaining);
}

const endMs = Date.now() - recStart;
await recorder.stop();
await browser.close();

fs.writeFileSync(path.resolve('out/timeline.json'), JSON.stringify({ totalMs: endMs, scenes: timeline }, null, 2));
console.log(`\nRecording complete: ${(endMs / 1000 / 60).toFixed(2)} min → out/screen.mp4`);
