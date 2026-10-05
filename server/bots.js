// Computer-controlled players. They live entirely on the server: every game tick
// each bot looks at the world the way a player would (vision + walls), picks a goal
// and walks there along a path, then calls the same Game methods a human's socket would.
import {
  WORLD, LOBBY, PLAYER_R, SPEED, SABOTAGE_FIX, VENTS, ROOMS, OPAQUE_WALLS, DOORS, VISION,
  KILL_RANGE, KILL_DISTANCE, REPORT_RANGE, USE_RANGE, TASKS, obstaclesFor, collides, dist, roomAt,
} from '../client/src/shared/map.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const BOT_NAMES = ['Ravi', 'Priya', 'Arjun', 'Neha', 'Kabir', 'Ananya', 'Rohan', 'Isha',
  'Vikram', 'Meera', 'Aditya', 'Tara', 'Sahil', 'Pooja', 'Dev', 'Zoya'];

export function botName(taken) {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  const free = BOT_NAMES.filter((n) => !used.has(n.toLowerCase()));
  if (free.length) return pick(free);
  for (let i = 2; ; i++) if (!used.has(`bot ${i}`)) return `Bot ${i}`;
}

// ---------- Path finding on a coarse grid ----------

const CELL = 10;
const GW = Math.ceil(WORLD.w / CELL), GH = Math.ceil(WORLD.h / CELL);
const STATIC = obstaclesFor([]);
const OPEN = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    OPEN[gy * GW + gx] = collides(gx * CELL + CELL / 2, gy * CELL + CELL / 2, STATIC, PLAYER_R + 1) ? 0 : 1;
  }
}
const center = (i) => ({ x: (i % GW) * CELL + CELL / 2, y: Math.floor(i / GW) * CELL + CELL / 2 });

function nearestOpen(x, y) {
  const cx = clamp(Math.floor(x / CELL), 0, GW - 1), cy = clamp(Math.floor(y / CELL), 0, GH - 1);
  if (OPEN[cy * GW + cx]) return cy * GW + cx;
  for (let r = 1; r < 40; r++) {
    let best = -1, bd = Infinity;
    const visit = (gx, gy) => {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return;
      const i = gy * GW + gx;
      if (!OPEN[i]) return;
      const c = center(i), d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = i; }
    };
    for (let k = -r; k <= r; k++) { visit(cx + k, cy - r); visit(cx + k, cy + r); }
    for (let k = -r + 1; k <= r - 1; k++) { visit(cx - r, cy + k); visit(cx + r, cy + k); }
    if (best >= 0) return best;
  }
  return -1;
}

// True if a player can walk the straight line from a to b without touching furniture or walls.
function clearLine(a, b) {
  const d = dist(a, b), n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) {
    if (collides(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, STATIC, PLAYER_R)) return false;
  }
  return true;
}

