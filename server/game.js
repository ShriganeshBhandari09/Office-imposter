import {
  WORLD, LOBBY, TASKS, SABOTAGE_FIX, CRITICAL_SABOTAGES, VENTS, COLORS, HATS, ROOMS, MAX_PLAYERS,
  EMERGENCY_BUTTON, USE_RANGE, KILL_RANGE, KILL_DISTANCE, REPORT_RANGE, SPEED,
  DEFAULT_SETTINGS, SETTING_SPECS, SETTING_PRESETS, maxImpostors, DOOR_SECONDS, DOOR_COOLDOWN,
  dist, spawnPoint, lobbySpawn, collides, obstaclesFor, roomAt, VISUAL_TASKS, VISUAL_TASK_MS,
} from '../client/src/shared/map.js';
import { botName, botsTick, botsSawKill, botsMeetingStarted, botsMeetingEnded, botsHeardChat, resetBrain } from './bots.js';

const now = () => Date.now();
const secsLeft = (until) => Math.max(0, Math.ceil((until - now()) / 1000));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ALL_FIX_SPOTS = Object.values(SABOTAGE_FIX).flat();
const KILL_ANIM_MS = 2600; // matches the .kill-screen animation in styles.css
const AFK_MS = 60 * 1000; // a lobby player who hasn't moved, chatted or clicked for this long shows as AFK
const BUBBLE_MS = 5000; // how long a lobby chat bubble stays above a player
const WIFI_HOLD_MS = 3000; // both Wi-Fi panels must be held this long
const MEETING_INTRO_MS = 3000; // the "Body reported" splash before a meeting's discussion starts

// One game room. The server is the single source of truth for roles, kills,
// tasks, sabotages, votes and win conditions. Clients only send intentions.
export class Game {
  constructor(roomName = '') {
    this.players = new Map(); // pid -> player
    this.settings = { ...DEFAULT_SETTINGS };
    this.roomName = roomName;
    this.hostId = null;
    this.history = []; // who the impostors were in this room's last 3 games, oldest first; bots remember it
    this.resetRound();
    this.phase = 'lobby';
  }

  resetRound() {
    this.phase = 'lobby';
    this.endAt = 0;
    this.bodies = [];
    this.sabotage = null;
    this.sabCdUntil = 0;
    this.doors = {};
    this.doorCd = {};
    this.meeting = null;
    this.ejection = null;
    this.result = null;
    this.feed = [];
    this.ghostChat = []; // chat between dead players, visible only to them
    this.emergencyReadyAt = 0;
    this.shownProgress = 0; // what the team task bar shows when it only updates at meetings
    this.stats = { meetings: 0, startedAt: 0, endedAt: 0 };
  }

  // ---------- Lobby ----------

  newPlayer(id, name, color, hat, extra = {}) {
    const t = now();
    return {
      id, name, color, hat: hat || 'none', connected: true,
      x: 0, y: 0, facing: 1, moving: false,
      alive: true, role: 'crew', tasks: [], killCdUntil: 0, emergencyLeft: 0,
      inVent: null, tpSeq: 0, lastMoveAt: t, chatAt: 0, activeAt: t, bubble: null,
      ...extra,
    };
  }

  freeColor() {
    const taken = new Set([...this.players.values()].map((q) => q.color));
    return COLORS.find((c) => !taken.has(c.id))?.id;
  }

