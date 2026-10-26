// Renderer: mixes, the merged track list, and the player. Everything that
// touches the network or disk goes through window.api (preload.js).
const $ = (id) => document.getElementById(id);
const audio = $("audio");

const state = {
  mixes: [],
  currentMixId: null,
  // The queue is a snapshot of the merged list taken when playback starts.
  queue: [],
  order: [], // indexes into queue, shuffled or not
  pos: -1, // position in order
  contextName: "", // the mix the queue came from
  // Songs the person queued by hand ("Add to queue" / "Play next"). They play
  // before the rest of the mix, like Spotify's "Next in queue".
  upNext: [],
  current: null, // { track, fromQueue } for what's loaded in the player
  shuffle: false,
  repeat: "off", // off | all | one
  loadToken: 0,
  failures: new Set(), // track keys that couldn't play
  matches: {}, // spotifyUri -> { art, ... } learned this session
  view: "mix", // "mix" | "jam"
};

const inJam = () => !!window.jam?.active;

// ---- Helpers ---------------------------------------------------------------

const fmt = (ms) => {
  if (!ms || !isFinite(ms)) return "0:00";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const LABELS = { spotify: "Spotify", youtube: "YouTube", tiktok: "TikTok" };
const uid = () => Math.random().toString(36).slice(2, 10);
const currentMix = () => state.mixes.find((m) => m.id === state.currentMixId) || null;
const save = () => window.api.saveMixes(state.mixes).catch((e) => setStatus(e.message, true));

function setStatus(text, error = false) {
  const el = $("add-status");
  el.textContent = text;
  el.classList.toggle("error", error);
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

// A loose "same song" key so a Spotify track and its YouTube upload dedupe.
// Brackets and "feat." are dropped, but version words are kept, so a
// slowed or sped-up edit never counts as a duplicate of the original.
const VERSION_WORDS = /\b(slowed|reverb|reverbed|sped|speed|nightcore|bass|boosted|remix|live|acoustic|instrumental|demo|cover|mashup|extended|hardtekk|phonk|8d)\b/g;
const songKey = (t) => {
  const raw = `${(t.artist || "").split(",")[0]} ${t.title}`.toLowerCase();
  const versions = [...new Set(raw.match(VERSION_WORDS) ?? [])].sort().join(" ");
  const base = raw
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\s[-–—]\s.*$/, " ") // "Song - Slowed", "Song - 2011 Remaster"
    .replace(/\b(feat|ft)\.?\b.*$/, " ")
    .replace(VERSION_WORDS, " ")
    .replace(/[^a-z0-9À-￿]+/g, " ")
    .trim();
  return `${base}|${versions}`;
};

function mergedTracks(mix) {
  const lists = mix.sources.map((s) => s.tracks);
  let out = [];
  if (mix.order === "interleave") {
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) out.push(l[i]);
  } else {
    out = lists.flat();
  }
  const seen = new Set();
  return out.filter((t) => {
    const k = mix.dedupe ? songKey(t) : t.key;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const artFor = (t) => t.art || state.matches[t.spotifyUri]?.art || null;

// ---- Sidebar and mix view --------------------------------------------------

function renderSidebar() {
  const nav = $("jam-nav");
  nav.setAttribute("aria-current", String(state.view === "jam"));
  nav.textContent = inJam() ? `Jam · ${window.jam.code} · ${Math.max(1, window.jam.members.length)} listening` : "Jam: listen together";
  const list = $("mix-list");
  list.replaceChildren(
    ...state.mixes.map((m) =>
      el("li", {}, el("button", { type: "button", "aria-current": String(state.view === "mix" && m.id === state.currentMixId), onclick: () => openMix(m.id) }, m.name)),
    ),
  );
}

function openMix(id) {
  state.view = "mix";
  state.currentMixId = id;
  setStatus("");
  render();
}

function openJamView() {
  state.view = "jam";
  render();
}

function render() {
  renderSidebar();
  renderQueue();
  const mix = currentMix();
  const jamView = state.view === "jam";
  $("jam").hidden = !jamView;
  $("empty").hidden = jamView || !!mix;
  $("mix").hidden = jamView || !mix;
  if (jamView) return renderJam();
  if (!mix) return;
  $("jam-banner").hidden = !inJam();

  if (document.activeElement !== $("mix-name")) $("mix-name").value = mix.name;
  $("mix-order").value = mix.order;
  $("mix-dedupe").checked = !!mix.dedupe;

  const tracks = mergedTracks(mix);
  const total = tracks.reduce((a, t) => a + (t.durationMs || 0), 0);
  const playlists = mix.sources.filter((s) => s.id !== SINGLES_ID).length;
  const singles = mix.sources.find((s) => s.id === SINGLES_ID)?.tracks.length ?? 0;
  const parts = [`${tracks.length} songs`, fmt(total)];
  if (playlists) parts.push(`${playlists} playlist${playlists === 1 ? "" : "s"}`);
  if (singles) parts.push(`${singles} single song${singles === 1 ? "" : "s"}`);
  $("mix-stats").textContent = mix.sources.length ? parts.join(" · ") : "Nothing here yet. Paste a playlist or song link below.";
  $("play-all").disabled = $("shuffle-all").disabled = $("queue-all").disabled = !tracks.length;

  $("source-list").replaceChildren(...mix.sources.map((s) => renderSource(mix, s)));
  renderTracks(tracks);
}

function renderSource(mix, s) {
  return el(
    "li",
    { class: "source" },
    s.art ? el("img", { src: s.art, alt: "" }) : null,
    el(
      "div",
      {},
      el("div", { class: "name" }, s.name),
      el(
        "div",
        { class: "meta" },
        s.kind === "singles" ? null : el("span", { class: `badge ${s.kind}` }, LABELS[s.kind]),
        ` ${s.tracks.length} song${s.tracks.length === 1 ? "" : "s"}`,
        s.truncated ? el("span", { class: "warn", title: "Spotify only shares the first 100 songs of a playlist without signing in." }, " · first 100 only") : null,
      ),
    ),
    // Groups added by hand have no link to re-read.
    s.kind === "singles" || !s.url ? null : el("button", { type: "button", class: "link-btn", title: "Re-read this playlist", onclick: () => refreshSource(mix, s) }, "Refresh"),
    el("button", { type: "button", class: "link-btn", title: s.kind === "singles" ? "Remove all single songs" : "Remove from this mix", onclick: () => removeSource(mix, s) }, s.kind === "singles" ? "Remove all" : "Remove"),
  );
}

function renderTracks(tracks) {
  const playingKey = nowTrack()?.key;
  const mix = currentMix();
  const singles = new Set((mix.sources.find((s) => s.id === SINGLES_ID)?.tracks ?? []).map((t) => t.key));
  $("track-list").replaceChildren(
    ...tracks.map((t, i) => {
      const art = artFor(t);
      const cls = ["track", t.key === playingKey ? "playing" : "", state.failures.has(t.key) ? "failed" : ""].join(" ");
      return el(
        "li",
        {
          class: cls,
          "data-key": t.key,
          title: state.failures.has(t.key) ? "Couldn't play this one last time" : "",
          onclick: () => (inJam() ? window.jam.addTracks([t]) : playFromMix(i)),
          oncontextmenu: (e) => (e.preventDefault(), trackMenu(e, [t], { play: () => playFromMix(i) })),
        },
        el("span", { class: "t-num" }, String(i + 1)),
        art ? el("img", { class: "t-art", src: art, alt: "", loading: "lazy" }) : el("span", { class: "t-art" }),
        el("div", { class: "t-text" }, el("p", { class: "t-title" }, t.title), el("p", { class: "t-artist" }, t.artist)),
        el(
          "span",
          { class: "t-tags" },
          singles.has(t.key)
            ? el("button", { type: "button", class: "link-btn", title: "Remove this song from the mix", onclick: (e) => (e.stopPropagation(), removeSingle(mix, t)) }, "Remove")
            : null,
          el("span", { class: `badge ${t.source}` }, LABELS[t.source]),
          moreButton([t], { play: () => playFromMix(i) }),
        ),
        el("span", { class: "t-dur" }, fmt(t.durationMs)),
      );
    }),
  );
}

// ---- Mix actions -----------------------------------------------------------

function newMix() {
  const mix = { id: uid(), name: `Mix ${state.mixes.length + 1}`, order: "append", dedupe: true, sources: [] };
  state.mixes.push(mix);
  save();
  openMix(mix.id);
  $("add-url").focus();
}

async function addSource(url) {
  const mix = currentMix();
  if (!mix) return;
  $("add-btn").disabled = true;
  setStatus(/spotify/i.test(url) ? "Reading the Spotify link…" : /tiktok/i.test(url) ? "Reading the TikTok…" : "Reading the YouTube link (the first time also downloads yt-dlp)…");
  try {
    const src = await window.api.importSource(url);
    if (src.single) {
      addSingle(mix, src.tracks[0]);
      return;
    }
    if (mix.sources.some((s) => s.id === src.id)) throw new Error("That playlist is already in this mix.");
    mix.sources.push(src);
    if (mix.sources.length === 1 && /^Mix \d+$/.test(mix.name)) mix.name = src.name;
    save();
    setStatus(`Added "${src.name}" (${src.tracks.length} songs).${src.truncated ? " Spotify only shares the first 100 songs." : ""}`);
    $("add-url").value = "";
    render();
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    $("add-btn").disabled = false;
  }
}

// Songs added one at a time share a single group per mix instead of each
// becoming its own playlist chip.
const SINGLES_ID = "singles";

function addSingle(mix, track) {
  if (!track) throw new Error("Couldn't read that song.");
  let group = mix.sources.find((s) => s.id === SINGLES_ID);
  if (!group) {
    group = { id: SINGLES_ID, kind: "singles", name: "Single songs", art: null, tracks: [], truncated: false };
    mix.sources.push(group);
  }
  if (group.tracks.some((t) => t.key === track.key)) throw new Error(`"${track.title}" is already in this mix.`);
  group.tracks.push(track);
  group.art = track.art || group.art;
  if (mix.sources.length === 1 && /^Mix \d+$/.test(mix.name)) mix.name = "My mix";
  save();
  $("add-url").value = "";
  render();
  // Singles sit at the end of the list, so take the person to the new row.
  const row = [...document.querySelectorAll(".track")].find((r) => r.dataset.key === track.key);
  if (row) {
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.add("just-added");
    setTimeout(() => row.classList.remove("just-added"), 2000);
    setStatus(`Added "${track.title}" by ${track.artist || "unknown artist"} (at the bottom of the list).`);
  } else {
    setStatus(`Added "${track.title}", but it's hidden because the mix already has the same song. Turn off "Skip duplicates" to see it.`);
  }
}

function removeSingle(mix, track) {
  const group = mix.sources.find((s) => s.id === SINGLES_ID);
  if (!group) return;
  group.tracks = group.tracks.filter((t) => t.key !== track.key);
  group.art = [...group.tracks].reverse().find((t) => t.art)?.art ?? null;
  if (!group.tracks.length) mix.sources = mix.sources.filter((s) => s !== group);
  save();
  render();
}

async function refreshSource(mix, s) {
  setStatus(`Refreshing "${s.name}"…`);
  try {
    const fresh = await window.api.importSource(s.url);
    Object.assign(s, fresh);
    save();
    setStatus(`"${s.name}" is up to date (${s.tracks.length} songs).`);
    render();
  } catch (e) {
    setStatus(e.message, true);
  }
}

function removeSource(mix, s) {
  mix.sources = mix.sources.filter((x) => x !== s);
  save();
  render();
}

function deleteMix() {
  const mix = currentMix();
  if (!mix) return;
  state.mixes = state.mixes.filter((m) => m !== mix);
  state.currentMixId = state.mixes[0]?.id ?? null;
  save();
  render();
}

// ---- Playback --------------------------------------------------------------

const nowTrack = () => state.current?.track ?? null;

function buildOrder(startIndex) {
  const idx = state.queue.map((_, i) => i);
  if (state.shuffle) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (startIndex != null) {
      idx.splice(idx.indexOf(startIndex), 1);
      idx.unshift(startIndex);
    }
  }
  state.order = idx;
}

function playFromMix(index, { shuffle } = {}) {
  const mix = currentMix();
  if (!mix) return;
  if (shuffle !== undefined) setShuffle(shuffle, false);
  state.queue = mergedTracks(mix);
  state.contextName = mix.name;
  if (!state.queue.length) return;
  const start = index ?? (state.shuffle ? Math.floor(Math.random() * state.queue.length) : 0);
  buildOrder(start);
  playAt(state.order.indexOf(start));
}

let consecutiveFailures = 0;

function playAt(pos) {
  if (pos < 0 || pos >= state.order.length) return;
  state.pos = pos;
  return playTrack(state.queue[state.order[pos]], false);
}

// Plays the first song in "Next in queue". The mix position stays put, so the
// mix carries on from where it was once the queue runs out.
function playQueued() {
  const item = state.upNext.shift();
  if (item) return playTrack(item, true);
}

async function playTrack(track, fromQueue) {
  state.current = { track, fromQueue };
  const token = ++state.loadToken;
  audio.pause();
  showNow(track, track.source === "spotify" && !track.ytId ? "Finding it on YouTube…" : "Loading…");
  render();
  try {
    const res = await window.api.resolve(track);
    if (token !== state.loadToken) return; // the user moved on
    if (track.spotifyUri) state.matches[track.spotifyUri] = res;
    audio.src = res.url;
    await audio.play();
    consecutiveFailures = 0;
    state.failures.delete(track.key);
    showNow(track);
    render();
    prefetchNext();
  } catch (e) {
    if (token !== state.loadToken) return;
    state.failures.add(track.key);
    consecutiveFailures++;
    showNow(track, `Couldn't play: ${e.message}`);
    render();
    // Skip ahead, but stop if everything is failing (offline, yt-dlp broken).
    if (consecutiveFailures < 3) setTimeout(() => token === state.loadToken && next(true), 1500);
  }
}

function prefetchNext() {
  if (inJam()) return;
  const nextPos = state.pos + 1 < state.order.length ? state.pos + 1 : state.repeat === "all" ? 0 : -1;
  const t = state.upNext[0] ?? (nextPos >= 0 ? state.queue[state.order[nextPos]] : null);
  if (t) window.api.prefetch(t).catch(() => {});
}

function next(auto = false) {
  if (inJam()) return auto ? window.jam.onEnded() : window.jam.control("next");
  if (auto && state.repeat === "one" && state.current) return playTrack(state.current.track, state.current.fromQueue);
  if (state.upNext.length) return playQueued();
  if (!state.order.length) return;
  if (state.pos + 1 < state.order.length) return playAt(state.pos + 1);
  if (state.repeat === "all") {
    if (state.shuffle) buildOrder(null);
    return playAt(0);
  }
  if (auto) {
    audio.pause();
  }
}

function prev() {
  if (inJam()) return window.jam.control("prev");
  if (!state.current) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  // From a queued song, "previous" goes back to the mix song it interrupted.
  if (state.current.fromQueue && state.pos >= 0) return playAt(state.pos);
  if (!state.current.fromQueue && state.pos > 0) return playAt(state.pos - 1);
  audio.currentTime = 0;
}

function togglePlay() {
  if (inJam()) return window.jam.control("toggle");
  if (!nowTrack()) {
    if (state.upNext.length) playQueued();
    else if (currentMix()) playFromMix();
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function setShuffle(on, rebuild = true) {
  state.shuffle = on;
  $("btn-shuffle").setAttribute("aria-pressed", String(on));
  if (rebuild && state.queue.length && state.pos >= 0) {
    const current = state.order[state.pos];
    buildOrder(current);
    state.pos = state.order.indexOf(current);
    renderQueue();
  }
}

function cycleRepeat() {
  state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
  $("btn-repeat").textContent = `Repeat: ${state.repeat}`;
  $("btn-repeat").setAttribute("aria-pressed", String(state.repeat !== "off"));
}

function showNow(track, note) {
  const art = artFor(track);
  $("now-art").hidden = !art;
  if (art) $("now-art").src = art;
  $("now-title").textContent = track.title;
  $("now-sub").textContent = note || `${track.artist} · from ${LABELS[track.source]}`;
  document.title = `${track.title} · Playlist Merger`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: art ? [{ src: art, sizes: "512x512" }] : [],
    });
  }
}

// ---- Wiring ----------------------------------------------------------------

const setPlaying = (on) => {
  $("btn-play").classList.toggle("is-playing", on);
  $("btn-play").setAttribute("aria-label", on ? "Pause" : "Play");
  $("btn-play").title = on ? "Pause" : "Play";
};
audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));
audio.addEventListener("ended", () => next(true));
let seeking = false;
audio.addEventListener("timeupdate", () => {
  if (seeking) return;
  $("time-cur").textContent = fmt(audio.currentTime * 1000);
  $("time-dur").textContent = fmt(audio.duration * 1000);
  $("seek").value = audio.duration ? String(Math.round((audio.currentTime / audio.duration) * 1000)) : "0";
});
$("seek").addEventListener("input", () => {
  seeking = true;
  if (audio.duration) $("time-cur").textContent = fmt((Number($("seek").value) / 1000) * audio.duration * 1000);
});
$("seek").addEventListener("change", () => {
  const to = (Number($("seek").value) / 1000) * (audio.duration || 0);
  if (inJam()) window.jam.control("seek", to);
  else if (audio.duration) audio.currentTime = to;
  seeking = false;
});

