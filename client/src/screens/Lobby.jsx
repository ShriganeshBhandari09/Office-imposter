import { useEffect, useState } from 'react';
import { socket, emit, saveName, saveLook, saveSettings } from '../net.js';
import { Button, Chip } from '../ui/kit.jsx';
import Icon from '../ui/icons.jsx';
import Robot from '../Robot.jsx';
import LobbyScene from './LobbyScene.jsx';
import Customize from './Customize.jsx';
import GameSettings from './GameSettings.jsx';
import { MAX_PLAYERS } from '../shared/map.js';
import { useFullscreenOnTap } from '../hooks.js';

export default function Lobby({ view, onLeave }) {
  useFullscreenOnTap();
  const me = view.me;
  const isHost = view.hostId === me.id;
  const s = view.settings;
  const myRow = view.roster.find((r) => r.id === me.id);
  const n = view.roster.length;
  const ready = view.roster.filter((r) => !r.afk).length;
  const [panel, setPanel] = useState(null); // 'customize' | 'settings'
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  // Remember the host's rules on this device, so the next room they host starts with the same ones.
  const rulesKey = JSON.stringify(view.settings);
  useEffect(() => { if (isHost) saveSettings(view.settings); }, [isHost, rulesKey]);

  // Taps, keys and walking all count as "here" so the server doesn't mark us AFK.
  useEffect(() => {
    let last = 0;
    const ping = () => { const t = Date.now(); if (t - last > 8000) { last = t; socket.emit('active'); } };
    for (const ev of ['pointerdown', 'keydown', 'pointermove']) window.addEventListener(ev, ping);
    return () => { for (const ev of ['pointerdown', 'keydown', 'pointermove']) window.removeEventListener(ev, ping); };
  }, []);

  const start = async () => { setErr(''); const r = await emit('start'); if (r.error) setErr(r.error); };
  const addBot = async () => { setErr(''); const r = await emit('addBot'); if (r.error) setErr(r.error); };
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat', text);
    setText('');
  };
  // Phones get the native share sheet; elsewhere the invite is copied.
  const invite = async () => {
    const url = `${window.location.origin}/?room=${view.code}`;
    const msg = `Join my Impostor.exe game! Room code: ${view.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Impostor.exe', text: msg, url }); return; }
      await navigator.clipboard.writeText(`${msg}\n${url}`);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* share cancelled */ }
  };

  if (panel === 'customize') {
    const taken = new Set(view.roster.filter((r) => r.id !== me.id).map((r) => r.color));
    return (
      <Customize initial={{ name: myRow.name, color: myRow.color, hat: myRow.hat }} taken={taken}
        onBack={() => setPanel(null)}
        onSave={async ({ name, color, hat }) => {
          if (name !== myRow.name) {
            const r = await emit('setName', name);
            if (r.error) return r;
            saveName(r.name);
          }
          socket.emit('setColor', color);
          socket.emit('setHat', hat);
          saveLook({ color, hat });
          setPanel(null);
          return {};
        }} />
    );
  }
  if (panel === 'settings') return <GameSettings view={view} onBack={() => setPanel(null)} />;

  const need = Math.max(0, s.minPlayers - n);
  return (
    <div className="screen grid lobby">
      <header className="lb-bar">
        <Button size="sm" icon="leave" onClick={onLeave}>Leave</Button>
        <button type="button" className="lb-code" onClick={invite} aria-label="Share room code">
          <small>Code</small><b>{view.code}</b>{copied ? <Icon name="check" size={18} strokeWidth={3} /> : <Icon name="copy" size={18} />}
        </button>
        <span className="lb-room">{view.roomName || 'Waiting for players'}</span>
        <button type="button" className="hm-icon" aria-label="Customize" onClick={() => setPanel('customize')}><Icon name="user" size={20} /></button>
        <button type="button" className="hm-icon" aria-label="Game rules" onClick={() => setPanel('settings')}><Icon name="settings" size={20} /></button>
      </header>

      <div className="lb-body">
        <div className="lb-stage">
          <LobbyScene view={view} onTerminal={() => setPanel('customize')} />
          <form className="lb-chat" onSubmit={send}>
            <input className="ui-input" value={text} maxLength={140} placeholder="Say something…" aria-label="Lobby chat" onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="send" aria-label="Send"><Icon name="send" size={18} /></button>
          </form>
        </div>

        <aside className="lb-side">
          <div className="lb-head">
            <h2>Players <b>{n}/{MAX_PLAYERS}</b></h2>
            {isHost && n < MAX_PLAYERS && <button type="button" className="lb-add" onClick={addBot}><Icon name="plus" size={14} strokeWidth={3} /> Bot</button>}
          </div>
          <ul className="lb-list">
            {view.roster.map((r) => (
              <li key={r.id} className={r.id === me.id ? 'me' : ''}>
                <Robot color={r.color} hat={r.hat} size={26} />
                <span className="pname">{r.name}{r.bot ? ' · bot' : ''}</span>
                {r.id === view.hostId && <Chip kind="host">Host</Chip>}
                {r.afk ? <Chip kind="afk">AFK</Chip> : <i className="dot-ready" title="Ready" />}
                {r.bot && isHost && <button type="button" className="rm" aria-label={`Remove ${r.name}`} onClick={() => socket.emit('removeBot', r.id)}><Icon name="close" size={14} /></button>}
              </li>
            ))}
          </ul>
          <button type="button" className="lb-rules" onClick={() => setPanel('settings')}>
            {s.impostors} impostor{s.impostors === 1 ? '' : 's'} · {s.tasksPerPlayer} tasks · {s.killCooldown}s cooldown <em>{isHost ? 'Edit' : 'View'}</em>
          </button>
          {isHost ? (
            <Button variant="start" size="xl" className="start-game" disabled={need > 0} onClick={start}>
              <span className="stack">Start game<small>{need > 0 ? `Need ${need} more · min ${s.minPlayers}` : `${ready} of ${n} ready`}</small></span>
            </Button>
          ) : (
            <Button variant="start" size="xl" className="start-game" disabled><span className="stack">Waiting for host<small>{ready} of {n} ready</small></span></Button>
          )}
          <div className="ui-err" role="alert">{err}</div>
        </aside>
      </div>
    </div>
  );
}
