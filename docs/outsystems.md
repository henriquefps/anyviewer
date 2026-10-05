# Using AnyViewer in OutSystems

AnyViewer started as an OutSystems 11 Reactive library, and the JavaScript in this repository is exactly what that library ships. This guide describes the two modules, how the block is built, how to use it in an app, and how to update the scripts after changing the code here.

## 1. The modules

| Module | Type | Contents |
|---|---|---|
| **AnyViewer** | Reactive Library | The `AnyViewer` block, the nine scripts from [`dist/`](../dist), the block preview image |
| **AnyViewer_Demo** | Reactive App | A `Demo` screen: an Upload widget, a URL field and the block, with the last event shown as a status line |

The `.oml` files are not in this repository (see `.gitignore`); they live in the OutSystems environment.

## 2. The `AnyViewer` block

A public block, with a single container (`ViewerHost`, class `anyviewer-host`) that the viewer renders into.

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `FileContent` | Binary Data | | File content. Takes priority over `FileUrl` when filled. |
| `FileUrl` | Text | | URL to fetch the file from (same origin or CORS-enabled). Used when `FileContent` is empty. |
| `FileName` | Text | | Its extension drives type detection and the download name. |
| `MimeType` | Text | | Optional. When empty, the type comes from the file name and content. |
| `Height` | Text | `"600px"` | CSS height, e.g. `"80vh"`. |
| `ShowToolbar` | Boolean | `True` | File name, zoom, download and full screen. |
| `AllowDownload` | Boolean | `True` | Shows the download button. |
| `ScriptsBaseUrl` | Text | | Advanced. Prefix of the scripts, e.g. `"/MyApp/scripts/AnyViewer."`. Empty = auto-detected. |

### Events

| Event | Parameter | When |
|---|---|---|
| `OnRendered` | `DetectedType` (Text) | The file is shown. `image`, `pdf`, `sheet`, `docx`, `zip`, `text`, `code`, `json`, `xml`, `markdown`, `html`, `video`, `audio`, `binary` or `none`. |
| `OnError` | `ErrorMessage` (Text) | The file could not be loaded or shown. |

### Logic

`OnReady` and `OnParametersChanged` both go to the `Render` screen action; `OnDestroy` goes to `Destroy`. Each holds one JavaScript node.

**`Render` → `RenderViewer`** (inputs: `HostId = ViewerHost.Id` and every block input). Binary Data reaches a JavaScript node as base64, which is what `AnyViewer.render` expects. If the core script is somehow not on the page yet, the node loads it first.

```js
var hostId = $parameters.HostId;
var baseUrl = $parameters.ScriptsBaseUrl;
var opts = {
  base64: $parameters.FileContent,
  url: $parameters.FileUrl,
  fileName: $parameters.FileName,
  mimeType: $parameters.MimeType,
  height: $parameters.Height,
  showToolbar: $parameters.ShowToolbar,
  allowDownload: $parameters.AllowDownload,
  scriptsBaseUrl: baseUrl,
  onRendered: function (t) { $actions.NotifyRendered(t); },
  onError: function (m) { $actions.NotifyError(m); }
};
function coreUrl() {
  if (baseUrl) return baseUrl + 'anyviewer.js';
  var s = document.querySelector('script[src*="/scripts/"]');
  var src = s ? s.getAttribute('src') : '';
  var i = src.indexOf('/scripts/');
  return (i >= 0 ? src.substring(0, i + 9) : 'scripts/') + 'AnyViewer.anyviewer.js';
}
function go() { window.AnyViewer.render(hostId, opts); }
if (window.AnyViewer) { go(); return; }
window.__anyViewerLoading = window.__anyViewerLoading || new Promise(function (resolve, reject) {
  var el = document.createElement('script');
  el.src = coreUrl();
  el.onload = resolve;
  el.onerror = function () { window.__anyViewerLoading = null; reject(new Error('Could not load ' + el.src)); };
  document.head.appendChild(el);
});
window.__anyViewerLoading.then(go, function (e) { $actions.NotifyError(e.message); });
```

`NotifyRendered` and `NotifyError` are screen actions that only trigger `OnRendered` and `OnError`.

Because `render` returns early when nothing changed, `OnParametersChanged` can call it freely: only a real change (another file, height, toolbar…) rebuilds the viewer.

**`Destroy` → `DestroyViewer`** (input: `HostId = ViewerHost.Id`):

```js
if (window.AnyViewer) { window.AnyViewer.destroy($parameters.HostId); }
```

### Design-time preview

