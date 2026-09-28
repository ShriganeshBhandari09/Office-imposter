import { useEffect, useState } from 'react';
import { COLORS } from './shared/map.js';
import { spriteURL } from './render.js';
import { socket, emit, saveName, savedName } from './net.js';

const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex;

// Up to 6 players stand in one row, more in two rows; the CSS sizes them to fill the space.
function lineupSize(n) {
  const rows = n > 6 ? 2 : 1;
  return { '--rows': rows, '--per': Math.max(4, Math.ceil(n / rows)) };
}

// Phones: go full screen and lock to landscape on the first tap (browsers only allow it after a tap).
// The Android app is already full screen, so failures are ignored.
function useFullscreenOnTap() {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    const go = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
        await screen.orientation?.lock?.('landscape');
      } catch { /* not supported here */ }
    };
    window.addEventListener('pointerup', go, { once: true });
    return () => window.removeEventListener('pointerup', go);
  }, []);
}

// Starry space background with a few crewmates drifting past.
function Space({ drifters = true }) {
  return (
    <div className="space" aria-hidden="true">
      <div className="stars far" />
      <div className="stars near" />
      {drifters && ['#e53935', '#1e88e5', '#fdd835'].map((hex, i) => (
        <img key={hex} className={`drifter d${i}`} alt="" src={spriteURL(hex)} />
      ))}
    </div>
  );
}

// ---------- Start screen ----------

