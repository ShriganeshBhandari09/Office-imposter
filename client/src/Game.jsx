import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SPEED, KILL_RANGE, KILL_DISTANCE, REPORT_RANGE, USE_RANGE, VISION, TASKS, SABOTAGE_FIX,
  EMERGENCY_BUTTON, CAMERA_CONSOLE, VENTS, obstaclesFor, moveWithCollision, collides, dist,
} from './shared/map.js';
import { drawWorld, colorHex } from './render.js';
import TaskPopup from './tasks/TaskPopup.jsx';
import Joystick from './Joystick.jsx';
import MapScreen from './MapScreen.jsx';
import Robot from './Robot.jsx';
import RoleReveal from './screens/RoleReveal.jsx';
import Eliminated from './screens/Eliminated.jsx';
import { GhostBanner, GhostPill, GhostChat } from './screens/GhostHud.jsx';
import Icon from './ui/icons.jsx';
import { TaskPanels, ActionDock, AlertOverlay, SabotagePicker, PauseMenu, RulesDialog, spotWhere } from './Hud.jsx';
import { socket, emit } from './net.js';
import { IS_TOUCH } from './hooks.js';

const taskDef = (id) => TASKS.find((t) => t.id === id);

export default function Game({ view, viewRef, onLeave }) {
  const canvasRef = useRef();
  const local = useRef({ x: 0, y: 0, frame: 0, facing: 1, lastTp: -1, moving: false, lastSent: 0 });
  const others = useRef(new Map());
  const keys = useRef({});
  const joy = useRef({ x: 0, y: 0 });
  const [modal, setModal] = useState(null); // { kind: 'task'|'fix'|'map'|'cams'|'sabotage'|'pause'|'rules' }
  const modalRef = useRef(null);
  const [act, setAct] = useState({});
  const actRef = useRef({});
  const markersRef = useRef([]);
  const fakeDone = useRef(new Set());
  const [toast, setToast] = useState('');
  // The cutscene data of my own death, kept after the cutscene ends so the "eliminated" screen can use it.
  const [kill, setKill] = useState(null);
  const [ackedKill, setAckedKill] = useState(0);
  const elimRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(!IS_TOUCH);

  const openModal = useCallback((m) => { modalRef.current = m; setModal(m); }, []);
  const closeModal = useCallback(() => { modalRef.current = null; setModal(null); }, []);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? '' : t)), 2600); };

  // Add ?debug to the URL to expose helpers in the browser console while developing.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__oi = { local: local.current, viewRef, socket, open: (id) => openModal({ kind: 'task', def: taskDef(id) }), openModal };
    }
  }, []);

  useEffect(() => {
    const k = view.me?.killAnim;
    if (k && k.at !== kill?.at) setKill({ at: k.at, killerHex: colorHex(k.killerColor), killerHat: k.killerHat, room: k.room });
  }, [view.me?.killAnim?.at]);
  const pendingElim = !!kill && kill.at !== ackedKill && !view.me?.alive && !view.me?.killAnim;
  elimRef.current = pendingElim;

  // ---------- Actions ----------
  const doUse = () => {
    const u = actRef.current.use;
    if (!u || modalRef.current) return;
    if (u.kind === 'task' || u.kind === 'fix') openModal(u);
    else if (u.kind === 'cams') openModal({ kind: 'cams' });
    else if (u.kind === 'emergency') emit('emergency').then((r) => r.error && flash(r.error));
  };
  // Send where we are right now first, so the server checks range against our real position.
  const syncPos = () => { const L = local.current; socket.emit('move', { x: L.x, y: L.y, facing: L.facing, moving: L.moving }); };
  const doKill = () => { const k = actRef.current.kill; if (k && !actRef.current.killCd) { syncPos(); socket.emit('kill', k); } };
  const doReport = () => { const b = actRef.current.body; if (b) { syncPos(); socket.emit('report', b); } };
  const doVent = () => {
    const v = actRef.current.vent;
    if (v === 'in') socket.emit('vent', 'exit');
    else if (v === 'near') socket.emit('vent', 'enter');
  };
  const doVentMove = () => { if (actRef.current.vent === 'in') socket.emit('vent', 'move'); };
  // Action buttons fire on touch-down: on phones a tap made while the other thumb is on the
  // joystick often never turns into a click. Keyboard activation (click with detail 0) still works.
  const tap = (fn) => ({
    onPointerDown: (e) => { if (e.button === 0) { e.preventDefault(); fn(); } },
    onClick: (e) => { if (e.detail === 0) fn(); },
  });
  const sabotage = (type, room) => {
    closeModal();
    emit('sabotage', { type, room }).then((r) => r.error && flash(r.error));
  };
  // "Open fix task": opens the nearest fix if we stand at it, otherwise points the way.
  const openFix = () => {
    const sab = viewRef.current?.sabotage;
    if (!sab || modalRef.current) return;
    const L = local.current;
    const spots = SABOTAGE_FIX[sab.type] || [];
    const near = spots.find((s) => dist(L, s) <= USE_RANGE);
    if (near) openModal({ kind: 'fix', def: near, label: near.name });
    else flash(`Go to the ${spotWhere(spots[0])}${spots.length > 1 ? ' or Call 3' : ''}.`);
  };

  // ---------- Keyboard ----------
  useEffect(() => {
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keys.current[e.code] = true;
      const m = modalRef.current;
      if (e.code === 'Tab' || e.code === 'KeyM') {
        e.preventDefault();
        if (m?.kind === 'map') closeModal();
        else if (!m) openModal({ kind: 'map' });
        return;
      }
      if (e.code === 'Escape') {
        if (m?.kind === 'task' || m?.kind === 'fix') return; // the task panel closes itself on Esc
        if (m) closeModal();
        else openModal({ kind: 'pause' });
        return;
      }
      if (m) return;
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
      // Phones often have a fractional pixel ratio; round so the canvas isn't reallocated every frame.
      const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph;
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      }
      if (v?.me) {
        const L = local.current;
        const me = v.me;
        const alive = me.alive;
        const isImp = me.role === 'impostor';
        const s = v.settings;
        if (me.tpSeq !== L.lastTp) { L.x = me.x; L.y = me.y; L.lastTp = me.tpSeq; }

        // Movement (client-side, validated by the server). Modals like the pause menu don't stop it for others.
        const canMove = v.phase === 'playing' && !me.inVent && !modalRef.current && !v.roleReveal && !me.killAnim && !elimRef.current;
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
          const step = SPEED * s.playerSpeed * dt * Math.min(1, len);
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
        L.moving = moving;

        // Smooth other players toward their latest server positions.
        const seen = new Set();
        for (const p of v.players) {
          if (p.id === me.id) continue;
          seen.add(p.id);
          let o = others.current.get(p.id);
          if (!o || Math.hypot(o.x - p.x, o.y - p.y) > 200) { o = { x: p.x, y: p.y }; others.current.set(p.id, o); }
          const f = Math.min(1, dt * 14);
          o.x += (p.x - o.x) * f; o.y += (p.y - o.y) * f;
          o.facing = p.facing; o.moving = p.moving; o.fx = p.fx; o.frame = p.moving ? Math.floor(t / 140) % 2 : 0;
        }
        for (const id of others.current.keys()) if (!seen.has(id)) others.current.delete(id);

        // What can I interact with right now?
        const pos = { x: L.x, y: L.y };
        const a = { killCd: me.killCdLeft, vent: null, kill: null, body: null, use: null };
        const playing = v.phase === 'playing' && !v.roleReveal;
        if (playing && alive && isImp && !me.inVent) {
          const range = KILL_RANGE * KILL_DISTANCE[s.killDistance];
          let best = range + 1;
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
              markers.push({ x: f.x, y: f.y, color: '#FF3D5A', arrow: true });
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
        if (m && v.phase !== 'playing' && !['pause', 'rules'].includes(m.kind)) closeModal();
        else if (m?.kind === 'fix' && (!v.sabotage || !SABOTAGE_FIX[v.sabotage.type]?.some((f) => f.id === m.def.id))) closeModal();

        let vision = null;
        if (alive && v.phase === 'playing') {
          vision = isImp
            ? VISION.base * s.impostorVision
            : (v.sabotage?.type === 'lights' ? VISION.lightsOut : VISION.base) * s.crewVision;
        }
        // Frame the camera on the vision circle (sized against the screen's geometric mean, so it reads as zoomed in on a wide
        // phone screen too), so it fills the screen whatever the vision setting
        // (and zooms in when the lights go out). Ghosts and non-playing phases use a fixed zoom.
        // Both ease towards their target so a sabotage shrinks the view smoothly instead of jumping.
        const ease = Math.min(1, dt * 4);
        if (vision) {
          L.vision = L.vision ? L.vision + (vision - L.vision) * ease : vision;
          vision = L.vision;
        } else L.vision = 0;
        const targetZoom = vision
          ? Math.max(0.2, Math.min(4, Math.sqrt(cw * ch) / (2 * vision * 1.08)))
          : Math.max(0.8, Math.min(1.8, ch / 640));
        L.zoom = L.zoom ? L.zoom + (targetZoom - L.zoom) * ease : targetZoom;
        drawWorld(g, cw, ch, { view: v, me: L, others: others.current, zoom: L.zoom, t, markers, killTargetId: a.kill, vision, dpr, fakeDone: fakeDone.current });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const me = view.me;
  const isImp = me?.role === 'impostor';
  const sab = view.sabotage;
  const myRow = view.roster.find((r) => r.id === me?.id);
  const playing = view.phase === 'playing';

  return (
    <div className={`game ${IS_TOUCH ? 'touch' : ''}`}>
      <canvas ref={canvasRef} className="world" />
      {IS_TOUCH && !modal && <Joystick vecRef={joy} />}
      <div className="rotate-hint"><div className="phone" /><p>Turn your phone sideways to play.</p></div>

      {playing && <TaskPanels view={view} taskDef={taskDef} fakeDone={fakeDone.current} />}

      {/* Top-right: map and pause */}
      <div className="hud-top-right">
        {!me?.alive && <button type="button" className="hud-icon" aria-label="Ghost chat" onClick={() => setChatOpen((o) => !o)}><Icon name="chat" size={28} /></button>}
        <button type="button" className="hud-icon" aria-label="Map" onClick={() => !modalRef.current && openModal({ kind: 'map' })}><Icon name="map" size={28} /></button>
        <button type="button" className="hud-icon" aria-label="Menu" onClick={() => !modalRef.current && openModal({ kind: 'pause' })}><Icon name="settings" size={28} /></button>
      </div>

      {/* Bottom-left: where you are */}
      {me?.alive ? <div className="hud-room">{me?.inVent ? 'In a vent' : me?.room}</div> : playing && <GhostPill />}
      {playing && !me?.alive && !pendingElim && <GhostBanner />}
      {playing && !me?.alive && !pendingElim && chatOpen && <GhostChat messages={view.ghostChat || []} />}

      {playing && <AlertOverlay view={view} onOpenFix={openFix} />}
      {toast && <div className="toast">{toast}</div>}
      {me?.inVent && <div className="toast vent">{IS_TOUCH ? 'In vent. Next vent: move · Exit: climb out' : 'In vent. Space: move to the linked vent · V: climb out'}</div>}

      {playing && !view.roleReveal && (
        <ActionDock view={view} act={act} tap={tap} onUse={doUse} onKill={doKill} onReport={doReport}
          onVent={doVent} onVentMove={doVentMove} onSabotage={() => !modalRef.current && openModal({ kind: 'sabotage' })} />
      )}

      {/* Modals */}
      {(modal?.kind === 'task' || modal?.kind === 'fix') && (
        <TaskPopup
          def={modal.def}
          holds={sab?.holds || []}
          resetProgress={sab?.resetProgress || 0}
          playerName={myRow?.name}
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
        <MapScreen view={view} localRef={local} mode={modal.kind} onClose={closeModal} />
      )}
      {modal?.kind === 'sabotage' && me && <SabotagePicker me={me} onPick={sabotage} onClose={closeModal} />}
      {modal?.kind === 'pause' && (
        <PauseMenu onResume={closeModal} onRules={() => openModal({ kind: 'rules' })}
          onLeave={() => { closeModal(); onLeave(); }} />
      )}
      {modal?.kind === 'rules' && <RulesDialog settings={view.settings} onClose={() => openModal({ kind: 'pause' })} />}

      {view.roleReveal && <RoleReveal view={view} />}

      {pendingElim && <Eliminated view={view} kill={kill} onContinue={() => setAckedKill(kill.at)} />}

      {me?.killAnim && (
        <div key={me.killAnim.at} className="kill-screen" aria-live="assertive">
          <div className="kill-band">
            <Robot className="kill-killer" hex={colorHex(me.killAnim.killerColor)} size={110} />
            <div className="kill-slash" />
            {myRow && <Robot className="kill-victim" color={myRow.color} hat={myRow.hat} size={110} />}
            <div className="kill-splat" />
          </div>
          <p className="kill-text">You were killed.</p>
        </div>
      )}
    </div>
  );
}
