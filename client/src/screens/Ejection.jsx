import { useEffect, useState } from 'react';
import Robot from '../Robot.jsx';

// Timeline (ms): the ejected player drifts across space, then the verdict types out letter by letter.
const TYPE_START = 1400;
const TYPE_MS = 55;

export default function Ejection({ view }) {
  const e = view.ejection;
  const tally = Object.entries(e.tally || {});
  const name = (id) => (id === 'skip' ? 'Skipped' : view.roster.find((r) => r.id === id)?.name || '?');
  const lines = [e.sub || e.text]; // with "confirm ejects" off there is only the plain text
  const total = lines.reduce((n, l) => n + l.length, 0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    let iv;
    const start = setTimeout(() => { iv = setInterval(() => setTyped((n) => (n >= total ? n : n + 1)), TYPE_MS); }, TYPE_START);
    return () => { clearTimeout(start); clearInterval(iv); };
  }, [total]);

  // Split the typed character count across the lines.
  let left = typed;
  const shown = lines.map((l) => { const s = l.slice(0, Math.max(0, left)); left -= l.length; return s; });
  const done = typed >= total;
  const typing = done ? -1 : shown.findIndex((s, i) => s.length < lines[i].length);
  const caret = (i) => (typing === i ? <span className="caret">▌</span> : null);

  return (
    <div className="eject">
      <div className="dots" />
      {e.color && (
        <div className="eject-fly">
          <i className="eject-trail" />
          <Robot color={e.color} hat={e.hat} size={110} eyes={e.wasImpostor ? '#FF3D5A' : undefined} />
        </div>
      )}
      <div className="eject-text">
        <h1>{shown[0]}{caret(0)}</h1>
        {e.impostorsLeft != null && (
          <p className={`fade ${done ? 'in' : ''} ${e.impostorsLeft === 0 ? '' : 'left'}`}>
            {e.impostorsLeft === 0 ? 'No impostors remain.' : `${e.impostorsLeft} Impostor${e.impostorsLeft === 1 ? '' : 's'} remain${e.impostorsLeft === 1 ? 's' : ''}.`}
          </p>
        )}
        {tally.length > 0 && (
          <div className={`tally fade ${done ? 'in' : ''}`}>
            {tally.map(([target, voters]) => <div key={target}><b>{name(target)}</b> <span>{voters.map(name).join(', ')}</span></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
