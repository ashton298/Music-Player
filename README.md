# Playlist Merger

Combine your public Spotify and YouTube playlists into one queue and play them back-to-back.

An independent project, not affiliated with Spotify, YouTube, Google or TikTok. See [Disclaimer](#disclaimer).

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

## Sign-in (invite list)

When sign-in is turned on, only emails on the owner's Google Sheet can use the app. A person types their email, gets a 6-digit code by email, and stays signed in. The app re-checks each time it opens (and every 6 hours while open), so removing an email from the sheet locks that person out. It keeps working offline for up to 3 days since the last check.

**Turning it on** (free, with no database or server to pay for):
1. Make a Google Sheet. Put the allowed emails in column A of the first tab, one per row. A header row is fine.
2. In the sheet: **Extensions > Apps Script**. Delete what's there, paste in [server/apps-script.gs](server/apps-script.gs), and save.
3. **Deploy > New deployment**, click the gear, and pick **Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**. Approve the permissions (Google warns that the app isn't verified because it's your own script: **Advanced > Go to … (unsafe)**). It needs to read the sheet and send email as you.
4. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`) into `src/auth-config.json` as `"url"`, then rebuild.

Codes come from the owner's Gmail (Google allows about 100 a day on a free account). To sign everyone out, delete the `SECRET` script property (Project Settings > Script properties). If you change the script, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same. With `"url": ""`, sign-in is off.

This keeps casual users out, but the app is open source, so someone technical could build a copy with the check removed.

## Queue

Right-click any song (or hover it and click **⋯**) for **Play next** and **Add to queue**. **Add to queue** at the top of a mix queues the whole mix. Queued songs play before the rest of the mix, and the mix carries on where it left off once the queue is empty.

Click **Queue** in the player bar to see what's playing, **Next in queue** (drag the ⠿ handle, or focus it and use the arrow keys, to reorder; ✕ removes; click a song to jump to it) and what's next from the mix.

## Customize the look

Click **Customize look** at the bottom of the sidebar:
- **Colors, text, shape and size, layout, show or hide, background, motion:** sliders, color pickers and switches that change the app as you go.
- **Move and resize panels on screen:** drag a panel's label to move the sidebar or queue to the other side, the player bar to the top, or to swap the parts of the player bar. Drag panel edges to resize (this works any time; double-click an edge to reset it).
- **Ctrl+Shift+0** resets everything to the default look.

### Themes

A theme is a zip with a `theme.json` (the same settings as the Customize drawer), and optionally a `theme.css`, images and fonts. Themes can't contain code. Import one with **Import a theme (.zip)** or by dropping it on the drawer, and share your own look with **Export .zip**.

To have an AI make one: click **Copy AI theme guide**, paste it into ChatGPT, Claude or Gemini, and describe the look you want. The guide ([src/THEME-GUIDE.md](src/THEME-GUIDE.md)) lists every setting and the page's class names. Imported themes are stored in the app's data folder under `themes\`.

## Jam (listen together)

Everyone needs Playlist Merger installed (Windows or Mac).

1. **Host:** click **Jam: listen together** in the sidebar, type your name, and click **Start a Jam**. Send friends the 6-character code (use **Copy**).
2. **Friends:** click **Jam: listen together**, type a name and the code, and click **Join**.
3. **Adding songs:** anyone can paste a Spotify, YouTube or TikTok link in the Jam screen, or open one of their mixes and click songs (or **Add all songs**). Right-click a song for **Play next in the Jam**, which puts it right after the current song.
4. **Controls:** everyone can drag or remove the songs **they** added that haven't played yet. Only the host can pause, skip, seek and reorder or remove other people's songs, unless the host ticks **Let guests pause, skip and reorder everything**.
5. **Leaving:** guests click **Leave Jam**. The host can click **Leave Jam**, which hands the Jam to a random guest (same code, the music keeps playing, and everyone reconnects to them automatically), or **End Jam for everyone**. If the host's app closes or crashes, the same handoff happens on its own within about 10 seconds.

How it works: PeerJS's free public server (0.peerjs.com) introduces the apps, and they then talk directly, or through PeerJS's free relay if a network blocks that. Only small messages are sent: the queue, play/pause and "at second N". Every app downloads and plays the audio itself and keeps within about half a second of the host. For Spotify songs, the host's YouTube match is shared so everyone hears the same recording. Up to 20 people.

## Releasing a new version

Bump `version` in `package.json`, commit, then push a tag (`git tag v0.3.2 && git push origin main v0.3.2`). `.github/workflows/build.yml` builds the Windows installer and the Mac `.dmg` on GitHub's machines and publishes them as a GitHub Release, and the download links above pick it up automatically. The Mac app is ad-hoc signed (`build/adhoc-sign.js`) so Apple Silicon Macs will run it.

## How it works

- **Spotify playlists** are read from Spotify's public embed page (`open.spotify.com/embed/playlist/<id>`), and song covers come from Spotify's oEmbed endpoint. No sign-in is needed.
- **YouTube / YouTube Music playlists** are read with yt-dlp.
- **Playback:** every song plays as YouTube audio. A Spotify song is matched once through YouTube Music's song search (scored by title, artist and length) and the match is remembered. The audio is downloaded with yt-dlp into a cache, so replays are instant. The next song is pre-downloaded while the current one plays.
- **yt-dlp** is downloaded into the app's data folder on first run and updates itself every 4 days.
- **Data** lives in `%APPDATA%\playlist-merger\`: `library.json` holds your mixes and the Spotify-to-YouTube matches, `cache\` holds audio (cleared after 30 days without a play), `bin\` holds yt-dlp, and `themes\` holds imported themes.

## Limits

- **Spotify:** public playlists only, and only the **first 100 songs** of each (that's all the embed page shows). Spotify's official API would lift this, but since February 2026 its developer mode only works if the app owner has Premium.
- Reading YouTube through yt-dlp and YouTube Music's web search is unofficial, and it can break when YouTube changes things. Updating yt-dlp usually fixes it, and that happens automatically.
- The first play of a song takes a few seconds while it downloads.

## Privacy

Playlist Merger has no account, server or analytics of its own, and the author collects no data. Your mixes and cached audio stay on your computer in the app's data folder.

The app talks directly to Spotify, YouTube, YouTube Music and TikTok to read the links you paste and fetch audio, the same way a browser would, and to GitHub to update yt-dlp. Those services see your IP address under their own privacy policies.

**Jam:** joining or hosting a Jam connects you to PeerJS's public server (0.peerjs.com) and then directly to the other people in the Jam, or through PeerJS's relay. Like any peer-to-peer connection, everyone in a Jam can see each other's IP addresses, along with the names and songs you share there. Only Jam with people you know.

## Disclaimer

Playlist Merger is an independent project. It is not affiliated with, endorsed by or sponsored by Spotify, YouTube, Google or TikTok. Spotify, YouTube, YouTube Music and TikTok are trademarks of their respective owners and are named here only to describe which links the app accepts.

The app does not host, store on any server, or distribute any music. Audio is fetched by each user's own copy of the app, and the app uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), a separate open-source project that it downloads on first run. You are responsible for using the app in line with the terms of service of those platforms and the copyright laws where you live.

The software is provided "as is", without warranty of any kind. See [LICENSE](LICENSE).

## License

[MIT](LICENSE)
