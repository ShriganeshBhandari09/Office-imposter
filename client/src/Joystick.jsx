import { useEffect, useRef, useState } from 'react';

// Floating joystick: touch anywhere in the left half of the screen and drag.
// Writes a vector (length 0..1) into vecRef, read by the movement loop.
const JOY_R = 56;
export default function Joystick({ vecRef }) {
  const [stick, setStick] = useState(null);
  const pid = useRef(null);
  const base = useRef(null);
  // Stop walking if the joystick disappears mid-drag (e.g. a task opens).
  useEffect(() => () => { vecRef.current = { x: 0, y: 0 }; }, []);
  const end = (e) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    vecRef.current = { x: 0, y: 0 };
    setStick(null);
  };
  return (
    <div
      className="joy-zone"
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        base.current = { x: e.clientX, y: e.clientY };
        setStick({ bx: e.clientX, by: e.clientY, kx: 0, ky: 0 });
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pid.current) return;
        let dx = e.clientX - base.current.x, dy = e.clientY - base.current.y;
        const len = Math.hypot(dx, dy);
        if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
        vecRef.current = len < JOY_R * 0.18 ? { x: 0, y: 0 } : { x: dx / JOY_R, y: dy / JOY_R };
        setStick({ bx: base.current.x, by: base.current.y, kx: dx, ky: dy });
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {stick ? (
        <div className="joy-base" style={{ left: stick.bx, top: stick.by }}>
          <div className="joy-knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
        </div>
      ) : <div className="joy-hint">Drag here to move</div>}
    </div>
  );
}
