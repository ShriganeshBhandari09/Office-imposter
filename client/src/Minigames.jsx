import { useEffect, useMemo, useRef, useState } from 'react';

const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Shared "task complete" pause so players see the success state.
function useFinish(onDone) {
  const [done, setDone] = useState(false);
  const fired = useRef(false);
  const finish = () => {
    if (fired.current) return;
    fired.current = true;
    setDone(true);
    setTimeout(onDone, 700);
  };
  return [done, finish];
}

function Hold({ def, onDone, label = 'Hold' }) {
  const [p, setP] = useState(0);
  const prog = useRef(0);
  const holding = useRef(false);
  const [done, finish] = useFinish(onDone);
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (t) => {
      const dt = (t - last) / 1000; last = t;
      prog.current = holding.current
        ? Math.min(1, prog.current + dt / (def.seconds || 3))
        : Math.max(0, prog.current - dt / 4);
      setP(prog.current);
      if (prog.current >= 1) finish();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e) => { if (e.code === 'Space') { e.preventDefault(); holding.current = true; } };
    const up = (e) => { if (e.code === 'Space') holding.current = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return (
    <div className="mg-center">
      <div className="bar big"><div style={{ width: `${p * 100}%` }} /></div>
      <button
        className="btn huge"
        disabled={done}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); holding.current = true; }}
        onPointerUp={() => (holding.current = false)}
        onPointerCancel={() => (holding.current = false)}
        onContextMenu={(e) => e.preventDefault()}
      >{done ? 'Done!' : label}</button>
    </div>
  );
}

function Upload({ def, onDone }) {
  const [started, setStarted] = useState(false);
  const [p, setP] = useState(0);
  const [done, finish] = useFinish(onDone);
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const id = setInterval(() => {
      const v = Math.min(1, (performance.now() - start) / 1000 / (def.seconds || 6));
      setP(v);
      if (v >= 1) { clearInterval(id); finish(); }
    }, 100);
    return () => clearInterval(id);
  }, [started]);
  return (
    <div className="mg-center">
      <p className="mg-note">attendance_sept.xlsx → HR portal</p>
      <div className="bar big"><div style={{ width: `${p * 100}%` }} /></div>
      <p className="mg-note">{done ? 'Uploaded!' : started ? `Uploading… ${Math.round(p * 100)}% (stay here)` : 'Ready'}</p>
      {!started && <button className="btn huge" onClick={() => setStarted(true)}>Upload</button>}
    </div>
  );
}

function Clicks({ def, onDone }) {
  const items = useMemo(() => Array.from({ length: def.count || 6 }, (_, i) => ({ id: i, x: 8 + rand(80), y: 8 + rand(70) })), []);
  const [left, setLeft] = useState(items.map((i) => i.id));
  const [done, finish] = useFinish(onDone);
  const look = { spill: ['#8d6e63', 'spill'], paper: ['#eceff1', 'paper'], scribble: ['#1e88e5', 'scribble'] }[def.thing] || ['#aaa', ''];
  return (
    <div>
      <p className="mg-note">Click every {look[1]} ({left.length} left)</p>
      <div className="mg-area">
        {items.filter((i) => left.includes(i.id)).map((i) => (
          <button key={i.id} className={`blob ${def.thing}`} style={{ left: `${i.x}%`, top: `${i.y}%`, background: look[0] }}
            onClick={() => { const n = left.filter((x) => x !== i.id); setLeft(n); if (!n.length) finish(); }} />
        ))}
        {done && <div className="mg-done">Done!</div>}
      </div>
    </div>
  );
}

