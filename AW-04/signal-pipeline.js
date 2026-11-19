import {sounds} from './acoustics.js';
import {AI_START, OUTPUT_START, receiveTime} from './signal-timing.js';
import './signal-pipeline.css';

const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const stageText = {emit:'Emitting', receive:'Receiving', filter:'Filtering noise', fit:'Fitting sound classes', locate:'Solving bearing', output:'Result ready'};
const fitStart = AI_START + (OUTPUT_START - AI_START) * .26;
const locateStart = AI_START + (OUTPUT_START - AI_START) * .68;

export function createSignalPipeline(host) {
  host.classList.add('sl-pipeline');
  host.innerHTML = `
    <div class="sl-path-head">
      <h3>Signal path</h3><span class="sl-path-status"></span>
      <span class="sl-path-scale">Timing slowed</span>
      <button type="button" data-replay-signal><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.1A5.5 5.5 0 1 1 2.8 11M2.5 2.8v3.5H6"/></svg>Replay signal</button>
    </div>
    <ol class="sl-path-steps" aria-label="Simulated signal path">
      <li data-step="emit">
        <h4>Selected source</h4>
        <strong class="sl-path-name" data-pipeline-source></strong>
        <span class="sl-path-note" data-pipeline-role></span>
        <span class="sl-path-range"></span>
        <span class="sl-path-travel">First mic <b data-first-mic></b></span>
      </li>
      <li data-step="receive">
        <h4>Mic arrivals</h4><span class="sl-path-note">From first arrival</span>
        <div class="sl-path-arrivals"></div>
      </li>
      <li data-step="classify">
        <h4>AI chip</h4><span class="sl-path-note" data-fit-label>Recovered energy</span>
        <div class="sl-path-fits">${sounds.map((sound,i) => `
          <div class="sl-fit-row" data-sound-type="${i}"><span>${sound.name}</span><i><b></b></i><output></output></div>`).join('')}
        </div>
        <div class="sl-path-lags"><div><span>W − E</span><b data-fit-ew></b></div><div><span>S − N</span><b data-fit-ns></b></div></div>
        <div class="sl-path-noise">Noise cut <b data-pipeline-noise></b></div>
      </li>
      <li data-step="output">
        <h4>Watch result</h4><span class="sl-path-note">Primary sound</span>
        <strong class="sl-path-name" data-pipeline-result></strong>
        <div class="sl-path-bearing"><i aria-hidden="true">↑</i><span data-pipeline-bearing></span></div>
      </li>
    </ol>`;

  const find = selector => host.querySelector(selector);
  const steps = Array.from(host.querySelectorAll('[data-step]'));
  const fits = Array.from(host.querySelectorAll('.sl-fit-row'));
  const status = find('.sl-path-status');
  const fitLabel = find('[data-fit-label]');
  const arrivals = find('.sl-path-arrivals');
  const stageNoise = find('[data-pipeline-noise]');
  const stageResult = find('[data-pipeline-result]');
  const stageBearing = find('[data-pipeline-bearing]');
  const arrow = find('.sl-path-bearing i');
  let groups = [], percentages = [], resultName = '', noise = '', bearing = '', degree = 0, energyLabel = '';
  let previousPhase = '', previousCount = -1;

  function update(model, selectedId) {
    const selected = model.sources.find(source => source.id === selectedId);
    find('[data-pipeline-source]').textContent = sounds[selected.type].name;
    find('[data-pipeline-role]').textContent = selected.id === model.primaryId ? 'Primary input' : 'Background input';
    find('.sl-path-range').textContent = selected.range.toFixed(1) + ' m away';

    const first = Math.min(...selected.arrivalsUs);
    find('[data-first-mic]').textContent = (first / 1000).toFixed(2) + ' ms';
    energyLabel = model.sources.length > 1 ? 'Energy share · ' + model.sources.length + ' inputs' : 'Recovered energy';
    const byDelay = new Map();
    selected.arrivalsUs.forEach((time, index) => {
      const delay = Math.round(time - first);
      if (!byDelay.has(delay)) byDelay.set(delay, []);
      byDelay.get(delay).push(index);
    });
    groups = Array.from(byDelay).sort(([a], [b]) => a - b).map(([delay, mics]) => {
      const row = document.createElement('div');
      row.className = 'sl-arrival-group';
      row.innerHTML = '<span class="sl-arrival-mics">' + mics.map(i =>
        '<span data-mic="' + i + '">M0' + (i+1) + '</span>').join('') +
        '</span><span class="sl-arrival-delay">' + (delay ? '+' : '') + delay + ' µs</span>';
      const description = mics.map(i => 'M0' + (i+1)).join(' and ') + (mics.length > 1 ? ' arrive together' : ' arrives') + ' at ' + delay + ' microseconds from the first arrival';
      row.title = description;
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', description);
      return {row, at:receiveTime(selected.arrivalsUs, mics[0]), mics:Array.from(row.querySelectorAll('[data-mic]'))};
    });
    arrivals.replaceChildren(...groups.map(group => group.row));
    percentages = model.classShares.map(value => Math.round(value * 100));
    fits.forEach((fit, i) => {
      fit.style.setProperty('--energy', (model.classShares[i] * 100) + '%');
      fit.classList.toggle('sl-fit-winner', sounds[i].name === model.detected.name);
    });
    noise = model.noiseReductionDb.toFixed(1) + ' dB';
    resultName = model.detected.name;
    degree = model.degree;
    bearing = model.hasBearing ? compass[Math.round(degree / 45) % 8] + ' · ' +
      String(Math.round(degree) % 360).padStart(3, '0') + '°' : '—';
    const signedDelay = delay => (Math.round(delay) > 0 ? '+' : '') + Math.round(delay) + ' µs';
    find('[data-fit-ew]').textContent = signedDelay(model.delays[3] - model.delays[1]);
    find('[data-fit-ns]').textContent = signedDelay(model.delays[2] - model.delays[0]);
    previousPhase = '';
    previousCount = -1;
  }

  function render(elapsedSeconds, reducedMotion) {
    const elapsed = reducedMotion ? Infinity : elapsedSeconds;
    const count = groups.reduce((total, group) => total + (elapsed >= group.at ? group.mics.length : 0), 0);
    const stage = elapsed >= OUTPUT_START ? 'output' : elapsed >= AI_START ? 'classify' : count ? 'receive' : 'emit';
    const phase = stage === 'classify' ? (elapsed >= locateStart ? 'locate' : elapsed >= fitStart ? 'fit' : 'filter') : stage;
    if (previousPhase === phase && previousCount === count && host.dataset.static === String(reducedMotion)) return;

    host.dataset.stage = stage;
    host.dataset.phase = phase;
    host.dataset.static = String(reducedMotion);
    status.textContent = stageText[phase] + (stage === 'receive' ? ' · ' + count + '/4' : '');
    fitLabel.textContent = phase === 'locate' ? 'Primary mic delays' : energyLabel;
    steps.forEach(step => {
      if (step.dataset.step === stage) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    groups.forEach(({row, at, mics}) => {
      row.dataset.received = elapsed >= at;
      mics.forEach(mic => { mic.dataset.received = row.dataset.received; });
    });
    fits.forEach((fit, i) => {
      fit.querySelector('output').textContent = elapsed >= fitStart ? percentages[i] + '%' : '—';
    });
    stageNoise.textContent = elapsed >= AI_START ? noise : '—';
    stageResult.textContent = stage === 'output' ? resultName : 'Waiting';
    stageBearing.textContent = stage === 'output' ? bearing : '—';
    arrow.hidden = stage !== 'output' || bearing === '—';
    arrow.style.transform = 'rotate(' + degree + 'deg)';
    previousPhase = phase;
    previousCount = count;
  }
  return {update, render};
}
