// Alternating motor-on and pause durations, in milliseconds.
export const rhythms = {
  single: {label:'一次短振', timing:[140]},
  double: {label:'两次短振', timing:[160,220,160]},
  long:   {label:'一次长振', timing:[650]},
  triple: {label:'三次长振', timing:[420,220,420,220,420]},
  off:    {label:'仅表盘提示', timing:[]}
};

const defaults = {DOORBELL:'double', BIRDSONG:'single', ALARM:'triple'};
const key = 'aw04.sound-rhythms.v1';

export function loadAssignments(film) {
  const result = {...defaults};
  if (!film) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      for (const sound of Object.keys(result)) {
        if (Object.hasOwn(rhythms, saved?.[sound])) result[sound] = saved[sound];
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