  join(pid, name, color, hat) {
    name = String(name || '').trim().slice(0, 14);
    if (!name) return { error: 'Enter a name first.' };
    let p = this.players.get(pid);
    if (p) {
      p.connected = true;
      p.activeAt = now();
      if (!this.hostId) this.hostId = pid;
      const clash = [...this.players.values()].some((q) => q.id !== pid && q.name.toLowerCase() === name.toLowerCase());
      if (this.phase === 'lobby' && !clash) p.name = name;
      return { ok: true };
    }
    if (this.phase !== 'lobby') return { error: 'A game is in progress. Wait for it to finish, then join.' };
    // A real player always gets their seat: a bot makes room for them, and a bot with their name is renamed.
    if (this.players.size >= MAX_PLAYERS) {
      const bot = [...this.players.values()].reverse().find((q) => q.bot);
      if (!bot) return { error: 'The room is full.' };
      this.players.delete(bot.id);
    }
    for (const q of this.players.values()) {
      if (q.bot && q.name.toLowerCase() === name.toLowerCase()) {
        q.name = botName([...this.players.values()].map((x) => x.name).concat(name));
      }
    }
    if ([...this.players.values()].some((q) => q.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'That name is taken.' };
    }
    const taken = new Set([...this.players.values()].map((q) => q.color));
    if (!color || taken.has(color) || !COLORS.some((c) => c.id === color)) color = this.freeColor();
    if (!HATS.some((h) => h.id === hat)) hat = 'none';
    p = this.newPlayer(pid, name, color, hat);
    this.players.set(pid, p);
    // A room with nobody in charge (or only a bot) goes to the first real player who walks in.
    if (!this.hostId || this.players.get(this.hostId)?.bot) this.hostId = pid;
    this.placeInLobby();
    return { ok: true };
  }

  leave(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    if (this.phase === 'lobby') {
      this.players.delete(pid);
    } else {
      p.connected = false;
    }
    if (this.hostId === pid) {
      const next = [...this.players.values()].find((q) => q.connected && !q.bot);
      this.hostId = next ? next.id : null;
    }
    if (this.phase !== 'lobby' && this.isEmpty()) {
      this.backToLobby();
    }
  }

  // ---------- Bots ----------

  addBot(pid) {
    if (pid !== this.hostId || this.phase !== 'lobby') return { error: 'Only the host can add bots.' };
    if (this.players.size >= MAX_PLAYERS) return { error: 'The room is full.' };
    const id = `bot_${Math.random().toString(36).slice(2, 9)}`;
    this.players.set(id, this.newPlayer(id, botName([...this.players.values()].map((q) => q.name)), this.freeColor(),
      HATS[Math.floor(Math.random() * HATS.length)].id, { bot: true, brain: null }));
    this.placeInLobby();
    return { ok: true };
  }

  removeBot(pid, botId) {
    if (pid !== this.hostId || this.phase !== 'lobby') return;
    if (this.players.get(botId)?.bot) { this.players.delete(botId); this.placeInLobby(); }
  }

  // Players can rename themselves in the lobby.
  setName(pid, name) {
    const p = this.players.get(pid);
    if (!p) return { error: 'You are not in this room.' };
    if (this.phase !== 'lobby') return { error: 'You can only change your name in the lobby.' };
    name = String(name || '').trim().slice(0, 14);
    if (!name) return { error: 'Enter a name first.' };
    if ([...this.players.values()].some((q) => q.id !== pid && q.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'That name is taken.' };
    }
    p.name = name;
    return { ok: true, name };
  }

  // True when nobody is connected, so the room can be cleaned up.
  isEmpty() { return ![...this.players.values()].some((p) => p.connected && !p.bot); }

  setColor(pid, color) {
    const p = this.players.get(pid);
    if (!p || this.phase !== 'lobby') return;
    if (!COLORS.some((c) => c.id === color)) return;
    if ([...this.players.values()].some((q) => q.color === color && q.id !== pid)) return;
    p.color = color;
    p.activeAt = now();
  }

  setHat(pid, hat) {
    const p = this.players.get(pid);
    if (!p || this.phase !== 'lobby' || !HATS.some((h) => h.id === hat)) return;
    p.hat = hat;
    p.activeAt = now();
  }

  // Anything a lobby player does (a tap, a message, walking) counts as being here.
  touch(pid) {
    const p = this.players.get(pid);
    if (p) p.activeAt = now();
  }

