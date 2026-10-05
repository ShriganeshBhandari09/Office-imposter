// Checks that every game setting changes the game, and the new Visual tasks effect. Run: node map/settings-test.mjs
import { Game } from '../server/game.js';
import { SETTING_SPECS, TASKS, VISUAL_TASKS, EMERGENCY_BUTTON, KILL_RANGE, KILL_DISTANCE, SPEED } from '../client/src/shared/map.js';

let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL:', m); } else console.log('ok:  ', m); };

function started(settings = {}, bots = 5) {
  const g = new Game('Test');
  g.join('host', 'Host', 'cyan', 'none');
  for (let i = 0; i < bots; i++) g.addBot('host');
  g.updateSettings('host', { emergencyCooldown: 0, ...settings });
  g.start('host'); g.roleRevealUntil = 0;
  return g;
}
const crewOf = (g) => [...g.players.values()].find((p) => p.role === 'crew' && !p.bot) || [...g.players.values()].find((p) => p.role === 'crew');
const impOf = (g) => [...g.players.values()].find((p) => p.role === 'impostor');
const at = (p, d) => { p.x = d.x; p.y = d.y; };
const fxOf = (g, viewer, id) => g.viewFor(viewer).players.find((p) => p.id === id)?.fx;

// Every setting in the settings screen exists in the specs and survives a round trip.
for (const k of Object.keys(SETTING_SPECS)) {
  const g = new Game('T'); g.join('host', 'H', 'cyan', 'none');
  const spec = SETTING_SPECS[k];
  const val = spec.options ? spec.options[spec.options.length - 1] : typeof spec.def === 'boolean' ? !spec.def : spec.max;
  g.updateSettings('host', { [k]: val });
  const got = g.settings[k];
  ok(got === val || k === 'impostors', `setting ${k} can be changed (${JSON.stringify(got)})`);
}

// Visual tasks
{
  const g = started({ visualTasks: true });
  const crew = crewOf(g); const other = [...g.players.values()].find((p) => p.id !== crew.id && !p.bot) || [...g.players.values()].find((p) => p.id !== crew.id);
  const vis = TASKS.find((t) => VISUAL_TASKS.has(t.id));
  const plain = TASKS.find((t) => !VISUAL_TASKS.has(t.id));
  crew.tasks = [{ id: vis.id, done: false }, { id: plain.id, done: false }];
  at(crew, vis); g.completeTask(crew.id, vis.id);
  ok(fxOf(g, other.id, crew.id) === 'task', 'visual task: others see the effect after a visual task is done');
  ok(fxOf(g, crew.id, crew.id) === 'task', 'visual task: the player sees it too');
  crew.visualUntil = Date.now() - 1;
  ok(!fxOf(g, other.id, crew.id), 'visual task: the effect ends after a few seconds');
  at(crew, plain); g.completeTask(crew.id, plain.id);
  ok(!fxOf(g, other.id, crew.id), 'visual task: ordinary tasks show nothing');
}
{
  const g = started({ visualTasks: false });
  const crew = crewOf(g); const vis = TASKS.find((t) => VISUAL_TASKS.has(t.id));
  crew.tasks = [{ id: vis.id, done: false }, ...crew.tasks.slice(0, 1)];
  at(crew, vis); g.completeTask(crew.id, vis.id);
  ok(!fxOf(g, 'host', crew.id) && !fxOf(g, crew.id, crew.id), 'visual task: nothing shows when the setting is off');
}

// Kill cooldown, kill distance
{
  const g = started({ killCooldown: 35, killDistance: 'long' });
  const imp = impOf(g); const victim = [...g.players.values()].find((p) => p.role === 'crew');
  imp.killCdUntil = 0; at(imp, { x: 400, y: 300 }); at(victim, { x: 400 + KILL_RANGE * KILL_DISTANCE.long * 1.2, y: 300 });
  g.kill(imp.id, victim.id);
  ok(!victim.alive, 'kill distance long reaches farther than normal');
  ok(imp.killCdUntil - Date.now() > 33000 && imp.killCdUntil - Date.now() <= 35000, 'kill cooldown follows the setting (35s)');
}

