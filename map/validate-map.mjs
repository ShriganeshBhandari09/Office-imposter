import {
  WORLD, ROOMS, DESKS, TABLES, WALLS, DOORS, VENTS, TASKS, SABOTAGE_FIX,
  EMERGENCY_BUTTON, CAMERA_CONSOLE, CAMERAS, USE_RANGE, PLAYER_R, collides, obstaclesFor, spawnPoint,
} from '../client/src/shared/map.js';

let errors = 0;
const err = (msg) => { console.log('FAIL:', msg); errors++; };

console.log('WORLD', WORLD);
console.log('ROOMS:', ROOMS.length, 'WALLS:', WALLS.length, 'DOORS:', DOORS.length);

// Every room must fit inside WORLD.
for (const r of ROOMS) {
  if (r.x < 0 || r.y < 0 || r.x + r.w > WORLD.w || r.y + r.h > WORLD.h) err(`room ${r.id} out of bounds`);
}

// No two rooms should overlap (other than touching edges).
for (let i = 0; i < ROOMS.length; i++) {
  for (let j = i + 1; j < ROOMS.length; j++) {
    const a = ROOMS[i], b = ROOMS[j];
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (ox > 0.01 && oy > 0.01) err(`rooms ${a.id} and ${b.id} overlap by ${ox}x${oy}`);
  }
}

// Doors: each door's gap must lie fully within its room's side length.
for (const r of ROOMS) {
  for (const d of r.doors) {
    const len = (d.side === 'top' || d.side === 'bottom') ? r.w : r.h;
    const a = d.at - d.size / 2, b = d.at + d.size / 2;
    if (a < 0 || b > len) err(`door on ${r.id}/${d.side} at=${d.at} size=${d.size} exceeds side length ${len}`);
  }
}

// No desk/table should sit on top of a door (would block the doorway).
const obstacles = [...DESKS, ...TABLES];
for (const o of obstacles) {
  for (const d of DOORS) {
    const ox = Math.max(0, Math.min(o.x + o.w, d.x + d.w) - Math.max(o.x, d.x));
    const oy = Math.max(0, Math.min(o.y + o.h, d.y + d.h) - Math.max(o.y, d.y));
    if (ox > 0 && oy > 0) err(`obstacle ${o.id || o.name} blocks door of ${d.roomId}`);
  }
}

// Emergency button must be walkable (not inside a wall/desk/table).
const obs = obstaclesFor([]);
if (collides(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, obs)) err('EMERGENCY_BUTTON is inside an obstacle');
if (collides(CAMERA_CONSOLE.x, CAMERA_CONSOLE.y, obs)) err('CAMERA_CONSOLE is inside an obstacle');

// Spawn ring for up to 12 players must all be walkable and in-bounds.
for (let i = 0; i < 12; i++) {
  const p = spawnPoint(i, 12);
  if (p.x < PLAYER_R || p.y < PLAYER_R || p.x > WORLD.w - PLAYER_R || p.y > WORLD.h - PLAYER_R) {
    err(`spawn point ${i} out of world bounds: ${p.x},${p.y}`);
  }
  if (collides(p.x, p.y, obs)) err(`spawn point ${i} collides with an obstacle at ${p.x},${p.y}`);
}

// Every task must be within bounds and not embedded inside a wall.
for (const t of TASKS) {
  if (t.x < 0 || t.y < 0 || t.x > WORLD.w || t.y > WORLD.h) err(`task ${t.id} out of bounds`);
  if (collides(t.x, t.y, WALLS, 1)) err(`task ${t.id} sits inside a wall`);
}

// Sabotage fix points same check.
for (const [type, fixes] of Object.entries(SABOTAGE_FIX)) {
  for (const f of fixes) {
    if (f.x < 0 || f.y < 0 || f.x > WORLD.w || f.y > WORLD.h) err(`sabotage ${type}/${f.id} out of bounds`);
    if (collides(f.x, f.y, WALLS, 1)) err(`sabotage ${type}/${f.id} sits inside a wall`);
  }
}

// Vents must be linked pairs (a.to === b.id and b.to === a.id) and in-bounds, not inside a wall.
const ventMap = new Map(VENTS.map((v) => [v.id, v]));
for (const v of VENTS) {
  if (v.x < 0 || v.y < 0 || v.x > WORLD.w || v.y > WORLD.h) err(`vent ${v.id} out of bounds`);
  if (collides(v.x, v.y, WALLS, 1)) err(`vent ${v.id} sits inside a wall`);
  const partner = ventMap.get(v.to);
  if (!partner) err(`vent ${v.id} points to missing vent ${v.to}`);
  else if (partner.to !== v.id) err(`vent ${v.id} <-> ${v.to} link is not mutual`);
}

// Cameras in-bounds.
for (const c of CAMERAS) {
  if (c.x < 0 || c.y < 0 || c.x + c.w > WORLD.w || c.y + c.h > WORLD.h) err(`camera ${c.name} out of bounds`);
}

console.log(errors ? `\n${errors} problem(s) found.` : '\nAll checks passed.');
process.exit(errors ? 1 : 0);
