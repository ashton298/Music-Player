const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const ytdlp = require("./ytdlp");
const sources = require("./sources");
const themes = require("./themes");
const auth = require("./auth");

// Theme files (CSS, images, fonts) are served from pmtheme://<theme id>/...
protocol.registerSchemesAsPrivileged([{ scheme: "pmtheme", privileges: { standard: true, secure: true, corsEnabled: true } }]);

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

// Everything except signing in needs a signed-in user.
let authReady = Promise.resolve();
const handle = (channel, fn) =>
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      if (!channel.startsWith("auth:")) {
        await authReady;
        if (!auth.isSignedIn()) throw new Error("Sign in first.");
      }
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
handle("auth:status", async () => {
  await authReady;
  return auth.status();
});
handle("auth:sendCode", (email) => auth.sendCode(email));
handle("auth:verify", (email, code) => auth.verify(email, code));
handle("auth:signOut", () => auth.signOut());
handle("themes:list", () => themes.list());
handle("themes:import", (bytes) => themes.importZip(bytes));
handle("themes:remove", (id) => themes.remove(id));
handle("themes:guide", () => themes.guide());
handle("themes:export", async (opts) => {
  const win = BrowserWindow.getFocusedWindow();
  const name = String(opts?.name || "My theme").replace(/[^\w\- ]+/g, "").trim() || "My theme";
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Save theme",
    defaultPath: path.join(app.getPath("downloads"), `${name}.zip`),
    filters: [{ name: "Theme zip", extensions: ["zip"] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, themes.exportZip(opts));
  return filePath;
});
handle("themes:saveGuide", async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Save the theme guide",
    defaultPath: path.join(app.getPath("downloads"), "Playlist Merger theme guide.md"),
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, themes.guide());
  return filePath;
});

// Groups the taskbar button and media controls under the app's own name and icon.
app.setAppUserModelId("com.ashton.playlistmerger");

app.whenReady().then(() => {
  auth.start((status) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("auth:locked", status)));
  authReady = auth.recheck().catch(() => {});
  loadLibrary();
  ytdlp.cleanCache();
  protocol.handle("pmtheme", themes.serve);
  createWindow();
});

app.on("window-all-closed", () => app.quit());
