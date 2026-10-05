# Tile Configurator

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

```bash
npm install
npm start   # http://localhost:3000
```

```js
const total = lines.reduce((sum, l) => sum + l.price * l.m2, 0);
console.log(total.toFixed(2));
```

## Roadmap

1. Colour variations per tile
2. Share a design by link
3. ~~Internet Explorer support~~

<img src="x" onerror="alert('This must not run')">
<script>alert('Neither must this')</script>
