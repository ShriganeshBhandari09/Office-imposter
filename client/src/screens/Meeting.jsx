import { useEffect, useRef, useState } from 'react';
import Robot from '../Robot.jsx';
import Icon from '../ui/icons.jsx';
import { Button, Chip } from '../ui/kit.jsx';
import { socket } from '../net.js';
import { colorHex } from '../robot.js';

// One player in the vote grid (foundation: components/VoteCard).
function VoteCard({ r, you, caller, voted, selected, mine, disabled, onSelect, onConfirm, onCancel }) {
  const dead = !r.alive;
  return (
    <div className={`vote-card ${dead ? 'dead' : ''} ${selected ? 'sel' : ''} ${mine ? 'mine' : ''}`}>
      <button type="button" className="vc-main" disabled={disabled || dead} onClick={() => onSelect(r.id)}>
        <Robot color={r.color} hat={r.hat} state={dead ? 'body' : 'alive'} size={dead ? 52 : 38} />
        <span className="vc-name"><b>{r.name}</b>
          {dead ? <small className="bad">Dead</small> : you ? <small className="you">You</small> : caller ? <small className="rep">Reported</small> : null}
        </span>
      </button>
      {selected && (
        <div className="vc-actions">
          <button type="button" aria-label={`Vote ${r.name}`} onClick={onConfirm}><Icon name="check" size={22} /></button>
          <button type="button" className="no" aria-label="Cancel" onClick={onCancel}><Icon name="close" size={22} /></button>
        </div>
      )}
      {voted && !dead && <Chip kind="voted">Voted</Chip>}
    </div>
  );
}

export function Meeting({ view }) {
  const m = view.meeting;
  const me = view.me;
  const [sel, setSel] = useState(null);
  const [text, setText] = useState('');
  const chatEnd = useRef();
  const caller = view.roster.find((r) => r.id === m.callerId);
  const voted = new Set(m.voted);
  const living = view.roster.filter((r) => r.alive);
  const voting = m.stage === 'voting';
  const canVote = me.alive && !m.myVote && voting;

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end' }); }, [m.chat.length]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat', text);
    setText('');
  };
  const vote = (target) => { socket.emit('vote', target); setSel(null); };
  const myVoteName = m.myVote === 'skip' ? 'skip' : view.roster.find((r) => r.id === m.myVote)?.name;
  const hint = !me.alive ? "Ghosts can't vote or chat."
    : m.myVote ? `You voted ${m.myVote === 'skip' ? 'to skip' : `for ${myVoteName}`}. ${voted.size}/${living.length} voted`
    : voting ? `Tap a player, then confirm. ${voted.size}/${living.length} voted`
    : 'Discuss first. Voting opens soon.';
  const sub = m.reason === 'body'
    ? `${caller?.name} reported ${m.bodyName}'s body${m.bodyRoom ? ` in ${m.bodyRoom}` : ''}`
    : `${caller?.name} pressed the emergency button`;

  return (
    <div className="meeting-wrap">
      <div className="meeting-panel">
        <header className="mp-head">
          <span className="mp-icon"><Icon name="report" size={30} /></span>
          <div><h1>Who is the impostor?</h1><p>{sub}</p></div>
          <div className="mp-timer"><small>{voting ? 'Voting ends in' : 'Voting opens in'}</small><b>{m.secondsLeft}s</b></div>
        </header>
        <div className="mp-body">
          <section className="mp-vote">
            <div className="vote-grid">
              {view.roster.map((r) => (
                <VoteCard key={r.id} r={r} you={r.id === me.id} caller={r.id === m.callerId} voted={voted.has(r.id)}
                  selected={sel === r.id && canVote} mine={m.myVote === r.id} disabled={!canVote}
                  onSelect={setSel} onConfirm={() => vote(r.id)} onCancel={() => setSel(null)} />
              ))}
            </div>
            <footer className="mp-foot">
              <div className="mp-actions">
                {canVote && sel === 'skip' ? (
                  <>
                    <span className="mp-confirm">Skip your vote?</span>
                    <Button variant="start" size="md" icon="check" onClick={() => vote('skip')}>Yes, skip</Button>
                    <Button size="md" icon="close" aria-label="Cancel" onClick={() => setSel(null)} />
                  </>
                ) : (
                  <Button size="md" disabled={!canVote} onClick={() => setSel('skip')}>{m.myVote === 'skip' ? 'Skipped' : 'Skip vote'}</Button>
                )}
              </div>
              <span className="mp-hint">{hint}</span>
            </footer>
          </section>
          <aside className="mp-chat">
            <h2>Chat</h2>
            <div className="chat-log">
              {m.chat.length === 0 && <p className="muted">Discuss who is suspicious…</p>}
              {m.chat.map((c) => (
                <div key={c.id} className="chat-msg">
                  <b style={{ color: colorHex(c.color) }}>{c.name}</b>
                  <p>{c.text}</p>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            {me.alive ? (
              <form onSubmit={send} className="chat-form">
                <input className="ui-input" value={text} maxLength={140} placeholder="Make your case…" aria-label="Chat message" onChange={(e) => setText(e.target.value)} />
                <button type="submit" className="send" aria-label="Send"><Icon name="send" size={20} /></button>
              </form>
            ) : <p className="muted ghost-note">Ghosts can't chat here.</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
