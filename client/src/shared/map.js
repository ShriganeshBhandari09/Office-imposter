// Shared map + game config. Imported by both the server and the React client.
// The layout comes from the design team's office-map.json (820 x 690 map px). Everything here is that
// layout scaled by MAP_SCALE into world units (1 unit = 1 pixel at zoom 1). Origin is top-left.
import MAP from './office-map.data.js';

export const MAP_SCALE = 1.3;
export const WORLD = { w: Math.round(MAP.size.w * MAP_SCALE), h: Math.round(MAP.size.h * MAP_SCALE) };
export const PLAYER_R = 14;
export const SPEED = 190; // units per second at 1x player speed
export const MAX_PLAYERS = 10;

// Scales a rectangle by rounding its edges, so rectangles that touch in the design still touch here.
const S = MAP_SCALE;
const rect = (r) => {
  const x = Math.round(r.x * S), y = Math.round(r.y * S);
  return { x, y, w: Math.round((r.x + r.w) * S) - x, h: Math.round((r.y + r.h) * S) - y };
};
const pt = (p) => ({ x: Math.round(p.x * S), y: Math.round(p.y * S) });

// Rooms. Lobby, Sec and the call rooms can be locked by an impostor; the call rooms can't.
export const ROOMS = MAP.rooms.map((r) => ({
  id: r.id,
  name: r.id === 'sec' ? 'Sec' : r.name,
  ...rect(r),
  glass: !!r.glass,
  lockable: !r.id.startsWith('call'),
}));

// Open-plan areas that aren't rooms, only used to name a position ("Body found in South Workspace").
const ZONES = [
  { name: 'North Workspace', ...rect({ x: 372, y: 12, w: 436, h: 233 }) },
  { name: 'Workspace', ...rect({ x: 12, y: 470, w: 392, h: 208 }) },
  { name: 'South Workspace', ...rect({ x: 404, y: 470, w: 332, h: 208 }) },
];

// Which room each door belongs to: the room whose edge the door sits on (so locking a room seals it).
function doorRoom(d) {
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2, slack = 8;
  const hits = MAP.rooms.filter((r) => {
    const inX = cx >= r.x - slack && cx <= r.x + r.w + slack;
    const inY = cy >= r.y - slack && cy <= r.y + r.h + slack;
    const vertical = (Math.abs(cx - r.x) <= slack || Math.abs(cx - (r.x + r.w)) <= slack) && inY;
    const horizontal = (Math.abs(cy - r.y) <= slack || Math.abs(cy - (r.y + r.h)) <= slack) && inX;
    return vertical || horizontal;
  });
  hits.sort((a, b) => a.w * a.h - b.w * b.h);
  return hits[0]?.id || null;
}

export const DOORS = MAP.doors.map((d) => ({ roomId: doorRoom(d), ...rect(d) }));

// The design's wall pieces run a few px into each doorway, which would leave call-room doors narrower
// than a player. Cut every wall back to the full door opening.
function cutDoors(w) {
  let pieces = [w];
  for (const d of DOORS) {
    pieces = pieces.flatMap((p) => {
      const ox = Math.min(p.x + p.w, d.x + d.w) - Math.max(p.x, d.x);
      const oy = Math.min(p.y + p.h, d.y + d.h) - Math.max(p.y, d.y);
      if (ox <= 0 || oy <= 0) return [p];
      const out = [];
      if (p.w >= p.h) { // horizontal wall: remove the door's x-range
        if (d.x > p.x) out.push({ ...p, w: d.x - p.x });
        if (d.x + d.w < p.x + p.w) out.push({ ...p, x: d.x + d.w, w: p.x + p.w - (d.x + d.w) });
      } else { // vertical wall: remove the door's y-range
        if (d.y > p.y) out.push({ ...p, h: d.y - p.y });
        if (d.y + d.h < p.y + p.h) out.push({ ...p, y: d.y + d.h, h: p.y + p.h - (d.y + d.h) });
      }
      return out;
    });
  }
  return pieces;
}