export function Home({ pid, onJoined }) {
  useFullscreenOnTap();
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room')?.toUpperCase() || '');
  const [joining, setJoining] = useState(() => !!new URLSearchParams(window.location.search).get('room'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (event, data) => {
    if (!name.trim()) { setErr('Enter your name first.'); setJoining(false); return; }
    setBusy(true);
    const res = await emit(event, { pid, name: name.trim(), ...data });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    saveName(name.trim());
    onJoined(res.code);
  };
  const openJoin = () => {
    if (!name.trim()) { setErr('Enter your name first.'); return; }
    setErr(''); setJoining(true);
  };
  const join = (e) => {
    e.preventDefault();
    if (code.length < 4) { setErr('Enter the 4-letter code from the host.'); return; }
    go('join', { code });
  };

  return (
    <div className="au-screen">
      <Space />
      <div className="home-main">
        <h1 className="au-title">Office <span>Impostor</span></h1>
        <label className="au-field">
          <span className="au-label">Your name</span>
          <input className="au-input" maxLength={14} value={name} placeholder="Enter name"
            onChange={(e) => { setName(e.target.value); setErr(''); }} />
        </label>
        <div className="home-buttons">
          <button className="au-btn green" disabled={busy} onClick={() => go('createRoom')}>Create game</button>
          <button className="au-btn blue" disabled={busy} onClick={openJoin}>Join game</button>
        </div>
        <div className="au-err" role="alert">{!joining && err}</div>
      </div>

      {joining && (
        <div className="au-overlay" onPointerDown={(e) => e.target === e.currentTarget && setJoining(false)}>
          <form className="au-panel join-panel" onSubmit={join}>
            <button type="button" className="au-close" aria-label="Close" onClick={() => setJoining(false)}>✕</button>
            <h2 className="au-heading">Enter code</h2>
            <input className="au-input code-boxes" maxLength={4} value={code} placeholder="····" autoFocus
              autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="Room code"
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setErr(''); }} />
            <div className="au-err" role="alert">{err}</div>
            <button className="au-btn green" type="submit" disabled={busy}>Join</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------- Lobby ----------

export function Lobby({ view, onLeave }) {
  useFullscreenOnTap();
  const me = view.me;
  const isHost = view.hostId === me.id;
  const s = view.settings;
  const taken = new Map(view.roster.map((r) => [r.color, r.id]));
  const myRow = view.roster.find((r) => r.id === me.id);
  const need = Math.max(0, s.minPlayers - view.roster.length);
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState(null); // 'customize' | 'settings' | null
  const [name, setName] = useState(myRow?.name || '');
  const [nameMsg, setNameMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (k, v) => socket.emit('settings', { ...s, [k]: v });
  const start = async () => { setErr(''); const r = await emit('start'); if (r.error) setErr(r.error); };
  const addBot = async () => { setErr(''); const r = await emit('addBot'); if (r.error) setErr(r.error); };
  const saveMyName = async (e) => {
    e?.preventDefault();
    if (!name.trim() || name.trim() === myRow?.name) return;
    const res = await emit('setName', name);
    if (res.error) setNameMsg(res.error);
    else { saveName(res.name); setName(res.name); setNameMsg('Saved!'); setTimeout(() => setNameMsg(''), 1500); }
  };
  // Phones get the native share sheet; elsewhere the invite is copied.
  const invite = async () => {
    const url = `${window.location.origin}/?room=${view.code}`;
    const text = `Join my Office Impostor game! Room code: ${view.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Office Impostor', text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* share cancelled */ }
  };

  return (
    <div className="au-screen lobby-au">
      <Space drifters={false} />

      <div className="lobby-top">
        <button className="au-round" aria-label="Leave room" onClick={onLeave}>✕</button>
        <div className="lobby-count">{view.roster.length}/{COLORS.length}</div>
        <button className="au-round" aria-label="Game settings" onClick={() => setPanel('settings')}>⚙</button>
      </div>

      {/* Everyone standing on the office floor */}
      <div className="lineup" style={lineupSize(view.roster.length)}>
        {view.roster.map((r) => (
          <div key={r.id} className={`crew ${r.id === me.id ? 'me' : ''} ${r.bot ? 'bot' : ''}`}>
            <div className="crew-name">{r.id === view.hostId && <span className="crown">♛</span>}{r.name}</div>
            <img alt="" src={spriteURL(colorHex(r.color))} />
            {r.bot && (isHost
              ? <button className="bot-tag remove" aria-label={`Remove ${r.name}`} onClick={() => socket.emit('removeBot', r.id)}>BOT ✕</button>
              : <span className="bot-tag">BOT</span>)}
          </div>
        ))}
      </div>
      <div className="floor" />

      <div className="lobby-bottom">
        <button className="au-btn small" onClick={() => { setName(myRow?.name || ''); setPanel('customize'); }}>
          <img alt="" className="btn-sprite" src={spriteURL(colorHex(myRow?.color))} />Customize
        </button>

        <button className="code-tag" onClick={invite} aria-label="Share room code">
          <span className="code-label">Code</span>
          <span className="code-value">{view.code}</span>
          <span className="code-share">{copied ? 'Copied!' : 'Tap to invite'}</span>
        </button>

        {isHost ? (
          <div className="host-actions">
            <button className="au-btn small blue" onClick={addBot} disabled={view.roster.length >= COLORS.length}>+ Bot</button>
            <button className="au-btn green start-btn" onClick={start} disabled={need > 0}>
              Start
              <span className="start-sub">{need > 0 ? `Need ${need} more` : `${view.roster.length} players`}</span>
            </button>
          </div>
        ) : <div className="waiting-tag">Waiting for host…</div>}
      </div>
      {err && <div className="au-err lobby-err" role="alert">{err}</div>}

      {panel === 'customize' && (
        <div className="au-overlay" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
          <div className="au-panel customize">
            <button className="au-close" aria-label="Close" onClick={() => setPanel(null)}>✕</button>
            <div className="customize-preview">
              <img alt="" src={spriteURL(colorHex(myRow?.color))} />
            </div>
            <div className="customize-body">
              <form onSubmit={saveMyName}>
                <span className="au-label">Name</span>
                <div className="name-line">
                  <input className="au-input" maxLength={14} value={name}
                    onChange={(e) => { setName(e.target.value); setNameMsg(''); }} />
                  <button className="au-btn small green" type="submit" disabled={!name.trim() || name.trim() === myRow?.name}>Save</button>
                </div>
                <div className={nameMsg === 'Saved!' ? 'au-ok' : 'au-err'}>{nameMsg}</div>
              </form>
              <span className="au-label">Colour</span>
              <div className="color-grid">
                {COLORS.map((c) => {
                  const owner = taken.get(c.id);
                  return (
                    <button key={c.id} aria-label={c.id} disabled={!!owner && owner !== me.id}
                      className={`color-cell ${owner === me.id ? 'sel' : ''}`} style={{ background: c.hex }}
                      onClick={() => socket.emit('setColor', c.id)} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {panel === 'settings' && (
        <div className="au-overlay" onPointerDown={(e) => e.target === e.currentTarget && setPanel(null)}>
          <div className="au-panel settings-panel">
            <button className="au-close" aria-label="Close" onClick={() => setPanel(null)}>✕</button>
            <h2 className="au-heading">Game settings</h2>
            {!isHost && <p className="au-note">Only the host can change these.</p>}
            <div className="settings-grid">
              <Setting label="Impostors" value={s.impostors} min={1} max={3} disabled={!isHost} onChange={(v) => set('impostors', v)} />
              <Setting label="Kill cooldown" unit="s" value={s.killCooldown} min={10} max={60} step={5} disabled={!isHost} onChange={(v) => set('killCooldown', v)} />
              <Setting label="Meeting time" unit="s" value={s.meetingSeconds} min={30} max={180} step={15} disabled={!isHost} onChange={(v) => set('meetingSeconds', v)} />
              <Setting label="Emergency meetings" value={s.emergencyPerPlayer} min={0} max={3} disabled={!isHost} onChange={(v) => set('emergencyPerPlayer', v)} />
              <Setting label="Crew vision" unit="%" value={s.crewVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('crewVision', v)} />
              <Setting label="Impostor vision" unit="%" value={s.impostorVision} min={25} max={300} step={5} disabled={!isHost} onChange={(v) => set('impostorVision', v)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Setting({ label, unit = '', value, min, max, step = 1, disabled, onChange }) {
  return (
    <div className="au-setting">
      <span>{label}</span>
      <div className="au-stepper">
        <button disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))} aria-label={`Less ${label}`}>−</button>
        <b>{value}{unit}</b>
        <button disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))} aria-label={`More ${label}`}>+</button>
      </div>
    </div>
  );
}
