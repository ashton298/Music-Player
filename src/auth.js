// Sign-in: only emails on the owner's Google Sheet can use the app. The sheet
// is checked by a small Google Apps Script (server/apps-script.gs), which emails
// a one-time code and hands back a signed token. The app re-checks the token
// each time it opens and every few hours, and keeps working offline for a few
// days since the last successful check.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const config = require("./auth-config.json");

const OFFLINE_DAYS = 3;
const RECHECK_HOURS = 6;
const SCRIPT_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

// Tests can point a development build at a local server.
const url = () => (!app.isPackaged && process.env.PM_AUTH_URL) || config.url || "";
const required = () => !!url() && (SCRIPT_URL.test(url()) || (!app.isPackaged && !!process.env.PM_AUTH_URL));
const file = () => path.join(app.getPath("userData"), "auth.json");

let saved = { email: null, token: null, lastOk: 0 };
let signedIn = false;
let reason = "";

function load() {
  try {
    saved = { ...saved, ...JSON.parse(fs.readFileSync(file(), "utf8")) };
  } catch {}
}

function save() {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(saved));
}

function clear(why = "") {
  saved = { email: saved.email, token: null, lastOk: 0 }; // keep the email to prefill the form
  signedIn = false;
  reason = why;
  save();
}

async function call(body) {
  let res;
  try {
    res = await fetch(url(), {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify(body),
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    const err = new Error("Couldn't reach the sign-in server. Check your internet.");
    err.offline = true;
    throw err;
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The sign-in server isn't set up right (it didn't answer with JSON).");
  }
}

// Asks the server whether the saved token is still good. Returns true if
// signed in afterwards.
async function recheck() {
  if (!required()) return (signedIn = true);
  if (!saved.token) return (signedIn = false);
  try {
    const r = await call({ action: "check", token: saved.token });
    if (r.ok) {
      saved.lastOk = Date.now();
      save();
      signedIn = true;
      reason = "";
    } else {
      clear(r.error === "removed" ? "removed" : "signed-out");
    }
  } catch (e) {
    if (!e.offline) throw e;
    signedIn = Date.now() - saved.lastOk < OFFLINE_DAYS * 864e5;
    if (!signedIn) reason = "offline-too-long";
  }
  return signedIn;
}

const MESSAGES = {
  "not-allowed": "That email isn't on the list. Ask whoever shared the app with you to add it.",
  "too-many": "Too many tries. Wait an hour and try again.",
  expired: "That code has expired. Send a new one.",
  "wrong-code": "That code isn't right. Check the email and try again.",
  "bad-request": "The app sent something the server didn't understand.",
};
const fail = (r) => {
  throw new Error(MESSAGES[r.error] || r.message || "Something went wrong on the sign-in server.");
};

async function sendCode(email) {
  const r = await call({ action: "sendCode", email: String(email || "").trim() });
  if (!r.ok) fail(r);
  saved.email = String(email).trim().toLowerCase();
  save();
}

async function verify(email, code) {
  const r = await call({ action: "verify", email: String(email || "").trim(), code: String(code || "").replace(/\D/g, "") });
  if (!r.ok) fail(r);
  saved = { email: r.email, token: r.token, lastOk: Date.now() };
  save();
  signedIn = true;
  reason = "";
}

function signOut() {
  clear();
}

const status = () => ({ required: required(), signedIn, email: saved.email, reason });
const isSignedIn = () => signedIn || !required();

// Re-checks every few hours while the app is open; onLock runs if access ends.
function start(onLock) {
  load();
  setInterval(async () => {
    if (!signedIn || !required()) return;
    const ok = await recheck().catch(() => true);
    if (!ok) onLock(status());
  }, RECHECK_HOURS * 3600e3);
}

module.exports = { start, recheck, sendCode, verify, signOut, status, isSignedIn };
