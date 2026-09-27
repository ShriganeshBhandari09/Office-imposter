# Office Impostor

A social deduction game (Among Us–style) set on the Techpaathshala office map.
It runs as a React web app on the office Wi-Fi: one laptop hosts it, and everyone else plays in their browser. There is nothing to install for the players.

## Run it (host laptop)

You need Node.js 22 (or 20.19+). Download it from nodejs.org if the laptop doesn't have it.

```bash
npm install
npm run play
```

The terminal prints the link to share, for example:

```
On office Wi-Fi:  http://192.168.1.23:3000
```

Everyone on the same Wi-Fi opens that link, types a name, picks a colour and joins the lobby. The first person to join is the host and presses **Start game**.

After the first run, `npm start` starts the server without rebuilding.

**Windows:** the first time, Windows Firewall asks whether Node.js can use the network. Allow it on **Private networks**, or the other laptops won't be able to connect.

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

The app is a small launcher. It asks for the host laptop's address and then loads the game from the laptop's server. You don't need to rebuild the APK when the game changes, and phones and laptops play in the same game.

Players can also skip the app and open the Wi-Fi link in Chrome on their phone.

### Build the APK (once)

1. Install **Android Studio** from developer.android.com/studio. It includes the Android SDK and Java. Open it once and let it finish downloading the SDK.
2. Point the build at Android Studio's Java and SDK (PowerShell, adjust the paths if you installed elsewhere):
   ```powershell
   $env:JAVA_HOME = "C:Program FilesAndroidAndroid Studiojbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATAAndroidSdk"
   ```
3. Build:
   ```bash
   npm install
   npm run android:apk
   ```
4. The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phones (WhatsApp, USB or Google Drive) and install it. Android asks you to allow installing from that source.

You can also run `npm run android:open` to build and run the app from Android Studio (**Build → Build APK(s)**, or ▶ with a phone connected over USB).

### Play on a phone

1. The host runs `npm run play` on the laptop as usual.
2. Open **Office Impostor** on the phone and type the address from the laptop's terminal, for example `192.168.1.23:3000`. The app remembers it for next time.
3. The phone must be on the same Wi-Fi, and the laptop's firewall must allow Node.js on private networks.

The app runs full screen in landscape and keeps the screen on. To change the launcher screen, edit `launcher/index.html` and run `npm run android:sync` before building again.

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
  index.js      Express + Socket.IO server, 20 updates/sec to each player
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
