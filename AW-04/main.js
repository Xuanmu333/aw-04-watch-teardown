import * as T from 'three';
import emblem from './marks/emblem.svg';
import wordmark from './marks/wordmark.svg';
import hackathon from './marks/hackathon.svg';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {runSim} from 'teardown-kit/runtime.js';
import {bindWeightTitle} from './weight-title.js';
import {buildWatch} from './watch.js';
import {sounds,acousticState,microphones} from './acoustics.js';
import {chapters,parts,tour,tl} from './story.js';
import {rhythms, loadAssignments, saveAssignments, activePulse, drivePhase} from './haptics.js';

import {customSound, loadCustomSounds, saveCustomSounds, createSoundEditor} from './custom-sounds.js';
import {createSoundLab} from './sound-lab.js';
import {createSceneMotion} from './scene-motion.js';

const film=!!window.__CAPTURE || new URLSearchParams(location.search).has('capture');
document.documentElement.lang='en';
runSim({duration:tl.duration,fps:60,theme:'light',accent:'#6753bc',hud:{enabled:false,title:'AW-04',subtitle:'Four-microphone sound localization watch'},director:{enabled:false}},async({canvas})=>{
  const app=document.querySelector('#app');
  app.classList.toggle('film',film);
  const assignments = loadAssignments(film);
  const catalog = [...sounds, ...(film ? [] : loadCustomSounds())];
  const viewIcons = [
    '<path d="m12 2 8 5v10l-8 5-8-5V7z M4 7l8 5 8-5m-8 5v10"/>',
    '<path d="m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
    '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>'
  ];
  const viewButtons = ['Assembled','Exploded','Sound Lab'].map((name,i)=>
    '<button type="button" data-scene="'+['assembled','exploded','lab'][i]+'" aria-pressed="'+(i===0)+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+viewIcons[i]+'</svg>'+name+'</button>').join('');
  const overview = ['Watch assembly','Four microphones surround the dial. A purple sector points toward the sound. A vibrator beside the battery sends a distinct pulse pattern to the wrist.'];
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
    <p class="product-title" role="heading" aria-level="1">An Ambient Sound Perception Watch for the Hearing-Impaired</p>
    ${film ? '' : '<div class="scene-actions" role="group" aria-label="Watch scene">'+viewButtons+'</div>'}
    <img class="brand-wordmark" src="${wordmark}" alt="motorola"></header>
    <main class="scene-surface" aria-label="Watch simulator">
    <div id="teardown"><aside class="left">
    <article class="hardware-detail"><h2>Hardware</h2><strong id="detailName"></strong><p id="detailText"></p>
    <dl class="hardware-spec"><div><dt>Case diameter</dt><dd>42 mm</dd></div><div><dt>Mic spacing</dt><dd>34 mm</dd></div><div><dt>Channels</dt><dd>4</dd></div></dl></article>
    <article class="haptic-settings"><h2>Sound & vibration</h2><div id="rhythmRows"></div>${film ? '' : '<button id="addSound">＋ Custom sound</button>'}
    <div class="haptic-readout"><span id="rhythmNow"></span><div id="pulses" aria-hidden="true"></div></div>
    <p id="hapticFeedback" role="status"></p></article></aside>
    <section id="stage" aria-label="Rotatable 3D watch"><div class="stagecopy"><h1></h1><div class="english"></div></div></section>
    <aside class="rightside"><article><div class="parts-heading"><h2>Parts</h2><button id="labelSwitch" aria-pressed="true" aria-label="Part labels">Labels</button></div>
    <div class="partlist">${parts.map((s,i)=>'<button data-part="'+i+'"><i></i><b>'+s+'</b><span>0'+(i+1)+'</span></button>').join('')}</div></article></aside><div class="consolefoot"><div class="trackinfo"><h2>Guided tour</h2><span id="description"></span></div><div class="timeline"><button class="play" aria-label="Play guided tour"></button><div class="track"><div class="progress"><i></i></div><div class="trackticks"></div></div><b id="trackTime"></b></div></div></div>
    ${film ? '' : '<section id="soundLab" aria-label="Sound Lab" hidden></section>'}</main>
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
  const samples=watch.layers.map(layer=>{
    const out=[];layer.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/600)))out.push(new T.Vector3().fromBufferAttribute(pos,i));});return out;});
  let W=1,H=1,manual=!film,current={stage:0,src:0,bearing:48,explode:0},stageId=-1,sel=-1;
  let savedTime=0,rx=0,ry=0,zoom=1,drag=null,lastT=0,tourOffset=0;
  const actions=$('.scene-actions'),labHost=$('#soundLab'),hardware=$('#teardown');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let lab=null,labDial=null,lastLabResult=null,useLabResult=false,labClock=0,lastDetail='';
  const motion=createSceneMotion({app,stage,canvas,hardware,labHost,footer:$('.consolefoot')});
  function user(){
    stopPreview();
    if(!manual){
      savedTime=(lastT-tourOffset+tl.duration)%tl.duration;
      motion.setExplosion(current.stage===1?current.explode:0);
      sel=({2:4,3:3,5:7})[current.stage]??-1;
    }
    manual=true;
  }
  function selectScene(name){
    user(); sel=-1; drag=null; rx=ry=0; zoom=1;
    if(name==='lab'){
      if(!lab)lab=createSoundLab(labHost,{onDialState:state=>{
        labDial=state;
        if(!state.listening)lastLabResult=state;
      }});
      motion.setReceiver(lab.receiver);
      useLabResult=true;
    }
    current.stage=name==='exploded'?1:0;
    motion.select(name);
    stageId=-1;
  }
  actions?.addEventListener('click',e=>{
    const button=e.target.closest('button[data-scene]');
    if(button) selectScene(button.dataset.scene);
  });
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
  function selectSound(index) {
    user();
    useLabResult=false;
    current.src = index;
    current.bearing = catalog[index].angle;
  }
  const rhythmFor = sound => sound.custom ? sound.rhythm : assignments[sound.en];
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
        title.onclick = () => { user(); openEditor(sound); };
      }
      const select = document.createElement('select');
      select.id = selectId;
      select.dataset.rhythm = sound.en;
      select.setAttribute('aria-label',label + ' vibration rhythm');
      for (const [id,preset] of Object.entries(rhythms)) select.add(new Option(preset.label,id));
      select.value = rhythmFor(sound);
      select.onchange = () => {
        user();
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
        selectScene('assembled');
        motion.setExplosion(0);
        selectSound(index);
        const rect = stage.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          stage.scrollIntoView({block:'center',behavior:'instant'});
        }
        const rhythm = rhythms[rhythmFor(sound)];
        feedback.textContent = sound.name + ' · ' + rhythm.label +
          (deviceSupportsVibration ? '.' : ' (on-screen preview)');
        previewTiming = rhythm.timing;
        pulseStart = performance.now();
        if (!document.hidden && deviceSupportsVibration) {
          const accepted = navigator.vibrate(previewTiming.length ? previewTiming : 0);
          if (!accepted) feedback.textContent = 'Vibration is previewed on screen on this device.';
        }
      };
      row.append(title,select,preview);
      rows.append(row);
    }
  }
  const openEditor = film ? null : createSoundEditor(catalog, (existing,name,rhythm) => {
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
  if (!film) $('#addSound').onclick = () => { user(); openEditor(null); };
  drawSoundControls();
  $('.haptic-settings').addEventListener('keydown', event => event.stopPropagation());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPreview();
  });
  let labels=true;
  $('#labelSwitch').onclick=()=>{user();labels=!labels;$('#labelSwitch').setAttribute('aria-pressed',labels);};
  $$('.partlist button').forEach((button,i)=>button.onclick=()=>{
    const selected=sel===i;
    selectScene('exploded');
    if(!selected){
      sel=i;
      current.stage=i===7?5:i===4?2:i===3?3:1;
      motion.setExplosion(0);
    }
    stageId=-1;
  });
  function restart(){
    if(motion.target==='lab')return;
    stopPreview(); manual=false; useLabResult=false; tourOffset=lastT-savedTime;
    stageId=-1;sel=-1;rx=ry=0;zoom=1;
  }
  $('.play').onclick=()=>manual?restart():user();
  canvas.onpointerdown=e=>{
    if(motion.dock>0)return;
    user();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{if(!drag)return;user();ry+=(e.clientX-drag[0])*.009;rx+=(e.clientY-drag[1])*.009;drag=[e.clientX,e.clientY];};
  canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
  canvas.addEventListener('wheel',e=>{if(motion.dock>0)return;e.preventDefault();user();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.0015),.65,1.8);},{passive:false});
  window.addEventListener('keydown',e=>{
    if(film||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('dialog'))return;
    if(motion.target==='lab'||e.target.closest('button,input,select')){
      if(e.key===' '||e.key.startsWith('Arrow'))e.stopImmediatePropagation();
      return;
    }
    if(e.key==='1'||e.key==='2'||e.key==='3') selectScene(['assembled','exploded','lab'][Number(e.key)-1]);
    else if(e.key===' '){manual?restart():user();}
    else if(e.key.startsWith('Arrow')){
      user();if(e.key==='ArrowLeft')ry-=.12;if(e.key==='ArrowRight')ry+=.12;
      if(e.key==='ArrowUp')rx-=.12;if(e.key==='ArrowDown')rx+=.12;
    }else return;
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
  function pose(c,t,drive){
    const id=c.stage,ex=id===1&&sel<0?c.explode:0,angle=t*.45,dock=motion.dock;
    let yaw=-.62+.11*Math.sin(angle),pitch=.13+.06*Math.sin(angle*.55),roll=-.17;
    if(id===1){yaw=T.MathUtils.lerp(-.66,.88+.075*Math.sin(angle),ex);pitch=T.MathUtils.lerp(.14,-.61,ex);roll=T.MathUtils.lerp(-.17,.13,ex);}
    if(id===2||id===3||sel>=0){yaw=-.23+.21*Math.sin(angle*.55);pitch=.28;roll=-.10;}
    if(id===5){yaw=-.22;pitch=-.55;roll=-.12;}
    if(id===4){yaw=.12*Math.cos(angle*.60);pitch=.035;roll=.025;}
    watch.root.position.set(0,0,0);
    watch.root.rotation.set((pitch+rx)*(1-dock),(yaw+ry)*(1-dock),roll*(1-dock),'YXZ');
    const focus=id===1?sel:id===2?4:id===3?3:id===5?7:-1;
    watch.layers.forEach((g,i)=>{g.visible=focus<0||focus===i;g.position.z=explodeOffsets[i]*ex;});
    // Once the cell clears the LRA, bring it onto the case axis for the exploded view.
    watch.battery.position.x=-5*(1-T.MathUtils.smoothstep(ex,.32,.70));
    // Follow the back cover out of the battery bay before passing the case rim.
    const outward=T.MathUtils.smoothstep(ex,.58,1);
    watch.actuator.layer.position.set(12.35+30*outward,-12*outward,-3.375-6.4*ex);
    watch.hardware(ex,focus);watch.root.updateMatrixWorld(true);
    const bounds=new T.Box3().makeEmpty(),v=new T.Vector3();
    watch.layers.forEach((g,i)=>{if(g.visible)for(const p of samples[i])bounds.expandByPoint(v.copy(p).applyMatrix4(g.matrixWorld));});
    const centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const coverage=focus>=0?.69:T.MathUtils.lerp(.84,.76,ex);
    const height=T.MathUtils.lerp(Math.max(size.y/coverage,size.x/(W/H*coverage),1)/zoom,52*H/W,dock);
    camera.left=-height*W/H/2;camera.right=-camera.left;camera.top=height/2;camera.bottom=-height/2;
    camera.position.set(centre.x*(1-dock),centre.y*(1-dock),180);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    // Frame the resting assembly first so the camera does not track its vibration.
    if(id===0 || id===4) watch.root.translateY(-1.15*drive);
    leaders.hidden=!(id===1 && ex>.76 && sel<0 && labels && W>310);
    if(!leaders.hidden){
      const dpr=Math.min(devicePixelRatio,2);
      if(leaders.width!==Math.round(W*dpr)||leaders.height!==Math.round(H*dpr)){leaders.width=Math.round(W*dpr);leaders.height=Math.round(H*dpr);}
      legend.setTransform(dpr,0,0,dpr,0,0);legend.clearRect(0,0,W,H);
      const points=[[15,-13,0],[-8,-10,-6],[9,-8,-2],[13,-8,-.5],[14,-9,1.7],[14,-8,3.9],[17,-8,5.7],[0,0,1.69]];
      const anchors=points.map((p,i)=>{v.fromArray(p).applyMatrix4(watch.layers[i].matrixWorld).project(camera);return {x:(v.x+1)*W/2,y:(1-v.y)*H/2,i};}).sort((a,b)=>a.y-b.y);
      legend.font=W<480?'500 11px "PingFang SC", sans-serif':'500 13px "PingFang SC", sans-serif';
      const labelWidth=Math.max(...parts.map(name=>legend.measureText(name).width));
      const end=Math.min(W*.865,W-labelWidth-14);let prev=-50;
      legend.strokeStyle='#777288';
      legend.lineWidth=.9;
      for(const {x,y,i} of anchors){const yy=Math.max(y,prev+23);prev=yy;
        legend.beginPath();legend.moveTo(x,y);legend.lineTo(Math.max(x+8,end-30),yy);legend.lineTo(end,yy);legend.stroke();
        legend.beginPath();legend.arc(x,y,2.3,0,7);legend.fillStyle='#6551a8';legend.fill();
        legend.fillStyle='#484458';legend.fillText(parts[i],end+7,yy+4);}
    }
    tags.forEach((tag,i)=>{tag.hidden=id!==2||!labels;if(tag.hidden)return;
      const [x,y]=microphones[i];v.set(x*1.25,y*1.25,3.0).applyMatrix4(watch.array.matrixWorld).project(camera);
      tag.style.left=((v.x+1)*W/2)+'px';tag.style.top=((1-v.y)*H/2)+'px';});
  }
  let docked=false,paintedDial=null,paintedWidth=0,paintedHeight=0;
  function render(raw){
    const dt=(raw-lastT+tl.duration)%tl.duration;
    lastT=raw;
    const t=(raw-tourOffset+tl.duration)%tl.duration;
    if(!manual){
      const a=tour(t);current={...a,bearing:sounds[a.src].angle};
      motion.tour(a.stage===0||a.stage===4?'assembled':'exploded',a.explode);
    }else{
      motion.advance(dt,reducedMotion.matches,sel>=0);
      current.explode=motion.explosion;
      if(sel<0)current.stage=motion.explosion>0||motion.target==='exploded'?1:0;
    }
    if(lab){
      motion.layout();
      const atReceiver=motion.dock===1;
      if(atReceiver&&!docked){lab.resize();lab.replay();paintedDial=null;}
      if(atReceiver){labClock+=dt;lab.render(labClock);}
      docked=atReceiver;
    }
    resize();
    const c=current,id=c.stage;
    if(docked&&labDial){
      // The docked watch is fixed; only the acoustic field and chip need to animate.
      if(labDial!==paintedDial||W!==paintedWidth||H!==paintedHeight){
        watch.dial.update(labDial);watch.actuator.update(false,0);
        pose({stage:0,explode:0},0,0);
        renderer.render(scene,camera);
        paintedDial=labDial;paintedWidth=W;paintedHeight=H;
      }
      return;
    }
    const s=useLabResult&&lastLabResult?lastLabResult:acousticState(c.src,c.bearing,t,catalog);
    const focus=sel>=0?sel:id===2?4:id===3?3:id===5?7:-1;
    const detail=focus>=0?parts[focus]:overview[0];
    if(lastDetail!==detail){
      $('#detailName').textContent=detail;
      $('#detailText').textContent=focus>=0?partNotes[focus]:overview[1];
      $$('.partlist button').forEach((button,i)=>button.setAttribute('aria-pressed',i===focus));
      lastDetail=detail;
    }
    if(stageId!==id){
      stageId=id;
      const [name,en,,description]=chapters[id];
      $('.stagecopy h1').textContent=sel>=0?parts[sel]:name;
      $('.english').textContent=sel>=0?'COMPONENT '+String(sel+1).padStart(2,'0'):en;
      $('#description').textContent=sel>=0?partNotes[sel]:description;
    }
    $('.play').textContent=manual?'▶':'Ⅱ';$('.play').setAttribute('aria-label',manual?'Play guided tour':'Pause guided tour');
    const playhead=manual?savedTime:t;
    $('#trackTime').textContent=String(Math.floor(playhead)).padStart(2,'0')+' / '+tl.duration+' s';$('.progress i').style.width=(playhead/tl.duration*100)+'%';
    const sound = s.detected.en;
    const rhythmId = rhythmFor(s.detected);
    const rhythm = rhythms[rhythmId];
    const detection = sound + '/' + rhythmId;
    if (lastDetection !== detection) {
      lastDetection = detection;
      $('#rhythmNow').textContent = s.detected.name + ' · ' + rhythm.label;
      pulseBars.replaceChildren(...rhythm.timing.map((ms,i) => {
        const segment = document.createElement('i');
        segment.style.width = (ms * .085) + 'px';
        segment.className = i % 2 ? 'gap' : 'beat';
        return segment;
      }));
    }
    const elapsedMs = performance.now() - pulseStart;
    const pulse = activePulse(previewTiming, elapsedMs);
    for (let i = 0; i < pulseBars.children.length; i++) pulseBars.children[i].classList.toggle('playing', i === pulse);
    const drive = drivePhase(previewTiming,pulse,elapsedMs);
    watch.actuator.update(id===5,drive);
    watch.dial.update(s);
    pose(c,manual && id===0 ? savedTime : t,drive);
    renderer.render(scene,camera);
  }
  return {render,resize,warm:()=>renderer.compileAsync(scene,camera)};
});
