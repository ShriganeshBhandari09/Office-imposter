import Robot from '../Robot.jsx';

// Among Us style line-up for the role reveal and game over screens: the lead player stands in
// front, the rest fan out to both sides in a V, each step a little smaller and further back.
export default function Lineup({ players, leadId, eyes }) {
  const lead = players.find((p) => p.id === leadId) || players[0];
  const slots = lead ? [lead, ...players.filter((p) => p !== lead)] : [];
  const steps = Math.max(1, Math.ceil((slots.length - 1) / 2));
  return (
    <div className="lineup" style={{ '--steps': steps }}>
      <div className="lineup-glow" />
      {slots.map((p, i) => {
        const step = Math.ceil(i / 2);
        const side = i === 0 ? 0 : i % 2 ? -1 : 1;
        return (
          <figure key={p.id} className={`lu ${i === 0 ? 'lead' : ''} ${p.alive === false ? 'dead' : ''}`}
            style={{ '--step': step, '--side': side, zIndex: 20 - step }}>
            <figcaption>{p.name}</figcaption>
            <Robot color={p.color} hat={p.hat} size={160} eyes={eyes} />
          </figure>
        );
      })}
    </div>
  );
}
