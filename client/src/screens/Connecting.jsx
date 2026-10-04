import { Button } from '../ui/kit.jsx';
import Robot from '../Robot.jsx';
import { savedLook } from '../net.js';

const TIPS = [
  'Vents only connect in pairs: V1 Cafeteria ↔ Conference, V2 Toilets ↔ Sec.',
  'Glass walls block movement but not sight. Impostors know to stay out of view.',
  'Lights out shrinks everyone’s vision. Fix it at the Toilets wall.',
  'The network and Wi-Fi sabotages end the game if the timer runs out.',
  'Wi-Fi reset needs two players holding Sec and Call 3 at the same time.',
];

// Spinning ring around the player's own robot, shared by every loading state.
function Ring() {
  const look = savedLook();
  return <div className="cn-ring"><Robot color={look.color || 'cyan'} hat={look.hat} size={64} /></div>;
}

// Shown before the game server has answered (a free server can take a minute to wake up).
export function ServerSplash({ slow }) {
  return (
    <div className="screen grid connecting">
      <div className="cn-main">
        <Ring />
        <div className="cn-text">
          <h1 className="home-logo small">Impostor<span>.exe</span></h1>
          <p className="cn-step">Connecting to the game server…</p>
          <div className="cn-bar"><i /></div>
          {slow && <p className="cn-note">The server may be waking up. This can take up to a minute.</p>}
        </div>
      </div>
    </div>
  );
}

// Shown while joining a room. Each step reflects something that really happens.
export default function Connecting({ code, hostName, joined, synced, mapReady, onCancel, onSkip }) {
  const steps = [
    { label: 'Finding the room on office Wi-Fi', done: joined },
    { label: hostName ? `Joining host ${hostName}` : 'Joining the host', done: joined && synced },
    { label: 'Loading Office HQ map', done: mapReady },
    { label: 'Syncing players & avatars', done: synced && mapReady },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const active = steps.find((s) => !s.done) || steps[steps.length - 1];
  const tip = TIPS[(code || 'x').charCodeAt(0) % TIPS.length];

  return (
    <div className="screen grid connecting">
      <div className="cn-top">
        <Button size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="join" onClick={onSkip} disabled={!synced}>Skip to lobby</Button>
      </div>
      <div className="cn-main">
        <Ring />
        <div className="cn-text">
          <h1 className="home-logo small">Impostor<span>.exe</span></h1>
          {code && <span className="cn-code">Room <b>{code}</b></span>}
          <p className="cn-step">{active.label}…</p>
          <div className="cn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
            <i style={{ width: `${Math.max(8, (doneCount / steps.length) * 100)}%` }} />
          </div>
          <ul className="cn-dots" aria-hidden="true">
            {steps.map((s) => <li key={s.label} className={s.done ? 'done' : s === active ? 'active' : ''} />)}
          </ul>
        </div>
      </div>
      <p className="cn-tip"><b>Tip</b> {tip}</p>
    </div>
  );
}
