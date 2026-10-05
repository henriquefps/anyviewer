# Changelog

## Unreleased

- Social preview image.
- Live demo at anyviewer.hfps.dev.

## 1.0.0 (2026-10-04)

First public release of AnyViewer, the document previewer of the OutSystems `AnyViewer` library.

- Images (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG) with zoom; SVG shown as an image, so its scripts never run.
- PDF with pdf.js: pages drawn when they scroll into view, zoom, a page counter; the worker runs from a blob URL, or on the main thread when workers are blocked.
- Excel, ODS and CSV/TSV with SheetJS: one tab per sheet, first 5,000 rows per sheet.
- Word (DOCX) with docx-preview: page breaks, tables, headers and footers.
- ZIP archives with JSZip: file tree and a nested viewer for each entry, up to three levels deep.
- Text, logs, JSON (pretty-printed), XML and 36 programming languages with highlight.js.
- Markdown with marked, sanitised with DOMPurify; HTML in a sandboxed iframe with no permissions.
- Audio and video with the browser's own player.
- Type detection from the extension, the MIME type and the file's first bytes; Office files report their own MIME type.
- Libraries load on demand. In OutSystems they are Required Scripts that only register a factory, so nothing heavy runs at page load and the platform's AMD loader and RequireJS never see them.
- Narrow viewers (phones, side panels) put the file name on its own toolbar row.
- Demo app with seventeen generated samples, English and Portuguese, an event log and drag and drop.
- Unit tests of type detection; end-to-end tests in headless Chrome, including an OutSystems mode.
