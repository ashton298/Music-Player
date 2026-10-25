const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const ytdlp = require("./ytdlp");
const sources = require("./sources");

// ---- Library (mixes + remembered Spotify -> YouTube matches) -------------

const libPath = () => path.join(app.getPath("userData"), "library.json");
let library = null;

function loadLibrary() {
  try {
    library = JSON.parse(fs.readFileSync(libPath(), "utf8"));
  } catch {
    library = { mixes: [], matches: {} };
  }
  library.mixes ??= [];
  library.matches ??= {};
  return library;
}

function saveLibrary() {
  fs.mkdirSync(path.dirname(libPath()), { recursive: true });
  fs.writeFileSync(libPath() + ".tmp", JSON.stringify(library, null, 1));
  fs.renameSync(libPath() + ".tmp", libPath());
}

// ---- Playback resolution -------------------------------------------------

// Returns the YouTube video for a track, matching Spotify songs once and
// remembering the result so the same song always plays the same audio.
async function ytFor(track) {
  if (track.ytId) return { ytId: track.ytId };
  const known = library.matches[track.spotifyUri];
  if (known) return known;
  const hit = await sources.findOnYouTube(track);
  const match = { ytId: hit.ytId, art: hit.art, matchedTitle: hit.title, matchedArtist: hit.artist };
  library.matches[track.spotifyUri] = match;
  saveLibrary();
  return match;
}

// Tracks can arrive from other people's apps during a Jam, so anything that
// reaches yt-dlp must be a plain YouTube id or a TikTok page URL.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_URL = /^https:\/\/([a-z0-9-]+\.)?tiktok\.com\/[^\s]*$/i;

async function resolve(track) {
  if (!track || typeof track !== "object") throw new Error("Not a song.");
  if (track.ytId != null && !YT_ID.test(track.ytId)) throw new Error("That song has a broken YouTube id.");
  if (track.source === "tiktok" && (!TIKTOK_URL.test(track.mediaUrl || "") || !/^tt:\d+$/.test(track.key || ""))) {
    throw new Error("That TikTok link isn't valid.");
  }
  if (track.source === "tiktok") {
    const file = await ytdlp.downloadTikTok(track.key.slice(3), track.mediaUrl);
    const now = new Date();
    fs.utimesSync(file, now, now);
    return { url: pathToFileURL(file).href };
  }
  const match = await ytFor(track);
  const file = await ytdlp.downloadYouTube(match.ytId);
  const now = new Date();
  fs.utimesSync(file, now, now); // recently played files survive cache cleanup
  return { url: pathToFileURL(file).href, ...match };
}

// ---- Window and IPC --------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 760,
    minHeight: 520,
    title: "Playlist Merger",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#16171a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  // Links open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

handle("library:get", () => library);
handle("library:saveMixes", (mixes) => {
  library.mixes = mixes;
  saveLibrary();
});
handle("source:import", (url) => sources.importSource(url));
handle("track:resolve", (track) => resolve(track));
handle("track:prefetch", async (track) => {
  await resolve(track);
});
handle("track:forgetMatch", (spotifyUri) => {
  delete library.matches[spotifyUri];
  saveLibrary();
});
handle("tools:prepare", () => ytdlp.ensure());
handle("shell:open", (url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// Groups the taskbar button and media controls under the app's own name and icon.
app.setAppUserModelId("com.ashton.playlistmerger");

app.whenReady().then(() => {
  loadLibrary();
  ytdlp.cleanCache();
  createWindow();
});

app.on("window-all-closed", () => app.quit());
