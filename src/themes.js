// Theme zips: a theme.json of look settings, an optional theme.css, and the
// images and fonts they use. Themes never contain code. Each one is unpacked
// into its own folder and served to the window through the pmtheme:// scheme.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { unzipSync, zipSync, strToU8 } = require("./vendor/fflate.cjs");

const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const MAX_FILES = 300;
const MAX_CSS_BYTES = 512 * 1024;

const TYPES = {
  ".json": "application/json",
  ".css": "text/css",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const ID = /^[a-z0-9-]{1,48}$/;
const themesDir = () => path.join(app.getPath("userData"), "themes");
const themeDir = (id) => {
  if (!ID.test(id || "")) throw new Error("That theme id isn't valid.");
  return path.join(themesDir(), id);
};

// A zip entry name, cleaned into a safe relative path, or null to skip it.
function safeName(name) {
  const clean = name.replace(/\\/g, "/");
  if (clean.endsWith("/") || clean.startsWith("/") || /^[a-z]:/i.test(clean)) return null;
  const parts = clean.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || p.startsWith("."))) return null;
  if (parts[0] === "__MACOSX") return null;
  return TYPES[path.extname(clean).toLowerCase()] ? clean : null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

function list() {
  if (!fs.existsSync(themesDir())) return [];
  return fs
    .readdirSync(themesDir())
    .filter((id) => ID.test(id))
    .map((id) => {
      const json = readJson(path.join(themeDir(id), "theme.json"));
      if (!json) return null;
      const cssFile = typeof json.css === "string" ? json.css : "theme.css";
      const css = fs.existsSync(path.join(themeDir(id), cssFile)) ? cssFile : null;
      return { id, name: String(json.name || id).slice(0, 60), author: String(json.author || "").slice(0, 60), json, css, added: fs.statSync(themeDir(id)).mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.added - a.added);
}

function importZip(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error("That file is empty.");
  if (bytes.length > MAX_ZIP_BYTES) throw new Error("That zip is too big (50 MB max).");
  let total = 0;
  let count = 0;
  let files;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (!safeName(f.name)) return false;
        if (++count > MAX_FILES) throw new Error(`A theme can have at most ${MAX_FILES} files.`);
        if (f.originalSize > MAX_FILE_BYTES) throw new Error(`"${f.name}" is too big (25 MB max per file).`);
        total += f.originalSize;
        if (total > MAX_TOTAL_BYTES) throw new Error("That theme is too big once unzipped (80 MB max).");
        return true;
      },
    });
  } catch (e) {
    throw new Error(/max|too big|at most/.test(e.message) ? e.message : "That isn't a zip file the app can open.");
  }

  // theme.json may sit at the top or inside one folder (zipping a folder does that).
  const jsonName = Object.keys(files)
    .filter((n) => n === "theme.json" || n.endsWith("/theme.json"))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!jsonName) throw new Error("That zip has no theme.json in it.");
  const root = jsonName.slice(0, -"theme.json".length);
  let json;
  try {
    json = JSON.parse(Buffer.from(files[jsonName]).toString("utf8").replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`theme.json isn't valid JSON: ${e.message}`);
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("theme.json must be a JSON object.");
  if (json.settings != null && (typeof json.settings !== "object" || Array.isArray(json.settings))) throw new Error('"settings" in theme.json must be an object.');
  const cssName = typeof json.css === "string" ? json.css : "theme.css";
  const css = files[root + cssName];
  if (css && css.length > MAX_CSS_BYTES) throw new Error("theme.css is too big (512 KB max).");

  const name = String(json.name || "Untitled theme").trim().slice(0, 60) || "Untitled theme";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "theme";
  const id = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  const dir = themeDir(id);
  const tmp = dir + ".tmp";
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [entry, data] of Object.entries(files)) {
    if (!entry.startsWith(root)) continue;
    const dest = path.join(tmp, entry.slice(root.length));
    if (!dest.startsWith(tmp + path.sep)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
  }
  fs.renameSync(tmp, dir);
  return list().find((t) => t.id === id);
}

function remove(id) {
  fs.rmSync(themeDir(id), { recursive: true, force: true });
}

// The current look as a zip: theme.json with the settings, plus the active
// theme's own files (CSS, images, fonts) so nothing it points at goes missing.
function exportZip({ settings, name, fromId }) {
  const files = {};
  if (fromId && fs.existsSync(themeDir(fromId))) {
    const base = themeDir(fromId);
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else {
          const rel = path.relative(base, full).split(path.sep).join("/");
          if (rel !== "theme.json" && safeName(rel)) files[rel] = new Uint8Array(fs.readFileSync(full));
        }
      }
    };
    walk(base);
  }
  const old = fromId ? readJson(path.join(themeDir(fromId), "theme.json")) || {} : {};
  const json = { ...old, name: String(name || old.name || "My theme").slice(0, 60), version: 1, settings };
  files["theme.json"] = strToU8(JSON.stringify(json, null, 2));
  return zipSync(files, { level: 6 });
}

// Serves pmtheme://<theme id>/<file> from that theme's folder.
async function serve(request) {
  const url = new URL(request.url);
  try {
    const dir = themeDir(url.hostname);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.join(dir, rel);
    const type = TYPES[path.extname(file).toLowerCase()];
    if (!type || !safeName(rel) || !file.startsWith(dir + path.sep) || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
    return new Response(fs.readFileSync(file), { headers: { "content-type": type, "access-control-allow-origin": "*" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const guide = () => fs.readFileSync(path.join(__dirname, "THEME-GUIDE.md"), "utf8");

module.exports = { list, importZip, remove, exportZip, serve, guide };
