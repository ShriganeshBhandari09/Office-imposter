// Sanity checks for the office map. Run: node map/validate-map.mjs
import {
  WORLD, ROOMS, FURNITURE, WALLS, DOORS, VENTS, TASKS, SABOTAGE_FIX, MAX_PLAYERS, PLAYER_R,
  EMERGENCY_BUTTON, CAMERA_CONSOLE, CAMERAS, USE_RANGE, collides, obstaclesFor, spawnPoint,
} from '../client/src/shared/map.js';

let errors = 0;
const err = (msg) => { console.log('FAIL:', msg); errors++; };

console.log('WORLD', WORLD, '| rooms', ROOMS.length, 'walls', WALLS.length, 'doors', DOORS.length, 'furniture', FURNITURE.length);

for (const r of ROOMS) {
  if (r.x < 0 || r.y < 0 || r.x + r.w > WORLD.w || r.y + r.h > WORLD.h) err(`room ${r.id} out of bounds`);
}
for (const d of DOORS) if (!d.roomId) err(`door at ${d.x},${d.y} belongs to no room`);
for (const r of ROOMS.filter((r) => r.lockable)) {
  if (!DOORS.some((d) => d.roomId === r.id)) err(`lockable room ${r.id} has no door`);
}

const open = obstaclesFor([]);
const inBounds = (p) => p.x >= 0 && p.y >= 0 && p.x <= WORLD.w && p.y <= WORLD.h;

for (let i = 0; i < MAX_PLAYERS; i++) {
  const p = spawnPoint(i);
  if (!inBounds(p) || collides(p.x, p.y, open)) err(`spawn ${i} at ${p.x},${p.y} is blocked`);
}
if (collides(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, WALLS, 1)) err('emergency button inside a wall');

// Walkable grid (cells where a player's circle fits), flood-filled from the first spawn.
const CELL = 3;
const GW = Math.ceil(WORLD.w / CELL), GH = Math.ceil(WORLD.h / CELL);
const walk = (r) => {
  const g = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) g[y * GW + x] = collides(x * CELL + CELL / 2, y * CELL + CELL / 2, open, r) ? 0 : 1;
  return g;
};
function flood(g, from) {
  const seen = new Uint8Array(GW * GH);
  const q = [Math.floor(from.y / CELL) * GW + Math.floor(from.x / CELL)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % GW, y = (i / GW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx;
      if (g[j] && !seen[j]) { seen[j] = 1; q.push(j); }
    }
  }
  return seen;
}
// A target is reachable if some reachable cell lies within `range` of it.
const reaches = (seen, t, range) => {
  const r = Math.ceil(range / CELL);
  const cx = Math.floor(t.x / CELL), cy = Math.floor(t.y / CELL);
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (x < 0 || y < 0 || x >= GW || y >= GH || !seen[y * GW + x]) continue;
    if (Math.hypot((x + 0.5) * CELL - t.x, (y + 0.5) * CELL - t.y) <= range) return true;
  }
  return false;
};

// Players (radius 14) and bots (radius 15, so they keep clear of walls) must both get everywhere.
for (const [label, radius] of [['player', PLAYER_R], ['bot', PLAYER_R + 1]]) {
  const seen = flood(walk(radius), spawnPoint(0));
  for (let i = 1; i < MAX_PLAYERS; i++) {
    const sp = spawnPoint(i);
    if (!seen[Math.floor(sp.y / CELL) * GW + Math.floor(sp.x / CELL)]) err(`${label} spawn ${i} at ${sp.x},${sp.y} is walled off from the rest of the map`);
  }
  for (const t of TASKS) if (!reaches(seen, t, USE_RANGE * 0.9)) err(`${label} cannot reach task ${t.num} ${t.name}`);
  for (const [type, fixes] of Object.entries(SABOTAGE_FIX)) for (const f of fixes) if (!reaches(seen, f, USE_RANGE * 0.9)) err(`${label} cannot reach ${type} fix ${f.id}`);
  for (const v of VENTS) if (!reaches(seen, v, USE_RANGE * 0.9)) err(`${label} cannot reach vent ${v.id}`);
  if (!reaches(seen, EMERGENCY_BUTTON, USE_RANGE)) err(`${label} cannot reach the emergency button`);
  if (!reaches(seen, CAMERA_CONSOLE, USE_RANGE)) err(`${label} cannot reach the camera console`);
  for (const r of ROOMS) {
    let ok = false;
    for (let y = r.y; y < r.y + r.h && !ok; y += CELL) for (let x = r.x; x < r.x + r.w; x += CELL) {
      if (seen[Math.floor(y / CELL) * GW + Math.floor(x / CELL)]) { ok = true; break; }
    }
    if (!ok) err(`${label} cannot reach room ${r.id}`);
  }
}

// Vents come in mutual pairs.
const ventMap = new Map(VENTS.map((v) => [v.id, v]));
for (const v of VENTS) {
  const partner = ventMap.get(v.to);
  if (!partner || partner.to !== v.id) err(`vent ${v.id} <-> ${v.to} link is not mutual`);
}
for (const c of CAMERAS) {
  if (c.x < 0 || c.y < 0 || c.x + c.w > WORLD.w || c.y + c.h > WORLD.h) err(`camera ${c.name} out of bounds`);
}

console.log(errors ? `\n${errors} problem(s) found.` : '\nAll checks passed.');
process.exit(errors ? 1 : 0);
