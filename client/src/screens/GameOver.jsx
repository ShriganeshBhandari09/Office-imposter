import Robot from '../Robot.jsx';
import { Button } from '../ui/kit.jsx';
import { socket } from '../net.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function GameOver({ view, onLeave }) {
  const r = view.result;
  const me = view.me;
  const crewWin = r.winner === 'crew';
  const won = me && (crewWin === (me.role !== 'impostor'));
  const isHost = view.hostId === me?.id;
  return (
    <div className={`over ${crewWin ? 'crew' : 'imp'}`}>
      <small className="over-kicker">{won ? 'You win' : 'You lose'}</small>
      <h1>{crewWin ? 'Crewmates win' : 'Impostors win'}</h1>
      <p className="over-reason">{r.reason}</p>
      <ul className="over-lineup">
        {(r.players || []).map((p) => {
          const imp = p.role === 'impostor';
          return (
            <li key={p.id} className={p.alive ? '' : 'dead'}>
              <Robot color={p.color} hat={p.hat} size={72} eyes={imp ? '#FF3D5A' : undefined} />
              <b>{p.name}</b>
              <span className={`role ${imp ? 'imp' : ''}`}>{imp ? 'Impostor' : 'Crew'}{p.alive ? '' : ' · dead'}</span>
            </li>
          );
        })}
      </ul>
      <div className="over-stats">
        <div><small>Tasks done</small><b>{r.tasksDone} / {r.tasksTotal}</b></div>
        <div><small>Meetings</small><b>{r.meetings}</b></div>
        <div><small>Match time</small><b>{mmss(r.seconds || 0)}</b></div>
      </div>
      <div className="over-actions">
        {isHost
          ? <Button variant="primary" size="xl" onClick={() => socket.emit('backToLobby')}>Play again</Button>
          : <Button size="xl" disabled>Waiting for host</Button>}
        <Button size="xl" onClick={onLeave}>Back to title</Button>
      </div>
    </div>
  );
}
