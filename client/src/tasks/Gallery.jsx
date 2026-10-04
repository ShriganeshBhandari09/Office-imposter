import { useState } from 'react';
import TaskPopup from './TaskPopup.jsx';
import { TASKS, SABOTAGE_FIX } from '../shared/map.js';

// Developer page (open /?tasks): pick any task or sabotage fix and play it without joining a game.
const ALL = [...TASKS, ...Object.values(SABOTAGE_FIX).flat().filter((f) => f.id !== 'wifiB')];

export default function Gallery() {
  const [id, setId] = useState(null);
  const [key, setKey] = useState(0);
  const def = ALL.find((t) => t.id === id);
  const [holds, setHolds] = useState([]);
  return (
    <div className="screen grid" style={{ padding: 24, overflow: 'auto' }}>
      <h1 className="type-page-title" style={{ marginBottom: 16 }}>Task gallery</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ALL.map((t) => (
          <button key={t.id} type="button" className="chip-btn" onClick={() => { setId(t.id); setKey((k) => k + 1); }}>
            {t.num != null ? `${t.num}. ` : '! '}{t.name}
          </button>
        ))}
      </div>
      {def && (
        <TaskPopup key={key} def={def} holds={holds} resetProgress={holds.length ? 0.5 : 0} playerName="Dev"
          onHold={(h) => setHolds(h ? ['wifiB'] : [])} onClose={() => setId(null)}
          onDone={() => setId(null)} />
      )}
    </div>
  );
}
