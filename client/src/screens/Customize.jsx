import { useState } from 'react';
import Robot from '../Robot.jsx';
import { Button } from '../ui/kit.jsx';
import Icon from '../ui/icons.jsx';
import { COLORS, HATS } from '../shared/map.js';

// Colour + hat + name tag. `taken` is the set of colours other players in this lobby already use.
export default function Customize({ initial, taken = new Set(), canRename = true, onSave, onBack }) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [hat, setHat] = useState(initial.hat);
  const [err, setErr] = useState('');
  const colorName = COLORS.find((c) => c.id === color)?.name;
  const hatName = HATS.find((h) => h.id === hat)?.name;

  const save = async () => {
    if (!name.trim()) { setErr('Enter a name first.'); return; }
    const res = await onSave({ name: name.trim(), color, hat });
    if (res?.error) setErr(res.error);
  };

  return (
    <div className="screen grid customize">
      <div className="screen-bar">
        <Button size="sm" icon="back" onClick={onBack}>Back</Button>
        <div className="screen-title"><h1>Customize</h1></div>
        <Button variant="primary" size="md" onClick={save}>Save</Button>
      </div>

      <div className="cz-body">
        <section className="cz-preview ui-panel">
          <div className="cz-stage">
            <Robot color={color} hat={hat} size={190} className="cz-hero" />
            <div className="cz-ring" />
          </div>
          <label className="ui-label" htmlFor="cz-name">Name tag</label>
          <input id="cz-name" className="ui-input center" maxLength={14} value={name} disabled={!canRename}
            onChange={(e) => { setName(e.target.value); setErr(''); }} />
          <div className="ui-err">{err}</div>
          <div className="cz-states">
            {[['alive', 'Alive'], ['ghost', 'Ghost'], ['body', 'Body']].map(([state, label]) => (
              <figure key={state}><Robot color={color} hat={hat} state={state} size={state === 'body' ? 60 : 46} /><figcaption>{label}</figcaption></figure>
            ))}
          </div>
        </section>

        <section className="cz-options">
          <div className="cz-tabs">
            <button className="tab sel" type="button">Color &amp; hat</button>
            <button className="tab" type="button" disabled>Badge · soon</button>
          </div>

          <div className="ui-panel cz-block">
            <header><h2>Color</h2><span className="muted">{colorName} · locked colors are taken in this lobby</span></header>
            <div className="cz-colors">
              {COLORS.map((c) => {
                const locked = taken.has(c.id) && c.id !== initial.color;
                return (
                  <button key={c.id} type="button" disabled={locked} aria-label={c.name} aria-pressed={color === c.id}
                    className={`swatch ${color === c.id ? 'sel' : ''}`} style={{ '--c': c.hex }}
                    onClick={() => setColor(c.id)}>
                    {color === c.id && <Icon name="check" size={26} strokeWidth={3} />}
                    {locked && <Icon name="lock" size={22} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ui-panel cz-block">
            <header><h2>Hat</h2><span className="muted upper">{hatName}</span></header>
            <div className="cz-hats">
              {HATS.map((h) => (
                <button key={h.id} type="button" aria-pressed={hat === h.id} className={`hat-card ${hat === h.id ? 'sel' : ''}`} onClick={() => setHat(h.id)}>
                  <Robot color={color} hat={h.id} size={50} /><span>{h.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
