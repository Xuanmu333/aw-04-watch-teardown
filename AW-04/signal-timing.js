import {sounds} from './acoustics.js';

// The instrument shows measured times in µs. Playback magnifies inter-mic gaps
// separately from the trip to the watch so both are visible at room distances.
export const AI_START = 2.5;
export const OUTPUT_START = 6.5;
export const CYCLE_DURATION = 8.3;

const fitStart = AI_START + (OUTPUT_START - AI_START) * .26;
const locateStart = AI_START + (OUTPUT_START - AI_START) * .68;

// Reveal the measured bands, class fits and two delay pairs in processing order.
export function computeStep(elapsed) {
  const through=(start,end,count)=>1+Math.floor(count*(elapsed-start)/(end-start));
  if (elapsed < AI_START) return {phase:'capture',count:0};
  if (elapsed < fitStart) return {phase:'filter',count:through(AI_START,fitStart,8)};
  if (elapsed < locateStart) return {phase:'fit',count:through(fitStart,locateStart,sounds.length)};
  if (elapsed < OUTPUT_START) return {phase:'locate',count:through(locateStart,OUTPUT_START,2)};
  return {phase:'output',count:0};
}

const secondsPerDelayUs = 0.011;
const firstArrivalTime = firstUs => 0.55 + firstUs * 0.00002;

export function receiveTime(arrivalsUs, index) {
  const firstUs = Math.min(...arrivalsUs);
  return firstArrivalTime(firstUs) + Math.round(arrivalsUs[index] - firstUs) * secondsPerDelayUs;
}

// One physical clock for the room and the enlarged watch. Slow down while
// the front crosses the microphone array, then let it travel on past the watch.
export function waveTimeUs(elapsed, arrivalsUs) {
  const firstUs = Math.min(...arrivalsUs);
  const firstAt = firstArrivalTime(firstUs);
  if (elapsed <= firstAt) return firstUs * Math.max(0, elapsed) / firstAt;
  const spanUs = Math.round(Math.max(...arrivalsUs) - firstUs);
  const lastAt = firstAt + spanUs * secondsPerDelayUs;
  if (elapsed <= lastAt) return firstUs + (elapsed - firstAt) / secondsPerDelayUs;
  return firstUs + spanUs + (elapsed - lastAt) * 22000;
}
