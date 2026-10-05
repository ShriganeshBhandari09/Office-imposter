import Lineup from './Lineup.jsx';

// "CREWMATE / IMPOSTOR": shown for a few seconds at the start of a round.
// Crew see everyone lined up; an impostor sees only themselves and their partners.
export default function RoleReveal({ view }) {
  const me = view.me;
  const isImp = me.role === 'impostor';
  const mates = view.roster.filter((r) => r.role === 'impostor' && r.id !== me.id);
  const lineup = isImp ? view.roster.filter((r) => r.role === 'impostor') : view.roster;
  const n = view.settings.impostors;
  const count = Math.min(n, Math.max(1, Math.floor((view.roster.length - 1) / 2)));

  return (
    <div className={`reveal ${isImp ? 'imp' : 'crew'}`} role="status">
      <h1>{isImp ? 'Impostor' : 'Crewmate'}</h1>
      <p className="reveal-sub">
        {isImp
          ? mates.length ? <>Your partner{mates.length > 1 ? 's are' : ' is'} <em>{mates.map((m) => m.name).join(', ')}</em></> : "Eliminate the crew. Don't get caught."
          : <>There {count === 1 ? 'is' : 'are'} {count} <em>Impostor{count === 1 ? '' : 's'}</em> among us</>}
      </p>
      <Lineup players={lineup} leadId={me.id} eyes={isImp ? '#FF3D5A' : undefined} />
      <div className="reveal-pill"><i>{Math.max(1, view.roleRevealLeft)}</i> Dropping into the office…</div>
    </div>
  );
}
