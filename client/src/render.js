import {
  WORLD, ROOMS, DESKS, TABLES, WALLS, DOORS, VENTS, WORKSPACE_FLOOR,
  EMERGENCY_BUTTON, CAMERA_CONSOLE, TASKS, SABOTAGE_FIX, COLORS, CAMERAS,
} from './shared/map.js';
import { sprite, SPRITE_W, SPRITE_H } from './sprites.js';

export const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex || '#ccc';

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function checker(g, x, y, w, h, base, tile = 32) {
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  g.fillStyle = shadeHex(base, 0.92);
  for (let ty = y; ty < y + h; ty += tile) {
    for (let tx = x; tx < x + w; tx += tile) {
      if (((tx / tile) + (ty / tile)) % 2 === 0) {
        g.fillRect(tx, ty, Math.min(tile, x + w - tx), Math.min(tile, y + h - ty));
      }
    }
  }
}

function monitor(g, x, y) {
  g.fillStyle = '#1f2328'; g.fillRect(x, y, 26, 18);
  g.fillStyle = '#4fc3f7'; g.fillRect(x + 3, y + 3, 20, 12);
  g.fillStyle = '#1f2328'; g.fillRect(x + 11, y + 18, 4, 5);
}

function chair(g, x, y) {
  g.fillStyle = '#263238'; g.fillRect(x, y, 22, 18);
  g.fillStyle = '#37474f'; g.fillRect(x + 3, y + 3, 16, 12);
}

let staticLayer = null;
let fogLayer = null;

