// Customizing the look: every setting below can be changed in the Customize
// drawer, by dragging on screen in "Edit layout" mode, or by a theme zip
// (theme.json "settings" uses the same keys; see src/THEME-GUIDE.md).
//
// Loaded last and uses app.js / queue.js globals ($, el, toast, renderQueue).

const PLAYER_PARTS = ["now", "controls", "extras"];
const PART_LABELS = { now: "Song", controls: "Controls", extras: "Queue + volume" };

// type: color | range | select | toggle | text | order. css: the CSS variable it sets.
const UI_SCHEMA = [
  { group: "Colors", key: "colorMode", type: "select", label: "Base colors", options: { auto: "Follow Windows/Mac", dark: "Dark", light: "Light" }, default: "auto" },
  { group: "Colors", key: "bg", type: "color", label: "Background", css: "--bg" },
  { group: "Colors", key: "panel", type: "color", label: "Panels and inputs", css: "--panel" },
  { group: "Colors", key: "raised", type: "color", label: "Hover and selected", css: "--raised" },
  { group: "Colors", key: "line", type: "color", label: "Borders", css: "--line" },
  { group: "Colors", key: "text", type: "color", label: "Text", css: "--text" },
  { group: "Colors", key: "muted", type: "color", label: "Secondary text", css: "--muted" },
  { group: "Colors", key: "accent", type: "color", label: "Accent", css: "--accent" },
  { group: "Colors", key: "accentText", type: "color", label: "Text on accent", css: "--accent-text" },
  { group: "Colors", key: "danger", type: "color", label: "Delete and errors", css: "--danger" },
  { group: "Colors", key: "sidebarBg", type: "color", label: "Sidebar background", css: "--sidebar-bg" },
  { group: "Colors", key: "queueBg", type: "color", label: "Queue background", css: "--queue-bg" },
  { group: "Colors", key: "playerBg", type: "color", label: "Player background", css: "--player-bg" },

  { group: "Text", key: "font", type: "text", label: "Font", css: "--font", default: "", placeholder: "Default (Segoe UI / system)", suggestions: ["Segoe UI", "Arial", "Georgia", "Consolas", "Trebuchet MS", "Verdana", "Comic Sans MS", "Courier New"] },
  { group: "Text", key: "fontSize", type: "range", label: "Text size", css: "--font-size", unit: "px", min: 11, max: 22, step: 1, default: 14 },
  { group: "Text", key: "headingSize", type: "range", label: "Heading size", css: "--heading-size", unit: "px", min: 14, max: 56, step: 1, default: 24 },
  { group: "Text", key: "titleWeight", type: "range", label: "Heading weight", css: "--title-weight", unit: "", min: 300, max: 900, step: 100, default: 600 },

  { group: "Shape and size", key: "radius", type: "range", label: "Corner roundness", css: "--radius", unit: "px", min: 0, max: 28, step: 1, default: 6 },
  { group: "Shape and size", key: "borderWidth", type: "range", label: "Border thickness", css: "--border-w", unit: "px", min: 0, max: 4, step: 1, default: 1 },
  { group: "Shape and size", key: "density", type: "range", label: "Spacing", css: "--density", unit: "", min: 0.5, max: 2, step: 0.05, default: 1 },
  { group: "Shape and size", key: "rowArt", type: "range", label: "Song cover size", css: "--row-art", unit: "px", min: 20, max: 96, step: 2, default: 40 },
  { group: "Shape and size", key: "playerArt", type: "range", label: "Player cover size", css: "--player-art", unit: "px", min: 32, max: 160, step: 2, default: 54 },
  { group: "Shape and size", key: "playBtn", type: "range", label: "Play button size", css: "--play-btn", unit: "px", min: 28, max: 84, step: 2, default: 38 },
  { group: "Shape and size", key: "panelGap", type: "range", label: "Gap between panels", css: "--panel-gap", unit: "px", min: 0, max: 28, step: 1, default: 0 },
  { group: "Shape and size", key: "shadow", type: "range", label: "Panel shadow", css: "--shadow", unit: "px", min: 0, max: 48, step: 1, default: 0 },

  { group: "Layout", key: "sidebarSide", type: "select", label: "Sidebar side", options: { left: "Left", right: "Right" }, default: "left" },
  { group: "Layout", key: "sidebarWidth", type: "range", label: "Sidebar width", css: "--sidebar-w", unit: "px", min: 160, max: 440, step: 2, default: 240 },
  { group: "Layout", key: "showQueue", type: "toggle", label: "Show the queue panel", default: false },
  { group: "Layout", key: "queueSide", type: "select", label: "Queue side", options: { right: "Right", left: "Left" }, default: "right" },
  { group: "Layout", key: "queueWidth", type: "range", label: "Queue width", css: "--queue-w", unit: "px", min: 220, max: 560, step: 2, default: 320 },
  { group: "Layout", key: "playerPos", type: "select", label: "Player bar", options: { bottom: "Bottom", top: "Top" }, default: "bottom" },
  { group: "Layout", key: "playerOrder", type: "order", label: "Player bar order", default: PLAYER_PARTS },
  { group: "Layout", key: "contentMax", type: "range", label: "Max content width", css: "--content-max", unit: "px", min: 600, max: 2400, step: 20, default: 2400 },

  { group: "Show or hide", key: "showBrand", type: "toggle", label: "App name", default: true },
  { group: "Show or hide", key: "showArt", type: "toggle", label: "Song covers in lists", default: true },
  { group: "Show or hide", key: "showNumbers", type: "toggle", label: "Song numbers", default: true },
  { group: "Show or hide", key: "showBadges", type: "toggle", label: "Spotify/YouTube/TikTok tags", default: true },
  { group: "Show or hide", key: "showDurations", type: "toggle", label: "Song lengths", default: true },
  { group: "Show or hide", key: "showSources", type: "toggle", label: "Playlist chips in a mix", default: true },
  { group: "Show or hide", key: "showStats", type: "toggle", label: "Mix stats line", default: true },
  { group: "Show or hide", key: "showNowArt", type: "toggle", label: "Cover in the player", default: true },
  { group: "Show or hide", key: "showShuffleRepeat", type: "toggle", label: "Shuffle and repeat buttons", default: true },
  { group: "Show or hide", key: "showVolume", type: "toggle", label: "Volume slider", default: true },

  { group: "Background", key: "bgImage", type: "text", label: "Background image", default: "", placeholder: "A file in your theme, or an https link" },
  { group: "Background", key: "bgFit", type: "select", label: "Image fit", options: { cover: "Fill", contain: "Fit", tile: "Tile" }, default: "cover" },
  { group: "Background", key: "bgDim", type: "range", label: "Dim the image", css: "--bg-dim", unit: "%", min: 0, max: 95, step: 1, default: 40 },
  { group: "Background", key: "bgBlur", type: "range", label: "Blur the image", css: "--bg-blur", unit: "px", min: 0, max: 40, step: 1, default: 0 },
  { group: "Background", key: "panelOpacity", type: "range", label: "Panel opacity", css: "--panel-alpha", unit: "%", min: 20, max: 100, step: 1, default: 100 },

  { group: "Motion", key: "animations", type: "toggle", label: "Animations", default: true },
];

