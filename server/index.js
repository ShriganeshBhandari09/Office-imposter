import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Game } from './game.js';
import { MAX_PLAYERS } from '../client/src/shared/map.js';

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 50; // 20 updates per second
const MAX_ROOMS = 200;
const EMPTY_ROOM_MS = 10 * 60 * 1000; // rooms with nobody connected are removed after 10 minutes

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });

// Health check for the hosting platform.
app.get('/healthz', (_req, res) => res.send('ok'));

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
} else {
  app.get('/', (_req, res) => res.send('Client not built yet. Run "npm run build" first (or use "npm run play").'));
}

// ---------- Rooms ----------

// code -> { game, emptySince }
const rooms = new Map();
// socket.id -> { pid, code }. The pid is a token kept on the device, so a refresh
// or a Wi-Fi blip rejoins the same player.
const sockets = new Map();

// No 0/O or 1/I, so codes are easy to read out loud.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanPid = (p) => String(p || '').slice(0, 64);
const cleanRoomName = (room, host) => String(room || '').trim().slice(0, 24) || `${String(host || 'Office').trim().slice(0, 14)}'s office`;

// Removes a player's socket from its current room (if any).
function leaveCurrent(socket) {
  const info = sockets.get(socket.id);
  if (!info) return;
  sockets.delete(socket.id);
  socket.leave(info.code);
  const room = rooms.get(info.code);
  // Only mark the player gone if no other tab is using the same id in that room.
  const stillHere = [...sockets.values()].some((s) => s.pid === info.pid && s.code === info.code);
  if (room && !stillHere) room.game.leave(info.pid);
}

function enterRoom(socket, code, pid, name, color, hat) {
  const room = rooms.get(code);
  if (!room) return { error: `No game found with code ${code}. Check the code with the host.` };
  const current = sockets.get(socket.id);
  if (current && (current.code !== code || current.pid !== pid)) leaveCurrent(socket);
  const res = room.game.join(pid, name, color, hat);
  if (!res.ok) return res;
  sockets.set(socket.id, { pid, code });
  socket.join(code);
  room.emptySince = 0;
  return { ok: true, code };
}

io.on('connection', (socket) => {
  const info = () => sockets.get(socket.id);
  const game = () => rooms.get(info()?.code)?.game;
  const reply = (cb, res) => typeof cb === 'function' && cb(res || { ok: true });
  // Routes a game action to the sender's room.
  const on = (event, fn) => socket.on(event, (...args) => {
    const g = game();
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    if (!g) return reply(cb, { error: 'You are not in a game.' });
    fn(g, info().pid, ...args);
  });

  socket.on('createRoom', ({ pid, name, color, hat, roomName } = {}, cb) => {
    pid = cleanPid(pid);
    if (!pid) return reply(cb, { error: 'Missing player id.' });
    if (!String(name || '').trim()) return reply(cb, { error: 'Enter a name first.' });
    if (rooms.size >= MAX_ROOMS) return reply(cb, { error: 'The server is busy. Try again in a few minutes.' });
    const code = newCode();
    rooms.set(code, { game: new Game(cleanRoomName(roomName, name)), emptySince: 0 });
    const res = enterRoom(socket, code, pid, name, color, hat);
    if (!res.ok) rooms.delete(code);
    reply(cb, res);
  });

  socket.on('join', ({ pid, name, color, hat, code } = {}, cb) => {
    pid = cleanPid(pid);
    code = cleanCode(code);
    if (!pid) return reply(cb, { error: 'Missing player id.' });
    if (!code) return reply(cb, { error: 'Enter the room code.' });
    reply(cb, enterRoom(socket, code, pid, name, color, hat));
  });

  socket.on('leaveRoom', (_d, cb) => { leaveCurrent(socket); reply(cb); });

  // "Games on this Wi-Fi": every open lobby that still has a free seat.
  socket.on('listRooms', (_d, cb) => {
    const list = [];
    for (const [code, room] of rooms) {
      const g = room.game;
      if (g.phase !== 'lobby' || g.isEmpty() || g.players.size >= MAX_PLAYERS) continue;
      list.push({ code, name: g.roomName, players: g.players.size, max: MAX_PLAYERS });
    }
    reply(cb, { ok: true, rooms: list.slice(0, 12) });
  });

  on('setName', (g, pid, name, cb) => reply(cb, g.setName(pid, name)));
  on('setColor', (g, pid, color) => g.setColor(pid, color));
  on('setHat', (g, pid, hat) => g.setHat(pid, hat));
  on('active', (g, pid) => g.touch(pid));
  on('settings', (g, pid, s) => g.updateSettings(pid, s || {}));
  on('start', (g, pid, _d, cb) => reply(cb, g.start(pid)));
  on('backToLobby', (g, pid) => g.backToLobby(pid));
  on('addBot', (g, pid, _d, cb) => reply(cb, g.addBot(pid)));
  on('removeBot', (g, pid, id) => g.removeBot(pid, id));
  on('move', (g, pid, d) => g.move(pid, d || {}));
  on('completeTask', (g, pid, id) => g.completeTask(pid, id));
  on('kill', (g, pid, id) => g.kill(pid, id));
  on('report', (g, pid, id) => g.report(pid, id));
  on('emergency', (g, pid, _d, cb) => reply(cb, g.emergency(pid)));
  on('vent', (g, pid, action) => g.vent(pid, action));
  on('sabotage', (g, pid, { type, room } = {}, cb) => reply(cb, g.sabotageAction(pid, type, room)));
  on('fixSabotage', (g, pid, id) => g.fixSabotage(pid, id));
  on('wifiHold', (g, pid, { id, holding } = {}) => g.wifiHold(pid, id, holding));
  on('vote', (g, pid, target) => g.vote(pid, target));
  on('chat', (g, pid, text) => g.chat(pid, text));

  socket.on('disconnect', () => leaveCurrent(socket));
});

setInterval(() => {
  const t = Date.now();
  for (const [code, room] of rooms) {
    room.game.tick();
    if (room.game.isEmpty()) {
      if (!room.emptySince) room.emptySince = t;
      else if (t - room.emptySince > EMPTY_ROOM_MS) { rooms.delete(code); continue; }
    }
  }
  for (const [sid, { pid, code }] of sockets) {
    const room = rooms.get(code);
    if (room) io.to(sid).emit('state', { ...room.game.viewFor(pid), code });
  }
}, TICK_MS);

http.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log('\n  Office Impostor server is running.\n');
  console.log(`  On this laptop:   http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  On office Wi-Fi:  http://${ip}:${PORT}`);
  console.log('\n  Share the link, create a game and send your friends the room code.\n');
});
