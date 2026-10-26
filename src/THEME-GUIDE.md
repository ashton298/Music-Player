# Playlist Merger theme guide

This guide is written for an AI assistant. A person will paste it into a chat and describe the look they want. **Your job: produce a theme zip for the Playlist Merger desktop app.** If you can create files, make the zip. If you can't, give the person each file's full contents and tell them to put the files in one folder and zip it (Windows: right-click the folder > Compress to ZIP file; Mac: right-click > Compress).

The person imports the zip in the app with **Customize look > Import a theme (.zip)**.

## What goes in the zip

```
my-theme.zip
├── theme.json        required: name and settings
├── theme.css         optional: extra CSS for anything the settings can't do
├── background.jpg    optional: images (png, jpg, jpeg, gif, webp, avif, svg)
└── fonts/
    └── MyFont.woff2  optional: fonts (woff2, woff, ttf, otf)
```

- The files can sit at the top of the zip or inside one folder.
- **No JavaScript or HTML.** Only `.json`, `.css`, `.md`, `.txt`, images and fonts are read; anything else is ignored.
- Limits: 50 MB zip, 25 MB per file, 300 files, 512 KB `theme.css`. File and folder names may not start with a dot.
- The app has no internet fonts: bundle a font file in the zip, or use a font that's already installed (safe picks on Windows and Mac: Arial, Georgia, Verdana, Trebuchet MS, Courier New).

## theme.json

```json
{
  "name": "Midnight Neon",
  "author": "Your name",
  "version": 1,
  "css": "theme.css",
  "fonts": [
    { "family": "Space Grotesk", "file": "fonts/SpaceGrotesk.woff2", "weight": "300 700" }
  ],
  "settings": {
    "colorMode": "dark",
    "bg": "#0b0b14",
    "panel": "#141428",
    "raised": "#1f1f3d",
    "line": "#2c2c55",
    "text": "#f2f2ff",
    "muted": "#9a9ac8",
    "accent": "#ff2bd6",
    "accentText": "#ffffff",
    "font": "Space Grotesk",
    "radius": 14,
    "panelGap": 10,
    "shadow": 24,
    "bgImage": "background.jpg",
    "bgDim": 55,
    "bgBlur": 6,
    "panelOpacity": 78,
    "showQueue": true,
    "playerArt": 72
  }
}
```

- `name` (required): shown in the theme list. `author` is optional.
- `css` (optional): the CSS file's path. If left out, `theme.css` is used when it exists.
- `fonts` (optional): each entry has `family` (the name you use in `font` or in CSS), `file` (path in the zip), and optionally `weight` (`"400"`, `"bold"` or a range like `"300 700"`) and `style` (`"normal"` or `"italic"`).
- `settings`: any of the keys below. **Keys you leave out use their default**, so a theme only needs the keys it changes. Applying a theme replaces the person's current settings. Values outside the allowed range are clamped, and unknown keys are ignored.
- Colors must be hex: `#rgb`, `#rrggbb` or `#rrggbbaa`. Use `null` (or leave the key out) for the built-in color, which follows the light or dark `colorMode`.

## Settings

