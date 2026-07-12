import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const baseUrl = process.env.HYPEFORGE_TEST_URL ?? "http://localhost:3001";
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const violations = [];

async function audit(name, page, include) {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (include) builder.include(include);
  const result = await builder.analyze();
  for (const violation of result.violations) {
    violations.push({
      page: name,
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(" ")).slice(0, 5),
    });
  }
}

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopContext.newPage();
  await desktop.goto(`${baseUrl}/v2`, { waitUntil: "networkidle" });
  await audit("generator desktop", desktop, "main");
  await desktop.getByRole("button", { name: "Switch to dark mode" }).click();
  await desktop.waitForTimeout(250);
  await audit("generator desktop dark", desktop, "main");
  await desktop.getByRole("button", { name: "Switch to light mode" }).click();
  await desktop.getByRole("button", { name: "Open compliment guide" }).click();
  await audit("compliment guide dialog", desktop, '[role="dialog"]');

  const mobileContext = await browser.newContext({ viewport: { width: 320, height: 800 } });
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${baseUrl}/v2`, { waitUntil: "networkidle" });
  await audit("generator mobile", mobile, "main");

  const guideContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const guide = await guideContext.newPage();
  await guide.goto(`${baseUrl}/compliment-guide`, { waitUntil: "networkidle" });
  await audit("public compliment guide", guide, "main");
} finally {
  await browser.close();
}

if (violations.length > 0) {
  console.error(JSON.stringify({ ok: false, violations }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, audited: 5 }, null, 2));
}
