// Playlist Merger sign-in server. It runs free on Google's servers as you.
//
// Setup (once): open your Google Sheet > Extensions > Apps Script, replace the
// code there with this file, then Deploy > New deployment > Web app,
// "Execute as: Me", "Who has access: Anyone". Copy the Web app URL into the app.
//
// The allowed emails go in column A of the sheet's first tab, one per row.
// A header row is fine. Removing an email locks that person out the next time
// their app checks (each time it opens, and every few hours while it's open).
//
// To sign everyone out: Project Settings > Script properties > delete SECRET.

const CODE_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;
const MAX_TRIES = 5;

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {}
  let out;
  try {
    out = handle(body);
  } catch (err) {
    out = { ok: false, error: "server", message: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the URL in a browser just says it's running.
function doGet() {
  return ContentService.createTextOutput("Playlist Merger sign-in is running.");
}

function handle(b) {
  const email = cleanEmail(b.email);
  switch (b.action) {
    case "sendCode":
      return sendCode(email);
    case "verify":
      return verify(email, String(b.code || "").trim());
    case "check":
      return check(String(b.token || ""));
  }
  return { ok: false, error: "bad-request" };
}

function cleanEmail(e) {
  return String(e || "").trim().toLowerCase().slice(0, 200);
}

function isAllowed(email) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  return sheet
    .getDataRange()
    .getValues()
    .some((row) => cleanEmail(row[0]) === email);
}

function sendCode(email) {
  if (!isAllowed(email)) return { ok: false, error: "not-allowed" };
  const cache = CacheService.getScriptCache();
  const sent = Number(cache.get("n:" + email) || 0);
  if (sent >= MAX_CODES_PER_HOUR) return { ok: false, error: "too-many" };
  cache.put("n:" + email, String(sent + 1), 3600);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put("c:" + email, JSON.stringify({ code: code, tries: 0 }), CODE_MINUTES * 60);
  MailApp.sendEmail({
    to: email,
    subject: "Your Playlist Merger code: " + code,
    body: "Your Playlist Merger sign-in code is " + code + ".\n\nIt works for " + CODE_MINUTES + " minutes. If you didn't ask for it, you can ignore this email.",
  });
  return { ok: true };
}

function verify(email, code) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get("c:" + email);
  if (!raw) return { ok: false, error: "expired" };
  const saved = JSON.parse(raw);
  if (saved.tries >= MAX_TRIES) {
    cache.remove("c:" + email);
    return { ok: false, error: "too-many" };
  }
  if (code !== saved.code) {
    saved.tries++;
    cache.put("c:" + email, JSON.stringify(saved), CODE_MINUTES * 60);
    return { ok: false, error: "wrong-code" };
  }
  cache.remove("c:" + email);
  if (!isAllowed(email)) return { ok: false, error: "not-allowed" };
  return { ok: true, email: email, token: sign(JSON.stringify({ e: email, t: Date.now() })) };
}

function check(token) {
  const parts = token.split(".");
  if (parts.length !== 2 || hmac(parts[0]) !== parts[1]) return { ok: false, error: "signed-out" };
  let email;
  try {
    email = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()).e;
  } catch (err) {
    return { ok: false, error: "signed-out" };
  }
  if (!isAllowed(cleanEmail(email))) return { ok: false, error: "removed" };
  return { ok: true, email: email };
}

// Tokens are "payload.signature", signed with a secret only this script knows.
function sign(json) {
  const payload = Utilities.base64EncodeWebSafe(json);
  return payload + "." + hmac(payload);
}

function hmac(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret()));
}

function secret() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty("SECRET");
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("SECRET", s);
  }
  return s;
}