// Everything that never changes is drawn once into an offscreen canvas.
function buildStatic() {
  const c = document.createElement('canvas');
  c.width = WORLD.w; c.height = WORLD.h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;

  checker(g, 0, 0, WORLD.w, WORLD.h, WORKSPACE_FLOOR);
  for (const r of ROOMS) checker(g, r.x, r.y, r.w, r.h, r.floor, 24);

  // Desks with monitors and chairs. Desk sizes vary a lot on this map, so the layout adapts
  // to each desk's width (how many monitor columns fit) and height (one row or two).
  for (const d of DESKS) {
    g.fillStyle = '#6d4c41'; g.fillRect(d.x, d.y, d.w, d.h);
    g.fillStyle = '#8d6e63'; g.fillRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
    const cols = Math.max(1, Math.floor((d.w - 20) / 62));
    const twoRows = d.h >= 70;
    for (let i = 0; i < cols; i++) {
      const mx = d.x + 22 + i * 62;
      if (mx + 26 > d.x + d.w - 4) break;
      if (twoRows) { monitor(g, mx, d.y + 12); monitor(g, mx, d.y + 52); }
      else monitor(g, mx, d.y + d.h / 2 - 9);
      chair(g, mx + 2, d.y - 22);
      chair(g, mx + 2, d.y + d.h + 4);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.font = '14px VT323, monospace';
    g.fillText(d.name, d.x + d.w - 46, d.y + d.h - 6);
  }
  for (const t of TABLES) {
    g.fillStyle = shadeHex(t.color, 0.8); g.fillRect(t.x, t.y, t.w, t.h);
    g.fillStyle = t.color; g.fillRect(t.x + 4, t.y + 4, t.w - 8, t.h - 8);
  }
  // Emergency button in the Lobby.
  g.fillStyle = '#555'; g.beginPath(); g.arc(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, 14, 0, 7); g.fill();
  g.fillStyle = '#e53935'; g.beginPath(); g.arc(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, 10, 0, 7); g.fill();

  // Props next to task spots so each one reads as a real thing.
  const prop = (x, y, w, h, a, b) => { g.fillStyle = a; g.fillRect(x, y, w, h); if (b) { g.fillStyle = b; g.fillRect(x + 3, y + 3, w - 6, h - 6); } };
  prop(30, 150, 52, 22, '#455a64', '#90a4ae');      // Cafeteria chai counter
  prop(270, 15, 50, 40, '#263238', '#37474f');      // Spark server rack
  prop(355, 15, 30, 30, '#212121', '#424242');      // Hive shredder
  prop(395, 60, 40, 24, '#212121', '#4fc3f7');      // Hive manager PC
  prop(20, 380, 50, 30, '#5d4037', '#8d6e63');      // Toilets supply shelf
  prop(190, 460, 40, 40, '#455a64', '#607d8b');     // Pixel filing cabinet
  prop(250, 500, 60, 40, '#5d4037', '#8d6e63');     // Den desk
  prop(390, 510, 26, 26, '#6d4c41', '#2e7d32');     // Den plant
  prop(860, 300, 60, 30, '#455a64', '#90a4ae');     // Lobby reception desk
  prop(610, 280, 16, 30, '#263238', '#00e676');     // Lobby router (comms fix)
  prop(630, 398, 90, 14, '#eceff1', '#ffffff');     // Conference whiteboard
  prop(720, 500, 70, 14, '#212121', '#424242');     // Conference projector screen
  prop(800, 450, 60, 40, '#212121', '#1b5e20');     // Security camera console
  prop(860, 410, 40, 20, '#212121', '#424242');     // Security ID reader
  prop(940, 400, 40, 20, '#263238', '#29b6f6');     // Wi-Fi panel (Security)
  prop(898, 655, 40, 20, '#263238', '#29b6f6');     // Wi-Fi panel (Call 3)
  prop(950, 495, 30, 16, '#37474f', '#263238');     // Call 1 phone
  prop(950, 630, 30, 14, '#37474f', '#263238');     // Call 2 headset stand
  prop(950, 660, 30, 16, '#263238', '#455a64');     // Call 3 laptop
  prop(130, 260, 40, 20, '#fbc02d', '#212121');     // Toilets power panel (lights fix)

  // Vents.
  for (const v of VENTS) {
    g.fillStyle = '#263238'; g.fillRect(v.x - 16, v.y - 11, 32, 22);
    g.fillStyle = '#546e7a';
    for (let i = 0; i < 4; i++) g.fillRect(v.x - 13, v.y - 8 + i * 5, 26, 2);
  }

  // Walls with a lighter top edge for a bit of depth.
  for (const w of WALLS) {
    g.fillStyle = '#1c1f24'; g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = '#39404a'; g.fillRect(w.x, w.y, w.w, Math.min(4, w.h));
  }
  g.strokeStyle = '#1c1f24'; g.lineWidth = 8; g.strokeRect(4, 4, WORLD.w - 8, WORLD.h - 8);

  // Room labels.
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'center';
  for (const r of ROOMS) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    const small = r.w < 130;
    g.font = small ? '8px "Press Start 2P", monospace' : '12px "Press Start 2P", monospace';
    g.fillText(r.name, r.x + r.w / 2, r.y + r.h / 2 + (small ? 16 : 30));
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.font = '14px "Press Start 2P", monospace';
  g.fillText('Workspace', 720, 35);
  g.fillText('Workspace', 660, 780);
  g.fillText('Workspace', 220, 780);
  g.textAlign = 'left';
  return c;
}

export function invalidateStatic() { staticLayer = null; }

function drawMarker(g, x, y, color, t) {
  const bob = Math.sin(t / 250) * 4;
  g.fillStyle = color;
  g.font = '16px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.fillText('!', x, y - 26 + bob);
  g.globalAlpha = 0.25 + 0.15 * Math.sin(t / 250);
  g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill();
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

export function drawCharacter(g, x, y, hex, { frame = 0, facing = 1, name, ghost = false, highlight = null } = {}) {
  const img = sprite(hex, frame, facing);
  g.save();
  if (ghost) g.globalAlpha = 0.45;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(x, y + SPRITE_H / 2 - 2, 14, 5, 0, 0, 7); g.fill();
  if (highlight) {
    g.strokeStyle = highlight; g.lineWidth = 3;
    g.strokeRect(x - SPRITE_W / 2 - 3, y - SPRITE_H / 2 - 3, SPRITE_W + 6, SPRITE_H + 6);
  }
  g.drawImage(img, Math.round(x - SPRITE_W / 2), Math.round(y - SPRITE_H / 2));
  if (name) {
    g.font = '18px VT323, monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillText(name, x + 1, y - SPRITE_H / 2 - 5);
    g.fillStyle = '#fff';
    g.fillText(name, x, y - SPRITE_H / 2 - 6);
    g.textAlign = 'left';
  }
  g.restore();
}

// When each body first appeared on this client (ms), for the in-world kill effect.
const bodySeen = new Map();
const KILL_FX_MS = 700;

// age: ms since the body appeared. A fresh body tips over and its blood pool spreads.
function drawBody(g, b, age) {
  const img = sprite(colorHex(b.color), 0, 1);
  const fall = Math.min(1, age / 300);
  const pool = Math.min(1, age / 500);
  g.save();
  g.fillStyle = 'rgba(120,0,0,0.55)';
  g.beginPath(); g.ellipse(b.x, b.y + 8, 26 * pool, 10 * pool, 0, 0, 7); g.fill();
  g.translate(b.x, b.y);
  g.rotate((Math.PI / 2) * fall);
  g.drawImage(img, -SPRITE_W / 2, -SPRITE_H / 2);
  g.restore();
}

// Red slash and burst over a fresh body, drawn above players so the killer standing on it doesn't hide it.
function drawKillFx(g, b, age) {
  if (age >= KILL_FX_MS) return;
  const p = age / KILL_FX_MS;
  g.save();
  g.globalAlpha = 1 - p;
  g.strokeStyle = '#ff1744';
  g.lineWidth = 4;
  g.beginPath(); g.arc(b.x, b.y, 18 + 50 * p, 0, Math.PI * 2); g.stroke();
  // Two crossing slashes that extend quickly.
  const s = Math.min(1, age / 150) * 34;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(b.x - s, b.y - s); g.lineTo(b.x + s, b.y + s);
  g.moveTo(b.x + s, b.y - s); g.lineTo(b.x - s, b.y + s);
  g.stroke();
  // Droplets flying outwards.
  g.fillStyle = '#c62828';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const r = 10 + 46 * p;
    g.fillRect(b.x + Math.cos(a) * r - 2, b.y + Math.sin(a) * r - 2, 4, 4);
  }
  g.restore();
}

// ---------- Line of sight ----------
// Walls (and locked doors) block vision; desks and tables are low enough to see over.

function rectSegments(o) {
  const x2 = o.x + o.w, y2 = o.y + o.h;
  return [[o.x, o.y, x2, o.y, o], [x2, o.y, x2, y2, o], [x2, y2, o.x, y2, o], [o.x, y2, o.x, o.y, o]];
}

function nearRect(o, x, y, r) {
  return o.x - r <= x && x <= o.x + o.w + r && o.y - r <= y && y <= o.y + o.h + r;
}

// Distance along the unit ray (x,y)+(dx,dy)*t to the closest segment (capped at max), and what it hit.
function castRay(x, y, dx, dy, segs, max) {
  let best = max, hit = null;
  for (const [ax, ay, bx, by, o] of segs) {
    const sx = bx - ax, sy = by - ay;
    const den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x) * sy - (ay - y) * sx) / den;
    const u = ((ax - x) * dy - (ay - y) * dx) / den;
    if (t >= 0 && t < best && u >= 0 && u <= 1) { best = t; hit = o; }
  }
  return { d: best, hit };
}