// Walls block movement. Glass walls block movement but not sight.
export const WALLS = MAP.walls.flatMap((w) => cutDoors({ ...rect(w), glass: !!w.glass }));
// Furniture that blocks movement. Two pieces of Lobby decor are left walkable, otherwise they would split the
// Lobby (only ~86 map px tall) into two sealed halves with three spawn points on the far side:
// the ring of chairs around the emergency table (its 26px tabletop still blocks), and the low coffee table.
const WALKABLE_DECOR = [{ x: 536, y: 268, w: 48, h: 48 }, { x: 700, y: 284, w: 40, h: 18 },
  // The green two-stool unit between the Toilets and the Lobby was removed from the art, so it has no collision either.
  { x: 228, y: 262, w: 24, h: 60 }, { x: 233, y: 269, w: 14, h: 14 }, { x: 233, y: 301, w: 14, h: 14 }];
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
export const FURNITURE = MAP.obstacles.filter((o) => !WALKABLE_DECOR.some((d) => sameRect(o, d))).map(rect);

export const EMERGENCY_BUTTON = pt(MAP.emergencyButton);
// The security monitors on the east wall of Sec.
export const CAMERA_CONSOLE = pt({ x: 792, y: 381 });

// Tasks. `type` picks the mini-game component on the client; positions come from the design map.
// Order matches the design's task numbers 1-22.
const TASK_DEFS = [
  { id: 'cafe_chai', room: 'Cafeteria', type: 'hold' },
  { id: 'cafe_spill', room: 'Cafeteria', type: 'mop' },
  { id: 'spark_debug', room: 'Spark', type: 'wires' },
  { id: 'hive_shred', room: 'Hive', type: 'shred' },
  { id: 'hive_reboot', room: 'Hive', type: 'breakers' },
  { id: 'toilets_supplies', room: 'Toilets', type: 'restock' },
  { id: 'pixel_sort', room: 'Pixel', type: 'order' },
  { id: 'den_sign', room: 'Den', type: 'order' },
  { id: 'den_plant', room: 'Den', type: 'hold' },
  { id: 'lobby_guests', room: 'Lobby', type: 'swipe' },
  { id: 'conf_projector', room: 'Conference', type: 'align' },
  { id: 'conf_board', room: 'Conference', type: 'mop' },
  { id: 'sec_id', room: 'Sec', type: 'swipe' },
  { id: 'call1_phone', room: 'Call 1', type: 'keypad' },
  { id: 'call2_headset', room: 'Call 2', type: 'wires' },
  { id: 'call3_type', room: 'Call 3', type: 'type' },
  { id: 'desk1_upload', room: 'Workspace N', type: 'upload' },
  { id: 'desk2_wires', room: 'Workspace N', type: 'wires' },
  { id: 'desk3_type', room: 'Workspace S', type: 'type' },
  { id: 'desk4_printer', room: 'Workspace S', type: 'reams' },
  { id: 'desk5_notes', room: 'Workspace SW', type: 'order' },
  { id: 'desk6_charge', room: 'Workspace SW', type: 'hold' },
];
export const TASKS = MAP.tasks.map((t, i) => ({
  ...TASK_DEFS[i], num: t.id, name: t.name.replace('’', "'"), wall: t.wall, ...pt(t),
}));
export const TASKS_PER_PLAYER = 3;
// Tasks that show on screen when someone finishes them (the "Visual tasks" setting). Only crew can finish tasks,
// so seeing one proves the player is crew.
export const VISUAL_TASKS = new Set(['cafe_spill', 'hive_shred', 'conf_board', 'conf_projector', 'desk4_printer', 'toilets_supplies']);
export const VISUAL_TASK_MS = 4000;

// Sabotages and where they are fixed. Lights are quiet; network and Wi-Fi are timed and end the game.
const SAB = MAP.sabotages;
const sabSpot = (s) => ({ code: s.code, wall: s.wall, ...pt(s) });
export const SABOTAGE_FIX = {
  lights: [{ id: 'lights', name: 'Fix lights', type: 'breakers', ...sabSpot(SAB[0]) }],
  comms: [{ id: 'comms', name: 'Fix network', type: 'signal', ...sabSpot(SAB[1]) }],
  wifi: [
    { id: 'wifiA', name: 'Reset Wi-Fi (Sec)', type: 'holdSync', ...sabSpot(SAB[2]) },
    { id: 'wifiB', name: 'Reset Wi-Fi (Call 3)', type: 'holdSync', ...sabSpot(SAB[3]) },
  ],
};
export const CRITICAL_SABOTAGES = ['comms', 'wifi'];

