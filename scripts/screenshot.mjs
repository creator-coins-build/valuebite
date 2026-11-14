import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "/tmp/valuebite.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("saved", out);
