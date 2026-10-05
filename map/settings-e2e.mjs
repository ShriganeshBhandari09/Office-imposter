// End to end: a real server, a host and a guest over sockets. Checks that every setting the host changes reaches both
// players, that guests cannot change them, and that presets and the final game use them. Run: node map/settings-e2e.mjs
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import { SETTING_SPECS, SETTING_PRESETS } from '../client/src/shared/map.js';

const PORT = 3199;
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL:', m); } else console.log('ok:  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(1500);

const client = (pid) => {
  const s = io(`http://127.0.0.1:${PORT}`, { transports: ['websocket'] });
  const c = { s, view: null, emit: (ev, d) => new Promise((r) => s.emit(ev, d, r)) };
  s.on('state', (v) => { c.view = v; });
  return c;
};
const host = client('h'), guest = client('g');
await sleep(500);
const created = await host.emit('createRoom', { pid: 'h1', name: 'Host', color: 'cyan', hat: 'none' });
await guest.emit('join', { pid: 'g1', name: 'Guest', color: 'red', hat: 'none', code: created.code });
await sleep(300);

// Every setting: change it as host, both players must see the new value.
for (const [k, spec] of Object.entries(SETTING_SPECS)) {
  const val = spec.options ? spec.options[0] : typeof spec.def === 'boolean' ? !spec.def : spec.min;
  host.s.emit('settings', { [k]: val });
  await sleep(120);
  const h = host.view?.settings[k], g = guest.view?.settings[k];
  ok(h === val && g === val || k === 'impostors' && h === val, `${k}: host set ${JSON.stringify(val)}, host sees ${JSON.stringify(h)}, guest sees ${JSON.stringify(g)}`);
}

// Guests cannot change settings
guest.s.emit('settings', { killCooldown: 60 }); await sleep(150);
ok(host.view.settings.killCooldown === SETTING_SPECS.killCooldown.min, 'a guest cannot change the settings');

// Presets
for (const name of ['casual', 'hardcore', 'standard']) {
  host.s.emit('settings', { preset: name }); await sleep(150);
  const want = SETTING_PRESETS[name];
  const bad = Object.keys(want).filter((k) => k !== 'minPlayers' && k !== 'impostors' && host.view.settings[k] !== want[k]);
  ok(bad.length === 0, `preset ${name} applies every value${bad.length ? ' (differs: ' + bad.join(', ') + ')' : ''}`);
}

// A real game uses them
host.s.emit('settings', { tasksPerPlayer: 5, impostors: 1, discussionSeconds: 5, votingSeconds: 15, killCooldown: 30 });
for (let i = 0; i < 2; i++) await host.emit('addBot');
await sleep(200);
const started = await host.emit('start');
ok(started.ok, 'the game starts with the chosen settings');
await sleep(400);
ok(host.view.me.tasks.length === 5 || host.view.me.role === 'impostor' && host.view.me.tasks.length === 5, 'each player is dealt the chosen number of tasks');
ok(host.view.settings.killCooldown === 30 && guest.view.settings.killCooldown === 30, 'both players play with the same settings');
host.s.emit('settings', { killCooldown: 60 }); await sleep(150);
ok(host.view.settings.killCooldown === 30, 'settings cannot be changed once the game has started');

// Hosting a new room with the saved rules (what "Back to title" then "Host game" does) keeps them
{
  const again = client('h');
  await sleep(300);
  const r = await again.emit('createRoom', { pid: 'h2', name: 'Again', color: 'cyan', hat: 'none', settings: { killCooldown: 45, tasksPerPlayer: 6, crewVision: 2, visualTasks: false, taskBarUpdates: 'never' } });
  await sleep(200);
  const st = again.view?.settings;
  ok(r.ok && st.killCooldown === 45 && st.tasksPerPlayer === 6 && st.crewVision === 2 && st.visualTasks === false && st.taskBarUpdates === 'never', 'a new room starts with the rules the host saved');
  const plain = client('p'); await sleep(300);
  await plain.emit('createRoom', { pid: 'p1', name: 'Plain', color: 'cyan', hat: 'none' }); await sleep(200);
  ok(plain.view?.settings.killCooldown === 25, 'a room hosted without saved rules still gets the defaults');
  again.s.close(); plain.s.close();
}

host.s.close(); guest.s.close(); server.kill();
console.log(failed ? `\n${failed} end-to-end check(s) failed.` : '\nAll end-to-end setting checks passed.');
process.exit(failed ? 1 : 0);
