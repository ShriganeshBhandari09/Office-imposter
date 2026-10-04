import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, getPid, emit, savedName, savedRoom, saveRoom, saveName, savedLook, saveLook } from './net.js';
import { loadMap, mapIsReady } from './assets.js';
import Home from './screens/Home.jsx';
import Connecting, { ServerSplash } from './screens/Connecting.jsx';
import Customize from './screens/Customize.jsx';
import Lobby from './screens/Lobby.jsx';
import { Meeting } from './screens/Meeting.jsx';
import Ejection from './screens/Ejection.jsx';
import GameOver from './screens/GameOver.jsx';
import Game from './Game.jsx';
import { useAudioCues } from './audioCues.js';

const MIN_CONNECTING_MS = 900; // long enough to read the checklist, short enough not to feel slow

export default function App() {
  const [view, setView] = useState(null);
  const [room, setRoom] = useState(null); // code of the room we're in
  const [connected, setConnected] = useState(socket.connected);
  const [slow, setSlow] = useState(false);
  const [flow, setFlow] = useState(null); // { at, code } while joining from the start screen
  const [homeError, setHomeError] = useState('');
  const [avatar, setAvatar] = useState(false); // the Customize screen opened from the start screen
  const [mapReady, setMapReady] = useState(mapIsReady());
  const viewRef = useRef(null);
  const roomRef = useRef(null);
  const pid = useRef(getPid()).current;
  useAudioCues(view);

  const enter = (code) => { roomRef.current = code; setRoom(code); saveRoom(code); };
  const leave = useCallback(() => {
    socket.emit('leaveRoom');
    roomRef.current = null; setRoom(null); saveRoom(null);
    viewRef.current = null; setView(null); setFlow(null);
  }, []);

  useEffect(() => { loadMap().then(() => setMapReady(true)); }, []);

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
      emit('join', { pid, name, code, ...savedLook() }).then((r) => {
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

  // Host or join from the start screen. The Connecting screen stays up until the room state, the map
  // and a short minimum have all arrived.
  const join = useCallback(async (event, data) => {
    setHomeError('');
    setFlow({ at: Date.now(), code: data.code || '' });
    const res = await emit(event, { pid, ...data });
    if (res.error) { setFlow(null); setHomeError(res.error); return; }
    enter(res.code);
    setFlow((f) => f && { ...f, code: res.code });
  }, [pid]);

  const synced = !!view?.me;
  useEffect(() => {
    if (!flow || !synced || !mapReady) return;
    const wait = Math.max(0, MIN_CONNECTING_MS - (Date.now() - flow.at));
    const t = setTimeout(() => setFlow(null), wait);
    return () => clearTimeout(t);
  }, [flow, synced, mapReady]);

  if (!connected && !view) {
    return <ServerSplash slow={slow} />;
  }

  const host = view?.roster.find((r) => r.id === view.hostId);
  let body;
  if (avatar && !room) {
    const look = savedLook();
    body = (
      <Customize canRename initial={{ name: savedName(), color: look.color || 'cyan', hat: look.hat }}
        onBack={() => setAvatar(false)}
        onSave={({ name, color, hat }) => { saveName(name); saveLook({ color, hat }); setAvatar(false); return {}; }} />
    );
  } else if (!room && !flow) {
    body = <Home onJoin={join} onAvatar={() => setAvatar(true)} error={homeError} />;
  } else if (flow || !synced) {
    body = (
      <Connecting code={room || flow?.code} hostName={host?.name} joined={!!room} synced={synced} mapReady={mapReady}
        onCancel={leave} onSkip={() => setFlow(null)} />
    );
  } else if (view.phase === 'lobby') {
    body = <Lobby view={view} onLeave={leave} />;
  } else {
    body = (
      <>
        <Game view={view} viewRef={viewRef} onLeave={leave} />
        {view.phase === 'meeting' && view.meeting && <Meeting view={view} />}
        {view.phase === 'ejection' && view.ejection && <Ejection view={view} />}
        {view.phase === 'ended' && view.result && <GameOver view={view} onLeave={leave} />}
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