  // Validates one settings object against the specs: numbers are clamped and snapped to their step,
  // choices must be one of the options, toggles are booleans. Anything else keeps its current value.
  cleanSettings(s, base) {
    const out = { ...base };
    for (const [key, spec] of Object.entries(SETTING_SPECS)) {
      const v = s[key];
      if (v === undefined) continue;
      if (spec.options) { if (spec.options.includes(v)) out[key] = v; }
      else if (typeof spec.def === 'boolean') out[key] = !!v;
      else if (Number.isFinite(+v)) {
        const snapped = spec.min + Math.round((+v - spec.min) / spec.step) * spec.step;
        out[key] = Math.round(Math.max(spec.min, Math.min(spec.max, snapped)) * 100) / 100;
      }
    }
    out.tasksPerPlayer = Math.min(out.tasksPerPlayer, TASKS.length);
    return out;
  }

  updateSettings(pid, s) {
    if (pid !== this.hostId || this.phase !== 'lobby') return;
    // A preset replaces everything; individual fields in the same message are applied on top of it.
    const base = SETTING_PRESETS[s.preset] ? { ...this.settings, ...SETTING_PRESETS[s.preset] } : this.settings;
    this.settings = this.cleanSettings(s, base);
  }

  // Lobby players walk around a small reception room. Their position is in LOBBY space.
  lobbyMove(pid, data) {
    const p = this.players.get(pid);
    if (!p || this.phase !== 'lobby') return;
    const x = +data.x, y = +data.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = Math.max(30, Math.min(LOBBY.w - 30, x));
    p.y = Math.max(LOBBY.panels[0].y + LOBBY.panels[0].h + 20, Math.min(LOBBY.h - 30, y));
    p.facing = data.facing === -1 ? -1 : 1;
    p.moving = !!data.moving;
    p.lastMoveAt = now();
    if (p.moving) p.activeAt = now();
  }

  placeInLobby() {
    [...this.players.values()].forEach((p, i) => {
      const s = lobbySpawn(i);
      p.x = s.x; p.y = s.y; p.moving = false; p.tpSeq++; p.lastMoveAt = now(); p.bubble = null;
    });
  }

  start(pid) {
    if (pid !== this.hostId || this.phase !== 'lobby') return { error: 'Only the host can start.' };
    const list = [...this.players.values()].filter((p) => p.connected);
    if (list.length < this.settings.minPlayers) {
      return { error: `Need at least ${this.settings.minPlayers} players to start.` };
    }
    const impCount = Math.min(this.settings.impostors, maxImpostors(list.length));
    const impostorIds = new Set(shuffle(list).slice(0, impCount).map((p) => p.id));
    const t = now();
    const settings = this.settings;
    this.resetRound();
    this.phase = 'playing';
    this.stats.startedAt = t;
    this.roleRevealUntil = t + 5000;
    this.emergencyReadyAt = t + 5000 + settings.emergencyCooldown * 1000;
    list.forEach((p, i) => {
      p.alive = true;
      p.role = impostorIds.has(p.id) ? 'impostor' : 'crew';
      p.tasks = shuffle(TASKS).slice(0, settings.tasksPerPlayer).map((task) => ({ id: task.id, done: false }));
      p.killCdUntil = t + 15000;
      p.emergencyLeft = settings.emergencyPerPlayer;
      p.inVent = null;
      p.killAnim = null;
      p.bubble = null;
      p.moving = false;
      if (p.bot) resetBrain(p);
      this.teleport(p, spawnPoint(i));
    });
    // Drop anyone who disconnected in the lobby.
    for (const p of this.players.values()) if (!p.connected) this.players.delete(p.id);
    this.sabCdUntil = t + 15000;
    this.log('The game has started.');
    return { ok: true };
  }

  backToLobby(pid) {
    if (pid && pid !== this.hostId) return;
    for (const p of this.players.values()) if (!p.connected) this.players.delete(p.id);
    this.resetRound();
    for (const p of this.players.values()) {
      p.alive = true; p.role = 'crew'; p.tasks = []; p.inVent = null; p.activeAt = now();
    }
    // If the host is gone, the next real player takes over (never a bot).
    if (!this.players.has(this.hostId)) {
      this.hostId = [...this.players.values()].find((p) => p.connected && !p.bot)?.id || [...this.players.keys()][0] || null;
    }
    this.placeInLobby();
  }

  // ---------- Helpers ----------

