// Checks bot behaviour: memory of the last 3 games, and bots that finished their tasks keep moving. Run: node map/bots-test.mjs
import { Game } from '../server/game.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL:', m); } else console.log('ok:  ', m); };
let fake = Date.now(); Date.now = () => fake;

function newGame() {
  let g;
  do {
    g = new Game('T'); g.join('host', 'Host', 'cyan', 'none');
    for (let i = 0; i < 5; i++) g.addBot('host');
    g.updateSettings('host', { impostors: 1, tasksPerPlayer: 3, killCooldown: 60 });
    g.start('host');
  } while (g.players.get('host').role !== 'crew'); // the human stays crew and never finishes, so the round keeps going
  g.roleRevealUntil = 0;
  for (const q of g.players.values()) if (q.role === 'impostor') q.killCdUntil = Infinity;
  return g;
}
const step = (g, n) => { for (let i = 0; i < n; i++) { fake += 50; g.tick(); } };

// ---- Memory of the last 3 games ----
{
  const g = newGame();
  const imps = () => [...g.players.values()].filter((p) => p.role === 'impostor').map((p) => p.id);
  const first = imps();
  g.endGame('crew', 'test');
  ok(g.history.length === 1 && g.history[0].impostors[0] === first[0], 'the room remembers who the impostor was');
  for (let i = 0; i < 4; i++) { g.endGame('crew', 'test'); }
  ok(g.history.length === 3, 'only the last 3 games are kept');
  // A new round: bots start out slightly suspicious of whoever was an impostor before.
  g.backToLobby('host'); g.start('host'); g.roleRevealUntil = 0;
  step(g, 3);
  const bot = [...g.players.values()].find((p) => p.bot && p.role === 'crew' && p.brain);
  const prev = g.history[g.history.length - 1].impostors[0];
  ok(bot && (bot.brain.sus[prev] || 0) > 0 || bot?.id === prev, 'a bot starts a new game suspicious of the earlier impostor');
  const w = (id) => bot.brain.sus[id] || 0;
  g.history = [{ impostors: ['a'] }, { impostors: ['b'] }, { impostors: ['c'] }];
  bot.brain = null; step(g, 1);
  ok(w('c') > w('b') && w('b') > w('a') && w('a') > 0, 'the latest game counts most, the oldest least');
}

// ---- Bots keep moving after their tasks are done ----
{
  const g = newGame();
  const bots = [...g.players.values()].filter((p) => p.bot && p.role === 'crew');
  const st = new Map(bots.map((b) => [b.id, { x: b.x, y: b.y, doneAt: null, idle: 0, total: 0 }]));
  for (let i = 0; i < 8000; i++) {
    step(g, 1);
    for (const b of bots) {
      const s = st.get(b.id); const moved = Math.hypot(b.x - s.x, b.y - s.y) > 0.01; s.x = b.x; s.y = b.y;
      const free = b.tasks.every((t) => t.done) && !g.sabotage; // sabotage fixing is its own job
      if (free) { s.total += 0.05; if (!moved) s.idle += 0.05; }
    }
  }
  for (const b of bots) {
    const s = st.get(b.id);
    ok(s.total > 100 && s.idle / s.total < 0.2, `${b.name} keeps walking after finishing (idle ${(100 * s.idle / s.total).toFixed(0)}% of ${Math.round(s.total)}s)`);
  }
}

console.log(failed ? `\n${failed} bot check(s) failed.` : '\nAll bot checks passed.');
process.exit(failed ? 1 : 0);
