// @ts-check
const { defineConfig } = require('@playwright/test');

// Override with CS_TEST_PORT if another service already occupies 8080
const PORT = parseInt(process.env.CS_TEST_PORT || '8080', 10);

// On machines where headless Chromium cannot create a (SwiftShader) WebGL
// context, run headful against an X server instead:
//   CS_TEST_HEADFUL=1 DISPLAY=:99 npx playwright test
const HEADLESS = !process.env.CS_TEST_HEADFUL;

module.exports = defineConfig({
  testDir: './test',
  timeout: 120000,
  expect: { timeout: 30000 },
  fullyParallel: true,
  workers: 4,
  retries: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: HEADLESS,
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: `npx http-server ./packages/cascade-studio/dist -p ${PORT} -c-1 --silent`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
