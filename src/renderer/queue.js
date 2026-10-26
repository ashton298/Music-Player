// The queue panel, the song menu ("Play next", "Add to queue") and
// drag-to-reorder. Works for normal listening and, through window.jam, for the
// shared Jam queue.
//
// Loaded after app.js and uses its globals (state, $, el, fmt, ...).

const MAX_UP_NEXT = 1000;
const CONTEXT_SHOWN = 50;

// ---- Adding to the queue -----------------------------------------------------

function enqueue(tracks, { next = false } = {}) {
  if (!tracks.length) return;
  if (inJam()) return window.jam.addTracks(tracks, { next });
  const room = MAX_UP_NEXT - state.upNext.length;
  const items = tracks.slice(0, Math.max(0, room)).map((t) => ({ ...t, qid: uid() }));
  if (!items.length) return toast("The queue is full.");
  if (next) state.upNext.unshift(...items);
  else state.upNext.push(...items);
  const what = items.length === 1 ? `"${items[0].title}"` : `${items.length} songs`;
  toast(next ? `${what} will play next.` : `Added ${what} to the queue.`);
  if (next || state.upNext.length === items.length) prefetchNext();
  renderQueue();
}

function moveUpNext(qid, to) {
  const from = state.upNext.findIndex((i) => i.qid === qid);
  if (from < 0) return;
  const [item] = state.upNext.splice(from, 1);
  state.upNext.splice(Math.max(0, Math.min(to, state.upNext.length)), 0, item);
  if (from === 0 || to === 0) prefetchNext();
  renderQueue();
}

function removeUpNext(qid) {
  state.upNext = state.upNext.filter((i) => i.qid !== qid);
  renderQueue();
}

// Clicking a queued song plays it now and drops the queued songs before it.
function playUpNext(qid) {
  const i = state.upNext.findIndex((x) => x.qid === qid);
  if (i < 0) return;
  state.upNext.splice(0, i);
  playQueued();
}

