import { useState } from 'react';
import { socket } from '../net.js';
import { Button, Row, Stepper, Toggle, Segmented } from '../ui/kit.jsx';
import { SETTING_SPECS, SETTING_PRESETS, TASKS, recommendedImpostors, maxImpostors } from '../shared/map.js';

const secs = (v) => `${v}s`;
const mult = (v) => `${v}x`;

// The host's rules screen. Edits are a draft until Save; everyone else sees the current rules read-only.
export default function GameSettings({ view, onBack }) {
  const isHost = view.hostId === view.me.id;
  const [draft, setDraft] = useState(view.settings);
  const live = isHost ? draft : view.settings;
  const n = view.roster.length;
  const dirty = isHost && JSON.stringify(draft) !== JSON.stringify(view.settings);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const maxImp = Math.max(1, Math.min(3, maxImpostors(Math.max(n, 3))));
  const presetOf = () => Object.entries(SETTING_PRESETS).find(([, p]) =>
    Object.entries(p).every(([k, v]) => live[k] === v))?.[0];

  const num = (key, label, hint, format = (v) => v, extra = {}) => {
    const spec = SETTING_SPECS[key];
    return (
      <Row key={key} label={label} hint={hint}>
        <Stepper label={label} value={live[key]} min={extra.min ?? spec.min} max={extra.max ?? spec.max} step={spec.step}
          format={format} disabled={!isHost} onChange={(v) => set(key, v)} />
      </Row>
    );
  };
  const flag = (key, label, hint) => (
    <Row key={key} label={label} hint={hint}><Toggle label={label} value={live[key]} disabled={!isHost} onChange={(v) => set(key, v)} /></Row>
  );
  const seg = (key, label, hint, options) => (
    <Row key={key} label={label} hint={hint}><Segmented label={label} value={live[key]} options={options} disabled={!isHost} onChange={(v) => set(key, v)} /></Row>
  );
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const save = () => { socket.emit('settings', draft); onBack(); };
  const reset = () => setDraft({ ...view.settings, ...SETTING_PRESETS.standard });

  return (
    <div className="screen grid settings">
      <div className="screen-bar">
        <Button size="sm" icon="back" onClick={onBack}>Lobby</Button>
        <div className="screen-title"><h1>Game settings</h1><p>{isHost ? 'Only the host can change these' : 'Only the host can change these. You are viewing them.'}</p></div>
        {isHost ? (
          <div className="bar-actions"><Button size="sm" onClick={reset}>Reset</Button><Button variant="primary" size="md" onClick={save} disabled={!dirty}>Save</Button></div>
        ) : <span />}
      </div>

      <div className="settings-body">
        <div className="preset-row">
          <span className="type-label">Preset</span>
          {Object.keys(SETTING_PRESETS).map((id) => (
            <button key={id} type="button" disabled={!isHost} className={`pill ${presetOf() === id ? 'sel' : ''}`}
              onClick={() => setDraft((d) => ({ ...d, ...SETTING_PRESETS[id] }))}>{cap(id)}</button>
          ))}
          <span className="rec">Recommended for {n} players: <b>{recommendedImpostors(n)} impostor{recommendedImpostors(n) === 1 ? '' : 's'}</b></span>
        </div>

        <div className="settings-grid">
          <section className="ui-panel set-card">
            <h2><i className="dot red" />Match</h2>
            {num('impostors', 'Impostors', `Max ${maxImp} with ${Math.max(n, 3)} players`, undefined, { max: 3 })}
            {num('killCooldown', 'Kill cooldown', 'Seconds between kills', secs)}
            {seg('killDistance', 'Kill distance', 'How close to strike', SETTING_SPECS.killDistance.options.map((o) => ({ value: o, label: cap(o) })))}
            {num('playerSpeed', 'Player speed', 'Walking speed', mult)}
            {num('crewVision', 'Crew vision', 'Light radius', mult)}
            {num('impostorVision', 'Impostor vision', 'Light radius', mult)}
          </section>
          <section className="ui-panel set-card">
            <h2><i className="dot yellow" />Meetings</h2>
            {num('emergencyPerPlayer', 'Emergency meetings', 'Per player')}
            {num('emergencyCooldown', 'Emergency cooldown', 'After game start', secs)}
            {num('discussionSeconds', 'Discussion time', 'Before voting opens', secs)}
            {num('votingSeconds', 'Voting time', 'Time to cast a vote', secs)}
            {flag('anonymousVotes', 'Anonymous votes', 'Hide who voted for whom')}
            {flag('confirmEjects', 'Confirm ejects', 'Reveal role on eject')}
          </section>
          <section className="ui-panel set-card">
            <h2><i className="dot green" />Tasks</h2>
            {num('tasksPerPlayer', 'Tasks per player', `Picked from ${TASKS.length} office tasks`)}
            {flag('visualTasks', 'Visual tasks', 'Others can see some tasks done')}
            {seg('taskBarUpdates', 'Task bar updates', 'When the team bar fills', SETTING_SPECS.taskBarUpdates.options.map((o) => ({ value: o, label: cap(o) })))}
          </section>
          <section className="ui-panel set-card">
            <h2><i className="dot orange" />Sabotage</h2>
            {num('sabotageCooldown', 'Sabotage cooldown', 'Between impostor sabotages', secs)}
            {num('networkSeconds', 'Network outage timer', 'Fix in Lobby before it ends', secs)}
            {num('wifiSeconds', 'Wi-Fi reset timer', '2 players hold: Sec + Call 3', secs)}
          </section>
        </div>
      </div>
    </div>
  );
}
