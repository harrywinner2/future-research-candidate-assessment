import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

const URL = 'https://future-coach-production.up.railway.app';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--force-color-profile=srgb'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('.nav-item').length > 20, { timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: 'out/smoke.png' });
console.log('screenshot ok; body has', (await page.evaluate(()=>document.querySelectorAll('.nav-item').length)), 'nav items');

const rec = new PuppeteerScreenRecorder(page, { fps: 25, videoFrame: { width: 1440, height: 900 } });
await rec.start('out/smoke.mp4');
// do a tiny interaction during the 4s
await page.evaluate(() => { const b=[...document.querySelectorAll('.nav-item')].find(x=>/Graph Explorer/.test(x.innerText)); b&&b.click(); });
await new Promise(r => setTimeout(r, 4000));
await rec.stop();
await browser.close();
console.log('recording done');
