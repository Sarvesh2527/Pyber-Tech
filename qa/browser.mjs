import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Uses the Linux Chromium bundled with @sparticuz/chromium.
// On macOS / Windows set CHROME_PATH to a local Chrome or Chromium binary.
export async function launch() {
  const custom = process.env.CHROME_PATH;
  return puppeteer.launch({
    executablePath: custom || (await chromium.executablePath()),
    args: custom ? ['--hide-scrollbars'] : [...chromium.args, '--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
    headless: custom ? true : 'shell',
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
}
