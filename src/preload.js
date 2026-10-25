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
});
