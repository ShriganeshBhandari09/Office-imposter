import { io } from 'socket.io-client';

// Same origin as the page: the Node server serves both the app and the socket.
export const socket = io({ transports: ['websocket', 'polling'] });

function storage() {
  try { return window.localStorage; } catch { return null; }
}

// A stable id per browser, so a refresh or Wi-Fi blip rejoins as the same player.
export function getPid() {
  const s = storage();
  let pid = null;
  try { pid = s?.getItem('oi_pid'); } catch { /* storage blocked */ }
  if (!pid) {
    pid = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { s?.setItem('oi_pid', pid); } catch { /* storage blocked */ }
  }
  return pid;
}

export function savedName() {
  try { return storage()?.getItem('oi_name') || ''; } catch { return ''; }
}
export function saveName(name) {
  try { storage()?.setItem('oi_name', name); } catch { /* ignore */ }
}

export function emit(event, data) {
  return new Promise((resolve) => socket.emit(event, data, (res) => resolve(res || {})));
}

// The room this device was last in, so a refresh or dropped connection rejoins it.
export function savedRoom() {
  try { return storage()?.getItem('oi_room') || ''; } catch { return ''; }
}
export function saveRoom(code) {
  try { if (code) storage()?.setItem('oi_room', code); else storage()?.removeItem('oi_room'); } catch { /* ignore */ }
}

// The look this device last picked, so the next game starts with it.
export function savedLook() {
  try {
    const l = JSON.parse(storage()?.getItem('oi_look') || '{}');
    return { color: typeof l.color === 'string' ? l.color : '', hat: typeof l.hat === 'string' ? l.hat : 'none' };
  } catch { return { color: '', hat: 'none' }; }
}
export function saveLook(look) {
  try { storage()?.setItem('oi_look', JSON.stringify(look)); } catch { /* ignore */ }
}

// The rules the host last used, so hosting a new room (after "Back to title") keeps them instead of resetting.
export function savedSettings() {
  try { const s = JSON.parse(storage()?.getItem('oi_settings') || 'null'); return s && typeof s === 'object' ? s : null; } catch { return null; }
}
export function saveSettings(settings) {
  try { storage()?.setItem('oi_settings', JSON.stringify(settings)); } catch { /* ignore */ }
}

// Sound levels (0-100) for the pause menu.
export function savedSound() {
  try {
    const s = JSON.parse(storage()?.getItem('oi_sound') || '{}');
    return { master: 80, music: 45, effects: 70, ...s };
  } catch { return { master: 80, music: 45, effects: 70 }; }
}
export function saveSound(s) {
  try { storage()?.setItem('oi_sound', JSON.stringify(s)); } catch { /* ignore */ }
}
