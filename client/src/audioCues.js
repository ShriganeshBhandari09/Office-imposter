import { useEffect, useRef } from 'react';
import { sfx, music, unlock } from './audio.js';

// Plays sounds when the game state changes. Runs once at the app root.
export function useAudioCues(view) {
  const prev = useRef({});
  useEffect(() => {
    const go = () => unlock();
    window.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, []);

  const phase = view?.phase;
  useEffect(() => { music(!!view?.me); return () => music(false); }, [!!view?.me]);

  useEffect(() => {
    const p = prev.current;
    const me = view?.me;
    const stage = view?.meeting?.stage;
    if (view) {
      if (view.roleReveal && !p.reveal) sfx('reveal');
      if (phase === 'meeting' && p.phase !== 'meeting') sfx(view.meeting.reason === 'body' ? 'report' : 'meeting');
      if (stage === 'voting' && p.stage === 'discussion') sfx('meeting');
      if (phase === 'ejection' && p.phase !== 'ejection') sfx('eject');
      if (view.sabotage && !p.sabotage) sfx('alarm');
      if (me?.killAnim && !p.kill) sfx('kill');
      if (phase === 'ended' && p.phase !== 'ended' && view.result) {
        const crewWin = view.result.winner === 'crew';
        sfx(crewWin === (me?.role !== 'impostor') ? 'win' : 'lose');
      }
      const done = (me?.tasks || []).filter((t) => t.done).length;
      if (p.done != null && done > p.done) sfx('task');
      if (p.voted === true && me && view.meeting?.myVote) sfx('vote');
      prev.current = { reveal: view.roleReveal, stage, phase, sabotage: !!view.sabotage, kill: !!me?.killAnim, done, voted: !view.meeting?.myVote };
    } else prev.current = {};
  });
}