// The outer edge of the map blocks light too, otherwise vision spills into the void past the walls.
const BOUNDS = [
  { x: -1000, y: -1000, w: WORLD.w + 2000, h: 1000, edge: true },
  { x: -1000, y: WORLD.h, w: WORLD.w + 2000, h: 1000, edge: true },
  { x: -1000, y: 0, w: 1000, h: WORLD.h, edge: true },
  { x: WORLD.w, y: 0, w: 1000, h: WORLD.h, edge: true },
];
// How far light reaches into a wall it hits, so the wall's face reads as lit.
const WALL_DEPTH = 16;

// Distance along the ray from (x,y) at which it leaves rect o.
function exitDist(x, y, dx, dy, o) {
  const tx = dx > 0 ? (o.x + o.w - x) / dx : dx < 0 ? (o.x - x) / dx : Infinity;
  const ty = dy > 0 ? (o.y + o.h - y) / dy : dy < 0 ? (o.y - y) / dy : Infinity;
  return Math.min(tx, ty);
}

// Polygon (world coords) of everything visible from (x,y) within radius r.
// Each ray stops a little way into the wall it hits, so only the part of a wall in view is lit.
function visibilityPolygon(x, y, r, occluders) {
  const segs = [];
  for (const o of [...occluders, ...BOUNDS]) if (nearRect(o, x, y, r)) segs.push(...rectSegments(o));
  // All angles in the same range as atan2 (-PI..PI) so sorting gives a clean, non-crossing outline.
  const angles = [];
  for (let i = 0; i < 128; i++) angles.push(-Math.PI + (i / 128) * Math.PI * 2);
  for (const [ax, ay] of segs) {
    if (Math.hypot(ax - x, ay - y) > r + 1) continue;
    const a = Math.atan2(ay - y, ax - x);
    angles.push(a - 0.0001, a, a + 0.0001);
  }
  angles.sort((a, b) => a - b);
  const pts = [];
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let { d, hit } = castRay(x, y, dx, dy, segs, r);
    if (hit && !hit.edge) d = Math.min(r, d + WALL_DEPTH, exitDist(x, y, dx, dy, hit));
    pts.push([x + dx * d, y + dy * d]);
  }
  return pts;
}

