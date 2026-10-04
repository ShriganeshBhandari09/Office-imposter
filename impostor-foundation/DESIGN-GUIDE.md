# Impostor.exe

The look of Impostor.exe, an office social-deduction game played on laptops over the office Wi-Fi. Use this to build any screen of the game in your React code so it matches the designs.

## Two registers

The game speaks in two voices. Pick one per surface and don't mix them.

| Register | Where | Feel | Type | Shape |
| --- | --- | --- | --- | --- |
| **Arcade** | Title, lobby, settings, HUD, meeting, report, ejection, game over | Loud, chunky, pressable | `display` (Russo One) for titles and buttons, `ui` (Chakra Petch) for everything else | `radius-md` to `radius-xl`, solid fills, `press-*` offset shadows |
| **Device** | Task popups and sabotage-fix popups | Quiet, technical, like an office machine's screen | `ui` for names, `mono` (JetBrains Mono) for readouts and captions | `radius-sm`, 1px `panel-line` borders, no offset shadows, one accent |

## Colour means something

Every hue has one job. Never use a colour for decoration.

- `yellow-500` is the main action on a screen (Host game, Start, Use, Save) and the game's signature. One yellow button per screen.
- `cyan-500` is the second action (Join), links, and you: your name tag and the crewmate role.
- `red-500` is danger: impostor, Kill, Report, alarms, the emergency button. Red text on dark uses `red-300`.
- `orange-500` is only the impostor's Sabotage button and sabotage tags.
- `green-500` is done, ready and connected.
- `ghost-500` / `ghost-300` appear only when you are dead.
- Avatar colours (`avatar-*`) belong to players, never to UI.

Inside a task popup there is exactly one accent: `panel-accent` for tasks, `panel-alert` for sabotage fixes. Progress, selection and the main button all use it. `panel-warn` and `green-500` are states, not accents.

## Surfaces and depth

Menus sit on `bg-base` with a 40px grid (`grid-menu`) drawn in `cyan-500` at 4.5% opacity. Gameplay sits on `bg-void`. Panels step up: `surface-100` bars, `surface-200` panels with a 2px `line-100` border, `surface-300` rows, `surface-400` secondary buttons. A selected card uses `surface-select` with a 2–3px `yellow-500` border.

Arcade buttons get depth from a solid offset shadow (`press-yellow`, `press-cyan`, `press-red`, `press-neutral`), not blur. Popups over the game use `shadow.panel`. Glows (`glow-red`, `glow-yellow`) mark live things only: an active Use or Kill button, an alarm, your own tasks on the map.

## Type

- `logo` and `screen-title` are uppercase Russo One. They always carry an offset text shadow in the darker step of their colour (`0 8px 0` for the logo, `0 6px 0` for titles).
- Button labels are uppercase Russo One (`button-xl`, `button`).
- Labels are uppercase Chakra Petch 700 with `0.14em` tracking (`label`).
- Task names and player names use `row`; their room or role sits under them in `caption`.
- Task popups: one `readout` number, `mono-caption` labels, `mono` for file names and terminal text.

Load fonts from Google Fonts: `Russo One`, `Chakra Petch` 400/500/600/700, `JetBrains Mono` 400/500/700.

## Writing

- Short and in office words: "Brew chai", "Swipe ID card", "Back to work", "Leave game".
- Buttons say what happens, in capitals: HOST GAME, JOIN, SEE RESULT, PLAY AGAIN.
- Status lines are plain facts: "6 of 7 ready", "3 / 5 shredded", "Wrong order, start again".
- Rooms are proper names: Cafeteria, Table Tennis, Spark, Hive, Toilets, Pixel, Den, Lobby, Conference, Sec, Call 1–3.

## Icons

Inline SVG line icons on a 24px grid, `stroke-width` 2 (2.5 inside small filled buttons), round caps and joins, `stroke="currentColor"`. No emoji and no filled pictograms. Icons used: map, chat, settings, use (hand), report (megaphone), kill (crosshair), sabotage (bolt), vent (grille), copy, send, back, close, check.

## Avatar

Players are small office robots: a monitor head with a visor and two glowing eyes, a body with an ID badge, arms and legs. Body colour is the player's `avatar-*`; the darker trim is that colour at 72% brightness. Eyes are `#7CF3FF`, or `red-500` for an impostor's own view. There are three states, alive, ghost (50% opacity, wavy tail, no legs) and body (on its side, X eyes), and five hats: none, cap, headset, hard hat and beanie. See the Avatar card.

## Map

The office map is drawn from data, not from an image: floors per room, 6px walls (`map-wall`), glass walls (`map-glass`), doors as gaps with `map-door` jambs, and furniture with soft shadows. Tasks are real objects on the floor or walls; your own tasks get a 1.5px `yellow-500` outline plus `glow-yellow`, and a live sabotage object gets the same treatment in `red-500`. Vents are dark grilles. Room names are small `label` tags with a 2px `map-door` left rule.

The map ships as `office-map.json` (rooms, walls with door gaps cut out, doors, obstacles, tasks, vents, sabotages, emergency button, spawns) at 820 × 690 map px. Scale every value by `worldWidth / 820`. Draw the map and build collision from the same file so they never drift apart.

## Components

Each card shows exact values. There is no runtime bundle; copy the markup into your React components and read colours from the CSS variables in `tokens.css` (for example `var(--yellow-500)`).

- **Button**: primary, secondary, join and danger.
- **HUD action**: Use, Report, Kill (with cooldown) and disabled.
- **Panel**: the HUD task list and lobby panels.
- **Chip**: HOST, READY, AFK, IMPOSTOR, CREW, I VOTED.
- **Vote card**: a player in the meeting, including selected, voted and dead states.
- **Alert banner**: sabotage and lights-out banners.
- **Task popup**: the device frame every task uses.
- **Settings controls**: stepper, toggle and segmented control.
- **Map markers**: door, glass wall, vent, task tag and emergency button.
- **Avatar**: the robot in its three states.
