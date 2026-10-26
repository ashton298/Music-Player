# Playlist Merger

Combine your public Spotify and YouTube playlists into one queue and play them back-to-back.

An independent hobby project, not affiliated with Spotify, YouTube, Google or TikTok. See [Disclaimer](#disclaimer).

## Download

| | |
|---|---|
| **Windows** | [Download Playlist-Merger-Windows.exe](https://github.com/ashton298/Music-Player/releases/latest/download/Playlist-Merger-Windows.exe) |
| **Mac** (Intel and Apple Silicon) | [Download Playlist-Merger-Mac.dmg](https://github.com/ashton298/Music-Player/releases/latest/download/Playlist-Merger-Mac.dmg) |

No GitHub account needed. These links always get the newest version.

**Windows:** open the file. If a blue "Windows protected your PC" box appears, click **More info**, then **Run anyway** (the app isn't code-signed, which costs money). It installs just for you, with no admin prompt, opens, and adds Desktop and Start menu shortcuts. Uninstall it from Windows Settings > Apps; your mixes are kept.

**Mac:** open the `.dmg` and drag **Playlist Merger** into **Applications**, then open it. macOS blocks it the first time because it isn't from a paid Apple developer account: go to **System Settings > Privacy & Security**, scroll down, and click **Open Anyway** (on older macOS, right-click the app > **Open** > **Open**). If it says the app is "damaged", run this once in Terminal and open it again:

```
xattr -cr "/Applications/Playlist Merger.app"
```

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

## Releasing a new version

Bump `version` in `package.json`, commit, then push a tag (`git tag v0.3.2 && git push origin main v0.3.2`). `.github/workflows/build.yml` builds the Windows installer and the Mac `.dmg` on GitHub's machines and publishes them as a GitHub Release, and the download links above pick it up automatically. The Mac app is ad-hoc signed (`build/adhoc-sign.js`) so Apple Silicon Macs will run it.

## How it works

- **Spotify playlists** are read from Spotify's public embed page (`open.spotify.com/embed/playlist/<id>`), and song covers come from Spotify's oEmbed endpoint. No sign-in is needed.
- **YouTube / YouTube Music playlists** are read with yt-dlp.
- **Playback:** every song plays as YouTube audio. A Spotify song is matched once through YouTube Music's song search (scored by title, artist and length) and the match is remembered. The audio is downloaded with yt-dlp into a cache, so replays are instant. The next song is pre-downloaded while the current one plays.
- **yt-dlp** is downloaded into the app's data folder on first run and updates itself every 4 days.
- **Data** lives in `%APPDATA%\playlist-merger\`: `library.json` holds your mixes and the Spotify-to-YouTube matches, `cache\` holds audio (cleared after 30 days without a play), and `bin\` holds yt-dlp.

## Limits

- **Spotify:** public playlists only, and only the **first 100 songs** of each (that's all the embed page shows). Spotify's official API would lift this, but since February 2026 its developer mode only works if the app owner has Premium.
- Reading YouTube through yt-dlp and YouTube Music's web search is unofficial, and it can break when YouTube changes things. Updating yt-dlp usually fixes it, and that happens automatically.
- The first play of a song takes a few seconds while it downloads.

## Privacy

Playlist Merger has no account, server or analytics of its own, and the author collects no data. Your mixes and cached audio stay on your computer in the app's data folder.

The app talks directly to Spotify, YouTube, YouTube Music and TikTok to read the links you paste and fetch audio, the same way a browser would, and to GitHub to update yt-dlp. Those services see your IP address under their own privacy policies.

**Jam:** joining or hosting a Jam connects you to PeerJS's public server (0.peerjs.com) and then directly to the other people in the Jam, or through PeerJS's relay. Like any peer-to-peer connection, everyone in a Jam can see each other's IP addresses, along with the names and songs you share there. Only Jam with people you know.

## Disclaimer

Playlist Merger is an independent, free, non-commercial hobby project. It is not affiliated with, endorsed by or sponsored by Spotify, YouTube, Google or TikTok. Spotify, YouTube, YouTube Music and TikTok are trademarks of their respective owners and are named here only to describe which links the app accepts.

The app does not host, store on any server, or distribute any music. Audio is fetched by each user's own copy of the app, and the app uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), a separate open-source project that it downloads on first run. You are responsible for using the app in line with the terms of service of those platforms and the copyright laws where you live.

The software is provided "as is", without warranty of any kind. See [LICENSE](LICENSE).

## License

[MIT](LICENSE)