const WIRE_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
function Wires({ def, onDone }) {
  const n = def.count || 4;
  const left = useMemo(() => WIRE_COLORS.slice(0, n), []);
  const right = useMemo(() => shuffle(left), []);
  const [sel, setSel] = useState(null);
  const [links, setLinks] = useState({});
  const [done, finish] = useFinish(onDone);
  const pick = (c) => {
    if (sel === null) return;
    if (left[sel] === c) {
      const nl = { ...links, [sel]: c };
      setLinks(nl);
      if (Object.keys(nl).length === n) finish();
    }
    setSel(null);
  };
  return (
    <div>
      <p className="mg-note">Click a wire on the left, then the matching colour on the right.</p>
      <div className="wires">
        <div>{left.map((c, i) => (
          <button key={c} className={`wire ${sel === i ? 'sel' : ''} ${links[i] ? 'linked' : ''}`} style={{ background: c }}
            onClick={() => !links[i] && setSel(i)} />
        ))}</div>
        <div className="wire-mid">{Object.keys(links).length}/{n} connected</div>
        <div>{right.map((c) => (
          <button key={c} className={`wire ${Object.values(links).includes(c) ? 'linked' : ''}`} style={{ background: c }} onClick={() => pick(c)} />
        ))}</div>
      </div>
      {done && <div className="mg-done inline">Done!</div>}
    </div>
  );
}

const WORDS = ['const', 'react', 'node', 'deploy', 'commit', 'merge', 'async', 'await', 'fetch', 'build', 'debug', 'query'];
function TypeCode({ onDone }) {
  const target = useMemo(() => shuffle(WORDS).slice(0, 3).join(' '), []);
  const [text, setText] = useState('');
  const [done, finish] = useFinish(onDone);
  const ref = useRef();
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="mg-center">
      <p className="mg-note">Type this exactly:</p>
      <div className="code">{[...target].map((ch, i) => (
        <span key={i} className={i < text.length ? (text[i] === ch ? 'ok' : 'bad') : ''}>{ch}</span>
      ))}</div>
      <input ref={ref} className="input" value={text} disabled={done} spellCheck={false}
        onChange={(e) => { const v = e.target.value; setText(v); if (v === target) finish(); }} />
      {done && <div className="mg-done inline">Done!</div>}
    </div>
  );
}

function Keypad({ onDone }) {
  const target = useMemo(() => String(1000 + rand(9000)), []);
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState(false);
  const [done, finish] = useFinish(onDone);
  const press = (d) => {
    if (done) return;
    const v = (entry + d).slice(0, 4);
    setErr(false);
    setEntry(v);
    if (v.length === 4) {
      if (v === target) finish();
      else { setErr(true); setTimeout(() => setEntry(''), 400); }
    }
  };
  useEffect(() => {
    const k = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="mg-center">
      <p className="mg-note">Incoming call — extension <b>{target}</b></p>
      <div className={`code ${err ? 'shake' : ''}`}>{entry.padEnd(4, '_')}</div>
      <div className="keypad">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
        <button key={d} className="btn" onClick={() => press(String(d))}>{d}</button>
      ))}</div>
      {done && <div className="mg-done inline">Connected!</div>}
    </div>
  );
}

function Sequence({ def, onDone }) {
  const n = def.count || 8;
  const cells = useMemo(() => shuffle(Array.from({ length: n }, (_, i) => i + 1)), []);
  const [next, setNext] = useState(1);
  const [done, finish] = useFinish(onDone);
  return (
    <div>
      <p className="mg-note">Click the numbers in order, 1 to {n}.</p>
      <div className="seq">{cells.map((c) => (
        <button key={c} className={`btn note ${c < next ? 'used' : ''}`}
          onClick={() => { if (c === next) { if (c === n) finish(); setNext(c + 1); } else setNext(1); }}>{c}</button>
      ))}</div>
      {done && <div className="mg-done inline">Done!</div>}
    </div>
  );
}

function Align({ onDone }) {
  const target = useMemo(() => 15 + rand(70), []);
  const [v, setV] = useState(target > 50 ? 5 : 95);
  const [done, finish] = useFinish(onDone);
  const close = Math.abs(v - target) <= 3;
  return (
    <div className="mg-center">
      <p className="mg-note">Slide until the two markers line up, then Lock.</p>
      <div className="align-track">
        <div className="align-target" style={{ left: `${target}%` }} />
        <div className={`align-cur ${close ? 'good' : ''}`} style={{ left: `${v}%` }} />
      </div>
      <input type="range" min="0" max="100" value={v} onChange={(e) => setV(+e.target.value)} className="range" />
      <button className="btn huge" disabled={!close || done} onClick={finish}>{done ? 'Locked!' : 'Lock'}</button>
    </div>
  );
}

