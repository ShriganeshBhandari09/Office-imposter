// The player robot (see impostor-foundation/components/Avatar): a monitor head with a visor and two
// glowing eyes, a body with an ID badge, arms and legs. One SVG generator feeds both the UI (<img>)
// and the game canvas (cached images), so the robot looks the same everywhere.
//
//   robotSvg({ hex, hat, state, eyes, facing, frame })
//     hex    body colour, e.g. '#29D3E6'
//     hat    'none' | 'cap' | 'headset' | 'hardhat' | 'beanie'
//     state  'alive' | 'ghost' | 'body'
//     eyes   eye colour; red for an impostor's own view
//     facing 1 or -1 (flips horizontally)
//     frame  0 or 1, the two steps of the walk cycle
import { COLORS } from './shared/map.js';

export const OUTLINE = '#0A0F1E';
export const EYE = '#7CF3FF';
export const EYE_IMPOSTOR = '#FF3D5A';
const BADGE = '#F3F5FF';

// Colour at a fraction of its brightness (the darker "trim").
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * amt)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex || '#8E9BC2';

const SW = 3.5; // outline width

function hatSvg(hat, hex) {
  const o = `stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"`;
  switch (hat) {
    case 'cap':
      return `<path d="M17 24 Q18 2 50 2 Q82 2 83 24 Z" fill="#E5484D" ${o}/>`
        + `<rect x="64" y="19" width="32" height="7" rx="3.5" fill="#C23A3F" ${o}/>`;
    case 'headset':
      return `<path d="M20 40 A30 34 0 0 1 80 40" fill="none" stroke="${OUTLINE}" stroke-width="9" stroke-linecap="round"/>`
        + `<path d="M20 40 A30 34 0 0 1 80 40" fill="none" stroke="#3D4668" stroke-width="4" stroke-linecap="round"/>`
        + `<rect x="6" y="28" width="11" height="24" rx="4.5" fill="#3D4668" ${o}/>`
        + `<rect x="83" y="28" width="11" height="24" rx="4.5" fill="#3D4668" ${o}/>`
        + `<circle cx="22" cy="60" r="3.2" fill="#FF7A3D" stroke="${OUTLINE}" stroke-width="1.5"/>`;
    case 'hardhat':
      return `<path d="M19 24 Q20 0 50 0 Q80 0 81 24 Z" fill="#F5C242" ${o}/>`
        + `<rect x="45" y="1" width="10" height="22" fill="#D9A21B"/>`
        + `<rect x="11" y="21" width="78" height="7" rx="3.5" fill="#F5C242" ${o}/>`;
    case 'beanie':
      return `<path d="M21 22 Q22 -2 50 -2 Q78 -2 79 22 Z" fill="#8E4EC6" ${o}/>`
        + `<rect x="17" y="18" width="66" height="9" rx="4.5" fill="#A86CE0" ${o}/>`
        + `<circle cx="50" cy="-4" r="4.5" fill="#F3F5FF" ${o}/>`;
    default: // antenna
      return `<line x1="50" y1="16" x2="50" y2="7" stroke="${OUTLINE}" stroke-width="${SW + 2}" stroke-linecap="round"/>`
        + `<line x1="50" y1="16" x2="50" y2="7" stroke="${shade(hex, 0.72)}" stroke-width="2.2" stroke-linecap="round"/>`
        + `<circle cx="50" cy="5" r="5" fill="${lighten(hex, 0.45)}" ${o}/>`;
  }
}

