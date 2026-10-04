import { useEffect, useState } from 'react';
import Icon from '../ui/icons.jsx';
import { GAMES } from './games.jsx';

const W = 560, H = 420; // the device frame is laid out at this size, then scaled to fit the screen

// Shrinks the popup to fit short or narrow screens (phones in landscape are ~360px tall).
function useFitScale() {
  // On a phone held sideways the popup is also capped, so it sits as a compact card instead of filling the screen.
  const calc = () => Math.min(window.innerHeight < 520 ? 0.72 : 1, (window.innerWidth - 16) / W, (window.innerHeight - 16) / H);
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

// The device frame every task and sabotage fix uses (foundation: components/TaskPopup).
export default function TaskPopup({ def, onDone, onClose, holds = [], resetProgress = 0, onHold, playerName }) {
  const scale = useFitScale();
  const sabotage = def.num == null;
  const Game = GAMES[def.type];

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="tp-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`tp ${sabotage ? 'alert' : ''}`} style={{ transform: `scale(${scale})` }} role="dialog" aria-label={def.name}>
        <header className="tp-head">
          <span className="tp-badge">{sabotage ? '!' : String(def.num).padStart(2, '0')}</span>
          <div className="tp-title">
            <h2>{def.name}</h2>
            <small>{def.room || ''}{def.room ? ' · ' : ''}{sabotage ? 'Sabotage fix' : 'Task'}</small>
          </div>
          <button type="button" className="tp-close" onClick={onClose} aria-label="Close"><Icon name="close" size={22} /></button>
        </header>
        {Game
          ? <Game def={def} onDone={onDone} holds={holds} resetProgress={resetProgress} onHold={onHold} playerName={playerName} />
          : <p className="tp-foot">Unknown task</p>}
      </div>
    </div>
  );
}
