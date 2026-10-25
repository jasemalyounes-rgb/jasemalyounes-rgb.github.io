// Phone layout: nothing may stretch the page wider than the screen. On mobile a
// too-wide element widens the layout viewport, which also pushes fixed elements
// like the chat button off-screen.
const { test, expect } = require('@playwright/test');
const { PAGES, openPage } = require('./helpers');

for (const width of [320, 390]) {
  test.describe(`${width}px phone`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

    for (const p of PAGES) {
      for (const lang of ['en', 'ar']) {
        test(`${p.file} [${lang}] fits the screen and shows the chat button`, async ({ page }) => {
          await openPage(page, p.path, { lang });
          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
          }));
          expect(innerWidth, 'page is wider than the phone screen').toBe(width);
          expect(scrollWidth).toBeLessThanOrEqual(width);
          await expect(page.locator('.cb-launch')).toBeInViewport({ ratio: 1 });
        });
      }
    }
  });
}

test.describe('phone screenshot gallery', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('tapping a screenshot shows it at full size, and tapping again fits it back', async ({ page }) => {
    await openPage(page, '/');
    await page.locator('.feat-media').first().click();
    const img = page.locator('#lightbox img');
    await expect(page.locator('#lightbox')).toHaveClass(/zoomable/);
    const fitted = await img.evaluate((i) => i.clientWidth);
    expect(fitted).toBeLessThanOrEqual(390);

    await img.tap();
    await expect(page.locator('#lightbox')).toHaveClass(/\bzoom\b/);
    expect(await img.evaluate((i) => i.clientWidth)).toBe(await img.evaluate((i) => i.naturalWidth));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await img.tap();
    await expect(page.locator('#lightbox')).not.toHaveClass(/\bzoom\b/);
    expect(await img.evaluate((i) => i.clientWidth)).toBe(fitted);
  });
});
