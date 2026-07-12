import { chromium, firefox, webkit } from "playwright";

const baseUrl = process.env.HYPEFORGE_TEST_URL ?? "http://localhost:3001";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const targets = [
  { name: "Chrome/Chromium", launch: () => chromium.launch({ headless: true, executablePath: chromePath }) },
  { name: "Firefox", launch: () => firefox.launch({ headless: true }) },
  { name: "Safari/WebKit", launch: () => webkit.launch({ headless: true }) },
];
const results = [];

for (const target of targets) {
  const browser = await target.launch();
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.goto(`${baseUrl}/v2`, { waitUntil: "networkidle" });
      await page.getByLabel("Their job or role").fill("Product Manager");
      const generateEnabled = await page.getByRole("button", { name: "Generate 3 compliments" }).isEnabled();
      await page.getByRole("button", { name: "Open compliment guide" }).click();
      await page.keyboard.press("Escape");
      const layout = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
      }));
      if (!generateEnabled || layout.scrollWidth !== layout.innerWidth || layout.dialogs !== 0 || consoleErrors.length > 0) {
        throw new Error(JSON.stringify({ generateEnabled, layout, consoleErrors }));
      }
      results.push({ browser: target.name, width: viewport.width, ok: true });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
