# Impostor.exe foundation

Everything you need to make your React game match the designs.

## What's inside

| Folder | File | Use it for |
| --- | --- | --- |
| `tokens/` | `tokens.css` | Import once at the app root. Gives you CSS variables (`var(--yellow-500)`, `var(--radius-md)`, `var(--press-yellow)`) and type classes (`.type-button`, `.type-label`, `.type-readout`). |
| `tokens/` | `theme.js` | The same values as a JS object, for inline styles or a theme provider. |
| `tokens/` | `tokens.json` | Source of truth, with a usage note on every token. |
| | `DESIGN-GUIDE.md` | The rules: two styles (arcade vs device), what each colour means, type, writing, icons, avatar, map. |
| `components/` | `*/README.md` | Exact specs for Button, HUD action, Panel, Chip, Vote card, Alert banner, Task popup, Settings controls, Map markers, Avatar. |
| `map/` | `office-map.json` | Rooms, walls (door gaps cut out), doors, obstacles, 22 tasks, 8 vents, 4 sabotages, emergency button, spawns. 820 x 690 map px. |
| `map/` | `office-map-clean@2x.png`, `office-map-clean-1000w.png` | Map art with no markers, so you draw tasks, vents and sabotages yourself. |
| `map/` | `office-map-labels@2x.png` | Same art with room names baked in. |

## Setup

1. Add the fonts to `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Russo+One&display=swap" rel="stylesheet">
```

2. Import the tokens once, for example in `main.jsx`:

```js
import "./foundation/tokens/tokens.css";
```

3. Use them:

```jsx
<button className="type-button-xl" style={{
  height: 64, padding: "0 32px", border: "none",
  borderRadius: "var(--radius-md)",
  background: "var(--yellow-500)", color: "var(--ink-on-yellow)",
  boxShadow: "var(--press-yellow)"
}}>HOST GAME</button>
```

## Map in your world

Scale every number in `office-map.json` by `worldWidth / 820` (the same factor for x and y). For a 1000px-wide world the map is 1000 x 841. Build collision from `walls` and `obstacles`, and draw tasks, vents and sabotages at their listed positions. Each task with a `wall` value (n, s, e, w) is mounted on that side.

Fonts: Russo One, Chakra Petch and JetBrains Mono (SIL Open Font License, via Google Fonts).
