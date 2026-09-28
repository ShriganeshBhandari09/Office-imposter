import { useState } from 'react';
import { COLORS } from './shared/map.js';
import { spriteURL } from './render.js';
import { socket, emit, saveName, savedName } from './net.js';

// Start screen: pick a name and colour, then create a new room or join one with a code.
export function Home({ pid, onJoined }) {
  const [name, setName] = useState(savedName());
  const [color, setColor] = useState(null);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (event, data) => {
    if (!name.trim()) { setErr('Enter your name first.'); return; }
    setBusy(true);
    const res = await emit(event, { pid, name: name.trim(), color, ...data });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    saveName(name.trim());
    onJoined(res.code);
  };
  const create = () => go('createRoom');
  const join = (e) => {
    e.preventDefault();
    if (!code.trim()) { setErr('Enter the room code from the host.'); return; }
    go('join', { code: code.trim() });
  };

  return (
    <div className="screen home-screen">
      <div className="card join home">
        <div className="home-left">
          <h1 className="title">Office<br className="title-br" /> Impostor</h1>
          <p className="muted tagline">One of your colleagues is not who they seem.</p>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="input" maxLength={14} value={name}
            onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="e.g. Dev" />
          <div className="label">Pick a colour</div>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c.id}
                className={`swatch ${color === c.id ? 'sel' : ''}`} style={{ background: c.hex }}
                aria-label={c.id} onClick={() => setColor(c.id)} />
            ))}
          </div>
        </div>
        <div className="home-right">
          <button className="btn huge" type="button" disabled={busy} onClick={create}>Create game</button>
          <div className="or">or join a friend's game</div>
          <form className="join-row" onSubmit={join}>
            <input className="input code-input" maxLength={4} value={code} placeholder="CODE" autoCapitalize="characters"
              autoComplete="off" spellCheck={false} aria-label="Room code"
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setErr(''); }} />
            <button className="btn huge join-btn" type="submit" disabled={busy}>Join</button>
          </form>
          {err && <p className="error home-err">{err}</p>}
        </div>
      </div>
    </div>
  );
}

