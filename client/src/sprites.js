// Original pixel-art office worker. Each character is 12x15 "pixels",
// drawn at SCALE. Letters map to colours; C/D take the player's shirt colour.
export const SCALE = 3;

const STAND = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SSSSESES..',
  '..SSSSSSSS..',
  '...SSMMSS...',
  '..CCCCCCCC..',
  '.CCCBCCCCCC.',
  '.CCCBCCCCCC.',
  '.SCCCCCCCCS.',
  '..DDDDDDDD..',
  '..PPPPPPPP..',
  '..PPP..PPP..',
  '..PPP..PPP..',
  '..KKK..KKK..',
];
const WALK = [
  ...STAND.slice(0, 12),
  '.PPP....PPP.',
  '.PP......PP.',
  '.KK......KK.',
];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function palette(shirt) {
  return {
    H: '#3b2a20', S: '#e8b98a', E: '#1b1b1b', M: '#c98b6b',
    C: shirt, D: shade(shirt, 0.72), B: '#f5f5f5', P: '#2e3440', K: '#15181d',
  };
}

const cache = new Map();

// Returns an offscreen canvas for a colour + frame + facing.
export function sprite(hex, frame = 0, facing = 1) {
  const key = `${hex}|${frame}|${facing}`;
  if (cache.has(key)) return cache.get(key);
  const rows = frame ? WALK : STAND;
  const pal = palette(hex);
  const c = document.createElement('canvas');
  c.width = 12 * SCALE;
  c.height = rows.length * SCALE;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = pal[ch];
      const px = facing === 1 ? x : 11 - x;
      g.fillRect(px * SCALE, y * SCALE, SCALE, SCALE);
    });
  });
  cache.set(key, c);
  return c;
}

export const SPRITE_W = 12 * SCALE;
export const SPRITE_H = 15 * SCALE;
