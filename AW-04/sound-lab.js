import {sounds} from './acoustics.js';
import {analyzeScene} from './lab-acoustics.js';
import {makeDial} from './dial.js';
import watchFront from './watch-front.webp';
import './sound-lab.css';

const initialSources = [
  {id:'bell', type:0, x:.48, y:.56},
  {id:'horn', type:1, x:-.73, y:.52},
  {id:'alarm', type:2, x:.64, y:-.71},
];
const iconPaths = [
  '<path d="M4.5 16.5h15c-2-1.9-2.2-3.6-2.2-6.3a5.3 5.3 0 0 0-10.6 0c0 2.7-.2 4.4-2.2 6.3ZM10 19.1a2.3 2.3 0 0 0 4 0"/><path d="M12 3v1.8"/>',
  '<path d="m3.5 12 1.8-5h11.5l2.1 5M3 16.8v-4.4l2-1.2h12.5l2 1.2v4.4H3ZM5.2 17v2m12-2v2M6 14h2m6 0h2.2"/>',
  '<path d="M5 18.3h14.1M6.8 16.8v-5a5.2 5.2 0 0 1 10.4 0v5M9.3 11.3a2.9 2.9 0 0 1 2-2.3M12 2v1.8M3.8 5l1.4 1.2M20.2 5l-1.4 1.2"/>',
];
const directions = ['N','E','S','W'];
const icon = type => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[type]+'</svg>';
const bearingText = value => String(Math.round(value) % 360).padStart(3,'0')+'°';
const delayText = us => (Math.round(us)>0 ? '+' : Math.round(us)<0 ? '−' : '')+Math.abs(Math.round(us))+' µs';
const limit = value => Math.max(-1,Math.min(1,value));
const meters = value => (value >= 0 ? '+' : '−') + Math.abs(4*value).toFixed(1)+' m';

function fieldGrid() {
  const ticks = [-3,-2,-1,1,2,3].map(m => {
    const n = 250+m*48;
    return '<path d="M'+n+' 247v6 M247 '+n+'h6"/>';
  }).join('');
  return '<svg class="sl-grid" viewBox="0 0 500 500" aria-hidden="true">'+
    '<g class="sl-grid-rings"><circle cx="250" cy="250" r="192"/><circle cx="250" cy="250" r="96"/></g>'+
    '<g class="sl-grid-axes"><path d="M45 250h410 M250 45v410"/>'+ticks+'</g>'+
    '<g class="sl-grid-type"><text x="250" y="36">N</text><text x="468" y="254">E</text><text x="250" y="473">S</text><text x="32" y="254">W</text></g>'+
    '<g class="sl-grid-distance"><text x="179" y="179">2 m</text><text x="112" y="111">4 m</text></g></svg>';
}

