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
