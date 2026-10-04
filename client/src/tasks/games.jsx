// The 22 task games and 3 sabotage fixes. Every game draws inside the 520 x 284 work area of the task
// popup and works with touch (pointer events, no hover). Positions inside the area are in popup pixels:
// the popup is scaled to fit small screens, so pointer positions go through local() first.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../ui/icons.jsx';

const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = (a) => a[rand(a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Pointer position inside an element, in its own (unscaled) pixels.
function local(e, el) {
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * el.offsetWidth) / r.width, y: ((e.clientY - r.top) * el.offsetHeight) / r.height };
}

// Shows the "task complete" state for a moment, then reports the result.
function useFinish(onDone) {
  const [done, setDone] = useState(false);
  const fired = useRef(false);
  const finish = () => {
    if (fired.current) return;
    fired.current = true;
    setDone(true);
    setTimeout(onDone, 950);
  };
  return [done, finish];
}

// Work area + footer. hint on the left, status on the right.
function Shell({ hint, status, done, children, className = '' }) {
  return (
    <>
      <div className={`tp-work ${className}`}>
        {children}
        {done && (
          <div className="tp-complete"><span><Icon name="check" size={34} strokeWidth={3} /></span><b>Task complete</b></div>
        )}
      </div>
      <footer className="tp-foot"><span>{hint}</span><em>{status}</em></footer>
    </>
  );
}

