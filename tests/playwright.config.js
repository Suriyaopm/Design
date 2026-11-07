// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use the locally installed Chromium if the version Playwright expects is not downloaded.
function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && path.join(base, dir, 'chrome-win64', 'chrome.exe');
  return exe && fs.existsSync(exe) ? exe : undefined;
}
const executablePath = chromiumPath();

module.exports = defineConfig({
  testDir: '.',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/'),
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
});
