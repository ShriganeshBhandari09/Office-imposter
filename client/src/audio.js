// Synthesised sound (no audio files): short effects plus a quiet ambient pad.
// Volumes (0-100) come from the pause menu: master * effects for sounds, master * music for the pad.
import { savedSound } from './net.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, padNodes = null;
let vols = savedSound();

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  apply();
  return ctx;
}

function apply() {
  if (!ctx) return;
  master.gain.value = (vols.master / 100) ** 2;
  sfxBus.gain.value = (vols.effects / 100) ** 2 * 0.5;
  musicBus.gain.value = (vols.music / 100) ** 2 * 0.18;
}

export function setVolumes(v) { vols = { ...vols, ...v }; apply(); }

// Browsers only start audio after a tap or key press.
export function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }

// One note: frequency (optionally gliding to `to`), length, wave, loudness, start delay.
function tone(freq, dur, { type = 'sine', vol = 0.6, delay = 0, to } = {}) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxBus);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  click: () => tone(640, 0.05, { type: 'triangle', vol: 0.4 }),
  task: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.08 })),
  vote: () => tone(440, 0.1, { type: 'square', vol: 0.3 }),
  reveal: () => { tone(110, 1.2, { type: 'sawtooth', vol: 0.5, to: 220 }); tone(165, 1.2, { type: 'sine', vol: 0.5 }); },
  kill: () => { tone(160, 0.45, { type: 'sawtooth', vol: 0.7, to: 40 }); tone(900, 0.12, { type: 'square', vol: 0.4, to: 200 }); },
  report: () => [0, 0.28, 0.56].forEach((d) => { tone(880, 0.22, { type: 'square', vol: 0.45, delay: d }); tone(660, 0.22, { type: 'square', vol: 0.45, delay: d + 0.14 }); }),
  meeting: () => { tone(90, 0.35, { type: 'sine', vol: 0.8, to: 50 }); tone(440, 0.5, { type: 'triangle', delay: 0.1 }); },
  eject: () => tone(520, 1.4, { type: 'sawtooth', vol: 0.4, to: 70 }),
  alarm: () => [0, 0.5, 1.0].forEach((d) => { tone(740, 0.25, { type: 'square', vol: 0.4, delay: d, to: 520 }); tone(520, 0.25, { type: 'square', vol: 0.4, delay: d + 0.25, to: 740 }); }),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', delay: i * 0.13 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, { type: 'sawtooth', vol: 0.4, delay: i * 0.2 })),
};
export function sfx(name) { SOUNDS[name]?.(); }

// A slow, quiet two-note pad for the lobby and the game.
export function music(on) {
  const c = ensure(); if (!c) return;
  if (!on) { padNodes?.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); padNodes = null; return; }
  if (padNodes) return;
  const lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 0.12; lg.gain.value = 0.3; lfo.connect(lg);
  const pad = c.createGain(); pad.gain.value = 0.5; lg.connect(pad.gain); pad.connect(musicBus);
  const notes = [110, 164.81, 220.5].map((f) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(pad); o.start(); return o; });
  lfo.start();
  padNodes = [...notes, lfo];
}
