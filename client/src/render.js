import {
  WORLD, ROOMS, DOORS, OPAQUE_WALLS, VENTS, TASKS, SABOTAGE_FIX, CAMERAS,
} from './shared/map.js';
import { mapImage, mapIsReady } from './assets.js';
import { drawObjects, drawHighlights } from './taskIcons.js';
import { robotImage, isReady, colorHex, EYE_IMPOSTOR, ROBOT_ASPECT, BODY_ASPECT } from './robot.js';

export { colorHex };

const FONT = '"Chakra Petch", system-ui, sans-serif';
const BODY_W = 40; // robot width in world units (height is 1.28x)

let fogLayer = null;
const FOG_SCALE = 0.5;

// The vision shape only changes when the player moves (or a door/vision change), so a player standing still reuses it.
let visCache = null;
function cachedVisibility(x, y, r, occluders, key) {
  const c = visCache;
  if (c && c.key === key && Math.abs(c.x - x) < 0.5 && Math.abs(c.y - y) < 0.5 && Math.abs(c.r - r) < 0.5) return c.pts;
  const pts = visibilityPolygon(x, y, r, occluders);
  visCache = { x, y, r, key, pts };
  return pts;
}

// The floor plan art, with a dark void behind it until it has loaded.
function drawFloor(g) {
  g.fillStyle = '#03050C';
  g.fillRect(0, 0, WORLD.w, WORLD.h);
  if (mapIsReady()) {
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(mapImage(), 0, 0, WORLD.w, WORLD.h);
    drawObjects(g); // the task and sabotage objects, which the clean art leaves out
  }
}

// Vents are dark grilles set into the floor.
function drawVents(g) {
  for (const v of VENTS) {
    g.fillStyle = '#0C0F13';
    g.beginPath(); g.roundRect(v.x - 13, v.y - 9, 26, 18, 3); g.fill();
    g.strokeStyle = '#2A313B'; g.lineWidth = 1;
    g.beginPath();
    for (let y = v.y - 6; y <= v.y + 6; y += 4) { g.moveTo(v.x - 11, y); g.lineTo(v.x + 11, y); }
    g.stroke();
  }
}

// A glowing ring on an object that needs doing: yellow for your own task, red for a live sabotage.
function drawMarker(g, x, y, color, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 280);
  g.save();
  g.shadowColor = color; g.shadowBlur = 14 + 8 * pulse;
  g.strokeStyle = color; g.lineWidth = 2.5; g.globalAlpha = 0.75 + 0.25 * pulse;
  g.beginPath(); g.arc(x, y, 19 + 2 * pulse, 0, 7); g.stroke();
  g.restore();
}

// "Visual task" effect: a green ring and rising sparks around a crewmate who just finished a task.
function drawTaskFx(g, x, y, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 160);
  g.save();
  g.shadowColor = '#3FE07A'; g.shadowBlur = 12 + 8 * pulse;
  g.strokeStyle = '#3FE07A'; g.lineWidth = 2.5; g.globalAlpha = 0.7 + 0.3 * pulse;
  g.beginPath(); g.ellipse(x, y, 24 + 3 * pulse, 9 + pulse, 0, 0, 7); g.stroke();
  g.fillStyle = '#B6FFCF'; g.shadowBlur = 6;
  for (let i = 0; i < 5; i++) {
    const ph = ((t / 700) + i / 5) % 1;
    const a = i * 1.9 + t / 900;
    g.globalAlpha = 1 - ph;
    g.beginPath(); g.arc(x + Math.cos(a) * 18, y - 6 - ph * 44, 2.4, 0, 7); g.fill();
  }
  g.restore();
}

function drawNameTag(g, text, x, y, color) {
  g.font = `700 12px ${FONT}`;
  g.textAlign = 'center';
  const w = g.measureText(text).width + 14;
  g.fillStyle = 'rgba(3,5,12,.7)';
  g.beginPath(); g.roundRect(x - w / 2, y - 12, w, 17, 8); g.fill();
  g.fillStyle = color;
  g.fillText(text, x, y + 1);
  g.textAlign = 'left';
}