const SCHEMA = Object.fromEntries(UI_SCHEMA.map((f) => [f.key, f]));
const DEFAULTS = Object.fromEntries(UI_SCHEMA.map((f) => [f.key, f.default ?? null]));
const LAYOUT_KEYS = ["sidebarSide", "sidebarWidth", "showQueue", "queueSide", "queueWidth", "playerPos", "playerOrder", "playerArt", "contentMax"];

// ---- Cleaning values (themes are untrusted) -----------------------------------

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function cleanValue(f, v) {
  switch (f.type) {
    case "color":
      return typeof v === "string" && HEX.test(v.trim()) ? v.trim() : null;
    case "range": {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(f.min, Math.min(f.max, n)) : f.default;
    }
    case "select":
      return Object.hasOwn(f.options, v) ? v : f.default;
    case "toggle":
      return typeof v === "boolean" ? v : f.default;
    case "order":
      return Array.isArray(v) && v.length === PLAYER_PARTS.length && PLAYER_PARTS.every((p) => v.includes(p)) ? [...v] : [...f.default];
    case "text": {
      if (typeof v !== "string") return f.default;
      const s = v.trim().slice(0, 300);
      if (f.key === "font") return s.replace(/[;{}<>\\"']/g, "");
      if (f.key === "bgImage") return /^https:\/\/[^\s"'()\\]+$/.test(s) || (/^[\w\-. /]+$/.test(s) && !s.split("/").includes("..")) ? s : "";
      return s;
    }
  }
  return null;
}

function cleanSettings(raw) {
  const out = { ...DEFAULTS, playerOrder: [...PLAYER_PARTS] };
  if (raw && typeof raw === "object") for (const f of UI_SCHEMA) if (Object.hasOwn(raw, f.key)) out[f.key] = cleanValue(f, raw[f.key]);
  return out;
}

// ---- State ------------------------------------------------------------------------

const ui = (window.ui = {
  settings: cleanSettings(null),
  theme: null, // { id, name, json, css } of the applied theme, or null
  themes: [],
  editing: false,
  fontFaces: [],
});

function loadUi() {
  try {
    const saved = JSON.parse(localStorage.getItem("ui-settings") || "null");
    ui.settings = cleanSettings(saved?.settings);
    ui.themeId = typeof saved?.themeId === "string" ? saved.themeId : null;
  } catch {
    ui.settings = cleanSettings(null);
  }
}

function saveUi() {
  try {
    localStorage.setItem("ui-settings", JSON.stringify({ settings: ui.settings, themeId: ui.theme?.id ?? null }));
  } catch {}
}

// ---- Applying ---------------------------------------------------------------------

const rootEl = document.documentElement;

function applyUi() {
  const s = ui.settings;
  for (const f of UI_SCHEMA) {
    if (!f.css) continue;
    const v = s[f.key];
    if (v === null || v === "" || v === undefined) rootEl.style.removeProperty(f.css);
    else if (f.key === "font") rootEl.style.setProperty(f.css, `"${v}", "Segoe UI", system-ui, sans-serif`);
    else rootEl.style.setProperty(f.css, `${v}${f.unit ?? ""}`);
  }
  if (s.colorMode === "auto") delete rootEl.dataset.mode;
  else rootEl.dataset.mode = s.colorMode;

  for (const f of UI_SCHEMA) if (f.type === "toggle" && f.key.startsWith("show") && f.key !== "showQueue") document.body.classList.toggle(`hide-${f.key.slice(4).toLowerCase()}`, !s[f.key]);
  document.body.classList.toggle("no-motion", !s.animations);
  document.body.classList.toggle("floating", s.panelGap > 0);

  // Background image: a file inside the applied theme, or an https link.
  let bg = "";
  if (/^https:\/\//.test(s.bgImage)) bg = s.bgImage;
  else if (s.bgImage && ui.theme) bg = `pmtheme://${ui.theme.id}/${s.bgImage.split("/").map(encodeURIComponent).join("/")}`;
  if (bg) rootEl.style.setProperty("--bg-image", `url("${bg}")`);
  else rootEl.style.removeProperty("--bg-image");
  document.body.classList.toggle("has-bg", !!bg);
  rootEl.style.setProperty("--bg-size", s.bgFit === "tile" ? "auto" : s.bgFit);
  rootEl.style.setProperty("--bg-repeat", s.bgFit === "tile" ? "repeat" : "no-repeat");

  applyLayout();
}

function applyLayout() {
  const s = ui.settings;
  const app = $("app");
  const left = [];
  const right = [];
  (s.sidebarSide === "right" ? right : left).push("side");
  if (s.showQueue) {
    if (s.queueSide === "left") left.push("queue");
    else right.unshift("queue");
  }
  const cols = [...left, "main", ...right];
  const width = { side: "var(--sidebar-w)", queue: "var(--queue-w)", main: "minmax(0, 1fr)" };
  const row = `"${cols.join(" ")}"`;
  const playerRow = `"${cols.map(() => "player").join(" ")}"`;
  app.style.gridTemplateColumns = cols.map((c) => width[c]).join(" ");
  app.style.gridTemplateAreas = s.playerPos === "top" ? `${playerRow} ${row}` : `${row} ${playerRow}`;
  app.style.gridTemplateRows = s.playerPos === "top" ? "auto minmax(0, 1fr)" : "minmax(0, 1fr) auto";
  document.body.classList.toggle("sidebar-right", s.sidebarSide === "right");
  document.body.classList.toggle("queue-left", s.queueSide === "left");
  document.body.classList.toggle("player-top", s.playerPos === "top");
  s.playerOrder.forEach((part, i) => {
    const node = document.querySelector(`[data-part="${part}"]`);
    if (!node) return;
    node.style.order = String(i);
    node.dataset.slot = ["first", "mid", "last"][i];
  });
  const wasHidden = $("queue-panel").hidden;
  $("queue-panel").hidden = !s.showQueue;
  $("btn-queue").setAttribute("aria-pressed", String(s.showQueue));
  $("btn-queue").title = s.showQueue ? "Hide the queue" : "Show the queue";
  if (wasHidden && s.showQueue) renderQueue();
}

// Changes settings, saves them and updates the screen (and the drawer's inputs).
ui.set = (patch, { save = true } = {}) => {
  for (const [k, v] of Object.entries(patch)) if (SCHEMA[k]) ui.settings[k] = cleanValue(SCHEMA[k], v);
  applyUi();
  if (save) saveUi();
  syncDrawerInputs(Object.keys(patch));
};

// ---- Themes -----------------------------------------------------------------------

function applyThemeFiles() {
  for (const face of ui.fontFaces) document.fonts.delete(face);
  ui.fontFaces = [];
  $("theme-css")?.remove();
  const t = ui.theme;
  if (!t) return;
  for (const f of Array.isArray(t.json.fonts) ? t.json.fonts.slice(0, 20) : []) {
    if (!f || typeof f.family !== "string" || typeof f.file !== "string" || !/^[\w\-. /]+$/.test(f.file) || f.file.split("/").includes("..")) continue;
    const url = `pmtheme://${t.id}/${f.file.split("/").map(encodeURIComponent).join("/")}`;
    const descriptors = {};
    if (/^\d{3}( \d{3})?$|^(normal|bold)$/.test(f.weight ?? "")) descriptors.weight = String(f.weight);
    if (/^(normal|italic)$/.test(f.style ?? "")) descriptors.style = f.style;
    try {
      const face = new FontFace(f.family.replace(/["\\]/g, "").slice(0, 80), `url("${url}")`, descriptors);
      document.fonts.add(face);
      face.load().catch(() => console.warn(`Theme font ${f.file} didn't load`));
      ui.fontFaces.push(face);
    } catch {}
  }
  if (t.css) {
    const link = el("link", { id: "theme-css", rel: "stylesheet", href: `pmtheme://${t.id}/${t.css.split("/").map(encodeURIComponent).join("/")}?v=${Date.now()}` });
    document.head.append(link);
  }
}

function applyTheme(theme) {
  ui.theme = theme;
  ui.settings = cleanSettings(theme?.json?.settings);
  applyThemeFiles();
  applyUi();
  saveUi();
  renderDrawer();
}

async function refreshThemes() {
  try {
    ui.themes = await window.api.listThemes();
  } catch {
    ui.themes = [];
  }
}

async function importThemeFile(file) {
  if (!file) return;
  if (!/\.zip$/i.test(file.name)) return toast("Pick a .zip theme file.");
  toast(`Opening ${file.name}…`);
  try {
    const theme = await window.api.importTheme(new Uint8Array(await file.arrayBuffer()));
    await refreshThemes();
    applyTheme(theme);
    toast(`Applied the "${theme.name}" theme.`);
  } catch (e) {
    toast(`Couldn't use that theme: ${e.message}`);
  }
}

async function deleteTheme(t) {
  await window.api.removeTheme(t.id).catch((e) => toast(e.message));
  if (ui.theme?.id === t.id) {
    ui.theme = null;
    applyThemeFiles();
    applyUi();
    saveUi();
    applyBgOnlyWarning();
  }
  await refreshThemes();
  renderDrawer();
}

// A background image file only works while its theme is applied.
function applyBgOnlyWarning() {
  if (ui.settings.bgImage && !/^https:/.test(ui.settings.bgImage) && !ui.theme) ui.set({ bgImage: "" });
}

function resetAll() {
  applyTheme(null);
  toast("Back to the default look.");
}

async function copyGuide() {
  try {
    const guide = await window.api.themeGuide();
    const current = JSON.stringify({ name: ui.theme?.name || "My theme", version: 1, settings: ui.settings }, null, 2);
    await navigator.clipboard.writeText(`${guide}\n\n## The look I have right now\n\nThis is my current theme.json. Change it as I ask, or start fresh.\n\n\`\`\`json\n${current}\n\`\`\`\n`);
    toast("Copied the theme guide. Paste it into an AI chat and describe the look you want.");
  } catch (e) {
    toast(`Couldn't copy: ${e.message}`);
  }
}

// ---- Customize drawer --------------------------------------------------------------

const drawer = $("customize");
const openGroups = new Set(["Themes"]);

function renderDrawer() {
  if (drawer.hidden) return;
  const scroll = drawer.querySelector(".cz-body")?.scrollTop ?? 0;
  const fileInput = el("input", { type: "file", accept: ".zip,application/zip", hidden: "", onchange: (e) => importThemeFile(e.target.files[0]) });
  const nameInput = el("input", { type: "text", class: "cz-text", maxlength: "60", value: ui.theme?.name || "My theme", "aria-label": "Theme name" });

  const themeRow = (t) =>
    el(
      "li",
      { class: ["cz-theme", (ui.theme?.id ?? null) === (t?.id ?? null) ? "active" : ""].join(" ") },
      el("div", { class: "cz-theme-name" }, t ? t.name : "Default", t?.author ? el("span", { class: "muted" }, ` by ${t.author}`) : null),
      (ui.theme?.id ?? null) === (t?.id ?? null)
        ? el("span", { class: "muted" }, "In use")
        : el("button", { type: "button", class: "link-btn", onclick: () => (t ? applyTheme(t) : resetAll()) }, "Use"),
      t ? el("button", { type: "button", class: "link-btn", title: "Delete this theme", onclick: () => deleteTheme(t) }, "Delete") : null,
    );

  const groups = [...new Set(UI_SCHEMA.map((f) => f.group))];
  const body = el(
    "div",
    { class: "cz-body" },
    el("button", { type: "button", class: "btn btn-primary cz-edit", onclick: () => (closeDrawer(), editLayout(true)) }, "Move and resize panels on screen"),
    group(
      "Themes",
      el("ul", { class: "cz-themes" }, themeRow(null), ...ui.themes.map(themeRow)),
      el(
        "div",
        { class: "cz-drop", ondragover: (e) => (e.preventDefault(), e.currentTarget.classList.add("over")), ondragleave: (e) => e.currentTarget.classList.remove("over"), ondrop: (e) => (e.preventDefault(), e.currentTarget.classList.remove("over"), importThemeFile(e.dataTransfer.files[0])) },
        el("button", { type: "button", class: "btn btn-primary", onclick: () => fileInput.click() }, "Import a theme (.zip)"),
        el("span", { class: "muted" }, "or drop a zip here"),
        fileInput,
      ),
      el(
        "p",
        { class: "muted cz-help" },
        "Make your own with an AI: copy the theme guide, paste it into ChatGPT, Claude or Gemini, describe the look, and ask for a theme zip.",
      ),
      el(
        "div",
        { class: "cz-buttons" },
        el("button", { type: "button", class: "btn", onclick: copyGuide }, "Copy AI theme guide"),
        el("button", { type: "button", class: "btn", onclick: () => window.api.saveThemeGuide().then((p) => p && toast("Saved the theme guide.")).catch((e) => toast(e.message)) }, "Save guide as a file"),
      ),
      el(
        "label",
        { class: "cz-field" },
        el("span", {}, "Save this look as a theme"),
        el(
          "div",
          { class: "cz-inline" },
          nameInput,
          el(
            "button",
            {
              type: "button",
              class: "btn",
              onclick: () =>
                window.api
                  .exportTheme({ settings: ui.settings, name: nameInput.value.trim() || "My theme", fromId: ui.theme?.id ?? null })
                  .then((p) => p && toast("Saved the theme zip. Send it to friends so they can import it."))
                  .catch((e) => toast(e.message)),
            },
            "Export .zip",
          ),
        ),
      ),
    ),
    ...groups.map((g) => group(g, ...UI_SCHEMA.filter((f) => f.group === g).map(control))),
    el(
      "div",
      { class: "cz-footer" },
      el("button", { type: "button", class: "btn btn-danger", onclick: resetAll }, "Reset everything to default"),
      el("p", { class: "muted cz-help" }, "If a theme makes the app hard to use, press Ctrl+Shift+0 to go back to the default look."),
    ),
  );
  drawer.replaceChildren(
    el("header", { class: "cz-head" }, el("h2", {}, "Customize"), el("button", { type: "button", class: "link-btn", onclick: closeDrawer, "aria-label": "Close" }, "Close")),
    body,
  );
  body.scrollTop = scroll;
}

function group(title, ...children) {
  const details = el("details", { class: "cz-group", ontoggle: (e) => (e.currentTarget.open ? openGroups.add(title) : openGroups.delete(title)) }, el("summary", {}, title), ...children);
  details.open = openGroups.has(title);
  return details;
}

// The color a CSS variable currently resolves to, as #rrggbb for <input type=color>.
function currentColor(cssVar) {
  const probe = el("span", {});
  probe.style.color = `var(${cssVar})`;
  document.body.append(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [0, 0, 0];
  probe.remove();
  return "#" + rgb.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("");
}

function control(f) {
  const v = ui.settings[f.key];
  const id = `cz-${f.key}`;
  let input;
  switch (f.type) {
    case "color": {
      input = el("input", { id, type: "color", "data-key": f.key, value: v ? v.slice(0, 7) : currentColor(f.css), oninput: (e) => ui.set({ [f.key]: e.target.value }) });
      const reset = v ? el("button", { type: "button", class: "link-btn", title: "Use the theme's color", onclick: () => (ui.set({ [f.key]: null }), renderDrawer()) }, "Reset") : null;
      return el("div", { class: "cz-row" }, el("label", { for: id }, f.label), el("span", { class: "cz-inline" }, reset, input));
    }
    case "range": {
      const out = el("output", { for: id, class: "cz-out" }, `${v}${f.unit}`);
      input = el("input", {
        id,
        type: "range",
        "data-key": f.key,
        min: String(f.min),
        max: String(f.max),
        step: String(f.step),
        value: String(v),
        oninput: (e) => {
          out.textContent = `${e.target.value}${f.unit}`;
          ui.set({ [f.key]: Number(e.target.value) });
        },
      });
      return el("div", { class: "cz-row cz-range" }, el("label", { for: id }, f.label, out), input);
    }
    case "select":
      input = el("select", { id, "data-key": f.key, onchange: (e) => ui.set({ [f.key]: e.target.value }) }, ...Object.entries(f.options).map(([k, label]) => el("option", { value: k, ...(k === v ? { selected: "" } : {}) }, label)));
      return el("div", { class: "cz-row" }, el("label", { for: id }, f.label), input);
    case "toggle":
      input = el("input", { id, type: "checkbox", "data-key": f.key, ...(v ? { checked: "" } : {}), onchange: (e) => ui.set({ [f.key]: e.target.checked }) });
      return el("label", { class: "cz-row cz-toggle", for: id }, el("span", {}, f.label), input);
    case "text": {
      const listId = f.suggestions ? `${id}-list` : null;
      input = el("input", { id, type: "text", class: "cz-text", "data-key": f.key, value: v || "", placeholder: f.placeholder || "", list: listId, onchange: (e) => ui.set({ [f.key]: e.target.value }) });
      const themeFonts = f.key === "font" && Array.isArray(ui.theme?.json?.fonts) ? ui.theme.json.fonts.map((x) => x?.family).filter((x) => typeof x === "string") : [];
      const list = listId ? el("datalist", { id: listId }, ...[...new Set([...themeFonts, ...f.suggestions])].map((s) => el("option", { value: s }))) : null;
      return el("div", { class: "cz-row cz-stack" }, el("label", { for: id }, f.label), input, list);
    }
    case "order": {
      const perms = permutations(PLAYER_PARTS);
      const cur = v.join(",");
      input = el(
        "select",
        { id, "data-key": f.key, onchange: (e) => ui.set({ [f.key]: e.target.value.split(",") }) },
        ...perms.map((p) => el("option", { value: p.join(","), ...(p.join(",") === cur ? { selected: "" } : {}) }, p.map((x) => PART_LABELS[x]).join(" · "))),
      );
      return el("div", { class: "cz-row cz-stack" }, el("label", { for: id }, f.label), input);
    }
  }
  return null;
}

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

// Keeps the drawer's inputs in step with changes made elsewhere (dragging an edge).
function syncDrawerInputs(keys) {
  if (drawer.hidden) return;
  for (const k of keys) {
    const input = drawer.querySelector(`[data-key="${k}"]`);
    if (!input || input === document.activeElement) continue;
    const v = ui.settings[k];
    if (input.type === "checkbox") input.checked = !!v;
    else if (input.type === "color") input.value = v ? v.slice(0, 7) : currentColor(SCHEMA[k].css);
    else if (Array.isArray(v)) input.value = v.join(",");
    else input.value = v ?? "";
    if (input.type === "range") {
      const out = drawer.querySelector(`output[for="${input.id}"]`);
      if (out) out.textContent = `${v}${SCHEMA[k].unit}`;
    }
  }
}

async function openDrawer() {
  drawer.hidden = false;
  await refreshThemes();
  renderDrawer();
  drawer.querySelector("summary")?.focus();
}

function closeDrawer() {
  drawer.hidden = true;
}

$("customize-open").addEventListener("click", () => (drawer.hidden ? openDrawer() : closeDrawer()));
drawer.addEventListener("keydown", (e) => e.key === "Escape" && closeDrawer());

// ---- Resizing by dragging edges --------------------------------------------------

for (const handle of document.querySelectorAll(".resizer")) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const key = handle.dataset.resize;
    const f = SCHEMA[key];
    const start = ui.settings[key];
    const x0 = e.clientX;
    const y0 = e.clientY;
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const move = (ev) => {
      let delta;
      if (key === "sidebarWidth") delta = (ev.clientX - x0) * (ui.settings.sidebarSide === "right" ? -1 : 1);
      else if (key === "queueWidth") delta = (ev.clientX - x0) * (ui.settings.queueSide === "left" ? 1 : -1);
      else delta = (ev.clientY - y0) * (ui.settings.playerPos === "top" ? 1 : -1);
      ui.set({ [key]: Math.round((start + delta) / f.step) * f.step }, { save: false });
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.classList.remove("resizing");
      saveUi();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  handle.addEventListener("dblclick", () => ui.set({ [handle.dataset.resize]: SCHEMA[handle.dataset.resize].default }));
}

// ---- Edit layout mode: drag panels to move them ------------------------------------

const PANEL_LABELS = { sidebar: "Sidebar", queue: "Queue", player: "Player bar" };

function editLayout(on) {
  ui.editing = on;
  document.body.classList.toggle("editing", on);
  $("edit-bar").hidden = !on;
  document.querySelectorAll(".grab-chip").forEach((c) => c.remove());
  if (!on) return;
  if (!ui.settings.showQueue) ui.set({ showQueue: true });
  for (const [name, label] of Object.entries(PANEL_LABELS)) {
    const panel = document.querySelector(`[data-panel="${name}"]`);
    panel.append(el("button", { type: "button", class: "grab-chip", onpointerdown: (e) => startDrag(e, { kind: "panel", name, label }) }, `⠿ ${label}`));
  }
  for (const part of PLAYER_PARTS) {
    const node = document.querySelector(`[data-part="${part}"]`);
    node.append(el("button", { type: "button", class: "grab-chip grab-part", onpointerdown: (e) => startDrag(e, { kind: "part", name: part, label: PART_LABELS[part] }) }, `⠿ ${PART_LABELS[part]}`));
  }
}

// Where a dragged thing can land: screen edges for panels, the other parts for player parts.
function dropZones(what) {
  const W = innerWidth;
  const H = innerHeight;
  if (what.kind === "part") {
    return PLAYER_PARTS.filter((p) => p !== what.name).map((p) => {
      const r = document.querySelector(`[data-part="${p}"]`).getBoundingClientRect();
      return { id: p, label: `Swap with ${PART_LABELS[p]}`, x: r.left, y: r.top, w: r.width, h: r.height };
    });
  }
  if (what.name === "player") {
    return [
      { id: "top", label: "Top", x: 0, y: 0, w: W, h: H * 0.3 },
      { id: "bottom", label: "Bottom", x: 0, y: H * 0.7, w: W, h: H * 0.3 },
    ];
  }
  const zones = [
    { id: "left", label: "Left side", x: 0, y: 0, w: W * 0.3, h: H },
    { id: "right", label: "Right side", x: W * 0.7, y: 0, w: W * 0.3, h: H },
  ];
  if (what.name === "queue") zones.push({ id: "hide", label: "Hide", x: W * 0.38, y: H * 0.35, w: W * 0.24, h: H * 0.3 });
  return zones;
}

function startDrag(e, what) {
  e.preventDefault();
  const chip = e.currentTarget;
  chip.setPointerCapture(e.pointerId);
  const zones = dropZones(what);
  const layer = $("drop-zones");
  layer.replaceChildren(
    ...zones.map((z) => {
      const node = el("div", { class: "drop-zone", "data-zone": z.id }, z.label);
      Object.assign(node.style, { left: `${z.x}px`, top: `${z.y}px`, width: `${z.w}px`, height: `${z.h}px` });
      return node;
    }),
  );
  const ghost = el("div", { class: "drag-ghost" }, what.label);
  layer.append(ghost);
  layer.hidden = false;
  let hit = null;
  const move = (ev) => {
    Object.assign(ghost.style, { left: `${ev.clientX + 12}px`, top: `${ev.clientY + 12}px` });
    hit = zones.find((z) => ev.clientX >= z.x && ev.clientX <= z.x + z.w && ev.clientY >= z.y && ev.clientY <= z.y + z.h) || null;
    layer.querySelectorAll(".drop-zone").forEach((n) => n.classList.toggle("over", n.dataset.zone === hit?.id));
  };
  move(e);
  const up = () => {
    chip.removeEventListener("pointermove", move);
    chip.removeEventListener("pointerup", up);
    chip.removeEventListener("pointercancel", up);
    layer.hidden = true;
    layer.replaceChildren();
    if (hit) dropOn(what, hit.id);
  };
  chip.addEventListener("pointermove", move);
  chip.addEventListener("pointerup", up);
  chip.addEventListener("pointercancel", up);
}

function dropOn(what, zone) {
  if (what.kind === "part") {
    const order = [...ui.settings.playerOrder];
    const a = order.indexOf(what.name);
    const b = order.indexOf(zone);
    [order[a], order[b]] = [order[b], order[a]];
    return ui.set({ playerOrder: order });
  }
  if (what.name === "player") return ui.set({ playerPos: zone });
  if (what.name === "sidebar") return ui.set({ sidebarSide: zone });
  if (zone === "hide") return ui.set({ showQueue: false });
  ui.set({ queueSide: zone, showQueue: true });
}

$("edit-done").addEventListener("click", () => editLayout(false));
$("edit-reset").addEventListener("click", () => {
  ui.set(Object.fromEntries(LAYOUT_KEYS.map((k) => [k, SCHEMA[k].default])));
  editLayout(true);
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === "0" || e.code === "Digit0")) {
    e.preventDefault();
    editLayout(false);
    resetAll();
  } else if (e.key === "Escape" && ui.editing) editLayout(false);
});

// ---- Start-up ---------------------------------------------------------------------

loadUi();
applyUi();
(async () => {
  await refreshThemes();
  const t = ui.themes.find((x) => x.id === ui.themeId);
  if (t) {
    ui.theme = t;
    applyThemeFiles();
    applyUi();
  }
})();
