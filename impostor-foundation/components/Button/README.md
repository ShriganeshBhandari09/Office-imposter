# Button
Pressable arcade button: solid fill, uppercase Russo One label, solid offset shadow.

- **Primary** `yellow-500` / `ink-on-yellow` / `press-yellow`. One per screen.
- **Join** `cyan-500` / `cyan-ink` / `press-cyan`.
- **Danger** `red-500` / white / `press-red`: Report, Kill, Leave confirmations.
- **Secondary** `surface-400`, 2px `line-200` border, `ink`, `press-neutral`, label in Chakra Petch 700 with 0.08em tracking.
- Height 64px (menus) or 52–56px (bars); radius `radius-md`. On press, move it down 4px and shrink the shadow to 2px. Disabled: `surface-200`, `ink-faint` text, no shadow.
- Use a real `<button>` or `<a href>`; minimum target 44px.
