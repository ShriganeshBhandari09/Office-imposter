import { useEffect, useState } from 'react';
import Robot from '../Robot.jsx';
import { Button, Modal, Slider } from '../ui/kit.jsx';
import Icon from '../ui/icons.jsx';
import { MAP_ART_URL } from '../assets.js';
import { useFullscreenOnTap } from '../hooks.js';
import { emit, savedName, saveName, savedLook, savedSound, saveSound } from '../net.js';
import { setVolumes } from '../audio.js';

const LINEUP = [
  { color: 'red', hat: 'cap', h: 0.82 }, { color: 'green', hat: 'headset', h: 0.9 }, { color: 'cyan', hat: 'none', h: 1.12 },
  { color: 'yellow', hat: 'hardhat', h: 0.9 }, { color: 'purple', hat: 'beanie', h: 0.82 },
];

// "Games on this Wi-Fi": open lobbies on this server, refreshed every few seconds.
function useRooms() {
  const [rooms, setRooms] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => emit('listRooms').then((r) => alive && r.rooms && setRooms(r.rooms));
    load();
    const iv = setInterval(load, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return rooms;
}

export default function Home({ onJoin, onAvatar, error }) {
  useFullscreenOnTap();
  const params = new URLSearchParams(window.location.search);
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(() => (params.get('room') || '').toUpperCase());
  const [err, setErr] = useState(error || '');
  const [dialog, setDialog] = useState(null); // 'settings' | 'help'
  const rooms = useRooms();
  const look = savedLook();

  useEffect(() => { if (error) setErr(error); }, [error]);

  const go = (event, data) => {
    if (!name.trim()) { setErr('Enter your name first.'); return; }
    setErr('');
    saveName(name.trim());
    onJoin(event, { name: name.trim(), ...data });
  };

  return (
    <div className="screen grid home">
      <div className="home-map" style={{ backgroundImage: `url(${MAP_ART_URL})` }} aria-hidden="true" />

      <nav className="hm-tools" aria-label="Menu">
        <button type="button" className="hm-icon" aria-label="Avatar" onClick={onAvatar}><Icon name="user" size={22} /></button>
        <button type="button" className="hm-icon" aria-label="Settings" onClick={() => setDialog('settings')}><Icon name="settings" size={22} /></button>
        <button type="button" className="hm-icon" aria-label="How to play" onClick={() => setDialog('help')}><Icon name="help" size={22} /></button>
      </nav>

      <section className="hm-brand">
        <h1 className="home-logo">Impostor<span>.exe</span></h1>
        <p className="hm-sub">Find the impostor before the Wi-Fi goes down.</p>
        <div className="hm-lineup" aria-hidden="true">
          {LINEUP.slice(0, 3).map((r) => <Robot key={r.color} color={r.color} hat={r.hat} size={78 * r.h} />)}
        </div>
      </section>

      <section className="hm-card">
        <input id="home-name" className="ui-input" maxLength={14} value={name} placeholder="Your name" aria-label="Your name" autoComplete="off"
          onChange={(e) => { setName(e.target.value); setErr(''); }} />
        <Button variant="primary" size="xl" icon="home" className="home-host" onClick={() => go('createRoom', { ...look })}>Host game</Button>
        <div className="hm-or"><span>or join</span></div>
        <form className="home-join" onSubmit={(e) => { e.preventDefault(); if (code.length < 4) setErr('Enter the room code from the host.'); else go('join', { code, ...look }); }}>
          <input className="ui-input code" maxLength={5} value={code} placeholder="ROOM CODE" aria-label="Room code" autoComplete="off"
            autoCapitalize="characters" spellCheck={false}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setErr(''); }} />
          <Button variant="join" size="xl" type="submit">Join</Button>
        </form>
        <div className="ui-err" role="alert">{err}</div>
        {rooms?.length > 0 && (
          <ul className="hm-rooms" aria-label="Games on this Wi-Fi">
            {rooms.map((r) => (
              <li key={r.code}>
                <span><b>{r.name}</b><small>{r.players}/{r.max} · {r.code}</small></span>
                <Button variant="join" size="sm" onClick={() => go('join', { code: r.code, ...look })}>Join</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog === 'settings' && <SoundDialog onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

export function SoundDialog({ onClose }) {
  const [s, setS] = useState(savedSound());
  const set = (k, v) => setS((o) => { const n = { ...o, [k]: v }; saveSound(n); setVolumes(n); return n; });
  return (
    <Modal onClose={onClose}>
      <h2>Settings</h2>
      <div className="sound-rows">
        {[['master', 'Master'], ['music', 'Music'], ['effects', 'Effects']].map(([k, label]) => (
          <div className="sound-row" key={k}>
            <span>{label}</span><Slider value={s[k]} label={label} onChange={(v) => set(k, v)} /><b>{s[k]}</b>
          </div>
        ))}
      </div>
      <Button variant="primary" size="md" onClick={onClose}>Done</Button>
    </Modal>
  );
}

export const CONTROLS = [['WASD', 'Move'], ['E', 'Use / task'], ['R', 'Report'], ['Q', 'Kill'], ['V', 'Vent'], ['M', 'Map']];

export function ControlsGrid() {
  return (
    <div className="controls-grid">
      {CONTROLS.map(([k, v]) => <div key={k}><kbd>{k}</kbd><span>{v}</span></div>)}
    </div>
  );
}

function HelpDialog({ onClose }) {
  return (
    <Modal onClose={onClose} className="help">
      <h2>How to play</h2>
      <ul className="help-list">
        <li><b>Crewmates</b> finish their tasks around the office. When every task is done, the crew wins.</li>
        <li><b>Impostors</b> blend in, fake tasks, sabotage and eliminate the crew.</li>
        <li>Find a body? <b>Report</b> it. Or press the red button in the Lobby to call a meeting, then discuss and vote.</li>
        <li>Fix <b>sabotages</b> before the timer ends, or the impostors win.</li>
      </ul>
      <ControlsGrid />
      <Button variant="primary" size="md" onClick={onClose}><Icon name="check" size={18} /> Got it</Button>
    </Modal>
  );
}

