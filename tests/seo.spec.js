// SEO: checks the HTML exactly as a crawler receives it (JavaScript off),
// plus sitemap.xml, robots.txt and every internal link and asset.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, SITE, PAGES, read } = require('./helpers');

test.use({ javaScriptEnabled: false });

const meta = (page, sel) => page.locator(sel).first().getAttribute('content');

for (const p of PAGES) {
  test.describe(p.file, () => {
    test.beforeEach(async ({ page }) => { await page.goto(p.path); });

    test('has a useful <title> and meta description', async ({ page }) => {
      const title = await page.title();
      expect(title.length, `title "${title}"`).toBeGreaterThanOrEqual(15);
      expect(title.length, `title "${title}"`).toBeLessThanOrEqual(65);
      const desc = await meta(page, 'meta[name="description"]');
      expect(desc, 'meta description').toBeTruthy();
      expect(desc.length, `description "${desc}"`).toBeGreaterThanOrEqual(70);
      expect(desc.length, `description "${desc}"`).toBeLessThanOrEqual(160);
    });

    test('has lang, charset and viewport', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}/);
      await expect(page.locator('meta[charset]')).toHaveCount(1);
      expect(await meta(page, 'meta[name="viewport"]')).toContain('width=device-width');
    });

    test('canonical URL points to this page', async ({ page }) => {
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', p.url);
    });

    test('is indexable, with no duplicate or conflicting robots tags', async ({ page }) => {
      const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.content));
      expect(robots.length, `robots tags: ${JSON.stringify(robots)}`).toBeLessThanOrEqual(1);
      for (const r of robots) expect(r).not.toMatch(/noindex/i);
    });

    test('Open Graph and Twitter tags describe this page', async ({ page }) => {
      expect(await meta(page, 'meta[property="og:url"]'), 'og:url').toBe(p.url);
      expect(await meta(page, 'meta[property="og:title"]'), 'og:title').toBe(await page.title());
      expect(await meta(page, 'meta[property="og:description"]'), 'og:description')
        .toBe(await meta(page, 'meta[name="description"]'));
      expect(await meta(page, 'meta[name="twitter:card"]')).toBeTruthy();
    });

    test('has a browser tab icon, an SVG icon and a home-screen icon that load', async ({ page, request }) => {
      for (const sel of ['link[rel="icon"][href$=".ico"]', 'link[rel="icon"][type="image/svg+xml"]', 'link[rel="apple-touch-icon"]']) {
        await expect(page.locator(sel), sel).toHaveCount(1);
        const href = await page.locator(sel).getAttribute('href');
        const res = await request.get(new URL(href, page.url()).pathname);
        expect(res.status(), `${sel} → ${href}`).toBe(200);
      }
      // browsers ask for /favicon.ico on their own, even on pages without the link
      expect((await request.get('/favicon.ico')).status()).toBe(200);
    });

    test('social share image exists', async ({ page, request }) => {
      for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
        const img = await meta(page, sel);
        expect(img, sel).toBeTruthy();
        expect(img.startsWith(SITE + '/'), `${sel} should be an absolute URL on ${SITE}: ${img}`).toBe(true);
        const res = await request.get(img.slice(SITE.length));
        expect(res.status(), `${sel} → ${img}`).toBe(200);
      }
    });

    test('has exactly one <h1> and no skipped heading levels', async ({ page }) => {
      await expect(page.locator('h1')).toHaveCount(1);
      const levels = await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll((els) => els.map((e) => +e.tagName[1]));
      const skips = levels.filter((l, i) => i > 0 && l > levels[i - 1] + 1);
      expect(skips, `heading levels in order: ${levels.join(',')}`).toEqual([]);
    });

    test('internal links and assets resolve', async ({ page, request, baseURL }) => {
      const urls = await page.evaluate(() => [
        ...[...document.querySelectorAll('a[href]')].map((a) => a.href),
        ...[...document.querySelectorAll('img[src],script[src]')].map((e) => e.src),
        ...[...document.querySelectorAll('link[href]')].map((l) => l.href),
      ]);
      const local = [...new Set(urls.filter((u) => u.startsWith(baseURL)).map((u) => u.split('#')[0]))];
      const broken = [];
      for (const u of local) {
        const res = await request.get(u);
        if (res.status() !== 200) broken.push(`${res.status()} ${u}`);
      }
      expect(broken).toEqual([]);
    });

    test('in-page anchors point to existing ids', async ({ page }) => {
      const missing = await page.evaluate(() =>
        [...document.querySelectorAll('a[href^="#"]')]
          .map((a) => a.getAttribute('href').slice(1))
          .filter((id) => id && !document.getElementById(id)));
      expect(missing).toEqual([]);
    });

    test('structured data, if present, is valid JSON-LD', async ({ page }) => {
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      for (const b of blocks) {
        const data = JSON.parse(b);
        expect(data['@context']).toMatch(/schema\.org/);
      }
    });
  });
}

test('sitemap.xml lists every page with absolute URLs', async () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  for (const p of PAGES) expect(locs, `sitemap should list ${p.url}`).toContain(p.url);
  for (const loc of locs) {
    const file = new URL(loc).pathname.replace(/\/$/, '/index.html').slice(1);
    expect(fs.existsSync(path.join(ROOT, file)), `sitemap entry ${loc} has no file`).toBe(true);
  }
});

test('robots.txt allows crawling and points to the sitemap', async () => {
  const robots = read('robots.txt');
  expect(robots).toMatch(/^User-agent: \*/m);
  expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});
