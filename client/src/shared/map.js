// Shared map + game config. Imported by both the server and the React client.
// Coordinates are in world units (1 unit = 1 pixel at zoom 1). Origin is top-left.

export const WORLD = { w: 1200, h: 850 };
export const WALL = 12;
export const PLAYER_R = 14;
export const SPEED = 190; // units per second

// Rooms. Doors are gaps in a wall: side + centre offset along that side + gap size.
// A side lying on the outer boundary gets no wall (the boundary itself blocks).
export const ROOMS = [
  { id: 'cafeteria', name: 'Cafeteria', x: 0, y: 0, w: 258, h: 160, floor: '#c9a27a', lockable: true,
    doors: [{ side: 'bottom', at: 129, size: 90 }, { side: 'right', at: 80, size: 80 }] },
  { id: 'den', name: 'Den', x: 0, y: 260, w: 258, h: 230, floor: '#7a8fa6', lockable: true,
    doors: [{ side: 'top', at: 190, size: 80 }, { side: 'right', at: 115, size: 90 }] },
  { id: 'hive', name: 'Hive', x: 0, y: 490, w: 258, h: 146, floor: '#8a7fa8', lockable: true,
    doors: [{ side: 'right', at: 73, size: 80 }] },
  { id: 'conference', name: 'Conference', x: 510, y: 0, w: 468, h: 240, floor: '#6f9a8d', lockable: true,
    doors: [{ side: 'bottom', at: 120, size: 90 }, { side: 'bottom', at: 360, size: 90 }] },
  { id: 'security', name: 'Security', x: 978, y: 0, w: 126, h: 240, floor: '#8c8c8c', lockable: true,
    doors: [{ side: 'bottom', at: 63, size: 80 }, { side: 'right', at: 40, size: 56 }, { side: 'right', at: 120, size: 56 }] },
  { id: 'call1', name: 'Call 1', x: 1104, y: 0, w: 96, h: 80, floor: '#a58f6b', lockable: false,
    doors: [{ side: 'left', at: 40, size: 56 }] },
  { id: 'call2', name: 'Call 2', x: 1104, y: 80, w: 96, h: 80, floor: '#a58f6b', lockable: false,
    doors: [{ side: 'left', at: 40, size: 56 }] },
  { id: 'call3', name: 'Call 3', x: 1104, y: 160, w: 96, h: 80, floor: '#a58f6b', lockable: false,
    doors: [{ side: 'bottom', at: 48, size: 60 }] },
];

export const WORKSPACE_FLOOR = '#5d6670';

// Furniture that blocks movement.
export const DESKS = [
  { id: 'desk1', name: 'Desk 1', x: 400, y: 360, w: 200, h: 88 },
  { id: 'desk2', name: 'Desk 2', x: 680, y: 360, w: 200, h: 88 },
  { id: 'desk3', name: 'Desk 3', x: 960, y: 360, w: 200, h: 88 },
  { id: 'desk4', name: 'Desk 4', x: 400, y: 560, w: 200, h: 88 },
  { id: 'desk5', name: 'Desk 5', x: 680, y: 560, w: 200, h: 88 },
  { id: 'desk6', name: 'Desk 6', x: 960, y: 560, w: 200, h: 88 },
];
export const TABLES = [
  { id: 'cafe_table', x: 84, y: 55, w: 90, h: 50, color: '#8d6e63' },
  { id: 'conf_table', x: 620, y: 85, w: 250, h: 70, color: '#795548' },
];

export const EMERGENCY_BUTTON = { x: 129, y: 80 };
export const CAMERA_CONSOLE = { x: 1060, y: 130 };

