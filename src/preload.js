const { contextBridge, ipcRenderer } = require("electron");

// Every call resolves to its value or throws the main process's error message.
const call = async (channel, ...args) => {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (!res.ok) throw new Error(res.error);
  return res.value;
};

contextBridge.exposeInMainWorld("api", {
  getLibrary: () => call("library:get"),
  saveMixes: (mixes) => call("library:saveMixes", mixes),
  importSource: (url) => call("source:import", url),
  resolve: (track) => call("track:resolve", track),
  prefetch: (track) => call("track:prefetch", track),
  forgetMatch: (spotifyUri) => call("track:forgetMatch", spotifyUri),
  prepareTools: () => call("tools:prepare"),
  openExternal: (url) => call("shell:open", url),
  listThemes: () => call("themes:list"),
  importTheme: (bytes) => call("themes:import", bytes),
  removeTheme: (id) => call("themes:remove", id),
  exportTheme: (opts) => call("themes:export", opts),
  themeGuide: () => call("themes:guide"),
  saveThemeGuide: () => call("themes:saveGuide"),
  authStatus: () => call("auth:status"),
  sendCode: (email) => call("auth:sendCode", email),
  verifyCode: (email, code) => call("auth:verify", email, code),
  signOut: () => call("auth:signOut"),
  onLocked: (fn) => ipcRenderer.on("auth:locked", (_e, status) => fn(status)),
});
