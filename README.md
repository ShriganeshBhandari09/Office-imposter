# Office Impostor

A social deduction game (Among Us–style) set on the Techpaathshala office map.
Play in the browser or the Android app, from anywhere. The host creates a game and shares a 4-letter room code; everyone else joins with it.

## Play

1. Open the game (the Android app, or the server's link in any browser).
2. Type your name and pick a colour.
3. **Host:** tap **Create game**. The lobby shows a room code such as `AK4M`; tap **Invite** to share it.
4. **Everyone else:** type the code and tap **Join**.
5. When at least 3 players are in, the host taps **Start game**.

You can change your name and colour in the lobby, and **Leave** takes you back to the start screen. If your connection drops or you refresh, you rejoin the same room automatically.

The server can run many rooms at once. A room with nobody connected is removed after 10 minutes.

## Put the server online (Render, free)

Do this once so the game works anywhere without a laptop running.

1. Sign in at **render.com** with your GitHub account.
2. **New → Blueprint**, pick the `Office-imposter` repo, and click **Apply**. Render reads `render.yaml` and sets everything up.
3. When the deploy finishes, Render shows the address, for example `https://office-impostor.onrender.com`. Open it to play.

Every push to `main` redeploys automatically.

**Free plan:** the server sleeps after about 15 minutes without players. The first person to open the game waits 30–60 seconds while it wakes up; after that it's instant. Render's paid plan removes the wait.

If your address is different from `https://office-impostor.onrender.com`, change `ONLINE_URL` in `launcher/index.html` and rebuild the APK.

## Run it on a laptop instead (office Wi-Fi)

You need Node.js 22 (or 20.19+).

```bash
npm install
npm run play
```

The terminal prints the link to share, for example `http://192.168.1.23:3000`. Everyone on the same Wi-Fi opens it. After the first run, `npm start` starts the server without rebuilding.

**Windows:** the first time, Windows Firewall asks whether Node.js can use the network. Allow it on **Private networks**, or other devices won't be able to connect.

## Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| E | Use (task, fix sabotage, emergency button, cameras) |
| R | Report a dead body |
| Q | Kill (impostor) |
| V | Enter / exit a vent (impostor) |
| Space | Move to the linked vent while inside one |
| Tab | Office map with your tasks |
| Esc | Close a task |

### On a phone or tablet

Touch controls turn on automatically on touch screens, in the Android app or in the phone's browser:

- **Move:** touch anywhere on the left half of the screen and drag. A joystick appears under your thumb, and a small push walks slowly.
- **Actions:** tap the buttons at the bottom right (Use, Report, Kill, Vent, and Next vent while you're inside one).
- **Map:** the Map button at the top right.
- **Tasks:** tap *Tasks ▾* to fold the task list away. The impostor's Sabotage panel starts folded at the top.

## Android app (APK)

The app opens the online server straight away (it shows a "waking up" message if the free server is asleep). For a laptop on the office Wi-Fi, tap **Playing on a local server instead?** and type the laptop's address; the app remembers it.

The app loads the game from the server, so game changes don't need a new APK. Players can also skip the app and open the link in Chrome.

### Build the APK

1. Install Java 21 and the Android SDK. The easiest way is **Android Studio** (developer.android.com/studio); open it once so it downloads the SDK.
2. Point the build at them (PowerShell, adjust the paths to your install):
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   ```
3. Build:
   ```bash
   npm install
   npm run android:apk
   ```
4. The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Send it to the phones (WhatsApp, USB or Google Drive) and install it. Android asks you to allow installing from that source.

The app runs full screen in landscape and keeps the screen on. After editing `launcher/index.html`, run `npm run android:apk` again.

## How a game works

- 6 players by default with **1 impostor** (the host can change this in the lobby, along with kill cooldown, meeting length and emergency meetings per player). Minimum 3 players.
- Each crewmate gets **3 random tasks**. The shared bar fills as the crew finishes them. Dead crewmates keep doing tasks as ghosts.
- The **impostor** gets fake tasks for cover, can kill (cooldown), vent and sabotage.
- Find a body → **Report**. Or press the red **emergency button** in the Cafeteria.
- Meetings have **text chat** and **voting**. The player with the most votes is ejected; a tie or skip ejects no one.

**Crew wins** when all tasks are done or all impostors are voted out.
**Impostors win** when they equal the number of crewmates, or the Wi-Fi critical sabotage isn't fixed in time.

## The map

```
┌───────────┬──────────────────┬────────────┬──────────────────┬─────────┬────────┐
│ Cafeteria │                  │            │                  │         │ Call 1 │
│ (button)  │                  │ Conference │                  │Security ├────────┤
├───────────┘   walkway        │            │                  │ (cams)  │ Call 2 │
│                              └────────────┴──────────────────┴─────────┼────────┤
├───────────┐                                                            │ Call 3 │
│  Den      │     [Desk 1]         [Desk 2]         [Desk 3]             └────────┤
│  (cabin)  │                                                                     │
├───────────┤     [Desk 4]         [Desk 5]         [Desk 6]                      │
│  Hive     │                                                          Workspace  │
│  (cabin)  │                                                                     │
└───────────┴─────────────────────────────────────────────────────────────────────┘
```

### Tasks

| Where | Task | Mini-game |
|---|---|---|
| Cafeteria | Brew chai | Hold the button |
| Cafeteria | Clean the spill | Click every spill |
| Desk 1 | Fix laptop wires | Match coloured wires |
| Desk 2 | Upload attendance | Start upload, stay until 100% |
| Desk 3 | Type the code | Type the words shown |
| Desk 4 | Sort sticky notes | Click 1→8 in order |
| Desk 5 | Charge the laptop | Hold the button |
| Workspace (printer) | Refill the printer | Click the paper |
| Conference | Align the projector | Line up the slider |
| Conference | Wipe the whiteboard | Click the scribbles |
| Security | Swipe ID card | Drag at the right speed |
| Call 1 | Answer the phone | Dial the extension |
| Call 2 | Reconnect headset | Match wires |
| Den | Sign the files | Click 1→5 in order |
| Den | Water the plant | Hold the button |
| Hive | Shred documents | Click the paper |
| Hive | Reboot manager's PC | Flip all switches on |

### Sabotages (impostor panel, bottom-left)

| Sabotage | Effect | Fix |
|---|---|---|
| Lights | Crew vision shrinks | Power panel at Desk 6 (flip switches) |
| Network | Hides everyone's task list and the task bar | Router in Call 1 (align) |
| Wi-Fi (critical) | 45 s countdown; impostors win if it runs out | Two players hold the reset at Security **and** Call 3 at the same time |
| Doors | Locks a room's doors for 10 s | Wait it out |

### Vents (impostor only)

Den ↔ Conference · Cafeteria ↔ Call 2 · Hive ↔ Workspace bottom-right · Security ↔ Workspace bottom-middle

## Changing things

Almost everything lives in one file: **`client/src/shared/map.js`**.

- Room sizes, doors and floor colours → `ROOMS`
- Desks and tables → `DESKS`, `TABLES`
- Task names, locations and mini-game types → `TASKS`
- Sabotage fix spots → `SABOTAGE_FIX`
- Vents and their links → `VENTS`
- Speed, vision, ranges, default settings → the constants near the bottom

Both the server and the browser read this file, so a change there applies everywhere. Rebuild with `npm run play`.

## Project structure

```
launcher/       Android app start screen (asks for the server address)
android/        Android project generated by Capacitor (capacitor.config.json)
server/
  index.js      Express + Socket.IO server: rooms with codes, 20 updates/sec to each player
  game.js       All game rules (roles, kills, tasks, meetings, sabotages, win checks)
client/src/
  shared/map.js Map layout and game config (used by server and client)
  App.jsx       Screen switching (join → lobby → game → meeting → result)
  Lobby.jsx     Join form, lobby, host settings
  Game.jsx      Movement, camera, HUD, action buttons, sabotage panel, map/cameras
  render.js     Canvas drawing: map, pixel-art characters, fog of war
  sprites.js    Original pixel-art office-worker sprites
  Minigames.jsx The 10 task mini-games + Wi-Fi hold
  Meeting.jsx   Meeting (chat + voting), ejection and game-over screens
```

The server is the source of truth: it decides roles, validates kill distance and cooldowns, checks you are actually at a task before counting it, rejects impossible movement, and hides roles, ghosts and venting players from people who shouldn't see them.

## Development

Run the server and the Vite dev server in two terminals for hot reload:

```bash
npm run dev:server   # terminal 1 (port 3000)
npm run dev:client   # terminal 2 → open http://localhost:5173
```

To test alone, open several browser windows in **separate profiles or incognito windows** (each window needs its own player id).

## Ideas for later

- Sound effects (kill, meeting alarm, task complete)
- Real office photos turned into pixel-art floor tiles
- More impostor roles (e.g. a "Manager" who can see who voted for whom)
