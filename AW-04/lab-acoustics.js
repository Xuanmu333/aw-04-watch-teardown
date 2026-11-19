import { microphones, radius, sounds } from './acoustics.js';

// The sound field extends four metres from the watch to each edge of the pad.
const fieldRadius = 4;
const speedOfSound = 343;
const referenceDb = 65;
const oneMetreDb = [67, 69, 68];
const power = db => 10 ** ((db - referenceDb) / 10);
const decibels = energy => referenceDb + 10 * Math.log10(Math.max(energy, 1e-12));
const sum = values => values.reduce((total, value) => total + value, 0);
const dot = (a, b) => a.reduce((total, value, i) => total + value * b[i], 0);
const unitPower = values => { const total = sum(values); return values.map(value => value / total); };
const templates = sounds.map(sound => unitPower(sound.bins));
const floor = unitPower([3, 2.5, 2.1, 1.8, 1.6, 1.3, 1.2, 1]).map(weight => weight * power(49));
const gram = templates.map(a => templates.map(b => dot(a, b)));

// Fit non-negative template powers to the measured eight bands. The same fit on
// arrival-time moments recovers the four delays for the dominant spectral stream.
function fitBands(bands) {
  const measured = templates.map(template => dot(template, bands));
  const weights = templates.map(() => 0);
  for (let pass = 0; pass < 40; pass++) {
    for (let k = 0; k < weights.length; k++) {
      weights[k] = Math.max(0, weights[k] + (measured[k] - dot(gram[k], weights)) / gram[k][k]);
    }
  }
  return weights;
}

function emit(source) {
  const { x, y, type } = source;
  const east = x * fieldRadius, north = y * fieldRadius;
  const range = Math.hypot(east, north);
  const levelDb = oneMetreDb[type] - 20 * Math.log10(Math.max(0.35, range));
  const arrivals = microphones.map(([mx, my]) => Math.hypot(east - mx / 1000, north - my / 1000) / speedOfSound * 1e6);
  const first = Math.min(...arrivals);
  const delays = arrivals.map(time => time - first);
  const shape = unitPower(templates[type].map((value, i) => value * Math.exp(-0.0009 * range * i)));
  const bands = shape.map(value => value * power(levelDb));
  return { source, range, levelDb, delays, bands };
}

export function analyzeScene(sources) {
  const signals = sources.map(emit);
  const mixture = floor.map((noise, b) => noise + sum(signals.map(signal => signal.bands[b])));
  const weights = fitBands(mixture.map((value, b) => value - floor[b]));
  const winner = weights.indexOf(Math.max(...weights));
  const dominant = templates[winner].map(value => value * weights[winner]);
  const background = mixture.map((value, b) => Math.max(floor[b], value - dominant[b]));
  // The Wiener amplitude gain is squared when applying it to measured powers.
  const gain = dominant.map((value, b) => (value / (value + background[b])) ** 2);
  const output = mixture.map((value, b) => value * gain[b]);
  const backgroundOut = dot(background, gain);
  const noiseReductionDb = backgroundOut > 0 ? 10 * Math.log10(sum(background) / backgroundOut) : 0;
  const streamPower = weights[winner];
  const arrivals = microphones.map((_, mic) => {
    if (!streamPower) return 0;
    const moments = floor.map((_, b) => sum(signals.map(signal => signal.bands[b] * signal.delays[mic])));
    return fitBands(moments)[winner] / streamPower;
  });
  const first = Math.min(...arrivals);
  const maxDelay = 2 * radius * 1000 / speedOfSound;
  const delays = arrivals.map(time => Math.min(maxDelay, time - first));
  const east = delays[3] - delays[1], north = delays[2] - delays[0];
  // Delays below the simulated one-microsecond resolution cannot yield a bearing.
  const hasBearing = Math.hypot(east, north) >= 1;
  const angle = hasBearing ? (Math.atan2(east, north) + 2 * Math.PI) % (2 * Math.PI) : 0;
  const degree = angle * 180 / Math.PI;
  const detected = signals.length ? sounds[winner] : { name: 'Listening', en: 'LISTENING' };
  // Match the recovered stream to its simulated emitter for the field highlight.
  const candidates = signals.filter(signal => signal.source.type === winner);
  const primary = candidates.reduce((best, signal) => !best || signal.levelDb > best.levelDb ? signal : best, null);
  const peak = Math.max(...mixture);
  const inputSpectrum = mixture.map(value => value / peak);
  const cleanSpectrum = output.map(value => value / peak);
  const confidence = streamPower ? dot(dominant, gain) / sum(output) : 0;
  const telemetry = signals.map(({ source, range, levelDb, bands }) => ({
    id: source.id, range, levelDb, cleanDb: decibels(dot(bands, gain))
  }));
  return {
    sources: telemetry, primaryId: primary?.source.id ?? null, detected, degree, hasBearing,
    delays, confidence: Math.min(1, confidence), inputSpectrum, cleanSpectrum, noiseReductionDb,
    dialState: { angle: degree, degree: hasBearing ? String(Math.round(degree) % 360).padStart(3, '0') : '—', hasBearing, detected }
  };
}
