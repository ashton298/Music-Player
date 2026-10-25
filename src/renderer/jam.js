// Jam: listen together over the internet. The host's app owns the queue and
// the clock; each guest's app downloads the same songs itself and follows the
// host's "now playing at second N" messages. PeerJS's free public server only
// introduces the apps; after that they talk directly (or through PeerJS's
// relay when a network blocks direct connections).
//
// Loaded after app.js and uses its globals (state, audio, $, el, fmt, ...).

const JAM_PREFIX = "pm-jam-v1-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_QUEUE = 1000;
const MAX_ADD = 300;
const SYNC_EVERY_MS = 2000;
const DRIFT_LIMIT_S = 0.6;
const HOST_SILENT_MS = 8000;

const jam = (window.jam = {
  active: false,
  role: null, // "host" | "guest"
  code: "",
  peer: null,
  guests: new Map(), // host only: peer id -> { conn, name }
  hostConn: null, // guest only
  queue: [], // items: track fields + { qid, by }
  now: -1,
  allowControl: false,
  loading: false,
  members: [],
  // Guest-side sync
  lastSync: null,
  loadedQid: null,
  clockOffset: 0, // host clock minus ours, from ping/pong
  bestRtt: Infinity,
  timers: [],
  failures: 0,
  // Handoff: the host picks a random guest as heir and tells everyone, so if
  // the host leaves (or their app dies) the heir takes over the same code.
  heir: null, // heir's peer id
  heirName: "",
  myId: null, // guest's own peer id
  handingOff: false,
});

const myName = () => (localStorage.getItem("jam-name") || "").trim() || "Someone";
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
const jamUid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");

// ---- Validation: everything from another app is untrusted -----------------

