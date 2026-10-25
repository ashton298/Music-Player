// Reading playlists and finding YouTube audio for Spotify songs. No API keys:
// Spotify through its public embed page, YouTube through yt-dlp, and song
// matching through YouTube Music's own web search.
const ytdlp = require("./ytdlp");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
// Spotify's embed page lists at most this many tracks.
const SPOTIFY_EMBED_CAP = 100;

function detect(url) {
  const s = url.trim();
  const sp = s.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?|spotify:)(playlist|album|track)[/:]([A-Za-z0-9]{22})/i);
  if (sp) return { kind: "spotify", type: sp[1].toLowerCase(), id: sp[2] };
  if (/(?:youtube\.com|youtu\.be)\//i.test(s)) {
    // A song link copied while a playlist plays has both v= and list=; the
    // person meant the song, so only /playlist links count as playlists.
    const single = !/\/playlist\?/i.test(s) && /[?&]v=|youtu\.be\/|\/shorts\//i.test(s);
    return { kind: "youtube", url: s, single };
  }
  if (/tiktok\.com\//i.test(s)) return { kind: "tiktok", url: s, single: true };
  return null;
}

async function importSource(url) {
  const info = detect(url);
  if (!info) throw new Error("That doesn't look like a Spotify, YouTube or TikTok link.");
  if (info.kind === "spotify") return importSpotify(info, url);
  if (info.kind === "tiktok") return importTikTok(info.url);
  return importYouTube(info.url, info.single);
}

// ---- TikTok --------------------------------------------------------------

// One video at a time. The audio played is the video's own soundtrack, so it
// sounds exactly like the TikTok.
async function importTikTok(url) {
  const isVideo = /\/(video|photo)\/\d+/i.test(url) || /\/\/(vm|vt)\.tiktok\.com\//i.test(url) || /tiktok\.com\/t\//i.test(url);
  if (!isVideo) throw new Error("Paste a link to one TikTok video (Share > Copy link). Profiles and sound pages aren't supported.");
  let data;
  try {
    data = JSON.parse(await ytdlp.json(["-J", "--no-playlist", "--", url]));
  } catch (e) {
    if (/IP address is blocked|not available|private/i.test(e.message)) throw new Error("TikTok won't share that video (it may be private, deleted or blocked in your region).");
    throw e;
  }
  const sound = (data.track || "").trim();
  const isOriginal = !sound || /^original sound/i.test(sound);
  const caption = (data.description || data.title || "")
    .split("\n")[0]
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const handle = data.uploader ? "@" + data.uploader : data.channel || "TikTok";
  const track = {
    key: "tt:" + data.id,
    title: isOriginal ? caption.slice(0, 90) || `TikTok by ${handle}` : sound,
    artist: isOriginal ? handle : data.artist || handle,
    durationMs: data.duration ? Math.round(data.duration * 1000) : 0,
    source: "tiktok",
    mediaUrl: data.webpage_url || url,
    art: data.thumbnail || null,
  };
  return { id: "tiktok:" + data.id, kind: "tiktok", url, name: track.title, art: track.art, tracks: [track], truncated: false, single: true, importedAt: Date.now() };
}

// ---- Spotify -------------------------------------------------------------

async function importSpotify({ type, id }, url) {
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Spotify returned ${res.status}. Is the playlist public?`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Couldn't read that Spotify page. Spotify may have changed it.");
  const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error("Spotify didn't share that one. Private playlists can't be read; make it public and try again.");

  const art = pickImage(entity.coverArt?.sources);
  const list = entity.trackList ?? [{ uri: entity.uri, title: entity.name ?? entity.title, subtitle: (entity.artists ?? []).map((a) => a.name).join(", "), duration: entity.duration }];
  const tracks = list
    .filter((t) => t.uri && t.title)
    .map((t) => ({
      key: "sp:" + t.uri,
      title: t.title,
      artist: (t.subtitle || "").replace(/ /g, " "),
      durationMs: t.duration || 0,
      source: "spotify",
      spotifyUri: t.uri,
      art: null,
    }));

  await addSpotifyArt(tracks);

  return {
    id: `spotify:${type}:${id}`,
    kind: "spotify",
    url,
    name: entity.name || entity.title || "Spotify " + type,
    art,
    tracks,
    truncated: type === "playlist" && tracks.length >= SPOTIFY_EMBED_CAP,
    single: type === "track",
    importedAt: Date.now(),
  };
}

// The embed has no per-song covers, so ask Spotify's public oEmbed endpoint,
// a few songs at a time. A song without art just shows a blank square.
async function addSpotifyArt(tracks) {
  let next = 0;
  const worker = async () => {
    while (next < tracks.length) {
      const t = tracks[next++];
      try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(t.spotifyUri)}`, { headers: { "User-Agent": UA } });
        if (res.ok) t.art = (await res.json()).thumbnail_url || null;
      } catch {
        // Leave it blank.
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

function pickImage(sources) {
  if (!Array.isArray(sources) || !sources.length) return null;
  return [...sources].sort((a, b) => (b.width || 0) - (a.width || 0))[0].url || null;
}

// ---- YouTube -------------------------------------------------------------

async function importYouTube(url, single) {
  const args = single ? ["-J", "--no-playlist", "--skip-download", "--", url] : ["-J", "--flat-playlist", "--playlist-end", "1000", "--", url];
  const out = await ytdlp.json(args, { allowPartial: true });
  const data = JSON.parse(out);
  const entries = data.entries ?? [data];
  const tracks = entries
    .filter((e) => e && e.id && e.title && !/^\[(private|deleted) video\]$/i.test(e.title))
    .map(fromYouTubeEntry);
  return {
    id: "youtube:" + (data.id || url),
    kind: "youtube",
    url,
    name: data.title || "YouTube playlist",
    art: tracks[0]?.art ?? null,
    tracks,
    truncated: false,
    single: !!single,
    importedAt: Date.now(),
  };
}

function fromYouTubeEntry(e) {
  const channel = (e.channel || e.uploader || "").replace(/ - Topic$/, "");
  let title = e.title;
  let artist = channel;
  // Music videos are often titled "Artist - Song (Official Video)".
  const split = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (split && !/ - Topic$/.test(e.channel || "")) {
    artist = split[1];
    title = split[2];
  }
  title = title
    .replace(/\s+\|.*$/, "") // "Song | Channel | Tags"
    .replace(/\s*[([](official|lyric|lyrics|audio|music video|video|visualizer|hd|4k)[^)\]]*[)\]]/gi, "")
    .replace(/\s*\b(official\s+(music\s+)?video|official\s+audio|official\s+lyric\s+video|lyric\s+video|music\s+video|M\/V)\b/gi, "")
    .replace(/\s+[-–—]\s*$/, "")
    .trim() || e.title;
  return {
    key: "yt:" + e.id,
    title,
    artist,
    durationMs: e.duration ? Math.round(e.duration * 1000) : 0,
    source: "youtube",
    ytId: e.id,
    art: thumb(e),
  };
}

