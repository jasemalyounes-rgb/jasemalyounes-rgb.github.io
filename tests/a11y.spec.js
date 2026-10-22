// Accessibility: axe-core WCAG 2.1 AA scan of every page in both languages and
// both themes, plus keyboard checks for the chat widget and the gallery.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { PAGES, openPage } = require('./helpers');

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function summarize(violations) {
  return violations.map((v) =>
    `${v.impact} ${v.id}: ${v.help}\n` +
    v.nodes.slice(0, 5).map((n) => `    ${n.target.join(' ')}  ${n.failureSummary.split('\n')[1] || ''}`).join('\n') +
    (v.nodes.length > 5 ? `\n    …and ${v.nodes.length - 5} more` : '')
  ).join('\n');
}

for (const p of PAGES) {
  for (const lang of ['en', 'ar']) {
    for (const theme of ['light', 'dark']) {
      test(`${p.file} [${lang}/${theme}] has no WCAG 2.1 AA violations`, async ({ page }) => {
        await openPage(page, p.path, { lang, theme });
        const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        expect(violations.map((v) => v.id), summarize(violations)).toEqual([]);
      });
    }
  }

  test(`${p.file} sets lang/dir correctly for Arabic`, async ({ page }) => {
    await openPage(page, p.path, { lang: 'ar' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test(`${p.file} chat panel is accessible and keyboard operable`, async ({ page }) => {
    await openPage(page, p.path);
    const launch = page.locator('.cb-launch');
    await expect(launch).toHaveAttribute('aria-label', /.+/);
    await launch.focus();
    await page.keyboard.press('Enter');
    const input = page.locator('.cb-form input');
    await expect(input).toBeFocused();
    await input.fill('What has Jasem built?');
    await page.keyboard.press('Enter');
    await expect(page.locator('.cb-msg.cb-bot').last()).toContainText('Smart Task Planner');

    const { violations } = await new AxeBuilder({ page }).include('.cb-root').withTags(WCAG).analyze();
    expect(violations.map((v) => v.id), summarize(violations)).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(page.locator('.cb-root')).not.toHaveClass(/cb-open/);
  });
}

test('every image has an alt attribute', async ({ page }) => {
  for (const p of PAGES) {
    await openPage(page, p.path);
    const missing = await page.$$eval('img:not([alt])', (els) => els.map((e) => e.outerHTML.slice(0, 120)));
    expect(missing, `${p.file}: images without alt`).toEqual([]);
  }
});
