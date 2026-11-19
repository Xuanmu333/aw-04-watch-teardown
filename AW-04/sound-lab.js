import {sounds} from './acoustics.js';
import {analyzeScene} from './lab-acoustics.js';
import {createChipFlow} from './chip-flow.js';
import {createMicPaths} from './mic-paths.js';
import {createSoundWaves} from './sound-waves.js';
import {createSignalPipeline} from './signal-pipeline.js';
import {AI_START, OUTPUT_START} from './signal-timing.js';
import './sound-lab.css';

const axisLimit = 8; // Metres from the watch to an edge of the map.
const initialSources = [
  {id:'bell', type:0, x:1.92, y:2.24},
  {id:'horn', type:1, x:-2.92, y:2.08},
  {id:'alarm', type:2, x:2.56, y:-2.84},
];
const iconPaths = [
  '<path d="M4.5 16.5h15c-2-1.9-2.2-3.6-2.2-6.3a5.3 5.3 0 0 0-10.6 0c0 2.7-.2 4.4-2.2 6.3ZM10 19.1a2.3 2.3 0 0 0 4 0"/><path d="M12 3v1.8"/>',
  '<path d="m3.5 12 1.8-5h11.5l2.1 5M3 16.8v-4.4l2-1.2h12.5l2 1.2v4.4H3ZM5.2 17v2m12-2v2M6 14h2m6 0h2.2"/>',
  '<path d="M5 18.3h14.1M6.8 16.8v-5a5.2 5.2 0 0 1 10.4 0v5M9.3 11.3a2.9 2.9 0 0 1 2-2.3M12 2v1.8M3.8 5l1.4 1.2M20.2 5l-1.4 1.2"/>',
];
const icon = type => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[type]+'</svg>';
const limit = value => Math.max(-axisLimit,Math.min(axisLimit,value));
const plotPercent = metres => 100*metres/axisLimit;
const meters = value => (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(1)+' m';

function fieldGrid() {
  let ticks = '';
  for (let metre=1-axisLimit;metre<axisLimit;metre++) {
    const n = 250+metre*192/axisLimit;
    ticks += '<path d="M'+n+' 247v6 M247 '+n+'h6"/>';
  }
  return '<svg class="sl-grid" viewBox="0 0 500 500" aria-hidden="true">'+
    '<g class="sl-grid-rings"><circle cx="250" cy="250" r="192"/><circle cx="250" cy="250" r="96"/></g>'+
    '<g class="sl-grid-axes"><path d="M45 250h410 M250 45v410"/>'+ticks+'</g>'+
    '<g class="sl-grid-type"><text x="250" y="36">N</text><text x="468" y="254">E</text><text x="250" y="473">S</text><text x="32" y="254">W</text></g>'+
    '<g class="sl-grid-distance"><text x="179" y="179">'+axisLimit/2+' m</text><text x="112" y="111">'+axisLimit+' m</text></g></svg>';
}

export function createSoundLab(host, {onDialState,onTestVibration} = {}) {
  const sources = initialSources.map(source=>({...source}));
  let mode='single', selected=sources[0], model;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  host.innerHTML=`
    <div class="sl-field">
      <div class="sl-field-top"><h2>Acoustic field</h2><div class="sl-mode" role="group" aria-label="Source mode"><button data-lab-mode="single">Single source</button><button data-lab-mode="multi">Multiple sources</button></div></div>
      <div class="sl-universe">
        <div class="sl-map-wrap"><div class="sl-map" data-lab-map>
          ${fieldGrid()}
          <div class="sl-plane" data-lab-travel>
            <div class="sl-watch" role="group" aria-label="Watch receiver"><button type="button" class="sl-dial-test"></button></div>
            ${sources.map(s=>`<button type="button" class="sl-node" data-lab-node="${s.id}" aria-label="Move ${sounds[s.type].name}" aria-describedby="slMoveHelp">${icon(s.type)}<span class="sl-node-label">${sounds[s.type].name}</span></button>`).join('')}
          </div>
        </div></div>
        <div class="sl-chip-core"></div>
      </div>
      <div class="sl-field-foot"><span id="slMoveHelp">Drag a source or use the arrow keys. Tap the watch face to test its vibration.</span><span role="status">Watch enlarged · timing slowed</span></div>
      <section class="sl-controls" aria-label="Sound source controls">
        <div class="sl-source-controls">
          <div class="sl-control-head"><h3>Sound sources</h3>
            <div class="sl-types" role="group" aria-label="Sound category">${sources.map(s=>'<button data-lab-type="'+s.type+'">'+sounds[s.type].name+'</button>').join('')}</div>
          </div>
          <div class="sl-source-list">${sources.map(s=>`
            <button class="sl-source" data-lab-row="${s.id}" aria-label="Select ${sounds[s.type].name}">
              <span class="sl-source-heading"><span class="sl-small-icon">${icon(s.type)}</span><strong>${sounds[s.type].name}</strong><span class="sl-source-role"></span></span>
              <span class="sl-source-metrics"><span>Received <b data-level></b></span><span>Filtered <b data-clean></b></span><span>Range <b data-range></b></span></span>
            </button>`).join('')}
          </div>
        </div>
        <div class="sl-position-controls">
          <div class="sl-control-head"><h3>Source position</h3><strong data-lab-selected></strong></div>
          <div class="sl-axes">${['x','y'].map((axis,i)=>`<label class="sl-position"><span>${i?'North':'East'}</span><output data-axis-value="${axis}"></output><input aria-label="${i?'North':'East'} position in metres" data-lab-axis="${axis}" type="range" min="${-axisLimit}" max="${axisLimit}" step="0.1"></label>`).join('')}</div>
        </div>
      </section>
    </div>
    <section class="sl-pipeline-host" aria-label="AI signal analysis"></section>`;
  host.classList.add('sound-lab');
  const one = query=>host.querySelector(query);
  const all = query=>Array.from(host.querySelectorAll(query));
  const plane=one('[data-lab-travel]');
  const waves=createSoundWaves(plane,axisLimit);
  const paths=createMicPaths(plane);
  const chipFlow=createChipFlow(one('.sl-universe'),one('.sl-chip-core'));
  const pipeline=createSignalPipeline(one('.sl-pipeline-host'));
  const receiver=one('.sl-watch');
  const dialTest=one('.sl-dial-test'), hapticStatus=one('.sl-field-foot [role=status]');
  const defaultStatus=hapticStatus.textContent;
  let lastFrame=0,cycleStart=0,streamStart=0,shownDialState,displayedSourcePhase;
  const listening={listening:true,detected:{name:'Listening',en:'LISTENING'},angle:0,degree:'—',hasBearing:false};
  const nodes = new Map(sources.map(source => [source.id,{
    node:one('[data-lab-node="'+source.id+'"]'),
    row:one('[data-lab-row="'+source.id+'"]')
  }]));
  const modeButtons=all('[data-lab-mode]'), typeButtons=all('[data-lab-type]'), axes=all('[data-lab-axis]');
  const visibleSources = ()=>mode==='multi' ? sources : [selected];
  let drag=null;

  function refresh() {
    model=analyzeScene(visibleSources());
    if(hapticStatus.textContent!==defaultStatus)hapticStatus.textContent=defaultStatus;
    displayedSourcePhase='';
    host.dataset.primary=model.primaryId;
    host.dataset.sourceMode=mode;
    modeButtons.forEach(b=>b.setAttribute('aria-pressed',b.dataset.labMode===mode));
    typeButtons.forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.labType)===selected.type));
    one('.sl-types').hidden=mode==='multi';
    one('[data-lab-selected]').textContent=sounds[selected.type].name;
    axes.forEach(input=>{
      const axis=input.dataset.labAxis;
      input.value=selected[axis].toFixed(1);
      const value=meters(selected[axis]);
      input.setAttribute('aria-valuetext',value);
      one('[data-axis-value="'+axis+'"]').textContent=value;
    });

    for (const source of sources) {
      const item=model.sources.find(s=>s.id===source.id);
      const {node,row}=nodes.get(source.id);
      node.hidden=row.hidden=!item;
      if (!item) continue;
      node.classList.toggle('sl-selected',source===selected);
      const x=plotPercent(source.x), y=-plotPercent(source.y);
      node.style.left=(50+x/2)+'%';
      node.style.top=(50+y/2)+'%';
      node.classList.toggle('sl-label-above',(y<0 && y>-72) || y>72);
      row.setAttribute('aria-pressed',source===selected);
      row.querySelector('[data-level]').textContent=item.levelDb.toFixed(1)+' dB';
      row.querySelector('[data-range]').textContent=item.range.toFixed(1)+' m';
    }

    const active=visibleSources();
    waves.update(active,model,selected.id);
    paths.update(active,model,selected.id);
    chipFlow.update(model,selected.id);
    pipeline.update(model,selected.id);
    replay();
  }

  modeButtons.forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.labMode;
    refresh();
  }));
  typeButtons.forEach(button=>button.addEventListener('click',()=>{
    selected=sources[Number(button.dataset.labType)];
    refresh();
  }));
  function moveSource(source,x,y) {
    x=limit(x);y=limit(y);
    if(source.x===x && source.y===y)return;
    source.x=x;source.y=y;
    if(drag)drag.moved=true;
    streamStart=lastFrame;
    refresh();
  }
  axes.forEach(input=>{
    input.addEventListener('pointerdown',event=>{
      if(event.button===0 && !drag)drag={id:event.pointerId,control:input,moved:false};
    });
    input.addEventListener('input',()=>{
      const value=Number(input.value);
      if(input.dataset.labAxis==='x')moveSource(selected,value,selected.y);
      else moveSource(selected,selected.x,value);
    });
  });
  function release(event) {
    if(event.pointerId!==drag?.id)return;
    const {control,moved}=drag;
    drag=null;
    control.classList.remove('sl-dragging');
    if(moved){streamStart=lastFrame;replay();}
  }
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',release);
  window.addEventListener('lostpointercapture',release);
  for (const source of sources) {
    const {node,row}=nodes.get(source.id);
    row.addEventListener('click',()=>{selected=source; refresh();});
    node.addEventListener('focus',()=>{if(selected!==source){selected=source;refresh();}});
    node.addEventListener('pointerdown',event=>{
      if (event.button!==0 || drag) return;
      node.focus({preventScroll:true});
      drag={id:event.pointerId,control:node,moved:false,x:event.clientX,y:event.clientY,sx:source.x,sy:source.y};
      node.setPointerCapture(event.pointerId);
      node.classList.add('sl-dragging');
    });
    node.addEventListener('pointermove',event=>{
      if (drag?.id!==event.pointerId || drag.control!==node) return;
      const rect=plane.getBoundingClientRect();
      moveSource(source,drag.sx+2*axisLimit*(event.clientX-drag.x)/rect.width,
        drag.sy-2*axisLimit*(event.clientY-drag.y)/rect.height);
    });
    node.addEventListener('keydown',event=>{
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[event.key];
      if (!delta) return;
      event.preventDefault();
      const step=event.shiftKey ? .5 : .1;
      selected=source;
      moveSource(source,source.x+delta[0]*step,source.y+delta[1]*step);
    });
  }

  function render(timeSeconds) {
    lastFrame=timeSeconds;
    const positioning=drag?.moved===true;
    const elapsed=positioning?0:Math.max(0,timeSeconds-cycleStart);
    const staticResult=reducedMotion.matches&&!positioning;
    waves.render(elapsed,staticResult);
    paths.render(elapsed,staticResult);
    // Replaying the analysis does not interrupt the microphones' live input.
    chipFlow.render(elapsed,staticResult,positioning?0:timeSeconds-streamStart);
    pipeline.render(elapsed,staticResult);
    const complete=staticResult || elapsed>=OUTPUT_START;
    const sourcePhase=complete?'output':elapsed>=AI_START?'filtered':'receiving';
    if (sourcePhase!==displayedSourcePhase) {
      for (const item of model.sources) {
        const {row,node}=nodes.get(item.id);
        const primary=item.id===model.primaryId;
        node.classList.toggle('sl-primary',complete && primary);
        row.querySelector('.sl-source-role').textContent=complete?(primary?'Primary':'Background'):(item.id===selected.id?'Selected':'');
        row.querySelector('[data-clean]').textContent=sourcePhase==='receiving'?'—':item.cleanDb.toFixed(1)+' dB';
      }
      dialTest.title='Test '+(complete?model.detected:sounds[selected.type]).name+' vibration';
      dialTest.setAttribute('aria-label',dialTest.title);
      displayedSourcePhase=sourcePhase;
    }
    const dial=complete ? model.dialState : listening;
    if (dial!==shownDialState) {
      receiver.setAttribute('aria-label','Watch shows '+dial.detected.name+(dial.hasBearing?' at '+dial.degree+'°':''));
      onDialState?.(dial);
      shownDialState=dial;
    }
  }
  function replay() {
    cycleStart=lastFrame;
    render(lastFrame);
  }
  dialTest.addEventListener('click',()=>{
    const sound=shownDialState?.listening?sounds[selected.type]:model.detected;
    const feedback=onTestVibration?.(sound);
    if(feedback)hapticStatus.textContent=feedback;
  });
  one('[data-replay-signal]').addEventListener('click',replay);
  refresh();
  return {render,replay,receiver,resize:chipFlow.resize};
}
