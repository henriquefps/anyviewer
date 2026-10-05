// Generates the demo's sample files in demo/samples/. Every sample is made from
// code (no binary is copied from anywhere) and all the content is fictitious.
//
// Usage: npm run samples
// The video (clip.webm) is recorded in headless Chrome; set CHROME_PATH if
// Chrome is not in its default location, or it is skipped.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "demo", "samples");
// The same browser builds that dist/ wraps; the package is "type": "module", so
// they are evaluated as CommonJS by hand instead of with require()
function umd(file) {
  const module = { exports: {} };
  new Function("module", "exports", "require", fs.readFileSync(path.join(ROOT, "node_modules", file), "utf8"))(module, module.exports, require);
  return module.exports;
}
const XLSX = umd("xlsx/dist/xlsx.full.min.js");
const JSZip = umd("jszip/dist/jszip.min.js");
fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => { fs.writeFileSync(path.join(OUT, name), data); };

/* ------------------------------------------------------------------ */
/* PNG: a landscape drawn pixel by pixel                               */
/* ------------------------------------------------------------------ */
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function landscape() {
  const W = 960, H = 600, horizon = 380;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const ridge = (x, f, a, o) => o + Math.sin(x * f) * a + Math.sin(x * f * 2.3 + 1.7) * a * 0.45 + Math.sin(x * f * 5.1 + 0.3) * a * 0.18;
  const sky = (x, y) => {
    const t = y / horizon;
    let c = t < 0.6 ? mix([28, 54, 120], [236, 128, 96], t / 0.6) : mix([236, 128, 96], [253, 210, 140], (t - 0.6) / 0.4);
    const d = Math.hypot(x - 640, y - 300);
    if (d < 52) c = mix([255, 244, 214], c, Math.max(0, (d - 44) / 8));
    else if (d < 160) c = mix(c, [255, 220, 160], 0.35 * (1 - (d - 52) / 108));
    return c;
  };
  return png(W, H, (x, y) => {
    if (y < horizon) {
      const far = ridge(x, 0.011, 34, 300), near = ridge(x + 400, 0.017, 46, 345);
      if (y > near) return mix([52, 46, 82], [36, 32, 60], (y - near) / 60);
      if (y > far) return mix([112, 86, 128], [86, 66, 108], (y - far) / 80);
      return sky(x, y);
    }
    // the lake mirrors the sky and hills, darker and with ripples
    const my = horizon - (y - horizon) * 1.1 - 1;
    const rx = x + Math.sin(y * 0.9) * (y - horizon) * 0.04;
    const far = ridge(rx, 0.011, 34, 300), near = ridge(rx + 400, 0.017, 46, 345);
    let c = my > near ? [44, 38, 70] : my > far ? [98, 76, 116] : sky(rx, Math.max(0, my));
    c = mix(c, [16, 30, 62], 0.35 + 0.4 * (y - horizon) / (H - horizon));
    if ((y + Math.floor(x / 37)) % 9 === 0) c = mix(c, [255, 255, 255], 0.08);
    return c;
  });
}
write("landscape.png", landscape());