export function robotSvg({ hex = '#29D3E6', hat = 'none', state = 'alive', eyes = EYE, facing = 1, frame = 0 } = {}) {
  const trim = shade(hex, 0.72);
  const o = `stroke="${OUTLINE}" stroke-width="${SW}" stroke-linejoin="round"`;
  const ghost = state === 'ghost';
  const dead = state === 'body';
  const eyeFill = dead ? OUTLINE : eyes;

  // Legs swing a little between the two walk frames. Ghosts have a wavy tail instead.
  const legA = frame ? { y: 93, h: 17 } : { y: 97, h: 19 };
  const legB = frame ? { y: 97, h: 19 } : { y: 97, h: 19 };
  const legs = ghost
    ? `<path d="M24 96 Q24 112 33 108 Q41 104 50 112 Q59 104 67 108 Q76 112 76 96 Z" fill="${shade(hex, 0.85)}" ${o}/>`
    : `<rect x="31" y="${legA.y}" width="14" height="${legA.h}" rx="5" fill="${trim}" ${o}/>`
      + `<rect x="55" y="${legB.y}" width="14" height="${legB.h}" rx="5" fill="${trim}" ${o}/>`;

  const eyeMarks = dead
    ? `<path d="M31 31 L41 43 M41 31 L31 43 M59 31 L69 43 M69 31 L59 43" stroke="${EYE_IMPOSTOR}" stroke-width="4.5" stroke-linecap="round"/>`
    : `<rect x="31" y="30" width="11" height="14" rx="3.5" fill="${eyeFill}"/><rect x="58" y="30" width="11" height="14" rx="3.5" fill="${eyeFill}"/>`
      + '<rect x="33" y="32" width="4" height="4" rx="1" fill="#fff" opacity=".85"/><rect x="60" y="32" width="4" height="4" rx="1" fill="#fff" opacity=".85"/>';

  const figure = `
    ${legs}
    <rect x="10" y="66" width="13" height="27" rx="6.5" fill="${trim}" ${o}/>
    <rect x="77" y="66" width="13" height="27" rx="6.5" fill="${trim}" ${o}/>
    <rect x="42" y="55" width="16" height="9" fill="${trim}" ${o}/>
    <rect x="24" y="60" width="52" height="44" rx="20" fill="${hex}" ${o}/>
    <rect x="30" y="68" width="8" height="22" rx="4" fill="#fff" opacity=".22"/>
    <path d="M40 62 L50 80 L60 62" fill="none" stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="41" y="78" width="18" height="19" rx="3.5" fill="${BADGE}" stroke="${OUTLINE}" stroke-width="2.5"/>
    <rect x="44" y="82" width="12" height="3.5" rx="1.5" fill="${trim}"/>
    <rect x="44" y="88" width="9" height="2.5" rx="1.2" fill="#A9B2D0"/>
    <rect x="14" y="14" width="72" height="46" rx="16" fill="${hex}" ${o}/>
    <rect x="22" y="22" width="56" height="30" rx="11" fill="${OUTLINE}"/>
    ${eyeMarks}
    ${hatSvg(hat, hex)}`;

  const flip = facing === -1 ? 'translate(100 0) scale(-1 1)' : '';
  if (dead) {
    // Lying on its side: rotate the figure a quarter turn about its middle.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 18 116 84" width="116" height="84">`
      + `<g transform="${flip ? `${flip} ` : ''}rotate(90 50 60)">${figure}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 100 128" width="100" height="128">`
    + `<g ${flip ? `transform="${flip}"` : ''}${ghost ? ' opacity=".5"' : ''}>${figure}</g></svg>`;
}

const urls = new Map();
// data: URL for <img src>; cached per look.
export function robotURL(opts = {}) {
  const key = JSON.stringify([opts.hex, opts.hat, opts.state, opts.eyes, opts.facing, opts.frame]);
  let u = urls.get(key);
  if (!u) { u = `data:image/svg+xml;utf8,${encodeURIComponent(robotSvg(opts))}`; urls.set(key, u); }
  return u;
}

const imgs = new Map();
// Cached <img> for canvas drawing. It loads asynchronously, so check isReady() before drawing.
export function robotImage(opts = {}) {
  const url = robotURL(opts);
  let img = imgs.get(url);
  if (!img) { img = new Image(); img.src = url; imgs.set(url, img); }
  return img;
}
export const isReady = (img) => img.complete && img.naturalWidth > 0;

// Drawing size ratio for the canvas: alive and ghost are 100x128 units, bodies are 116x84.
export const ROBOT_ASPECT = 128 / 100;
export const BODY_ASPECT = 84 / 116;
