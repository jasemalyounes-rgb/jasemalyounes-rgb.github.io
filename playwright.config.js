// Tests run against a local static server (tests/serve.js) that mimics GitHub Pages.
// Locally they use the installed Google Chrome; CI installs Playwright's Chromium.
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  // each worker is a full Chrome on pages with heavy animation; more than a few
  // at once starves memory and tabs crash ("Target crashed")
  workers: 3,
  retries: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.CI ? undefined : 'chrome',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `node tests/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
