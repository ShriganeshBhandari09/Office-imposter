// Small building blocks from impostor-foundation/components. Styles live in ui.css.
import Icon from './icons.jsx';

// Pressable arcade button. variant: primary (yellow) | join (cyan) | start (green) | danger (red) | secondary.
export function Button({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }) {
  return (
    <button className={`ui-btn ${variant} ${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'xl' ? 26 : 20} />}
      {children}
    </button>
  );
}

// Uppercase status tag: HOST, READY, AFK, IMPOSTOR, CREW, I VOTED...
export function Chip({ kind = 'crew', children }) {
  return <span className={`ui-chip ${kind}`}>{children}</span>;
}

export function Panel({ title, tone = 'crew', right, className = '', children }) {
  return (
    <section className={`ui-panel ${className}`}>
      {(title || right) && (
        <header className="ui-panel-head">
          <h3 className={`ui-panel-title ${tone}`}>{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

// A settings row: label + hint on the left, the control on the right.
export function Row({ label, hint, children }) {
  return (
    <div className="ui-row">
      <div className="ui-row-text"><b>{label}</b>{hint && <small>{hint}</small>}</div>
      <div className="ui-row-control">{children}</div>
    </div>
  );
}

// − value + control. `format` renders the value ("25s", "1.25x").
export function Stepper({ value, min, max, step = 1, format = (v) => v, disabled, onChange, label }) {
  const round = (v) => Math.round(v * 100) / 100;
  return (
    <div className="ui-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label || ''}`} disabled={disabled || value <= min} onClick={() => onChange(round(Math.max(min, value - step)))}>
        <Icon name="minus" size={18} strokeWidth={2.5} />
      </button>
      <output>{format(value)}</output>
      <button type="button" aria-label={`More ${label || ''}`} disabled={disabled || value >= max} onClick={() => onChange(round(Math.min(max, value + step)))}>
        <Icon name="plus" size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function Toggle({ value, disabled, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!value} aria-label={label} disabled={disabled}
      className={`ui-toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}><i /></button>
  );
}

// options: [{ value, label }]
export function Segmented({ value, options, disabled, onChange, label }) {
  return (
    <div className="ui-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled}
          className={value === o.value ? 'sel' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Slider({ value, min = 0, max = 100, onChange, label }) {
  return <input className="ui-slider" type="range" min={min} max={max} value={value} aria-label={label}
    style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }} onChange={(e) => onChange(+e.target.value)} />;
}

// Full-screen backdrop for a dialog; clicking outside closes it.
export function Modal({ onClose, children, className = '' }) {
  return (
    <div className="ui-modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`ui-modal ${className}`} role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}