// A* over the grid, then shortcut the corners so bots walk in straight lines like people do.
function findPath(from, to) {
  const s = nearestOpen(from.x, from.y), g = nearestOpen(to.x, to.y);
  if (s < 0 || g < 0) return null;
  const N = GW * GH;
  const cost = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const gc = center(g);
  const gx0 = g % GW, gy0 = Math.floor(g / GW);
  const h = (i) => Math.hypot((i % GW) - gx0, Math.floor(i / GW) - gy0);
  const heap = [[h(s), s]];
  const push = (e) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  cost[s] = 0;
  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === g) break;
    const x = i % GW, y = Math.floor(i / GW);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (!OPEN[j] || done[j]) continue;
        if (dx && dy && (!OPEN[y * GW + nx] || !OPEN[ny * GW + x])) continue; // no corner cutting
        const c = cost[i] + (dx && dy ? 1.414 : 1);
        if (c < cost[j]) { cost[j] = c; came[j] = i; push([c + h(j), j]); }
      }
    }
  }
  if (!done[g]) return null;
  const cells = [];
  for (let i = g; i !== -1; i = came[i]) cells.push(center(i));
  cells.reverse();
  const pts = [{ x: from.x, y: from.y }, ...cells];
  if (clearLine(cells[cells.length - 1], to)) pts.push({ x: to.x, y: to.y });
  const out = [];
  for (let i = 0; i < pts.length - 1;) {
    let j = Math.min(pts.length - 1, i + 24);
    while (j > i + 1 && !clearLine(pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// ---------- Senses ----------

const lockedDoors = (game) => {
  const locked = new Set(game.lockedRooms());
  return DOORS.filter((d) => locked.has(d.roomId));
};
// What blocks a bot's line of sight: solid walls (glass doesn't) and locked doors.
const sightBlockers = (game) => [...OPAQUE_WALLS, ...lockedDoors(game)];

// Straight line from a to b doesn't cross a wall or locked door (Liang-Barsky).
function lineOfSight(a, b, occluders) {
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const o of occluders) {
    let t0 = 0, t1 = 1, hit = true;
    for (const [p, q] of [[-dx, a.x - o.x], [dx, o.x + o.w - a.x], [-dy, a.y - o.y], [dy, o.y + o.h - a.y]]) {
      if (p === 0) { if (q < 0) { hit = false; break; } continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) { hit = false; break; } if (t > t0) t0 = t; } else { if (t < t0) { hit = false; break; } if (t < t1) t1 = t; }
    }
    if (hit) return false;
  }
  return true;
}

function visionOf(game, p) {
  const s = game.settings;
  if (p.role === 'impostor') return VISION.base * s.impostorVision;
  return (game.sabotage?.type === 'lights' ? VISION.lightsOut : VISION.base) * s.crewVision;
}

// Can player `a` see point/player `b` right now?
function canSee(game, a, b, occ = sightBlockers(game)) {
  if (!a.alive || a.inVent || b.inVent) return false;
  return dist(a, b) <= visionOf(game, a) && lineOfSight(a, b, occ);
}

// ---------- Brain ----------

// Bots remember the last 3 games in this room: whoever was an impostor before starts the next game slightly suspect
// (the latest game counts most). It is only a nudge; anything a bot actually sees outweighs it.
function memorySuspicion(game, p) {
  const sus = {};
  const hist = game?.history || [];
  hist.forEach((h, i) => {
    const weight = 0.5 * (i + 1); // oldest 0.5, then 1, then 1.5
    for (const id of h.impostors) if (id !== p.id) sus[id] = (sus[id] || 0) + weight;
  });
  return sus;
}

function newBrain(p, t, game) {
  return {
    path: null, goal: null, act: null, lastTp: p.tpSeq, blockedSince: 0,
    sus: memorySuspicion(game, p), seen: {}, witness: null, found: null, fakeDone: new Set(),
    fixId: null, sabSeenAt: 0, sabAt: t + rand(20000, 45000), fleeUntil: 0,
    meet: null,
  };
}

export function resetBrain(p) { p.brain = null; }

// Path finding is the most expensive thing the server does, so at most one new path is worked out per tick;
// a bot that misses out simply asks again on the next tick (50 ms later).
let pathBudget = 1;

function goTo(p, b, x, y, kind, id, reach = 24, replanMs = 0, t = 0) {
  const same = b.goal && b.goal.kind === kind && b.goal.id === id;
  if (same && b.path && !(replanMs && t - b.goal.at > replanMs)) {
    b.goal.x = x; b.goal.y = y;
    return;
  }
  if (pathBudget <= 0) return;
  pathBudget--;
  b.goal = { x, y, kind, id, reach, at: t };
  b.blockedSince = 0;
  // Ghosts float straight through everything.
  b.path = p.alive ? findPath(p, { x, y }) : [{ x, y }];
}

// Close enough, or as close as the path gets (some spots sit next to furniture).
const arrived = (p, b) => b.goal && (dist(p, b.goal) <= b.goal.reach || !b.path || !b.path.length);
const stop = (b) => { b.goal = null; b.path = null; };

function walk(game, p, b, dt, t) {
  if (!b.path || !b.path.length) { p.moving = false; return; }
  let left = SPEED * game.settings.playerSpeed * 0.9 * dt;
  const doors = p.alive ? lockedDoors(game).filter((d) => !collides(p.x, p.y, [d])) : [];
  while (left > 0 && b.path.length) {
    const w = b.path[0];
    const d = dist(p, w);
    const step = Math.min(left, d);
    const nx = d ? p.x + ((w.x - p.x) / d) * step : w.x, ny = d ? p.y + ((w.y - p.y) / d) * step : w.y;
    if (doors.length && collides(nx, ny, doors)) {
      // A locked door is in the way: wait for it, or give up on this goal after a while.
      if (!b.blockedSince) b.blockedSince = t;
      if (t - b.blockedSince > 2500) { stop(b); b.act = { kind: 'idle', until: t + rand(500, 1500) }; }
      p.moving = false;
      return;
    }
    b.blockedSince = 0;
    if (Math.abs(nx - p.x) > 0.5) p.facing = nx > p.x ? 1 : -1;
    p.x = nx; p.y = ny;
    left -= step;
    if (step >= d) b.path.shift();
  }
  p.moving = true;
  p.lastMoveAt = t;
}

// Somewhere to go when there is nothing else to do: a random room or task spot.
function wanderTarget(from) {
  const one = () => {
    if (Math.random() < 0.5) { const r = pick(ROOMS); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    return pick(TASKS);
  };
  // Prefer a spot well away from where the bot stands, so it keeps crossing the office instead of shuffling about.
  let best = one();
  if (from) for (let i = 0; i < 3; i++) { const c = one(); if (dist(from, c) > dist(from, best)) best = c; }
  return best;
}

function doTaskLoop(game, p, b, t, fake) {
  const todo = p.tasks.filter((tk) => !tk.done && !(fake && b.fakeDone.has(tk.id)));
  if (!todo.length) {
    if (!b.goal || arrived(p, b)) {
      // With nothing left to do a bot keeps patrolling; only now and then does it stop for a moment.
      if (b.goal?.kind === 'wander' && Math.random() < 0.25) { stop(b); b.act = { kind: 'idle', until: t + rand(400, 1400) }; return; }
      const w = wanderTarget(p);
      goTo(p, b, w.x, w.y, 'wander', `${w.x},${w.y}`, 40, 0, t);
    }
    return;
  }
  // Keep going to the current task; otherwise pick the nearest.
  let tk = b.goal?.kind === 'task' && todo.find((x) => x.id === b.goal.id);
  if (!tk) tk = todo.map((x) => ({ x, d: dist(p, TASKS.find((d) => d.id === x.id)) })).sort((a, c) => a.d - c.d)[0].x;
  const def = TASKS.find((d) => d.id === tk.id);
  goTo(p, b, def.x, def.y, 'task', tk.id, 30, 0, t);
  if (arrived(p, b)) {
    stop(b);
    b.act = { kind: 'task', id: tk.id, fake, until: t + rand(2500, 6000) };
  }
}

function finishAct(game, p, b, t) {
  const a = b.act;
  b.act = null;
  if (a.kind === 'task') {
    if (a.fake) b.fakeDone.add(a.id);
    else game.completeTask(p.id, a.id);
    // An impostor who has "done" everything starts the cover routine over.
    if (a.fake && p.tasks.every((tk) => b.fakeDone.has(tk.id))) b.fakeDone.clear();
  } else if (a.kind === 'fix') {
    game.fixSabotage(p.id, a.id);
  } else if (a.kind === 'vent-in') {
    game.vent(p.id, 'move');
    b.act = { kind: 'vent-out', until: t + rand(800, 1600) };
  } else if (a.kind === 'vent-out') {
    game.vent(p.id, 'exit');
    const w = wanderTarget();
    goTo(p, b, w.x, w.y, 'wander', 'flee', 40, 0, t);
  }
}

// Crewmates (and ghosts) on the map.
function crewThink(game, p, b, t) {
  const occ = sightBlockers(game);
  if (p.alive) {
    // Remember where everyone in view was, for "I saw X near there" later.
    if (t >= (b.lookAt || 0)) {
      b.lookAt = t + 500;
      for (const q of game.players.values()) {
        if (q.id !== p.id && q.alive && canSee(game, p, q, occ)) b.seen[q.id] = { t, x: q.x, y: q.y };
      }
    }
    // A body in view beats everything: remember who was around it, then go report it.
    const body = game.bodies.find((bd) => canSee(game, p, bd, occ));
    if (body) {
      if (b.found?.id !== body.id) {
        b.found = { id: body.id, name: body.name, room: roomAt(body.x, body.y) };
        for (const q of game.players.values()) {
          if (q.id === p.id || !q.alive) continue;
          if (dist(q, body) < 150 && canSee(game, p, q, occ)) b.sus[q.id] = (b.sus[q.id] || 0) + 3;
          const s = b.seen[q.id];
          if (s && t - s.t < 20000 && dist(s, body) < 260) b.sus[q.id] = (b.sus[q.id] || 0) + 2;
        }
      }
      b.act = null;
      goTo(p, b, body.x, body.y, 'body', body.id, REPORT_RANGE * 0.7, 0, t);
      if (arrived(p, b)) game.report(p.id, body.id);
      return;
    }

    // Sabotage: some bots go and fix lights / network; the Wi-Fi needs one bot on each panel.
    const sab = game.sabotage;
    if (!sab) b.fixId = null;
    else if (b.sabSeenAt !== sab.startedAt) {
      b.sabSeenAt = sab.startedAt;
      const spots = SABOTAGE_FIX[sab.type] || [];
      if (sab.type === 'wifi') {
        const count = (id) => [...game.players.values()].filter((q) => q.bot && q.brain?.fixId === id).length;
        b.fixId = [...spots].sort((a, c) => count(a.id) - count(c.id) || dist(p, a) - dist(p, c))[0]?.id;
      } else {
        // Some bots go; if nobody else has, this one does.
        const someone = [...game.players.values()].some((q) => q.bot && q.id !== p.id && q.brain?.fixId);
        // The network sabotage ends the game on a timer, so most bots rush it; lights are less urgent.
        b.fixId = !someone || Math.random() < (sab.type === 'comms' ? 0.8 : 0.5) ? spots[0]?.id : null;
      }
      if (b.fixId) b.act = null;
    }
    if (sab && b.fixId) {
      const spot = (SABOTAGE_FIX[sab.type] || []).find((s) => s.id === b.fixId);
      if (spot) {
        if (b.act?.kind === 'fix') return;
        if (dist(p, spot) <= USE_RANGE * 0.8) {
          // At the panel: hold the Wi-Fi reset, or spend a moment fixing.
          stop(b);
          if (spot.type === 'holdSync') { if (sab.holds[spot.id] !== p.id) game.wifiHold(p.id, spot.id, true); }
          else b.act = { kind: 'fix', id: spot.id, until: t + rand(2000, 4000) };
          return;
        }
        goTo(p, b, spot.x, spot.y, 'fix', spot.id, USE_RANGE * 0.6, 0, t);
        return;
      }
    }
  }
  if (b.act) return;
  doTaskLoop(game, p, b, t, false);
}

function impostorThink(game, p, b, t) {
  // Sabotage now and then (dead impostors can too).
  if (!game.sabotage && game.sabCdUntil <= t && t >= b.sabAt) {
    const r = Math.random();
    game.sabotageAction(p.id, r < 0.45 ? 'lights' : r < 0.8 ? 'comms' : 'wifi');
    b.sabAt = t + rand(35000, 80000);
  }
  if (!p.alive) { if (!b.act) doTaskLoop(game, p, b, t, true); return; }
  if (p.inVent) return;

  const occ = sightBlockers(game);
  const others = [...game.players.values()].filter((q) => q.alive && q.role !== 'impostor' && !q.inVent);
  if (p.killCdUntil <= t && t >= b.fleeUntil) {
    const targets = others.filter((q) => canSee(game, p, q, occ)).sort((a, c) => dist(p, a) - dist(p, c));
    for (const v of targets) {
      // Never kill in front of a witness.
      const seen = others.some((q) => q.id !== v.id && (canSee(game, q, p, occ) || canSee(game, q, v, occ)));
      if (seen) continue;
      if (dist(p, v) <= KILL_RANGE * KILL_DISTANCE[game.settings.killDistance] * 0.85) {
        game.kill(p.id, v.id);
        b.act = null;
        b.fleeUntil = t + 8000;
        // Escape: through a nearby vent if there is one, otherwise just walk off.
        const vent = VENTS.find((vt) => dist(p, vt) < 160);
        if (vent) goTo(p, b, vent.x, vent.y, 'vent', vent.id, USE_RANGE * 0.6, 0, t);
        else { const w = wanderTarget(); goTo(p, b, w.x, w.y, 'wander', 'flee', 40, 0, t); }
        return;
      }
      if (dist(p, v) < 260) {
        b.act = null;
        goTo(p, b, v.x, v.y, 'hunt', v.id, KILL_RANGE * KILL_DISTANCE[game.settings.killDistance] * 0.6, 500, t);
        return;
      }
    }
  }
  if (b.goal?.kind === 'vent') {
    if (arrived(p, b)) {
      stop(b);
      game.vent(p.id, 'enter');
      if (p.inVent) b.act = { kind: 'vent-in', until: t + rand(800, 1500) };
    }
    return;
  }
  if (b.goal?.kind === 'wander' && b.goal.id === 'flee' && !arrived(p, b)) return;
  if (b.goal?.kind === 'hunt') stop(b);
  if (b.act) return;
  doTaskLoop(game, p, b, t, true);
}

// ---------- Meetings ----------

const GENERIC = ['Where?', 'I was doing tasks in {room}.', 'I didn\'t see anything.', 'Anyone have info?', 'Skip if we don\'t know.', 'Hmm, sus.'];
const say = (b, text, at) => b.meet.lines.push({ text, at });

function planMeeting(game, p, b, t, caller, body) {
  const m = game.meeting;
  const ends = m.endsAt;
  // Bots vote some time after voting opens, never in the last few seconds.
  b.meet = { lines: [], voteAt: Math.min(ends - 3000, Math.max(t, m.discussEndsAt) + rand(4000, 18000)), voted: false, defended: false, accusedBy: null };
  if (!p.alive) return;
  // Bots that didn't personally spot the body still know who they saw nearby recently;
  // without this, only the reporter ever gains suspicion and everyone else defaults to skip.
  if (body && p.role !== 'impostor' && b.found?.id !== body.id) {
    for (const q of game.players.values()) {
      if (q.id === p.id || !q.alive) continue;
      const s = b.seen[q.id];
      if (s && t - s.t < 20000 && dist(s, body) < 260) b.sus[q.id] = (b.sus[q.id] || 0) + 2;
    }
  }
  const room = roomAt(p.x, p.y);
  // The reporter talks first, everyone else a moment later.
  let at = caller.id === p.id ? t + rand(800, 1600) : t + rand(3000, 7000);
  if (caller.id === p.id) {
    say(b, body ? `Found ${body.name}'s body in ${roomAt(body.x, body.y)}!` : 'I called this. Something feels off.', at);
    at += rand(2000, 3500);
  }
  if (p.role !== 'impostor') {
    const w = b.witness && game.players.get(b.witness.killer);
    if (w?.alive) { say(b, `It was ${w.name}! I saw them kill ${b.witness.victim}.`, at); return; }
    const top = topSuspect(game, p, b);
    const score = top ? b.sus[top.id] || 0 : 0;
    if (score >= 3) { say(b, `${top.name} was near the body. Sus.`, at); return; }
    if (score >= 2) { say(b, `I saw ${top.name} around there earlier.`, at); return; }
  }
  if (Math.random() < 0.6) say(b, pick(GENERIC).replace('{room}', room), at);
}

function topSuspect(game, p, b) {
  let best = null;
  for (const q of game.players.values()) {
    if (q.id === p.id || !q.alive) continue;
    if ((b.sus[q.id] || 0) > (best ? b.sus[best.id] || 0 : 0)) best = q;
  }
  return best;
}

function leadingVote(game, p) {
  const tally = {};
  for (const target of Object.values(game.meeting.votes)) if (target !== 'skip') tally[target] = (tally[target] || 0) + 1;
  let best = null, n = 0;
  for (const [id, c] of Object.entries(tally)) {
    const q = game.players.get(id);
    if (id === p.id || !q?.alive) continue;
    if (p.role === 'impostor' && q.role === 'impostor') continue;
    if (c > n) { best = id; n = c; }
  }
  return { id: best, n };
}

function meetingThink(game, p, b, t) {
  if (!b.meet || !p.alive) return;
  const line = b.meet.lines[0];
  if (line && t >= line.at) { b.meet.lines.shift(); game.chat(p.id, line.text); }
  if (b.meet.voted || t < b.meet.voteAt) return;
  b.meet.voted = true;
  let target = 'skip';
  if (p.role === 'impostor') {
    const lead = leadingVote(game, p);
    if (lead.id) target = lead.id;
    else if (b.meet.accusedBy && game.players.get(b.meet.accusedBy)?.alive && Math.random() < 0.5) target = b.meet.accusedBy;
  } else {
    const w = b.witness && game.players.get(b.witness.killer);
    const top = topSuspect(game, p, b);
    const lead = leadingVote(game, p);
    if (w?.alive) target = w.id;
    else if (top && b.sus[top.id] >= 3) target = top.id;
    else if (lead.id && (b.sus[lead.id] || 0) >= 1) target = lead.id;
  }
  game.vote(p.id, target);
}

// ---------- Hooks called by Game ----------

// In the lobby bots amble around the reception room and now and then say something.
const LOBBY_LINES = ["who's hosting today?", 'ready when you are', 'this chai is cold', 'anyone up for table tennis?',
  'I call dibs on the Den', 'is the Wi-Fi okay?', "let's go!", 'I was never the impostor. Never.'];
function lobbyThink(game, p, b, t, dt) {
  const L = b.lobby || (b.lobby = { tx: p.x, ty: p.y, until: 0, sayAt: t + rand(8000, 30000) });
  if (t >= L.until) {
    L.until = t + rand(2500, 8000);
    const idle = Math.random() < 0.35;
    L.tx = idle ? p.x : rand(60, LOBBY.w - 60);
    L.ty = idle ? p.y : rand(LOBBY.panels[0].y + LOBBY.panels[0].h + 40, LOBBY.h - 50);
  }
  const d = Math.hypot(L.tx - p.x, L.ty - p.y);
  if (d > 6) {
    const step = Math.min(d, 85 * dt);
    p.x += ((L.tx - p.x) / d) * step; p.y += ((L.ty - p.y) / d) * step;
    if (Math.abs(L.tx - p.x) > 1) p.facing = L.tx > p.x ? 1 : -1;
    p.moving = true; p.lastMoveAt = t;
  } else p.moving = false;
  if (t >= L.sayAt) { L.sayAt = t + rand(25000, 70000); game.chat(p.id, pick(LOBBY_LINES)); }
}

export function botsTick(game, t, dt) {
  pathBudget = 1;
  for (const p of game.players.values()) {
    if (!p.bot) continue;
    const b = p.brain || (p.brain = newBrain(p, t, game));
    if (game.phase === 'lobby') { lobbyThink(game, p, b, t, dt); continue; }
    if (game.phase === 'meeting') { meetingThink(game, p, b, t); continue; }
    if (game.phase !== 'playing' || game.endAt || game.roleRevealUntil > t) { p.moving = false; continue; }
    if (b.lastTp !== p.tpSeq) { b.lastTp = p.tpSeq; if (!p.inVent) { b.path = null; b.goal = b.goal?.kind === 'vent' ? null : b.goal; } }
    if (b.act && t >= b.act.until) finishAct(game, p, b, t);
    if (p.role === 'impostor') impostorThink(game, p, b, t);
    else crewThink(game, p, b, t);
    if (!b.act && !p.inVent) walk(game, p, b, dt, t);
    else p.moving = false;
  }
}

// Crew bots that can see the killer remember it.
export function botsSawKill(game, killer, victim) {
  const occ = sightBlockers(game);
  for (const p of game.players.values()) {
    if (!p.bot || !p.alive || p.role === 'impostor' || p.id === victim.id) continue;
    if (!p.brain) continue;
    if (canSee(game, p, killer, occ)) {
      p.brain.witness = { killer: killer.id, victim: victim.name };
      p.brain.sus[killer.id] = (p.brain.sus[killer.id] || 0) + 10;
    }
  }
}

export function botsMeetingStarted(game, caller, body) {
  const t = Date.now();
  for (const p of game.players.values()) {
    if (!p.bot) continue;
    const b = p.brain || (p.brain = newBrain(p, t, game));
    stop(b); b.act = null; b.fixId = null;
    planMeeting(game, p, b, t, caller, body);
  }
}

export function botsMeetingEnded(game) {
  for (const p of game.players.values()) {
    if (!p.bot || !p.brain) continue;
    const b = p.brain;
    b.meet = null; b.found = null;
    if (b.witness && !game.players.get(b.witness.killer)?.alive) b.witness = null;
  }
}

// Bots listen to the meeting chat: naming someone makes crew bots a bit more suspicious of them,
// and a bot that gets named defends itself. Real chat rarely uses exact accusing words, so any
// mention of a living player counts a little, and an accusing word alongside it counts a lot more.
const ACCUSE = /\b(sus|kill|killed|killer|vote|saw|near|impostor|imposter|vent|vented|liar|lying)\b/i;
export function botsHeardChat(game, speaker, text) {
  const lower = text.toLowerCase();
  const named = [...game.players.values()].filter((q) => q.id !== speaker.id && q.alive
    && (lower.includes(q.name.toLowerCase()) || new RegExp(`\\b${q.color}\\b`).test(lower)));
  if (!named.length) return;
  const accuseHit = ACCUSE.test(text);
  const weight = accuseHit ? (speaker.bot ? 1 : 2) : (speaker.bot ? 0 : 1);
  if (!weight) return;
  const t = Date.now();
  for (const q of named) {
    for (const p of game.players.values()) {
      if (!p.bot || !p.alive || !p.brain?.meet || p.id === speaker.id) continue;
      const b = p.brain;
      if (p.id === q.id) {
        b.meet.accusedBy = speaker.id;
        if (!b.meet.defended) {
          b.meet.defended = true;
          say(b, pick([`Not me! I was in ${roomAt(p.x, p.y)}.`, `Why me? I was doing tasks.`, `${speaker.name}, that's sus of you.`]), t + rand(1500, 3500));
        }
      } else if (p.role !== 'impostor') {
        b.sus[q.id] = (b.sus[q.id] || 0) + weight;
      }
    }
  }
}