// Tasks. `type` picks the mini-game component on the client.
export const TASKS = [
  { id: 'cafe_chai', name: 'Brew chai', room: 'Cafeteria', x: 225, y: 35, type: 'hold', seconds: 3 },
  { id: 'cafe_spill', name: 'Clean the spill', room: 'Cafeteria', x: 55, y: 130, type: 'clicks', count: 6, thing: 'spill' },
  { id: 'desk1_wires', name: 'Fix laptop wires', room: 'Desk 1', x: 500, y: 342, type: 'wires', count: 4 },
  { id: 'desk2_upload', name: 'Upload attendance', room: 'Desk 2', x: 780, y: 342, type: 'upload', seconds: 6 },
  { id: 'desk3_code', name: 'Type the code', room: 'Desk 3', x: 1060, y: 342, type: 'type' },
  { id: 'desk4_notes', name: 'Sort sticky notes', room: 'Desk 4', x: 500, y: 666, type: 'sequence', count: 8 },
  { id: 'desk5_charge', name: 'Charge the laptop', room: 'Desk 5', x: 780, y: 666, type: 'hold', seconds: 4 },
  { id: 'ws_printer', name: 'Refill the printer', room: 'Workspace', x: 1170, y: 500, type: 'clicks', count: 5, thing: 'paper' },
  { id: 'conf_projector', name: 'Align the projector', room: 'Conference', x: 940, y: 40, type: 'align' },
  { id: 'conf_board', name: 'Wipe the whiteboard', room: 'Conference', x: 560, y: 35, type: 'clicks', count: 7, thing: 'scribble' },
  { id: 'sec_id', name: 'Swipe ID card', room: 'Security', x: 1005, y: 50, type: 'swipe' },
  { id: 'call1_phone', name: 'Answer the phone', room: 'Call 1', x: 1150, y: 30, type: 'keypad' },
  { id: 'call2_headset', name: 'Reconnect headset', room: 'Call 2', x: 1160, y: 120, type: 'wires', count: 3 },
  { id: 'den_sign', name: 'Sign the files', room: 'Den', x: 50, y: 300, type: 'sequence', count: 5 },
  { id: 'den_plant', name: 'Water the plant', room: 'Den', x: 225, y: 455, type: 'hold', seconds: 3 },
  { id: 'hive_shred', name: 'Shred documents', room: 'Hive', x: 50, y: 600, type: 'clicks', count: 6, thing: 'paper' },
  { id: 'hive_reboot', name: "Reboot manager's PC", room: 'Hive', x: 210, y: 520, type: 'switches', count: 5 },
];
export const TASKS_PER_PLAYER = 3;

// Sabotages and where they are fixed.
export const SABOTAGE_FIX = {
  lights: [{ id: 'lights', name: 'Fix lights', x: 1060, y: 666, type: 'switches', count: 5 }],
  comms: [{ id: 'comms', name: 'Fix network', x: 1180, y: 62, type: 'align' }],
  wifi: [
    { id: 'wifiA', name: 'Reset Wi-Fi (Security)', x: 1000, y: 205, type: 'holdSync' },
    { id: 'wifiB', name: 'Reset Wi-Fi (Call 3)', x: 1160, y: 205, type: 'holdSync' },
  ],
};

// Vents come in linked pairs.
export const VENTS = [
  { id: 'v_den', x: 200, y: 400, to: 'v_conf' },
  { id: 'v_conf', x: 560, y: 195, to: 'v_den' },
  { id: 'v_cafe', x: 30, y: 30, to: 'v_call2' },
  { id: 'v_call2', x: 1125, y: 142, to: 'v_cafe' },
  { id: 'v_hive', x: 220, y: 605, to: 'v_ws_br' },
  { id: 'v_ws_br', x: 1150, y: 800, to: 'v_hive' },
  { id: 'v_sec', x: 1080, y: 215, to: 'v_ws_mid' },
  { id: 'v_ws_mid', x: 690, y: 790, to: 'v_sec' },
];

// Areas visible on security cameras.
export const CAMERAS = [
  { name: 'Cafeteria', x: 0, y: 0, w: 258, h: 260 },
  { name: 'Conference', x: 510, y: 0, w: 468, h: 240 },
  { name: 'Desks', x: 380, y: 300, w: 800, h: 380 },
  { name: 'Cabins door', x: 258, y: 380, w: 180, h: 300 },
];