export function Lobby({ view, onLeave }) {
  const me = view.me;
  const isHost = view.hostId === me.id;
  const [err, setErr] = useState('');
  const s = view.settings;
  const taken = new Map(view.roster.map((r) => [r.color, r.id]));
  const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex;
  const set = (k, v) => socket.emit('settings', { ...s, [k]: v });
  const start = async () => { const r = await emit('start'); if (r.error) setErr(r.error); };
  const need = Math.max(0, s.minPlayers - view.roster.length);
  const myName = view.roster.find((r) => r.id === me.id)?.name || '';
  const [name, setName] = useState(myName);
  const [nameMsg, setNameMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const saveMyName = async (e) => {
    e.preventDefault();
    const res = await emit('setName', name);
    if (res.error) setNameMsg(res.error);
    else { saveName(res.name); setName(res.name); setNameMsg('Saved'); setTimeout(() => setNameMsg(''), 1500); }
  };
  // Phones get the native share sheet; elsewhere the invite is copied.
  const invite = async () => {
    const url = `${window.location.origin}/?room=${view.code}`;
    const text = `Join my Office Impostor game! Room code: ${view.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Office Impostor', text, url }); return; }
      await navigator.clipboard.writeText(`${text}
${url}`);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* share cancelled */ }
  };

  return (
    <div className="screen lobby-screen">
      <div className="card lobby">
        <div className="lobby-head">
          <h1 className="title small">Lobby</h1>
          <div className="room-code">
            <span className="muted small">Room code</span>
            <span className="code-big">{view.code}</span>
            <button className="btn" onClick={invite}>{copied ? 'Copied!' : 'Invite'}</button>
          </div>
          <button className="btn tiny" onClick={onLeave}>Leave</button>
        </div>

        <div className="lobby-cols">
          <div className="lobby-left">
            <div className="label">Players ({view.roster.length}/{COLORS.length})</div>
            <div className="roster">
              {view.roster.map((r) => (
                <div key={r.id} className={`who ${r.id === me.id ? 'me' : ''}`}>
                  <img alt="" src={spriteURL(colorHex(r.color))} />
                  <span className="who-name">{r.name}</span>
                  {r.id === view.hostId && <span className="tag">host</span>}
                </div>
              ))}
            </div>
            <p className="muted small lobby-hint">Friends tap Join and enter <b>{view.code}</b>.</p>
          </div>

          <div className="lobby-right">
            <form className="name-row" onSubmit={saveMyName}>
              <label className="label" htmlFor="myname">Your name</label>
              <div className="join-row">
                <input id="myname" className="input" maxLength={14} value={name}
                  onChange={(e) => { setName(e.target.value); setNameMsg(''); }} />
                <button className="btn" type="submit" disabled={!name.trim() || name.trim() === myName}>Save</button>
              </div>
              {nameMsg && <div className={nameMsg === 'Saved' ? 'ok-msg small' : 'error small'}>{nameMsg}</div>}
            </form>

            <div className="label">Your colour</div>
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c.id} disabled={taken.has(c.id) && taken.get(c.id) !== me.id}
                  className={`swatch ${taken.get(c.id) === me.id ? 'sel' : ''}`} style={{ background: c.hex }}
                  aria-label={c.id} onClick={() => socket.emit('setColor', c.id)} />
              ))}
            </div>

            <button className="settings-summary" onClick={() => setShowSettings(true)}>
              <span className="muted small">{isHost ? 'Game settings (tap to change)' : 'Game settings (host decides)'}</span>
              <span className="small">
                {s.impostors} impostor{s.impostors > 1 ? 's' : ''} · kill {s.killCooldown}s · meeting {s.meetingSeconds}s
              </span>
            </button>

            {err && <p className="error small">{err}</p>}
            {isHost ? (
              <button className="btn huge" onClick={start} disabled={need > 0}>
                {need > 0 ? `Waiting for ${need} more player${need > 1 ? 's' : ''}` : `Start game (${view.roster.length} players)`}
              </button>
            ) : <p className="muted center waiting">Waiting for the host to start…</p>}
            <div className="controls muted small">
              <span className="kbd-only">Move: WASD / arrows · Use: E · Report: R · Kill: Q · Vent: V · Map: Tab</span>
              <span className="touch-only">Drag on the left half to move · tap the buttons to act</span>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal settings-modal">
            <div className="modal-head">
              <h2>Game settings</h2>
              <button className="x" onClick={() => setShowSettings(false)} aria-label="Close">✕</button>
            </div>
            {!isHost && <p className="muted small">Only the host can change these.</p>}
            <div className="settings">
              <Setting label="Impostors" value={s.impostors} min={1} max={3} disabled={!isHost} onChange={(v) => set('impostors', v)} />
              <Setting label="Kill cooldown (s)" value={s.killCooldown} min={10} max={60} step={5} disabled={!isHost} onChange={(v) => set('killCooldown', v)} />
              <Setting label="Meeting time (s)" value={s.meetingSeconds} min={30} max={180} step={15} disabled={!isHost} onChange={(v) => set('meetingSeconds', v)} />
              <Setting label="Emergency meetings each" value={s.emergencyPerPlayer} min={0} max={3} disabled={!isHost} onChange={(v) => set('emergencyPerPlayer', v)} />
              <Setting label="Crew vision (%)" value={s.crewVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('crewVision', v)} />
              <Setting label="Impostor vision (%)" value={s.impostorVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('impostorVision', v)} />
            </div>
            <button className="btn huge" onClick={() => setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Setting({ label, value, min, max, step = 1, disabled, onChange }) {
  return (
    <div className="setting">
      <span>{label}</span>
      <div className="stepper">
        <button className="btn tiny" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <b>{value}</b>
        <button className="btn tiny" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}
