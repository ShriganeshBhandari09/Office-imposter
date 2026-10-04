// Checks the server rules added for the new design. Run: node map/rules-test.mjs
import { Game } from '../server/game.js';
import { DEFAULT_SETTINGS, SETTING_PRESETS, EMERGENCY_BUTTON, SABOTAGE_FIX } from '../client/src/shared/map.js';

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('FAIL:', msg); } else console.log('ok:  ', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function room(bots = 5) {
  const g = new Game('Test room');
  g.join('host', 'Host', 'cyan', 'headset');
  for (let i = 0; i < bots; i++) g.addBot('host');
  return g;
}

// ---- Lobby ----
{
  const g = room(3);
  ok(g.players.get('host').hat === 'headset', 'join keeps the chosen hat');
  g.setHat('host', 'beanie'); ok(g.players.get('host').hat === 'beanie', 'setHat changes the hat');
  g.setHat('host', 'tophat'); ok(g.players.get('host').hat === 'beanie', 'setHat ignores unknown hats');
  const bot = [...g.players.values()].find((p) => p.bot);
  g.setColor('host', bot.color); ok(g.players.get('host').color === 'cyan', 'a colour taken by someone else is refused');
  g.setColor('host', 'pink'); ok(g.players.get('host').color === 'pink', 'a free colour is accepted');
  g.move('host', { x: 5000, y: -50, facing: -1, moving: true });
  const h = g.players.get('host'); ok(h.x <= 970 && h.y >= 230, 'lobby movement is clamped to the reception room');
  g.chat('host', 'hello lobby'); ok(g.viewFor('host').players.find((p) => p.id === 'host').bubble === 'hello lobby', 'lobby chat shows as a bubble');
  ok(g.viewFor('host').roster.every((r) => r.afk === false), 'nobody is AFK right after joining');
  h.activeAt -= 61000; ok(g.viewFor('host').roster.find((r) => r.id === 'host').afk, 'inactive players show as AFK');
}

// ---- Settings ----
{
  const g = room(3);
  g.updateSettings('host', { killCooldown: 33, impostors: 9, killDistance: 'huge', anonymousVotes: 1, playerSpeed: 1.3 });
  const s = g.settings;
  ok(s.killCooldown === 35, 'numbers snap to their step (33 -> 35)');
  ok(s.impostors === 3, 'numbers clamp to their max');
  ok(s.killDistance === 'normal', 'unknown choices are ignored');
  ok(s.anonymousVotes === true, 'toggles are coerced to booleans');
  ok(s.playerSpeed === 1.25, 'speed snaps to 0.25 steps');
  g.updateSettings('host', { preset: 'hardcore' });
  ok(g.settings.killCooldown === SETTING_PRESETS.hardcore.killCooldown && g.settings.taskBarUpdates === 'meetings', 'a preset replaces the settings');
  g.updateSettings('bot-not-host', { killCooldown: 10 }); ok(g.settings.killCooldown === 15, 'only the host can change settings');
}
{
  const g = room(2);
  ok(g.start('host').error, 'a lobby below the minimum player count (4) cannot start');
}

// ---- Start and meeting stages ----
{
  const g = room(5);
  g.updateSettings('host', { discussionSeconds: 5, votingSeconds: 15, emergencyCooldown: 0, impostors: 1 });
  ok(g.start('host').ok, 'host starts a 6 player game');
  ok([...g.players.values()].filter((p) => p.role === 'impostor').length === 1, 'impostor count follows the setting');
  g.roleRevealUntil = 0;
  const host = g.players.get('host');
  const crew = host.role === 'crew' ? host : [...g.players.values()].find((p) => p.role === 'crew');
  g.emergencyReadyAt = 0;
  crew.x = EMERGENCY_BUTTON.x + 40; crew.y = EMERGENCY_BUTTON.y; crew.emergencyLeft = 1;
  ok(g.emergency(crew.id).ok, 'emergency button works next to the table');
  ok(g.viewFor(crew.id).meeting.stage === 'intro', 'a meeting opens with the 3 second report splash');
  g.meeting.introEndsAt = Date.now() - 1;
  const m = g.viewFor(crew.id).meeting;
  ok(m.stage === 'discussion', 'then the discussion stage');
  g.vote(crew.id, 'skip'); ok(!g.meeting.votes[crew.id], 'votes are refused during discussion');
  g.meeting.discussEndsAt = Date.now() - 1;
  ok(g.viewFor(crew.id).meeting.stage === 'voting', 'the stage flips to voting');
  g.vote(crew.id, 'skip'); ok(g.meeting.votes[crew.id] === 'skip', 'votes are accepted during voting');
}

// ---- Ghost chat ----
{
  const g = room(5);
  g.start('host'); g.roleRevealUntil = 0;
  const [dead, alive] = [...g.players.values()].filter((p) => p.role === 'crew');
  dead.alive = false;
  g.chat(dead.id, 'boo'); g.chat(alive.id, 'hello');
  ok(g.ghostChat.length === 1 && g.ghostChat[0].text === 'boo', 'only dead players can use ghost chat');
  ok(g.viewFor(dead.id).ghostChat?.length === 1, 'ghosts see the ghost chat');
  ok(g.viewFor(alive.id).ghostChat === undefined, 'the living never receive it');
}

// ---- Emergency cooldown, critical sabotage ----
{
  const g = room(5);
  g.updateSettings('host', { emergencyCooldown: 30 });
  g.start('host'); g.roleRevealUntil = 0;
  const crew = [...g.players.values()].find((p) => p.role === 'crew');
  crew.x = EMERGENCY_BUTTON.x + 40; crew.y = EMERGENCY_BUTTON.y;
  ok(/unlock/.test(g.emergency(crew.id).error || ''), 'emergency meetings are locked right after the game starts');

  const imp = [...g.players.values()].find((p) => p.role === 'impostor');
  g.sabCdUntil = 0; g.updateSettings; g.settings.networkSeconds = 20;
  ok(g.sabotageAction(imp.id, 'comms', null).ok, 'impostor can start the network sabotage');
  ok(g.sabotage.endsAt > Date.now(), 'the network sabotage has a countdown');
  g.emergencyReadyAt = 0;
  ok(/critical/.test(g.emergency(crew.id).error || ''), 'no emergency meeting during a critical sabotage');
  g.sabotage.endsAt = Date.now() - 1; g.tick();
  ok(g.phase === 'ended' && g.result.winner === 'impostor', 'letting the network timer run out ends the game for the impostors');
  ok(g.result.players.length === 6 && g.result.tasksTotal > 0, 'the result carries the player list and task stats');
}

// ---- Fixing a sabotage ----
{
  const g = room(5);
  g.start('host'); g.roleRevealUntil = 0;
  const imp = [...g.players.values()].find((p) => p.role === 'impostor');
  const crew = [...g.players.values()].find((p) => p.role === 'crew');
  g.sabCdUntil = 0; g.sabotageAction(imp.id, 'comms');
  const fix = SABOTAGE_FIX.comms[0];
  crew.x = fix.x; crew.y = fix.y + 30;
  g.fixSabotage(crew.id, 'comms');
  ok(!g.sabotage, 'standing at the switch and fixing it clears the sabotage');
}

// ---- Wi-Fi reset needs a timed two-player hold ----
{
  const g = room(5);
  g.start('host'); g.roleRevealUntil = 0;
  const imp = [...g.players.values()].find((p) => p.role === 'impostor');
  const [a, b] = [...g.players.values()].filter((p) => p.role === 'crew');
  g.sabCdUntil = 0; g.sabotageAction(imp.id, 'wifi');
  const [fa, fb] = SABOTAGE_FIX.wifi;
  a.x = fa.x; a.y = fa.y + 25; b.x = fb.x - 20; b.y = fb.y - 20;
  g.wifiHold(a.id, 'wifiA', true);
  ok(!!g.sabotage && g.viewFor(a.id).sabotage.resetProgress === 0, 'one panel held alone does nothing');
  g.wifiHold(b.id, 'wifiB', true);
  ok(!!g.sabotage, 'two panels held do not fix it instantly');
  g.sabotage.bothSince = Date.now() - 1500;
  const prog = g.viewFor(a.id).sabotage.resetProgress; ok(prog > 0.4 && prog < 0.6, 'the reset progress climbs while both are held');
  g.wifiHold(b.id, 'wifiB', false); ok(g.viewFor(a.id).sabotage.resetProgress === 0, 'letting go resets the progress');
  g.wifiHold(b.id, 'wifiB', true); g.sabotage.bothSince = Date.now() - 3100; g.tick();
  ok(!g.sabotage, 'holding both for 3 seconds resets the Wi-Fi');
}

// ---- Host handover ----
{
  const g = room(3);
  g.join('p2', 'Zed', 'red'); g.start('host'); g.roleRevealUntil = 0;
  g.leave('host'); g.endGame('crew', 'test'); g.backToLobby();
  ok(g.hostId === 'p2', 'when the host leaves, a real player (not a bot) becomes host');
}

{
  const g = new Game('x'); g.join('h', 'Host', 'cyan'); g.addBot('h');
  g.leave('h'); g.hostId = [...g.players.values()].find((p) => p.bot).id; // only a bot is left in charge
  g.join('new', 'Newbie', 'red'); ok(g.hostId === 'new', 'a real player joining a bot-hosted room becomes host');
}

{
  const g = room(4); g.updateSettings('host', { impostors: 3 });
  g.start('host'); ok([...g.players.values()].filter((p) => p.role === 'impostor').length === 1, 'a 5 player game never gets more than 1 impostor');
}

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll rule checks passed.');
process.exit(failed ? 1 : 0);