const savedVolume = Number(localStorage.getItem("volume") ?? 80);
$("volume").value = String(savedVolume);
audio.volume = savedVolume / 100;
$("volume").addEventListener("input", () => {
  audio.volume = Number($("volume").value) / 100;
  localStorage.setItem("volume", $("volume").value);
});

$("btn-play").addEventListener("click", togglePlay);
$("btn-next").addEventListener("click", () => next());
$("btn-prev").addEventListener("click", prev);
$("btn-shuffle").addEventListener("click", () => setShuffle(!state.shuffle));
$("btn-repeat").addEventListener("click", cycleRepeat);
$("new-mix").addEventListener("click", newMix);
$("jam-nav").addEventListener("click", openJamView);
$("jam-add-all").addEventListener("click", () => {
  const mix = currentMix();
  if (mix && inJam()) window.jam.addTracks(mergedTracks(mix));
});
$("empty-new").addEventListener("click", newMix);
$("play-all").addEventListener("click", () => playFromMix(null, { shuffle: false }));
$("shuffle-all").addEventListener("click", () => playFromMix(null, { shuffle: true }));
$("queue-all").addEventListener("click", () => {
  const mix = currentMix();
  if (mix) enqueue(mergedTracks(mix));
});
$("delete-mix").addEventListener("click", deleteMix);
$("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  addSource($("add-url").value.trim());
});
$("mix-name").addEventListener("change", () => {
  const mix = currentMix();
  if (!mix) return;
  mix.name = $("mix-name").value.trim() || mix.name;
  save();
  renderSidebar();
});
$("mix-order").addEventListener("change", () => {
  currentMix().order = $("mix-order").value;
  save();
  render();
});
$("mix-dedupe").addEventListener("change", () => {
  currentMix().dedupe = $("mix-dedupe").checked;
  save();
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input[type=url], input[type=text], input:not([type]), .mix-name, select")) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.ctrlKey && e.key === "ArrowRight") next();
  else if (e.ctrlKey && e.key === "ArrowLeft") prev();
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlay);
  navigator.mediaSession.setActionHandler("pause", togglePlay);
  navigator.mediaSession.setActionHandler("nexttrack", () => next());
  navigator.mediaSession.setActionHandler("previoustrack", prev);
}

// Starts once every script (queue.js, jam.js, customize.js) has loaded.
window.addEventListener("DOMContentLoaded", async () => {
  const auth = await window.api.authStatus().catch((e) => ({ required: true, signedIn: false, reason: "", email: "", error: e.message }));
  if (!auth.signedIn) return showSignIn(auth);
  showAccount(auth);
  const lib = await window.api.getLibrary();
  state.mixes = lib.mixes;
  state.matches = lib.matches;
  state.currentMixId = state.mixes[0]?.id ?? null;
  render();
  // Fetch yt-dlp in the background so the first song starts faster.
  window.api.prepareTools().catch(() => {});
});