/* ------------------------------------------------------------------ */
/* SVG: a chart, with a script that must never run                     */
/* ------------------------------------------------------------------ */
const bars = [42, 58, 51, 74, 69, 88];
write("chart.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" font-family="Segoe UI, Roboto, sans-serif">
  <rect width="640" height="400" rx="16" fill="#ffffff"/>
  <text x="32" y="48" font-size="22" font-weight="700" fill="#1d2330">Monthly active users</text>
  <text x="32" y="74" font-size="14" fill="#5f6b7a">Thousands, first half of 2026 (fictitious)</text>
  <g stroke="#e3e7ec">${[0, 1, 2, 3, 4].map(i => `<line x1="32" x2="608" y1="${340 - i * 60}" y2="${340 - i * 60}"/>`).join("")}</g>
  ${bars.map((v, i) => `<rect x="${60 + i * 92}" y="${340 - v * 2.6}" width="56" height="${v * 2.6}" rx="6" fill="${i === 5 ? "#1068eb" : "#9ec2f7"}"/>
  <text x="${88 + i * 92}" y="${330 - v * 2.6}" font-size="13" text-anchor="middle" fill="#1d2330">${v}</text>
  <text x="${88 + i * 92}" y="364" font-size="13" text-anchor="middle" fill="#5f6b7a">${["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i]}</text>`).join("\n  ")}
  <script>alert("This script must not run")</script>
</svg>
`);

/* ------------------------------------------------------------------ */
/* PDF: a three-page report with a chart and a table                   */
/* ------------------------------------------------------------------ */
function pdf(pages) {
  const objs = [];
  const add = o => (objs.push(o), objs.length);
  const catalog = add(null), pagesObj = add(null);
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids = pages.map(content => {
    const stream = Buffer.from(content, "latin1");
    const c = add(`<< /Length ${stream.length} >>\nstream\n${content}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Contents ${c} 0 R /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> >>`);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R /ViewerPreferences << /DisplayDocTitle true >> >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  const info = add("<< /Title (Quarterly report Q2 2026) /Author (AnyViewer demo) >>");
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
const esc = s => s.replace(/[\\()]/g, m => "\\" + m);
const T = (x, y, size, s, f = "F1", rgb = "0.11 0.14 0.19") => `BT /${f} ${size} Tf ${rgb} rg ${x} ${y} Td (${esc(s)}) Tj ET\n`;
const R = (x, y, w, h, rgb) => `${rgb} rg ${x} ${y} ${w} ${h} re f\n`;
const L = (x1, y1, x2, y2, rgb = "0.87 0.89 0.91") => `${rgb} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const para = (x, y, lines, size = 11) => lines.map((s, i) => T(x, y - i * (size * 1.5), size, s, "F1", "0.25 0.29 0.34")).join("");
const footer = n => L(56, 60, 539, 60) + T(56, 44, 9, "Atlantic Ceramics, Lda. (fictitious) - Quarterly report Q2 2026", "F1", "0.45 0.5 0.55") + T(520, 44, 9, String(n), "F1", "0.45 0.5 0.55");

const quarters = [["Q3 2025", 1.82], ["Q4 2025", 2.05], ["Q1 2026", 1.94], ["Q2 2026", 2.41]];
const page1 = R(0, 742, 595, 100, "0.063 0.408 0.922") +
  T(56, 800, 26, "Quarterly report", "F2", "1 1 1") + T(56, 772, 13, "Q2 2026 - Atlantic Ceramics, Lda.", "F1", "0.85 0.9 1") +
  T(56, 700, 15, "Summary", "F2") +
  para(56, 676, [
    "Revenue grew 24% over the previous quarter, driven by the new glazed tile range",
    "and by the opening of two distribution partners in the north. Margins held steady",
    "despite higher energy costs, and the backlog at the end of June covers eleven weeks",
    "of production."
  ]) +
  T(56, 590, 15, "Revenue by quarter (EUR million)", "F2") +
  L(76, 360, 520, 360, "0.6 0.64 0.7") +
  quarters.map(([q, v], i) => R(100 + i * 105, 360, 62, v * 90, i === 3 ? "0.063 0.408 0.922" : "0.62 0.76 0.97") +
    T(112 + i * 105, 368 + v * 90, 11, v.toFixed(2), "F2") + T(104 + i * 105, 342, 10, q, "F1", "0.4 0.45 0.5")).join("") +
  T(56, 290, 15, "Highlights", "F2") +
  para(70, 266, [
    "-  Glazed range: 31% of sales in its second quarter on the market.",
    "-  Export share up from 38% to 44%, mostly Spain and France.",
    "-  Kiln 3 retrofit finished on time; gas use per m2 down 9%.",
    "-  Two new partners in Braga and Viseu signed in May."
  ]) + footer(1);

const rows = [["Wall tiles", "412,300", "0.96", "+12%"], ["Floor tiles", "538,900", "1.07", "+18%"], ["Glazed range", "301,200", "0.74", "+64%"],
  ["Outdoor", "122,700", "0.31", "+6%"], ["Custom orders", "48,100", "0.22", "+41%"], ["Total", "1,423,200", "3.30", "+24%"]];
const page2 = T(56, 780, 18, "Sales by product line", "F2") +
  para(56, 752, ["Square metres sold and revenue in the quarter, compared with Q1 2026."]) +
  R(56, 690, 483, 26, "0.94 0.95 0.97") +
  ["Product line", "m2 sold", "EUR million", "vs Q1"].map((hd, i) => T([66, 250, 350, 460][i], 699, 11, hd, "F2")).join("") +
  rows.map((r, j) => {
    const y = 664 - j * 28;
    return L(56, y - 8, 539, y - 8) + r.map((c, i) => T([66, 250, 350, 460][i], y, 11, c, j === rows.length - 1 ? "F2" : "F1",
      i === 3 ? "0.13 0.55 0.23" : "0.11 0.14 0.19")).join("");
  }).join("") +
  T(56, 440, 15, "Outlook", "F2") +
  para(56, 416, [
    "The third quarter is usually slower because of the August shutdown. Orders already",
    "booked point to revenue between 2.1 and 2.3 million euros. The board approved the",
    "second phase of the kiln programme, to start in October."
  ]) + footer(2);

const page3 = T(56, 780, 18, "Notes", "F2") +
  para(56, 752, [
    "1. All figures are unaudited and rounded.",
    "2. Atlantic Ceramics, Lda. is a fictitious company created for this demo.",
    "3. This PDF was generated by code, with hand-written page content streams.",
    "",
    "AnyViewer renders each page on a canvas with pdf.js, only when the page scrolls",
    "into view, so long documents open quickly. Use the zoom buttons in the toolbar;",
    "the page counter follows the scroll position."
  ]) + footer(3);
const reportPdf = pdf([page1, page2, page3]);
write("report.pdf", reportPdf);
write("scan", reportPdf); // no extension: the type comes from the bytes

/* ------------------------------------------------------------------ */
/* Spreadsheets                                                        */
/* ------------------------------------------------------------------ */
const regions = ["North", "Centre", "Lisbon", "Alentejo", "Algarve"];
const sales = [["Month", "Region", "Units", "Unit price (EUR)", "Revenue (EUR)"]];
for (let m = 0; m < 6; m++) regions.forEach((r, i) => {
  const units = 800 + ((m * 7 + i * 13) % 11) * 95 + i * 40;
  const price = [11.9, 12.4, 13.5, 10.8, 12.9][i];
  sales.push([new Date(2026, m, 1, 12), r, units, price, Math.round(units * price * 100) / 100]);
});
const products = [["SKU", "Product", "Size (cm)", "Colour", "Stock (m2)", "Discontinued"],
  ["AC-1001", "Lisboa wall tile", "20 x 20", "White", 1240, false], ["AC-1002", "Porto floor tile", "60 x 60", "Grey", 3810, false],
  ["AC-2010", "Douro glazed", "15 x 15", "Teal", 960, false], ["AC-2011", "Douro glazed", "15 x 15", "Ochre", 410, false],
  ["AC-3005", "Minho outdoor", "45 x 45", "Sand", 2200, false], ["AC-0999", "Classic azulejo", "14 x 14", "Blue / white", 75, true],
  ["AC-4100", "<script>alert(1)</script>", "n/a", "Escaped, not run", 0, true]];
const log = [["Timestamp", "Machine", "Temperature (C)", "Status"]];
for (let i = 0; i < 6200; i++) log.push([new Date(2026, 5, 1, 0, i * 7), "Kiln " + (1 + (i % 3)), 1050 + Math.round(Math.sin(i / 40) * 60), i % 997 === 0 ? "Alarm" : "OK"]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sales, { cellDates: true, dateNF: "yyyy-mm" }), "Sales H1 2026");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(products), "Products");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(log, { cellDates: true, dateNF: "yyyy-mm-dd hh:mm" }), "Kiln log");
write("sales.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true, compression: true }));

write("customers.csv", "\ufeffid;name;city;country;since\n" + [
  [1, "Ana Ribeiro", "Lisboa", "Portugal", "2019-03-11"], [2, "João Sá", "Porto", "Portugal", "2020-07-02"],
  [3, "Maria González", "Sevilla", "España", "2021-01-19"], [4, "Élodie Martin", "Bordeaux", "France", "2022-10-05"],
  [5, "Søren Nielsen", "Aarhus", "Danmark", "2023-04-27"], [6, "Zoë Clarke", "Bristol", "United Kingdom", "2024-12-01"]
].map(r => r.join(";")).join("\n") + "\n");

/* ------------------------------------------------------------------ */
/* Text, code and data                                                  */
/* ------------------------------------------------------------------ */
write("OrderService.cs", `using System;
using System.Collections.Generic;
using System.Linq;

namespace AtlanticCeramics.Orders
{
    /// <summary>Prices and validates customer orders.</summary>
    public sealed class OrderService
    {
        private const decimal VatRate = 0.23m;
        private readonly IDictionary<string, decimal> _prices;

        public OrderService(IDictionary<string, decimal> prices) =>
            _prices = prices ?? throw new ArgumentNullException(nameof(prices));

        public decimal Total(IEnumerable<OrderLine> lines, bool includeVat = true)
        {
            var net = lines.Sum(l => _prices[l.Sku] * l.SquareMetres);
            return Math.Round(includeVat ? net * (1 + VatRate) : net, 2);
        }

        public IReadOnlyList<string> Validate(IEnumerable<OrderLine> lines)
        {
            var errors = new List<string>();
            foreach (var line in lines)
            {
                if (!_prices.ContainsKey(line.Sku)) errors.Add($"Unknown SKU {line.Sku}");
                if (line.SquareMetres <= 0) errors.Add($"Quantity must be positive for {line.Sku}");
            }
            return errors;
        }
    }

    public record OrderLine(string Sku, decimal SquareMetres);
}
`);

write("api-response.json", JSON.stringify({
  status: "ok", generatedAt: "2026-07-01T09:30:00Z",
  page: { number: 1, size: 3, total: 41 },
  items: [
    { id: "ORD-10421", customer: "Ana Ribeiro", lines: 3, totalEur: 1820.4, paid: true, tags: ["glazed", "priority"] },
    { id: "ORD-10422", customer: "João Sá", lines: 1, totalEur: 412.0, paid: false, tags: [] },
    { id: "ORD-10423", customer: "Maria González", lines: 5, totalEur: 5310.75, paid: true, tags: ["export"] }
  ],
  links: { self: "/api/orders?page=1", next: "/api/orders?page=2" }
}));

write("settings.xml", `<?xml version="1.0" encoding="utf-8"?>
<!-- Plant configuration (fictitious) -->
<plant id="AC-01" name="Atlantic Ceramics - Aveiro">
  <kilns>
    <kiln id="1" maxTemperature="1180" fuel="natural-gas" />
    <kiln id="2" maxTemperature="1180" fuel="natural-gas" />
    <kiln id="3" maxTemperature="1220" fuel="hydrogen-blend" retrofitted="2026-05-30" />
  </kilns>
  <shifts timezone="Europe/Lisbon">
    <shift name="morning" start="06:00" end="14:00" />
    <shift name="afternoon" start="14:00" end="22:00" />
  </shifts>
  <alerts email="maintenance@example.com" temperatureDelta="45" />
</plant>
`);

const logLines = [];
for (let i = 0; i < 400; i++) {
  const t = new Date(Date.UTC(2026, 6, 1, 8, 0, i * 9)).toISOString().replace("T", " ").slice(0, 19);
  const lvl = i % 53 === 0 ? "ERROR" : i % 17 === 0 ? "WARN " : "INFO ";
  const msg = lvl === "ERROR" ? "Payment gateway timeout after 30000 ms (order ORD-" + (10400 + i) + ")"
    : lvl === "WARN " ? "Slow query: GetOrders took " + (800 + i) + " ms"
      : ["GET /api/orders 200", "POST /api/orders 201", "GET /api/products 200", "GET /health 200"][i % 4] + " " + (12 + (i * 7) % 90) + " ms";
  logLines.push(`${t} ${lvl} ${msg}`);
}
write("server.log", logLines.join("\n") + "\n");

write("README.md", `# Tile Configurator

A small web app to design a tiled wall and order the tiles. *All content is fictitious.*

> AnyViewer renders Markdown with **marked** and sanitises the HTML with **DOMPurify**, so raw HTML in a Markdown file can't run scripts.

## Features

- Drag tiles onto a grid and rotate them
- Price and quantity update as you go
- Export the design as **PDF** or **PNG**

## Prices

| Range        | Size     | EUR / m² |
|:-------------|:---------|---------:|
| Lisboa       | 20 × 20  |    11.90 |
| Douro glazed | 15 × 15  |    18.40 |
| Minho        | 45 × 45  |    14.25 |

## Getting started

\`\`\`bash
npm install
npm start   # http://localhost:3000
\`\`\`

\`\`\`js
const total = lines.reduce((sum, l) => sum + l.price * l.m2, 0);
console.log(total.toFixed(2));
\`\`\`

## Roadmap

1. Colour variations per tile
2. Share a design by link
3. ~~Internet Explorer support~~

<img src="x" onerror="alert('This must not run')">
<script>alert('Neither must this')</script>
`);

write("invoice.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice INV-2026-0187</title>
<style>
  body { font: 15px/1.5 "Segoe UI", Roboto, sans-serif; color: #1d2330; margin: 40px; }
  h1 { color: #1068eb; margin: 0 0 4px; }
  .muted { color: #5f6b7a; }
  table { border-collapse: collapse; width: 100%; margin-top: 24px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3e7ec; }
  th:last-child, td:last-child { text-align: right; }
  tfoot td { font-weight: 700; border-bottom: 0; }
  .box { margin-top: 28px; padding: 12px 16px; border-radius: 8px; background: #e8f3e9; color: #1b5e20; }
</style>
</head>
<body>
  <h1>Invoice INV-2026-0187</h1>
  <div class="muted">Atlantic Ceramics, Lda. (fictitious) · 1 July 2026</div>
  <table>
    <thead><tr><th>Item</th><th>m²</th><th>EUR</th></tr></thead>
    <tbody>
      <tr><td>Douro glazed, teal</td><td>24</td><td>441.60</td></tr>
      <tr><td>Porto floor tile, grey</td><td>58</td><td>826.50</td></tr>
      <tr><td>Delivery</td><td></td><td>60.00</td></tr>
    </tbody>
    <tfoot><tr><td>Total (VAT included)</td><td></td><td>1,633.62</td></tr></tfoot>
  </table>
  <div class="box" id="sandbox">Scripts are blocked: this page is shown in a sandboxed frame.</div>
  <script>document.getElementById("sandbox").textContent = "Scripts ran! The sandbox is not working.";</script>
</body>
</html>
`);

/* ------------------------------------------------------------------ */
/* Audio: a short chime as 16-bit PCM WAV                              */
/* ------------------------------------------------------------------ */
function wav() {
  const rate = 22050, seconds = 4, n = rate * seconds;
  const data = Buffer.alloc(n * 2);
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    notes.forEach((f, k) => {
      const start = k * 0.45;
      if (t >= start) { const d = t - start; s += Math.sin(2 * Math.PI * f * d) * Math.exp(-d * 2.2) * 0.22 + Math.sin(4 * Math.PI * f * d) * Math.exp(-d * 4) * 0.05; }
    });
    data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767 | 0, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
write("chime.wav", wav());

/* ------------------------------------------------------------------ */
/* Office files: a Word proposal, and a PowerPoint the browser can't show */
/* ------------------------------------------------------------------ */
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const xmlEsc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (text, { b, sz, color, i } = {}) => `<w:r><w:rPr>${b ? "<w:b/>" : ""}${i ? "<w:i/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}${sz ? `<w:sz w:val="${sz}"/>` : ""}</w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
const p = (runs, { after = 160, align } = {}) => `<w:p><w:pPr><w:spacing w:after="${after}"/>${align ? `<w:jc w:val="${align}"/>` : ""}</w:pPr>${runs}</w:p>`;
const cell = (text, { b, fill, w = 2400, right } = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}</w:tcPr>${p(run(text, { b }), { after: 0, align: right ? "right" : null })}</w:tc>`;
const border = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="DEE2E6"/><w:bottom w:val="single" w:sz="4" w:color="DEE2E6"/><w:insideH w:val="single" w:sz="4" w:color="DEE2E6"/></w:tblBorders>';
const table = rowsData => `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/>${border}<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="4200"/><w:gridCol w:w="2400"/><w:gridCol w:w="2400"/></w:tblGrid>` +
  rowsData.map((r, j) => `<w:tr>${r.map((c, i) => cell(c, { b: j === 0 || j === rowsData.length - 1, fill: j === 0 ? "EEF4FE" : null, w: i === 0 ? 4200 : 2400, right: i > 0 })).join("")}</w:tr>`).join("") + "</w:tbl>";
const docBody = [
  p(run("PROPOSAL", { b: true, sz: 20, color: "1068EB" }), { after: 60 }),
  p(run("Tiling of the Riverside Library", { b: true, sz: 44 }), { after: 80 }),
  p(run("Atlantic Ceramics, Lda. to the Riverside Library Foundation · 1 July 2026 · fictitious", { sz: 20, color: "6A7178" }), { after: 360 }),
  p(run("1. Scope", { b: true, sz: 30 })),
  p(run("We propose to supply and fit the floor and wall tiles of the new reading room and the children's area, about 480 m² in total. The work fits the library's opening date of 15 October 2026.")),
  p(run("2. Materials", { b: true, sz: 30 })),
  p(run("•  Porto floor tile 60 × 60, grey, slip resistance R10, for the reading room.")),
  p(run("•  Douro glazed 15 × 15, teal and ochre, for the children's area walls.")),
  p(run("•  Minho outdoor 45 × 45 for the entrance terrace.")),
  p(run("3. Price", { b: true, sz: 30 })),
  table([["Item", "m²", "EUR"], ["Porto floor tile", "320", "4,560.00"], ["Douro glazed", "110", "2,024.00"], ["Minho outdoor", "50", "712.50"], ["Fitting and delivery", "", "6,900.00"], ["Total (VAT excluded)", "480", "14,196.50"]]),
  p("", { after: 200 }),
  p(run("The offer is valid for 60 days. ", {}) + run("Payment: 30% on order, 70% on completion.", { i: true })),
  '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
  p(run("4. Schedule", { b: true, sz: 30 })),
  p(run("Week 1: delivery and preparation of the floor. Weeks 2–3: reading room. Week 4: children's area and terrace. Week 5: finishing, cleaning and handover.")),
  p(run("Rendered in the browser by docx-preview: page breaks, tables, colours and fonts come from the document itself.", { i: true, color: "6A7178", sz: 20 }))
].join("");
const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${docBody}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="700" w:footer="700" w:gutter="0"/></w:sectPr></w:body></w:document>`;
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="212529"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;

(async () => {
  const d = new JSZip();
  d.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  d.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  d.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  d.file("word/document.xml", docXml);
  d.file("word/styles.xml", stylesXml);
  const docx = await d.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  write("proposal.docx", docx);

  const pp = new JSZip();
  pp.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  pp.file("ppt/presentation.xml", '<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  write("slides.pptx", await pp.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

  const z = new JSZip();
  z.file("docs/proposal.docx", docx);
  z.file("docs/report.pdf", reportPdf);
  z.file("data/sales.xlsx", fs.readFileSync(path.join(OUT, "sales.xlsx")));
  z.file("data/customers.csv", fs.readFileSync(path.join(OUT, "customers.csv")));
  z.file("img/landscape.png", fs.readFileSync(path.join(OUT, "landscape.png")));
  z.file("img/chart.svg", fs.readFileSync(path.join(OUT, "chart.svg")));
  z.file("src/OrderService.cs", fs.readFileSync(path.join(OUT, "OrderService.cs")));
  z.file("README.md", fs.readFileSync(path.join(OUT, "README.md")));
  write("project.zip", await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

  await video().catch(e => console.log("clip.webm skipped:", e.message));
  console.log(fs.readdirSync(OUT).map(f => f.padEnd(18) + (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0).padStart(6) + " KB").join("\n"));
})();

/* ------------------------------------------------------------------ */
/* Video: a canvas animation recorded with MediaRecorder               */
/* ------------------------------------------------------------------ */
async function video() {
  const puppeteer = require("puppeteer-core");
  const executablePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await puppeteer.launch({ executablePath, headless: "new" });
  try {
    const page = await browser.newPage();
    const b64 = await page.evaluate(() => new Promise((resolve, reject) => {
      const c = document.createElement("canvas");
      c.width = 640; c.height = 360;
      const g = c.getContext("2d");
      const rec = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 900000 });
      const chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => { const r = new FileReader(); r.onload = () => resolve(r.result.split(",")[1]); r.readAsDataURL(new Blob(chunks)); };
      rec.onerror = e => reject(e.error);
      const t0 = performance.now();
      (function frame() {
        const t = (performance.now() - t0) / 1000;
        const grd = g.createLinearGradient(0, 0, 640, 360);
        grd.addColorStop(0, "#0b2a6b"); grd.addColorStop(1, "#1068eb");
        g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 6; i++) {
          const a = t * 1.4 + i * Math.PI / 3;
          g.fillStyle = `hsla(${200 + i * 25}, 90%, 70%, .85)`;
          g.beginPath(); g.arc(320 + Math.cos(a) * 110, 180 + Math.sin(a) * 110, 22 + 8 * Math.sin(t * 3 + i), 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "#fff"; g.font = "600 30px Segoe UI, sans-serif"; g.textAlign = "center";
        g.fillText("AnyViewer", 320, 190);
        g.font = "16px Segoe UI, sans-serif"; g.fillText(t.toFixed(1) + " s", 320, 330);
        if (t < 5) requestAnimationFrame(frame); else rec.stop();
      })();
      rec.start(250);
    }));
    write("clip.webm", Buffer.from(b64, "base64"));
  } finally { await browser.close(); }
}
