// yt-dlp wrapper. The exe is downloaded once into the app's data folder and
// self-updated every few days, because YouTube changes often and old yt-dlp
// versions stop working. Audio is downloaded into a cache so replays are instant.
const { app } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

// yt-dlp publishes a standalone build per OS.
const BIN = {
  win32: "yt-dlp.exe",
  darwin: "yt-dlp_macos",
  linux: "yt-dlp_linux",
}[process.platform] ?? "yt-dlp_linux";
const BIN_URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${BIN}`;
const UPDATE_EVERY_DAYS = 4;
const CACHE_KEEP_DAYS = 30;

const binDir = () => path.join(app.getPath("userData"), "bin");
const exePath = () => path.join(binDir(), BIN);
const cacheDir = () => path.join(app.getPath("userData"), "cache");

let ready = null;

function ensure() {
  if (!ready) ready = setup().catch((err) => {
    ready = null; // let the next call try again
    throw err;
  });
  return ready;
}

async function setup() {
  fs.mkdirSync(binDir(), { recursive: true });
  const exe = exePath();
  if (!fs.existsSync(exe)) {
    const res = await fetch(BIN_URL);
    if (!res.ok) throw new Error(`Couldn't download yt-dlp (${res.status}). Check your internet connection.`);
    fs.writeFileSync(exe + ".tmp", Buffer.from(await res.arrayBuffer()), { mode: 0o755 });
    fs.renameSync(exe + ".tmp", exe);
    return;
  }
  const ageDays = (Date.now() - fs.statSync(exe).mtimeMs) / 86400000;
  if (ageDays > UPDATE_EVERY_DAYS) {
    try {
      await run(["-U"]);
    } catch {
      // An old yt-dlp usually still works; don't block playback on the update.
    }
    const now = new Date();
    fs.utimesSync(exe, now, now);
  }
}

function run(args, { allowPartial = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(exePath(), args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }, (err, stdout, stderr) => {
      if (err && !(allowPartial && stdout)) {
        const line = (stderr || "").split("\n").reverse().find((l) => l.includes("ERROR")) || "";
        return reject(new Error(line.trim().slice(0, 200) || "yt-dlp failed. Try again in a moment."));
      }
      resolve(stdout);
    });
  });
}

async function json(args, opts) {
  await ensure();
  return run(["--no-warnings", ...args], opts);
}

function findCached(key) {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(key + ".") && !/\.(part|ytdl|tmp)$/.test(f));
  return hit ? path.join(dir, hit) : null;
}

// One download per file at a time, even if play and prefetch ask together.
const inFlight = new Map();

// key names the cached file, url is the page yt-dlp reads, format picks the stream.
function download(key, url, format) {
  const hit = findCached(key);
  if (hit) return Promise.resolve(hit);
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    await ensure();
    fs.mkdirSync(cacheDir(), { recursive: true });
    await run([
      "-f", format,
      "--no-playlist", "--no-warnings", "-q", "--no-progress",
      "-o", path.join(cacheDir(), `${key}.%(ext)s`),
      "--", // whatever follows is a URL, never an option
      url,
    ]);
    const file = findCached(key);
    if (!file) throw new Error("The download finished but no audio file was found.");
    return file;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

const downloadYouTube = (ytId) => download(ytId, `https://www.youtube.com/watch?v=${ytId}`, "bestaudio[ext=m4a]/bestaudio");
// TikToks are short, so the whole mp4 is fine; <audio> plays its soundtrack.
const downloadTikTok = (id, url) => download("tt" + id, url, "best[ext=mp4]/best");

function cleanCache() {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try {
      if ((Date.now() - fs.statSync(p).mtimeMs) / 86400000 > CACHE_KEEP_DAYS) fs.unlinkSync(p);
    } catch {
      // In use or already gone.
    }
  }
}

module.exports = { ensure, json, downloadYouTube, downloadTikTok, findCached, cleanCache };
