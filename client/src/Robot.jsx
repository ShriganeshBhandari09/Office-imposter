import { robotURL, colorHex } from './robot.js';

// A robot as an <img>. Give it a colour id (or hex), a hat and a state; size is the width in px (height is 1.25x).
export default function Robot({ color, hex, hat = 'none', state = 'alive', eyes, facing = 1, size = 48, className = '', style }) {
  const h = hex || colorHex(color);
  const dead = state === 'body';
  return (
    <img className={`robot ${className}`} alt="" draggable={false}
      src={robotURL({ hex: h, hat, state, eyes, facing })}
      style={{ width: size, height: dead ? size * (84 / 116) : size * 1.28, ...style }} />
  );
}
