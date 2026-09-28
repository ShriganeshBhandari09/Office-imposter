import { useEffect, useRef, useState } from 'react';
import { socket, getPid, emit, savedName, savedRoom, saveRoom } from './net.js';
import { Home, Lobby } from './Lobby.jsx';
import { Meeting, Ejection, GameOver } from './Meeting.jsx';
import Game from './Game.jsx';

export default function App() {
  const [view, setView] = useState(null);
  const [room, setRoom] = useState(null); // code of the room we're in
  const [connected, setConnected] = useState(socket.connected);
  const [slow, setSlow] = useState(false);
  const viewRef = useRef(null);
  const roomRef = useRef(null);
  const pid = useRef(getPid()).current;

  const enter = (code) => { roomRef.current = code; setRoom(code); saveRoom(code); };
  const leave = () => {
    socket.emit('leaveRoom');
    roomRef.current = null; setRoom(null); saveRoom(null);
    viewRef.current = null; setView(null);
  };

  useEffect(() => {
    const onState = (v) => {
      if (!roomRef.current || v.code !== roomRef.current) return;
      viewRef.current = v; setView(v);
    };
    // After a refresh or a dropped connection, silently rejoin the same room as the same player.
    const onConnect = () => {
      setConnected(true);
      const code = roomRef.current || savedRoom();
      const name = savedName();
      if (!code || !name) return;
      emit('join', { pid, name, code }).then((r) => {
        if (r.ok) enter(r.code);
        else { roomRef.current = null; setRoom(null); saveRoom(null); }
      });
    };
    const onDisconnect = () => setConnected(false);
    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    // A free server can take up to a minute to wake up.
    const t = setTimeout(() => setSlow(true), 4000);
    return () => { clearTimeout(t); socket.off('state', onState); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, []);

  if (!connected && !view) {
    return (
      <div className="au-screen au-loading"><div>
        <p className="muted">Connecting to the game server…</p>
        {slow && <p className="muted small">The server may be waking up. This can take up to a minute.</p>}
      </div></div>
    );
  }

  let body;
  if (!room) body = <Home pid={pid} onJoined={enter} />;
  else if (!view?.me) body = <div className="au-screen au-loading"><p>Joining room {room}…</p></div>;
  else if (view.phase === 'lobby') body = <Lobby view={view} onLeave={leave} />;
  else {
    body = (
      <>
        <Game view={view} viewRef={viewRef} />
        {view.phase === 'meeting' && view.meeting && <Meeting view={view} />}
        {view.phase === 'ejection' && view.ejection && <Ejection view={view} />}
        {view.phase === 'ended' && view.result && <GameOver view={view} />}
      </>
    );
  }
  return (
    <>
      {body}
      {!connected && <div className="offline">Connection lost. Reconnecting…</div>}
    </>
  );
}