const str = (v, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");

function cleanTrack(t) {
  if (!t || typeof t !== "object") return null;
  if (!["spotify", "youtube", "tiktok"].includes(t.source)) return null;
  const out = {
    key: str(t.key, 200),
    title: str(t.title),
    artist: str(t.artist),
    durationMs: Number.isFinite(t.durationMs) ? Math.max(0, Math.min(t.durationMs, 6 * 3600e3)) : 0,
    source: t.source,
    art: /^https:\/\//.test(t.art || "") ? str(t.art, 1000) : null,
  };
  if (/^[A-Za-z0-9_-]{11}$/.test(t.ytId || "")) out.ytId = t.ytId;
  if (t.source === "spotify") out.spotifyUri = str(t.spotifyUri, 200) || out.key;
  if (t.source === "youtube" && !out.ytId) return null;
  if (t.source === "tiktok") {
    if (!/^https:\/\/([a-z0-9-]+\.)?tiktok\.com\/\S*$/i.test(t.mediaUrl || "") || !/^tt:\d+$/.test(out.key)) return null;
    out.mediaUrl = str(t.mediaUrl, 500);
  }
  return out.title && out.key ? out : null;
}

function cleanItem(t) {
  const c = cleanTrack(t);
  if (!c) return null;
  return { ...c, qid: /^[a-f0-9]{12}$/.test(t.qid || "") ? t.qid : jamUid(), by: str(t.by, 30) || "Someone" };
}

const trackOnly = (item) => {
  const { qid, by, ...t } = item;
  return t;
};

// ---- Shared helpers ---------------------------------------------------------

function jamStatus(text, error = false) {
  const s = $("jam-status");
  if (!s) return;
  s.textContent = text;
  s.classList.toggle("error", error);
}

const nowItem = () => (jam.now >= 0 ? jam.queue[jam.now] : null);
const canControl = () => jam.role === "host" || jam.allowControl;

function every(ms, fn) {
  jam.timers.push(setInterval(fn, ms));
}

function clearTimers() {
  for (const t of jam.timers) clearInterval(t);
  jam.timers = [];
}

function stopMixPlayback() {
  state.loadToken++;
  state.queue = [];
  state.order = [];
  state.pos = -1;
  audio.pause();
}

function resetJam() {
  for (const t of jam.timers) clearInterval(t);
  Object.assign(jam, {
    active: false, role: null, code: "", peer: null, hostConn: null, queue: [], now: -1, allowControl: false,
    loading: false, members: [], lastSync: null, loadedQid: null, clockOffset: 0, bestRtt: Infinity, timers: [], failures: 0,
    heir: null, heirName: "", myId: null, handingOff: false,
  });
  jam.guests = new Map();
  state.loadToken++;
  audio.pause();
  audio.removeAttribute("src");
  setControlsForJam();
}

// Loads a queue item into the local player. Returns false if it was superseded.
async function loadItem(item) {
  const token = ++state.loadToken;
  audio.pause();
  showNow(item, item.source === "spotify" && !item.ytId ? "Finding it on YouTube…" : "Loading…");
  const res = await window.api.resolve(trackOnly(item));
  if (token !== state.loadToken) return false;
  if (item.spotifyUri) state.matches[item.spotifyUri] = res;
  if (res.ytId && item.source === "spotify") item.ytId = res.ytId; // share the exact recording
  audio.src = res.url;
  await new Promise((ok, fail) => {
    audio.addEventListener("loadedmetadata", ok, { once: true });
    audio.addEventListener("error", () => fail(new Error("This song's audio couldn't be opened.")), { once: true });
  });
  if (token !== state.loadToken) return false;
  showNow(item, `${item.artist} · added by ${item.by}`);
  return true;
}

function prefetchAfter(index) {
  const nextItem = jam.queue[index + 1];
  if (nextItem) window.api.prefetch(trackOnly(nextItem)).catch(() => {});
}

// ---- Host ---------------------------------------------------------------------

// takeover = { code, queue, now, allow, deadline } when a guest inherits the Jam.
function startHost(takeover = null) {
  if (!takeover) stopMixPlayback();
  const code = takeover?.code ?? newCode();
  if (!takeover) jamStatus("Starting your Jam…");
  const peer = new Peer(JAM_PREFIX + code, { debug: 0 });
  peer.on("open", () => {
    clearTimers();
    Object.assign(jam, { active: true, role: "host", code, peer, members: [], handingOff: false, heir: null, heirName: "", loading: false });
    jam.guests = new Map();
    if (takeover) {
      jam.queue = takeover.queue;
      jam.now = takeover.now;
      jam.allowControl = takeover.allow;
    }
    every(SYNC_EVERY_MS, () => broadcast(syncMsg()));
    setControlsForJam();
    jamStatus(takeover ? "The host left, so you're the host now. Everyone else is reconnecting to you." : "");
    renderJam();
    renderSidebar();
  });
  peer.on("connection", (conn) => hostAccept(conn));
  peer.on("disconnected", () => {
    // Lost the PeerJS server only; guests stay connected. Reconnect so new people can join.
    if (jam.peer === peer) setTimeout(() => !peer.destroyed && peer.reconnect(), 2000);
  });
  peer.on("error", (err) => {
    if (err.type === "unavailable-id") {
      peer.destroy();
      if (!takeover) startHost(); // code clash; pick another
      // The old host's id can linger for a few seconds after they vanish.
      else if (Date.now() < takeover.deadline) setTimeout(() => startHost(takeover), 2000);
      else leaveJam("Couldn't take over the Jam. Start a new one.");
      return;
    }
    if (!jam.active) {
      jamStatus(`Couldn't start the Jam: ${friendlyError(err)}`, true);
      peer.destroy();
    }
  });
}

function hostAccept(conn) {
  conn.on("open", () => {
    if (jam.guests.size >= 20) {
      conn.send({ type: "full" });
      setTimeout(() => conn.close(), 500);
      return;
    }
    jam.guests.set(conn.peer, { conn, name: "Someone" });
  });
  conn.on("data", (msg) => {
    try {
      hostHandle(conn, msg);
    } catch (e) {
      console.error("Jam message failed", e);
    }
  });
  conn.on("close", () => {
    if (!jam.guests.delete(conn.peer)) return;
    afterChange();
  });
}

function hostHandle(conn, msg) {
  const guest = jam.guests.get(conn.peer);
  if (!guest || !msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  switch (msg.type) {
    case "hello":
      guest.name = str(msg.name, 30).trim() || "Someone";
      conn.send(fullState());
      afterChange();
      break;
    case "ping":
      if (Number.isFinite(msg.t)) conn.send({ type: "pong", t: msg.t, h: Date.now() });
      break;
    case "add":
      if (Array.isArray(msg.tracks)) addToQueue(msg.tracks.slice(0, MAX_ADD), guest.name);
      break;
    case "control":
      if (!jam.allowControl) conn.send({ type: "denied" });
      else hostControl(str(msg.action, 20), msg.arg);
      break;
  }
}

function syncMsg() {
  const item = nowItem();
  return {
    type: "sync",
    qid: item?.qid ?? null,
    ytId: item?.ytId ?? null,
    playing: !!item && !audio.paused && !jam.loading,
    loading: jam.loading,
    pos: audio.currentTime || 0,
    at: Date.now(),
  };
}

function fullState() {
  return {
    type: "state",
    queue: jam.queue,
    now: jam.now,
    allow: jam.allowControl,
    members: [`${myName()} (host)`, ...[...jam.guests.values()].map((g) => g.name)],
    heir: jam.heir,
    heirName: jam.guests.get(jam.heir)?.name ?? "",
    sync: syncMsg(),
  };
}

function broadcast(msg) {
  for (const { conn } of jam.guests.values()) if (conn.open) conn.send(msg);
}

function afterChange() {
  if (!jam.guests.has(jam.heir)) {
    const ids = [...jam.guests.keys()];
    jam.heir = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  }
  jam.members = [`${myName()} (host)`, ...[...jam.guests.values()].map((g) => g.name)];
  broadcast(fullState());
  renderJam();
  renderSidebar();
}

function addToQueue(tracks, by) {
  const room = MAX_QUEUE - jam.queue.length;
  const items = tracks.map((t) => cleanItem({ ...t, qid: undefined, by })).filter(Boolean).slice(0, Math.max(0, room));
  if (!items.length) return 0;
  jam.queue.push(...items);
  const idle = jam.now < 0 || (jam.now === jam.queue.length - items.length - 1 && audio.ended);
  if (idle) hostPlay(jam.queue.length - items.length);
  else {
    if (jam.now === jam.queue.length - items.length - 1) prefetchAfter(jam.now);
    afterChange();
  }
  return items.length;
}

async function hostPlay(index) {
  if (index < 0 || index >= jam.queue.length) return;
  jam.now = index;
  jam.loading = true;
  afterChange();
  const item = nowItem();
  try {
    if (!(await loadItem(item))) return;
    jam.loading = false;
    jam.failures = 0;
    await audio.play();
    afterChange(); // carries the YouTube match so everyone hears the same recording
    prefetchAfter(index);
  } catch (e) {
    if (nowItem() !== item) return;
    jam.loading = false;
    jam.failures++;
    showNow(item, `Couldn't play: ${e.message}`);
    afterChange();
    if (jam.failures < 3) setTimeout(() => nowItem() === item && hostPlay(index + 1), 1500);
  }
}

function hostControl(action, arg) {
  const findIndex = (qid) => jam.queue.findIndex((i) => i.qid === qid);
  switch (action) {
    case "toggle":
      if (!nowItem()) return jam.queue.length && hostPlay(Math.max(0, jam.now));
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return; // play/pause events broadcast
    case "next":
      if (jam.now + 1 < jam.queue.length) hostPlay(jam.now + 1);
      return;
    case "prev":
      if (audio.currentTime > 3 || jam.now <= 0) audio.currentTime = 0;
      else hostPlay(jam.now - 1);
      return;
    case "seek":
      if (Number.isFinite(arg) && audio.duration) audio.currentTime = Math.max(0, Math.min(arg, audio.duration - 0.5));
      return;
    case "jump": {
      const i = findIndex(arg);
      if (i >= 0) hostPlay(i);
      return;
    }
    case "remove": {
      const i = findIndex(arg);
      if (i < 0) return;
      if (i === jam.now) {
        jam.queue.splice(i, 1);
        if (i < jam.queue.length) hostPlay(i);
        else {
          jam.now = -1;
          state.loadToken++;
          audio.pause();
          afterChange();
        }
        return;
      }
      jam.queue.splice(i, 1);
      if (i < jam.now) jam.now--;
      afterChange();
      return;
    }
    case "up":
    case "down": {
      const i = findIndex(arg);
      const j = action === "up" ? i - 1 : i + 1;
      // Only songs still to come can be moved, and not above the current one.
      if (i <= jam.now || j <= jam.now || j >= jam.queue.length) return;
      [jam.queue[i], jam.queue[j]] = [jam.queue[j], jam.queue[i]];
      afterChange();
      return;
    }
  }
}

function setAllowControl(on) {
  jam.allowControl = on;
  afterChange();
}

// ---- Guest --------------------------------------------------------------------

// rejoin = { onFail } while reconnecting to a new host after a handoff.
function joinJam(rawCode, rejoin = null) {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) return jamStatus("Jam codes are 6 letters and numbers.", true);
  if (!rejoin) {
    stopMixPlayback();
    jamStatus("Connecting…");
  }
  const peer = new Peer({ debug: 0 });
  let opened = false;
  const fail = (message) => {
    peer.destroy();
    if (rejoin) rejoin.onFail();
    else jamStatus(message, true);
  };
  const giveUp = setTimeout(() => {
    if (!opened) fail("Couldn't reach that Jam. Check the code and that the host still has it open.");
  }, rejoin ? 6000 : 15000);
  peer.on("open", (id) => {
    const conn = peer.connect(JAM_PREFIX + code, { reliable: true });
    conn.on("open", () => {
      opened = true;
      clearTimeout(giveUp);
      clearTimers();
      Object.assign(jam, { active: true, role: "guest", code, peer, hostConn: conn, myId: id, handingOff: false, bestRtt: Infinity, lastHeard: Date.now() });
      conn.send({ type: "hello", name: myName() });
      ping();
      every(4000, ping);
      every(1000, follow);
      // The host syncs every 2 s. A crashed host's connection can take 30 s+
      // to report closing, so silence is the faster signal.
      every(1000, () => {
        if (jam.role === "guest" && !jam.handingOff && Date.now() - jam.lastHeard > HOST_SILENT_MS) hostGone();
      });
      setControlsForJam();
      jamStatus(rejoin ? "Reconnected to the new host." : "");
      renderJam();
      renderSidebar();
    });
    conn.on("data", (msg) => {
      try {
        guestHandle(msg);
      } catch (e) {
        console.error("Jam message failed", e);
      }
    });
    conn.on("close", () => {
      if (jam.hostConn !== conn || jam.role !== "guest") return;
      hostGone(); // left without saying so, or the connection dropped
    });
  });
  peer.on("error", (err) => {
    if (opened) return;
    clearTimeout(giveUp);
    fail(err.type === "peer-unavailable" ? "There's no Jam with that code right now." : `Couldn't join: ${friendlyError(err)}`);
  });
}

// The host left: the heir becomes host on the same code, everyone else
// reconnects to it. Music keeps playing from the last known position meanwhile.
function hostGone() {
  if (jam.handingOff || jam.role !== "guest") return;
  jam.handingOff = true;
  const code = jam.code;
  const oldPeer = jam.peer;
  jam.hostConn = null;
  clearTimers();
  every(1000, follow);
  setTimeout(() => oldPeer?.destroy(), 200);
  const deadline = Date.now() + 60000;
  if (jam.heir && jam.heir === jam.myId) {
    jamStatus("The host left. Taking over the Jam…");
    const now = jam.queue.findIndex((i) => i.qid === jam.loadedQid);
    startHost({ code, queue: jam.queue, now: now >= 0 ? now : jam.now, allow: jam.allowControl, deadline });
    return;
  }
  jamStatus(`The host left. Reconnecting${jam.heirName ? ` to ${jam.heirName}` : ""}…`);
  const attempt = () => {
    if (!jam.handingOff) return;
    if (Date.now() > deadline) return leaveJam("The host left and nobody could take over the Jam.");
    joinJam(code, { onFail: () => setTimeout(attempt, 3000) });
  };
  setTimeout(attempt, 2500);
}

function ping() {
  if (jam.hostConn?.open) jam.hostConn.send({ type: "ping", t: Date.now() });
}

function guestHandle(msg) {
  if (!msg || typeof msg !== "object") return;
  jam.lastHeard = Date.now();
  switch (msg.type) {
    case "state": {
      jam.queue = Array.isArray(msg.queue) ? msg.queue.slice(0, MAX_QUEUE).map(cleanItem).filter(Boolean) : [];
      jam.now = Number.isInteger(msg.now) && msg.now < jam.queue.length ? msg.now : -1;
      jam.allowControl = !!msg.allow;
      jam.members = Array.isArray(msg.members) ? msg.members.slice(0, 25).map((m) => str(m, 40)) : [];
      jam.heir = typeof msg.heir === "string" ? msg.heir.slice(0, 64) : null;
      jam.heirName = str(msg.heirName, 30);
      setControlsForJam();
      renderJam();
      renderSidebar();
      if (msg.sync) applySync(msg.sync);
      break;
    }
    case "sync":
      applySync(msg);
      break;
    case "pong": {
      const rtt = Date.now() - msg.t;
      if (Number.isFinite(rtt) && Number.isFinite(msg.h) && rtt >= 0 && rtt <= jam.bestRtt * 1.5 + 20) {
        jam.bestRtt = Math.min(jam.bestRtt, rtt);
        jam.clockOffset = msg.h + rtt / 2 - Date.now();
      }
      break;
    }
    case "denied":
      jamStatus("The host hasn't turned on guest controls. You can still add songs.", true);
      break;
    case "full":
      leaveJam("That Jam is full (20 people).");
      break;
    case "ended":
      leaveJam("The host ended the Jam.");
      break;
    case "handoff":
      hostGone();
      break;
  }
}

async function applySync(s) {
  if (!s || typeof s !== "object") return;
  jam.lastSync = {
    qid: typeof s.qid === "string" ? s.qid : null,
    ytId: /^[A-Za-z0-9_-]{11}$/.test(s.ytId || "") ? s.ytId : null,
    playing: !!s.playing,
    loading: !!s.loading,
    pos: Number.isFinite(s.pos) ? s.pos : 0,
    at: Number.isFinite(s.at) ? s.at : Date.now(),
  };
  const item = jam.queue.find((i) => i.qid === jam.lastSync.qid);
  if (!item) {
    if (jam.loadedQid) {
      jam.loadedQid = null;
      state.loadToken++;
      audio.pause();
    }
    return;
  }
  if (jam.lastSync.ytId) item.ytId = jam.lastSync.ytId;
  if (item.qid !== jam.loadedQid) {
    jam.loadedQid = item.qid;
    try {
      if (!(await loadItem(item))) return;
      renderJam();
      prefetchAfter(jam.queue.indexOf(item));
    } catch (e) {
      showNow(item, `Couldn't play this one: ${e.message}`);
      return;
    }
  }
  follow();
}

// Keeps the guest's player at the host's position.
function follow() {
  const s = jam.lastSync;
  if (jam.role !== "guest" || !s || s.qid !== jam.loadedQid || !audio.src || audio.readyState < 1) return;
  if (!s.playing || s.loading) {
    if (!audio.paused) audio.pause();
    if (Math.abs(audio.currentTime - s.pos) > DRIFT_LIMIT_S) audio.currentTime = s.pos;
    return;
  }
  const hostNow = Date.now() + jam.clockOffset;
  const target = s.pos + (hostNow - s.at) / 1000;
  if (audio.duration && target >= audio.duration) return;
  if (Math.abs(audio.currentTime - target) > DRIFT_LIMIT_S) audio.currentTime = Math.max(0, target);
  if (audio.paused) audio.play().catch(() => {});
}

// ---- Actions used by app.js and the Jam view ---------------------------------

jam.control = (action, arg) => {
  if (!canControl()) return jamStatus("Only the host can do that unless they turn on guest controls.", true);
  if (jam.role === "host") hostControl(action, arg);
  else jam.hostConn?.send({ type: "control", action, arg });
};

jam.onEnded = () => {
  if (jam.role === "host") {
    if (jam.now + 1 < jam.queue.length) hostPlay(jam.now + 1);
    else afterChange();
  }
};

jam.addTracks = (tracks) => {
  const clean = tracks.map(cleanTrack).filter(Boolean).slice(0, MAX_ADD);
  if (!clean.length) return;
  if (jam.role === "host") addToQueue(clean, myName());
  else jam.hostConn?.send({ type: "add", tracks: clean });
  const msg = clean.length === 1 ? `Added "${clean[0].title}" to the Jam.` : `Added ${clean.length} songs to the Jam.`;
  jamStatus(msg);
  setStatus(msg);
};

// A host leaving hands the Jam to the heir unless endForAll is set.
function leaveJam(message, { endForAll = false } = {}) {
  if (jam.role === "host") broadcast({ type: endForAll || !jam.guests.size ? "ended" : "handoff" });
  const peer = jam.peer;
  resetJam();
  setTimeout(() => peer?.destroy(), 300);
  renderJam();
  renderSidebar();
  if (message) jamStatus(message, true);
  $("now-title").textContent = "Nothing playing";
  $("now-sub").textContent = "";
  $("now-art").hidden = true;
  document.title = "Playlist Merger";
}

function friendlyError(err) {
  if (err?.type === "network" || err?.type === "server-error" || err?.type === "socket-error") return "couldn't reach the Jam server. Check your internet.";
  if (err?.type === "browser-incompatible") return "this computer doesn't support Jams.";
  return err?.message || String(err);
}

// Shuffle and repeat belong to normal mix playback, not the shared queue.
function setControlsForJam() {
  for (const id of ["btn-shuffle", "btn-repeat"]) $(id).disabled = jam.active;
  const locked = jam.active && !canControl();
  for (const id of ["btn-play", "btn-next", "btn-prev", "seek"]) {
    $(id).disabled = locked;
    $(id).title = locked ? "The host controls playback" : "";
  }
}

// ---- Jam view ------------------------------------------------------------------

function renderJam() {
  const root = $("jam");
  if (!root || root.hidden) return;
  root.replaceChildren(jam.active ? activeView() : startView());
}

function startView() {
  const nameInput = el("input", { id: "jam-name", type: "text", maxlength: "30", placeholder: "Your name", value: localStorage.getItem("jam-name") || "" });
  const saveName = () => localStorage.setItem("jam-name", nameInput.value.trim());
  const codeInput = el("input", { id: "jam-code", type: "text", maxlength: "7", placeholder: "Code, e.g. KX7RQM", autocomplete: "off" });
  return el(
    "div",
    { class: "jam-start" },
    el("h2", {}, "Jam"),
    el("p", { class: "muted" }, "Listen together with friends anywhere. Everyone hears the same song at the same time and can add to the queue. Friends need Playlist Merger installed."),
    el("label", { class: "jam-field" }, "Your name", nameInput),
    el(
      "div",
      { class: "jam-cards" },
      el(
        "section",
        { class: "jam-card" },
        el("h3", {}, "Start a Jam"),
        el("p", { class: "muted" }, "You get a code to send to friends. You stay in charge of playback."),
        el("button", { type: "button", class: "btn btn-primary", onclick: () => (saveName(), startHost()) }, "Start a Jam"),
      ),
      el(
        "section",
        { class: "jam-card" },
        el("h3", {}, "Join a Jam"),
        el(
          "form",
          { class: "jam-join", onsubmit: (e) => (e.preventDefault(), saveName(), joinJam(codeInput.value)) },
          codeInput,
          el("button", { type: "submit", class: "btn btn-primary" }, "Join"),
        ),
      ),
    ),
    el("p", { id: "jam-status", class: "status", role: "status" }),
  );
}

function activeView() {
  const isHost = jam.role === "host";
  const addInput = el("input", { type: "url", placeholder: "Paste a Spotify, YouTube or TikTok link to add it", required: "" });
  const addBtn = el("button", { type: "submit", class: "btn btn-primary" }, "Add");
  const addForm = el(
    "form",
    {
      class: "add-form",
      onsubmit: async (e) => {
        e.preventDefault();
        addBtn.disabled = true;
        jamStatus("Reading the link…");
        try {
          const src = await window.api.importSource(addInput.value.trim());
          jam.addTracks(src.tracks);
          addInput.value = "";
        } catch (err) {
          jamStatus(err.message, true);
        } finally {
          addBtn.disabled = false;
        }
      },
    },
    addInput,
    addBtn,
  );

  const rows = jam.queue.map((item, i) => {
    const played = i < jam.now;
    const playing = i === jam.now;
    const upcoming = i > jam.now;
    const control = canControl();
    return el(
      "li",
      { class: ["jam-row", playing ? "playing" : "", played ? "played" : ""].join(" ") },
      el("span", { class: "t-num" }, playing ? "▶" : String(i + 1)),
      item.art ? el("img", { class: "t-art", src: item.art, alt: "", loading: "lazy" }) : el("span", { class: "t-art" }),
      el("div", { class: "t-text" }, el("p", { class: "t-title" }, item.title), el("p", { class: "t-artist" }, `${item.artist} · added by ${item.by}`)),
      el(
        "span",
        { class: "t-tags" },
        control && !playing ? el("button", { type: "button", class: "link-btn", onclick: () => jam.control("jump", item.qid) }, "Play") : null,
        control && upcoming && i > jam.now + 1 ? el("button", { type: "button", class: "link-btn", title: "Move up", onclick: () => jam.control("up", item.qid) }, "Up") : null,
        control && upcoming && i < jam.queue.length - 1 ? el("button", { type: "button", class: "link-btn", title: "Move down", onclick: () => jam.control("down", item.qid) }, "Down") : null,
        control ? el("button", { type: "button", class: "link-btn", onclick: () => jam.control("remove", item.qid) }, "Remove") : null,
        el("span", { class: `badge ${item.source}` }, LABELS[item.source]),
      ),
      el("span", { class: "t-dur" }, fmt(item.durationMs)),
    );
  });

  return el(
    "div",
    { class: "jam-active" },
    el(
      "header",
      { class: "jam-head" },
      el("div", {}, el("h2", {}, isHost ? "Your Jam" : "In a Jam"), el("p", { class: "muted" }, jam.members.join(", ") || "Just you so far")),
      el(
        "div",
        { class: "jam-code-box" },
        el("span", { class: "muted" }, "Code"),
        el("strong", { class: "jam-code" }, jam.code),
        el("button", { type: "button", class: "btn", onclick: (e) => copyCode(e.currentTarget) }, "Copy"),
      ),
    ),
    el(
      "div",
      { class: "row" },
      isHost
        ? el(
            "label",
            { class: "field-inline" },
            el("input", { type: "checkbox", ...(jam.allowControl ? { checked: "" } : {}), onchange: (e) => setAllowControl(e.target.checked) }),
            " Let guests pause, skip and reorder",
          )
        : el("span", { class: "muted" }, jam.allowControl ? "The host lets everyone control playback." : "The host controls playback. You can add songs."),
      el("span", { class: "spacer" }),
      isHost && jam.guests.size
        ? el("button", { type: "button", class: "btn", title: "A random guest becomes the host and the music keeps going", onclick: () => leaveJam() }, "Leave Jam")
        : null,
      el(
        "button",
        { type: "button", class: "btn btn-danger", onclick: () => leaveJam(null, { endForAll: isHost }) },
        isHost ? (jam.guests.size ? "End Jam for everyone" : "End Jam") : "Leave Jam",
      ),
    ),
    addForm,
    el("p", { id: "jam-status", class: "status", role: "status" }),
    el("p", { class: "muted" }, "Tip: open any of your mixes on the left and click songs to add them here."),
    jam.queue.length ? el("ol", { class: "track-list" }, ...rows) : el("p", { class: "muted jam-empty" }, "The queue is empty. Add a song to start the music."),
  );
}

async function copyCode(btn) {
  try {
    await navigator.clipboard.writeText(jam.code);
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  } catch {
    btn.textContent = "Select it";
  }
}

// Host: position changes the guests must hear about right away.
for (const ev of ["play", "pause", "seeked"]) {
  audio.addEventListener(ev, () => {
    if (jam.role === "host" && !jam.loading) broadcast(syncMsg());
  });
}

window.addEventListener("beforeunload", () => {
  if (jam.role === "host") broadcast({ type: jam.guests.size ? "handoff" : "ended" });
  jam.peer?.destroy();
});
