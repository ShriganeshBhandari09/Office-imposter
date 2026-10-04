import Robot from '../Robot.jsx';
import { TASKS } from '../shared/map.js';

// "You are CREWMATE / IMPOSTOR": shown for a few seconds at the start of a round.
// Crew see everyone lined up; an impostor sees only themselves and their partners.
export default function RoleReveal({ view }) {
  const me = view.me;
  const isImp = me.role === 'impostor';
  const mates = view.roster.filter((r) => r.role === 'impostor' && r.id !== me.id);
  const lineup = isImp ? view.roster.filter((r) => r.role === 'impostor') : view.roster;
  // Put yourself in the middle.
  const others = lineup.filter((r) => r.id !== me.id);
  const mid = Math.floor(others.length / 2);
  const ordered = [...others.slice(0, mid), lineup.find((r) => r.id === me.id), ...others.slice(mid)];
  const n = view.settings.impostors;
  const count = Math.min(n, Math.max(1, Math.floor((view.roster.length - 1) / 2)));
  const sub = isImp
    ? mates.length ? `Your partner${mates.length > 1 ? 's are' : ' is'} ${mates.map((m) => m.name).join(', ')}. Eliminate the crew.` : "Eliminate the crew. Don't get caught."
    : `There ${count === 1 ? 'is 1 impostor' : `are ${count} impostors`} in the office. Finish your ${Math.min(view.settings.tasksPerPlayer, TASKS.length)} tasks.`;

  return (
    <div className={`reveal ${isImp ? 'imp' : 'crew'}`} role="status">
      <small className="reveal-kicker">You are</small>
      <h1>{isImp ? 'Impostor' : 'Crewmate'}</h1>
      <p className="reveal-sub">{sub}</p>
      <div className="reveal-stage">
        <div className="reveal-platform" />
        {ordered.map((r) => {
          const you = r.id === me.id;
          return (
            <figure key={r.id} className={you ? 'you' : ''}>
              <figcaption>{you ? `${r.name} (you)` : r.name}</figcaption>
              <Robot color={r.color} hat={r.hat} size={you ? 130 : 92} eyes={isImp ? '#FF3D5A' : undefined} />
            </figure>
          );
        })}
      </div>
      <div className="reveal-pill"><i>{Math.max(1, view.roleRevealLeft)}</i> Dropping into the office…</div>
    </div>
  );
}