  teleport(p, pos) {
    let { x, y } = pos;
    // Nudge out of furniture if a spawn point lands on something.
    const obs = obstaclesFor([]);
    for (let r = 0; r < 120 && collides(x, y, obs); r += 8) { y += 8; }
    p.x = x; p.y = y; p.tpSeq++; p.lastMoveAt = now();
  }

  alive() { return [...this.players.values()].filter((p) => p.alive); }
  log(text) { this.feed.push({ t: now(), text }); if (this.feed.length > 20) this.feed.shift(); }

  isPlaying(p) {
    return this.phase === 'playing' && !this.endAt && p;
  }

  taskProgress() {
    const crew = [...this.players.values()].filter((p) => p.role === 'crew');
    const total = crew.reduce((n, p) => n + p.tasks.length, 0);
    const done = crew.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0);
    return total ? done / total : 0;
  }

  lockedRooms() {
    const t = now();
    return Object.entries(this.doors).filter(([, until]) => until > t).map(([id]) => id);
  }

  // ---------- Actions ----------

  killRange() { return KILL_RANGE * KILL_DISTANCE[this.settings.killDistance]; }

  move(pid, data) {
    if (this.phase === 'lobby') return this.lobbyMove(pid, data);
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || p.inVent) return;
    const x = +data.x, y = +data.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = now();
    const elapsed = Math.min(1, (t - p.lastMoveAt) / 1000);
    const maxStep = SPEED * this.settings.playerSpeed * elapsed * 1.6 + 40;
    const outside = x < 0 || y < 0 || x > WORLD.w || y > WORLD.h;
    if (outside || Math.hypot(x - p.x, y - p.y) > maxStep) {
      p.tpSeq++; // tell the client to snap back to the server position
      return;
    }
    p.x = x; p.y = y; p.lastMoveAt = t;
    p.facing = data.facing === -1 ? -1 : 1;
    p.moving = !!data.moving;
  }

  completeTask(pid, taskId) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || p.role !== 'crew') return;
    const task = p.tasks.find((t) => t.id === taskId);
    const def = TASKS.find((t) => t.id === taskId);
    if (!task || task.done || !def || dist(p, def) > USE_RANGE * 1.6) return;
    task.done = true;
    if (this.settings.visualTasks && VISUAL_TASKS.has(taskId)) p.visualUntil = now() + VISUAL_TASK_MS;
    this.checkWin();
  }

  kill(pid, targetId) {
    const k = this.players.get(pid);
    const v = this.players.get(targetId);
    if (!this.isPlaying(k) || !k.alive || k.role !== 'impostor' || k.inVent) return;
    if (!v || !v.alive || v.role === 'impostor' || v.inVent) return;
    // Positions on the killer's screen lag the server a little, so allow some slack beyond the button's range.
    if (now() < k.killCdUntil || dist(k, v) > this.killRange() * 1.4) return;
    const t = now();
    v.alive = false;
    this.bodies.push({ id: `b${t}${v.id}`, playerId: v.id, name: v.name, color: v.color, hat: v.hat, x: v.x, y: v.y });
    // The victim sees a kill cutscene; the killer snaps onto the body, like Among Us.
    v.killAnim = { at: t, killerColor: k.color, killerHat: k.hat, room: roomAt(v.x, v.y), until: t + KILL_ANIM_MS };
    k.x = v.x; k.y = v.y; k.tpSeq++; k.lastMoveAt = t;
    k.killCdUntil = t + this.settings.killCooldown * 1000;
    // A dead player can't keep holding a Wi-Fi panel.
    if (this.sabotage?.holds) for (const [id, holder] of Object.entries(this.sabotage.holds)) if (holder === v.id) delete this.sabotage.holds[id];
    botsSawKill(this, k, v);
    // If this kill wins the game, let the cutscene finish before the game-over screen.
    if (this.winner()) this.endAt = t + KILL_ANIM_MS;
  }

  report(pid, bodyId) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || p.inVent) return;
    const body = this.bodies.find((b) => b.id === bodyId) || this.bodies.find((b) => dist(b, p) <= REPORT_RANGE);
    if (!body || dist(body, p) > REPORT_RANGE * 1.4) return;
    this.startMeeting(p, 'body', body);
  }

  emergency(pid) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || p.inVent) return { error: 'Not now.' };
    if (p.emergencyLeft <= 0) return { error: 'You have used all your emergency meetings.' };
    if (this.emergencyReadyAt > now()) return { error: `Emergency meetings unlock in ${secsLeft(this.emergencyReadyAt)}s.` };
    if (CRITICAL_SABOTAGES.includes(this.sabotage?.type)) return { error: "Can't call a meeting during a critical sabotage." };
    if (dist(p, EMERGENCY_BUTTON) > USE_RANGE + 30) return { error: 'Go to the button in the Lobby.' };
    p.emergencyLeft--;
    this.startMeeting(p, 'button', null);
    return { ok: true };
  }

  vent(pid, action) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || p.role !== 'impostor') return;
    if (action === 'enter' && !p.inVent) {
      const v = VENTS.find((v) => dist(v, p) <= USE_RANGE);
      if (!v) return;
      p.inVent = v.id;
      this.teleport(p, v);
    } else if (action === 'move' && p.inVent) {
      const cur = VENTS.find((v) => v.id === p.inVent);
      const next = VENTS.find((v) => v.id === cur.to);
      p.inVent = next.id;
      p.x = next.x; p.y = next.y; p.tpSeq++; p.lastMoveAt = now();
    } else if (action === 'exit' && p.inVent) {
      p.inVent = null;
      p.tpSeq++;
      p.lastMoveAt = now();
    }
  }

  sabotageAction(pid, type, roomId) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || p.role !== 'impostor') return { error: 'Not now.' };
    const t = now();
    if (type === 'doors') {
      const room = ROOMS.find((r) => r.id === roomId && r.lockable);
      if (!room) return { error: 'Pick a room.' };
      if ((this.doorCd[roomId] || 0) > t) return { error: `${room.name} doors recharge in ${secsLeft(this.doorCd[roomId])}s.` };
      this.doors[roomId] = t + DOOR_SECONDS * 1000;
      this.doorCd[roomId] = t + DOOR_COOLDOWN * 1000;
      return { ok: true };
    }
    if (!['lights', 'comms', 'wifi'].includes(type)) return { error: 'Unknown sabotage.' };
    if (this.sabotage) return { error: 'A sabotage is already active.' };
    if (this.sabCdUntil > t) return { error: `Sabotage recharges in ${secsLeft(this.sabCdUntil)}s.` };
    const seconds = type === 'wifi' ? this.settings.wifiSeconds : type === 'comms' ? this.settings.networkSeconds : 0;
    this.sabotage = { type, startedAt: t, endsAt: seconds ? t + seconds * 1000 : null, holds: {} };
    this.sabCdUntil = t + this.settings.sabotageCooldown * 1000;
    return { ok: true };
  }

  fixSabotage(pid, fixId) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || !this.sabotage) return;
    const spot = (SABOTAGE_FIX[this.sabotage.type] || []).find((s) => s.id === fixId);
    if (!spot || spot.type === 'holdSync' || dist(p, spot) > USE_RANGE * 1.6) return;
    this.sabotage = null;
  }

  wifiHold(pid, fixId, holding) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || this.sabotage?.type !== 'wifi') return;
    const spot = SABOTAGE_FIX.wifi.find((s) => s.id === fixId);
    if (!spot) return;
    if (holding && dist(p, spot) <= USE_RANGE * 1.6) this.sabotage.holds[fixId] = pid;
    else if (this.sabotage.holds[fixId] === pid) delete this.sabotage.holds[fixId];
    this.checkWifiHold();
  }

  // The Wi-Fi reset only counts while two different players hold both panels at the same time.
  checkWifiHold() {
    const s = this.sabotage;
    if (s?.type !== 'wifi') return;
    const h = s.holds;
    const both = h.wifiA && h.wifiB && h.wifiA !== h.wifiB;
    if (!both) { s.bothSince = 0; return; }
    if (!s.bothSince) s.bothSince = now();
    if (now() - s.bothSince >= WIFI_HOLD_MS) this.sabotage = null;
  }

  // ---------- Meetings ----------

  startMeeting(caller, reason, body) {
    const t = now();
    this.phase = 'meeting';
    this.sabotage = null;
    this.doors = {};
    for (const p of this.players.values()) { p.inVent = null; p.moving = false; }
    const { discussionSeconds, votingSeconds } = this.settings;
    this.stats.meetings++;
    this.shownProgress = this.taskProgress(); // the task bar catches up at every meeting
    this.meeting = {
      callerId: caller.id,
      reason,
      bodyName: body?.name || null,
      bodyColor: body?.color || null,
      bodyRoom: body ? roomAt(body.x, body.y) : null,
      bodyVent: body ? this.nearestVent(body) : null,
      introEndsAt: t + MEETING_INTRO_MS,
      discussEndsAt: t + MEETING_INTRO_MS + discussionSeconds * 1000,
      endsAt: t + MEETING_INTRO_MS + (discussionSeconds + votingSeconds) * 1000,
      votes: {},
      chat: [],
    };
    this.bodies = [];
    botsMeetingStarted(this, caller, body);
  }

  // The vent label (V1..V4) closest to a body, if one is close enough to mention.
  nearestVent(pos) {
    let best = null, bd = 140;
    for (const v of VENTS) { const d = dist(pos, v); if (d < bd) { bd = d; best = v.pair; } }
    return best;
  }

  votingOpen() { return this.phase === 'meeting' && now() >= this.meeting.discussEndsAt; }

  vote(pid, target) {
    const p = this.players.get(pid);
    if (!this.votingOpen() || !p?.alive || this.meeting.votes[pid]) return;
    if (target !== 'skip') {
      const t = this.players.get(target);
      if (!t || !t.alive) return;
    }
    this.meeting.votes[pid] = target;
    const voters = this.alive().filter((q) => q.connected);
    if (voters.every((q) => this.meeting.votes[q.id])) this.endMeeting();
  }

  chat(pid, text) {
    const p = this.players.get(pid);
    if (!p) return;
    text = String(text || '').trim().slice(0, 140);
    if (!text || now() - p.chatAt < 600) return;
    if (this.phase === 'lobby') {
      // Lobby chat floats above the player's head for a few seconds.
      p.chatAt = p.activeAt = now();
      p.bubble = { text, until: now() + BUBBLE_MS };
      return;
    }
    if (this.phase === 'playing' && !p.alive) {
      p.chatAt = now();
      this.ghostChat.push({ id: `${now()}${pid}`, pid, name: p.name, color: p.color, text });
      if (this.ghostChat.length > 60) this.ghostChat.shift();
      return;
    }
    if (this.phase !== 'meeting' || !p.alive) return;
    p.chatAt = now();
    this.meeting.chat.push({ id: `${now()}${pid}`, pid, name: p.name, color: p.color, text });
    if (this.meeting.chat.length > 100) this.meeting.chat.shift();
    botsHeardChat(this, p, text);
  }

  endMeeting() {
    const tally = {};
    for (const [voter, target] of Object.entries(this.meeting.votes)) {
      (tally[target] ||= []).push(voter);
    }
    let top = null, topN = 0, tie = false;
    for (const [target, voters] of Object.entries(tally)) {
      if (voters.length > topN) { top = target; topN = voters.length; tie = false; }
      else if (voters.length === topN) tie = true;
    }
    const { confirmEjects, anonymousVotes } = this.settings;
    let text, sub = '', color = null, hat = null;
    if (!top || tie || top === 'skip') {
      text = tie ? 'Tie vote. No one was ejected.' : 'No one was ejected (skipped).';
    } else {
      const ej = this.players.get(top);
      ej.alive = false;
      color = ej.color;
      hat = ej.hat;
      text = `${ej.name} was ejected.`;
      // With "confirm ejects" off the crew only learns who left, not what they were.
      if (confirmEjects) sub = ej.role === 'impostor' ? `${ej.name} was an Impostor.` : `${ej.name} was not an Impostor.`;
      else text = `${ej.name} was ejected.`;
    }
    const left = this.alive().filter((p) => p.role === 'impostor').length;
    this.ejection = {
      text, sub, color, hat,
      wasImpostor: confirmEjects && top && !tie && top !== 'skip' ? this.players.get(top).role === 'impostor' : null,
      impostorsLeft: confirmEjects ? left : null,
      tally: anonymousVotes ? {} : tally,
      endsAt: now() + 8500,
    };
    this.phase = 'ejection';
    this.meeting = null;
    botsMeetingEnded(this);
  }

  afterEjection() {
    this.ejection = null;
    this.phase = 'playing';
    if (this.checkWin()) return;
    const t = now();
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      if (p.alive) this.teleport(p, spawnPoint(i));
      if (p.role === 'impostor') p.killCdUntil = t + this.settings.killCooldown * 1000;
    });
    this.sabCdUntil = Math.max(this.sabCdUntil, t + 15000);
    this.emergencyReadyAt = t + this.settings.emergencyCooldown * 1000;
  }

  // ---------- Win conditions ----------

  winner() {
    const alive = this.alive();
    const imp = alive.filter((p) => p.role === 'impostor').length;
    const crew = alive.filter((p) => p.role === 'crew').length;
    if (imp === 0) return { winner: 'crew', reason: 'All impostors were found.' };
    if (imp >= crew) return { winner: 'impostor', reason: 'The impostors outnumber the crew.' };
    if (this.taskProgress() >= 1) return { winner: 'crew', reason: 'All tasks were completed.' };
    return null;
  }

  checkWin() {
    if (this.phase === 'ended' || this.phase === 'lobby') return true;
    const w = this.winner();
    if (!w) return false;
    this.endGame(w.winner, w.reason);
    return true;
  }

  endGame(winner, reason) {
    this.phase = 'ended';
    this.sabotage = null;
    this.stats.endedAt = now();
    const crew = [...this.players.values()].filter((p) => p.role === 'crew');
    this.history.push({ impostors: [...this.players.values()].filter((p) => p.role === 'impostor').map((p) => p.id) });
    this.history = this.history.slice(-3);
    this.result = {
      winner,
      reason,
      impostors: [...this.players.values()].filter((p) => p.role === 'impostor').map((p) => ({ name: p.name, color: p.color })),
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, role: p.role, alive: p.alive })),
      tasksDone: crew.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0),
      tasksTotal: crew.reduce((n, p) => n + p.tasks.length, 0),
      meetings: this.stats.meetings,
      seconds: Math.round((this.stats.endedAt - this.stats.startedAt) / 1000),
    };
  }

  tick() {
    const t = now();
    const dt = Math.min(0.2, (t - (this.lastTick || t)) / 1000);
    this.lastTick = t;
    botsTick(this, t, dt);
    if (this.phase === 'playing') {
      if (this.endAt && this.endAt <= t) { this.endAt = 0; this.checkWin(); return; }
      this.checkWifiHold();
      if (this.sabotage?.endsAt && this.sabotage.endsAt <= t) {
        this.endGame('impostor', this.sabotage.type === 'wifi'
          ? 'The Wi-Fi went down and was never fixed.' : 'The network went down and was never fixed.');
      }
      for (const [id, until] of Object.entries(this.doors)) if (until <= t) delete this.doors[id];
      for (const p of this.players.values()) if (t - p.lastMoveAt > 200) p.moving = false;
    } else if (this.phase === 'lobby') {
      for (const p of this.players.values()) {
        if (p.bubble && p.bubble.until <= t) p.bubble = null;
        if (t - p.lastMoveAt > 300) p.moving = false;
      }
    } else if (this.phase === 'meeting' && this.meeting.endsAt <= t) {
      this.endMeeting();
    } else if (this.phase === 'ejection' && this.ejection.endsAt <= t) {
      this.afterEjection();
    }
  }

  // ---------- What each player is allowed to see ----------

  viewFor(pid) {
    const me = this.players.get(pid);
    const all = [...this.players.values()];
    const t = now();
    const roster = all.map((p) => ({
      id: p.id, name: p.name, color: p.color, hat: p.hat, alive: p.alive, connected: p.connected, bot: !!p.bot,
      afk: this.phase === 'lobby' && !p.bot && t - p.activeAt > AFK_MS,
      // Roles are only revealed to fellow impostors, or to everyone when the game ends.
      role: this.phase === 'ended' || (me?.role === 'impostor' && p.role === 'impostor') ? p.role : undefined,
    }));
    const seeGhosts = !me || !me.alive || this.phase === 'lobby' || this.phase === 'ended';
    const visible = all
      .filter((p) => p.id === pid || ((p.alive || seeGhosts) && !p.inVent))
      .map((p) => ({
        id: p.id, x: Math.round(p.x), y: Math.round(p.y), facing: p.facing, moving: p.moving, alive: p.alive,
        bubble: p.bubble && p.bubble.until > t ? p.bubble.text : null,
        fx: p.visualUntil > t ? 'task' : null,
      }));

    const bar = this.settings.taskBarUpdates;
    const view = {
      phase: this.phase,
      roomName: this.roomName,
      hostId: this.hostId,
      settings: this.settings,
      maxPlayers: MAX_PLAYERS,
      roster,
      players: visible,
      bodies: this.phase === 'playing' ? this.bodies : [],
      doors: Object.fromEntries(Object.entries(this.doors).map(([k, v]) => [k, secsLeft(v)])),
      sabotage: this.sabotage && {
        type: this.sabotage.type,
        secondsLeft: this.sabotage.endsAt ? secsLeft(this.sabotage.endsAt) : null,
        holds: Object.keys(this.sabotage.holds),
        resetProgress: this.sabotage.bothSince ? Math.min(1, (t - this.sabotage.bothSince) / WIFI_HOLD_MS) : 0,
      },
      taskProgress: bar === 'never' ? null : bar === 'meetings' ? this.shownProgress : this.taskProgress(),
      roleReveal: this.phase === 'playing' && this.roleRevealUntil > now(),
      roleRevealLeft: this.phase === 'playing' ? secsLeft(this.roleRevealUntil) : 0,
      result: this.result,
    };
    if (this.meeting) {
      view.meeting = {
        callerId: this.meeting.callerId,
        reason: this.meeting.reason,
        bodyName: this.meeting.bodyName,
        bodyColor: this.meeting.bodyColor,
        bodyRoom: this.meeting.bodyRoom,
        bodyVent: this.meeting.bodyVent,
        stage: this.votingOpen() ? 'voting' : t < this.meeting.introEndsAt ? 'intro' : 'discussion',
        secondsLeft: secsLeft(this.votingOpen() ? this.meeting.endsAt : t < this.meeting.introEndsAt ? this.meeting.introEndsAt : this.meeting.discussEndsAt),
        voted: Object.keys(this.meeting.votes),
        myVote: this.meeting.votes[pid] || null,
        chat: this.meeting.chat,
      };
    }
    if (this.ejection) view.ejection = this.ejection;
    if (me && !me.alive) view.ghostChat = this.ghostChat;
    if (me) {
      view.me = {
        id: me.id,
        role: me.role,
        alive: me.alive,
        x: me.x, y: me.y, tpSeq: me.tpSeq,
        inVent: me.inVent,
        tasks: me.tasks,
        killCdLeft: secsLeft(me.killCdUntil),
        emergencyLeft: me.emergencyLeft,
        emergencyCdLeft: secsLeft(this.emergencyReadyAt),
        sabCdLeft: me.role === 'impostor' ? secsLeft(this.sabCdUntil) : 0,
        doorCd: me.role === 'impostor' ? Object.fromEntries(Object.entries(this.doorCd).map(([k, v]) => [k, secsLeft(v)])) : {},
        room: roomAt(me.x, me.y),
        killAnim: me.killAnim && me.killAnim.until > now() && this.phase === 'playing' ? me.killAnim : null,
      };
    }
    return view;
  }
}

export { ALL_FIX_SPOTS };
