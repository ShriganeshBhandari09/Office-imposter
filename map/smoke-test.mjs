import { Game } from '../server/game.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const game = new Game();
const hostRes = game.join('host1', 'Host', 'red');
if (hostRes.error) throw new Error(hostRes.error);

for (let i = 0; i < 7; i++) {
  const r = game.addBot(game.hostId);
  if (r.error) throw new Error('addBot failed: ' + r.error);
}
console.log('Players in lobby:', game.players.size);

const startRes = game.start(game.hostId);
if (startRes.error) throw new Error('start failed: ' + startRes.error);
console.log('Game started.');
console.log('Roles:', [...game.players.values()].map((p) => `${p.name}:${p.role}`).join(', '));

let sabotagesSeen = new Set();
let meetingsSeen = 0;
let lastPhase = game.phase;
let maxTaskProgress = 0;
const movedAtLeastOnce = new Set();
const startPos = new Map([...game.players.values()].map((p) => [p.id, { x: p.x, y: p.y }]));

const RUN_MS = 25000; // 25 real seconds
const started = Date.now();
while (Date.now() - started < RUN_MS) {
  game.tick();
  if (game.phase !== lastPhase) {
    console.log(`[+${((Date.now() - started) / 1000).toFixed(1)}s] phase: ${lastPhase} -> ${game.phase}`);
    lastPhase = game.phase;
    if (game.phase === 'meeting') meetingsSeen++;
  }
  if (game.sabotage) sabotagesSeen.add(game.sabotage.type);
  maxTaskProgress = Math.max(maxTaskProgress, game.taskProgress());
  for (const p of game.players.values()) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error(`${p.name} has invalid position ${p.x},${p.y}`);
    if (p.x < 0 || p.y < 0 || p.x > 1000 || p.y > 840) throw new Error(`${p.name} left world bounds: ${p.x},${p.y}`);
    const s = startPos.get(p.id);
    if (Math.hypot(p.x - s.x, p.y - s.y) > 5) movedAtLeastOnce.add(p.id);
  }
  if (game.phase === 'ended') { console.log('Game ended:', game.result); break; }
  await sleep(50);
}

console.log('\n--- Summary ---');
console.log('Bots that moved from their spawn point:', movedAtLeastOnce.size, '/', game.players.size);
console.log('Max task progress reached:', (maxTaskProgress * 100).toFixed(1) + '%');
console.log('Sabotage types triggered:', [...sabotagesSeen].join(', ') || '(none)');
console.log('Meetings called:', meetingsSeen);
console.log('Final phase:', game.phase);
console.log('\nSmoke test finished without throwing.');
