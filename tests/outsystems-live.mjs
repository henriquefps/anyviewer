// Live test of the AnyViewer_Demo OutSystems module once it is published: uploads
// every sample through the screen's Upload widget and reads the status line that the
// block's OnRendered / OnError events write ("Rendered as: <type>" or "Error: ...").
// Then loads one of the module's own scripts through the FileUrl input.
//
// Usage: node tests/outsystems-live.mjs https://<your-environment>/AnyViewer_Demo/
//        (CHROME_PATH overrides the Chrome location; screenshots go to screenshots/live/)
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.argv[2];
if (!URL) { console.error("Usage: node tests/outsystems-live.mjs <AnyViewer_Demo URL>"); process.exit(2); }
const SAMPLES = ["landscape.png", "chart.svg", "report.pdf", "scan", "sales.xlsx", "customers.csv", "api-response.json",
  "OrderService.cs", "README.md", "invoice.html", "proposal.docx", "project.zip", "chime.wav", "clip.webm", "slides.pptx"];
const shots = path.join(root, "screenshots", "live");

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new"
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const errors = [], failed = [], dialogs = [];
  page.on("pageerror", e => errors.push("PAGEERR " + e.message.split("\n")[0]));
  page.on("console", m => { if (m.type() === "error" && !/Blocked script execution in 'about:srcdoc'/.test(m.text())) errors.push(m.text().split("\n")[0]); });
  page.on("response", r => { if (r.status() >= 400) failed.push(r.status() + " " + r.url()); });
  page.on("dialog", d => { dialogs.push(d.message()); d.dismiss(); });

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("input[type=file]", { timeout: 30000 });
  fs.mkdirSync(shots, { recursive: true });

  const status = () => page.evaluate(() => {
    const m = document.body.innerText.match(/(Rendered as: \w+|Error: [^\n]+|Pick a file or enter a URL\.|Loading [^\n]+)/);
    return m ? m[1] : "";
  });
  const results = [];
  for (const [i, f] of SAMPLES.entries()) {
    const before = await status();
    const input = await page.$("input[type=file]");
    await input.uploadFile(path.join(root, "demo", "samples", f));
    let s = before;
    for (let t = 0; t < 60 && (s === before || s.startsWith("Loading") || s.startsWith("Pick")); t++) {
      await new Promise(r => setTimeout(r, 500));
      s = await status();
      if (i > 0 && s === before && /Rendered as/.test(s)) break; // same type as the previous file
    }
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(shots, `${String(i).padStart(2, "0")}-${f}.png`) });
    const viewer = await page.evaluate(() => {
      const av = document.querySelector(".av");
      if (!av) return "no .av";
      return [av.querySelector(".av-badge")?.textContent || "",
        av.querySelector("canvas,table,.docx,img.av-img,.av-md,.av-pre,iframe,.av-zip,video,audio,.av-msg")?.className || ""].join(" | ");
    });
    results.push(`${f.padEnd(18)} ${s.padEnd(22)} ${viewer}`);
  }

  // URL path: one of the app's own scripts, shown as code
  const urlField = await page.$("input[type=text], input:not([type])");
  if (urlField) {
    const app = new globalThis.URL(URL).pathname.replace(/\/$/, "");
    await urlField.click({ clickCount: 3 });
    await urlField.type(`${app}/scripts/AnyViewer.marked.js`);
    for (const b of await page.$$("button")) if ((await b.evaluate(e => e.textContent.trim())) === "Load URL") { await b.click(); break; }
    await new Promise(r => setTimeout(r, 3000));
    results.push(`${"URL marked.js".padEnd(18)} ${(await status()).padEnd(22)}`);
    await page.screenshot({ path: path.join(shots, "99-url.png") });
  }

  console.log(results.join("\n"));
  console.log("dialogs:", dialogs);
  console.log("http >= 400:", [...new Set(failed)]);
  console.log("errors:", [...new Set(errors)]);
} finally {
  await browser.close();
}