// Draws a robot standing at (x, y), its feet on y.
export function drawRobot(g, x, y, { hex, hat, facing = 1, frame = 0, ghost = false, name, nameColor = '#EAF0FF', eyes, highlight = null, moving = false, t = 0, size = BODY_W }) {
  const img = robotImage({ hex, hat, state: ghost ? 'ghost' : 'alive', eyes, facing, frame });
  const w = size, h = size * ROBOT_ASPECT;
  const bob = moving ? Math.abs(Math.sin(t / 110)) * -2 : 0;
  if (!ghost) {
    g.fillStyle = 'rgba(0,0,0,.32)';
    g.beginPath(); g.ellipse(x, y + 2, w * 0.36, 5, 0, 0, 7); g.fill();
  }
  if (highlight) {
    g.save(); g.strokeStyle = highlight; g.lineWidth = 3; g.shadowColor = highlight; g.shadowBlur = 12;
    g.beginPath(); g.roundRect(x - w / 2 - 3, y - h + 4 + bob - 3, w + 6, h + 6, 10); g.stroke(); g.restore();
  }
  if (isReady(img)) g.drawImage(img, x - w / 2, y - h + 6 + bob, w, h);
  if (name) drawNameTag(g, name, x, y - h - 2, nameColor);
}

// When each body first appeared on this client (ms), for the in-world kill effect.
const bodySeen = new Map();
const KILL_FX_MS = 700;

// age: ms since the body appeared. A fresh body drops in and its pool spreads.
function drawBody(g, b, age = 1000) {
  const img = robotImage({ hex: colorHex(b.color), hat: b.hat, state: 'body' });
  const pool = Math.min(1, age / 500);
  const w = BODY_W * 1.5, h = w * BODY_ASPECT;
  g.save();
  g.fillStyle = 'rgba(120,10,30,.55)';
  g.beginPath(); g.ellipse(b.x, b.y + 6, 28 * pool, 10 * pool, 0, 0, 7); g.fill();
  if (isReady(img)) g.drawImage(img, b.x - w / 2, b.y - h / 2 - 2, w, h);
  g.restore();
}

// Red slash and burst over a fresh body, drawn above players so the killer standing on it doesn't hide it.
function drawKillFx(g, b, age) {
  if (age >= KILL_FX_MS) return;
  const p = age / KILL_FX_MS;
  g.save();
  g.globalAlpha = 1 - p;
  g.strokeStyle = '#FF3D5A';
  g.lineWidth = 4;
  g.beginPath(); g.arc(b.x, b.y, 18 + 50 * p, 0, Math.PI * 2); g.stroke();
  const s = Math.min(1, age / 150) * 34;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(b.x - s, b.y - s); g.lineTo(b.x + s, b.y + s);
  g.moveTo(b.x + s, b.y - s); g.lineTo(b.x - s, b.y + s);
  g.stroke();
  g.fillStyle = '#C62828';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const r = 10 + 46 * p;
    g.fillRect(b.x + Math.cos(a) * r - 2, b.y + Math.sin(a) * r - 2, 4, 4);
  }
  g.restore();
}

