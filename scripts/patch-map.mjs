// One-off edit of the map art: removes the green two-stool unit that stood in the hallway between the Toilets
// and the Lobby (it also has no collision any more, see FURNITURE in shared/map.js).
// Source: design-reference/office-map-clean2x.png  ->  client/public/map/office-map-clean.png
import fs from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const img = decodePng(fs.readFileSync(new URL('../design-reference/office-map-clean2x.png', import.meta.url)));
const { width, px, bpp } = img;
// The art is 2 px per map px. The unit sits at map x 228-252, y 262-322; patch a little beyond it with floor
// copied from the same rows 40 map px to the left (the floor shading only changes from row to row).
const X0 = 436, X1 = 524, Y0 = 520, Y1 = 652, SHIFT = 80;
for (let y = Y0; y < Y1; y++) {
  for (let x = X0; x < X1; x++) {
    const from = (y * width + (x - SHIFT)) * bpp, to = (y * width + x) * bpp;
    for (let c = 0; c < bpp; c++) px[to + c] = px[from + c];
  }
}
fs.writeFileSync(new URL('../client/public/map/office-map-clean.png', import.meta.url), encodePng(img));
console.log('patched map art written');
