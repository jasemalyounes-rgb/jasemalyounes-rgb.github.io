// Security: third-party code, link hygiene, leaked secrets, and the chat widget's
// handling of untrusted AI output (it is rendered as HTML, so it must be escaped).
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');
const { ROOT, PAGES, CHAT_URL, mockChat, read } = require('./helpers');

// Hosts the site is allowed to load scripts from. Anything else fails the test.
const SCRIPT_HOSTS = ['cdnjs.cloudflare.com', 'pay.google.com'];
// Scripts that can't carry Subresource Integrity because the vendor updates them in place.
const NO_SRI_OK = ['pay.google.com'];

for (const p of PAGES) {
  test.describe(p.file, () => {
    test('external scripts come from allowed hosts over HTTPS, with SRI where possible', async () => {
      const html = read(p.file);
      const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({ tag: m[0], src: m[1] }));
      for (const s of scripts.filter((s) => /^(https?:)?\/\//.test(s.src))) {
        const url = new URL(s.src, 'https://x');
        expect(url.protocol, s.src).toBe('https:');
        expect(SCRIPT_HOSTS, `unexpected script host in ${s.src}`).toContain(url.hostname);
        if (!NO_SRI_OK.includes(url.hostname)) {
          expect(s.tag, `${s.src} needs integrity="sha384-…"`).toMatch(/\bintegrity="sha(256|384|512)-/);
          expect(s.tag, `${s.src} needs crossorigin="anonymous"`).toMatch(/\bcrossorigin="anonymous"/);
        }
      }
    });

    test('no mixed content (http:// resources)', async () => {
      const html = read(p.file);
      const insecure = [...html.matchAll(/\b(?:src|href|action)="(http:\/\/[^"]+)"/g)].map((m) => m[1])
        .filter((u) => !u.startsWith('http://www.w3.org/'));
      expect(insecure).toEqual([]);
    });

    test('links opening a new tab use rel="noopener"', async ({ page }) => {
      await mockChat(page);
      await page.goto(p.path);
      const bad = await page.$$eval('a[target="_blank"]', (as) =>
        as.filter((a) => !/\bno(opener|referrer)\b/.test(a.rel)).map((a) => a.href));
      expect(bad).toEqual([]);
    });

    test('forms do not submit to insecure or foreign endpoints', async ({ page }) => {
      await mockChat(page);
      await page.goto(p.path);
      const actions = await page.$$eval('form[action]', (fs) => fs.map((f) => f.action));
      for (const a of actions) expect(a, a).toMatch(/^(https:|mailto:|http:\/\/127\.0\.0\.1)/);
    });

    test('page loads without uncaught errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await mockChat(page);
      await page.route(/pay\.google\.com|cdnjs\.cloudflare\.com/, (r) => r.continue());
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  });
}

test.describe('chat widget', () => {
  const PAYLOADS = [
    '<img src=x onerror="window.__xss=1">',
    '<script>window.__xss=1</script>',
    '**<svg onload="window.__xss=1">**',
    'Visit https://evil.example/"><img src=x onerror="window.__xss=1"> now',
    '[click](javascript:window.__xss=1) javascript:window.__xss=1',
    '- <iframe src="javascript:window.__xss=1"></iframe>',
  ];

  for (const payload of PAYLOADS) {
    test(`escapes hostile AI reply: ${payload.slice(0, 40)}`, async ({ page }) => {
      await mockChat(page, payload);
      await page.addInitScript(() => sessionStorage.setItem('cb-seen', '1'));
      await page.goto('/');
      await page.locator('.cb-launch').click();
      await page.locator('.cb-form input').fill('hi');
      await page.keyboard.press('Enter');
      const reply = page.locator('.cb-msg.cb-bot').last();
      await expect(reply).not.toHaveClass(/cb-typing/);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window.__xss)).toBeUndefined();
      expect(await reply.locator('script,img,svg,iframe,[onerror],[onload]').count()).toBe(0);
      const hrefs = await reply.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      for (const h of hrefs) expect(h, 'only http(s)/mailto links').toMatch(/^(https?:|mailto:)/);
    });
  }

  test('links in AI replies open safely in a new tab', async ({ page }) => {
    await mockChat(page, 'See https://github.com/jasemalyounes-rgb');
    await page.addInitScript(() => sessionStorage.setItem('cb-seen', '1'));
    await page.goto('/');
    await page.locator('.cb-launch').click();
    await page.locator('.cb-form input').fill('github?');
    await page.keyboard.press('Enter');
    const link = page.locator('.cb-msg.cb-bot a').last();
    await expect(link).toHaveAttribute('href', 'https://github.com/jasemalyounes-rgb');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('user input is limited and sent as JSON, never rendered as HTML', async ({ page }) => {
    let body;
    await page.route(CHAT_URL, (route) => { body = route.request().postDataJSON(); route.fulfill({ json: { output: 'ok' } }); });
    await page.addInitScript(() => sessionStorage.setItem('cb-seen', '1'));
    await page.goto('/');
    await page.locator('.cb-launch').click();
    await expect(page.locator('.cb-form input')).toHaveAttribute('maxlength', '500');
    await page.locator('.cb-form input').fill('<b id="inj">x</b>');
    await page.keyboard.press('Enter');
    await expect(page.locator('.cb-msg.cb-bot').last()).toHaveText('ok');
    expect(await page.locator('#inj').count()).toBe(0);
    expect(body).toMatchObject({ action: 'sendMessage', chatInput: '<b id="inj">x</b>' });
  });

  test('chat endpoint is HTTPS', () => {
    const url = read('assets/chat.js').match(/CHAT_URL = '([^']*)'/)[1];
    expect(url).toMatch(/^https:\/\//);
  });
});

test('no secrets committed to the repository', () => {
  const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/\.(jpg|png|pdf|docx)$/i.test(f) && f !== 'package-lock.json');
  const PATTERNS = [
    [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
    [/sk-(?:ant-)?[A-Za-z0-9_-]{20,}/, 'OpenAI/Anthropic key'],
    [/gh[pousr]_[A-Za-z0-9]{36}/, 'GitHub token'],
    [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
    [/\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/, 'Telegram bot token'],
    [/"(?:password|apiKey|secret|token)"\s*:\s*"[^"]{8,}"/i, 'credential in JSON'],
  ];
  const hits = [];
  for (const f of files) {
    const text = read(f);
    for (const [re, name] of PATTERNS) if (re.test(text)) hits.push(`${name} in ${f}`);
  }
  expect(hits).toEqual([]);
});
