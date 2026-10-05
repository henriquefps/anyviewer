// Renders the AnyViewer icon and block preview PNGs with headless Chrome.
// Run from this folder: node render.cjs (CHROME_PATH overrides the Chrome location)
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ICON_SIZES = [1024, 512, 256, 128, 64, 32];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  const svg = fs.readFileSync(path.join(__dirname, "icon.svg"), "utf8");

  // Each size is rendered from the vector source, not scaled from a bitmap
  for (const size of ICON_SIZES) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(__dirname, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
  }

  // Block preview at 1x and 2x, transparent outside the viewer frame
  for (const scale of [1, 2]) {
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: scale });
    await page.goto("file:///" + path.join(__dirname, "preview.html").replace(/\\/g, "/"));
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.$("#shot");
    await shot.screenshot({ path: path.join(__dirname, scale === 1 ? "block-preview.png" : "block-preview@2x.png"), omitBackground: true });
  }
  await browser.close();
  console.log("done");
})();
