# The AnyViewer icon

How the AnyViewer icon and block preview were made, so they can be redrawn.

| File | Size | Used for |
| :--- | :--- | :--- |
| `icon-1024.png` … `icon-32.png` | 1024 → 32 | Application / module icon |
| `block-preview.png` (`@2x`) | 960 × 540 | Design-time preview inside the block (`If(False)` → True branch) |
| `icon.svg` | vector | Source of the icon |
| `preview.html` | — | Source of the block preview |
| `render.cjs` | — | Renders every PNG (`node render.cjs`) |

## The idea

The icon is a small picture of what the block shows: a viewer window with a
toolbar on top and a document in the body. There is no logo or letter.

| Part | Stands for | Colour |
| :--- | :--- | :--- |
| Background | The viewer's accent (`--color-primary` fallback) | `#1068eb` |
| White window | The `.av` frame | `#ffffff` |
| Grey strip | The toolbar (`.av-bar`) | `#e3e7ec` |
| Dark bar | The file name (`.av-name`) | `#212529` |
| Blue pill | The type badge (`.av-badge`) | `#1068eb` |
| Picture | Rendered content: an image | `#cfe0fc` / `#1068eb` / white |
| Grey bars | Rendered content: text, left aligned, ragged right | `#adb5bd` |

The picture plus text means "any document". The colours are the ones the
viewer's own CSS in `anyviewer.js` uses, so the icon, the preview and the
running block match.

## Rules

- **Full bleed:** the blue fills the whole square, with no transparency and no
  rounded corners in the file. The platform applies its own mask.
- **Safe zone:** the window stays inside a circle with a radius of 40% of the
  size (window corner at about 39.6%, minus the corner radius).
- **Bold at small sizes:** the text bars and toolbar marks are about 5.5–6% of the
  icon, so they still read at 64 px.
- **Vector source:** every size is rendered from `icon.svg` at that size (headless
  Chrome) instead of shrinking one bitmap.

## The block preview

`preview.html` is static markup that uses the viewer's real classes (`.av`,
`.av-bar`, `.av-badge`, `.av-pdf`, …); it loads `anyviewer.js` only to inject that
CSS. The page shows the same picture-and-lines motif as the icon. Outside the
frame it is transparent.

Inside the block it goes in an `If` whose condition is `False`: it never renders
at runtime, but Service Studio draws the True branch on the canvas, so a screen
that uses the block shows this picture instead of an empty container.

## Redrawing

Needs Node and Chrome; `puppeteer-core` comes from the repository's `npm install`.

```
cd assets
node render.cjs
```
