import {sounds} from './acoustics.js';
import {AI_START, OUTPUT_START, receiveTime} from './signal-timing.js';
import './signal-pipeline.css';

const fitStart = AI_START + (OUTPUT_START - AI_START) * .26;
const locateStart = AI_START + (OUTPUT_START - AI_START) * .68;
const compass = ['N','NE','E','SE','S','SW','W','NW'];
const signed = value => (Math.round(value)>0 ? '+' : '') + Math.round(value) + ' µs';
const stages = {emit:'Wave in flight',receive:'Capturing',transfer:'Transmitting to chip',
  filter:'Suppressing noise',fit:'Fitting sound classes',locate:'Solving direction',output:'Analysis complete'};

export function createSignalPipeline(host) {
  host.classList.add('sl-pipeline');
  const bands = Array.from({length:8},(_,i)=>i+1);
  host.innerHTML = `
    <div class="sl-path-head">
      <div><h2>AI signal analysis</h2><span class="sl-path-status"></span></div>
      <button type="button" data-replay-signal><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.6 6a5.6 5.6 0 1 1 .4 5.1M2.4 2.5v3.9h4"/></svg>Replay signal</button>
    </div>
    <section class="sl-stage-block" data-step="receive">
      <div class="sl-step-head"><h3>Mic arrivals</h3><span data-pipeline-source></span></div>
      <div class="sl-path-arrivals">${['N','E','S','W'].map((d,i)=>`<div data-mic="${i}"><span>M0${i+1} · ${d}</span><output data-lab-delay="${i}"></output></div>`).join('')}</div>
      <div class="sl-readout-line"><span>First arrival</span><b data-first-mic></b></div>
    </section>
    <section class="sl-stage-block" data-step="filter">
      <div class="sl-step-head"><h3>Noise suppression</h3><span>8 bands · low to high</span></div>
      <div class="sl-spectrum" aria-hidden="true">${bands.map(()=>'<div><i></i><b></b></div>').join('')}</div>
      <div class="sl-spectrum-foot"><span class="sl-key">Mixed</span><span class="sl-key sl-filtered">Filtered</span><b data-pipeline-noise data-lab-reduction></b></div>
      <details class="sl-band-details" open><summary>Band levels in dB</summary>
        <table><caption class="sl-sr">Simulated sound level in each frequency band</caption>
          <thead><tr><th scope="col">Band</th>${bands.map(b=>`<th scope="col">${b}</th>`).join('')}</tr></thead>
          <tbody><tr><th scope="row">Mixed</th>${bands.map(()=>'<td data-mixed-band></td>').join('')}</tr>
          <tr><th scope="row">Filtered</th>${bands.map(()=>'<td data-clean-band></td>').join('')}</tr></tbody>
        </table>
      </details>
    </section>
    <section class="sl-stage-block" data-step="fit">
      <div class="sl-step-head"><h3>Sound classification</h3><span>Energy share</span></div>
      <div class="sl-path-fits">${sounds.map((s,i)=>`<div class="sl-fit-row" data-sound-type="${i}"><span>${s.name}</span><i><b></b></i><output></output></div>`).join('')}</div>
    </section>
    <section class="sl-stage-block" data-step="locate">
      <div class="sl-step-head"><h3>Direction estimate</h3><span>Primary source</span></div>
      <div class="sl-path-lags"><span>W − E <b data-fit-ew data-lab-ew></b></span><span>S − N <b data-fit-ns data-lab-ns></b></span></div>
      <p class="sl-equation">θ = atan2(W − E, S − N)</p>
    </section>
    <div class="sl-output" data-step="output" role="status" aria-live="polite" aria-atomic="true">
      <div><h3>Watch output</h3><strong data-pipeline-result data-lab-result></strong></div>
      <div class="sl-output-bearing"><b data-pipeline-bearing data-lab-bearing></b><span>Purity <b data-lab-score></b></span></div>
    </div>`;

  const find = sel=>host.querySelector(sel);
  const all = sel=>Array.from(host.querySelectorAll(sel));
  const micRows = all('[data-mic]');
  const bars = all('.sl-spectrum > div');
  const mixedCells = all('[data-mixed-band]'), cleanCells = all('[data-clean-band]');
  const fits = all('.sl-fit-row'), steps = all('[data-step]');
  let model,selected,receiveTimes,first,previousPhase,previousCount;

  function update(next,selectedId) {
    model=next;
    selected=model.sources.find(source=>source.id===selectedId);
    receiveTimes=selected.arrivalsUs.map((_,i)=>receiveTime(selected.arrivalsUs,i));
    first=Math.min(...selected.arrivalsUs);
    find('[data-pipeline-source]').textContent=sounds[selected.type].name;
    previousPhase='';
  }

  function render(time,reducedMotion) {
    const elapsed=reducedMotion ? Infinity : time;
    const count=receiveTimes.filter(t=>elapsed>=t).length;
    const filtered=elapsed>=AI_START, fitted=elapsed>=fitStart, located=elapsed>=locateStart;
    const complete=elapsed>=OUTPUT_START;
    const phase=complete?'output':located?'locate':fitted?'fit':filtered?'filter':count===4?'transfer':count?'receive':'emit';
    if (phase===previousPhase && count===previousCount && host.dataset.static===String(reducedMotion)) return;
    host.dataset.phase=phase;
    host.dataset.stage=complete?'output':filtered?'classify':count?'receive':'emit';
    host.dataset.static=String(reducedMotion);
    find('.sl-path-status').textContent='Simulation · '+stages[phase]+(phase==='receive'?' · '+count+'/4':'');
    for (const step of steps) {
      if (step.dataset.step===phase) step.setAttribute('aria-current','step');
      else step.removeAttribute('aria-current');
    }
    micRows.forEach((row,i)=>{
      const received=elapsed>=receiveTimes[i];
      row.dataset.received=String(received);
      row.querySelector('output').textContent=received ? signed(selected.arrivalsUs[i]-first) : '—';
    });
    find('[data-first-mic]').textContent=count ? (first/1000).toFixed(2)+' ms' : '—';
    bars.forEach((bar,i)=>{
      bar.firstElementChild.style.height=(filtered ? model.inputSpectrum[i]*100 : 0)+'%';
      bar.lastElementChild.style.height=(filtered ? model.cleanSpectrum[i]*100 : 0)+'%';
      mixedCells[i].textContent=filtered?model.bandLevels[i].toFixed(1):'—';
      cleanCells[i].textContent=filtered?model.filteredLevels[i].toFixed(1):'—';
    });
    find('[data-pipeline-noise]').textContent=filtered ? model.noiseReductionDb.toFixed(1)+' dB reduction' : '—';
    fits.forEach((row,i)=>{
      const pct=model.classShares[i]*100;
      row.querySelector('b').style.width=(fitted?pct:0)+'%';
      row.querySelector('output').textContent=fitted?Math.round(pct)+'%':'—';
      row.classList.toggle('sl-winner',fitted && sounds[i].name===model.detected.name);
    });
    find('[data-fit-ew]').textContent=located?signed(model.delays[3]-model.delays[1]):'—';
    find('[data-fit-ns]').textContent=located?signed(model.delays[2]-model.delays[0]):'—';
    find('[data-pipeline-result]').textContent=complete?model.detected.name:'Listening';
    find('[data-pipeline-bearing]').textContent=complete && model.hasBearing
      ? compass[Math.round(model.degree/45)%8]+' · '+model.dialState.degree+'°' : '—';
    find('[data-pipeline-bearing]').title=complete && !model.hasBearing ? 'Direction unresolved at 1 µs timing resolution' : '';
    find('[data-lab-score]').textContent=complete?Math.round(model.confidence*100)+'%':'—';
    previousPhase=phase;
    previousCount=count;
  }
  return {update,render};
}
