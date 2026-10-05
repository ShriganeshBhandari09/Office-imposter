// The designer's task and sabotage object icons (client/public/task-icons). The clean map art leaves them out,
// so they are drawn on top of it: every icon in its normal look, and your own unfinished tasks in the glowing
// "highlight" look. Positions and sizes come from the design map, scaled into world units.
import { WORLD, MAP_SCALE } from './shared/map.js';
import ICONS from './shared/task-icons.data.js';
import PLANTS from './shared/plants.data.js';

const BASE = `${import.meta.env.BASE_URL || '/'}task-icons/`;
const PAD = 4, PAD_HI = 10; // padding baked into the PNGs, in map px
const ROTATE = { n: 0, s: Math.PI, w: -Math.PI / 2, e: Math.PI / 2 }; // the art has the wall along its top edge

const entries = ICONS.map((i) => ({ ...i, img: null, hi: null }));
// Potted plants, in world units. They are drawn from the side, so the game sorts them in with the players by
// their pot base (y): a player standing behind a plant is hidden by it.
export const plants = PLANTS.map((p) => ({
  ...p, img: null, x: p.x * MAP_SCALE, y: p.y * MAP_SCALE, w: p.w * MAP_SCALE, h: p.h * MAP_SCALE,
}));
// A task whose object is a plant (Water the plant) shows the plant instead of its flat icon, and glows around it.
const taskPlant = new Map(plants.filter((p) => p.task).map((p) => [p.task, p]));
let loading = null;
let layer = null;

const load = (file) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = BASE + file;
});

// Starts loading every icon (once); resolves when they are all in.
export function loadIcons() {
  if (!loading) {
    loading = Promise.all([
      ...entries.map(async (e) => { e.img = await load(e.file); e.hi = await load(e.highlight); }),
      ...plants.map(async (p) => { p.img = await load(p.file); }),
    ]);
  }
  return loading;
}

function drawOne(g, img, spot, w, h, pad) {
  const S = MAP_SCALE;
  g.save();
  g.translate(spot.x * S, spot.y * S);
  g.rotate(ROTATE[spot.wall] || 0);
  const dw = (w + pad * 2) * S, dh = (h + pad * 2) * S;
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  g.restore();
}

// All icons in their normal look, on one transparent canvas drawn once.
function build() {
  const SCALE = 2;
  const c = document.createElement('canvas');
  c.width = WORLD.w * SCALE; c.height = WORLD.h * SCALE;
  const g = c.getContext('2d');
  g.scale(SCALE, SCALE);
  g.imageSmoothingQuality = 'high';
  for (const e of entries) if (e.img && !(e.kind === 'task' && taskPlant.has(e.key))) for (const s of e.spots) drawOne(g, e.img, s, e.w, e.h, PAD);
  return c;
}

export function drawObjects(g) {
  if (!layer) {
    if (!entries.every((e) => e.img)) return; // still loading
    layer = build();
  }
  g.drawImage(layer, 0, 0, WORLD.w, WORLD.h);
}

// The glowing look: `taskNums` are your unfinished task numbers, `devices` the letters of a live sabotage (L, C, W).
export function drawHighlights(g, taskNums, devices, t = 0) {
  const pulse = 0.7 + 0.3 * Math.sin(t / 260);
  g.save();
  g.globalAlpha = pulse;
  for (const e of entries) {
    const on = e.kind === 'task' ? taskNums.has(e.key) : devices.has(e.key);
    if (!on) continue;
    const plant = e.kind === 'task' && taskPlant.get(e.key);
    if (plant) drawPlantGlow(g, plant);
    else if (e.hi) for (const s of e.spots) drawOne(g, e.hi, s, e.w, e.h, PAD_HI);
  }
  g.restore();
}

export function drawPlant(g, p) {
  if (p.img) g.drawImage(p.img, p.x - p.w / 2, p.y - p.h, p.w, p.h);
}

// Every plant at once, for views without players (the map screen).
export function drawPlants(g) {
  for (const p of plants) drawPlant(g, p);
}

// The task glow for a plant: the design's yellow highlight, as a soft halo around the plant's outline.
function drawPlantGlow(g, p) {
  if (!p.img) return;
  g.save();
  g.shadowColor = '#FFC83D';
  for (const blur of [4, 14]) { g.shadowBlur = blur; drawPlant(g, p); }
  g.restore();
}
