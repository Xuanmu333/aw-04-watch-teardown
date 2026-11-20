import * as T from 'three';
import emblem from './marks/emblem.svg';
import wordmark from './marks/wordmark.svg';
import hackathon from './marks/hackathon.svg';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {runSim} from 'teardown-kit/runtime.js';
import {bindWeightTitle} from './weight-title.js';
import {buildWatch} from './watch.js';
import {sounds,acousticState,microphones} from './acoustics.js';
import {parts} from './story.js';
import {rhythms, loadAssignments, saveAssignments, activePulse, drivePhase} from './haptics.js';

import {customSound, loadCustomSounds, saveCustomSounds, createSoundEditor} from './custom-sounds.js';
import {createSoundLab} from './sound-lab.js';
import {createSceneMotion} from './scene-motion.js';
import {createPartVisibility} from './part-visibility.js';
import './vision.css';

const film=!!window.__CAPTURE || new URLSearchParams(location.search).has('capture');
document.documentElement.lang='en';
runSim({duration:28,fps:60,theme:'light',accent:'#6753bc',hud:{enabled:false,title:'AW-04',subtitle:'Four-microphone sound localization watch'},director:{enabled:false}},async({canvas,cfg})=>{
  const app=document.querySelector('#app');
  app.classList.toggle('film',film);
  const assignments = loadAssignments(film);
  const catalog = [...sounds, ...(film ? [] : loadCustomSounds())];
  const pages = [
    ['vision','Vision','m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5'],
    ['lab','Sound Lab','M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4'],
    ['overview','On the Wrist','m12 2 8 5v10l-8 5-8-5V7z M4 7l8 5 8-5m-8 5v10']
  ];
  const viewButtons = pages.map(([key,label,icon],i)=>
    '<button type="button" data-tab="'+key+'" aria-pressed="'+(i===0)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon+'"/></svg>'+label+'</button>').join('');
  const partNotes = [
    'The case holds the stacked electronics. The lugs join the metal bracelet to the case.',
    'The back cover closes the case and couples the vibrator to the wrist.',
    'The battery sits inside the case beside the vibrator and supplies the electronics.',
    'The on-device processor receives four microphone signals. Sound Lab shows the calculations for each listening cycle.',
    'Four microphones sit at twelve, three, six and nine o’clock. Opposite capsules are 34 mm apart.',
    'The display pairs the sound name with a purple sector pointing toward its source.',
    'The outer bezel frames the display and protects its edge.',
    'A coil drives a suspended mass. The wrist-facing back cover transmits the selected pulse pattern.'
  ];
  app.insertAdjacentHTML('beforeend',`
    <header><img class="brand-emblem" src="${emblem}" alt="Motorola logo">
    <p class="product-title">An Ambient Sound Perception Watch for the Hearing-Impaired</p>
    <nav class="scene-actions" aria-label="Watch views">${viewButtons}</nav>
    <img class="brand-wordmark" src="${wordmark}" alt="motorola"></header>
    <main class="scene-surface" aria-label="Watch simulator">
    <div id="teardown">
      <div class="vision-story">
        <section class="vision-panel" data-story="assembled" aria-labelledby="visionTitle">
          <p class="story-kicker">The moment before hello</p>
          <h1 id="visionTitle" tabindex="-1">The world,<br><em>within reach.</em></h1>
          <p class="story-body">Designed for people who are deaf or hard of hearing, this watch lets you experience the world in a different way.</p>
          <button class="story-action" id="exploreWatch">Touch the dial to look inside <span aria-hidden="true">↗</span></button>
        </section>
        <section class="vision-panel" data-story="exploded" aria-labelledby="explodedTitle" inert>
          <p class="story-kicker">Exploded view</p>
          <h2 id="explodedTitle" tabindex="-1"><span id="stackTitle">Inside the<br><em>sensation.</em></span><em id="partTitle" hidden></em></h2>
          <p class="story-body" id="stackIntro">Four microphones catch a sound a fraction of a second apart. A chip works out what it is and where it came from. A tiny vibrator brings that moment to your wrist.</p>
          <p class="story-body" id="partNote" aria-live="polite" hidden></p>
          <details class="parts-disclosure"><summary>Explore the eight parts</summary>
            <div class="parts-list partlist">${parts.map((s,i)=>'<button type="button" data-part="'+i+'" aria-pressed="false"><b>'+s+'</b><span>'+String(i+1).padStart(2,'0')+'</span></button>').join('')}</div>
            <button type="button" id="labelSwitch" aria-pressed="true">Part labels</button>
          </details>
          <button class="story-action" id="assembleWatch"><span aria-hidden="true">←</span> <span id="returnLabel">Reassemble watch</span></button>
        </section>
      </div>
      <section id="stage" aria-label="3D watch. Drag to rotate or scroll to zoom."></section>
      <section class="overview-story" aria-labelledby="overviewTitle" inert>
        <p class="story-kicker">On the Wrist</p>
        <h1 id="overviewTitle">At a <em>glance.</em></h1>
        <p class="overview-intro" id="readingOrigin">Example reading</p>
        <dl class="overview-metrics">
          <div><dt>Sound detected</dt><dd id="overviewSound"></dd></div>
          <div><dt>Source direction</dt><dd id="overviewBearing"></dd></div>
          <div><dt>Wrist rhythm</dt><dd id="overviewRhythm"></dd></div>
        </dl>
        <details class="hardware-haptics haptic-settings"><summary>Sound &amp; vibration settings</summary>
          <div class="bearing-demo">
            <label for="demoBearing">Source angle</label>
            <input id="demoBearing" type="range" min="0" max="359" step="1" value="48">
            <button type="button" id="playBearing">Play sweep</button>
          </div>
          <div id="rhythmRows"></div><button id="addSound">＋ Custom sound</button>
          <div class="haptic-readout"><span id="rhythmNow"></span><div id="pulses" aria-hidden="true"></div></div>
          <p id="hapticFeedback" role="status"></p></details>
      </section>
    </div>
    <section id="soundLab" aria-label="Sound Lab" hidden></section></main>
    <footer><div class="footline"><img class="brand-hackathon" src="${hackathon}" alt="hackathon"></div></footer>`);
  const $=s=>app.querySelector(s),$$=s=>[...app.querySelectorAll(s)];
  bindWeightTitle($('.product-title'));
  const stage=$('#stage');stage.prepend(canvas);
  const leaders=document.createElement('canvas');leaders.className='leaders';stage.append(leaders);const legend=leaders.getContext('2d');
  const tags=microphones.map((_,i)=>{const e=document.createElement('span');e.className='mic-tag';e.textContent='M0'+(i+1);stage.append(e);return e;});
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  const sceneDpr=Math.min(devicePixelRatio,1.65);
  renderer.setPixelRatio(sceneDpr);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-40,40,40,-40,.1,500);
  camera.position.z=180;
  const studio=new RoomEnvironment(),pm=new T.PMREMGenerator(renderer),env=pm.fromScene(studio,.025);
  scene.environment=env.texture;scene.environmentIntensity=.85;studio.dispose();pm.dispose();
  scene.add(new T.HemisphereLight(0xf4f3ff,0x696878,.80));
  for(const [x,y,z,p] of [[-50,70,90,1.7],[80,30,-10,1.35],[30,-60,55,.42]]){const l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);}
  const watch=buildWatch();scene.add(watch.root);
  const updatePartVisibility=createPartVisibility(watch);
  const samples=watch.layers.map(layer=>{
    const out=[];layer.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/600)))out.push(new T.Vector3().fromBufferAttribute(pos,i));});return out;});
  let W=1,H=1,sel=-1;
  const weights=watch.layers.map(()=>0),fromWeights=weights.slice();
  const stackOrbit=new T.Vector3(0,0,1),orbitOffset=new T.Vector3();
  let inspectionTime=1,inspectionBlend=1;
  const current={stage:0,src:0,bearing:48,explode:0};
  let rx=0,ry=0,zoom=1,drag=null,lastT=0;
  const actions=$('.scene-actions'),labHost=$('#soundLab'),hardware=$('#teardown');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let lab=null,labDial=null,lastLabResult=null,useLabResult=false,labClock=0;
  const motion=createSceneMotion({app,stage,canvas,hardware,labHost});
  const bearingSlider = $('#demoBearing'), sweepButton = $('#playBearing');
  let demoAngle = null, sweepStart = null;
  function setAngleDemo(angle, play = false) {
    demoAngle = angle;
    sweepStart = play ? performance.now() : null;
    sweepButton.textContent = play ? 'Pause sweep' : 'Play sweep';
  }
  bearingSlider.oninput = () => setAngleDemo(bearingSlider.valueAsNumber);
  sweepButton.onclick = () => setAngleDemo(bearingSlider.valueAsNumber, sweepStart === null);
  $('.hardware-haptics').addEventListener('toggle', event => {
    if (!event.currentTarget.open) setAngleDemo(null);
  });
  function selectPage(page,exploded=false){
    setAngleDemo(null);
    stopPreview(); drag=null;
    if(sel>=0||inspectionTime<1)inspectPart(-1,false);
    else {rx=ry=0;zoom=1;}
    if(page==='lab'){
      if(!lab)lab=createSoundLab(labHost,{onDialState:state=>{
        labDial=state;
        if(!state.listening)lastLabResult=state;
      },onTestVibration:startVibration});
      motion.setReceiver(lab.receiver);
      useLabResult=true;
    }
    const view=exploded?'exploded':'assembled';
    app.dataset.page=page;
    if(page!=='lab'){app.dataset.view=view;app.dataset.hardwarePage=page;}
    for(const button of actions.children)button.setAttribute('aria-pressed',String(button.dataset.tab===page));
    $$('.vision-panel').forEach(panel=>panel.inert=page!=='vision'||panel.dataset.story!==view);
    $('.overview-story').inert=page!=='overview';
    if(!exploded)$('.parts-disclosure').open=false;
    current.stage=exploded?1:0;
    motion.select(page==='lab'?'lab':view);
  }
  actions.addEventListener('click',e=>{
    const button=e.target.closest('button[data-tab]');
    if(button) selectPage(button.dataset.tab);
  });
  function setExploded(open,moveFocus){
    selectPage('vision',open);
    if(moveFocus)$(open?'#explodedTitle':'#visionTitle').focus({preventScroll:true});
  }
  $('#exploreWatch').onclick=()=>setExploded(true,true);
  $('#assembleWatch').onclick=()=>sel>=0?inspectPart(-1):setExploded(false,true);
  let lastDetection = '', pulseStart = -Infinity;
  let previewTiming = [];
  const feedback = $('#hapticFeedback');
  const pulseBars = $('#pulses');
  const deviceSupportsVibration = typeof navigator.vibrate === 'function';
  const hint = 'Choose a rhythm, then select Test to preview the watch vibrating.';
  feedback.textContent = hint;
  function stopPreview() {
    if (previewTiming.length && deviceSupportsVibration) navigator.vibrate(0);
    previewTiming = [];
    pulseStart = -Infinity;
  }
  function selectSound(index, angle = null) {
    stopPreview();
    setAngleDemo(angle);
    useLabResult=false;
    current.src = index;
    current.bearing = catalog[index].angle;
  }
  const rhythmFor = sound => sound.custom ? sound.rhythm : assignments[sound.en];
  function startVibration(sound) {
    stopPreview();
    const rhythm = rhythms[rhythmFor(sound)];
    previewTiming = rhythm.timing;
    pulseStart = performance.now();
    if (previewTiming.length && !document.hidden && deviceSupportsVibration) navigator.vibrate(previewTiming);
    return sound.name + ' · ' + rhythm.label + (previewTiming.length && !deviceSupportsVibration ? ' (on-screen preview).' : '.');
  }
  function drawSoundControls() {
    const rows = $('#rhythmRows');
    rows.replaceChildren();
    for (const [index,sound] of catalog.entries()) {
      const label = sound.custom && sounds.some(preset => preset.name === sound.name) ? sound.name + ' (custom)' : sound.name;
      const row = document.createElement('div');
      row.className = 'rhythm-row';
      const title = document.createElement(sound.custom ? 'button' : 'label');
      title.textContent = label;
      const selectId = 'rhythm-' + sound.en;
      if (!sound.custom) title.htmlFor = selectId;
      if (sound.custom) {
        title.className = 'edit-sound';
        title.setAttribute('aria-label','Edit sound: ' + label);
        title.onclick = () => { stopPreview(); openEditor(sound); };
      }
      const select = document.createElement('select');
      select.id = selectId;
      select.dataset.rhythm = sound.en;
      select.setAttribute('aria-label',label + ' vibration rhythm');
      for (const [id,preset] of Object.entries(rhythms)) select.add(new Option(preset.label,id));
      select.value = rhythmFor(sound);
      select.onchange = () => {
        stopPreview();
        if (sound.custom) sound.rhythm = select.value;
        else assignments[sound.en] = select.value;
        const saved = sound.custom ? saveCustomSounds(catalog) : saveAssignments(assignments);
        feedback.textContent = sound.name + ' · ' + rhythms[select.value].label + (saved ? '. Saved.' : '. Saved for this session only.');
      };
      const preview = document.createElement('button');
      preview.textContent = 'Test';
      preview.dataset.try = sound.en;
      preview.setAttribute('aria-label','Test vibration: ' + label);
      preview.onclick = () => {
        selectSound(index, demoAngle === null ? null : bearingSlider.valueAsNumber);
        const rect = stage.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) stage.scrollIntoView({block:'center',behavior:'instant'});
        feedback.textContent = startVibration(sound);
      };
      row.append(title,select,preview);
      rows.append(row);
    }
  }
  const openEditor = createSoundEditor(catalog, (existing,name,rhythm) => {
    const sound = existing ?? customSound('custom-' + crypto.getRandomValues(new Uint32Array(4)).join('-'),name,rhythm);
    sound.name = name;
    sound.rhythm = rhythm;
    if (!existing) catalog.push(sound);
    const saved = saveCustomSounds(catalog);
    drawSoundControls();
    selectSound(catalog.indexOf(sound));
    feedback.textContent = name + (saved ? '. Saved.' : '. Saved for this session only.');
  }, sound => {
    const active = catalog[current.src];
    catalog.splice(catalog.indexOf(sound),1);
    const saved = saveCustomSounds(catalog);
    if (active === sound) selectSound(0);
    else current.src = catalog.indexOf(active);
    drawSoundControls();
    feedback.textContent = sound.name + (saved ? '. Deleted.' : '. Removed for this session only.');
  });
  $('#addSound').onclick = () => { stopPreview(); openEditor(null); };
  drawSoundControls();
  $('.haptic-settings').addEventListener('keydown', event => event.stopPropagation());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPreview();
      if (sweepStart !== null) setAngleDemo(bearingSlider.valueAsNumber);
    }
  });
  let labels=true;
  $('#labelSwitch').onclick=()=>{labels=!labels;$('#labelSwitch').setAttribute('aria-pressed',labels);};
  function inspectPart(index,restoreOrbit=true){
    const detail=index>=0, remaining=1-inspectionBlend;
    const startX=rx+orbitOffset.x*remaining,startY=ry+orbitOffset.y*remaining;
    const startZoom=zoom*Math.exp(orbitOffset.z*remaining);
    if(sel<0&&detail)stackOrbit.set(startX,startY,startZoom);
    rx=!detail&&restoreOrbit?stackOrbit.x:0;
    ry=!detail&&restoreOrbit?stackOrbit.y:0;
    zoom=!detail&&restoreOrbit?stackOrbit.z:1;
    const arc=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
    orbitOffset.set(arc(startX-rx),arc(startY-ry),Math.log(startZoom/zoom));
    for(let i=0;i<weights.length;i++)fromWeights[i]=weights[i];
    inspectionTime=inspectionBlend=0;
    sel=index;
    $('#stackTitle').hidden=$('#stackIntro').hidden=detail;
    $('#partTitle').hidden=$('#partNote').hidden=!detail;
    $('#partTitle').textContent=detail?parts[index]:'';
    $('#partNote').textContent=detail?partNotes[index]:'';
    $('#returnLabel').textContent=detail?'Back to exploded view':'Reassemble watch';
    $$('.partlist button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    if(!reducedMotion.matches){
      for(const node of [$('#explodedTitle'),$(detail?'#partNote':'#stackIntro')]){
        node.getAnimations().forEach(animation=>animation.cancel());
        node.animate([{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:300,easing:'ease-out'});
      }
    }
  }
  function advanceInspection(dt){
    if(inspectionTime===1)return;
    inspectionTime=reducedMotion.matches?1:Math.min(1,inspectionTime+Math.min(dt,.1)/.95);
    inspectionBlend=T.MathUtils.smootherstep(inspectionTime,0,1);
    for(let i=0;i<weights.length;i++)weights[i]=T.MathUtils.lerp(fromWeights[i],i===sel?1:0,inspectionBlend);
  }
  $$('.partlist button').forEach((button,i)=>button.onclick=()=>inspectPart(sel===i?-1:i));
  $('.parts-disclosure').addEventListener('toggle',e=>{
    if(!e.target.open&&sel>=0)inspectPart(-1);
  });
  selectPage('vision');
  const picker=new T.Raycaster(),pointer=new T.Vector2();
  const face=watch.display.children.find(mesh=>mesh.material.map===watch.dial.texture);
  const labelHits=[];
  function pickPart(e){
    if(app.dataset.page!=='vision'||motion.dock>0)return null;
    const exploded=motion.target==='exploded';
    if(!exploded&&(motion.target!=='assembled'||motion.explosion>0))return null;
    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    if(exploded&&!leaders.hidden){
      const label=labelHits.find(box=>x>=box.left&&x<=box.right&&Math.abs(y-box.y)<=10);
      if(label)return label.index;
    }
    pointer.set(2*x/r.width-1,1-2*y/r.height);
    picker.setFromCamera(pointer,camera);
    if(!exploded&&!picker.intersectObject(face,false).length)return null;
    const meshes=[];
    watch.root.traverseVisible(mesh=>{
      if(mesh.isMesh&&mesh.material.visible&&mesh.material.opacity>.21&&!mesh.material.userData.decal)meshes.push(mesh);
    });
    let hit=picker.intersectObjects(meshes,false)[0]?.object;
    if(!hit||(!exploded&&hit!==face))return null;
    while(hit.parent!==watch.root)hit=hit.parent;
    return hit.userData.partIndex;
  }
  canvas.onpointerdown=e=>{
    if(motion.dock>0||e.button!==0||drag)return;
    stopPreview();drag={id:e.pointerId,x:e.clientX,y:e.clientY,turned:false};canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    if(!drag){canvas.style.cursor=pickPart(e)!=null?'pointer':'';return;}
    if(drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.turned&&Math.hypot(dx,dy)<5)return;
    drag.turned=true;ry+=dx*.009;rx+=dy*.009;drag.x=e.clientX;drag.y=e.clientY;
    canvas.style.cursor='grabbing';
  };
  canvas.onpointerup=e=>{
    if(drag?.id!==e.pointerId)return;
    const tap=!drag.turned&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5;
    drag=null;canvas.style.cursor='';
    if(!tap)return;
    const index=pickPart(e);
    if(index==null)return;
    if(motion.target==='assembled')setExploded(true,false);
    else inspectPart(index===sel?-1:index);
  };
  canvas.onlostpointercapture=canvas.onpointercancel=()=>{drag=null;canvas.style.cursor='';};
  canvas.addEventListener('wheel',e=>{if(motion.dock>0)return;e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.0015),.65,1.8);},{passive:false});
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    // Keep the Teardown runtime's playback shortcuts out of native controls.
    if(e.target.closest('dialog,button,input,select,summary,textarea')||app.dataset.page==='lab'){
      if([' ','h','f','r'].includes(e.key)||e.key.startsWith('Arrow')||/^[1-9]$/.test(e.key))e.stopImmediatePropagation();
      return;
    }
    if(/^[1-3]$/.test(e.key)) selectPage(pages[Number(e.key)-1][0]);
    else if(e.key.startsWith('Arrow')){
      if(e.key==='ArrowLeft')ry-=.12;if(e.key==='ArrowRight')ry+=.12;
      if(e.key==='ArrowUp')rx-=.12;if(e.key==='ArrowDown')rx+=.12;
    }else if(e.key!==' ')return;
    e.preventDefault();e.stopImmediatePropagation();
  });
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const dpr=motion.dock===1?Math.max(2,sceneDpr):sceneDpr;
    if(renderer.getPixelRatio()!==dpr)renderer.setPixelRatio(dpr);
    if(w&&h&&(w!==W||h!==H)){W=w;H=h;renderer.setSize(W,H,false);}
  }
  new ResizeObserver(resize).observe(canvas);
  const explodeOffsets=[0,-9,10,24,38,52,65,0];
  const layerBounds=watch.layers.map(()=>new T.Box3()),stackBounds=new T.Box3();
  const centre=new T.Vector3(),size=new T.Vector3(),v=new T.Vector3();
  function pose(c,t,drive){
    const id=c.stage,ex=c.explode,angle=t*.45,dock=motion.dock;
    const context=Math.max(0,1-weights.reduce((sum,w)=>sum+w,0)),detail=1-context;
    const remaining=1-inspectionBlend,viewZoom=zoom*Math.exp(orbitOffset.z*remaining);
    let yaw=-.62+.11*Math.sin(angle),pitch=.13+.06*Math.sin(angle*.55),roll=-.17;
    if(id===1){yaw=T.MathUtils.lerp(-.66,.88+.075*Math.sin(angle),ex);pitch=T.MathUtils.lerp(.14,-.61,ex);roll=T.MathUtils.lerp(-.17,.13,ex);}
    yaw=T.MathUtils.lerp(yaw,-.23,detail);
    // Tilt the cutaway toward the viewer and turn the back cover over to its wrist-facing side.
    pitch=pitch*context+.28*(detail-weights[7]-weights[1])-.55*weights[7]+(.32-Math.PI)*weights[1];
    roll=T.MathUtils.lerp(roll,-.10,detail);
    watch.root.position.set(0,0,0);
    watch.root.rotation.set((pitch+rx+orbitOffset.x*remaining)*(1-dock),(yaw+ry+orbitOffset.y*remaining)*(1-dock),roll*(1-dock),'YXZ');
    watch.layers.forEach((g,i)=>{g.position.z=explodeOffsets[i]*ex;});
    // Once the cell clears the LRA, bring it onto the case axis for the exploded view.
    watch.battery.position.x=-5*(1-T.MathUtils.smoothstep(ex,.32,.70));
    // Follow the back cover out of the battery bay before passing the case rim.
    const outward=T.MathUtils.smoothstep(ex,.58,1);
    watch.actuator.layer.position.set(12.35+30*outward,-12*outward,-3.375-6.4*ex);
    watch.hardware(ex,-1);
    updatePartVisibility(weights);
    watch.root.updateMatrixWorld(true);
    stackBounds.makeEmpty();
    watch.layers.forEach((g,i)=>{
      if(context===0&&weights[i]===0)return;
      const box=layerBounds[i].makeEmpty();
      for(const point of samples[i])box.expandByPoint(v.copy(point).applyMatrix4(g.matrixWorld));
      stackBounds.union(box);
    });
    // Blend complete camera frames so even an off-axis part stays in shot as it enlarges.
    let height=0,cx=0,cy=0;
    function frame(bounds,coverage,gutter,weight){
      bounds.getCenter(centre);bounds.getSize(size);
      const span=Math.max(size.y/coverage,size.x*H/((W-gutter)*coverage),1)/viewZoom;
      height+=weight*span;
      cx+=weight*(centre.x+gutter*span/(2*H));cy+=weight*centre.y;
    }
    const gutter=labels&&W>310?Math.min(W*.31,155)*ex:0;
    if(context>0)frame(stackBounds,T.MathUtils.lerp(.84,.76,ex),gutter,context);
    weights.forEach((weight,i)=>{if(weight>0)frame(layerBounds[i],.69,0,weight);});
    height=T.MathUtils.lerp(height,52*H/W,dock);
    camera.left=-height*W/H/2;camera.right=-camera.left;camera.top=height/2;camera.bottom=-height/2;
    camera.position.set(cx*(1-dock),cy*(1-dock),180);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    // Frame the resting assembly first so the camera does not track its vibration.
    if(id===0 || id===4) watch.root.translateY(-1.15*drive);
    leaders.hidden=!(id===1 && ex>.76 && context>.50 && labels && W>310);
    if(!leaders.hidden)leaders.style.opacity=String(T.MathUtils.smoothstep(context,.50,1));
    if(!leaders.hidden){
      const dpr=Math.min(devicePixelRatio,2);
      if(leaders.width!==Math.round(W*dpr)||leaders.height!==Math.round(H*dpr)){leaders.width=Math.round(W*dpr);leaders.height=Math.round(H*dpr);}
      legend.setTransform(dpr,0,0,dpr,0,0);legend.clearRect(0,0,W,H);
      const points=[[15,-13,0],[-8,-10,-6],[9,-8,-2],[13,-8,-.5],[14,-9,1.7],[14,-8,3.9],[17,-8,5.7],[0,0,1.69]];
      const anchors=points.map((p,i)=>{v.fromArray(p).applyMatrix4(watch.layers[i].matrixWorld).project(camera);return {x:(v.x+1)*W/2,y:(1-v.y)*H/2,i};}).sort((a,b)=>a.y-b.y);
      legend.font=W<480?'500 11px "PingFang SC", sans-serif':'500 13px "PingFang SC", sans-serif';
      const labelWidth=Math.max(...parts.map(name=>legend.measureText(name).width));
      const end=W-labelWidth-16;let prev=-50;
      legend.strokeStyle='#777288';
      legend.lineWidth=.9;
      labelHits.length=0;
      for(const {x,y,i} of anchors){const yy=Math.max(y,prev+23);prev=yy;
        labelHits.push({index:i,left:end+3,right:end+11+legend.measureText(parts[i]).width,y:yy});
        legend.beginPath();legend.moveTo(x,y);legend.lineTo(Math.max(x+8,end-30),yy);legend.lineTo(end,yy);legend.stroke();
        legend.beginPath();legend.arc(x,y,2.3,0,7);legend.fillStyle='#6551a8';legend.fill();
        legend.fillStyle='#484458';legend.fillText(parts[i],end+7,yy+4);}
    }
    tags.forEach((tag,i)=>{tag.hidden=weights[4]<.8||!labels;if(tag.hidden)return;
      tag.style.opacity=String(T.MathUtils.smoothstep(weights[4],.8,1));
      const [x,y]=microphones[i];v.set(x*1.25,y*1.25,3.0).applyMatrix4(watch.array.matrixWorld).project(camera);
      tag.style.left=((v.x+1)*W/2)+'px';tag.style.top=((1-v.y)*H/2)+'px';});
  }
  let docked=false,paintedDial=null,paintedWidth=0,paintedHeight=0,paintedDrive=0;
  function render(t){
    const dt=(t-lastT+cfg.duration)%cfg.duration;
    lastT=t;
    advanceInspection(dt);
    motion.advance(dt,reducedMotion.matches);
    current.explode=motion.explosion;
    current.stage=motion.explosion>0||motion.target==='exploded'?1:0;
    if(lab){
      motion.layout();
      const atReceiver=motion.dock===1;
      if(atReceiver&&!docked){lab.resize();lab.replay();paintedDial=null;}
      if(atReceiver){labClock+=dt;lab.render(labClock);}
      docked=atReceiver;
    }
    resize();
    const c=current,id=c.stage;
    const elapsedMs = performance.now() - pulseStart;
    const pulse = activePulse(previewTiming, elapsedMs);
    const drive = drivePhase(previewTiming,pulse,elapsedMs);
    if(docked&&labDial){
      if(labDial!==paintedDial||W!==paintedWidth||H!==paintedHeight||drive!==paintedDrive){
        watch.dial.update(labDial);watch.actuator.update(false,drive);
        pose({stage:0,explode:0},0,drive);
        renderer.render(scene,camera);
        paintedDial=labDial;paintedWidth=W;paintedHeight=H;paintedDrive=drive;
      }
      return;
    }
    const lastReading=useLabResult&&lastLabResult;
    const angle = sweepStart === null ? demoAngle : (demoAngle + (performance.now() - sweepStart) * .036) % 360;
    const source = lastReading ? catalog.indexOf(lastReading.detected) : c.src;
    const s = (angle === null && lastReading) || acousticState(source, angle ?? c.bearing, t, catalog);
    const direction=s.hasBearing===false?'Undetermined':s.degree+'°';
    const origin=angle !== null ? 'Source direction demo' : lastReading?'Latest Sound Lab reading':'Example reading';
    if (app.dataset.page === 'overview') {
      const value = s.hasBearing === false ? 0 : Number(s.degree);
      if (bearingSlider.valueAsNumber !== value) bearingSlider.valueAsNumber = value;
      const description = value + ' degrees clockwise from 12 o’clock';
      if (bearingSlider.getAttribute('aria-valuetext') !== description) bearingSlider.setAttribute('aria-valuetext', description);
    }
    if($('#overviewBearing').textContent!==direction)$('#overviewBearing').textContent=direction;
    if($('#readingOrigin').textContent!==origin)$('#readingOrigin').textContent=origin;
    const sound = s.detected.en;
    const rhythmId = rhythmFor(s.detected);
    const rhythm = rhythms[rhythmId];
    const detection = sound + '/' + rhythmId;
    if (lastDetection !== detection) {
      lastDetection = detection;
      $('#overviewSound').textContent = s.detected.name;
      $('#overviewRhythm').textContent = rhythm.label;
      $('#rhythmNow').textContent = s.detected.name + ' · ' + rhythm.label;
      pulseBars.replaceChildren(...rhythm.timing.map((ms,i) => {
        const segment = document.createElement('i');
        segment.style.width = (ms * .085) + 'px';
        segment.className = i % 2 ? 'gap' : 'beat';
        return segment;
      }));
    }
    for (let i = 0; i < pulseBars.children.length; i++) pulseBars.children[i].classList.toggle('playing', i === pulse);
    watch.actuator.update(weights[7]>.5,drive);
    watch.dial.update(s);
    pose(c,reducedMotion.matches||id===0?0:t,drive);
    renderer.render(scene,camera);
  }
  return {render,resize,warm:()=>renderer.compileAsync(scene,camera)};
});
