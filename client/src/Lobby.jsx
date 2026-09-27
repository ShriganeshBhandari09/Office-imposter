import { useState } from 'react';
import { COLORS } from './shared/map.js';
import { spriteURL } from './render.js';
import { socket, emit, saveName, savedName } from './net.js';

export function JoinForm({ view, pid, onJoined }) {
  const [name, setName] = useState(savedName());
  const [color, setColor] = useState(null);
  const [err, setErr] = useState('');
  const taken = new Set(view?.roster.map((r) => r.color));
  const inProgress = view && view.phase !== 'lobby';

  const join = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Enter a name first.'); return; }
    const res = await emit('join', { pid, name: name.trim(), color });
    if (res.error) setErr(res.error);
    else { saveName(name.trim()); onJoined(name.trim()); }
  };

  return (
    <div className="screen">
      <div className="card join">
        <h1 className="title">Office<br />Impostor</h1>
        <p className="muted">One of your colleagues is not who they seem.</p>
        {inProgress ? (
          <p className="warn">A game is in progress with {view.roster.length} players. You can join when it ends.</p>
        ) : (
          <form onSubmit={join}>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" className="input" maxLength={14} value={name} autoFocus
              onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="e.g. Dev" />
            <div className="label">Pick a colour</div>
            <div className="swatches">
              {COLORS.map((c) => (
                <button type="button" key={c.id} disabled={taken.has(c.id)}
                  className={`swatch ${color === c.id ? 'sel' : ''}`} style={{ background: c.hex }}
                  aria-label={c.id} onClick={() => setColor(c.id)} />
              ))}
            </div>
            {err && <p className="error">{err}</p>}
            <button className="btn huge" type="submit">Join</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function Lobby({ view }) {
  const me = view.me;
  const isHost = view.hostId === me.id;
  const [err, setErr] = useState('');
  const s = view.settings;
  const taken = new Map(view.roster.map((r) => [r.color, r.id]));
  const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex;
  const set = (k, v) => socket.emit('settings', { ...s, [k]: v });
  const start = async () => { const r = await emit('start'); if (r.error) setErr(r.error); };
  const need = Math.max(0, s.minPlayers - view.roster.length);

  return (
    <div className="screen">
      <div className="card lobby">
        <div className="lobby-head">
          <h1 className="title small">Lobby</h1>
          <div className="muted small">Others join at <b>{window.location.host}</b> on the office Wi-Fi</div>
        </div>
        <div className="roster">
          {view.roster.map((r) => (
            <div key={r.id} className={`who ${r.id === me.id ? 'me' : ''}`}>
              <img alt="" src={spriteURL(colorHex(r.color))} />
              <div>{r.name}{r.id === view.hostId && <span className="tag">host</span>}</div>
            </div>
          ))}
        </div>

        <div className="label">Your colour</div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c.id} disabled={taken.has(c.id) && taken.get(c.id) !== me.id}
              className={`swatch ${taken.get(c.id) === me.id ? 'sel' : ''}`} style={{ background: c.hex }}
              aria-label={c.id} onClick={() => socket.emit('setColor', c.id)} />
          ))}
        </div>

        <div className="settings">
          <div className="label">Game settings {isHost ? '' : '(host decides)'}</div>
          <Setting label="Impostors" value={s.impostors} min={1} max={3} disabled={!isHost} onChange={(v) => set('impostors', v)} />
          <Setting label="Kill cooldown (s)" value={s.killCooldown} min={10} max={60} step={5} disabled={!isHost} onChange={(v) => set('killCooldown', v)} />
          <Setting label="Meeting time (s)" value={s.meetingSeconds} min={30} max={180} step={15} disabled={!isHost} onChange={(v) => set('meetingSeconds', v)} />
          <Setting label="Emergency meetings each" value={s.emergencyPerPlayer} min={0} max={3} disabled={!isHost} onChange={(v) => set('emergencyPerPlayer', v)} />
          <Setting label="Crew vision (%)" value={s.crewVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('crewVision', v)} />
          <Setting label="Impostor vision (%)" value={s.impostorVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('impostorVision', v)} />
        </div>

        <div className="controls muted small">
          Move: WASD / arrows · Use: E · Report: R · Kill: Q · Vent: V · Map: Tab
        </div>

        {err && <p className="error">{err}</p>}
        {isHost ? (
          <button className="btn huge" onClick={start} disabled={need > 0}>
            {need > 0 ? `Waiting for ${need} more player${need > 1 ? 's' : ''}` : `Start game (${view.roster.length} players)`}
          </button>
        ) : <p className="muted center">Waiting for the host to start…</p>}
      </div>
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