Inside `ViewerHost` there is an `If` whose condition is `False`, with an image (`blockpreview_2x`) in its True branch. It never renders at runtime, but Service Studio draws the True branch on the canvas, so a screen that uses the block shows a picture of a viewer instead of an empty container. The image and the module icon are made from [`assets/`](../assets) (see [`assets/ICON.md`](../assets/ICON.md)).

## 3. The scripts

All nine files of [`dist/`](../dist) are imported into the **AnyViewer** module (Interface → Scripts → Import Script), keeping their names, and every one is a **Required Script of the `AnyViewer` block**:

`anyviewer`, `pdfjs`, `pdfjsworker`, `xlsx`, `jszip`, `docxpreview`, `hljs`, `marked`, `purify`

Why all of them, and why wrapped:

- **OutSystems only ships a library's scripts to the modules that consume it when a block requires them.** A script that is only in the library, not required, is never published with the consumer app.
- **Required Scripts run as soon as the page loads, with the Reactive runtime's AMD `define` in place.** A plain UMD build would register itself as an anonymous AMD module and leave no global behind, and loading 2.6 MB of libraries on every page would be wasteful.
- So each library file in `dist/` is a wrapped build: loading it only stores a function in `window.AnyViewerLibs`. AnyViewer calls that function, with `define` hidden, the first time a file type needs it. A page with the block downloads the scripts (the browser caches them) but runs only the core until a file is shown.
- The wrapper also hides the runtime's RequireJS `require` from the library code. JSZip calls `require("stream")` while reading an archive; RequireJS answers with a "not loaded yet" error that OutSystems would send to its error screen.

In the published app the scripts are served as `/<App>/scripts/AnyViewer.<name>.js`. That is how `ScriptsBaseUrl` is auto-detected; set it only if your setup serves them elsewhere.

[`tests/outsystems-mode.html`](../tests/outsystems-mode.html) reproduces these conditions (an AMD `define`, a throwing `require`, every script loaded up front, nothing fetchable), and `npm run e2e` checks every sample against it.

## 4. Using the block in an app

1. In your app, **Manage Dependencies** → AnyViewer → the `AnyViewer` block.
2. Drop the block on a screen and fill `FileName` plus either `FileContent` or `FileUrl`.
3. Optionally handle `OnRendered` / `OnError`.

Typical sources:

| Source | `FileContent` | `FileName` |
|---|---|---|
| An entity with a binary attribute | `GetDocumentById.List.Current.Document.Content` | `GetDocumentById.List.Current.Document.FileName` |
| An Upload widget | the Upload's content variable | the Upload's file name variable |
| A server action that returns Binary Data | a data action's output | its file name output |

For large files, prefer `FileUrl` pointing at an endpoint of your app (for example a REST API method that returns the binary with a `Content-Type` and a `Content-Disposition` file name): the bytes then never travel through the screen's data. The request is same-origin, so the user's session cookie goes with it.

The demo screen, for reference: local variables `FileContent`, `FileName`, `FileUrl`, `UrlInput` and `Status`; an Upload widget bound to `FileContent`/`FileName`; a "Load URL" button (`LoadUrl` passes `UrlInput` to the block as `FileUrl`); and `ViewerOnRendered` / `ViewerOnError` writing `"Rendered as: " + DetectedType` or `"Error: " + ErrorMessage` into `Status`. [`tests/outsystems-live.mjs`](../tests/outsystems-live.mjs) drives that screen in a published environment:

```bash
node tests/outsystems-live.mjs https://<your-environment>/AnyViewer_Demo/
```

## 5. Updating the scripts

After changing [`src/anyviewer.js`](../src/anyviewer.js) or a library version in [`package.json`](../package.json) (they are pinned exactly):

```bash
npm install
npm run build      # rewrites dist/
npm test && npm run e2e
```

Then, in Service Studio, open each changed script of the AnyViewer module and **Replace** it with the file from `dist/` (keep the names), publish AnyViewer, and refresh the dependency in the consumer apps.

## 6. Notes for production

- **Content Security Policy.** The pdf.js worker starts from a `blob:` URL, and libraries fetched on demand are injected as inline scripts. With a strict CSP, allow `blob:` in `worker-src` (otherwise PDFs render on the main thread, slower but working) and keep every library a Required Script so nothing is fetched.
- **Big files.** Base64 inputs live in memory three times (base64, bytes, blob). Use `FileUrl` for files above a few tens of megabytes.
- **What is not supported.** PowerPoint, legacy Word (`.doc`), TIFF/HEIC images and archives other than ZIP show a clear message and a download button.