// Kill cooldown over a whole game, on a fake clock
{
  const base = Date.now(); let fakeNow = base; const realNow = Date.now; Date.now = () => fakeNow;
  const g = started({ killCooldown: 20, discussionSeconds: 0, votingSeconds: 15 });
  const imp = impOf(g); const crew = [...g.players.values()].filter((p) => p.role === 'crew');
  const near = (v) => { at(imp, { x: 400, y: 300 }); at(v, { x: 410, y: 300 }); imp.lastMoveAt = fakeNow; };
  near(crew[0]);
  ok(imp.killCdUntil - base === 5000 + 20000, 'first kill: role reveal plus one full cooldown (25s for a 20s setting)');
  g.kill(imp.id, crew[0].id); ok(crew[0].alive, 'cooldown: a kill before the first cooldown ends is refused');
  fakeNow = base + 24000; g.kill(imp.id, crew[0].id); ok(crew[0].alive, 'cooldown: still refused 1s before it ends');
  fakeNow = base + 25100; imp.lastMoveAt = fakeNow; near(crew[0]); g.kill(imp.id, crew[0].id);
  ok(!crew[0].alive, 'cooldown: the kill works once the cooldown has run out');
  ok(imp.killCdUntil - fakeNow === 20000, 'cooldown: it restarts at the full setting (20s) after a kill');
  near(crew[1]); g.kill(imp.id, crew[1].id); ok(crew[1].alive, 'cooldown: a second kill straight away is refused');
  const left = g.viewFor(imp.id).me.killCdLeft; ok(left >= 19 && left <= 20, `cooldown: the impostor's button shows the time left (${left}s)`);
  fakeNow += 20100; imp.lastMoveAt = fakeNow; near(crew[1]); g.kill(imp.id, crew[1].id); ok(!crew[1].alive, 'cooldown: and works again after waiting it out');
  // A meeting restarts the cooldown at the full setting
  const caller = [...g.players.values()].find((p) => p.role === 'crew' && p.alive);
  if (caller) {
    g.emergencyReadyAt = 0; at(caller, { x: EMERGENCY_BUTTON.x + 40, y: EMERGENCY_BUTTON.y });
    g.emergency(caller.id); g.meeting.introEndsAt = fakeNow - 1; g.meeting.discussEndsAt = fakeNow - 1;
    for (const p of g.alive()) g.vote(p.id, 'skip');
    if (g.meeting) g.endMeeting();
    ok(g.phase === 'ejection', 'cooldown: the meeting ended in the ejection screen');
    fakeNow += 8600; g.afterEjection();
    ok(g.phase === 'playing' && imp.killCdUntil - fakeNow === 20000, 'cooldown: back on the map it restarts at the full setting (20s)');
  }
  Date.now = realNow;
}

// Emergency meetings per player and cooldown
{
  const g = started({ emergencyPerPlayer: 0 });
  const crew = crewOf(g); at(crew, { x: EMERGENCY_BUTTON.x + 40, y: EMERGENCY_BUTTON.y }); g.emergencyReadyAt = 0;
  ok(g.emergency(crew.id).error, 'emergencies per player 0: no meeting allowed');
  const g2 = started({ emergencyPerPlayer: 2, emergencyCooldown: 30 });
  const c2 = crewOf(g2); at(c2, { x: EMERGENCY_BUTTON.x + 40, y: EMERGENCY_BUTTON.y });
  ok(c2.emergencyLeft === 2, 'emergencies per player is handed out');
  ok(g2.emergency(c2.id).error, 'emergency cooldown blocks an early meeting');
}

