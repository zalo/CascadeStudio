// @ts-check
const { defineConfig } = require('@playwright/test');

// Override with CS_TEST_PORT if another service already occupies 8080
const PORT = parseInt(process.env.CS_TEST_PORT || '8080', 10);

// On machines where headless Chromium cannot create a (SwiftShader) WebGL
// context, run headful against an X server instead:
//   CS_TEST_HEADFUL=1 DISPLAY=:99 npx playwright test
const HEADLESS = !process.env.CS_TEST_HEADFUL;

// CS_TEST_OCCT_EXCEPTIONS=js runs the whole suite on the JS-emulated-
// exceptions DEBUG build of OCCT (cascadestudio-jseh.wasm) by seeding
// localStorage['cascade-occt-exceptions'] in every page — the same switch a
// user flips with ?occtexceptions=js.
const OCCT_EXCEPTIONS = process.env.CS_TEST_OCCT_EXCEPTIONS === 'js' ? 'js' : null;

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
    ...(OCCT_EXCEPTIONS ? { storageState: { cookies: [], origins: [{
      origin: `http://localhost:${PORT}`,
      localStorage: [{ name: 'cascade-occt-exceptions', value: OCCT_EXCEPTIONS }],
    }] } } : {}),
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