// ---------- Line of sight ----------
// Solid walls (and locked doors) block vision. Glass walls and furniture don't.

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
function visibilityPolygon(x, y, r, occluders) {
  const segs = [];
  for (const o of [...occluders, ...BOUNDS]) if (nearRect(o, x, y, r)) segs.push(...rectSegments(o));
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
// opts: view, me {x,y,frame,facing,moving}, others Map(id -> {x,y,frame,facing}), zoom, t, markers, killTargetId, vision
export function drawWorld(g, cw, ch, opts) {
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
  g.fillStyle = '#03050C';
  g.fillRect(0, 0, cw, ch);
  g.setTransform(zoom * dpr, 0, 0, zoom * dpr, -camX * zoom * dpr, -camY * zoom * dpr);
  drawFloor(g);
  // Your unfinished tasks (and the device of a live sabotage) glow.
  const todo = (view.me?.tasks || []).filter((tk) => !tk.done && !(opts.fakeDone && opts.fakeDone.has(tk.id)));
  drawHighlights(g, new Set(todo.map((tk) => taskNum(tk.id))),
    new Set(view.sabotage ? [{ lights: 'L', comms: 'C', wifi: 'W' }[view.sabotage.type]] : []), t);
  drawVents(g);

  // Locked doors: a hazard-striped bar across the doorway.
  const locked = new Set(Object.keys(view.doors || {}));
  for (const d of DOORS) {
    if (!d.roomId || !locked.has(d.roomId)) continue;
    g.fillStyle = '#3A0A14'; g.fillRect(d.x, d.y, d.w, d.h);
    g.fillStyle = '#FF3D5A';
    if (d.w > d.h) for (let x = d.x + 3; x < d.x + d.w; x += 9) g.fillRect(x, d.y + 2, 4, d.h - 4);
    else for (let y = d.y + 3; y < d.y + d.h; y += 9) g.fillRect(d.x + 2, y, d.w - 4, 4);
  }

  // With limited vision, only what the local player can actually see is drawn.
  // A door that locks on top of the player doesn't blind them.
  const occluders = [...OPAQUE_WALLS, ...DOORS.filter((d) => d.roomId && locked.has(d.roomId)
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
  const iAmImpostor = view.me?.role === 'impostor';
  const list = [];
  for (const p of view.players) {
    const info = roster.get(p.id);
    if (!info) continue;
    if (p.id === view.me?.id) {
      if (view.me.inVent) continue;
      list.push({ id: p.id, x: me.x, y: me.y, frame: me.frame, facing: me.facing, moving: me.moving, alive: meRow?.alive, info, fx: p.fx });
    } else {
      const o = others.get(p.id) || p;
      if (!canSee(o.x, o.y)) continue;
      list.push({ id: p.id, x: o.x, y: o.y, frame: o.frame || 0, facing: o.facing || 1, moving: o.moving, alive: p.alive, info, fx: p.fx });
    }
  }
  list.sort((a, b) => a.y - b.y);
  for (const p of list) {
    const isMe = p.id === view.me?.id;
    const isMate = p.info.role === 'impostor' && iAmImpostor && !isMe;
    drawRobot(g, p.x, p.y + 14, {
      hex: colorHex(p.info.color), hat: p.info.hat, facing: p.facing, frame: p.frame, ghost: !p.alive, t,
      moving: p.moving,
      eyes: isMe && iAmImpostor ? EYE_IMPOSTOR : isMate ? EYE_IMPOSTOR : undefined,
      name: isMe ? `${p.info.name}${p.alive ? '' : ' (ghost)'}` : p.info.name,
      nameColor: isMate ? '#FF6B81' : isMe ? '#38E1FF' : '#EAF0FF',
      highlight: p.id === killTargetId ? '#FF3D5A' : null,
    });
    if (p.fx) drawTaskFx(g, p.x, p.y + 14, t);
  }

  for (const b of bodies) drawKillFx(g, b, t - bodySeen.get(b.id));

  // Fog of war: an opaque layer with the visible area cut out, softened towards the vision edge.
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (vision) {
    // The fog is soft, so it is drawn at half resolution: a quarter of the pixels to fill on a phone.
    const W = Math.max(1, Math.round(cw * dpr * FOG_SCALE)), H = Math.max(1, Math.round(ch * dpr * FOG_SCALE));
    if (!fogLayer) fogLayer = document.createElement('canvas');
    if (fogLayer.width !== W || fogLayer.height !== H) { fogLayer.width = W; fogLayer.height = H; }
    const f = fogLayer.getContext('2d');
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H); // start every frame from nothing, otherwise the translucent fog piles up
    // Fully opaque: nothing at all is shown outside the vision circle, not even the floor plan.
    f.fillStyle = 'rgb(3,5,12)';
    f.fillRect(0, 0, W, H);

    const pts = cachedVisibility(me.x, me.y, vision, occluders, [...locked].sort().join(','));
    const fs = zoom * dpr * FOG_SCALE;
    f.setTransform(fs, 0, 0, fs, -camX * fs, -camY * fs);
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

// The security camera feed: only the camera areas show, with whoever is standing in them.
export function drawCameraFeed(g, w, h, { view, t = 0, dpr = 1 }) {
  const s = Math.min(w / WORLD.w, h / WORLD.h);
  const ox = (w - WORLD.w * s) / 2, oy = (h - WORLD.h * s) / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#03050C'; g.fillRect(0, 0, w, h);
  g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  g.globalAlpha = 0.3; drawFloor(g); g.globalAlpha = 1;
  const roster = new Map(view.roster.map((p) => [p.id, p]));
  const inCam = (p) => CAMERAS.some((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
  for (const c of CAMERAS) {
    g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); drawFloor(g); g.restore();
    g.strokeStyle = '#4ADE80'; g.lineWidth = 3; g.strokeRect(c.x, c.y, c.w, c.h);
    g.fillStyle = '#4ADE80'; g.font = `700 16px ${FONT}`; g.fillText(c.name.toUpperCase(), c.x + 8, c.y + 22);
  }
  if (Math.floor(t / 600) % 2 === 0) { g.fillStyle = '#FF3D5A'; g.beginPath(); g.arc(WORLD.w - 40, 40, 11, 0, 7); g.fill(); }
  for (const b of view.bodies || []) if (inCam(b)) drawBody(g, b);
  for (const p of view.players) {
    const info = roster.get(p.id);
    if (!info || !p.alive || p.id === view.me?.id || !inCam(p)) continue;
    drawRobot(g, p.x, p.y + 14, { hex: colorHex(info.color), hat: info.hat, facing: p.facing, frame: p.moving ? Math.floor(t / 150) % 2 : 0, name: info.name, t, moving: p.moving });
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function taskDef(id) { return TASKS.find((t) => t.id === id); }
function taskNum(id) { return TASKS.find((t) => t.id === id)?.num; }
export { ROOMS, SABOTAGE_FIX };
