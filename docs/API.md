# AnyViewer API

AnyViewer is a single script, [`dist/anyviewer.js`](../dist/anyviewer.js), that defines `window.AnyViewer`. It has no dependencies at load time: each third-party library is a separate script in `dist/`, loaded the first time a file type needs it.

```html
<script src="dist/anyviewer.js"></script>
<div id="viewer"></div>
<script>
  AnyViewer.render('viewer', { url: 'files/report.pdf', scriptsBaseUrl: 'dist/' });
</script>
```

## `AnyViewer.render(host, options)` → `Promise<string>`

Shows a file inside `host` (an element id or the element itself). It replaces whatever that host was showing.

The promise resolves to the detected type (see [Types](#types)), or to `"error"` when the file could not be shown; it never rejects after the host was found. Calling `render` again with the same options on the same host returns the same promise and does nothing else, so it is safe to call it from a framework's "parameters changed" hook.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `base64` | string | | File content as base64. A `data:…;base64,` prefix is accepted. Takes priority over `url`. |
| `bytes` | `Uint8Array` | | File content as bytes. Takes priority over `base64` and `url`. |
| `url` | string | | Where to fetch the file from, when there is no `base64` or `bytes`. Same origin, or a server that allows CORS. Cookies are sent for same-origin requests. |
| `fileName` | string | | Used for type detection (its extension) and as the download name. For a `url`, it defaults to the `Content-Disposition` file name or the last part of the URL. |
| `mimeType` | string | | Optional. For a `url`, it defaults to the response's `Content-Type`. |
| `height` | string | `"600px"` | CSS height of the viewer, e.g. `"80vh"` or `"100%"`. |
| `showToolbar` | boolean | `true` | The bar with the file name, the type badge, the type's tools (zoom, page counter, wrap, source) and the download and full-screen buttons. |
| `allowDownload` | boolean | `true` | Shows the download button, and the download button of the "cannot preview" message. |
| `scriptsBaseUrl` | string | auto | Prefix of the library scripts: `scriptsBaseUrl + "pdfjs.js"`. Empty means auto-detected from the page's `<script>` tags: `…/scripts/AnyViewer.` (the OutSystems naming), or the folder of any script under `/scripts/`. Outside OutSystems, set it (e.g. `"dist/"`). |
| `onRendered` | `function(type)` | | Called once the file is shown, with the detected type. |
| `onError` | `function(message)` | | Called when the file could not be loaded or shown. The viewer shows the message too, with a download button when there are bytes. |

When there is no `base64`, `bytes` or `url`, the viewer shows "No file" and resolves to `"none"`.

## `AnyViewer.destroy(host)`

Removes the viewer from `host` and frees what it holds: object URLs, the pdf.js document and its worker, observers and nested viewers. Call it when the host goes away (in OutSystems: the block's `OnDestroy`).

## `AnyViewer.detect(fileName, mimeType, bytes)` → object

The type detection that `render` uses, exposed for apps that want to decide something before showing a file. `bytes` may be `null` or only the first few kilobytes.

```js
AnyViewer.detect('scan', '', bytes)
// { kind: 'pdf', mime: 'application/pdf', ext: '', lang: undefined, ooxmlCandidate: false }
```

| Field | Description |
|---|---|
| `kind` | One of the [types](#types) |
| `mime` | The MIME type: the one given, or the sniffed one, or the one the extension names (Office files) |
| `ext` | The lowercase extension, or `""` |
| `lang` | The highlight.js language for code files |
| `ooxmlCandidate` | `true` for a ZIP without a telling extension: `render` opens it to check whether it is really a Word or Excel file |

Rules, in order:

1. A known extension decides (`report.xlsx` → `sheet`); a code extension gives `code` and its language.
2. Without one, a MIME type other than `application/octet-stream` decides.
3. The first bytes decide when the name and MIME type say nothing, or only "text" or "binary": PDF, PNG, JPEG, GIF, WebP, BMP, ICO, AVIF, MP4, WebM, Ogg, MP3, FLAC, WAV, ZIP, and for text: SVG, XML, HTML, JSON.
4. A file that starts with `%PDF` is always a PDF.

## `AnyViewer.limits`

The limits that keep a huge file from freezing the page. They can be changed before rendering.

| Limit | Default | What happens past it |
|---|---|---|
| `textChars` | 2 MB of text | The rest is cut off, with a note |
| `highlightChars` | 300 KB | Shown without syntax highlighting |
| `sheetRows` | 5,000 | Each sheet shows its first rows, with a note |
| `zipEntries` | 5,000 | The list stops, with a note |
| `zipEntryBytes` | 100 MB | That entry is not opened |
| `zipDepth` | 3 | Deeper archives are not opened |

## `AnyViewer.version`

The version string, e.g. `"1.0.0"`.

## Types

| Type | Files | Rendered with | Toolbar tools |
|---|---|---|---|
| `image` | png, jpg, gif, webp, avif, bmp, ico, svg | `<img>` (SVG scripts never run) | Zoom |
| `pdf` | pdf | pdf.js, one canvas per page, drawn when it scrolls into view | Page counter, zoom |
| `sheet` | xlsx, xlsm, xlsb, xls, ods, csv, tsv, numbers | SheetJS, one tab per sheet | |
| `docx` | docx, docm | docx-preview | |
| `zip` | zip, jar, nupkg, oap, osp | JSZip, a file tree plus a nested viewer | File count |
| `text` | txt, log, and unknown text | `<pre>` | Wrap |
| `code` | js, ts, cs, java, py, sql, sh, yaml, … (36 languages) | highlight.js | Wrap |
| `json` | json, geojson | Pretty-printed, highlight.js | Wrap |
| `xml` | xml, xsd, config, csproj, … | highlight.js | Wrap |
| `markdown` | md | marked, sanitised with DOMPurify | Source |
| `html` | html, htm | A sandboxed `<iframe>` with no permissions: no scripts, forms or navigation | Source |
| `video` | mp4, webm, mov, ogv | `<video>` | |
| `audio` | mp3, wav, ogg, m4a, flac, opus | `<audio>` | |
| `binary` | anything else (pptx, doc, tiff, rar, …) | A message with the type and size, and a download button | |
| `none` | no content given | "No file" | |

## Styling

The viewer injects its CSS once (`<style id="anyviewer-css">`). Its colours come from CSS variables with fallbacks, so inside an OutSystems UI app it follows the theme:

| Viewer variable | Comes from | Fallback |
|---|---|---|
| `--av-border` | `--color-neutral-4` | `#dee2e6` |
| `--av-bg` | `--color-neutral-0` | `#fff` |
| `--av-bg2` | `--color-neutral-2` | `#f4f5f7` |
| `--av-text` | `--color-neutral-9` | `#212529` |
| `--av-muted` | `--color-neutral-7` | `#6a7178` |
| `--av-accent` | `--color-primary` | `#1068eb` |

Set them on `.av` or any ancestor. The main classes are `.av` (frame), `.av-bar` (toolbar), `.av-body` (content), `.av-btn`, `.av-badge`, `.av-full` (full screen).

## Libraries and loading

| Script in `dist/` | Library | Loaded for | License |
|---|---|---|---|
| `anyviewer.js` | AnyViewer core | always | MIT |
| `pdfjs.js`, `pdfjsworker.js` | pdf.js 3.11.174 | `pdf` | Apache-2.0 |
| `xlsx.js` | SheetJS CE 0.20.3 | `sheet` | Apache-2.0 |
| `jszip.js` | JSZip 3.10.1 | `zip`, `docx`, OOXML check | MIT / GPLv3 |
| `docxpreview.js` | docx-preview 0.3.5 | `docx` | Apache-2.0 |
| `hljs.js` | highlight.js 11.9.0 | `code`, `json`, `xml` | BSD-3-Clause |
| `marked.js` | marked 12.0.2 | `markdown` | MIT |
| `purify.js` | DOMPurify 3.1.6 | `markdown` | Apache-2.0 / MPL-2.0 |

Each library script is a wrapped build (made by [`scripts/build.mjs`](../scripts/build.mjs) from the library's original browser build, installed by npm at the exact version pinned in [`package.json`](../package.json)). Loading it only registers a function in `window.AnyViewerLibs`; AnyViewer calls that function, with the page's AMD `define` hidden, the first time it needs the library. So the scripts can all be on the page from the start (as OutSystems Required Scripts) without running anything, or be left out and fetched from `scriptsBaseUrl` on demand.

The pdf.js worker runs as a Web Worker from a blob URL, one per document. When workers are blocked (e.g. by a Content Security Policy without `blob:` in `worker-src`), pdf.js runs on the main thread instead.

## Security

- Nothing in a file is executed. HTML goes into an `<iframe sandbox="">` (no scripts, no same-origin access); Markdown output goes through DOMPurify; SVG is shown with `<img>`; spreadsheet cells and text are escaped.
- pdf.js runs with `isEvalSupported: false`.
- The viewer never sends the file anywhere. `url` sources are fetched by the browser like any other request.