// Meeting timers, anonymous votes, confirm ejects
{
  const g = started({ discussionSeconds: 20, votingSeconds: 45 });
  const crew = crewOf(g); at(crew, { x: EMERGENCY_BUTTON.x + 40, y: EMERGENCY_BUTTON.y }); g.emergencyReadyAt = 0;
  g.emergency(crew.id);
  const span = g.meeting.endsAt - g.meeting.discussEndsAt;
  ok(span === 45000, 'voting seconds follow the setting');
  ok(g.meeting.discussEndsAt - g.meeting.introEndsAt === 20000 || g.meeting.discussEndsAt > Date.now() + 20000, 'discussion seconds follow the setting');
}
for (const [anon, confirm] of [[true, false], [false, true]]) {
  const g = started({ anonymousVotes: anon, confirmEjects: confirm, discussionSeconds: 0 });
  const crew = crewOf(g); at(crew, { x: EMERGENCY_BUTTON.x + 40, y: EMERGENCY_BUTTON.y }); g.emergencyReadyAt = 0;
  g.emergency(crew.id); g.meeting.introEndsAt = Date.now() - 1; g.meeting.discussEndsAt = Date.now() - 1;
  const target = impOf(g);
  for (const p of g.alive()) g.vote(p.id, target.id);
  if (g.meeting) g.endMeeting();
  const ej = g.viewFor('host').ejection;
  ok((Object.keys(ej.tally).length === 0) === anon, `anonymous votes ${anon ? 'hide' : 'show'} the tally`);
  ok((ej.wasImpostor !== null) === confirm, `confirm ejects ${confirm ? 'reveals' : 'hides'} the role`);
}

// Sabotage timers and cooldown
{
  const g = started({ networkSeconds: 55, wifiSeconds: 70, sabotageCooldown: 50 });
  const imp = impOf(g); g.sabCdUntil = 0;
  ok(g.sabotageAction(imp.id, 'comms').ok, 'network sabotage starts');
  ok(g.sabCdUntil - Date.now() > 48000, 'sabotage cooldown follows the setting (50s)');
  ok(g.sabotage && Math.abs((g.sabotage.endsAt - Date.now()) - 55000) < 1500, 'network timer follows the setting (55s)');
}

// Wi-Fi timer
{
  const g = started({ wifiSeconds: 70 });
  const imp = impOf(g); g.sabCdUntil = 0;
  ok(g.sabotageAction(imp.id, 'wifi').ok, 'Wi-Fi sabotage starts');
  ok(Math.abs((g.sabotage.endsAt - Date.now()) - 70000) < 1500, 'Wi-Fi timer follows the setting (70s)');
}

// Player speed is enforced by the server: the limit on how far one second of movement may go scales with the setting
for (const speed of [0.75, 1, 1.25, 1.75]) {
  const limit = SPEED * speed * 1.6 + 40;
  const tryMove = (dist) => {
    const g = started({ playerSpeed: speed });
    const crew = crewOf(g);
    crew.x = 300; crew.y = 300; crew.lastMoveAt = Date.now() - 1000;
    g.move(crew.id, { x: 300 + dist, y: 300, facing: 1, moving: true });
    return crew.x === 300 + dist;
  };
  ok(tryMove(limit - 15) && !tryMove(limit + 15), `player speed ${speed}x: moves up to ${Math.round(limit)} units/s are accepted, more is refused`);
}

// Task bar updates
for (const mode of ['always', 'meetings', 'never']) {
  const g = started({ taskBarUpdates: mode });
  const crew = crewOf(g); const t = TASKS.find((x) => crew.tasks.some((y) => y.id === x.id));
  at(crew, t); g.completeTask(crew.id, t.id);
  const p = g.viewFor('host').taskProgress;
  ok(mode === 'always' ? p > 0 : mode === 'never' ? p === null : p === 0 || p === g.shownProgress, `task bar mode "${mode}" (${p})`);
}

// Speed, vision, tasks per player, impostors
{
  const g = started({ tasksPerPlayer: 5, impostors: 1 });
  ok(crewOf(g).tasks.length === 5, 'tasks per player follows the setting');
  ok([...g.players.values()].filter((p) => p.role === 'impostor').length === 1, 'impostors follows the setting');
  const v = g.viewFor('host'); ok(v.settings.playerSpeed === 1.25 && v.settings.crewVision === 1, 'speed and vision settings reach every client');
}

console.log(failed ? `\n${failed} setting check(s) failed.` : '\nAll setting checks passed.');
process.exit(failed ? 1 : 0);
