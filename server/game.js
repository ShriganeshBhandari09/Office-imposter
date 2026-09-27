import {
  WORLD, TASKS, TASKS_PER_PLAYER, SABOTAGE_FIX, VENTS, COLORS, ROOMS,
  EMERGENCY_BUTTON, USE_RANGE, KILL_RANGE, REPORT_RANGE, SPEED,
  DEFAULT_SETTINGS, SABOTAGE_COOLDOWN, DOOR_SECONDS, DOOR_COOLDOWN, WIFI_SECONDS,
  dist, spawnPoint, collides, obstaclesFor, roomAt,
} from '../client/src/shared/map.js';

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

// One game room. The server is the single source of truth for roles, kills,
// tasks, sabotages, votes and win conditions. Clients only send intentions.
export class Game {
  constructor() {
    this.players = new Map(); // pid -> player
    this.settings = { ...DEFAULT_SETTINGS };
    this.hostId = null;
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
  }

  // ---------- Lobby ----------

  join(pid, name, color) {
    name = String(name || '').trim().slice(0, 14);
    if (!name) return { error: 'Enter a name first.' };
    let p = this.players.get(pid);
    if (p) {
      p.connected = true;
      p.name = this.phase === 'lobby' ? name : p.name;
      return { ok: true };
    }
    if (this.phase !== 'lobby') return { error: 'A game is in progress. Wait for it to finish, then join.' };
    if (this.players.size >= COLORS.length) return { error: 'The room is full.' };
    if ([...this.players.values()].some((q) => q.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'That name is taken.' };
    }
    const taken = new Set([...this.players.values()].map((q) => q.color));
    if (!color || taken.has(color) || !COLORS.some((c) => c.id === color)) {
      color = COLORS.find((c) => !taken.has(c.id)).id;
    }
    p = {
      id: pid, name, color, connected: true,
      x: 129, y: 180, facing: 1, moving: false,
      alive: true, role: 'crew', tasks: [], killCdUntil: 0, emergencyLeft: 0,
      inVent: null, tpSeq: 0, lastMoveAt: now(), chatAt: 0,
    };
    this.players.set(pid, p);
    if (!this.hostId) this.hostId = pid;
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
      const next = [...this.players.values()].find((q) => q.connected);
      this.hostId = next ? next.id : null;
    }
    if (this.phase !== 'lobby' && ![...this.players.values()].some((q) => q.connected)) {
      this.backToLobby();
    }
  }

  setColor(pid, color) {
    const p = this.players.get(pid);
    if (!p || this.phase !== 'lobby') return;
    if (!COLORS.some((c) => c.id === color)) return;
    if ([...this.players.values()].some((q) => q.color === color && q.id !== pid)) return;
    p.color = color;
  }

  updateSettings(pid, s) {
    if (pid !== this.hostId || this.phase !== 'lobby') return;
    const clamp = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
    this.settings = {
      ...this.settings,
      impostors: clamp(s.impostors, 1, 3, this.settings.impostors),
      killCooldown: clamp(s.killCooldown, 10, 60, this.settings.killCooldown),
      meetingSeconds: clamp(s.meetingSeconds, 30, 180, this.settings.meetingSeconds),
      emergencyPerPlayer: clamp(s.emergencyPerPlayer, 0, 3, this.settings.emergencyPerPlayer),
      crewVision: clamp(s.crewVision, 25, 300, this.settings.crewVision),
      impostorVision: clamp(s.impostorVision, 25, 300, this.settings.impostorVision),
    };
  }

  placeInLobby() {
    const list = [...this.players.values()];
    list.forEach((p, i) => this.teleport(p, spawnPoint(i, list.length)));
  }

  start(pid) {
    if (pid !== this.hostId || this.phase !== 'lobby') return { error: 'Only the host can start.' };
    const list = [...this.players.values()].filter((p) => p.connected);
    if (list.length < this.settings.minPlayers) {
      return { error: `Need at least ${this.settings.minPlayers} players to start.` };
    }
    const maxImp = Math.max(1, Math.floor((list.length - 1) / 2));
    const impCount = Math.min(this.settings.impostors, maxImp);
    const impostorIds = new Set(shuffle(list).slice(0, impCount).map((p) => p.id));
    const t = now();
    this.resetRound();
    this.phase = 'playing';
    this.roleRevealUntil = t + 4000;
    list.forEach((p, i) => {
      p.alive = true;
      p.role = impostorIds.has(p.id) ? 'impostor' : 'crew';
      p.tasks = shuffle(TASKS).slice(0, TASKS_PER_PLAYER).map((task) => ({ id: task.id, done: false }));
      p.killCdUntil = t + 15000;
      p.emergencyLeft = this.settings.emergencyPerPlayer;
      p.inVent = null;
      p.killAnim = null;
      this.teleport(p, spawnPoint(i, list.length));
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
      p.alive = true; p.role = 'crew'; p.tasks = []; p.inVent = null;
    }
    if (!this.players.has(this.hostId)) this.hostId = [...this.players.keys()][0] || null;
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

  move(pid, data) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || p.inVent) return;
    const x = +data.x, y = +data.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const t = now();
    const elapsed = Math.min(1, (t - p.lastMoveAt) / 1000);
    const maxStep = SPEED * elapsed * 1.6 + 40;
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
    this.checkWin();
  }

  kill(pid, targetId) {
    const k = this.players.get(pid);
    const v = this.players.get(targetId);
    if (!this.isPlaying(k) || !k.alive || k.role !== 'impostor' || k.inVent) return;
    if (!v || !v.alive || v.role === 'impostor' || v.inVent) return;
    if (now() < k.killCdUntil || dist(k, v) > KILL_RANGE) return;
    const t = now();
    v.alive = false;
    this.bodies.push({ id: `b${t}${v.id}`, playerId: v.id, name: v.name, color: v.color, x: v.x, y: v.y });
    // The victim sees a kill cutscene; the killer snaps onto the body, like Among Us.
    v.killAnim = { at: t, killerColor: k.color, until: t + KILL_ANIM_MS };
    k.x = v.x; k.y = v.y; k.tpSeq++; k.lastMoveAt = t;
    k.killCdUntil = t + this.settings.killCooldown * 1000;
    // If this kill wins the game, let the cutscene finish before the game-over screen.
    if (this.winner()) this.endAt = t + KILL_ANIM_MS;
  }

  report(pid, bodyId) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || p.inVent) return;
    const body = this.bodies.find((b) => b.id === bodyId) || this.bodies.find((b) => dist(b, p) <= REPORT_RANGE);
    if (!body || dist(body, p) > REPORT_RANGE) return;
    this.startMeeting(p, 'body', body);
  }

  emergency(pid) {
    const p = this.players.get(pid);
    if (!this.isPlaying(p) || !p.alive || p.inVent) return { error: 'Not now.' };
    if (p.emergencyLeft <= 0) return { error: 'You have used all your emergency meetings.' };
    if (this.sabotage?.type === 'wifi') return { error: "Can't call a meeting during a critical sabotage." };
    if (dist(p, EMERGENCY_BUTTON) > USE_RANGE + 30) return { error: 'Go to the button in the Cafeteria.' };
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
    this.sabotage = { type, startedAt: t, endsAt: type === 'wifi' ? t + WIFI_SECONDS * 1000 : null, holds: {} };
    this.sabCdUntil = t + SABOTAGE_COOLDOWN * 1000;
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
    const h = this.sabotage.holds;
    if (h.wifiA && h.wifiB && h.wifiA !== h.wifiB) this.sabotage = null;
  }

  // ---------- Meetings ----------

  startMeeting(caller, reason, body) {
    const t = now();
    this.phase = 'meeting';
    this.sabotage = null;
    this.doors = {};
    for (const p of this.players.values()) { p.inVent = null; p.moving = false; }
    this.meeting = {
      callerId: caller.id,
      reason,
      bodyName: body?.name || null,
      bodyColor: body?.color || null,
      endsAt: t + this.settings.meetingSeconds * 1000,
      votes: {},
      chat: [],
    };
    this.bodies = [];
  }

  vote(pid, target) {
    const p = this.players.get(pid);
    if (this.phase !== 'meeting' || !p?.alive || this.meeting.votes[pid]) return;
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
    if (this.phase !== 'meeting' || !p?.alive) return;
    text = String(text || '').trim().slice(0, 140);
    if (!text || now() - p.chatAt < 600) return;
    p.chatAt = now();
    this.meeting.chat.push({ id: `${now()}${pid}`, pid, name: p.name, color: p.color, text });
    if (this.meeting.chat.length > 100) this.meeting.chat.shift();
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
    let text, sub = '', color = null;
    if (!top || tie || top === 'skip') {
      text = tie ? 'Tie vote. No one was ejected.' : 'No one was ejected (skipped).';
    } else {
      const ej = this.players.get(top);
      ej.alive = false;
      color = ej.color;
      text = `${ej.name} was ejected.`;
      sub = ej.role === 'impostor' ? `${ej.name} was an Impostor.` : `${ej.name} was not an Impostor.`;
    }
    const left = this.alive().filter((p) => p.role === 'impostor').length;
    this.ejection = {
      text, sub, color, impostorsLeft: left, tally,
      endsAt: now() + 8500,
    };
    this.phase = 'ejection';
    this.meeting = null;
  }

  afterEjection() {
    this.ejection = null;
    this.phase = 'playing';
    if (this.checkWin()) return;
    const t = now();
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      if (p.alive) this.teleport(p, spawnPoint(i, list.length));
      if (p.role === 'impostor') p.killCdUntil = t + this.settings.killCooldown * 1000;
    });
    this.sabCdUntil = Math.max(this.sabCdUntil, t + 15000);
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
    this.result = {
      winner,
      reason,
      impostors: [...this.players.values()].filter((p) => p.role === 'impostor').map((p) => ({ name: p.name, color: p.color })),
    };
  }

  tick() {
    const t = now();
    if (this.phase === 'playing') {
      if (this.endAt && this.endAt <= t) { this.endAt = 0; this.checkWin(); return; }
      if (this.sabotage?.type === 'wifi' && this.sabotage.endsAt <= t) {
        this.endGame('impostor', 'The Wi-Fi went down and was never fixed.');
      }
      for (const [id, until] of Object.entries(this.doors)) if (until <= t) delete this.doors[id];
      for (const p of this.players.values()) if (t - p.lastMoveAt > 200) p.moving = false;
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
    const roster = all.map((p) => ({
      id: p.id, name: p.name, color: p.color, alive: p.alive, connected: p.connected,
      // Roles are only revealed to fellow impostors, or to everyone when the game ends.
      role: this.phase === 'ended' || (me?.role === 'impostor' && p.role === 'impostor') ? p.role : undefined,
    }));
    const seeGhosts = !me || !me.alive || this.phase === 'lobby' || this.phase === 'ended';
    const visible = all
      .filter((p) => p.id === pid || ((p.alive || seeGhosts) && !p.inVent))
      .map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), facing: p.facing, moving: p.moving, alive: p.alive }));

    const comms = this.sabotage?.type === 'comms';
    const view = {
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      roster,
      players: visible,
      bodies: this.phase === 'playing' ? this.bodies : [],
      doors: Object.fromEntries(Object.entries(this.doors).map(([k, v]) => [k, secsLeft(v)])),
      sabotage: this.sabotage && {
        type: this.sabotage.type,
        secondsLeft: this.sabotage.endsAt ? secsLeft(this.sabotage.endsAt) : null,
        holds: Object.keys(this.sabotage.holds),
      },
      taskProgress: comms ? null : this.taskProgress(),
      roleReveal: this.phase === 'playing' && this.roleRevealUntil > now(),
      result: this.result,
    };
    if (this.meeting) {
      view.meeting = {
        callerId: this.meeting.callerId,
        reason: this.meeting.reason,
        bodyName: this.meeting.bodyName,
        bodyColor: this.meeting.bodyColor,
        secondsLeft: secsLeft(this.meeting.endsAt),
        voted: Object.keys(this.meeting.votes),
        myVote: this.meeting.votes[pid] || null,
        chat: this.meeting.chat,
      };
    }
    if (this.ejection) view.ejection = this.ejection;
    if (me) {
      view.me = {
        id: me.id,
        role: me.role,
        alive: me.alive,
        x: me.x, y: me.y, tpSeq: me.tpSeq,
        inVent: me.inVent,
        tasks: comms && me.role === 'crew' ? null : me.tasks,
        killCdLeft: secsLeft(me.killCdUntil),
        emergencyLeft: me.emergencyLeft,
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