// Vents come in linked pairs (V1..V4).
export const VENTS = (() => {
  const list = MAP.vents.map((v) => ({ pair: v.pair, room: v.room, ...pt(v) }));
  return list.map((v, i) => {
    const other = list.find((o, j) => j !== i && o.pair === v.pair);
    return { id: `${v.pair}_${v.room}`, ...v, to: `${other.pair}_${other.room}` };
  });
})();

// Areas visible on security cameras.
export const CAMERAS = [
  { name: 'Cafeteria', ...rect({ x: 12, y: 12, w: 200, h: 196 }) },
  { name: 'Lobby', ...rect({ x: 330, y: 245, w: 478, h: 95 }) },
  { name: 'Conference', ...rect({ x: 430, y: 340, w: 222, h: 128 }) },
  { name: 'Sec wing', ...rect({ x: 652, y: 340, w: 156, h: 274 }) },
];

// Player colours, from the design's avatar palette.
export const COLORS = [
  { id: 'cyan', name: 'Cyan', hex: '#29D3E6' }, { id: 'red', name: 'Red', hex: '#E5484D' },
  { id: 'blue', name: 'Blue', hex: '#3E63DD' }, { id: 'green', name: 'Green', hex: '#30A46C' },
  { id: 'yellow', name: 'Yellow', hex: '#F5D90A' }, { id: 'orange', name: 'Orange', hex: '#F76B15' },
  { id: 'purple', name: 'Purple', hex: '#8E4EC6' }, { id: 'pink', name: 'Pink', hex: '#E93D82' },
  { id: 'lime', name: 'Lime', hex: '#99D52A' }, { id: 'white', name: 'White', hex: '#EDEEF0' },
  { id: 'brown', name: 'Brown', hex: '#8D5A3B' }, { id: 'slate', name: 'Slate', hex: '#5B6478' },
];
export const HATS = [
  { id: 'none', name: 'None' }, { id: 'cap', name: 'Cap' }, { id: 'headset', name: 'Headset' },
  { id: 'hardhat', name: 'Hard hat' }, { id: 'beanie', name: 'Beanie' },
];

export const USE_RANGE = 70;
export const KILL_RANGE = 90;
export const REPORT_RANGE = 110;
// Base vision radius at 1x. The lobby's crew/impostor vision settings multiply it.
export const VISION = { base: 280, lightsOut: 95 };
export const KILL_DISTANCE = { short: 0.7, normal: 1, long: 1.4 };

// ---------- Game settings ----------
// Each setting: default, and for numbers min/max/step. The server clamps to these; the settings screen reads them.
export const SETTING_SPECS = {
  impostors: { def: 2, min: 1, max: 3, step: 1 },
  killCooldown: { def: 25, min: 10, max: 60, step: 5 },
  killDistance: { def: 'normal', options: ['short', 'normal', 'long'] },
  playerSpeed: { def: 1.25, min: 0.75, max: 1.75, step: 0.25 },
  crewVision: { def: 1, min: 0.25, max: 3, step: 0.25 },
  impostorVision: { def: 1.5, min: 0.25, max: 3, step: 0.25 },
  emergencyPerPlayer: { def: 1, min: 0, max: 3, step: 1 },
  emergencyCooldown: { def: 15, min: 0, max: 60, step: 5 },
  discussionSeconds: { def: 30, min: 0, max: 120, step: 5 },
  votingSeconds: { def: 60, min: 15, max: 180, step: 5 },
  anonymousVotes: { def: false },
  confirmEjects: { def: true },
  tasksPerPlayer: { def: 3, min: 1, max: 8, step: 1 },
  visualTasks: { def: true },
  taskBarUpdates: { def: 'always', options: ['always', 'meetings', 'never'] },
  sabotageCooldown: { def: 30, min: 10, max: 90, step: 5 },
  networkSeconds: { def: 40, min: 20, max: 90, step: 5 },
  wifiSeconds: { def: 45, min: 20, max: 90, step: 5 },
};
export const DEFAULT_SETTINGS = {
  ...Object.fromEntries(Object.entries(SETTING_SPECS).map(([k, s]) => [k, s.def])),
  minPlayers: 4,
};
export const SETTING_PRESETS = {
  casual: { impostors: 1, killCooldown: 40, killDistance: 'short', playerSpeed: 1.25, crewVision: 1.25, impostorVision: 1.25,
    emergencyPerPlayer: 2, emergencyCooldown: 10, discussionSeconds: 45, votingSeconds: 90, anonymousVotes: false,
    confirmEjects: true, tasksPerPlayer: 3, visualTasks: true, taskBarUpdates: 'always',
    sabotageCooldown: 45, networkSeconds: 60, wifiSeconds: 60 },
  standard: { ...DEFAULT_SETTINGS },
  hardcore: { impostors: 2, killCooldown: 15, killDistance: 'long', playerSpeed: 1.25, crewVision: 0.75, impostorVision: 1.5,
    emergencyPerPlayer: 1, emergencyCooldown: 30, discussionSeconds: 15, votingSeconds: 45, anonymousVotes: true,
    confirmEjects: false, tasksPerPlayer: 5, visualTasks: false, taskBarUpdates: 'meetings',
    sabotageCooldown: 20, networkSeconds: 30, wifiSeconds: 30 },
};
// How many impostors suit a lobby of this size, and the most the rules allow.
export const recommendedImpostors = (n) => (n <= 6 ? 1 : n <= 9 ? 2 : 3);
// The rules never allow more than the recommended number, otherwise a single kill can hand a small game to the impostors.
export const maxImpostors = (n) => recommendedImpostors(n);