### Colors

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `colorMode` | Base colors | `"auto"`, `"dark"`, `"light"` | `"auto"` |
| `bg` | Background (`--bg`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `panel` | Panels and inputs (`--panel`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `raised` | Hover and selected (`--raised`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `line` | Borders (`--line`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `text` | Text (`--text`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `muted` | Secondary text (`--muted`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `accent` | Accent (`--accent`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `accentText` | Text on accent (`--accent-text`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `danger` | Delete and errors (`--danger`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `sidebarBg` | Sidebar background (`--sidebar-bg`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `queueBg` | Queue background (`--queue-bg`) | hex color, e.g. `"#1db954"`, or `null` | built-in |
| `playerBg` | Player background (`--player-bg`) | hex color, e.g. `"#1db954"`, or `null` | built-in |

### Text

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `font` | Font (`--font`) | a font family name (installed, or one from `fonts`) | `""` |
| `fontSize` | Text size (`--font-size`) | number 11 to 22 (px) | 14 |
| `headingSize` | Heading size (`--heading-size`) | number 14 to 56 (px) | 24 |
| `titleWeight` | Heading weight (`--title-weight`) | number 300 to 900 | 600 |

### Shape and size

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `radius` | Corner roundness (`--radius`) | number 0 to 28 (px) | 6 |
| `borderWidth` | Border thickness (`--border-w`) | number 0 to 4 (px) | 1 |
| `density` | Spacing (`--density`) | number 0.5 to 2 | 1 |
| `rowArt` | Song cover size (`--row-art`) | number 20 to 96 (px) | 40 |
| `playerArt` | Player cover size (`--player-art`) | number 32 to 160 (px) | 54 |
| `playBtn` | Play button size (`--play-btn`) | number 28 to 84 (px) | 38 |
| `panelGap` | Gap between panels (`--panel-gap`) | number 0 to 28 (px) | 0 |
| `shadow` | Panel shadow (`--shadow`) | number 0 to 48 (px) | 0 |

### Layout

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `sidebarSide` | Sidebar side | `"left"`, `"right"` | `"left"` |
| `sidebarWidth` | Sidebar width (`--sidebar-w`) | number 160 to 440 (px) | 240 |
| `showQueue` | Show the queue panel | `true` or `false` | `false` |
| `queueSide` | Queue side | `"right"`, `"left"` | `"right"` |
| `queueWidth` | Queue width (`--queue-w`) | number 220 to 560 (px) | 320 |
| `playerPos` | Player bar | `"bottom"`, `"top"` | `"bottom"` |
| `playerOrder` | Player bar order | the three names `"now"`, `"controls"`, `"extras"` in any order | `["now","controls","extras"]` |
| `contentMax` | Max content width (`--content-max`) | number 600 to 2400 (px) | 2400 |

### Show or hide

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `showBrand` | App name | `true` or `false` | `true` |
| `showArt` | Song covers in lists | `true` or `false` | `true` |
| `showNumbers` | Song numbers | `true` or `false` | `true` |
| `showBadges` | Spotify/YouTube/TikTok tags | `true` or `false` | `true` |
| `showDurations` | Song lengths | `true` or `false` | `true` |
| `showSources` | Playlist chips in a mix | `true` or `false` | `true` |
| `showStats` | Mix stats line | `true` or `false` | `true` |
| `showNowArt` | Cover in the player | `true` or `false` | `true` |
| `showShuffleRepeat` | Shuffle and repeat buttons | `true` or `false` | `true` |
| `showVolume` | Volume slider | `true` or `false` | `true` |

### Background

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `bgImage` | Background image | a file path inside the zip, or an `https://` image link | `""` |
| `bgFit` | Image fit | `"cover"`, `"contain"`, `"tile"` | `"cover"` |
| `bgDim` | Dim the image (`--bg-dim`) | number 0 to 95 (%) | 40 |
| `bgBlur` | Blur the image (`--bg-blur`) | number 0 to 40 (px) | 0 |
| `panelOpacity` | Panel opacity (`--panel-alpha`) | number 20 to 100 (%) | 100 |

### Motion

| Key | What it changes | Allowed values | Default |
|---|---|---|---|
| `animations` | Animations | `true` or `false` | `true` |

## theme.css: going further

`theme.css` loads after the app's own styles, so it can override anything. Relative `url()`s point into the zip, e.g. `url("images/noise.png")`. It's plain CSS: `@import` of other files in the zip works, and remote fonts don't load. Settings the person changes later in Customize are set as inline CSS variables on `<html>`, so they win over variables your CSS sets on `:root`.

Prefer settings where one exists: the person can then still tweak them with sliders. Use CSS for things like gradients, glows, textures, custom hover effects, or unusual shapes.

### CSS variables you can use or override

All the variables in the settings table above, plus `--spotify` and `--youtube` (tag colors), `--pad` (row padding), `--border` (the full border shorthand), and `--bg-image`, `--bg-size`, `--bg-repeat`.

### Page structure (stable class names and ids)

```
html[data-mode="light|dark"]            (no data-mode = follows the computer)
body.editing / .floating / .has-bg / .sidebar-right / .queue-left / .player-top / .hide-*
  .app#app                              CSS grid of the panels
    aside.sidebar.panel                 .brand, #new-mix, .jam-nav, .side-label, .mix-list button[aria-current], .side-tool
    main.main.panel#main
      section#empty.empty
      section#jam.jam                   .jam-start, .jam-card, .jam-active, .jam-head, .jam-code, .jam-row(.playing/.played)
      section#mix.mix                   .jam-banner, .mix-head, .mix-name, #mix-stats, .row, .add-form, .status,
                                        .source-list > .source, .badge(.spotify/.youtube/.tiktok)
        ol.track-list > li.track(.playing/.failed)
                                        .t-num, .t-art, .t-text > .t-title + .t-artist, .t-tags, .more-btn, .t-dur
    aside.queue-panel.panel#queue-panel .queue-head, .q-section, .q-section-head h3, .q-list > li.q-row(.playing/.clickable)
                                        .drag-handle, .q-remove
    footer.player.panel                 .player-part[data-part="now|controls|extras"][data-slot="first|mid|last"]
      .now > .now-art, .now-title, .now-sub
      .controls > .buttons > .icon-btn (#btn-shuffle, #btn-prev, #btn-play.play(.is-playing), #btn-next, #btn-repeat)
                  .seek > .time, input#seek
      .extras > #btn-queue, .volume > input#volume
  .bg-layer                             the background image (its ::after is the dim layer)
  .menu > .menu-item                    right-click song menu
  .toast                                short messages
  .customize                            the Customize drawer
```

Buttons: `.btn`, `.btn-primary`, `.btn-danger`, `.link-btn`, `.icon-btn`. Sliders are `input[type="range"]` and use `accent-color`.

### Rules for theme.css

- **Don't hide or cover the Customize drawer (`.customize`)** or the sidebar's **Customize look** button (`.side-tool`): that's how the person changes themes. (Ctrl+Shift+0 always resets the look, but don't rely on people knowing that.)
- Keep text readable: aim for a contrast ratio of at least 4.5:1 between `text` and `bg`/`panel`, and between `accentText` and `accent`.
- Don't use `position: fixed` on panels or change `display` on `.app`; use the layout settings instead.
- Don't load anything from the internet in CSS. Background images from `https://` links work, but they're fetched every time the app opens, so prefer images in the zip.

## Example theme.css

```css
/* Soft glow on the accent and a gradient player bar. */
.btn-primary { box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent); }
.track.playing .t-title { text-shadow: 0 0 10px var(--accent); }
.player { background: linear-gradient(90deg, #1a0f2e, #0f1a2e); }
.mix-name { letter-spacing: -0.02em; }
```

## Checklist before you hand over the zip

1. `theme.json` is valid JSON (no comments, no trailing commas) and has a `name`.
2. Every file named in `theme.json` (`css`, `fonts[].file`, `bgImage`) is in the zip at that exact path, with the same capitals.
3. Colors are hex strings.
4. No `.js` or `.html` files (they'd be ignored anyway).
