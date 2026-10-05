import { useState } from 'react';
import RoleReveal from './RoleReveal.jsx';
import { Meeting } from './Meeting.jsx';
import Ejection from './Ejection.jsx';
import Eliminated from './Eliminated.jsx';
import GameOver from './GameOver.jsx';
import Connecting, { ServerSplash } from './Connecting.jsx';
import { GhostBanner, GhostPill, GhostChat } from './GhostHud.jsx';
import { DEFAULT_SETTINGS } from '../shared/map.js';

// Developer page (open /?screens): every full-screen moment with made-up data, no game needed.
const PEOPLE = [
  ['me', 'Dev', 'cyan', 'headset'], ['a', 'Aarav', 'red', 'cap'], ['p', 'Priya', 'pink', 'none'], ['k', 'Kabir', 'green', 'headset'],
  ['s', 'Sneha', 'yellow', 'hardhat'], ['r', 'Rohan', 'orange', 'none'], ['m', 'Meera', 'purple', 'beanie'], ['t', 'Tara', 'white', 'beanie'],
];
const roster = (imp = ['r'], dead = ['m']) => PEOPLE.map(([id, name, color, hat]) => ({
  id, name, color, hat, alive: !dead.includes(id), connected: true, role: imp.includes(id) ? 'impostor' : 'crew',
}));

function mock(scene) {
  const impostor = scene.startsWith('reveal-imp');
  const rs = roster(impostor ? ['me', 'r'] : ['r']);
  const base = {
    phase: 'playing', hostId: 'me', settings: DEFAULT_SETTINGS, roster: rs, roleRevealLeft: 3,
    me: { id: 'me', role: impostor ? 'impostor' : 'crew', alive: true, tasks: [] },
    ghostChat: [{ id: '1', name: 'Meera', color: 'purple', text: 'It was Rohan!! he vented in Pixel' }, { id: '2', name: 'Dev', color: 'cyan', text: 'Same guy got me in the Lobby' }],
  };
  const meeting = (stage, extra = {}) => ({
    callerId: 'k', reason: 'body', bodyName: 'Meera', bodyColor: 'purple', bodyRoom: 'Pixel', bodyVent: 'V3', stage, secondsLeft: 42,
    voted: ['a', 's', 't'], myVote: null,
    chat: [{ id: 'c1', name: 'Kabir', color: 'green', text: 'Body in Pixel, right next to the V3 vent.' }, { id: 'c2', name: 'Priya', color: 'pink', text: 'Aarav was in Conference the whole time?' },
      { id: 'c3', name: 'Aarav', color: 'red', text: 'Doing Align the projector. Dev saw me.' }, { id: 'c4', name: 'Sneha', color: 'yellow', text: 'Rohan skipped his task in Call 2 twice.' }], ...extra,
  });
  switch (scene) {
    case 'reveal-crew': case 'reveal-imp': return base;
    case 'discussion': return { ...base, phase: 'meeting', meeting: meeting('discussion') };
    case 'voting': return { ...base, phase: 'meeting', meeting: meeting('voting') };
    case 'ejection': return { ...base, phase: 'ejection', ejection: { text: 'Rohan was ejected.', sub: 'Rohan was an Impostor.', color: 'orange', hat: 'none', wasImpostor: true, impostorsLeft: 1, tally: { r: ['a', 's', 't'], skip: ['p'] } } };
    case 'ejection-plain': return { ...base, phase: 'ejection', ejection: { text: 'Rohan was ejected.', sub: '', color: 'orange', hat: 'none', impostorsLeft: null, tally: {} } };
    case 'eliminated': return { ...base, me: { ...base.me, alive: false } };
    case 'ghost': return { ...base, me: { ...base.me, alive: false } };
    default: {
      const crewWin = scene === 'over-crew';
      return { ...base, phase: 'ended', result: { winner: crewWin ? 'crew' : 'impostor', reason: crewWin ? 'Every office task got done.' : 'The impostors outnumber the crew.',
        impostors: [{ name: 'Rohan', color: 'orange' }], players: roster(['r'], ['p', 'm']).map((r) => ({ ...r })), tasksDone: 66, tasksTotal: 66, meetings: 3, seconds: 760 } };
    }
  }
}

const SCENES = ['loading', 'loading-sync', 'server', 'reveal-crew', 'reveal-imp', 'discussion', 'voting', 'ejection', 'ejection-plain', 'eliminated', 'ghost', 'over-crew', 'over-imp'];

export default function Preview() {
  const [scene, setScene] = useState(SCENES.includes(location.hash.slice(1)) ? location.hash.slice(1) : null);
  const view = scene ? mock(scene) : null;
  const pick = (s) => { location.hash = s || ''; setScene(s); };
  return (
    <div className="screen grid" style={{ padding: 24 }}>
      <h1 className="type-page-title">Screen preview</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {SCENES.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => pick(s)}>{s}</button>)}
      </div>
      {scene && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          {scene === 'loading' && <Connecting code="ABCD" joined synced={false} mapReady={false} hostName="Aarav" onCancel={() => pick(null)} onSkip={() => pick(null)} />}
          {scene === 'loading-sync' && <Connecting code="ABCD" joined synced mapReady={false} hostName="Aarav" onCancel={() => pick(null)} onSkip={() => pick(null)} />}
          {scene === 'server' && <ServerSplash slow />}
          {scene.startsWith('reveal') && <RoleReveal view={view} />}
          {['discussion', 'voting'].includes(scene) && <Meeting view={view} />}
          {scene.startsWith('ejection') && <Ejection view={view} />}
          {scene === 'eliminated' && <Eliminated view={view} kill={{ killerHex: '#F76B15', killerHat: 'none', room: 'Lobby' }} onContinue={() => pick(null)} />}
          {scene === 'ghost' && (<div className="game" style={{ background: '#0A1022' }}><GhostBanner /><GhostPill /><GhostChat messages={view.ghostChat} /></div>)}
          {scene.startsWith('over') && <GameOver view={view} onLeave={() => pick(null)} />}
          <button type="button" className="chip-btn" style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 200 }} onClick={() => pick(null)}>✕ back</button>
        </div>
      )}
    </div>
  );
}
