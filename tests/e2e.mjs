// End-to-end test in headless Chrome: every demo sample, both sources (base64 and
// URL), nested ZIP entries, the sandbox and sanitising, destroy, and OutSystems mode
// (AMD define + throwing RequireJS, every library a Required Script, nothing fetched).
//
// Usage: npm run e2e            (CHROME_PATH overrides the Chrome location)
//        npm run e2e -- --shots (also saves the README screenshots in docs/img/)
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { start } from "../scripts/serve.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8766;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.argv.includes("--shots");
const EXPECTED = {
  "report.pdf": "pdf", "proposal.docx": "docx", "sales.xlsx": "sheet", "customers.csv": "sheet", "landscape.png": "image",
  "chart.svg": "image", "project.zip": "zip", "OrderService.cs": "code", "api-response.json": "json", "settings.xml": "xml",
  "server.log": "text", "README.md": "markdown", "invoice.html": "html", "chime.wav": "audio", "clip.webm": "video",
  "scan": "pdf", "slides.pptx": "binary"
};

const failures = [];
const check = (ok, label, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures.push(label);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

const server = await start(PORT);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new"
});

function watch(page) {
  const w = { errors: [], dialogs: [], requests: [], missing: [] };
  // The sandbox reports each script it blocks: that is the expected outcome for invoice.html.
  // HTTP failures are listed by URL from the response event instead of the console's generic line.
  const expected = /Blocked script execution in 'about:srcdoc'|Failed to load resource/;
  page.on("pageerror", e => w.errors.push(e.message.split("\n")[0]));
  page.on("console", m => { if (m.type() === "error" && !expected.test(m.text())) w.errors.push(m.text().split("\n")[0]); });
  page.on("response", r => { if (r.status() >= 400) w.missing.push(r.status() + " " + r.url().replace(BASE, "")); });
  page.on("dialog", d => { w.dialogs.push(d.message()); d.dismiss(); });
  page.on("request", r => w.requests.push(r.url()));
  return w;
}

