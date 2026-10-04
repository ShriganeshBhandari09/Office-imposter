import { useState } from 'react';
import Icon from './ui/icons.jsx';
import { Button, Modal, Slider } from './ui/kit.jsx';
import { ControlsGrid } from './screens/Home.jsx';
import { savedSound, saveSound } from './net.js';
import { setVolumes } from './audio.js';
import { ROOMS, SABOTAGE_FIX, roomAt } from './shared/map.js';

const WALL_LABEL = { n: 'top wall', s: 'bottom wall', e: 'right wall', w: 'left wall' };
const TYPE_LABEL = {
  hold: 'hold', mop: 'drag', shred: 'clicks', breakers: 'switches', restock: 'clicks', order: 'sequence', swipe: 'swipe',
  align: 'align', keypad: 'keypad', type: 'type', upload: 'upload', reams: 'clicks', wires: 'wires', signal: 'slider', holdSync: 'hold',
};
export const typeLabel = (t) => TYPE_LABEL[t] || t;
export const spotWhere = (spot) => `${roomAt(spot.x, spot.y)}${spot.wall ? ` · ${WALL_LABEL[spot.wall]}` : ''}`;

// Top-left: team progress and your own task list.
export function TaskPanels({ view, taskDef, fakeDone }) {
  const me = view.me;
  const isImp = me.role === 'impostor';
  const tone = !me.alive ? 'ghost' : isImp ? 'impostor' : 'crew';
  const mates = view.roster.filter((r) => r.role === 'impostor' && r.id !== me.id);
  const pct = view.taskProgress == null ? null : Math.round(view.taskProgress * 100);
  const title = !me.alive ? 'Ghost tasks' : isImp ? 'Fake tasks' : 'Your tasks';
  return (
    <div className="hud-left">
      <section className="ui-panel hud-team">
        <header><span className="type-label">Team tasks</span><b className="pct">{pct == null ? '--' : `${pct}%`}</b></header>
        <div className="hud-bar"><div style={{ width: `${pct ?? 0}%` }} /></div>
        {pct == null && <small className="muted">Task bar hidden by the host</small>}
      </section>
      <section className="ui-panel hud-tasks">
        <h3 className={`ui-panel-title ${tone}`}>{title}</h3>
        {isImp && <p className="imp-line">Fake tasks give you cover.{mates.length > 0 && <> Partner: <b>{mates.map((m) => m.name).join(', ')}</b></>}</p>}
        <ul>
          {me.tasks.map((tk) => {
            const d = taskDef(tk.id);
            const done = tk.done || fakeDone.has(tk.id);
            return (
              <li key={tk.id} className={done ? 'done' : ''}>
                <i />
                <div><b>{d.name}</b><small>{d.room} · {typeLabel(d.type)}</small></div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// Bottom-right action dock. Order from the left: Vent, Sabotage, Report, then the main action.
export function ActionDock({ view, act, tap, onUse, onKill, onReport, onVent, onVentMove, onSabotage }) {
  const me = view.me;
  const isImp = me.role === 'impostor';
  const alive = me.alive;
  const sabBusy = me.sabCdLeft > 0 || !!view.sabotage;
  return (
    <div className="hud-dock">
      {isImp && alive && act.vent === 'in' && (
        <button className="hud-act small" type="button" {...tap(onVentMove)}><Icon name="vent" size={34} /><span>Next vent</span></button>
      )}
      {isImp && (
        <>
          {alive && <button className="hud-act small" type="button" disabled={!act.vent} {...tap(onVent)}><Icon name="vent" size={34} /><span>{act.vent === 'in' ? 'Exit' : 'Vent'}</span></button>}
          <button className="hud-act small sab" type="button" disabled={view.phase !== 'playing' || sabBusy} {...tap(onSabotage)}>
            <Icon name="sabotage" size={34} /><span>Sabotage</span>
            {me.sabCdLeft > 0 && <em>{me.sabCdLeft}</em>}
          </button>
        </>
      )}
      {alive && (
        <button className={`hud-act small report ${act.body ? 'live' : ''}`} type="button" disabled={!act.body} {...tap(onReport)}>
          <Icon name="report" size={36} /><span>Report</span><small>{act.body ? 'Body nearby' : ''}</small>
        </button>
      )}
      {isImp && alive ? (
        <button className={`hud-act main kill ${act.kill && !act.killCd ? 'live' : ''}`} type="button" disabled={!act.kill || act.killCd > 0} {...tap(onKill)}>
          <Icon name="kill" size={44} /><span>Kill</span>
          {act.killCd > 0 && <em>{act.killCd}</em>}
        </button>
      ) : null}
      <button className={`hud-act main use ${!alive ? 'ghost' : ''} ${act.use ? 'live' : ''}`} type="button" disabled={!act.use} {...tap(onUse)}>
        <Icon name="use" size={isImp && alive ? 38 : 44} /><span>Use</span><small>{act.use?.label || ''}</small>
      </button>
    </div>
  );
}

// Sabotage and lights-out alerts. The full banner is for timed (critical) sabotages.
export function AlertOverlay({ view, onOpenFix }) {
  const sab = view.sabotage;
  if (!sab || !view.me.alive) return null;
  const fix = SABOTAGE_FIX[sab.type]?.[0];
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (sab.type === 'lights') {
    return (
      <div className="alert-banner small">
        <span className="kicker">Sabotage</span><h2>Lights out</h2>
        <p>Fix the breakers at the {spotWhere(fix)}.</p>
      </div>
    );
  }
  const wifi = sab.type === 'wifi';
  return (
    <>
      <div className="hazard top" /><div className="hazard bottom" /><div className="alert-tint" />
      <div className="alert-banner">
        <div>
          <span className="kicker">Sabotage</span>
          <h2>{wifi ? 'Wi-Fi down' : 'Network down'}</h2>
          <p>{wifi
            ? `Two players must hold the resets in Sec and Call 3 at the same time. ${sab.holds.length}/2 held.`
            : 'Fix the switch in the Lobby before time runs out or the impostors win.'}</p>
        </div>
        <div className="timer"><span className="kicker">Time left</span><b>{mmss(sab.secondsLeft ?? 0)}</b></div>
      </div>
      <section className="emergency-task">
        <h3>Emergency task</h3>
        <b>{wifi ? 'Reset Wi-Fi' : fix.name}</b>
        <small>{wifi ? 'Sec wall · Call 3 wall' : spotWhere(fix)}</small>
      </section>
      <button type="button" className="open-fix ui-btn danger xl" onClick={onOpenFix}>Open fix task</button>
    </>
  );
}

// The impostor's sabotage picker: three sabotages and a door lock per room.
export function SabotagePicker({ me, onPick, onClose }) {
  return (
    <Modal onClose={onClose} className="sab-modal">
      <h2>Sabotage</h2>
      <div className="sab-types">
        <Button variant="secondary" size="md" onClick={() => onPick('lights')}><Icon name="sabotage" size={20} /> Lights</Button>
        <Button variant="secondary" size="md" onClick={() => onPick('comms')}><Icon name="sabotage" size={20} /> Network</Button>
        <Button variant="danger" size="md" onClick={() => onPick('wifi')}><Icon name="sabotage" size={20} /> Wi-Fi</Button>
      </div>
      <p className="ui-label sab-doors-label">Lock doors (10s)</p>
      <div className="sab-doors">
        {ROOMS.filter((r) => r.lockable).map((r) => {
          const cd = me.doorCd?.[r.id] || 0;
          return <button key={r.id} type="button" className="chip-btn" disabled={cd > 0} onClick={() => onPick('doors', r.id)}>{r.name}{cd > 0 ? ` ${cd}s` : ''}</button>;
        })}
      </div>
    </Modal>
  );
}

// Esc / the settings button: sound, controls, rules and leaving.
export function PauseMenu({ onResume, onRules, onLeave }) {
  const [s, setS] = useState(savedSound());
  const set = (k, v) => setS((o) => { const n = { ...o, [k]: v }; saveSound(n); setVolumes(n); return n; });
  return (
    <Modal onClose={onResume} className="pause">
      <header className="pause-head"><h2>Paused</h2><small>The match keeps running for others</small></header>
      <Button variant="primary" size="xl" onClick={onResume}>Resume</Button>
      <section className="pause-box">
        <h3 className="type-label">Sound</h3>
        {[['master', 'Master'], ['music', 'Music'], ['effects', 'Effects']].map(([k, label]) => (
          <div className="sound-row" key={k}><span>{label}</span><Slider value={s[k]} label={label} onChange={(v) => set(k, v)} /><b>{s[k]}</b></div>
        ))}
      </section>
      <section className="pause-box"><h3 className="type-label">Controls</h3><ControlsGrid /></section>
      <div className="pause-actions">
        <Button size="md" onClick={onRules}>Game rules</Button>
        <Button variant="ghost-red" size="md" onClick={onLeave}>Leave game</Button>
      </div>
    </Modal>
  );
}

export function RulesDialog({ settings, onClose }) {
  const rows = [
    ['Impostors', settings.impostors], ['Kill cooldown', `${settings.killCooldown}s`], ['Kill distance', settings.killDistance],
    ['Player speed', `${settings.playerSpeed}x`], ['Crew vision', `${settings.crewVision}x`], ['Impostor vision', `${settings.impostorVision}x`],
    ['Discussion', `${settings.discussionSeconds}s`], ['Voting', `${settings.votingSeconds}s`], ['Tasks per player', settings.tasksPerPlayer],
    ['Anonymous votes', settings.anonymousVotes ? 'On' : 'Off'], ['Confirm ejects', settings.confirmEjects ? 'On' : 'Off'],
    ['Network timer', `${settings.networkSeconds}s`], ['Wi-Fi timer', `${settings.wifiSeconds}s`],
  ];
  return (
    <Modal onClose={onClose}>
      <h2>Game rules</h2>
      <dl className="rules-list">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <Button variant="primary" size="md" onClick={onClose}>Close</Button>
    </Modal>
  );
}