function thumb(e) {
  if (Array.isArray(e.thumbnails) && e.thumbnails.length) return e.thumbnails[e.thumbnails.length - 1].url;
  return e.id ? `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg` : null;
}

// ---- Matching a Spotify song to YouTube audio ----------------------------

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(feat|ft|with)\.?\b.*$/, " ")
    .replace(/[^a-z0-9À-￿]+/g, " ")
    .trim();

function overlap(a, b) {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.max(A.size, B.size);
}

function score(track, c) {
  let s = overlap(track.title, c.title) * 3 + overlap(track.artist.split(",")[0], c.artist) * 2;
  if (track.durationMs && c.durationMs) {
    const off = Math.abs(track.durationMs - c.durationMs) / 1000;
    s -= off <= 3 ? 0 : off <= 15 ? 0.5 : 1.5;
  }
  return s;
}

async function findOnYouTube(track) {
  const query = `${track.artist.split(",")[0]} ${track.title}`;
  let candidates = [];
  try {
    candidates = await searchYouTubeMusic(query);
  } catch {
    // Fall through to yt-dlp's search.
  }
  if (!candidates.length) candidates = await searchWithYtdlp(query);
  if (!candidates.length) throw new Error(`Couldn't find "${track.title}" on YouTube.`);
  return candidates.map((c) => ({ c, s: score(track, c) })).sort((a, b) => b.s - a.s)[0].c;
}

async function searchYouTubeMusic(q) {
  const d = new Date(Date.now() - 86400000);
  const ver = `1.${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}.01.00`;
  const res = await fetch("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA, Origin: "https://music.youtube.com", Referer: "https://music.youtube.com/" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: ver, hl: "en", gl: "US" } },
      query: q,
      params: "EgWKAQIIAWoMEA4QChADEAQQCRAF", // songs only
    }),
  });
  if (!res.ok) throw new Error("YouTube Music search failed.");
  const out = [];
  walk(await res.json(), out);
  return out.slice(0, 8);
}

function walk(node, out) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
  if (!node || typeof node !== "object") return;
  if (node.musicResponsiveListItemRenderer) {
    const t = parseItem(node.musicResponsiveListItemRenderer);
    if (t) out.push(t);
    return;
  }
  for (const v of Object.values(node)) walk(v, out);
}

function parseItem(r) {
  try {
    const ytId = r.playlistItemData?.videoId;
    if (!ytId) return null;
    const cols = r.flexColumns;
    const title = cols[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
    const texts = cols[1].musicResponsiveListItemFlexColumnRenderer.text.runs.map((x) => x.text).filter((s) => s.trim() !== "•" && s !== "Song" && s !== "Video");
    const isDur = (s) => /^\d+(:\d{2}){1,2}$/.test(s.trim());
    const dur = texts.filter(isDur).pop();
    const durationMs = dur ? dur.split(":").reduce((acc, n) => acc * 60 + Number(n), 0) * 1000 : 0;
    const thumbs = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
    const art = thumbs.length ? thumbs[thumbs.length - 1].url.replace(/=w\d+-h\d+/, "=w512-h512") : null;
    return { ytId, title, artist: texts.find((s) => !isDur(s)) || "", durationMs, art };
  } catch {
    return null;
  }
}

async function searchWithYtdlp(q) {
  const out = await ytdlp.json(["--flat-playlist", "-j", `ytsearch6:${q.replace(/"/g, "")}`], { allowPartial: true });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const t = fromYouTubeEntry(JSON.parse(line));
        return { ytId: t.ytId, title: t.title, artist: t.artist, durationMs: t.durationMs, art: t.art };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { detect, importSource, findOnYouTube, norm };
