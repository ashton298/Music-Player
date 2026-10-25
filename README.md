# Playlist Merger

Merge Spotify and YouTube playlists into one queue and play them back-to-back. No API keys and no Spotify Premium needed.

## Install it

Run `dist\Playlist Merger Setup 0.3.0.exe`. It installs just for you (no admin prompt) into `%LOCALAPPDATA%\Programs\playlist-merger` and adds Desktop and Start menu shortcuts. Uninstall it from Windows Settings > Apps; your mixes are kept.

The installer isn't code-signed, so if you copy it to another PC, Windows SmartScreen may warn about it ("More info" > "Run anyway").

## Develop

```
npm install
npm start          # run from source
npm run build      # rebuild the installer into dist/, then run it again to update the installed app
```

## Adding music

Paste any of these into a mix:
- A Spotify playlist, album or song link.
- A YouTube or YouTube Music playlist link.
- A YouTube video link, including `youtu.be` short links. A song link copied while a playlist was playing (`watch?v=…&list=…`) adds just that song.

- A TikTok video link (`tiktok.com/@user/video/…` or a `vm.tiktok.com` share link). It plays the video's own soundtrack, exactly as it sounds in the TikTok. Profiles and sound pages aren't supported, and private or region-blocked videos won't load.

Single songs and TikToks go into one "Single songs" group per mix, and each one gets its own Remove button.

## Jam (listen together)

Everyone needs Playlist Merger installed (Windows or Mac).

1. **Host:** click **Jam: listen together** in the sidebar, type your name, and click **Start a Jam**. Send friends the 6-character code (use **Copy**).
2. **Friends:** click **Jam: listen together**, type a name and the code, and click **Join**.
3. **Adding songs:** anyone can paste a Spotify, YouTube or TikTok link in the Jam screen, or open one of their mixes and click songs (or **Add all songs**).
4. **Controls:** only the host can pause, skip, seek and reorder, unless the host ticks **Let guests pause, skip and reorder**.
5. **Leaving:** guests click **Leave Jam**. The host can click **Leave Jam**, which hands the Jam to a random guest (same code, the music keeps playing, and everyone reconnects to them automatically), or **End Jam for everyone**. If the host's app closes or crashes, the same handoff happens on its own within about 10 seconds.

How it works: PeerJS's free public server (0.peerjs.com) introduces the apps, and they then talk directly, or through PeerJS's free relay if a network blocks that. Only small messages are sent: the queue, play/pause and "at second N". Every app downloads and plays the audio itself and keeps within about half a second of the host. For Spotify songs, the host's YouTube match is shared so everyone hears the same recording. Up to 20 people.

## Mac version

`.github/workflows/build.yml` builds the Windows installer and a Mac `.dmg` on GitHub's machines. Push the repo to GitHub, open **Actions > Build apps > Run workflow**, and download the files from the finished run's **Artifacts**.

The Mac app isn't signed with an Apple Developer account, so macOS blocks it the first time. After dragging it into Applications, right-click it > **Open** > **Open**. If macOS says it's "damaged", run this once in Terminal:

```
xattr -cr "/Applications/Playlist Merger.app"
```

## How it works

- **Spotify playlists** are read from Spotify's public embed page (`open.spotify.com/embed/playlist/<id>`), and song covers come from Spotify's oEmbed endpoint. No sign-in is needed.
- **YouTube / YouTube Music playlists** are read with yt-dlp.
- **Playback:** every song plays as YouTube audio. A Spotify song is matched once through YouTube Music's song search (scored by title, artist and length) and the match is remembered. The audio is downloaded with yt-dlp into a cache, so replays are instant. The next song is pre-downloaded while the current one plays.
- **yt-dlp** is downloaded into the app's data folder on first run and updates itself every 4 days.
- **Data** lives in `%APPDATA%\playlist-merger\`: `library.json` holds your mixes and the Spotify-to-YouTube matches, `cache\` holds audio (cleared after 30 days without a play), and `bin\` holds yt-dlp.

## Limits

- **Spotify:** public playlists only, and only the **first 100 songs** of each (that's all the embed page shows). Spotify's official API would lift this, but since February 2026 its developer mode only works if the app owner has Premium.
- Reading YouTube through yt-dlp and YouTube Music's web search is unofficial. It's fine for personal use, but it can break when YouTube changes things. Updating yt-dlp usually fixes it, and that happens automatically.
- The first play of a song takes a few seconds while it downloads.