let toastTimer = 0;
function toast(text) {
  let t = $("toast");
  if (!t) {
    t = el("div", { id: "toast", class: "toast", role: "status" });
    document.body.append(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---- Song menu -----------------------------------------------------------------

function openMenu(x, y, items) {
  const menu = $("menu");
  menu.replaceChildren(
    ...items.map((it) =>
      el("button", { type: "button", role: "menuitem", class: "menu-item", onclick: () => (closeMenu(), it.action()) }, it.label),
    ),
  );
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  menu.querySelector("button")?.focus();
}

function closeMenu() {
  $("menu").hidden = true;
}

document.addEventListener("pointerdown", (e) => {
  if (!$("menu").hidden && !e.target.closest("#menu")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
window.addEventListener("blur", closeMenu);

// opts.play: what "Play" does for this song (normal listening only).
function trackMenu(e, tracks, opts = {}) {
  const items = [];
  if (opts.play && !inJam()) items.push({ label: "Play", action: opts.play });
  items.push({ label: inJam() ? "Play next in the Jam" : "Play next", action: () => enqueue(tracks, { next: true }) });
  items.push({ label: inJam() ? "Add to the Jam queue" : "Add to queue", action: () => enqueue(tracks) });
  openMenu(e.clientX, e.clientY, items);
}

function moreButton(tracks, opts) {
  return el(
    "button",
    {
      type: "button",
      class: "link-btn more-btn",
      title: "More",
      "aria-label": "More options",
      onclick: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        trackMenu({ clientX: r.left, clientY: r.bottom + 4 }, tracks, opts);
      },
    },
    "⋯",
  );
}

// ---- Drag to reorder -------------------------------------------------------------

// Rows with data-qid and draggable="true" can be dragged within the list.
// onMove(qid, to) gets the row's new index within this list. The handle on each
// row also moves it with the arrow keys.
function makeSortable(list, onMove) {
  let dragQid = null;
  const rows = () => [...list.querySelectorAll(":scope > [data-qid]")];
  const clearMarks = () => list.querySelectorAll(".drop-before, .drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after"));
  const target = (e) => {
    const row = e.target.closest("[data-qid]");
    if (!row || row.parentElement !== list) return null;
    const r = row.getBoundingClientRect();
    return { row, after: e.clientY > r.top + r.height / 2 };
  };
  list.addEventListener("dragstart", (e) => {
    const row = e.target.closest?.("[data-qid]");
    if (!row || row.getAttribute("draggable") !== "true") return;
    dragQid = row.dataset.qid;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragQid);
    row.classList.add("dragging");
  });
  list.addEventListener("dragover", (e) => {
    if (!dragQid) return;
    e.preventDefault();
    clearMarks();
    const t = target(e);
    if (t) t.row.classList.add(t.after ? "drop-after" : "drop-before");
  });
  list.addEventListener("drop", (e) => {
    if (!dragQid) return;
    e.preventDefault();
    const t = target(e);
    const all = rows();
    const from = all.findIndex((r) => r.dataset.qid === dragQid);
    if (t && from >= 0) {
      let to = all.indexOf(t.row) + (t.after ? 1 : 0);
      if (from < to) to--;
      if (to !== from) onMove(dragQid, to);
    }
  });
  list.addEventListener("dragend", () => {
    dragQid = null;
    clearMarks();
    list.querySelectorAll(".dragging").forEach((r) => r.classList.remove("dragging"));
  });
  list.addEventListener("keydown", (e) => {
    if (!e.target.matches(".drag-handle") || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const row = e.target.closest("[data-qid]");
    const from = rows().indexOf(row);
    const to = from + (e.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= rows().length) return;
    const qid = row.dataset.qid;
    onMove(qid, to);
    requestAnimationFrame(() => list.querySelector(`[data-qid="${qid}"] .drag-handle`)?.focus());
  });
}

// ---- Queue rows -----------------------------------------------------------------

// opts: { sub, onclick, draggable, onRemove, playing }
function queueRow(item, opts = {}) {
  const art = artFor(item);
  return el(
    "li",
    {
      class: ["q-row", opts.playing ? "playing" : "", opts.onclick ? "clickable" : ""].join(" "),
      "data-qid": item.qid ?? null,
      draggable: opts.draggable ? "true" : null,
      onclick: opts.onclick ?? null,
    },
    opts.draggable
      ? el("button", { type: "button", class: "drag-handle", title: "Drag, or use the arrow keys, to move", "aria-label": `Move ${item.title}`, onclick: (e) => e.stopPropagation() }, "⠿")
      : el("span", { class: "drag-space" }),
    art ? el("img", { class: "t-art", src: art, alt: "", loading: "lazy" }) : el("span", { class: "t-art" }),
    el("div", { class: "t-text" }, el("p", { class: "t-title" }, item.title), el("p", { class: "t-artist" }, opts.sub ?? item.artist)),
    opts.onRemove
      ? el("button", { type: "button", class: "link-btn q-remove", title: "Remove from the queue", "aria-label": `Remove ${item.title}`, onclick: (e) => (e.stopPropagation(), opts.onRemove()) }, "✕")
      : null,
  );
}

function queueSection(title, action, list) {
  return el("section", { class: "q-section" }, el("div", { class: "q-section-head" }, el("h3", {}, title), action), list);
}

// ---- Queue panel ------------------------------------------------------------------

function renderQueue() {
  const body = $("queue-body");
  if (!body || $("queue-panel").hidden) return;
  if (inJam()) return body.replaceChildren(...window.jam.queuePanel());

  const parts = [];
  const cur = state.current?.track;
  if (cur) parts.push(queueSection("Now playing", null, el("ol", { class: "q-list" }, queueRow(cur, { playing: true }))));

  const upList = el(
    "ol",
    { class: "q-list" },
    ...state.upNext.map((item) => queueRow(item, { draggable: true, onclick: () => playUpNext(item.qid), onRemove: () => removeUpNext(item.qid) })),
  );
  makeSortable(upList, moveUpNext);
  parts.push(
    queueSection(
      "Next in queue",
      state.upNext.length ? el("button", { type: "button", class: "link-btn", onclick: () => ((state.upNext = []), renderQueue()) }, "Clear") : null,
      state.upNext.length ? upList : el("p", { class: "muted q-empty" }, "Right-click any song and pick Add to queue or Play next."),
    ),
  );

  const upcoming = [];
  for (let p = state.pos + 1; p < state.order.length && upcoming.length < CONTEXT_SHOWN; p++) upcoming.push(p);
  if (upcoming.length) {
    const more = state.order.length - state.pos - 1 - upcoming.length;
    parts.push(
      queueSection(
        `Next from: ${state.contextName || "your mix"}`,
        null,
        el(
          "ol",
          { class: "q-list" },
          ...upcoming.map((p) => queueRow(state.queue[state.order[p]], { onclick: () => playAt(p) })),
          more > 0 ? el("li", { class: "muted q-more" }, `and ${more} more`) : null,
        ),
      ),
    );
  }
  body.replaceChildren(...parts);
}

// ---- Showing and hiding the panel ----------------------------------------------

function setQueueOpen(open) {
  window.ui?.set({ showQueue: open });
}

$("btn-queue").addEventListener("click", () => setQueueOpen($("queue-panel").hidden));
$("queue-close").addEventListener("click", () => setQueueOpen(false));
