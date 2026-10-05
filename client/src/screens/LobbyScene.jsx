import { useEffect, useRef } from 'react';
import { LOBBY } from '../shared/map.js';
import { robotImage, isReady, colorHex } from '../robot.js';
import { socket } from '../net.js';
import Joystick from '../Joystick.jsx';
import { IS_TOUCH } from '../hooks.js';

const WALK = 175; // units per second
const BODY_W = 64; // robot width in the lobby
const minY = LOBBY.panels[0].y + LOBBY.panels[0].h + 20;

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

function drawName(g, text, x, y, me) {
  g.font = '700 14px "Chakra Petch", system-ui, sans-serif';
  g.textAlign = 'center';
  const w = g.measureText(text).width + 18;
  g.fillStyle = 'rgba(3,5,12,.72)';
  rr(g, x - w / 2, y - 15, w, 22, 11); g.fill();
  g.fillStyle = me ? '#38E1FF' : '#EAF0FF';
  g.fillText(text, x, y);
}

function drawBubble(g, text, x, y) {
  g.font = '600 15px "Chakra Petch", system-ui, sans-serif';
  const t = text.length > 44 ? `${text.slice(0, 43)}…` : text;
  const w = Math.min(320, g.measureText(t).width + 28);
  g.fillStyle = '#F3F5FF';
  rr(g, x - w / 2, y - 38, w, 34, 14); g.fill();
  g.beginPath(); g.moveTo(x - 7, y - 5); g.lineTo(x, y + 3); g.lineTo(x + 7, y - 5); g.closePath(); g.fill();
  g.fillStyle = '#0A0F1E'; g.textAlign = 'center';
  g.fillText(t, x, y - 16, w - 20);
}

