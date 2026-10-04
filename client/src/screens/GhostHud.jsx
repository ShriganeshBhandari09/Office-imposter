import { useEffect, useRef, useState } from 'react';
import Icon from '../ui/icons.jsx';
import { socket } from '../net.js';
import { colorHex } from '../robot.js';

// The "You are a ghost" banner. It fades after a few seconds; the pill below stays.
export function GhostBanner() {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 7000); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="ghost-banner" role="status">
      <h2>You are a ghost</h2>
      <p>Float through walls and finish your tasks. Only ghosts can see your chat.</p>
    </div>
  );
}

export function GhostPill() {
  return <div className="hud-room ghost">Ghost · can't report or vote</div>;
}

// Chat between dead players. The living never receive it.
export function GhostChat({ messages }) {
  const [text, setText] = useState('');
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('chat', text);
    setText('');
  };
  return (
    <section className="ghost-chat">
      <h3>Ghost chat</h3>
      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Nobody here yet.</p>}
        {messages.map((c) => (
          <div key={c.id} className="chat-msg"><b style={{ color: colorHex(c.color) }}>{c.name}</b><p>{c.text}</p></div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="chat-form">
        <input className="ui-input" value={text} maxLength={140} placeholder="Talk to other ghosts…" aria-label="Ghost chat" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="send" aria-label="Send"><Icon name="send" size={20} /></button>
      </form>
    </section>
  );
}
