// The office floor-plan art. It is drawn behind the game, in the lobby backdrop and on the map screen.
export const MAP_ART_URL = `${import.meta.env.BASE_URL || '/'}map/office-map-clean.png`;

import { loadIcons } from './taskIcons.js';

let mapImg = null;
let mapPromise = null;

export const mapImage = () => mapImg;
export const mapIsReady = () => !!mapImg && mapImg.complete && mapImg.naturalWidth > 0;

// Starts loading the map art and the task icons (once) and resolves when they are ready to draw.
export function loadMap() {
  if (!mapPromise) {
    const art = new Promise((resolve) => {
      mapImg = new Image();
      mapImg.onload = () => resolve(true);
      mapImg.onerror = () => resolve(false);
      mapImg.src = MAP_ART_URL;
    });
    mapPromise = Promise.all([art, loadIcons()]).then(([ok]) => ok);
  }
  return mapPromise;
}