function Swipe({ onDone }) {
  const [x, setX] = useState(0);
  const [msg, setMsg] = useState('Drag the card across the reader at a steady speed.');
  const [done, finish] = useFinish(onDone);
  const start = useRef(null);
  const track = useRef();
  const onDown = (e) => { e.preventDefault(); start.current = { t: performance.now(), x0: e.clientX }; };
  useEffect(() => {
    const move = (e) => {
      if (!start.current || done) return;
      const w = track.current.clientWidth - 90;
      setX(Math.max(0, Math.min(1, (e.clientX - start.current.x0) / w)));
    };
    const up = () => {
      if (!start.current) return;
      const secs = (performance.now() - start.current.t) / 1000;
      start.current = null;
      if (x < 0.97) setMsg('Swipe all the way across.');
      else if (secs < 0.5) setMsg('Too fast. Try again.');
      else if (secs > 1.8) setMsg('Too slow. Try again.');
      else { setMsg('Accepted. Thank you.'); finish(); return; }
      setX(0);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
  return (
    <div className="mg-center">
      <p className="mg-note">{msg}</p>
      <div className="swipe" ref={track}>
        <div className="card" style={{ left: `calc(${x} * (100% - 90px))` }} onPointerDown={onDown}>ID</div>
      </div>
    </div>
  );
}

function Switches({ def, onDone }) {
  const n = def.count || 5;
  const [s, setS] = useState(() => { const a = Array.from({ length: n }, () => Math.random() < 0.5); if (a.every(Boolean)) a[0] = false; return a; });
  const [done, finish] = useFinish(onDone);
  return (
    <div className="mg-center">
      <p className="mg-note">Flip every switch ON.</p>
      <div className="switches">{s.map((on, i) => (
        <button key={i} className={`switch ${on ? 'on' : ''}`} onClick={() => {
          if (done) return;
          const ns = s.map((v, j) => (j === i ? !v : v)); setS(ns); if (ns.every(Boolean)) finish();
        }}><span /></button>
      ))}</div>
      {done && <div className="mg-done inline">Power restored!</div>}
    </div>
  );
}

// Wi-Fi critical: two players must hold at both panels at the same time.
function HoldSync({ def, holds, onHold }) {
  const [holding, setHolding] = useState(false);
  useEffect(() => () => onHold(false), []);
  const set = (v) => { setHolding(v); onHold(v); };
  const other = def.id === 'wifiA' ? 'wifiB' : 'wifiA';
  return (
    <div className="mg-center">
      <p className="mg-note">Hold the reset button. Someone must hold the other panel ({other === 'wifiA' ? 'Security' : 'Call 3'}) at the same time.</p>
      <button className={`btn huge danger ${holding ? 'pressed' : ''}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(true); }}
        onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onContextMenu={(e) => e.preventDefault()}>
        {holding ? 'Holding…' : 'Hold to reset'}
      </button>
      <p className="mg-note">{holds.includes(other) ? 'The other panel is being held!' : 'Waiting for the other panel…'}</p>
    </div>
  );
}

const MAP = { hold: Hold, upload: Upload, clicks: Clicks, wires: Wires, type: TypeCode, keypad: Keypad, sequence: Sequence, align: Align, swipe: Swipe, switches: Switches };

export default function Minigame({ def, onDone, onClose, holds = [], onHold }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const Comp = MAP[def.type];
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{def.name}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {def.type === 'holdSync'
          ? <HoldSync def={def} holds={holds} onHold={onHold} />
          : Comp ? <Comp def={def} onDone={onDone} /> : <p>Unknown task</p>}
        <p className="hint">Esc or ✕ to close</p>
      </div>
    </div>
  );
}
