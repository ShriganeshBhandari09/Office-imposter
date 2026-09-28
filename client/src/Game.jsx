import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SPEED, KILL_RANGE, REPORT_RANGE, USE_RANGE, VISION, ROOMS, TASKS, SABOTAGE_FIX,
  EMERGENCY_BUTTON, CAMERA_CONSOLE, VENTS, obstaclesFor, moveWithCollision, collides, dist,
} from './shared/map.js';
import { drawWorld, drawMiniMap, invalidateStatic, colorHex, spriteURL } from './render.js';
import Minigame from './Minigames.jsx';
import { socket, emit } from './net.js';

const taskDef = (id) => TASKS.find((t) => t.id === id);
const SAB_LABEL = {
  lights: 'Lights are out! Fix the power panel at Desk 6.',
  comms: 'Network jammed! Tasks are hidden. Fix the router in Call 1.',
  wifi: 'Wi-Fi is down! Two people must reset it in Security and Call 3.',
};

// Phones and tablets get an on-screen joystick and touch-sized buttons.
const IS_TOUCH = typeof window !== 'undefined'
  && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

// Floating joystick: touch anywhere in the left half of the screen and drag.
// Writes a vector (length 0..1) into vecRef, read by the movement loop.
const JOY_R = 56;
function Joystick({ vecRef }) {
  const [stick, setStick] = useState(null);
  const pid = useRef(null);
  const base = useRef(null);
  // Stop walking if the joystick disappears mid-drag (e.g. a task opens).
  useEffect(() => () => { vecRef.current = { x: 0, y: 0 }; }, []);
  const end = (e) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    vecRef.current = { x: 0, y: 0 };
    setStick(null);
  };
  return (
    <div
      className="joy-zone"
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        base.current = { x: e.clientX, y: e.clientY };
        setStick({ bx: e.clientX, by: e.clientY, kx: 0, ky: 0 });
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pid.current) return;
        let dx = e.clientX - base.current.x, dy = e.clientY - base.current.y;
        const len = Math.hypot(dx, dy);
        if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
        vecRef.current = len < JOY_R * 0.18 ? { x: 0, y: 0 } : { x: dx / JOY_R, y: dy / JOY_R };
        setStick({ bx: base.current.x, by: base.current.y, kx: dx, ky: dy });
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {stick ? (
        <div className="joy-base" style={{ left: stick.bx, top: stick.by }}>
          <div className="joy-knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
        </div>
      ) : <div className="joy-hint">Drag here to move</div>}
    </div>
  );
}

