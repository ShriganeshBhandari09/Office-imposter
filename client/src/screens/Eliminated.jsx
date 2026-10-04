import Robot from '../Robot.jsx';
import { Button } from '../ui/kit.jsx';

// Shown to a player after an impostor got them, once the kill cutscene is over.
export default function Eliminated({ view, kill, onContinue }) {
  const myRow = view.roster.find((r) => r.id === view.me.id);
  return (
    <div className="elim" role="alertdialog" aria-label="You were eliminated">
      <h1>You were eliminated</h1>
      <p className="elim-sub">An impostor got you{kill.room ? ` in the ${kill.room}` : ''}.</p>
      <div className="elim-stage">
        <div className="elim-band" />
        <Robot className="elim-killer" hex={kill.killerHex} hat={kill.killerHat} size={170} eyes="#FF3D5A" />
        <Robot className="elim-body" color={myRow.color} hat={myRow.hat} state="body" size={190} />
      </div>
      <p className="elim-note">You can still finish tasks as a ghost to help your team.</p>
      <Button size="xl" className="elim-btn" onClick={onContinue}>Continue as ghost</Button>
    </div>
  );
}