export const COLORS = [
  { id: 'red', hex: '#e53935' }, { id: 'blue', hex: '#1e88e5' }, { id: 'green', hex: '#43a047' },
  { id: 'yellow', hex: '#fdd835' }, { id: 'orange', hex: '#fb8c00' }, { id: 'purple', hex: '#8e24aa' },
  { id: 'pink', hex: '#ec407a' }, { id: 'cyan', hex: '#00acc1' }, { id: 'white', hex: '#eceff1' },
  { id: 'brown', hex: '#795548' }, { id: 'lime', hex: '#c0ca33' }, { id: 'black', hex: '#37474f' },
];

export const USE_RANGE = 70;
export const KILL_RANGE = 90;
export const REPORT_RANGE = 110;
// Base vision radii at 100%. The lobby's crew/impostor vision settings scale these.
export const VISION = { crew: 280, impostor: 280, lightsOut: 95 };

export const DEFAULT_SETTINGS = {
  impostors: 1,
  killCooldown: 25,
  meetingSeconds: 90,
  emergencyPerPlayer: 1,
  crewVision: 100, // percent
  impostorVision: 135, // percent
  minPlayers: 3,
};

export const SABOTAGE_COOLDOWN = 30;
export const DOOR_SECONDS = 10;
export const DOOR_COOLDOWN = 20;
export const WIFI_SECONDS = 45;

// ---------- Geometry helpers ----------

function sideOnBoundary(r, side) {
  if (side === 'left') return r.x === 0;
  if (side === 'top') return r.y === 0;
  if (side === 'right') return r.x + r.w === WORLD.w;
  return r.y + r.h === WORLD.h;
}

// Builds wall rectangles (with door gaps) and door rectangles for every room.
export function buildWalls() {
  const walls = [];
  const doors = []; // { roomId, x, y, w, h }
  const t = WALL;
  for (const r of ROOMS) {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      if (sideOnBoundary(r, side)) continue;
      const horizontal = side === 'top' || side === 'bottom';
      const len = horizontal ? r.w : r.h;
      const gaps = r.doors
        .filter((d) => d.side === side)
        .map((d) => [d.at - d.size / 2, d.at + d.size / 2])
        .sort((a, b) => a[0] - b[0]);
      let cur = 0;
      const pieces = [];
      for (const [a, b] of gaps) {
        if (a > cur) pieces.push([cur, a]);
        doors.push({ roomId: r.id, ...segRect(r, side, a, b, t) });
        cur = b;
      }
      if (cur < len) pieces.push([cur, len]);
      for (const [a, b] of pieces) walls.push(segRect(r, side, a, b, t));
    }
  }
  return { walls, doors };
}

function segRect(r, side, a, b, t) {
  if (side === 'top') return { x: r.x + a, y: r.y - t / 2, w: b - a, h: t };
  if (side === 'bottom') return { x: r.x + a, y: r.y + r.h - t / 2, w: b - a, h: t };
  if (side === 'left') return { x: r.x - t / 2, y: r.y + a, w: t, h: b - a };
  return { x: r.x + r.w - t / 2, y: r.y + a, w: t, h: b - a };
}

export const { walls: WALLS, doors: DOORS } = buildWalls();

export function obstaclesFor(lockedRooms = []) {
  const locked = new Set(lockedRooms);
  return [
    ...WALLS,
    ...DESKS,
    ...TABLES,
    ...DOORS.filter((d) => locked.has(d.roomId)),
  ];
}

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
  const r = ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (r) return r.name;
  const d = DESKS.find((d) => x >= d.x - 60 && x <= d.x + d.w + 60 && y >= d.y - 60 && y <= d.y + d.h + 60);
  return d ? `Workspace (${d.name})` : 'Workspace';
}

export function spawnPoint(i, n) {
  // Players stand in a ring around the Cafeteria table with the emergency button.
  const a = (i / Math.max(n, 1)) * Math.PI * 2 + Math.PI / 2;
  return { x: EMERGENCY_BUTTON.x + Math.cos(a) * 88, y: EMERGENCY_BUTTON.y + Math.sin(a) * 52 };
}