function MiniCanvas({ viewRef, localRef, mode, markersRef }) {
  const ref = useRef();
  useEffect(() => {
    let raf;
    const loop = (t) => {
      const c = ref.current;
      if (c && viewRef.current) {
        const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
        if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
        const g = c.getContext('2d');
        drawMiniMap(g, w, h, { view: viewRef.current, me: localRef.current, markers: markersRef.current, camerasOnly: mode === 'cams', t, dpr });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);
  return <canvas ref={ref} className="minimap" />;
}

export default function Game({ view, viewRef }) {
  const canvasRef = useRef();
  const local = useRef({ x: 0, y: 0, frame: 0, facing: 1, lastTp: -1, moving: false, lastSent: 0 });
  const others = useRef(new Map());
  const keys = useRef({});
  const joy = useRef({ x: 0, y: 0 });
  const [modal, setModal] = useState(null);
  const modalRef = useRef(null);
  const [act, setAct] = useState({});
  const actRef = useRef({});
  const markersRef = useRef([]);
  const fakeDone = useRef(new Set());
  const [toast, setToast] = useState('');
  const [sabOpen, setSabOpen] = useState(!IS_TOUCH);
  const [tasksOpen, setTasksOpen] = useState(true);

  const openModal = useCallback((m) => { modalRef.current = m; setModal(m); }, []);
  const closeModal = useCallback(() => { modalRef.current = null; setModal(null); }, []);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2500); };

  // Fonts load after first paint; redraw the static map once they are ready.
  useEffect(() => { document.fonts?.ready.then(invalidateStatic); }, []);
  // Add ?debug to the URL to expose helpers in the browser console while developing.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__oi = { local: local.current, viewRef, socket, open: (id) => openModal({ kind: 'task', def: taskDef(id) }), openModal };
    }
  }, []);

  // ---------- Actions ----------
  const doUse = () => {
    const u = actRef.current.use;
    if (!u || modalRef.current) return;
    if (u.kind === 'task' || u.kind === 'fix') openModal(u);
    else if (u.kind === 'cams') openModal({ kind: 'cams' });
    else if (u.kind === 'emergency') emit('emergency').then((r) => r.error && flash(r.error));
  };
  const doKill = () => { const k = actRef.current.kill; if (k && !actRef.current.killCd) socket.emit('kill', k); };
  const doReport = () => { const b = actRef.current.body; if (b) socket.emit('report', b); };
  const doVent = () => {
    const v = actRef.current.vent;
    if (v === 'in') socket.emit('vent', 'exit');
    else if (v === 'near') socket.emit('vent', 'enter');
  };
  const doVentMove = () => { if (actRef.current.vent === 'in') socket.emit('vent', 'move'); };
  const sabotage = (type, room) => emit('sabotage', { type, room }).then((r) => r.error && flash(r.error));

  // ---------- Keyboard ----------
  useEffect(() => {
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keys.current[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (modalRef.current?.kind === 'map') closeModal();
        else if (!modalRef.current) openModal({ kind: 'map' });
        return;
      }
      if (e.code === 'Escape' && modalRef.current) { closeModal(); return; }
      if (modalRef.current) return;
      if (e.code === 'KeyE') doUse();
      else if (e.code === 'KeyQ') doKill();
      else if (e.code === 'KeyR') doReport();
      else if (e.code === 'KeyV') doVent();
      else if (e.code === 'Space') { e.preventDefault(); doVentMove(); }
    };
    const up = (e) => { keys.current[e.code] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // ---------- Main loop ----------
  useEffect(() => {
    let raf, last = performance.now();
    const canvas = canvasRef.current;
    const g = canvas.getContext('2d');
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const v = viewRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cw = window.innerWidth, ch = window.innerHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      }
      if (v?.me) {
        const L = local.current;
        const me = v.me;
        const alive = me.alive;
        const isImp = me.role === 'impostor';
        if (me.tpSeq !== L.lastTp) { L.x = me.x; L.y = me.y; L.lastTp = me.tpSeq; }

        // Movement (client-side, validated by the server).
        const canMove = v.phase === 'playing' && !me.inVent && !modalRef.current && !v.roleReveal && !me.killAnim;
        let dx = 0, dy = 0;
        if (canMove) {
          const k = keys.current;
          if (k.KeyA || k.ArrowLeft) dx -= 1;
          if (k.KeyD || k.ArrowRight) dx += 1;
          if (k.KeyW || k.ArrowUp) dy -= 1;
          if (k.KeyS || k.ArrowDown) dy += 1;
          // The joystick wins when it is in use; it is analog, so a small push walks slowly.
          if (joy.current.x || joy.current.y) { dx = joy.current.x; dy = joy.current.y; }
        }
        const moving = dx !== 0 || dy !== 0;
        if (moving) {
          const len = Math.hypot(dx, dy);
          const step = SPEED * dt * Math.min(1, len);
          const obs = alive ? obstaclesFor(Object.keys(v.doors || {})).filter((o) => !collides(L.x, L.y, [o])) : [];
          const np = moveWithCollision(L.x, L.y, (dx / len) * step, (dy / len) * step, obs, !alive);
          L.x = np.x; L.y = np.y;
          if (Math.abs(dx) > 0.15) L.facing = dx > 0 ? 1 : -1;
        }
        L.frame = moving ? Math.floor(t / 140) % 2 : 0;
        if (v.phase === 'playing' && !me.inVent && (moving || L.moving) && t - L.lastSent > 50) {
          socket.emit('move', { x: L.x, y: L.y, facing: L.facing, moving });
          L.lastSent = t;
          L.moving = moving;
        }

        // Smooth other players toward their latest server positions.
        const seen = new Set();
        for (const p of v.players) {
          if (p.id === me.id) continue;
          seen.add(p.id);
          let o = others.current.get(p.id);
          if (!o || Math.hypot(o.x - p.x, o.y - p.y) > 200) { o = { x: p.x, y: p.y }; others.current.set(p.id, o); }
          const f = Math.min(1, dt * 14);
          o.x += (p.x - o.x) * f; o.y += (p.y - o.y) * f;
          o.facing = p.facing; o.frame = p.moving ? Math.floor(t / 140) % 2 : 0;
        }
        for (const id of others.current.keys()) if (!seen.has(id)) others.current.delete(id);

        // What can I interact with right now?
        const pos = { x: L.x, y: L.y };
        const a = { killCd: me.killCdLeft, vent: null, kill: null, body: null, use: null };
        const playing = v.phase === 'playing' && !v.roleReveal;
        if (playing && alive && isImp && !me.inVent) {
          let best = KILL_RANGE + 1;
          for (const p of v.players) {
            const info = v.roster.find((r) => r.id === p.id);
            if (p.id === me.id || !p.alive || info?.role === 'impostor') continue;
            const o = others.current.get(p.id) || p;
            const d = dist(pos, o);
            if (d < best) { best = d; a.kill = p.id; }
          }
        }
        if (playing && alive && !me.inVent) {
          let best = REPORT_RANGE + 1;
          for (const b of v.bodies) { const d = dist(pos, b); if (d < best) { best = d; a.body = b.id; } }
        }
        const markers = [];
        if (playing && !me.inVent) {
          const fixes = v.sabotage ? SABOTAGE_FIX[v.sabotage.type] || [] : [];
          if (alive) {
            for (const f of fixes) {
              markers.push({ x: f.x, y: f.y, color: '#ff1744', arrow: true });
              if (!a.use && dist(pos, f) <= USE_RANGE) a.use = { kind: 'fix', def: f, label: f.name };
            }
          }
          // Tasks, the emergency button and cameras: whichever is closest wins.
          let bestUse = Infinity;
          const consider = (d, u) => { if (!a.use || (a.use.kind !== 'fix' && d < bestUse)) { a.use = u; bestUse = d; } };
          for (const tk of me.tasks || []) {
            const d = taskDef(tk.id);
            const done = tk.done || fakeDone.current.has(tk.id);
            if (done) continue;
            markers.push({ x: d.x, y: d.y, color: '#ffd740' });
            const dd = dist(pos, d);
            if (dd <= USE_RANGE) consider(dd, { kind: 'task', def: d, label: d.name });
          }
          const db = dist(pos, EMERGENCY_BUTTON);
          if (alive && db <= USE_RANGE + 30) consider(db - 30, { kind: 'emergency', label: 'Emergency meeting' });
          const dc = dist(pos, CAMERA_CONSOLE);
          if (alive && dc <= USE_RANGE) consider(dc, { kind: 'cams', label: 'Security cameras' });
          if (alive && isImp && VENTS.some((vt) => dist(pos, vt) <= USE_RANGE)) a.vent = 'near';
        }
        if (me.inVent) a.vent = 'in';
        markersRef.current = markers;
        const sig = JSON.stringify([a.killCd, a.vent, a.kill, a.body, a.use?.kind, a.use?.def?.id]);
        if (sig !== actRef.current.sig) { a.sig = sig; actRef.current = a; setAct(a); }

        // Close a fix modal once the sabotage is resolved; close everything outside play.
        const m = modalRef.current;
        if (m && (v.phase !== 'playing' || (m.kind === 'fix' && (!v.sabotage || !SABOTAGE_FIX[v.sabotage.type]?.some((f) => f.id === m.def.id))))) {
          closeModal();
        }

        let vision = null;
        if (alive && v.phase === 'playing') {
          const pct = ((isImp ? v.settings?.impostorVision : v.settings?.crewVision) ?? 100) / 100;
          vision = isImp ? VISION.impostor * pct : (v.sabotage?.type === 'lights' ? VISION.lightsOut : VISION.crew) * pct;
        }
        const zoom = Math.max(0.8, Math.min(1.8, ch / 640));
        drawWorld(g, cw, ch, { view: v, me: L, others: others.current, zoom, t, markers, killTargetId: a.kill, vision, dpr });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const me = view.me;
  const isImp = me?.role === 'impostor';
  const alive = me?.alive;
  const isHost = view.hostId === me?.id;
  const sab = view.sabotage;
  const mates = view.roster.filter((r) => r.role === 'impostor' && r.id !== me?.id);

  return (
    <div className={`game ${IS_TOUCH ? 'touch' : ''}`}>
      <canvas ref={canvasRef} className="world" />
      {IS_TOUCH && !modal && <Joystick vecRef={joy} />}
      <div className="rotate-hint"><div className="phone" /><p>Turn your phone sideways to play.</p></div>
      {sab?.type === 'wifi' && <div className="critical-tint" />}

      {/* Top-left: tasks */}
      <div className={`panel tasks ${tasksOpen ? '' : 'closed'}`}>
        {IS_TOUCH && <button className="panel-toggle" onClick={() => setTasksOpen((o) => !o)}>Tasks {tasksOpen ? '▾' : '▸'}</button>}
        {view.taskProgress !== null ? (
          <>
            <div className="label">Total tasks completed</div>
            <div className="bar"><div style={{ width: `${(view.taskProgress || 0) * 100}%` }} /></div>
          </>
        ) : <div className="label warn">Task bar offline (network jammed)</div>}
        {isImp && (
          <div className="imp-note">
            <b>Impostor.</b> Eliminate the crew without getting caught.
            {mates.length > 0 && <div>Partner: {mates.map((m) => m.name).join(', ')}</div>}
            <div className="muted">Fake tasks (for cover):</div>
          </div>
        )}
        {me?.tasks ? (
          <ul>
            {me.tasks.map((tk) => {
              const d = taskDef(tk.id);
              const done = tk.done || fakeDone.current.has(tk.id);
              return <li key={tk.id} className={done ? 'done' : ''}>{d.room}: {d.name}</li>;
            })}
          </ul>
        ) : <div className="muted">Tasks hidden until the network is fixed.</div>}
        {!alive && <div className="ghost-note">You are dead. {isImp ? 'You can still sabotage.' : 'Finish your tasks as a ghost.'}</div>}
      </div>

      {/* Top-right: location + host controls */}
      <div className="panel where">
        <div>{me?.inVent ? 'In a vent' : me?.room}</div>
        {!IS_TOUCH && <div className="muted small">Tab: map · WASD: move</div>}
        <button className="btn tiny" onClick={() => !modalRef.current && openModal({ kind: 'map' })}>Map</button>
        {isHost && <button className="btn tiny" onClick={() => confirm('End this game for everyone?') && socket.emit('backToLobby')}>End game</button>}
      </div>

      {/* Sabotage banners */}
      {sab && alive && (
        <div className={`banner ${sab.type === 'wifi' ? 'crit' : ''}`}>
          {SAB_LABEL[sab.type]}{sab.secondsLeft != null && <b> {sab.secondsLeft}s</b>}
          {sab.type === 'wifi' && <span className="small"> ({sab.holds.length}/2 panels held)</span>}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {me?.inVent && <div className="banner vent">{IS_TOUCH ? 'In vent. Next vent: move · Exit vent: climb out' : 'In vent. Space: move to the linked vent · V: climb out'}</div>}

      {/* Impostor sabotage panel */}
      {isImp && view.phase === 'playing' && (
        <div className="panel sab">
          <button className="sab-head" onClick={() => setSabOpen((o) => !o)}>Sabotage {sabOpen ? '▾' : '▸'}</button>
          {sabOpen && (
            <>
              <div className="muted small">{me.sabCdLeft > 0 ? `Recharging ${me.sabCdLeft}s` : sab ? 'A sabotage is active' : 'Ready'}</div>
              <div className="sab-grid">
                <button className="btn" disabled={me.sabCdLeft > 0 || !!sab} onClick={() => sabotage('lights')}>Lights</button>
                <button className="btn" disabled={me.sabCdLeft > 0 || !!sab} onClick={() => sabotage('comms')}>Network</button>
                <button className="btn danger" disabled={me.sabCdLeft > 0 || !!sab} onClick={() => sabotage('wifi')}>Wi-Fi (critical)</button>
              </div>
              <div className="muted small">Lock doors (10s)</div>
              <div className="sab-grid">
                {ROOMS.filter((r) => r.lockable).map((r) => {
                  const cd = me.doorCd?.[r.id] || 0;
                  return <button key={r.id} className="btn tiny" disabled={cd > 0} onClick={() => sabotage('doors', r.id)}>{r.name}{cd > 0 ? ` ${cd}s` : ''}</button>;
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="actions">
        <button className="act" disabled={!act.use} onClick={doUse}>
          <span className="key">E</span>{act.use?.label || 'Use'}
        </button>
        {alive && <button className="act report" disabled={!act.body} onClick={doReport}><span className="key">R</span>Report</button>}
        {isImp && alive && (
          <>
            <button className="act kill" disabled={!act.kill || act.killCd > 0} onClick={doKill}>
              <span className="key">Q</span>{act.killCd > 0 ? `Kill ${act.killCd}s` : 'Kill'}
            </button>
            {act.vent === 'in' && (
              <button className="act" onClick={doVentMove}><span className="key">Space</span>Next vent</button>
            )}
            <button className="act" disabled={!act.vent} onClick={doVent}>
              <span className="key">V</span>{act.vent === 'in' ? 'Exit vent' : 'Vent'}
            </button>
          </>
        )}
      </div>

      {/* Modals */}
      {(modal?.kind === 'task' || modal?.kind === 'fix') && (
        <Minigame
          def={modal.def}
          holds={sab?.holds || []}
          onHold={(holding) => socket.emit('wifiHold', { id: modal.def.id, holding })}
          onClose={closeModal}
          onDone={() => {
            if (modal.kind === 'fix') socket.emit('fixSabotage', modal.def.id);
            else if (isImp) fakeDone.current.add(modal.def.id);
            else socket.emit('completeTask', modal.def.id);
            closeModal();
          }}
        />
      )}
      {(modal?.kind === 'map' || modal?.kind === 'cams') && (
        <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal wide">
            <div className="modal-head">
              <h2>{modal.kind === 'cams' ? 'Security cameras' : 'Office map'}</h2>
              <button className="x" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <MiniCanvas viewRef={viewRef} localRef={local} markersRef={markersRef} mode={modal.kind} />
            <p className="hint">{modal.kind === 'map' ? 'Yellow: your tasks · Red: sabotage' : 'Live feed'}</p>
          </div>
        </div>
      )}

      {view.roleReveal && (
        <div className={`reveal ${isImp ? 'imp' : 'crew'}`}>
          <h1>{isImp ? 'Impostor' : 'Crewmate'}</h1>
          <p>{isImp
            ? mates.length ? `Your partner: ${mates.map((m) => m.name).join(', ')}` : 'Eliminate the crew. Don\'t get caught.'
            : `There ${view.roster.length > 0 && view.settings.impostors > 1 ? 'are impostors' : 'is an impostor'} among you.`}</p>
          <img className="reveal-sprite" alt="" src={spriteURL(colorHex(view.roster.find((r) => r.id === me?.id)?.color))} />
        </div>
      )}

      {me?.killAnim && (
        <div key={me.killAnim.at} className="kill-screen" aria-live="assertive">
          <div className="kill-band">
            <img className="kill-killer" alt="" src={spriteURL(colorHex(me.killAnim.killerColor))} />
            <div className="kill-slash" />
            <img className="kill-victim" alt="" src={spriteURL(colorHex(view.roster.find((r) => r.id === me.id)?.color))} />
            <div className="kill-splat" />
          </div>
          <p className="kill-text">You were killed.</p>
        </div>
      )}
    </div>
  );
}
