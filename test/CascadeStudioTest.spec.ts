import { config } from 'folio';
import { it, expect } from "@playwright/test";

config.timeout = 60000;

it("compares page screenshot", async ({ page, browserName }) => {
    let start = process.hrtime();
    page.on('pageerror', async msg => {
        console.log(msg.message);
        console.log(msg.stack);
    });
    await page.goto("http://localhost:8000/", { waitUntil: 'load' });
    await page.waitForFunction(() =>  window.workerWorking, null, { timeout: config.timeout - 3000 });
    await page.waitForFunction(() => !window.workerWorking, null, { timeout: config.timeout - 3000 });
    await page.waitForTimeout(1000);
    let screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot(`test-${browserName}.png`, { threshold: 0.1 });
    console.log("Test Completed in " + (process.hrtime(start))+"s");
});
