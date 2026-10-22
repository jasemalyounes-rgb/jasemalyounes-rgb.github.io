const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://jasemalyounes-rgb.github.io';

// Every page that is published and meant to be indexed.
const PAGES = [
  { file: 'index.html', path: '/', url: SITE + '/' },
  { file: 'services.html', path: '/services.html', url: SITE + '/services.html' },
];

const CHAT_URL = /\/webhook\/[^/]+\/chat$/;

// Never hit the real n8n/Gemini backend from tests; answer with `reply` instead.
async function mockChat(page, reply = 'Jasem built **Smart Task Planner**.') {
  await page.route(CHAT_URL, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    return route.fulfill({ json: { output: reply } });
  });
}

// Open a page in a given language/theme, with every scroll-reveal section shown,
// so scanners see the page the way a visitor does after scrolling through it.
async function openPage(page, pagePath, { lang = 'en', theme = 'light' } = {}) {
  await page.addInitScript((l) => {
    localStorage.setItem('lang', l);
    sessionStorage.setItem('cb-seen', '1'); // keep the chat teaser out of the way
  }, lang);
  await mockChat(page);
  // don't let slow third-party scripts (Google Pay, avatars) time the test out
  await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700); // reveal transitions are .55s
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

module.exports = { ROOT, SITE, PAGES, CHAT_URL, mockChat, openPage, read };