// The reception room: everyone in the lobby walks around here. Walking into the terminal opens Customize.
export default function LobbyScene({ view, onTerminal }) {
  const canvasRef = useRef();
  const joy = useRef({ x: 0, y: 0 });
  const keys = useRef({});
  const local = useRef({ x: 0, y: 0, facing: 1, moving: false, lastTp: -1, lastSent: 0, inTerm: false });
  const others = useRef(new Map());
  const viewRef = useRef(view);
  const termRef = useRef(onTerminal);
  viewRef.current = view;
  termRef.current = onTerminal;

  useEffect(() => {
    const down = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      keys.current[e.code] = true;
    };
    const up = (e) => { keys.current[e.code] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas.getContext('2d');
    let raf, last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const v = viewRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      }
      const L = local.current;
      if (v?.me) {
        if (v.me.tpSeq !== L.lastTp) {
          L.x = v.me.x; L.y = v.me.y; L.lastTp = v.me.tpSeq;
          // Coming back from Customize (this scene starts over) you are still standing on the terminal. Count that as
          // already inside, so it only opens again once you walk off and back on.
          const T0 = LOBBY.terminal;
          L.inTerm = L.x > T0.x && L.x < T0.x + T0.w && L.y > T0.y && L.y < T0.y + T0.h;
        }
        // Walk.
        const k = keys.current;
        let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
        let dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
        if (joy.current.x || joy.current.y) { dx = joy.current.x; dy = joy.current.y; }
        const len = Math.hypot(dx, dy);
        const moving = len > 0;
        if (moving) {
          const step = WALK * dt * Math.min(1, len);
          L.x = Math.max(30, Math.min(LOBBY.w - 30, L.x + (dx / len) * step));
          L.y = Math.max(minY, Math.min(LOBBY.h - 30, L.y + (dy / len) * step));
          if (Math.abs(dx) > 0.15) L.facing = dx > 0 ? 1 : -1;
        }
        if ((moving || L.moving) && t - L.lastSent > 50) {
          socket.emit('move', { x: L.x, y: L.y, facing: L.facing, moving });
          L.lastSent = t; L.moving = moving;
        }
        // Customize terminal.
        const T = LOBBY.terminal;
        const inside = L.x > T.x && L.x < T.x + T.w && L.y > T.y && L.y < T.y + T.h;
        if (inside && !L.inTerm) termRef.current?.();
        L.inTerm = inside;

        // Ease other players toward their server positions.
        const seen = new Set();
        for (const p of v.players) {
          if (p.id === v.me.id) continue;
          seen.add(p.id);
          let o = others.current.get(p.id);
          if (!o || Math.hypot(o.x - p.x, o.y - p.y) > 300) { o = { x: p.x, y: p.y }; others.current.set(p.id, o); }
          const f = Math.min(1, dt * 12);
          o.x += (p.x - o.x) * f; o.y += (p.y - o.y) * f;
        }
        for (const id of others.current.keys()) if (!seen.has(id)) others.current.delete(id);
      }
      draw(g, cw, ch, dpr, t, v, L);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const draw = (g, cw, ch, dpr, t, v, L) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#070B18'; g.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / LOBBY.w, ch / LOBBY.h);
    const ox = (cw - LOBBY.w * s) / 2, oy = (ch - LOBBY.h * s) / 2;
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);

    // Floor grid.
    g.fillStyle = '#0A0F20'; g.fillRect(0, 0, LOBBY.w, LOBBY.h);
    g.strokeStyle = 'rgba(56,225,255,.06)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= LOBBY.w; x += 40) { g.moveTo(x, 0); g.lineTo(x, LOBBY.h); }
    for (let y = 0; y <= LOBBY.h; y += 40) { g.moveTo(0, y); g.lineTo(LOBBY.w, y); }
    g.stroke();
    g.fillStyle = '#5E6A92'; g.font = '700 13px "Chakra Petch", sans-serif'; g.textAlign = 'left';
    g.letterSpacing = '3px'; g.fillText('RECEPTION', 28, 38); g.letterSpacing = '0px';
    g.fillStyle = '#FF8A1F'; g.fillRect(380, 0, 200, 5); // the door on the top wall

    // Wall panels and the strip players start in.
    for (const p of LOBBY.panels) {
      g.fillStyle = '#141D38'; rr(g, p.x, p.y, p.w, p.h, 8); g.fill();
      g.strokeStyle = '#2A3558'; g.lineWidth = 2; rr(g, p.x, p.y, p.w, p.h, 8); g.stroke();
    }
    const Q = LOBBY.queue;
    g.setLineDash([8, 6]); g.strokeStyle = '#26335C'; g.lineWidth = 2; rr(g, Q.x, Q.y, Q.w, Q.h, 6); g.stroke(); g.setLineDash([]);

    // Customize terminal.
    const T = LOBBY.terminal;
    const lit = L.inTerm;
    g.fillStyle = lit ? 'rgba(56,225,255,.16)' : 'rgba(56,225,255,.07)'; rr(g, T.x, T.y, T.w, T.h, 12); g.fill();
    g.strokeStyle = '#38E1FF'; g.lineWidth = lit ? 3 : 2; rr(g, T.x, T.y, T.w, T.h, 12); g.stroke();
    g.fillStyle = '#38E1FF'; g.textAlign = 'center';
    g.strokeStyle = '#38E1FF'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(T.x + T.w / 2 - 22, T.y + 100, 44, 30, 4); g.stroke();
    g.beginPath(); g.moveTo(T.x + T.w / 2 - 12, T.y + 142); g.lineTo(T.x + T.w / 2 + 12, T.y + 142); g.moveTo(T.x + T.w / 2, T.y + 130); g.lineTo(T.x + T.w / 2, T.y + 142); g.stroke();
    g.font = '700 15px "Chakra Petch", sans-serif'; g.letterSpacing = '2px';
    g.fillText('CUSTOMIZE TERMINAL', T.x + T.w / 2, T.y + 166); g.letterSpacing = '0px';

    if (!v?.me) return;
    // Players, back to front.
    const roster = new Map(v.roster.map((r) => [r.id, r]));
    const list = [];
    for (const p of v.players) {
      const info = roster.get(p.id);
      if (!info) continue;
      if (p.id === v.me.id) list.push({ ...p, x: L.x, y: L.y, facing: L.facing, moving: L.moving, info, me: true });
      else { const o = others.current.get(p.id) || p; list.push({ ...p, x: o.x, y: o.y, info }); }
    }
    list.sort((a, b) => a.y - b.y);
    const frame = (p) => (p.moving ? Math.floor(t / 150) % 2 : 0);
    for (const p of list) {
      const img = robotImage({ hex: colorHex(p.info.color), hat: p.info.hat, facing: p.facing, frame: frame(p) });
      const w = BODY_W, h = BODY_W * 1.28;
      const bob = p.moving ? Math.abs(Math.sin(t / 110)) * -3 : 0;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x, p.y + 4, 20, 6, 0, 0, 7); g.fill();
      if (isReady(img)) g.drawImage(img, p.x - w / 2, p.y - h + 8 + bob, w, h);
      drawName(g, p.me ? `${p.info.name} (you)` : p.info.name, p.x, p.y - h - 4, p.me);
      if (p.bubble) drawBubble(g, p.bubble, p.x, p.y - h - 22);
    }
  };

  return (
    <div className="lobby-scene">
      <canvas ref={canvasRef} />
      {IS_TOUCH && <Joystick vecRef={joy} />}
    </div>
  );
}