try {
  /* ---------------- demo: every sample, base64 then URL ---------------- */
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 860 });
  const w = watch(page);
  await page.goto(`${BASE}/demo/`, { waitUntil: "networkidle0" });
  const libs = w.requests.filter(u => /\/dist\//.test(u)).map(u => u.split("/").pop()).sort();
  check(libs.join() === "anyviewer.js,pdfjs.js,pdfjsworker.js", "at start only the core and pdf.js are loaded", libs.join());

  const setSource = source => page.evaluate(source => {
    const btn = [...document.querySelectorAll(".seg button")].find(b => b.textContent === (source === "url" ? "URL" : "Base64"));
    if (btn && btn.getAttribute("aria-pressed") !== "true") btn.click();
  }, source);
  for (const source of ["base64", "url"]) {
    for (const [name, kind] of Object.entries(EXPECTED)) {
      await setSource(source);
      const got = await page.evaluate(name => demo.showSample(name), name);
      check(got === kind, `demo ${source.padEnd(6)} ${name}`, got === kind ? "" : `got ${got}`);
    }
  }
  await setSource("base64");

  // content checks on a few renderers
  await page.evaluate(() => demo.showSample("report.pdf"));
  await page.waitForSelector(".av-page canvas", { timeout: 15000 });
  check(await page.$eval(".av-info", e => /Page 1 \/ 3/.test(e.textContent)), "pdf shows the page counter");
  await page.evaluate(() => demo.showSample("sales.xlsx"));
  const tabs = await page.$$eval(".av-tab", es => es.map(e => e.textContent));
  check(tabs.join() === "Sales H1 2026,Products,Kiln log", "xlsx has one tab per sheet", tabs.join());
  check(await page.$$eval(".av-sheet td", es => es.some(e => e.textContent === "<script>alert(1)</script>")) ||
    await page.evaluate(() => { document.querySelectorAll(".av-tab")[1].click(); return [...document.querySelectorAll(".av-sheet td")].some(e => e.textContent === "<script>alert(1)</script>"); }),
  "xlsx cell markup is shown as text");
  await page.evaluate(() => [...document.querySelectorAll(".av-tab")].pop().click());
  check(await page.$eval(".av-note", e => /5000 of 6201/.test(e.textContent)), "large sheet shows the row limit note");
  await page.evaluate(() => demo.showSample("invoice.html"));
  check(await page.$eval("iframe.av-frame", f => f.getAttribute("sandbox") === ""), "html is in a sandboxed iframe without permissions");
  await page.evaluate(() => demo.showSample("README.md"));
  check(await page.$eval(".av-md", e => !e.querySelector("script,[onerror]") && !!e.querySelector("table")), "markdown is rendered and sanitised");

  // ZIP: open every entry in the nested viewer
  await page.evaluate(() => demo.showSample("project.zip"));
  await page.waitForSelector(".av-zip-item");
  const entries = await page.$$eval(".av-zip-item:not(.av-zip-dir)", es => es.map(e => e.textContent));
  check(entries.length === 8, "zip lists 8 files", String(entries.length));
  for (let i = 0; i < entries.length; i++) {
    await page.evaluate(i => document.querySelectorAll(".av-zip-item:not(.av-zip-dir)")[i].click(), i);
    const ok = await page.waitForFunction(() => {
      const v = document.querySelector(".av-zip-view .av");
      return v && v.querySelector("canvas,table,.docx,img.av-img,.av-md,.av-pre") && !v.querySelector(".av-spin");
    }, { timeout: 15000 }).then(() => true, () => false);
    check(ok, `zip entry ${entries[i].replace(/\s*[\d.]+ (B|KB|MB)$/, "")}`);
  }

  await page.evaluate(() => AnyViewer.destroy("viewer"));
  check(await page.$eval("#viewer", e => e.children.length === 0), "destroy empties the host");
  check(w.dialogs.length === 0, "no script from a sample ran (no dialogs)", w.dialogs.join(" | "));
  check(w.errors.length === 0, "no page errors in the demo", w.errors.join(" | "));
  check(w.missing.every(u => /\/demo\/x$|favicon/.test(u)), "no failed requests besides README.md's broken image", [...new Set(w.missing)].join(" | "));

  /* ---------------- OutSystems mode ---------------- */
  const os = await browser.newPage();
  await os.setViewport({ width: 1100, height: 700 });
  const ow = watch(os);
  await os.goto(`${BASE}/tests/outsystems-mode.html`, { waitUntil: "networkidle0" });
  check((await os.evaluate(() => window.globalsAtLoad)).length === 0, "Required Scripts only register at page load (no globals)");
  for (const [name, kind] of Object.entries(EXPECTED)) {
    const got = await os.evaluate(n => run(n), name);
    check(got === kind, `outsystems ${name}`, got === kind ? "" : `got ${got}`);
  }
  await os.evaluate(() => run("project.zip"));
  await os.waitForSelector(".av-zip-item");
  await os.evaluate(() => [...document.querySelectorAll(".av-zip-item")].find(e => /proposal/.test(e.textContent)).click());
  check(await os.waitForSelector(".av-zip-view .docx", { timeout: 15000 }).then(() => true, () => false), "outsystems: docx inside zip (JSZip never calls require)");
  const state = await os.evaluate(() => ({ amd: window.__amdCalls, req: window.__requireCalls }));
  check(state.amd === 0, "no library registered itself with AMD define", String(state.amd));
  check(state.req.length === 0, "no library called the RequireJS require", state.req.join());
  check(!ow.requests.some(u => u.includes("/missing/")), "nothing fetched from scriptsBaseUrl");
  check(ow.errors.length === 0, "no page errors in OutSystems mode", ow.errors.join(" | "));
  check(ow.missing.every(u => /\/x$|favicon/.test(u)), "no failed requests in OutSystems mode", [...new Set(ow.missing)].join(" | "));

  /* ---------------- screenshots for the README ---------------- */
  if (SHOTS) {
    const shot = await browser.newPage();
    const out = n => path.join(root, "docs", "img", n);
    await shot.setViewport({ width: 1440, height: 900 });
    for (const [file, img] of [["report.pdf", "pdf.png"], ["sales.xlsx", "xlsx.png"], ["project.zip", "zip.png"]]) {
      await shot.goto(`${BASE}/demo/?file=${encodeURIComponent(file)}&lang=en`, { waitUntil: "networkidle0" });
      if (file === "project.zip") {
        await shot.waitForSelector(".av-zip-item");
        await shot.evaluate(() => [...document.querySelectorAll(".av-zip-item")].find(e => /report/.test(e.textContent)).click());
        await shot.waitForSelector(".av-zip-view canvas", { timeout: 15000 });
      }
      await wait(1200);
      await shot.screenshot({ path: out(img), type: "png" });
    }
    await shot.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await shot.goto(`${BASE}/demo/?file=report.pdf&lang=en`, { waitUntil: "networkidle0" });
    await wait(1200);
    await shot.screenshot({ path: out("mobile.png"), type: "png" });
    console.log("screenshots saved in docs/img/");
  }
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
