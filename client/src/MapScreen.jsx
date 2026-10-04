import { useEffect, useRef } from 'react';
import { WORLD, TASKS, VENTS, SABOTAGE_FIX, ROOMS } from './shared/map.js';
import { mapImage, mapIsReady } from './assets.js';
import { drawObjects } from './taskIcons.js';

// Numbered task tags sit just up and to the right of their object, like the reference map.
const BADGE_OFFSET = { x: 14, y: -14 };
import { drawCameraFeed, colorHex } from './render.js';
import { typeLabel, spotWhere } from './Hud.jsx';
import Icon from './ui/icons.jsx';

const FONT = '"Chakra Petch", system-ui, sans-serif';
const SAB_NAMES = { lights: ['L', 'Fix lights'], comms: ['C', 'Fix network'], wifi: ['W', 'Reset Wi-Fi'] };

function drawOverview(g, w, h, dpr, { view, me, myTasks }) {
  const s = Math.min(w / WORLD.w, h / WORLD.h);
  const ox = (w - WORLD.w * s) / 2, oy = (h - WORLD.h * s) / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  if (mapIsReady()) { g.drawImage(mapImage(), 0, 0, WORLD.w, WORLD.h); drawObjects(g); }
  g.textAlign = 'center'; g.textBaseline = 'middle';

  // Vents with their pair label.
  g.font = `700 13px ${FONT}`;
  for (const v of VENTS) {
    g.fillStyle = 'rgba(3,5,12,.78)'; g.beginPath(); g.roundRect(v.x - 15, v.y - 10, 30, 20, 5); g.fill();
    g.strokeStyle = '#FFCF3F'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#FFCF3F'; g.fillText(v.pair, v.x, v.y + 1);
  }
  // Task tags: green for everything, yellow for the ones you have.
  g.font = `700 12px ${FONT}`;
  for (const t of TASKS) {
    const mine = myTasks.has(t.id);
    g.fillStyle = mine ? '#FFCF3F' : '#3FAE5A';
    g.beginPath(); g.arc(t.x + BADGE_OFFSET.x, t.y + BADGE_OFFSET.y, 11, 0, 7); g.fill();
    g.strokeStyle = '#03050C'; g.lineWidth = 2; g.stroke();
    g.fillStyle = mine ? '#0A0F1E' : '#fff'; g.fillText(String(t.num), t.x + BADGE_OFFSET.x, t.y + BADGE_OFFSET.y + 1);
  }
  // Sabotage fix points.
  for (const [type, fixes] of Object.entries(SABOTAGE_FIX)) {
    for (const f of fixes) {
      const live = view.sabotage?.type === type;
      g.save(); g.translate(f.x, f.y); g.rotate(Math.PI / 4);
      g.fillStyle = live ? '#FF3D5A' : '#FF8A1F'; g.fillRect(-9, -9, 18, 18);
      g.restore();
      g.fillStyle = '#0A0F1E'; g.font = `700 12px ${FONT}`; g.fillText(SAB_NAMES[type][0], f.x, f.y + 1);
    }
  }
  // You.
  if (me) {
    const hex = colorHex(view.roster.find((r) => r.id === view.me.id)?.color);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(me.x, me.y, 15, 0, 7); g.fill();
    g.fillStyle = hex; g.beginPath(); g.arc(me.x, me.y, 10, 0, 7); g.fill();
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// The Office HQ overview (M) and the security camera feed.
export default function MapScreen({ view, localRef, mode, onClose }) {
  const ref = useRef();
  const myTasks = new Set((view.me.tasks || []).map((t) => t.id));
  const viewRefLatest = useRef(view);
  viewRefLatest.current = view;

  useEffect(() => {
    let raf;
    const loop = (t) => {
      const c = ref.current;
      if (c) {
        const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const g = c.getContext('2d');
        if (mode === 'cams') drawCameraFeed(g, w, h, { view: viewRefLatest.current, t, dpr });
        else drawOverview(g, w, h, dpr, { view: viewRefLatest.current, me: localRef.current, myTasks });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const cams = mode === 'cams';
  return (
    <div className="map-screen">
      <header>
        <h1>{cams ? 'Security cameras' : 'Office HQ'}</h1>
        <span className="muted">{cams ? 'Live feed' : `${ROOMS.length} rooms · ${TASKS.length} tasks · 4 vent pairs · 3 sabotages`}</span>
        <button type="button" className="map-close" onClick={onClose} aria-label="Close map"><Icon name="close" size={22} /></button>
      </header>
      <div className="map-body">
        <div className="map-canvas"><canvas ref={ref} /></div>
        {!cams && (
          <aside className="map-side">
            <section className="ui-panel">
              <header><h3>Tasks</h3><small>{view.me.tasks?.length ?? 0} dealt to each player</small></header>
              <ol className="map-tasks">
                {TASKS.map((t) => (
                  <li key={t.id} className={myTasks.has(t.id) ? 'mine' : ''}>
                    <i>{t.num}</i><b>{t.name}</b><span>{t.room}</span><em>{typeLabel(t.type)}</em>
                  </li>
                ))}
              </ol>
            </section>
            <section className="ui-panel">
              <h3>Sabotages</h3>
              {Object.entries(SABOTAGE_FIX).map(([type, fixes]) => (
                <p className="map-sab" key={type}><i>{SAB_NAMES[type][0]}</i><span><b>{SAB_NAMES[type][1]}</b><small>{spotWhere(fixes[0])}{type === 'wifi' ? ' + Call 3' : ''}</small></span></p>
              ))}
            </section>
            <section className="ui-panel">
              <h3>Vents</h3>
              <p className="map-vents">
                {[...new Set(VENTS.map((v) => v.pair))].map((pair) => {
                  const [a, b] = VENTS.filter((v) => v.pair === pair);
                  const room = (v) => ROOMS.find((r) => r.id === v.room)?.name;
                  return <span key={pair}><i>{pair}</i>{room(a)} ↔ {room(b)}</span>;
                })}
              </p>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
