// Alternating motor-on and pause durations, in milliseconds.
export const rhythms = {
  single: {label:'1 short pulse', timing:[140]},
  double: {label:'2 short pulses', timing:[160,220,160]},
  long:   {label:'1 long pulse', timing:[650]},
  triple: {label:'3 long pulses', timing:[420,220,420,220,420]},
  off:    {label:'Display only', timing:[]}
};

const defaults = {DOORBELL:'double', HORN:'single', ALARM:'triple'};
const key = 'aw04.sound-rhythms.v1';

export function loadAssignments(film) {
  const result = {...defaults};
  if (!film) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      for (const sound of Object.keys(result)) {
        const rhythm = saved?.[sound] ?? (sound === 'HORN' ? saved?.BIRDSONG : undefined);
        if (Object.hasOwn(rhythms, rhythm)) result[sound] = rhythm;
      }
    } catch { /* The simulator also works without storage. */ }
  }
  return result;
}

export function saveAssignments(settings) {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
    return true;
  } catch { return false; }
}

export function activePulse(timing, elapsedMs) {
  if (elapsedMs < 0) return -1;
  let end = 0;
  for (let i = 0; i < timing.length; i++) {
    end += timing[i];
    if (elapsedMs < end) return i % 2 === 0 ? i : -1;
  }
  return -1;
}

// Slow the carrier for the visual model while preserving every pulse and gap.
export function drivePhase(timing, pulse, elapsedMs) {
  if (pulse < 0) return 0;
  let withinPulse = elapsedMs;
  for (let i = 0; i < pulse; i++) withinPulse -= timing[i];
  const envelope = Math.min(1, withinPulse / 18, (timing[pulse] - withinPulse) / 18);
  return envelope * Math.sin(withinPulse * 2 * Math.PI * 9 / 1000);
}