// Segmented meter: 3px gaps, radius 2, empty segments are faint.
function Meter({ value, segments = 20, className = '' }) {
  const on = Math.round(clamp(value, 0, 1) * segments);
  return <div className={`tp-meter ${className}`}>{Array.from({ length: segments }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}</div>;
}

const pctText = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;

// ---------- Hold (chai, plant, laptop) ----------
const HOLDS = {
  cafe_chai: { label: 'Cup', read: (p) => `${Math.round(p * 200)} ml`, verb: 'Hold', sub: 'to pour', seconds: 3, hint: 'Hold until the cup is full.' },
  den_plant: { label: 'Soil', read: pctText, verb: 'Hold', sub: 'to water', seconds: 3, hint: 'Hold until the soil is wet.' },
  desk6_charge: { label: 'Battery', read: pctText, verb: 'Hold', sub: 'to charge', seconds: 4, hint: 'Hold until the battery is full.' },
};

// A big round button you press and hold. Progress eases back if you let go.
function HoldButton({ holding, onHold, verb, sub, alert }) {
  return (
    <div className={`tp-hold ${holding ? 'on' : ''} ${alert ? 'alert' : ''}`}>
      <button type="button" aria-label={`${verb} ${sub}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHold(true); }}
        onPointerUp={() => onHold(false)} onPointerCancel={() => onHold(false)} onContextMenu={(e) => e.preventDefault()}>
        <b>{verb}</b><small>{sub}</small>
      </button>
    </div>
  );
}

function Hold({ def, onDone }) {
  const cfg = HOLDS[def.id] || HOLDS.cafe_chai;
  const [p, setP] = useState(0);
  const [holding, setHolding] = useState(false);
  const prog = useRef(0), hold = useRef(false);
  const [done, finish] = useFinish(onDone);
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (prog.current < 1) {
        prog.current = hold.current ? Math.min(1, prog.current + dt / cfg.seconds) : Math.max(0, prog.current - dt / 6);
        setP(prog.current);
        if (prog.current >= 1) finish();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const set = (v) => { hold.current = v; setHolding(v); };
    const down = (e) => { if (e.code === 'Space') { e.preventDefault(); set(true); } };
    const up = (e) => { if (e.code === 'Space') set(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  const set = (v) => { hold.current = v; setHolding(v); };
  return (
    <Shell hint={cfg.hint} status={pctText(p)} done={done}>
      <div className="tp-hold-row">
        <div className="tp-readout"><small>{cfg.label}</small><b>{cfg.read(p)}</b><Meter value={p} /></div>
        <HoldButton holding={holding} onHold={set} verb={cfg.verb} sub={cfg.sub} />
      </div>
    </Shell>
  );
}

// ---------- Mop (spill) and erase (whiteboard) ----------
const SPILLS = [{ x: 70, y: 90, r: 42 }, { x: 175, y: 55, r: 36 }, { x: 330, y: 70, r: 32 }, { x: 255, y: 175, r: 48 }, { x: 140, y: 200, r: 34 }, { x: 410, y: 160, r: 38 }];
const WORDS = [{ t: 'Q3 roadmap', x: 90, y: 95, r: 62 }, { t: 'launch nov', x: 330, y: 80, r: 58 }, { t: 'priority', x: 210, y: 150, r: 48 }, { t: 'budget', x: 90, y: 205, r: 46 }, { t: 'call HR', x: 360, y: 205, r: 46 }];

// Drag across the targets to wear them away.
function Mop({ def, onDone }) {
  const erase = def.id === 'conf_board';
  const items = useMemo(() => (erase ? WORDS : SPILLS), [erase]);
  const [left, setLeft] = useState(() => items.map(() => 1)); // 1 = untouched, 0 = clean
  const area = useRef();
  const last = useRef(null);
  const [done, finish] = useFinish(onDone);
  const scrub = (e) => {
    if (done || !last.current) return;
    const p = local(e, area.current);
    const moved = Math.hypot(p.x - last.current.x, p.y - last.current.y);
    last.current = p;
    setLeft((cur) => {
      const next = cur.map((v, i) => (Math.hypot(p.x - items[i].x, p.y - items[i].y) <= items[i].r + 12 ? Math.max(0, v - moved / (items[i].r * 3.2)) : v));
      if (next.every((v) => v <= 0.02)) setTimeout(finish, 0);
      return next;
    });
  };
  const clean = 1 - left.reduce((a, b) => a + b, 0) / left.length;
  return (
    <Shell hint={erase ? 'Press and drag over the board to erase.' : 'Press and drag over the spill to mop it.'} status={`${pctText(clean)} clean`} done={done}>
      <div className="tp-drag" ref={area}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = local(e, area.current); }}
        onPointerMove={scrub} onPointerUp={() => { last.current = null; }} onPointerCancel={() => { last.current = null; }}>
        {items.map((it, i) => (erase
          ? <span key={i} className="tp-word" style={{ left: it.x, top: it.y, opacity: left[i] }}>{it.t}</span>
          : <span key={i} className="tp-spill" style={{ left: it.x, top: it.y, width: it.r * 2, height: it.r * 1.5, opacity: Math.max(0, left[i]) }} />))}
      </div>
    </Shell>
  );
}

// ---------- Wires (server, headset, laptop) ----------
const WIRE_SETS = {
  spark_debug: ['#FF6B7D', '#5AA8FF', '#F5B84B', '#4ADE80'],
  call2_headset: ['#FF9A5C', '#38E1FF', '#FF7BB0', '#E6EAF2'],
  desk2_wires: ['#FF6B7D', '#5AA8FF', '#F5B84B', '#B58CFF'],
};

function Wires({ def, onDone }) {
  const colors = WIRE_SETS[def.id] || WIRE_SETS.spark_debug;
  const right = useMemo(() => { let r; do r = shuffle(colors.map((_, i) => i)); while (r.every((v, i) => v === i)); return r; }, []);
  const [sel, setSel] = useState(null); // { side, i }
  const [linked, setLinked] = useState([]); // colour indexes
  const [bad, setBad] = useState(0);
  const [done, finish] = useFinish(onDone);
  const ys = colors.map((_, i) => 46 + i * 64);
  const tap = (side, i) => {
    if (done) return;
    const c = side === 'L' ? i : right[i];
    if (linked.includes(c)) return;
    if (!sel || sel.side === side) { setSel({ side, i, c }); return; }
    if (sel.c === c) {
      const next = [...linked, c];
      setLinked(next); setSel(null);
      if (next.length === colors.length) finish();
    } else { setSel(null); setBad((b) => b + 1); }
  };
  return (
    <Shell hint="Tap a wire, then tap the same colour." status={`${linked.length} / ${colors.length} joined`} done={done}>
      <svg className={`tp-wires ${bad ? `shake${bad % 2}` : ''}`} viewBox="0 0 520 284">
        {colors.map((col, i) => {
          const ri = right.indexOf(i);
          const joined = linked.includes(i);
          return (
            <g key={i}>
              <line x1="24" x2="76" y1={ys[i]} y2={ys[i]} stroke={col} strokeWidth="6" strokeLinecap="round" opacity={joined ? 1 : 0.9} />
              <line x1="444" x2="496" y1={ys[ri]} y2={ys[ri]} stroke={col} strokeWidth="6" strokeLinecap="round" opacity={joined ? 1 : 0.9} />
              {joined && <path d={`M76 ${ys[i]} C 220 ${ys[i]}, 300 ${ys[ri]}, 444 ${ys[ri]}`} stroke={col} strokeWidth="6" fill="none" strokeLinecap="round" />}
            </g>
          );
        })}
        {colors.map((col, i) => (
          <g key={`l${i}`} className="tp-knob" onPointerDown={(e) => { e.preventDefault(); tap('L', i); }}>
            <circle cx="76" cy={ys[i]} r="30" fill="transparent" />
            <circle cx="76" cy={ys[i]} r="11" fill={col} stroke={sel?.side === 'L' && sel.i === i ? '#fff' : 'none'} strokeWidth="3" />
          </g>
        ))}
        {right.map((c, i) => (
          <g key={`r${i}`} className="tp-knob" onPointerDown={(e) => { e.preventDefault(); tap('R', i); }}>
            <circle cx="444" cy={ys[i]} r="30" fill="transparent" />
            <circle cx="444" cy={ys[i]} r="11" fill={colors[c]} stroke={sel?.side === 'R' && sel.i === i ? '#fff' : 'none'} strokeWidth="3" />
          </g>
        ))}
      </svg>
    </Shell>
  );
}

// ---------- Shred documents ----------
const DOCS = ['Payroll_Sept.pdf', 'Offer_letter.docx', 'Vendor_contract.pdf', 'Bank_statement.pdf', 'Client_list.xlsx', 'Salary_review.xlsx', 'Board_minutes.docx'];
function Shred({ onDone }) {
  const docs = useMemo(() => shuffle(DOCS).slice(0, 5), []);
  const [gone, setGone] = useState([]);
  const [done, finish] = useFinish(onDone);
  const next = docs.findIndex((_, i) => !gone.includes(i));
  const tap = (i) => {
    if (done || gone.includes(i)) return;
    const g = [...gone, i];
    setGone(g);
    if (g.length === docs.length) finish();
  };
  return (
    <Shell hint="Shred each document." status={`${gone.length} / ${docs.length}`} done={done}>
      <ul className="tp-files">
        {docs.map((d, i) => (
          <li key={d}>
            <button type="button" className={`${gone.includes(i) ? 'gone' : ''} ${i === next ? 'next' : ''}`} onClick={() => tap(i)}>
              <span>{d}</span><em>{gone.includes(i) ? 'shredded' : i === next ? 'shred' : ''}</em>
            </button>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

// ---------- Breakers (reboot PC, fix lights) ----------
const BREAKERS = {
  hive_reboot: { names: ['Power', 'BIOS', 'Disk', 'Network', 'Boot'], hint: 'Turn every switch on.' },
  lights: { names: ['A', 'B', 'C', 'D', 'E'], hint: 'Flip every breaker on.' },
};
function Breakers({ def, onDone }) {
  const cfg = BREAKERS[def.id] || BREAKERS.lights;
  const [on, setOn] = useState(() => { const a = cfg.names.map(() => Math.random() < 0.4); if (a.every(Boolean)) a[rand(a.length)] = false; return a; });
  const [done, finish] = useFinish(onDone);
  const flip = (i) => {
    if (done) return;
    const n = on.map((v, j) => (j === i ? !v : v));
    setOn(n);
    if (n.every(Boolean)) finish();
  };
  return (
    <Shell hint={cfg.hint} status={`${on.filter(Boolean).length} / ${on.length} on`} done={done}>
      <div className="tp-breakers">
        {cfg.names.map((name, i) => (
          <button key={name} type="button" className={on[i] ? 'on' : ''} onClick={() => flip(i)} aria-pressed={on[i]}>
            <i><s /></i><b>{name}</b><small>{on[i] ? 'ON' : 'OFF'}</small>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ---------- Restock supplies ----------
const SUPPLIES = ['Toilet roll', 'Hand soap', 'Paper towel', 'Sanitiser', 'Bin liners', 'Air freshener'];
function Restock({ onDone }) {
  const [fill, setFill] = useState(() => SUPPLIES.map(() => 0)); // 0, 1 or 2 taps
  const [done, finish] = useFinish(onDone);
  const tap = (i) => {
    if (done || fill[i] >= 2) return;
    const n = fill.map((v, j) => (j === i ? v + 1 : v));
    setFill(n);
    if (n.every((v) => v >= 2)) finish();
  };
  return (
    <Shell hint="Refill every empty slot." status={`${fill.filter((v) => v >= 2).length} / ${SUPPLIES.length}`} done={done}>
      <div className="tp-slots">
        {SUPPLIES.map((s, i) => (
          <button key={s} type="button" className={fill[i] >= 2 ? 'full' : ''} onClick={() => tap(i)}>
            <b>{s}</b><Meter value={fill[i] / 2} segments={2} /><small>{fill[i] >= 2 ? 'Full' : fill[i] === 1 ? 'Half · tap' : 'Empty · tap'}</small>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ---------- Tap in order (files, pages, notes) ----------
const ORDER = {
  pixel_sort: { noun: 'FILE', hint: 'Tap the files in order, 1 to 6.' },
  den_sign: { noun: 'PAGE', hint: 'Sign the pages in order, 1 to 6.' },
  desk5_notes: { noun: 'NOTE', hint: 'Tap the notes in order, 1 to 6.' },
};
function Order({ def, onDone }) {
  const cfg = ORDER[def.id] || ORDER.pixel_sort;
  const N = 6;
  const nums = useMemo(() => shuffle(Array.from({ length: N }, (_, i) => i + 1)), []);
  const [next, setNext] = useState(1);
  const [wrong, setWrong] = useState(false);
  const [done, finish] = useFinish(onDone);
  const tap = (n) => {
    if (done || n < next) return;
    if (n === next) { setNext(n + 1); if (n === N) finish(); }
    else { setNext(1); setWrong(true); setTimeout(() => setWrong(false), 1400); }
  };
  return (
    <Shell hint={wrong ? 'Wrong order, start again' : cfg.hint} status={`${next - 1} / ${N}`} done={done} className={wrong ? 'wrong' : ''}>
      <div className="tp-order">
        {nums.map((n) => (
          <button key={n} type="button" className={n < next ? 'used' : ''} onClick={() => tap(n)}><b>{n}</b><small>{cfg.noun}</small></button>
        ))}
      </div>
    </Shell>
  );
}

// ---------- Swipe a card ----------
function Swipe({ def, onDone, playerName }) {
  const guest = def.id === 'lobby_guests';
  const [x, setX] = useState(0);
  const [msg, setMsg] = useState('Ready');
  const [done, finish] = useFinish(onDone);
  const drag = useRef(null);
  const track = useRef();
  const down = (e) => {
    if (done || drag.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, t: performance.now(), x0: e.clientX, x: 0 };
    setMsg('Swiping…');
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const r = track.current.getBoundingClientRect();
    d.x = clamp((e.clientX - d.x0) / (r.width - (r.width / track.current.offsetWidth) * 112), 0, 1);
    setX(d.x);
  };
  const up = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const secs = (performance.now() - d.t) / 1000;
    if (e.type === 'pointercancel') setMsg('Keep your finger on the card');
    else if (d.x < 0.95) setMsg('Swipe all the way across');
    else if (secs < 0.4) setMsg('Too fast. Try again');
    else if (secs > 2.2) setMsg('Too slow. Try again');
    else { setMsg('Accepted'); setX(1); finish(); return; }
    setX(0);
  };
  return (
    <Shell hint="Drag the card across at a steady speed." status={msg} done={done}>
      <div className="tp-swipe">
        <div className="tp-swipe-top"><span>Swipe card</span><i className={msg === 'Accepted' ? 'ok' : ''} /></div>
        <div className="tp-track" ref={track}>
          <div className={`tp-card ${guest ? 'guest' : ''}`} style={{ left: `calc(${x} * (100% - 112px))` }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <small>{guest ? 'Visitor' : 'Staff ID'}</small><b>{guest ? 'Guest' : (playerName || 'Staff')}</b>
          </div>
        </div>
        <div className="tp-swipe-foot">Drag →</div>
      </div>
    </Shell>
  );
}

// ---------- Align the projector ----------
function Align({ onDone }) {
  const target = useMemo(() => ({ x: 30 + rand(40), y: 30 + rand(40) }), []);
  const [p, setP] = useState(() => ({ x: target.x > 50 ? 8 : 92, y: target.y > 50 ? 8 : 92 }));
  const [done, finish] = useFinish(onDone);
  const aligned = Math.abs(p.x - target.x) <= 3 && Math.abs(p.y - target.y) <= 3;
  useEffect(() => { if (aligned) finish(); }, [aligned]);
  // Frame and picture are 110 x 76 inside a 520 x 190 stage.
  const at = (v, span, size) => 14 + (v / 100) * (span - size - 28);
  return (
    <Shell hint="Move the picture into the dashed frame." status={aligned ? 'Aligned' : 'Not aligned'} done={done}>
      <div className="tp-align">
        <div className="tp-stage">
          <i className="tp-frame" style={{ left: at(target.x, 520, 130), top: at(target.y, 190, 90) }} />
          <i className={`tp-pic ${aligned ? 'ok' : ''}`} style={{ left: at(p.x, 520, 130), top: at(p.y, 190, 90) }} />
        </div>
        <label><span>Left · Right</span><input type="range" min="0" max="100" value={p.x} disabled={done} onChange={(e) => setP({ ...p, x: +e.target.value })} aria-label="Left right" /></label>
        <label><span>Up · Down</span><input type="range" min="0" max="100" value={p.y} disabled={done} onChange={(e) => setP({ ...p, y: +e.target.value })} aria-label="Up down" /></label>
      </div>
    </Shell>
  );
}

// ---------- Answer the phone ----------
function Keypad({ onDone }) {
  const num = useMemo(() => Array.from({ length: 10 }, () => rand(10)).join(''), []);
  const [typed, setTyped] = useState('');
  const [bad, setBad] = useState(0);
  const [done, finish] = useFinish(onDone);
  const press = (k) => {
    if (done) return;
    if (k === 'DEL') return setTyped((t) => t.slice(0, -1));
    if (k === 'CLR') return setTyped('');
    const t = typed + k;
    if (t === num) { setTyped(t); finish(); }
    else if (t.length >= num.length) { setTyped(''); setBad((b) => b + 1); }
    else setTyped(t);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'CLR'];
  return (
    <Shell hint="Dial the missed number." status={`${typed.length} / ${num.length}`} done={done}>
      <div className="tp-phone">
        <div className="tp-dial">
          <small>Missed call</small><b>{num.slice(0, 5)} {num.slice(5)}</b>
          <div className={`tp-entry ${bad ? `shake${bad % 2}` : ''}`}>{typed ? `${typed.slice(0, 5)} ${typed.slice(5)}`.trim() : '—'}</div>
        </div>
        <div className="tp-keys">
          {keys.map((k) => <button key={k} type="button" className={k.length > 1 ? 'fn' : ''} onClick={() => press(k)}>{k}</button>)}
        </div>
      </div>
    </Shell>
  );
}

// ---------- Type it out ----------
// Short coding snippets, so the task takes a few seconds instead of a minute.
const TYPING = {
  call3_type: { label: 'Caller reads out', hint: 'Type what the caller said.', list: [
    'git push', 'npm install', 'const x = 5;', 'return null;', 'print("hi")', 'console.log(x)', 'SELECT * FROM users', 'if (ok) go();'] },
  desk3_type: { label: 'Command', hint: 'Type the command exactly.', prefix: '$ ', list: [
    'npm run dev', 'git pull', 'git add .', 'ls -la', 'cd src', 'npm test', 'docker ps', 'node app.js'] },
};
function TypeIt({ def, onDone }) {
  const cfg = TYPING[def.id] || TYPING.call3_type;
  const text = useMemo(() => pick(cfg.list), []);
  const [v, setV] = useState('');
  const [done, finish] = useFinish(onDone);
  const ok = text.startsWith(v);
  useEffect(() => { if (v === text) finish(); }, [v]);
  return (
    <Shell hint={cfg.hint} status={`${v.length} / ${text.length}`} done={done}>
      <div className="tp-type">
        <small>{cfg.label}</small>
        <div className={`tp-say ${cfg.prefix ? 'code' : ''}`}>{cfg.prefix}{text}</div>
        <small>Type it here</small>
        <input className={ok ? '' : 'bad'} value={v} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          disabled={done} aria-label="Type it here" onChange={(e) => setV(e.target.value)} />
      </div>
    </Shell>
  );
}

// ---------- Upload attendance ----------
function Upload({ onDone }) {
  const [state, setState] = useState('ready'); // ready | sending
  const [p, setP] = useState(0);
  const [done, finish] = useFinish(onDone);
  useEffect(() => {
    if (state !== 'sending') return;
    let raf, start = performance.now();
    const loop = (t) => {
      const v = Math.min(1, (t - start) / 6000);
      setP(v);
      if (v >= 1) finish(); else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);
  return (
    <Shell hint="Press upload and wait." status={state === 'ready' ? 'Ready' : done ? 'Sent' : 'Uploading…'} done={done}>
      <div className="tp-upload">
        <small>File</small><b>attendance_03-10.csv</b>
        <div className="tp-up-row"><small>Upload</small><small>{pctText(p)}</small></div>
        <Meter value={p} segments={28} />
        <button type="button" disabled={state !== 'ready'} onClick={() => setState('sending')}>Upload</button>
      </div>
    </Shell>
  );
}

// ---------- Refill the printer ----------
function Reams({ onDone }) {
  const [n, setN] = useState(0);
  const [done, finish] = useFinish(onDone);
  const load = () => { if (done) return; const k = n + 1; setN(k); if (k >= 4) finish(); };
  return (
    <Shell hint="Load paper until the tray is full." status={`${n} / 4 reams`} done={done}>
      <div className="tp-upload">
        <small>Paper tray</small><b className="big">{n * 500} / 2000</b>
        <Meter value={n / 4} segments={4} className="wide" />
        <span className={`tp-low ${n >= 4 ? 'ok' : ''}`}>{n >= 4 ? 'Paper ok' : 'Paper low'}</span>
        <button type="button" disabled={done} onClick={load}>Load paper</button>
      </div>
    </Shell>
  );
}

// ---------- Sabotage fixes ----------
// Network: slide the channel until the signal is full.
function Signal({ onDone }) {
  const target = useMemo(() => 12 + rand(76), []);
  const [v, setV] = useState(() => (target > 50 ? 4 : 96));
  const [done, finish] = useFinish(onDone);
  const strength = Math.max(0, Math.round(100 - Math.abs(v - target) * 4));
  useEffect(() => { if (strength >= 96) finish(); }, [strength]);
  const shown = done ? 100 : strength;
  return (
    <Shell hint="Slide until the signal is full." status={`Signal ${shown}%`} done={done}>
      <div className="tp-signal">
        <div>
          <small>Signal</small><b className="alertc">{shown}%</b>
          <small className="mt">Channel</small>
          <input type="range" min="0" max="100" value={v} disabled={done} onChange={(e) => setV(+e.target.value)} aria-label="Channel" />
        </div>
        <div className="tp-bars">{[0.2, 0.4, 0.6, 0.8, 1].map((h, i) => <i key={i} className={shown >= (i + 1) * 20 - 4 ? 'on' : ''} style={{ height: `${h * 100}%` }} />)}</div>
      </div>
    </Shell>
  );
}

// Wi-Fi: two players each hold one router for a few seconds, together. The server keeps the count.
function HoldSync({ def, holds, resetProgress, onHold }) {
  const [holding, setHolding] = useState(false);
  useEffect(() => () => onHold(false), []);
  const set = (v) => { setHolding(v); onHold(v); };
  const other = def.id === 'wifiA' ? 'wifiB' : 'wifiA';
  const where = other === 'wifiA' ? 'Sec' : 'Call 3';
  const partner = holds.includes(other) ? 'held' : 'waiting';
  return (
    <Shell hint="Both routers must be held at the same time." status={pctText(resetProgress)}>
      <div className="tp-hold-row">
        <div className="tp-readout"><small>Reset</small><b className="alertc">{pctText(resetProgress)}</b><Meter value={resetProgress} className="alert" />
          <span className={`tp-partner ${partner}`}>Partner at {where}: {partner}</span></div>
        <HoldButton holding={holding} onHold={set} verb="Hold" sub="to reset" alert />
      </div>
    </Shell>
  );
}

export const GAMES = {
  hold: Hold, mop: Mop, wires: Wires, shred: Shred, breakers: Breakers, restock: Restock, order: Order, swipe: Swipe,
  align: Align, keypad: Keypad, type: TypeIt, upload: Upload, reams: Reams, signal: Signal, holdSync: HoldSync,
};
