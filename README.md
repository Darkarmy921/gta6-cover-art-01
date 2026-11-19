# Neon Sunset Cover Studio

[![make.fun bounty](https://make.fun/bounty/gta6-cover-art-01)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA-style poster
cover art — the multi-panel look, bold condensed lettering, a Vice City sunset
or neon colour grade — and exports it as a PNG to share.

Built for the [make.fun "Make GTA 6 Cover Art" bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Any photo:** upload one or more photos from your machine. They are read
  locally with FileReader and never leave your computer.
- **Crop and position per panel:** click a panel to select it, drag to pan,
  scroll or use the slider to zoom, or pick a different photo for it.
- **Layouts:** Hero + 2 (one large panel, two small), 3-Panel Strip, 2 × 2
  Grid, and Full Bleed. Fill several panels with one photo or several.
- **Caption:** main title + subtitle/tagline, with size, position, colour
  and outline controls. The title is set in a bold condensed display face
  with an outline and gradient fill.
- **Colour grades:** Vice Sunset (pink/orange/teal), Neon Nights
  (magenta/cyan), Noir, and Palm Gold — each with a strength slider.
- **Export:** one-click PNG download in 1080 × 1080, 1080 × 1350 or
  1920 × 1080.
- **Original art:** the sun-and-palm badge, the skyline strips and the two
  sample photos are all drawn by code. No Rockstar Games logo, artwork or
  font is used anywhere. Display type is Noto Sans Condensed Black under the
  SIL Open Font License (see `app/fonts/OFL-1.1.txt`).

## How to run it

Any static server works. From the repository root:

```sh
python3 -m http.server 8080 --directory app
```

Then open `http://localhost:8080/` in a desktop browser. No build step, no
network requests — every script, font and image is a file under `app/`.

## How to use it

1. **Add photos** — click "Add photos from your machine" (or try a sample).
2. **Pick a layout** and a **colour grade**.
3. **Click a panel** to select it, drag to position the photo, scroll to zoom.
4. **Write your caption** — title, subtitle, size, colour, position.
5. **Choose an export size** and hit **Export PNG**.

## Files

- `app/index.html` — the editor page
- `app/style.css` — editor styling
- `app/app.js` — the cover engine (layouts, grades, lettering, export)
- `app/fonts/` — Noto Sans Condensed Black + Noto Sans Bold (SIL OFL 1.1)
- `app/samples/` — two sample scenes drawn by code (`tools/make-samples.mjs`)
- `main.ts` — the make.fun entry program (copies `app/` + `screenshots/`,
  writes `dossier.json`)
- `screenshots/` — the entry's screenshots

## License

MIT — see `LICENSE`. Fonts under `app/fonts/` are licensed under the SIL
Open Font License 1.1 (`app/fonts/OFL-1.1.txt`).
