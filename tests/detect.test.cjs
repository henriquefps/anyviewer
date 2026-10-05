// Unit tests of AnyViewer.detect: extension, MIME type and content sniffing.
// Usage: npm test (run `npm run samples` first if demo/samples/ is empty)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = {};
require(path.join(__dirname, "..", "src", "anyviewer.js"));
const { detect } = window.AnyViewer;
const sample = name => new Uint8Array(fs.readFileSync(path.join(__dirname, "..", "demo", "samples", name)));
const bytes = s => new TextEncoder().encode(s);

test("the extension decides for known types", () => {
  assert.equal(detect("a.xlsx", "", sample("sales.xlsx")).kind, "sheet");
  assert.equal(detect("a.docx", "", sample("proposal.docx")).kind, "docx");
  assert.equal(detect("a.zip", "", sample("project.zip")).kind, "zip");
  assert.equal(detect("a.csv", "", sample("customers.csv")).kind, "sheet");
  assert.equal(detect("README.md", "", sample("README.md")).kind, "markdown");
  assert.equal(detect("a.html", "", sample("invoice.html")).kind, "html");
  assert.equal(detect("a.log", "", sample("server.log")).kind, "text");
});

test("code files get their highlight.js language", () => {
  const t = detect("OrderService.cs", "", sample("OrderService.cs"));
  assert.equal(t.kind, "code");
  assert.equal(t.lang, "csharp");
  assert.equal(detect("x.ts", "", bytes("let a = 1")).lang, "typescript");
  assert.equal(detect("x.sql", "", bytes("select 1")).lang, "sql");
});

test("content wins when the name is missing or says nothing", () => {
  assert.equal(detect("", "", sample("scan")).kind, "pdf");
  assert.equal(detect("scan", "application/octet-stream", sample("scan")).kind, "pdf");
  assert.equal(detect("", "", sample("landscape.png")).mime, "image/png");
  assert.equal(detect("", "", sample("chime.wav")).kind, "audio");
  assert.equal(detect("", "", sample("clip.webm")).kind, "video");
  assert.equal(detect("", "", sample("chart.svg")).kind, "image");
  assert.equal(detect("", "", bytes('{"a":1}')).kind, "json");
  assert.equal(detect("", "", bytes("<?xml version=\"1.0\"?><a/>")).kind, "xml");
  assert.equal(detect("", "", bytes("<!doctype html><p>x")).kind, "html");
  assert.equal(detect("", "", bytes("plain words")).kind, "text");
});

test("a PDF is a PDF whatever its name says", () => {
  assert.equal(detect("report.txt", "text/plain", sample("report.pdf")).kind, "pdf");
});

test("the MIME type is used when there is no extension", () => {
  assert.equal(detect("download", "application/pdf", null).kind, "pdf");
  assert.equal(detect("download", "text/csv; charset=utf-8", null).kind, "sheet");
  assert.equal(detect("download", "image/tiff", null).kind, "binary");
});

test("Office files report their own MIME type, not application/zip", () => {
  assert.match(detect("a.xlsx", "", sample("sales.xlsx")).mime, /spreadsheetml/);
  assert.match(detect("a.docx", "", sample("proposal.docx")).mime, /wordprocessingml/);
  assert.equal(detect("a.zip", "", sample("project.zip")).mime, "application/zip");
});

test("a ZIP with no telling name is flagged for an OOXML check", () => {
  const t = detect("", "", sample("proposal.docx"));
  assert.equal(t.kind, "zip");
  assert.equal(t.ooxmlCandidate, true);
});

test("unknown binary content falls back to binary", () => {
  assert.equal(detect("data.bin", "", new Uint8Array([0, 1, 2, 3, 0, 255])).kind, "binary");
  assert.equal(detect("x.oml", "", bytes("whatever")).kind, "binary");
});
