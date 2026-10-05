import Lineup from './Lineup.jsx';
import { Button } from '../ui/kit.jsx';
import { socket } from '../net.js';

// Victory / Defeat with the winning team lined up, Among Us style. Fits one screen, no scrolling.
export default function GameOver({ view, onLeave }) {
  const r = view.result;
  const me = view.me;
  const crewWin = r.winner === 'crew';
  const won = me && (crewWin === (me.role !== 'impostor'));
  const isHost = view.hostId === me?.id;
  const winners = (r.players || []).filter((p) => (p.role === 'impostor') !== crewWin);
  const impostors = (r.impostors || []).map((p) => p.name).join(', ');
  return (
    <div className={`over ${crewWin ? 'crew' : 'imp'} ${won ? 'won' : 'lost'}`}>
      <h1>{won ? 'Victory' : 'Defeat'}</h1>
      <p className="over-reason">
        {crewWin ? 'Crewmates win' : 'Impostors win'}. {r.reason}
        {crewWin && impostors && <> The impostor{r.impostors.length > 1 ? 's were' : ' was'} <em>{impostors}</em>.</>}
      </p>
      <Lineup players={winners} leadId={me?.id} eyes={crewWin ? undefined : '#FF3D5A'} />
      <div className="over-actions">
        {isHost
          ? <Button variant="primary" size="xl" onClick={() => socket.emit('backToLobby')}>Play again</Button>
          : <Button size="xl" disabled>Waiting for host</Button>}
        <Button size="xl" onClick={onLeave}>Back to title</Button>
      </div>
    </div>
  );
}