export const DOOR_SECONDS = 10;
export const DOOR_COOLDOWN = 20;

// ---------- Lobby scene ----------
// The reception room players walk around in before a game. It is its own small space, not part of the office.
export const LOBBY = {
  w: 1000, h: 640,
  terminal: { x: 330, y: 300, w: 340, h: 190 }, // walk in to open Customize
  panels: [{ x: 150, y: 90, w: 280, h: 120 }, { x: 570, y: 90, w: 280, h: 120 }],
  queue: { x: 150, y: 500, w: 700, h: 110 }, // the dashed strip players start in
};
// Where players start in the reception room: two rows of five in the strip at the bottom.
export function lobbySpawn(i) {
  const row = Math.floor(i / 5), col = i % 5;
  return { x: 200 + col * 150, y: 535 + row * 55 };
}

// ---------- Geometry helpers ----------

export function obstaclesFor(lockedRooms = []) {
  const locked = new Set(lockedRooms);
  return [
    ...WALLS,
    ...FURNITURE,
    ...DOORS.filter((d) => d.roomId && locked.has(d.roomId)),
  ];
}

// Walls that stop light. Glass lets you see through, locked doors don't.
export const OPAQUE_WALLS = WALLS.filter((w) => !w.glass);

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function collides(x, y, obstacles, r = PLAYER_R) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  for (const o of obstacles) if (circleHitsRect(x, y, r, o)) return true;
  return false;
}

// Moves with axis-separated sliding so players glide along walls.
export function moveWithCollision(x, y, dx, dy, obstacles, ghost = false) {
  if (ghost) {
    return {
      x: Math.max(PLAYER_R, Math.min(WORLD.w - PLAYER_R, x + dx)),
      y: Math.max(PLAYER_R, Math.min(WORLD.h - PLAYER_R, y + dy)),
    };
  }
  let nx = x + dx;
  if (collides(nx, y, obstacles)) nx = x;
  let ny = y + dy;
  if (collides(nx, ny, obstacles)) ny = y;
  return { x: nx, y: ny };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function roomAt(x, y) {
  let best = null;
  for (const r of ROOMS) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h && (!best || r.w * r.h < best.w * best.h)) best = r;
  }
  if (best) return best.name;
  const z = ZONES.find((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  return z ? z.name : 'Hallway';
}

// Players stand around the emergency table in the Lobby when a round starts or a meeting ends.
// The design's spawn dots can sit against the table or sofas, so each is nudged to the nearest free spot.
const SPAWNS = (() => {
  const obs = obstaclesFor([]);
  return MAP.spawn.map((s0) => {
    const p = pt(s0);
    for (let r = 0; r <= 80; r += 2) {
      for (let a = 0; a < 16; a++) {
        const q = { x: Math.round(p.x + Math.cos((a / 16) * Math.PI * 2) * r), y: Math.round(p.y + Math.sin((a / 16) * Math.PI * 2) * r) };
        if (!collides(q.x, q.y, obs, PLAYER_R + 3)) return q;
      }
    }
    return p;
  });
})();
export function spawnPoint(i) {
  return SPAWNS[i % SPAWNS.length];
}