export function createSoundLab(host) {
  const sources = initialSources.map(source=>({...source}));
  let mode='single', selected=sources[0], model;
  const dial=makeDial();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  host.innerHTML=`
    <div class="sl-column sl-left">
      <section class="sl-card">
        <h2>Sound sources <small data-lab-count></small></h2>
        <div class="sl-types" aria-label="Sound category">${sources.map(s=>'<button data-lab-type="'+s.type+'">'+sounds[s.type].name+'</button>').join('')}</div>
        <div class="sl-source-list">${sources.map(s=>`
          <button class="sl-source" data-lab-row="${s.id}" aria-label="Select ${sounds[s.type].name}">
            <span class="sl-source-heading"><span class="sl-small-icon">${icon(s.type)}</span><strong>${sounds[s.type].name}</strong><span class="sl-source-role"></span></span>
            <span class="sl-source-metrics"><span>Received <b data-level></b></span><span>Filtered <b data-clean></b></span><span>Range <b data-range></b></span></span>
          </button>`).join('')}
        </div>
      </section>
      <section class="sl-card">
        <h2>Source position</h2>
        <div class="sl-position-id"><i></i><strong data-lab-selected></strong></div>
        ${['x','y'].map((axis,i)=>`<label class="sl-position"><span>${i?'Y · North':'X · East'}</span><output data-axis-value="${axis}"></output><input aria-label="${i?'North':'East'} position in metres" data-lab-axis="${axis}" type="range" min="-4" max="4" step="0.1"></label>`).join('')}
      </section>
    </div>
    <div class="sl-field">
      <div class="sl-field-top"><h2>Acoustic field</h2><div class="sl-mode" role="group" aria-label="Source mode"><button data-lab-mode="single">Single source</button><button data-lab-mode="multi">Multiple sources</button></div></div>
      <div class="sl-map-wrap"><div class="sl-map" data-lab-map>
        ${fieldGrid()}
        <div class="sl-plane" data-lab-travel>
          <svg class="sl-rays" aria-hidden="true" viewBox="-100 -100 200 200" preserveAspectRatio="none">${sources.map(s=>'<g data-ray="'+s.id+'"><line/><circle r="1.1"/></g>').join('')}</svg>
          <div class="sl-watch"><img src="${watchFront}" alt="" draggable="false"><div class="sl-dial-mount"></div></div>
          ${sources.map(s=>`<button type="button" class="sl-node" data-lab-node="${s.id}" aria-label="Move ${sounds[s.type].name}" aria-describedby="slMoveHelp">${icon(s.type)}<span class="sl-node-label">${sounds[s.type].name}</span></button>`).join('')}
        </div>
      </div></div>
      <div class="sl-field-foot"><span id="slMoveHelp">Drag a source or move it with the arrow keys.</span><span>PLAN VIEW · METRES</span></div>
    </div>
    <div class="sl-column sl-right">
      <section class="sl-card sl-ai">
        <h2>AI chip <small>SIMULATED</small></h2>
        <p class="sl-ai-label">Primary sound</p>
        <strong class="sl-result" data-lab-result aria-live="polite"></strong>
        <div class="sl-ai-data"><div><span>Bearing</span><b data-lab-bearing></b></div><div><span>Signal purity</span><b data-lab-score></b></div></div>
      </section>
      <section class="sl-card sl-separation">
        <h2>Noise suppression</h2>
        <div class="sl-band-chart" role="img" aria-label="Mixed input and isolated output power in eight frequency bands">
          ${Array.from({length:8},()=>'<div><i></i><b></b></div>').join('')}
        </div>
        <div class="sl-frequency"><span>Low</span><span>Frequency</span><span>High</span></div>
        <div class="sl-key"><span>Mixed input</span><span>Filtered</span></div>
        <div class="sl-measure"><span>Noise reduction</span><b data-lab-reduction></b></div>
      </section>
      <section class="sl-card sl-arrival">
        <h2>Mic arrival delays <small>34 MM</small></h2>
        ${directions.map((d,i)=>`<div class="sl-channel"><span>M0${i+1} · ${d}</span><i><b></b></i><output data-lab-delay="${i}"></output></div>`).join('')}
        <div class="sl-tdoa"><div><span>W − E</span><b data-lab-ew></b></div><div><span>S − N</span><b data-lab-ns></b></div></div>
        <p class="sl-equation">Bearing = atan2(W − E, S − N)</p>
      </section>
    </div>`;
  host.classList.add('sound-lab');
  const one = query=>host.querySelector(query);
  const all = query=>Array.from(host.querySelectorAll(query));
  const plane=one('[data-lab-travel]');
  const dialCanvas=dial.texture.image;
  dialCanvas.setAttribute('role','img');
  one('.sl-dial-mount').append(dialCanvas);

  const nodes = new Map(sources.map(source => [source.id,{
    node:one('[data-lab-node="'+source.id+'"]'),
    row:one('[data-lab-row="'+source.id+'"]'),
    ray:one('[data-ray="'+source.id+'"]')
  }]));
  const modeButtons=all('[data-lab-mode]'), typeButtons=all('[data-lab-type]'), axes=all('[data-lab-axis]');
  const channels=all('.sl-channel'), bands=all('.sl-band-chart > div');
  const visibleSources = ()=>mode==='multi' ? sources : [selected];
  let activeDrag=null;

  function refresh() {
    model=analyzeScene(visibleSources());
    host.dataset.primary=model.primaryId;
    host.dataset.sourceMode=mode;
    modeButtons.forEach(b=>b.setAttribute('aria-pressed',b.dataset.labMode===mode));
    typeButtons.forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.labType)===selected.type));
    one('.sl-types').hidden=mode==='multi';
    one('[data-lab-count]').textContent=model.sources.length+(model.sources.length===1?' INPUT':' INPUTS');
    one('[data-lab-selected]').textContent=sounds[selected.type].name;
    axes.forEach(input=>{
      const axis=input.dataset.labAxis;
      input.value=(selected[axis]*4).toFixed(1);
      const value=meters(selected[axis]);
      input.setAttribute('aria-valuetext',value);
      one('[data-axis-value="'+axis+'"]').textContent=value;
    });

    for (const source of sources) {
      const item=model.sources.find(s=>s.id===source.id);
      const {node,row,ray}=nodes.get(source.id);
      node.hidden=row.hidden=!item;
      ray.style.display=item?'':'none';
      if (!item) continue;
      const primary=source.id===model.primaryId;
      node.classList.toggle('sl-primary',primary);
      node.classList.toggle('sl-selected',source===selected);
      node.style.left=(50+50*source.x)+'%';
      node.style.top=(50-50*source.y)+'%';
      node.classList.toggle('sl-label-above',source.y<-.72);
      row.setAttribute('aria-pressed',source===selected);
      row.querySelector('.sl-source-role').textContent=primary?'Primary':'Background';
      row.querySelector('[data-level]').textContent=item.levelDb.toFixed(1)+' dB';
      row.querySelector('[data-clean]').textContent=item.cleanDb.toFixed(1)+' dB';
      row.querySelector('[data-range]').textContent=item.range.toFixed(1)+' m';
      ray.classList.toggle('sl-primary',primary);
      ray.firstElementChild.setAttribute('x2',100*source.x);
      ray.firstElementChild.setAttribute('y2',-100*source.y);
    }

    const result=one('[data-lab-result]');
    if (result.textContent!==model.detected.name) result.textContent=model.detected.name;
    one('[data-lab-bearing]').textContent=model.hasBearing===false?'—':bearingText(model.degree);
    one('[data-lab-score]').textContent=Math.round(model.confidence*100)+'%';
    one('[data-lab-reduction]').textContent=model.noiseReductionDb.toFixed(1)+' dB';
    bands.forEach((bar,i)=>{
      bar.children[0].style.height=(100*model.inputSpectrum[i])+'%';
      bar.children[1].style.height=(100*model.cleanSpectrum[i])+'%';
    });
    channels.forEach((row,i)=>{
      const us=model.delays[i];
      row.querySelector('b').style.width=Math.min(100,us)+'%';
      row.querySelector('output').textContent=Math.round(us)+' µs';
    });
    one('[data-lab-ew]').textContent=delayText(model.delays[3]-model.delays[1]);
    one('[data-lab-ns]').textContent=delayText(model.delays[2]-model.delays[0]);
    dial.update(model.dialState);
    dialCanvas.setAttribute('aria-label','Watch shows '+model.detected.name+(model.hasBearing===false?' at receiver':' at '+bearingText(model.degree)));
  }

  modeButtons.forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.labMode;
    refresh();
  }));
  typeButtons.forEach(button=>button.addEventListener('click',()=>{
    selected=sources[Number(button.dataset.labType)];
    refresh();
  }));
  axes.forEach(input=>input.addEventListener('input',()=>{
    selected[input.dataset.labAxis]=limit(Number(input.value)/4);
    refresh();
  }));
  for (const source of sources) {
    const {node,row}=nodes.get(source.id);
    row.addEventListener('click',()=>{selected=source; refresh();});
    node.addEventListener('focus',()=>{if(selected!==source){selected=source;refresh();}});
    node.addEventListener('pointerdown',event=>{
      if (event.button!==0 || activeDrag) return;
      node.focus({preventScroll:true});
      selected=source;
      activeDrag={id:event.pointerId,source,x:event.clientX,y:event.clientY,sx:source.x,sy:source.y};
      node.setPointerCapture(event.pointerId);
      node.classList.add('sl-dragging');
      refresh();
    });
    node.addEventListener('pointermove',event=>{
      if (activeDrag?.id!==event.pointerId || activeDrag.source!==source) return;
      const rect=plane.getBoundingClientRect();
      source.x=limit(activeDrag.sx+2*(event.clientX-activeDrag.x)/rect.width);
      source.y=limit(activeDrag.sy-2*(event.clientY-activeDrag.y)/rect.height);
      refresh();
    });
    node.addEventListener('lostpointercapture',event=>{
      if (activeDrag?.id!==event.pointerId) return;
      activeDrag=null;
      node.classList.remove('sl-dragging');
    });
    node.addEventListener('keydown',event=>{
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];
      if (!delta) return;
      event.preventDefault();
      const step=event.shiftKey ? .125 : .025;
      selected=source;
      source.x=limit(source.x+delta[0]*step);
      source.y=limit(source.y+delta[1]*step);
      refresh();
    });
  }

  function render(timeSeconds) {
    const stationary=reducedMotion.matches;
    for (const source of visibleSources()) {
      const dot=nodes.get(source.id).ray.lastElementChild;
      const phase=stationary ? .5 : 1-(timeSeconds*.55+source.type*.3)%1;
      dot.setAttribute('cx',100*source.x*phase);
      dot.setAttribute('cy',-100*source.y*phase);
    }
  }
  refresh();
  return {render};
}
