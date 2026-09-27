import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Game } from './game.js';

const PORT = Number(process.env.PORT) || 3000;
const TICK_MS = 50; // 20 updates per second

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
const game = new Game();

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
} else {
  app.get('/', (_req, res) => res.send('Client not built yet. Run "npm run build" first (or use "npm run play").'));
}

// socket.id -> player id (a token kept in the browser, so a refresh or a Wi-Fi blip rejoins the same player)
const socketPid = new Map();

io.on('connection', (socket) => {
  const pidOf = () => socketPid.get(socket.id);
  const reply = (cb, res) => typeof cb === 'function' && cb(res || { ok: true });

  socket.on('join', ({ pid, name, color } = {}, cb) => {
    pid = String(pid || '').slice(0, 64);
    if (!pid) return reply(cb, { error: 'Missing player id.' });
    const res = game.join(pid, name, color);
    if (res.ok) socketPid.set(socket.id, pid);
    reply(cb, res);
  });

  socket.on('setColor', (color) => game.setColor(pidOf(), color));
  socket.on('settings', (s) => game.updateSettings(pidOf(), s || {}));
  socket.on('start', (_d, cb) => reply(cb, game.start(pidOf())));
  socket.on('backToLobby', () => game.backToLobby(pidOf()));
  socket.on('move', (d) => game.move(pidOf(), d || {}));
  socket.on('completeTask', (id) => game.completeTask(pidOf(), id));
  socket.on('kill', (id) => game.kill(pidOf(), id));
  socket.on('report', (id) => game.report(pidOf(), id));
  socket.on('emergency', (_d, cb) => reply(cb, game.emergency(pidOf())));
  socket.on('vent', (action) => game.vent(pidOf(), action));
  socket.on('sabotage', ({ type, room } = {}, cb) => reply(cb, game.sabotageAction(pidOf(), type, room)));
  socket.on('fixSabotage', (id) => game.fixSabotage(pidOf(), id));
  socket.on('wifiHold', ({ id, holding } = {}) => game.wifiHold(pidOf(), id, holding));
  socket.on('vote', (target) => game.vote(pidOf(), target));
  socket.on('chat', (text) => game.chat(pidOf(), text));

  socket.on('disconnect', () => {
    const pid = pidOf();
    socketPid.delete(socket.id);
    // Only mark the player gone if no other tab is using the same id.
    if (pid && ![...socketPid.values()].includes(pid)) game.leave(pid);
  });
});

setInterval(() => {
  game.tick();
  for (const [sid, pid] of socketPid) {
    io.to(sid).emit('state', game.viewFor(pid));
  }
  // Sockets that have not joined yet still see the lobby roster.
  const lobbyView = game.viewFor(null);
  for (const [sid, socket] of io.sockets.sockets) {
    if (!socketPid.has(sid)) socket.emit('state', lobbyView);
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
  console.log('\n  Share the Wi-Fi link with everyone playing.\n');
});
