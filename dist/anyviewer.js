/*!
 * AnyViewer core — reusable document previewer for OutSystems 11 Reactive.
 *
 * window.AnyViewer.render(hostId, options) / window.AnyViewer.destroy(hostId)
 *
 * options:
 *   base64         Binary content as base64 (OutSystems Binary Data in a JS node)
 *   url            Alternative source; used when base64 is empty
 *   fileName       Used for type detection (extension) and download name
 *   mimeType       Optional; when empty the type is sniffed from the bytes
 *   scriptsBaseUrl Prefix for the library scripts, e.g. "/MyApp/scripts/AnyViewer."
 *                  Empty = auto-detected from the page's own /scripts/ folder
 *   height         CSS height of the viewer (default "600px")
 *   showToolbar    default true
 *   allowDownload  default true
 *   onRendered(detectedType), onError(message)
 *
 * Third-party libraries run on demand, only for the type being shown. Their
 * scripts only register a factory in window.AnyViewerLibs (scripts/build.mjs):
 * in OutSystems they are Required Scripts of the block; anywhere else a missing
 * one is fetched from scriptsBaseUrl.
 */
(function () {
  "use strict";
  if (window.AnyViewer && window.AnyViewer.version) return;

  var LIMITS = {
    textChars: 2 * 1024 * 1024,      // text shown at most (chars)
    highlightChars: 300 * 1024,      // syntax highlight only below this
    sheetRows: 5000,                 // rows per sheet
    zipEntries: 5000,                // entries listed in an archive
    zipEntryBytes: 100 * 1024 * 1024,// largest archive entry opened
    zipDepth: 3                      // nested archives
  };

  /* ------------------------------------------------------------------ */
  /* Script loading                                                      */
  /* ------------------------------------------------------------------ */

  var LIBS = {
    pdfjs:       { file: "pdfjs",       global: "pdfjsLib" },
    xlsx:        { file: "xlsx",        global: "XLSX" },
    jszip:       { file: "jszip",       global: "JSZip" },
    docxpreview: { file: "docxpreview", global: "docx", deps: ["jszip"] },
    hljs:        { file: "hljs",        global: "hljs" },
    marked:      { file: "marked",      global: "marked" },
    purify:      { file: "purify",      global: "DOMPurify" }
  };
  var libPromises = {};

  function detectBaseUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src") || "";
      var m = src.match(/^(.*\/scripts\/)AnyViewer\./i);
      if (m) return m[1] + "AnyViewer.";
    }
    for (var j = 0; j < scripts.length; j++) {
      var s = scripts[j].getAttribute("src") || "";
      var k = s.indexOf("/scripts/");
      if (k >= 0) return s.substring(0, k + 9) + "AnyViewer.";
    }
    return "scripts/AnyViewer.";
  }

  function scriptUrl(ctx, file) {
    return (ctx.scriptsBaseUrl || detectBaseUrl()) + file + ".js";
  }

  // Each library script only registers a factory in window.AnyViewerLibs (see
  // scripts/build.mjs). In OutSystems they are Required Scripts of the
  // block, so they are already registered; elsewhere the file is fetched once.
  function factories() { return window.AnyViewerLibs || (window.AnyViewerLibs = {}); }

  function registerFromUrl(ctx, file) {
    if (factories()[file]) return Promise.resolve();
    var src = scriptUrl(ctx, file);
    return fetch(src, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("Could not load script " + src + " (HTTP " + r.status + ")");
      return r.text();
    }).then(function (code) {
      var s = document.createElement("script");
      s.text = code + "\n//# sourceURL=" + src;
      document.head.appendChild(s);
      if (!factories()[file]) throw new Error("Script " + src + " is not an AnyViewer library script");
    });
  }

  // UMD libraries register as anonymous AMD modules when window.define exists
  // (it does in OutSystems Reactive), which leaves no global behind. The
  // factory runs synchronously with define hidden for that instant.
  function runWithoutAmd(fn) {
    var savedDefine = window.define;
    try {
      window.define = undefined;
      fn.call(window);
    } finally {
      window.define = savedDefine;
    }
  }

  function loadLib(ctx, name) {
    var lib = LIBS[name];
    if (window[lib.global]) return Promise.resolve(window[lib.global]);
    if (libPromises[name]) return libPromises[name];
    var deps = (lib.deps || []).map(function (d) { return loadLib(ctx, d); });
    libPromises[name] = Promise.all(deps)
      .then(function () { return registerFromUrl(ctx, lib.file); })
      .then(function () {
        if (!window[lib.global]) runWithoutAmd(factories()[lib.file]);
        if (!window[lib.global]) throw new Error("Library " + lib.file + " did not define " + lib.global);
        return window[lib.global];
      })
      .catch(function (e) { delete libPromises[name]; throw e; });
    return libPromises[name];
  }

  // pdf.js needs its worker. The worker's factory source becomes a blob URL,
  // and each document gets its own Worker from it: pdf.js tears a worker down
  // with its document, so a shared one breaks the next file. When workers are
  // blocked, the factory runs on the main thread instead (pdf.js then uses
  // window.pdfjsWorker without a worker). Resolves to the blob URL or null.
  var pdfWorkerUrl = null;
  function setupPdfWorker(ctx) {
    if (pdfWorkerUrl) return pdfWorkerUrl;
    pdfWorkerUrl = registerFromUrl(ctx, "pdfjsworker").then(function () {
      var fn = factories().pdfjsworker;
      try {
        var url = URL.createObjectURL(new Blob(["(" + fn.toString() + ").call(self);"], { type: "text/javascript" }));
        new Worker(url).terminate();
        return url;
      } catch (e) {
        if (!window.pdfjsWorker) runWithoutAmd(fn);
        return null;
      }
    }).catch(function (e) { pdfWorkerUrl = null; throw e; });
    return pdfWorkerUrl;
  }

  /* ------------------------------------------------------------------ */
  /* Styles                                                              */
  /* ------------------------------------------------------------------ */

  var CSS = [
    ".av{--av-border:var(--color-neutral-4,#dee2e6);--av-bg:var(--color-neutral-0,#fff);--av-bg2:var(--color-neutral-2,#f4f5f7);--av-text:var(--color-neutral-9,#212529);--av-muted:var(--color-neutral-7,#6a7178);--av-accent:var(--color-primary,#1068eb);",
    "display:flex;flex-direction:column;border:1px solid var(--av-border);border-radius:var(--border-radius-soft,4px);background:var(--av-bg);color:var(--av-text);overflow:hidden;font-size:14px;box-sizing:border-box;position:relative;container:anyviewer/inline-size}",
    ".av *{box-sizing:border-box}",
    ".av-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--av-border);background:var(--av-bg2);min-height:40px;flex:0 0 auto}",
    ".av-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;min-width:0}",
    ".av-badge{font-size:11px;text-transform:uppercase;color:var(--av-muted);border:1px solid var(--av-border);border-radius:10px;padding:1px 8px;white-space:nowrap}",
    ".av-tools{display:flex;align-items:center;gap:4px;flex:0 0 auto}",
    ".av-btn{border:1px solid var(--av-border);background:var(--av-bg);color:var(--av-text);border-radius:4px;height:28px;min-width:28px;padding:0 8px;cursor:pointer;font-size:13px;line-height:26px}",
    ".av-btn:hover{border-color:var(--av-accent);color:var(--av-accent)}",
    ".av-btn[disabled]{opacity:.4;cursor:default}",
    ".av-info{font-size:12px;color:var(--av-muted);white-space:nowrap}",
    ".av-body{flex:1 1 auto;overflow:auto;position:relative;min-height:0}",
    ".av-center{display:flex;align-items:center;justify-content:center;min-height:100%;padding:16px}",
    ".av-msg{text-align:center;color:var(--av-muted);padding:32px 16px}",
    ".av-msg b{display:block;color:var(--av-text);font-size:16px;margin-bottom:6px;word-break:break-all}",
    ".av-msg .av-btn{margin-top:12px}",
    ".av-error b{color:var(--color-error,#dc2626)}",
    ".av-spin{width:28px;height:28px;border:3px solid var(--av-border);border-top-color:var(--av-accent);border-radius:50%;animation:av-spin .8s linear infinite}",
    "@keyframes av-spin{to{transform:rotate(360deg)}}",
    ".av-img{max-width:100%;transform-origin:center top;transition:transform .1s}",
    ".av-checker{background-image:linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}",
    ".av-pdf{background:var(--av-bg2);padding:12px;display:flex;flex-direction:column;align-items:center;gap:12px}",
    ".av-page{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);position:relative}",
    ".av-page canvas{display:block}",
    ".av-tabs{display:flex;gap:2px;border-top:1px solid var(--av-border);background:var(--av-bg2);overflow-x:auto;flex:0 0 auto}",
    ".av-tab{border:0;background:transparent;padding:6px 14px;cursor:pointer;white-space:nowrap;color:var(--av-muted);border-top:2px solid transparent;font-size:13px}",
    ".av-tab.av-on{color:var(--av-text);border-top-color:var(--av-accent);background:var(--av-bg)}",
    ".av-sheet table{border-collapse:collapse;font-size:13px}",
    ".av-sheet td,.av-sheet th{border:1px solid var(--av-border);padding:3px 6px;white-space:nowrap;max-width:400px;overflow:hidden;text-overflow:ellipsis}",
    ".av-sheet tr:first-child td{background:var(--av-bg2);font-weight:600;position:sticky;top:0}",
    ".av-note{padding:6px 10px;font-size:12px;color:var(--av-muted);background:var(--av-bg2);border-bottom:1px solid var(--av-border)}",
    ".av-pre{margin:0;padding:12px 16px;font:12.5px/1.5 Consolas,Menlo,monospace;white-space:pre-wrap;word-break:break-word;tab-size:4}",
    ".av-md{padding:16px 24px;line-height:1.6;max-width:960px}",
    ".av-md img{max-width:100%}.av-md pre{background:var(--av-bg2);padding:10px;overflow:auto}.av-md table{border-collapse:collapse}.av-md td,.av-md th{border:1px solid var(--av-border);padding:4px 8px}",
    ".av-frame{border:0;width:100%;height:100%;display:block;background:#fff}",
    ".av-media{max-width:100%;max-height:100%}",
    ".av-docx{background:var(--av-bg2);min-height:100%}.av-docx .docx-wrapper{background:var(--av-bg2)!important;padding:16px!important}",
    ".av-zip{display:flex;height:100%;min-height:0}",
    ".av-zip-list{flex:0 0 280px;border-right:1px solid var(--av-border);overflow:auto;font-size:13px}",
    ".av-zip-view{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}",
    ".av-zip-view>.av{border:0;border-radius:0;flex:1 1 auto;height:auto!important}",
    ".av-zip-item{display:flex;gap:6px;align-items:center;padding:4px 10px;cursor:pointer;white-space:nowrap}",
    ".av-zip-item:hover{background:var(--av-bg2)}.av-zip-item.av-on{background:var(--av-bg2);color:var(--av-accent)}",
    ".av-zip-dir{color:var(--av-muted);cursor:default;font-weight:600}.av-zip-dir:hover{background:transparent}",
    ".av-zip-size{margin-left:auto;color:var(--av-muted);font-size:11px;padding-left:8px}",
    ".av-full{position:fixed!important;inset:0;z-index:10000;height:100%!important;border-radius:0}",
    /* narrow viewers (phones, side panels): the file name gets its own row */
    "@container anyviewer (max-width:560px){.av-bar{flex-wrap:wrap;row-gap:4px}.av-name{flex-basis:100%}.av-tools{flex-wrap:wrap}}",
    "@media (max-width:640px){.av-zip{flex-direction:column}.av-zip-list{flex:0 0 35%;border-right:0;border-bottom:1px solid var(--av-border)}}",
    /* highlight.js — compact GitHub-like palette */
    ".hljs-comment,.hljs-quote{color:#6a737d;font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-type{color:#d73a49}",
    ".hljs-string,.hljs-attr-value,.hljs-regexp,.hljs-addition{color:#032f62}.hljs-number,.hljs-literal,.hljs-symbol,.hljs-bullet{color:#005cc5}",
    ".hljs-title,.hljs-section,.hljs-function .hljs-title{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-template-variable{color:#005cc5}",
    ".hljs-name,.hljs-tag{color:#22863a}.hljs-meta{color:#735c0f}.hljs-deletion{color:#b31d28}.hljs-built_in{color:#e36209}"
  ].join("\n");

  function ensureCss() {
    if (document.getElementById("anyviewer-css")) return;
    var st = document.createElement("style");
    st.id = "anyviewer-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function btn(label, title, onClick) {
    var b = el("button", "av-btn", label);
    b.type = "button";
    if (title) b.title = title;
    b.addEventListener("click", onClick);
    return b;
  }

  function fmtSize(n) {
    if (n == null) return "";
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  function base64ToBytes(b64) {
    var clean = b64.indexOf(",") >= 0 && b64.indexOf("base64,") >= 0 ? b64.split("base64,")[1] : b64;
    var bin = atob(clean.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function decodeText(bytes) {
    var start = 0, enc = "utf-8";
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) start = 3;
    else if (bytes[0] === 0xFF && bytes[1] === 0xFE) { enc = "utf-16le"; start = 2; }
    else if (bytes[0] === 0xFE && bytes[1] === 0xFF) { enc = "utf-16be"; start = 2; }
    var view = bytes.subarray(start);
    try { return new TextDecoder(enc, { fatal: enc === "utf-8" }).decode(view); }
    catch (e) { return new TextDecoder("windows-1252").decode(view); }
  }

  function looksLikeText(bytes) {
    var n = Math.min(bytes.length, 4096), bad = 0;
    if (n === 0) return true;
    for (var i = 0; i < n; i++) {
      var c = bytes[i];
      if (c === 0) return false;
      if (c < 9 || (c > 13 && c < 32)) bad++;
    }
    return bad / n < 0.02;
  }

  /* ------------------------------------------------------------------ */
  /* Type detection                                                      */
  /* ------------------------------------------------------------------ */

  var CODE_LANG = {
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    css: "css", scss: "scss", less: "less", cs: "csharp", java: "java", kt: "kotlin", py: "python", rb: "ruby",
    php: "php", go: "go", rs: "rust", c: "c", h: "c", cpp: "cpp", hpp: "cpp", swift: "swift", sql: "sql",
    sh: "bash", bash: "bash", ps1: "powershell", bat: "dos", cmd: "dos", yml: "yaml", yaml: "yaml",
    ini: "ini", toml: "ini", cfg: "ini", conf: "ini", properties: "properties", dockerfile: "dockerfile",
    vb: "vbnet", r: "r", lua: "lua", pl: "perl", graphql: "graphql", gql: "graphql", tf: "ini"
  };
  var EXT_KIND = {
    png: "image", jpg: "image", jpeg: "image", jfif: "image", gif: "image", webp: "image", bmp: "image",
    ico: "image", svg: "image", avif: "image", apng: "image",
    pdf: "pdf",
    xlsx: "sheet", xlsm: "sheet", xlsb: "sheet", xls: "sheet", ods: "sheet", csv: "sheet", tsv: "sheet", numbers: "sheet",
    docx: "docx", docm: "docx",
    zip: "zip", jar: "zip", nupkg: "zip", oap: "zip", osp: "zip",
    txt: "text", log: "text", text: "text", nfo: "text",
    json: "json", geojson: "json", webmanifest: "json",
    xml: "xml", xsd: "xml", xsl: "xml", xslt: "xml", wsdl: "xml", config: "xml", csproj: "xml", resx: "xml", plist: "xml", oml: "binary",
    md: "markdown", markdown: "markdown",
    html: "html", htm: "html",
    mp4: "video", m4v: "video", webm: "video", ogv: "video", mov: "video",
    mp3: "audio", wav: "audio", ogg: "audio", oga: "audio", m4a: "audio", aac: "audio", flac: "audio", opus: "audio"
  };
  // A ZIP signature says "application/zip"; these extensions name the real type
  var EXT_MIME = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ods: "application/vnd.oasis.opendocument.spreadsheet"
  };
  var MIME_KIND = [
    [/^image\/(tiff|heic|heif)/, "binary"], [/^image\//, "image"], [/pdf$/, "pdf"],
    [/spreadsheetml|ms-excel|opendocument\.spreadsheet|text\/csv|tab-separated/, "sheet"],
    [/wordprocessingml/, "docx"], [/zip/, "zip"], [/json/, "json"], [/xml/, "xml"],
    [/markdown/, "markdown"], [/text\/html/, "html"], [/^video\//, "video"], [/^audio\//, "audio"], [/^text\//, "text"]
  ];

  function sniff(bytes) {
    function at(off, sig) {
      for (var i = 0; i < sig.length; i++) if (bytes[off + i] !== sig[i]) return false;
      return true;
    }
    function str(off, s) {
      for (var i = 0; i < s.length; i++) if (bytes[off + i] !== s.charCodeAt(i)) return false;
      return true;
    }
    if (str(0, "%PDF")) return { kind: "pdf", mime: "application/pdf" };
    if (at(0, [0x89, 0x50, 0x4E, 0x47])) return { kind: "image", mime: "image/png" };
    if (at(0, [0xFF, 0xD8, 0xFF])) return { kind: "image", mime: "image/jpeg" };
    if (str(0, "GIF8")) return { kind: "image", mime: "image/gif" };
    if (str(0, "RIFF") && str(8, "WEBP")) return { kind: "image", mime: "image/webp" };
    if (str(0, "RIFF") && str(8, "WAVE")) return { kind: "audio", mime: "audio/wav" };
    if (str(0, "BM")) return { kind: "image", mime: "image/bmp" };
    if (at(0, [0, 0, 1, 0])) return { kind: "image", mime: "image/x-icon" };
    if (str(4, "ftyp")) {
      if (str(8, "avif")) return { kind: "image", mime: "image/avif" };
      if (str(8, "heic") || str(8, "mif1")) return { kind: "binary", mime: "image/heic" };
      if (str(8, "M4A")) return { kind: "audio", mime: "audio/mp4" };
      return { kind: "video", mime: "video/mp4" };
    }
    if (at(0, [0x1A, 0x45, 0xDF, 0xA3])) return { kind: "video", mime: "video/webm" };
    if (str(0, "OggS")) return { kind: "audio", mime: "audio/ogg" };
    if (str(0, "ID3") || at(0, [0xFF, 0xFB]) || at(0, [0xFF, 0xF3])) return { kind: "audio", mime: "audio/mpeg" };
    if (str(0, "fLaC")) return { kind: "audio", mime: "audio/flac" };
    if (at(0, [0x50, 0x4B, 0x03, 0x04]) || at(0, [0x50, 0x4B, 0x05, 0x06])) return { kind: "zip", mime: "application/zip", ooxml: true };
    if (at(0, [0xD0, 0xCF, 0x11, 0xE0])) return { kind: "binary", mime: "application/x-ole-storage", ole: true };
    if (looksLikeText(bytes)) {
      var head = decodeText(bytes.subarray(0, 2048)).replace(/^\s+/, "");
      if (/^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head))) return { kind: "image", mime: "image/svg+xml" };
      if (/^<\?xml/i.test(head)) return { kind: "xml", mime: "application/xml" };
      if (/^<!doctype html|^<html[\s>]/i.test(head)) return { kind: "html", mime: "text/html" };
      if (/^[\[{]/.test(head)) return { kind: "json", mime: "application/json" };
      return { kind: "text", mime: "text/plain" };
    }
    return { kind: "binary", mime: "application/octet-stream" };
  }

  function detect(fileName, mimeType, bytes) {
    var ext = extOf(fileName);
    var mime = (mimeType || "").toLowerCase().split(";")[0].trim();
    var kind = EXT_KIND[ext] || (CODE_LANG[ext] ? "code" : "");
    if (!kind && mime && mime !== "application/octet-stream") {
      for (var i = 0; i < MIME_KIND.length; i++) if (MIME_KIND[i][0].test(mime)) { kind = MIME_KIND[i][1]; break; }
    }
    var sniffed = bytes ? sniff(bytes) : null;
    // Content wins over a missing or misleading name for clearly binary formats
    if (sniffed && (!kind || kind === "binary" || kind === "text")) {
      if (sniffed.kind !== "text" || !kind) kind = sniffed.kind;
    }
    if (sniffed && sniffed.kind === "pdf") kind = "pdf";
    if (sniffed && sniffed.ole && (ext === "xls")) kind = "sheet";
    if (!mime || mime === "application/octet-stream") mime = (sniffed && sniffed.mime) || mime || "application/octet-stream";
    if (ext === "svg") mime = "image/svg+xml";
    if (EXT_MIME[ext] && (mime === "application/zip" || mime === "application/octet-stream")) mime = EXT_MIME[ext];
    return { kind: kind || "binary", mime: mime, ext: ext, lang: CODE_LANG[ext], ooxmlCandidate: !!(sniffed && sniffed.ooxml) };
  }

  /* ------------------------------------------------------------------ */
  /* Viewer instance                                                     */
  /* ------------------------------------------------------------------ */

  var instances = {};

  function Viewer(host, opts, depth) {
    this.host = host;
    this.opts = opts;
    this.depth = depth || 0;
    this.urls = [];
    this.cleanups = [];
    this.disposed = false;
    this.zoom = 1;
  }

  Viewer.prototype.objectUrl = function (blob) {
    var u = URL.createObjectURL(blob);
    this.urls.push(u);
    return u;
  };

  Viewer.prototype.dispose = function () {
    this.disposed = true;
    this.cleanups.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
    this.urls.forEach(function (u) { URL.revokeObjectURL(u); });
    this.cleanups = [];
    this.urls = [];
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  Viewer.prototype.buildFrame = function () {
    var o = this.opts, self = this;
    var root = el("div", "av");
    root.style.height = o.height || "600px";
    this.root = root;

    if (o.showToolbar !== false) {
      var bar = el("div", "av-bar");
      this.nameEl = el("span", "av-name", o.fileName || "");
      this.nameEl.title = o.fileName || "";
      this.badgeEl = el("span", "av-badge", "");
      this.badgeEl.style.display = "none";
      this.toolsEl = el("div", "av-tools");
      this.fixedTools = el("div", "av-tools");
      if (o.allowDownload !== false) {
        this.downloadBtn = btn("⤓", "Download", function () { self.download(); });
        this.downloadBtn.disabled = true;
        this.fixedTools.appendChild(this.downloadBtn);
      }
      if (this.depth === 0) {
        this.fixedTools.appendChild(btn("⛶", "Full screen", function () {
          root.classList.toggle("av-full");
        }));
      }
      bar.appendChild(this.nameEl);
      bar.appendChild(this.badgeEl);
      bar.appendChild(this.toolsEl);
      bar.appendChild(this.fixedTools);
      root.appendChild(bar);
    }
    this.body = el("div", "av-body");
    root.appendChild(this.body);
    this.host.appendChild(root);
    this.showSpinner();
  };

  Viewer.prototype.setBadge = function (text) {
    if (!this.badgeEl) return;
    this.badgeEl.textContent = text;
    this.badgeEl.style.display = text ? "" : "none";
  };

  Viewer.prototype.addTool = function (node) {
    if (this.toolsEl) this.toolsEl.appendChild(node);
    return node;
  };

  Viewer.prototype.showSpinner = function () {
    this.body.innerHTML = "";
    var c = el("div", "av-center");
    c.appendChild(el("div", "av-spin"));
    this.body.appendChild(c);
  };

  Viewer.prototype.clearBody = function () { this.body.innerHTML = ""; };

  Viewer.prototype.showMessage = function (title, detail, isError) {
    var self = this;
    this.clearBody();
    var c = el("div", "av-center");
    var m = el("div", "av-msg" + (isError ? " av-error" : ""));
    m.appendChild(el("b", null, title));
    if (detail) m.appendChild(el("div", null, detail));
    if (this.blob && this.opts.allowDownload !== false) {
      var b = btn("Download file", null, function () { self.download(); });
      m.appendChild(el("br"));
      m.appendChild(b);
    }
    c.appendChild(m);
    this.body.appendChild(c);
  };

  Viewer.prototype.download = function () {
    if (!this.blob) return;
    var a = document.createElement("a");
    a.href = this.objectUrl(this.blob);
    a.download = this.opts.fileName || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  Viewer.prototype.loadBytes = function () {
    var o = this.opts;
    if (o.bytes) return Promise.resolve(o.bytes);
    if (o.base64) return Promise.resolve(base64ToBytes(o.base64));
    if (o.url) {
      return fetch(o.url, { credentials: "same-origin" }).then(function (r) {
        if (!r.ok) throw new Error("Could not fetch the file (HTTP " + r.status + ")");
        if (!o.mimeType) o.mimeType = r.headers.get("content-type") || "";
        if (!o.fileName) {
          var cd = r.headers.get("content-disposition") || "";
          var m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
          o.fileName = m ? decodeURIComponent(m[1]) : decodeURIComponent((o.url.split("?")[0].split("/").pop() || ""));
        }
        return r.arrayBuffer();
      }).then(function (buf) { return new Uint8Array(buf); });
    }
    return Promise.resolve(null);
  };

  Viewer.prototype.start = function () {
    var self = this, o = this.opts;
    this.buildFrame();
    return this.loadBytes().then(function (bytes) {
      if (self.disposed) return;
      if (!bytes) {
        self.showMessage("No file", "There is no file to preview.");
        return "none";
      }
      self.bytes = bytes;
      if (self.nameEl && o.fileName) { self.nameEl.textContent = o.fileName; self.nameEl.title = o.fileName; }
      var t = detect(o.fileName, o.mimeType, bytes);
      self.type = t;
      self.blob = new Blob([bytes], { type: t.mime });
      if (self.downloadBtn) self.downloadBtn.disabled = false;
      return self.resolveOoxml(t).then(function () {
        self.setBadge((t.ext || t.kind).toUpperCase() + " · " + fmtSize(bytes.length));
        var renderer = RENDERERS[t.kind] || RENDERERS.binary;
        return renderer(self, t, bytes);
      }).then(function () { return t.kind; });
    });
  };

  // A ZIP signature without a telling extension may be xlsx/docx/pptx
  Viewer.prototype.resolveOoxml = function (t) {
    if (t.kind !== "zip" || !t.ooxmlCandidate || EXT_KIND[t.ext] === "zip") return Promise.resolve();
    var self = this;
    return loadLib(this.opts, "jszip").then(function (JSZip) {
      return JSZip.loadAsync(self.bytes);
    }).then(function (zip) {
      if (zip.file("word/document.xml")) t.kind = "docx";
      else if (zip.file("xl/workbook.xml") || zip.file("xl/workbook.bin")) t.kind = "sheet";
      else if (zip.file("ppt/presentation.xml")) t.kind = "binary";
      self.zipCache = zip;
    }).catch(function () { /* treat as plain zip */ });
  };

  /* ------------------------------------------------------------------ */
  /* Renderers                                                           */
  /* ------------------------------------------------------------------ */

  function zoomTools(v, apply) {
    v.addTool(btn("−", "Zoom out", function () { v.zoom = Math.max(0.25, v.zoom / 1.25); apply(); label.textContent = Math.round(v.zoom * 100) + "%"; }));
    var label = v.addTool(el("span", "av-info", "100%"));
    v.addTool(btn("+", "Zoom in", function () { v.zoom = Math.min(8, v.zoom * 1.25); apply(); label.textContent = Math.round(v.zoom * 100) + "%"; }));
    v.addTool(btn("1:1", "Reset zoom", function () { v.zoom = 1; apply(); label.textContent = "100%"; }));
  }

  var RENDERERS = {};

  RENDERERS.image = function (v, t) {
    return new Promise(function (resolve, reject) {
      var img = el("img", "av-img");
      img.alt = v.opts.fileName || "";
      img.onload = function () {
        v.clearBody();
        var c = el("div", "av-center");
        if (/png|gif|webp|svg|x-icon|avif/.test(t.mime)) c.classList.add("av-checker");
        c.appendChild(img);
        v.body.appendChild(c);
        if (v.badgeEl) v.setBadge(v.badgeEl.textContent + " · " + img.naturalWidth + "×" + img.naturalHeight);
        zoomTools(v, function () {
          img.style.maxWidth = v.zoom === 1 ? "100%" : "none";
          img.style.width = v.zoom === 1 ? "" : (img.naturalWidth * v.zoom) + "px";
        });
        resolve();
      };
      img.onerror = function () { reject(new Error("The browser cannot display this image format.")); };
      img.src = v.objectUrl(v.blob);
    });
  };

  RENDERERS.pdf = function (v, t, bytes) {
    var o = v.opts;
    var pdfjsLib;
    return loadLib(o, "pdfjs").then(function (lib) {
      pdfjsLib = lib;
      return setupPdfWorker(o);
    }).then(function (workerUrl) {
      var params = { data: bytes.slice(), isEvalSupported: false };
      if (workerUrl) {
        var port = new Worker(workerUrl);
        params.worker = new pdfjsLib.PDFWorker({ port: port });
        v.cleanups.push(function () { params.worker.destroy(); port.terminate(); });
      }
      var task = pdfjsLib.getDocument(params);
      v.cleanups.unshift(function () { task.destroy(); });
      return task.promise;
    }).then(function (pdf) {
      if (v.disposed) return;
      v.clearBody();
      var wrap = el("div", "av-pdf");
      v.body.appendChild(wrap);
      var pages = [], observer;
      var dpr = window.devicePixelRatio || 1;
      var info = el("span", "av-info", "");

      function baseScale(page) {
        var w = page.getViewport({ scale: 1 }).width;
        return Math.max(0.3, Math.min(2, (v.body.clientWidth - 40) / w));
      }
      function renderPage(p) {
        if (p.rendered === v.zoom || p.busy) return;
        p.busy = true;
        pdf.getPage(p.num).then(function (page) {
          var vp = page.getViewport({ scale: baseScale(page) * v.zoom });
          var canvas = el("canvas");
          canvas.width = Math.floor(vp.width * dpr);
          canvas.height = Math.floor(vp.height * dpr);
          canvas.style.width = Math.floor(vp.width) + "px";
          canvas.style.height = Math.floor(vp.height) + "px";
          p.box.style.width = canvas.style.width;
          p.box.style.height = canvas.style.height;
          return page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise.then(function () {
            p.box.innerHTML = "";
            p.box.appendChild(canvas);
            p.rendered = v.zoom;
          });
        }).catch(function () { /* page render cancelled or failed */ }).then(function () { p.busy = false; });
      }
      function layout() {
        return pdf.getPage(1).then(function (first) {
          var vp = first.getViewport({ scale: baseScale(first) * v.zoom });
          pages.forEach(function (p) {
            if (p.rendered !== v.zoom) { p.box.style.width = Math.floor(vp.width) + "px"; p.box.style.height = Math.floor(vp.height) + "px"; }
          });
        });
      }
      for (var i = 1; i <= pdf.numPages; i++) {
        var box = el("div", "av-page");
        box.dataset.page = i;
        wrap.appendChild(box);
        pages.push({ num: i, box: box, rendered: 0 });
      }
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var p = pages[+en.target.dataset.page - 1];
          if (en.isIntersecting) renderPage(p);
        });
      }, { root: v.body, rootMargin: "400px 0px" });
      pages.forEach(function (p) { observer.observe(p.box); });
      // The counter shows the page at the top third of the view (the observer
      // above also fires for pages preloaded below the fold)
      var ticking = false;
      function updateCounter() {
        ticking = false;
        var mark = v.body.getBoundingClientRect().top + v.body.clientHeight / 3, num = 1;
        for (var k = 0; k < pages.length; k++) {
          if (pages[k].box.getBoundingClientRect().top <= mark) num = pages[k].num; else break;
        }
        info.textContent = "Page " + num + " / " + pdf.numPages;
      }
      function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(updateCounter); } }
      v.body.addEventListener("scroll", onScroll);
      v.cleanups.push(function () { v.body.removeEventListener("scroll", onScroll); observer.disconnect(); pdf.destroy(); });

      v.addTool(info);
      info.textContent = "Page 1 / " + pdf.numPages;
      zoomTools(v, function () {
        layout().then(function () {
          pages.forEach(function (p) {
            var r = p.box.getBoundingClientRect(), b = v.body.getBoundingClientRect();
            if (r.bottom > b.top - 400 && r.top < b.bottom + 400) renderPage(p);
          });
        });
      });
      return layout();
    });
  };

  RENDERERS.sheet = function (v, t, bytes) {
    return loadLib(v.opts, "xlsx").then(function (XLSX) {
      var isText = t.ext === "csv" || t.ext === "tsv" || /csv|tab-separated/.test(t.mime);
      var wb = isText
        ? XLSX.read(decodeText(bytes), { type: "string", sheetRows: LIMITS.sheetRows + 1, FS: t.ext === "tsv" ? "\t" : undefined })
        : XLSX.read(bytes, { type: "array", sheetRows: LIMITS.sheetRows + 1, cellDates: true });
      if (v.disposed) return;
      v.clearBody();
      v.body.classList.add("av-sheet");
      var tabs = el("div", "av-tabs");
      var current = null;
      function show(name, tabBtn) {
        if (current) current.classList.remove("av-on");
        current = tabBtn;
        tabBtn.classList.add("av-on");
        v.body.innerHTML = "";
        var ws = wb.Sheets[name];
        var ref = ws["!fullref"] || ws["!ref"];
        if (!ref) { v.body.appendChild(el("div", "av-msg", "This sheet is empty.")); return; }
        var range = XLSX.utils.decode_range(ref);
        if (range.e.r + 1 > LIMITS.sheetRows) {
          v.body.appendChild(el("div", "av-note", "Showing the first " + LIMITS.sheetRows + " of " + (range.e.r + 1) + " rows. Download the file to see all rows."));
        }
        var holder = el("div");
        holder.innerHTML = XLSX.utils.sheet_to_html(ws, { header: "", footer: "" });
        v.body.appendChild(holder);
        v.body.scrollTop = 0;
      }
      wb.SheetNames.forEach(function (name, idx) {
        var tb = el("button", "av-tab", name);
        tb.type = "button";
        tb.addEventListener("click", function () { show(name, tb); });
        tabs.appendChild(tb);
        if (idx === 0) show(name, tb);
      });
      if (wb.SheetNames.length > 1 || !isText) v.root.appendChild(tabs);
    });
  };

  RENDERERS.text = function (v, t, bytes, lang) {
    var text = decodeText(bytes);
    var truncated = text.length > LIMITS.textChars;
    if (truncated) text = text.substring(0, LIMITS.textChars);
    if (t.kind === "json") {
      try { text = JSON.stringify(JSON.parse(text), null, 2); lang = "json"; } catch (e) { lang = "json"; }
    }
    if (t.kind === "xml") lang = "xml";
    v.clearBody();
    if (truncated) v.body.appendChild(el("div", "av-note", "The file is too large; showing the first " + fmtSize(LIMITS.textChars) + "."));
    var pre = el("pre", "av-pre");
    var code = el("code", null, text);
    pre.appendChild(code);
    v.body.appendChild(pre);
    var wrapOn = true;
    v.addTool(btn("Wrap", "Toggle line wrap", function () {
      wrapOn = !wrapOn;
      pre.style.whiteSpace = wrapOn ? "pre-wrap" : "pre";
    }));
    if (lang && text.length <= LIMITS.highlightChars) {
      return loadLib(v.opts, "hljs").then(function (hljs) {
        if (v.disposed) return;
        var res = hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang, ignoreIllegals: true }) : hljs.highlightAuto(text);
        code.innerHTML = res.value; // hljs escapes the source text
      }).catch(function () { /* plain text is fine */ });
    }
    return Promise.resolve();
  };
  RENDERERS.json = RENDERERS.text;
  RENDERERS.xml = RENDERERS.text;
  RENDERERS.code = function (v, t, bytes) { return RENDERERS.text(v, t, bytes, t.lang); };

  RENDERERS.markdown = function (v, t, bytes) {
    var o = v.opts;
    return Promise.all([loadLib(o, "marked"), loadLib(o, "purify")]).then(function (libs) {
      if (v.disposed) return;
      var html = libs[0].parse(decodeText(bytes));
      v.clearBody();
      var div = el("div", "av-md");
      div.innerHTML = libs[1].sanitize(html);
      v.body.appendChild(div);
      var showingSource = false;
      v.addTool(btn("Source", "Show source", function () {
        showingSource = !showingSource;
        div.innerHTML = "";
        if (showingSource) div.appendChild(el("pre", "av-pre", decodeText(bytes)));
        else div.innerHTML = libs[1].sanitize(html);
      }));
    });
  };

  // HTML is never executed: rendered in a sandboxed iframe with no permissions
  RENDERERS.html = function (v, t, bytes) {
    v.clearBody();
    var frame = el("iframe", "av-frame");
    frame.setAttribute("sandbox", "");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.srcdoc = decodeText(bytes);
    v.body.appendChild(frame);
    var showingSource = false;
    v.addTool(btn("Source", "Show source", function () {
      showingSource = !showingSource;
      v.clearBody();
      if (showingSource) v.body.appendChild(el("pre", "av-pre", decodeText(bytes)));
      else v.body.appendChild(frame);
    }));
    return Promise.resolve();
  };

  function media(tag) {
    return function (v, t) {
      return new Promise(function (resolve, reject) {
        var m = el(tag, "av-media");
        m.controls = true;
        m.preload = "metadata";
        if (tag === "audio") m.style.width = "min(560px, 100%)";
        m.onloadedmetadata = function () { resolve(); };
        m.onerror = function () { reject(new Error("The browser cannot play this " + tag + " format.")); };
        m.src = v.objectUrl(v.blob);
        v.clearBody();
        var c = el("div", "av-center");
        c.appendChild(m);
        v.body.appendChild(c);
      });
    };
  }
  RENDERERS.video = media("video");
  RENDERERS.audio = media("audio");

  RENDERERS.docx = function (v, t, bytes) {
    return loadLib(v.opts, "docxpreview").then(function (docx) {
      if (v.disposed) return;
      v.clearBody();
      var holder = el("div", "av-docx");
      v.body.appendChild(holder);
      var styleHolder = el("div");
      holder.appendChild(styleHolder);
      var content = el("div");
      holder.appendChild(content);
      return docx.renderAsync(v.blob, content, styleHolder, {
        className: "docx", inWrapper: true, ignoreWidth: false, ignoreHeight: false,
        breakPages: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, useBase64URL: true
      });
    });
  };

  RENDERERS.zip = function (v, t, bytes) {
    if (v.depth >= LIMITS.zipDepth) {
      v.showMessage("Nested archive", "Archives nested deeper than " + LIMITS.zipDepth + " levels are not opened.");
      return Promise.resolve();
    }
    var o = v.opts;
    var zipP = v.zipCache ? Promise.resolve(v.zipCache) : loadLib(o, "jszip").then(function (JSZip) { return JSZip.loadAsync(bytes); });
    return zipP.then(function (zip) {
      if (v.disposed) return;
      var entries = [];
      zip.forEach(function (path, entry) { entries.push(entry); });
      entries.sort(function (a, b) { return a.name.localeCompare(b.name); });
      v.clearBody();
      var layout = el("div", "av-zip");
      var list = el("div", "av-zip-list");
      var view = el("div", "av-zip-view");
      layout.appendChild(list);
      layout.appendChild(view);
      v.body.appendChild(layout);
      var child = null, selected = null, shown = 0, files = 0;

      function placeholder(text) {
        view.innerHTML = "";
        view.appendChild(el("div", "av-msg", text));
      }
      function open(entry, row) {
        if (selected) selected.classList.remove("av-on");
        selected = row;
        row.classList.add("av-on");
        if (child) { child.dispose(); child = null; }
        var size = entry._data && entry._data.uncompressedSize;
        if (size > LIMITS.zipEntryBytes) {
          placeholder("This file is too large to preview (" + fmtSize(size) + ").");
          return;
        }
        view.innerHTML = "";
        entry.async("uint8array").then(function (data) {
          if (v.disposed) return;
          child = new Viewer(view, {
            bytes: data, fileName: entry.name.split("/").pop(), height: "100%",
            showToolbar: true, allowDownload: o.allowDownload, scriptsBaseUrl: o.scriptsBaseUrl
          }, v.depth + 1);
          child.start().catch(function (e) { child.showMessage("Cannot preview this file", e && e.message, true); });
        });
      }

      entries.forEach(function (entry) {
        if (shown >= LIMITS.zipEntries) return;
        shown++;
        var parts = entry.name.replace(/\/$/, "").split("/");
        var row = el("div", "av-zip-item" + (entry.dir ? " av-zip-dir" : ""));
        row.style.paddingLeft = (10 + (parts.length - 1) * 14) + "px";
        row.appendChild(el("span", null, entry.dir ? "📁" : "📄"));
        var nm = el("span", null, parts[parts.length - 1]);
        nm.title = entry.name;
        row.appendChild(nm);
        if (!entry.dir) {
          files++;
          var size = entry._data && entry._data.uncompressedSize;
          if (size != null) row.appendChild(el("span", "av-zip-size", fmtSize(size)));
          row.addEventListener("click", function () { open(entry, row); });
        }
        list.appendChild(row);
      });
      if (entries.length > shown) list.appendChild(el("div", "av-note", "Showing " + shown + " of " + entries.length + " entries."));
      v.addTool(el("span", "av-info", files + " file" + (files === 1 ? "" : "s")));
      placeholder(files ? "Select a file to preview it." : "The archive is empty.");
      v.cleanups.push(function () { if (child) child.dispose(); });
    });
  };

  RENDERERS.binary = function (v, t) {
    var hint = "Preview is not available for this file type.";
    if (t.ext === "pptx" || t.ext === "ppt") hint = "PowerPoint files cannot be previewed in the browser.";
    else if (t.ext === "doc" || (t.mime && t.mime.indexOf("ole") >= 0)) hint = "Legacy Office files cannot be previewed in the browser.";
    else if (/tiff?|heic|heif/.test(t.ext + t.mime)) hint = "This image format is not supported by the browser.";
    else if (/rar|7z|gz|tar|bz2/.test(t.ext)) hint = "Only ZIP archives can be opened in the browser.";
    v.showMessage(v.opts.fileName || "File", hint + " (" + t.mime + ", " + fmtSize(v.bytes.length) + ")");
    return Promise.resolve();
  };

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  function renderKey(o) {
    var b = o.base64 || "";
    var n = o.bytes ? o.bytes.length : "";
    return [o.fileName, o.mimeType, o.url, o.height, o.showToolbar, o.allowDownload, b.length, b.substring(0, 64), b.substring(b.length - 64), n].join("|");
  }

  function render(hostId, opts) {
    opts = opts || {};
    var host = typeof hostId === "string" ? document.getElementById(hostId) : hostId;
    if (!host) return Promise.reject(new Error("AnyViewer host element not found: " + hostId));
    var id = host.id || hostId;
    var key = renderKey(opts);
    var existing = instances[id];
    if (existing && existing.key === key && existing.host === host) return existing.promise;
    destroy(id);
    ensureCss();
    var v = new Viewer(host, opts, 0);
    var inst = { key: key, host: host, viewer: v };
    instances[id] = inst;
    inst.promise = v.start().then(function (kind) {
      if (!v.disposed && opts.onRendered) opts.onRendered(kind || "");
      return kind;
    }).catch(function (e) {
      var msg = (e && e.message) || String(e);
      if (!v.disposed) {
        v.showMessage("Cannot preview this file", msg, true);
        if (opts.onError) opts.onError(msg);
      }
      return "error";
    });
    return inst.promise;
  }

  function destroy(hostId) {
    var id = typeof hostId === "string" ? hostId : hostId && hostId.id;
    var inst = instances[id];
    if (!inst) return;
    inst.viewer.dispose();
    delete instances[id];
  }

  window.AnyViewer = {
    version: "1.0.0",
    render: render,
    destroy: destroy,
    detect: detect,
    limits: LIMITS
  };
})();
