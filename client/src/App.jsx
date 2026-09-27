import { useEffect, useRef, useState } from 'react';
import { socket, getPid, emit, savedName } from './net.js';
import { JoinForm, Lobby } from './Lobby.jsx';
import { Meeting, Ejection, GameOver } from './Meeting.jsx';
import Game from './Game.jsx';

export default function App() {
  const [view, setView] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const viewRef = useRef(null);
  const pid = useRef(getPid()).current;
  const joinedName = useRef(null);

  useEffect(() => {
    const onState = (v) => { viewRef.current = v; setView(v); };
    // After a refresh or a dropped connection, silently rejoin as the same player.
    const onConnect = () => {
      setConnected(true);
      const name = joinedName.current || savedName();
      if (name) emit('join', { pid, name }).then((r) => { if (r.ok) joinedName.current = name; });
    };
    const onDisconnect = () => setConnected(false);
    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) onConnect();
    return () => { socket.off('state', onState); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, []);

  if (!view) return <div className="screen"><p className="muted">Connecting to the game server…</p></div>;

  let body;
  if (!view.me) body = <JoinForm view={view} pid={pid} onJoined={(n) => (joinedName.current = n)} />;
  else if (view.phase === 'lobby') body = <Lobby view={view} />;
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
