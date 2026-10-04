# HUD action
Big square action buttons in the bottom-right corner of the gameplay screen.

- 112px, or 132px for the main action (Use for crew, Kill for impostor); radius `radius-xl`; 3px border in `ink-on-yellow`.
- Active: role fill + `press-*` + glow. Use is `yellow-500`, Kill and Report are `red-500`, Sabotage is `orange-500` with `press` `#9A4A00`.
- Disabled: `surface-200` at 92%, `line-100` border, label `#56618A`, no glow.
- Cooldown: a `bg-void` 60% veil with the seconds in 44px Russo One.
- Order from left: Vent, Sabotage, Report, then the main action at far right, 14px apart, 24px from the screen edges.
