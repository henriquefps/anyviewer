// Builds dist/: the AnyViewer core plus a wrapped copy of every third-party library.
//
// dist/ holds exactly the scripts an OutSystems module imports (Interface →
// Scripts → Import Script) and makes Required Scripts of the AnyViewer block.
//
// OutSystems only ships a library's scripts to consuming modules when a block
// requires them, and it runs every Required Script as soon as the page loads,
// with the AMD `define` of the Reactive runtime in place. UMD builds then
// register as anonymous AMD modules and leave no global behind. So each library
// is wrapped in a function that only registers itself:
//
//   window.AnyViewerLibs.<name> = function () { <original code> }
//
// anyviewer.js calls that function when a file type first needs the library.
// The function takes `define`, `require`, `module` and `exports` as parameters
// and is called without arguments, so the library code never sees the
// runtime's RequireJS globals, not even code that runs later. Browserify
// bundles (JSZip) call the global `require` for modules they don't bundle,
// e.g. JSZip's optional `require("stream")` probe in the middle of loadAsync;
// RequireJS answers that with a "not loaded yet" error that OutSystems sends
// to its ErrorScreen. Libraries that declare their global with a top-level
// `var` (hljs, XLSX) would keep it local inside the function, so the wrapper
// assigns it to window at the end.
//
// Usage: npm run build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// The original browser builds, from the exact versions pinned in package.json
const LIBS = {
  pdfjs:       { global: "pdfjsLib",    title: "pdf.js",        pkg: "pdfjs-dist",              file: "build/pdf.min.js" },
  pdfjsworker: { global: "pdfjsWorker", title: "pdf.js worker", pkg: "pdfjs-dist",              file: "build/pdf.worker.min.js" },
  xlsx:        { global: "XLSX",        title: "SheetJS CE",    pkg: "xlsx",                    file: "dist/xlsx.full.min.js" },
  jszip:       { global: "JSZip",       title: "JSZip",         pkg: "jszip",                   file: "dist/jszip.min.js" },
  docxpreview: { global: "docx",        title: "docx-preview",  pkg: "docx-preview",            file: "dist/docx-preview.min.js" },
  hljs:        { global: "hljs",        title: "highlight.js",  pkg: "@highlightjs/cdn-assets", file: "highlight.min.js" },
  marked:      { global: "marked",      title: "marked",        pkg: "marked",                  file: "marked.min.js" },
  purify:      { global: "DOMPurify",   title: "DOMPurify",     pkg: "dompurify",               file: "dist/purify.min.js" }
};
const modulePath = (lib, file) => path.join(root, "node_modules", lib.pkg, file);
const version = lib => JSON.parse(fs.readFileSync(modulePath(lib, "package.json"), "utf8")).version;

const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
const report = (name, text) => console.log(name.padEnd(16), (Buffer.byteLength(text) / 1024).toFixed(0).padStart(5) + " KB");

const core = fs.readFileSync(path.join(root, "src", "anyviewer.js"), "utf8")
  .replace(/version: "[^"]*"/, `version: ${JSON.stringify(pkg.version)}`);
fs.writeFileSync(path.join(dist, "anyviewer.js"), core);
report("anyviewer.js", core);

for (const [name, lib] of Object.entries(LIBS)) {
  const code = fs.readFileSync(modulePath(lib, lib.file), "utf8");
  const g = lib.global;
  const out =
    `/* AnyViewer wrapper for ${lib.title} ${version(lib)}. Registers only; runs when AnyViewer needs it. */\n` +
    `(window.AnyViewerLibs = window.AnyViewerLibs || {})[${JSON.stringify(name)}] = function (define, require, module, exports) {\n` +
    code +
    `\n;try { if (typeof ${g} !== "undefined" && !globalThis.${g}) globalThis.${g} = ${g}; } catch (e) { }\n` +
    `};\n`;
  fs.writeFileSync(path.join(dist, name + ".js"), out);
  report(name + ".js", out);
}
