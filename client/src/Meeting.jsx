import { useEffect, useRef, useState } from 'react';
import { COLORS } from './shared/map.js';
import { spriteURL } from './render.js';
import { socket } from './net.js';

const hex = (id) => COLORS.find((c) => c.id === id)?.hex;

export function Meeting({ view }) {
  const m = view.meeting;
  const me = view.me;
  const [sel, setSel] = useState(null);
  const [text, setText] = useState('');
  const chatEnd = useRef();
  const caller = view.roster.find((r) => r.id === m.callerId);
  const voted = new Set(m.voted);
  const canVote = me.alive && !m.myVote;

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [m.chat.length]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat', text);
    setText('');
  };
  const vote = (target) => { socket.emit('vote', target); setSel(null); };

  return (
    <div className="overlay meeting">
      <div className="meeting-box">
        <div className="meeting-head">
          <h2>{m.reason === 'body' ? 'Dead body reported!' : 'Emergency meeting!'}</h2>
          <div className="muted">
            {m.reason === 'body'
              ? <>{caller?.name} found <b style={{ color: hex(m.bodyColor) }}>{m.bodyName}</b>.</>
              : <>{caller?.name} pressed the button.</>}
            {' '}Voting ends in <b>{m.secondsLeft}s</b>
          </div>
        </div>
        <div className="meeting-body">
          <div className="vote-grid">
            {view.roster.map((r) => {
              const dead = !r.alive;
              return (
                <button key={r.id} disabled={!canVote || dead}
                  className={`vote-card ${dead ? 'dead' : ''} ${sel === r.id ? 'sel' : ''} ${m.myVote === r.id ? 'mine' : ''}`}
                  onClick={() => setSel(r.id)}>
                  <img alt="" src={spriteURL(hex(r.color))} />
                  <span className="vname">{r.name}{r.id === me.id ? ' (you)' : ''}</span>
                  {r.id === m.callerId && <span className="tag">called</span>}
                  {voted.has(r.id) && <span className="tag ok">voted</span>}
                  {dead && <span className="tag bad">dead</span>}
                  {!r.connected && <span className="tag">offline</span>}
                </button>
              );
            })}
          </div>
          <div className="vote-actions">
            {!me.alive ? <p className="muted">Ghosts can't vote or chat.</p>
              : m.myVote ? <p className="muted">You voted {m.myVote === 'skip' ? 'to skip' : `for ${view.roster.find((r) => r.id === m.myVote)?.name}`}.</p>
              : (
                <>
                  <button className="btn danger" disabled={!sel} onClick={() => vote(sel)}>
                    {sel ? `Vote ${view.roster.find((r) => r.id === sel)?.name}` : 'Select a player'}
                  </button>
                  <button className="btn" onClick={() => vote('skip')}>Skip vote</button>
                </>
              )}
          </div>
        </div>
        <div className="chat">
          <div className="chat-log">
            {m.chat.length === 0 && <p className="muted small">Discuss who is suspicious…</p>}
            {m.chat.map((c) => (
              <div key={c.id} className="chat-line">
                <b style={{ color: hex(c.color) }}>{c.name}:</b> {c.text}
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          {me.alive && (
            <form onSubmit={send} className="chat-form">
              <input className="input" value={text} maxLength={140} placeholder="Type a message and press Enter"
                onChange={(e) => setText(e.target.value)} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Timeline (ms): the ejected player drifts across space, then the verdict types out letter by letter.
const TYPE_START = 1400;
const TYPE_MS = 55;

export function Ejection({ view }) {
  const e = view.ejection;
  const tally = Object.entries(e.tally || {});
  const name = (id) => (id === 'skip' ? 'Skipped' : view.roster.find((r) => r.id === id)?.name || '?');
  const lines = [e.text, e.sub].filter(Boolean);
  const total = lines.reduce((n, l) => n + l.length, 0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    let iv;
    const start = setTimeout(() => {
      iv = setInterval(() => setTyped((n) => (n >= total ? n : n + 1)), TYPE_MS);
    }, TYPE_START);
    return () => { clearTimeout(start); clearInterval(iv); };
  }, [total]);

  // Split the typed character count across the lines.
  let left = typed;
  const shown = lines.map((l) => { const s = l.slice(0, Math.max(0, left)); left -= l.length; return s; });
  const done = typed >= total;
  const typing = done ? -1 : shown.findIndex((s, i) => s.length < lines[i].length);
  const caret = (i) => (typing === i ? <span className="caret">▌</span> : null);

  return (
    <div className="overlay eject">
      <div className="stars far" />
      <div className="stars near" />
      {e.color && <img className="ejectee" alt="" src={spriteURL(hex(e.color))} />}
      <div className="eject-text">
        <h1>{shown[0]}{caret(0)}</h1>
        {lines[1] && <h2>{shown[1]}{caret(1)}</h2>}
        <p className={`fade ${done ? 'in' : ''}`}>
          {e.impostorsLeft} impostor{e.impostorsLeft === 1 ? '' : 's'} remain{e.impostorsLeft === 1 ? 's' : ''}.
        </p>
        {tally.length > 0 && (
          <div className={`tally fade ${done ? 'in' : ''}`}>
            {tally.map(([target, voters]) => (
              <div key={target}><b>{name(target)}</b>: {voters.map(name).join(', ')}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GameOver({ view }) {
  const r = view.result;
  const me = view.me;
  const won = me && ((r.winner === 'impostor') === (me.role === 'impostor'));
  const isHost = view.hostId === me?.id;
  return (
    <div className={`overlay over ${r.winner}`}>
      <h1>{r.winner === 'crew' ? 'Crewmates win!' : 'Impostors win!'}</h1>
      <h2>{won ? 'Victory' : 'Defeat'}</h2>
      <p>{r.reason}</p>
      <div className="imps">
        {r.impostors.map((p) => (
          <div key={p.name} className="who">
            <img alt="" src={spriteURL(hex(p.color))} />
            <div>{p.name}</div>
          </div>
        ))}
      </div>
      <p className="muted">{r.impostors.length > 1 ? 'The impostors were' : 'The impostor was'} above.</p>
      {isHost ? <button className="btn huge" onClick={() => socket.emit('backToLobby')}>Back to lobby</button>
        : <p className="muted">Waiting for the host…</p>}
    </div>
  );
}