// True if the straight line from a to b doesn't pass through any occluder (Liang-Barsky).
function lineOfSight(ax, ay, bx, by, occluders) {
  const dx = bx - ax, dy = by - ay;
  for (const o of occluders) {
    let t0 = 0, t1 = 1, hit = true;
    for (const [p, q] of [[-dx, ax - o.x], [dx, o.x + o.w - ax], [-dy, ay - o.y], [dy, o.y + o.h - ay]]) {
      if (p === 0) { if (q < 0) { hit = false; break; } continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) { hit = false; break; } if (t > t0) t0 = t; }
      else { if (t < t0) { hit = false; break; } if (t < t1) t1 = t; }
    }
    if (hit) return false;
  }
  return true;
}

// Draws one frame of the world.
// opts: view, me {x,y,frame,facing}, others Map(id -> {x,y,frame,facing}), zoom, t, markers, killTargetId, vision
export function drawWorld(g, cw, ch, opts) {
  if (!staticLayer) staticLayer = buildStatic();
  const { view, me, others, zoom, t, markers = [], killTargetId, vision, dpr = 1 } = opts;
  const roster = new Map(view.roster.map((p) => [p.id, p]));

  // Camera centred on the local player, clamped to the map.
  const vw = cw / zoom, vh = ch / zoom;
  let camX = me.x - vw / 2, camY = me.y - vh / 2;
  // Allow some space past the map edges so the HUD panels don't hide a player near a wall.
  const pad = 160;
  camX = vw >= WORLD.w + pad * 2 ? (WORLD.w - vw) / 2 : Math.max(-pad, Math.min(WORLD.w - vw + pad, camX));
  camY = vh >= WORLD.h + pad * 2 ? (WORLD.h - vh) / 2 : Math.max(-pad, Math.min(WORLD.h - vh + pad, camY));

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0b0d10';
  g.fillRect(0, 0, cw, ch);
  g.setTransform(zoom * dpr, 0, 0, zoom * dpr, -camX * zoom * dpr, -camY * zoom * dpr);
  g.imageSmoothingEnabled = false;
  g.drawImage(staticLayer, 0, 0);

  // Locked doors.
  const locked = new Set(Object.keys(view.doors || {}));
  for (const d of DOORS) {
    if (!locked.has(d.roomId)) continue;
    g.fillStyle = '#8d2b1f'; g.fillRect(d.x, d.y, d.w, d.h);
    g.fillStyle = '#ff7043';
    if (d.w > d.h) for (let x = d.x + 4; x < d.x + d.w; x += 10) g.fillRect(x, d.y + 2, 3, d.h - 4);
    else for (let y = d.y + 4; y < d.y + d.h; y += 10) g.fillRect(d.x + 2, y, d.w - 4, 3);
  }

  // With limited vision, only what the local player can actually see is drawn.
  // A door that locks on top of the player doesn't blind them.
  const occluders = [...WALLS, ...DOORS.filter((d) => locked.has(d.roomId)
    && !(me.x > d.x && me.x < d.x + d.w && me.y > d.y && me.y < d.y + d.h))];
  const canSee = (x, y) => !vision
    || (Math.hypot(x - me.x, y - me.y) <= vision && lineOfSight(me.x, me.y, x, y, occluders));

  for (const m of markers) drawMarker(g, m.x, m.y, m.color, t);
  const allBodies = view.bodies || [];
  if (!allBodies.length) bodySeen.clear();
  for (const b of allBodies) if (!bodySeen.has(b.id)) bodySeen.set(b.id, t);
  const bodies = allBodies.filter((b) => canSee(b.x, b.y));
  for (const b of bodies) drawBody(g, b, t - bodySeen.get(b.id));

  // Players, sorted by y so lower characters draw in front.
  const meRow = roster.get(view.me?.id);
  const list = [];
  for (const p of view.players) {
    const info = roster.get(p.id);
    if (!info) continue;
    if (p.id === view.me?.id) {
      if (view.me.inVent) continue;
      list.push({ id: p.id, x: me.x, y: me.y, frame: me.frame, facing: me.facing, alive: meRow?.alive, info });
    } else {
      const o = others.get(p.id) || p;
      if (!canSee(o.x, o.y)) continue;
      list.push({ id: p.id, x: o.x, y: o.y, frame: o.frame || 0, facing: o.facing || 1, alive: p.alive, info });
    }
  }
  list.sort((a, b) => a.y - b.y);
  for (const p of list) {
    const isImpMate = p.info.role === 'impostor' && view.me?.role === 'impostor';
    drawCharacter(g, p.x, p.y, colorHex(p.info.color), {
      frame: p.frame, facing: p.facing, ghost: !p.alive,
      name: p.info.name,
      highlight: p.id === killTargetId ? '#ff1744' : null,
    });
    if (isImpMate && p.id !== view.me.id) {
      g.fillStyle = '#ff1744'; g.font = '14px VT323, monospace'; g.textAlign = 'center';
      g.fillText('impostor', p.x, p.y + SPRITE_H / 2 + 12); g.textAlign = 'left';
    }
  }

  for (const b of bodies) drawKillFx(g, b, t - bodySeen.get(b.id));

  // Fog of war: an opaque layer with the visible area cut out, softened towards the vision edge.
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (vision) {
    const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
    if (!fogLayer) fogLayer = document.createElement('canvas');
    if (fogLayer.width !== W || fogLayer.height !== H) { fogLayer.width = W; fogLayer.height = H; }
    const f = fogLayer.getContext('2d');
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.fillStyle = 'rgb(5,6,10)';
    f.fillRect(0, 0, W, H);

    const pts = visibilityPolygon(me.x, me.y, vision, occluders);
    f.setTransform(zoom * dpr, 0, 0, zoom * dpr, -camX * zoom * dpr, -camY * zoom * dpr);
    const light = f.createRadialGradient(me.x, me.y, vision * 0.7, me.x, me.y, vision);
    light.addColorStop(0, 'rgba(0,0,0,1)');
    light.addColorStop(1, 'rgba(0,0,0,0)');
    f.globalCompositeOperation = 'destination-out';
    f.fillStyle = light;
    f.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? f.moveTo(x, y) : f.lineTo(x, y)));
    f.closePath();
    f.fill();
    f.globalCompositeOperation = 'source-over';

    g.drawImage(fogLayer, 0, 0, cw, ch);
  }

  // Edge arrows toward important off-screen spots (sabotage fixes).
  for (const m of markers.filter((m) => m.arrow)) {
    const sx = (m.x - camX) * zoom, sy = (m.y - camY) * zoom;
    if (sx > 0 && sy > 0 && sx < cw && sy < ch) continue;
    const cx = cw / 2, cy = ch / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    const ex = Math.max(30, Math.min(cw - 30, cx + Math.cos(a) * (cw / 2 - 30)));
    const ey = Math.max(30, Math.min(ch - 30, cy + Math.sin(a) * (ch / 2 - 30)));
    g.save(); g.translate(ex, ey); g.rotate(a);
    g.fillStyle = m.color;
    g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, -11); g.lineTo(-10, 11); g.closePath(); g.fill();
    g.restore();
  }
  return { camX, camY };
}

// Small full-map view used by the map overlay and the security cameras.
export function drawMiniMap(g, w, h, { view, me, markers = [], camerasOnly = false, t = 0, dpr = 1 }) {
  if (!staticLayer) staticLayer = buildStatic();
  const s = Math.min(w / WORLD.w, h / WORLD.h);
  const ox = (w - WORLD.w * s) / 2, oy = (h - WORLD.h * s) / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = camerasOnly ? 0.35 : 0.8;
  g.drawImage(staticLayer, 0, 0);
  g.globalAlpha = 1;
  const roster = new Map(view.roster.map((p) => [p.id, p]));
  if (camerasOnly) {
    for (const c of CAMERAS) {
      g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip();
      g.drawImage(staticLayer, 0, 0);
      g.restore();
      g.strokeStyle = '#66bb6a'; g.lineWidth = 4; g.strokeRect(c.x, c.y, c.w, c.h);
      g.fillStyle = '#66bb6a'; g.font = '18px "Press Start 2P", monospace';
      g.fillText(c.name, c.x + 8, c.y + 26);
    }
    if (Math.floor(t / 600) % 2 === 0) {
      g.fillStyle = '#ff1744'; g.beginPath(); g.arc(WORLD.w - 40, WORLD.h - 40, 14, 0, 7); g.fill();
    }
    for (const p of view.players) {
      const info = roster.get(p.id);
      if (!info || !p.alive || p.id === view.me?.id) continue;
      if (!CAMERAS.some((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h)) continue;
      drawCharacter(g, p.x, p.y, colorHex(info.color), { facing: p.facing, frame: p.moving ? Math.floor(t / 150) % 2 : 0, name: info.name });
    }
    for (const b of view.bodies || []) {
      if (CAMERAS.some((c) => b.x >= c.x && b.x <= c.x + c.w && b.y >= c.y && b.y <= c.y + c.h)) drawBody(g, b);
    }
  } else {
    for (const m of markers) {
      g.fillStyle = m.color;
      g.beginPath(); g.arc(m.x, m.y, 14, 0, 7); g.fill();
    }
    if (me) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(me.x, me.y, 18, 0, 7); g.fill();
      g.fillStyle = colorHex(roster.get(view.me?.id)?.color);
      g.beginPath(); g.arc(me.x, me.y, 12, 0, 7); g.fill();
    }
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const urlCache = new Map();
export function spriteURL(hex) {
  if (!urlCache.has(hex)) urlCache.set(hex, sprite(hex, 0, 1).toDataURL());
  return urlCache.get(hex);
}

export function taskDef(id) { return TASKS.find((t) => t.id === id); }
export { SABOTAGE_FIX, CAMERA_CONSOLE, EMERGENCY_BUTTON, VENTS };
