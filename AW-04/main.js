import * as T from 'three';
import brandMarks from './brand-marks.json';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {runSim} from 'teardown-kit/runtime.js';
import {buildWatch} from './watch.js';
import {sounds,acousticState,microphones} from './acoustics.js';
import {chapters,parts,tour,tl} from './story.js';
import {rhythms, loadAssignments, saveAssignments, activePulse, drivePhase} from './haptics.js';

import {customSound, loadCustomSounds, saveCustomSounds, createSoundEditor} from './custom-sounds.js';

const film=!!window.__CAPTURE || new URLSearchParams(location.search).has('capture');
document.documentElement.lang='zh-CN';
runSim({duration:tl.duration,fps:60,theme:'light',accent:'#6753bc',hud:{enabled:false,title:'声向仪 AW-04',subtitle:'四麦声源定位手表'},director:{enabled:false}},async({canvas})=>{
  const app=document.querySelector('#app');
  app.classList.toggle('film',film);
  const tabButtons=chapters.map((s,i)=>'<button data-stage="'+i+'">'+s[0]+'</button>').join('');
  const assignments = loadAssignments(film);
  const catalog = [...sounds, ...(film ? [] : loadCustomSounds())];
  app.insertAdjacentHTML('beforeend',`
    <header><img class="brand-emblem" src="${brandMarks.emblem}" alt="Motorola 徽标">
    <img class="brand-wordmark" src="${brandMarks.wordmark}" alt="motorola"></header>
    <main><aside class="left">
    <article class="bearing-panel"><h2>声源方位 <small>BEARING</small></h2><div class="readline"><b id="value"></b><span>AZIMUTH<br>相对十二点</span></div><canvas id="wave" width="500" height="100"></canvas><div class="footpair"><span>模拟输入</span><b id="sound"></b></div></article>
    <article><h2>声音识别 <small>CLASSIFIER</small></h2><div class="readline"><strong id="className"></strong><span id="classMode">端侧 AI<br>模板模拟</span></div><canvas id="graph" width="560" height="64"></canvas><div class="haptic-settings"><h2>声音与振感 <small>HAPTICS</small></h2><div id="rhythmRows"></div>${film ? '' : '<button id="addSound">＋ 自定义声音</button>'}
    <div class="haptic-readout"><span id="rhythmNow"></span><div id="pulses" aria-hidden="true"></div></div>
    <p id="hapticFeedback" role="status"></p></div></article>
    <article><h2>麦克风阵列 <small>MIC ARRAY</small></h2><div class="channels">${microphones.map((_,i)=>'<div class="cellrow"><b>M0'+(i+1)+'</b><i><em></em></i><span></span></div>').join('')}</div><div class="footpair"><span>相对首达时间</span><b>Δt / μs</b></div></article>
    </aside>
    <section id="stage" aria-label="可旋转的三维手表"><div class="orbits"><i></i><i></i><i></i></div><div class="axisticks"></div><div class="caption"><span>PROJECTION / ORTHO</span><b id="fig"></b></div><div class="stagecopy"><small>VIEW STATE</small><h1></h1><div class="english"></div></div><div class="stagehint"></div></section>
    <aside class="rightside"><article><h2>定位读数 <small>POSITION</small></h2><div class="radarbox"><canvas class="polar" width="180" height="180"></canvas><dl><dt>对置间距</dt><dd>34 mm</dd><dt>平面阵列</dt><dd>4 CH</dd><dt>表壳直径</dt><dd>42 mm</dd></dl></div></article>
    <article><h2>声源场景 <small>SOURCES</small></h2><div class="options"></div><div class="slider"><label for="bearing">方位角</label><input id="bearing" type="range" min="0" max="359" step="1" value="48"></div></article>
    <article><h2>显示控制 <small>DISPLAY</small></h2><nav class="tabs" aria-label="拆解章节">${tabButtons}</nav><div class="ltoggle"><button id="labelSwitch" aria-pressed="true">部件标注</button></div></article>
    <article><h2>部件索引 <small>ASSEMBLIES</small></h2><div class="partlist">${parts.map((s,i)=>'<button data-part="'+i+'"><i></i><b>'+s+'</b><span>0'+(i+1)+'</span></button>').join('')}</div></article></aside></main>
    <footer><div class="consolefoot"><div class="trackinfo"><h2>导览记录 <small>SEQUENCE LOG</small></h2><span id="description"></span></div><div class="timeline"><button class="play" aria-label="暂停自动导览"></button><div class="track"><div class="progress"><i></i></div><div class="trackticks"></div></div><b id="trackTime"></b></div></div><div class="footline"><img class="brand-hackathon" src="${brandMarks.hackathon}" alt="hackathon"><span>AW–04 &nbsp; · &nbsp; ACOUSTIC SYSTEMS</span></div></footer>`);
  const $=s=>app.querySelector(s),$$=s=>[...app.querySelectorAll(s)];
  const stage=$('#stage');stage.prepend(canvas);
  const leaders=document.createElement('canvas');leaders.className='leaders';stage.append(leaders);const legend=leaders.getContext('2d');
  const tags=microphones.map((_,i)=>{const e=document.createElement('span');e.className='mic-tag';e.textContent='M0'+(i+1);stage.append(e);return e;});
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-40,40,40,-40,.1,500);
  camera.position.z=180;
  const studio=new RoomEnvironment(),pm=new T.PMREMGenerator(renderer),env=pm.fromScene(studio,.025);
  scene.environment=env.texture;scene.environmentIntensity=.85;studio.dispose();pm.dispose();
  scene.add(new T.HemisphereLight(0xf4f3ff,0x696878,.80));
  for(const [x,y,z,p] of [[-50,70,90,1.7],[80,30,-10,1.35],[30,-60,55,.42]]){const l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);}
  const watch=buildWatch();scene.add(watch.root);
  const polar=$('.polar').getContext('2d'),spec=$('#graph').getContext('2d');
  const samples=watch.layers.map(layer=>{
    const out=[];layer.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/600)))out.push(new T.Vector3().fromBufferAttribute(pos,i));});return out;});
  let W=1,H=1,manual=false,idle=0,current={stage:0,src:0,bearing:48,explode:0},stageId=-1,sel=-1,lastSound=-1;
  let savedTime=0,rx=0,ry=0,zoom=1,drag=null,lastT=0,tourOffset=0,opening=null;
  function user(){if(!manual)savedTime=(lastT-tourOffset+tl.duration)%tl.duration;manual=true;idle=performance.now();}
  function setStage(i){user();if(i===5)replay=true;sel=-1;rx=ry=0;zoom=1;opening=i===1?performance.now():null;current={...current,stage:i,explode:i===1?0:1};}
  $$('.tabs button').forEach((button,i)=>button.onclick=()=>setStage(i));
  let lastDetection = '', lastTourCue = -1, pulseStart = -Infinity, replay = false;
  const feedback = $('#hapticFeedback');
  const pulseBars = $('#pulses');
  const deviceSupportsVibration = typeof navigator.vibrate === 'function';
  const hint = '选一种节奏，点「试振」看整表振动。';
  feedback.textContent = film ? '表壳与表带随当前声音的节奏振动。' : hint;
  function selectSound(index) {
    user();
    current.src = index;
    current.bearing = catalog[index].angle;
    replay = true;
  }
  const rhythmFor = sound => sound.custom ? sound.rhythm : assignments[sound.en];
  function drawSoundControls() {
    const options = $('.options');
    const rows = $('#rhythmRows');
    options.replaceChildren();
    rows.replaceChildren();
    for (const [index,sound] of catalog.entries()) {
      const button = document.createElement('button');
      button.dataset.sound = index;
      button.textContent = sound.name;
      button.onclick = () => selectSound(index);
      options.append(button);

      const row = document.createElement('div');
      row.className = 'rhythm-row';
      const title = document.createElement(sound.custom ? 'button' : 'label');
      title.textContent = sound.name;
      const selectId = 'rhythm-' + sound.en;
      if (!sound.custom) title.htmlFor = selectId;
      if (sound.custom) {
        title.className = 'edit-sound';
        title.setAttribute('aria-label','编辑声音：' + sound.name);
        title.onclick = () => { user(); openEditor(sound); };
      }
      const select = document.createElement('select');
      select.id = selectId;
      select.dataset.rhythm = sound.en;
      select.setAttribute('aria-label',sound.name + '振动节奏');
      for (const [id,preset] of Object.entries(rhythms)) select.add(new Option(preset.label,id));
      select.value = rhythmFor(sound);
      select.onchange = () => {
        user();
        if (sound.custom) sound.rhythm = select.value;
        else assignments[sound.en] = select.value;
        const saved = sound.custom ? saveCustomSounds(catalog) : saveAssignments(assignments);
        feedback.textContent = sound.name + ' · ' + rhythms[select.value].label + (saved ? '，已保存。' : '，仅本次有效。');
        if (current.src === index) replay = true;
      };
      const preview = document.createElement('button');
      preview.textContent = '试振';
      preview.dataset.try = sound.en;
      preview.setAttribute('aria-label','试振：' + sound.name);
      preview.onclick = () => {
        if (current.stage !== 0) setStage(0);
        selectSound(index);
        const rect = stage.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          stage.scrollIntoView({block:'center',behavior:'instant'});
        }
        feedback.textContent = sound.name + ' · ' + rhythms[rhythmFor(sound)].label +
          (deviceSupportsVibration ? '。' : '（屏幕预览）');
      };
      row.append(title,select,preview);
      rows.append(row);
    }
    lastSound = -1;
  }
  const openEditor = film ? null : createSoundEditor(catalog, (existing,name,rhythm) => {
    const sound = existing ?? customSound('custom-' + crypto.getRandomValues(new Uint32Array(4)).join('-'),name,rhythm);
    sound.name = name;
    sound.rhythm = rhythm;
    if (!existing) catalog.push(sound);
    const saved = saveCustomSounds(catalog);
    drawSoundControls();
    selectSound(catalog.indexOf(sound));
    feedback.textContent = name + (saved ? '，已保存。' : '，仅本次有效。');
  }, sound => {
    const active = catalog[current.src];
    catalog.splice(catalog.indexOf(sound),1);
    const saved = saveCustomSounds(catalog);
    if (active === sound) selectSound(0);
    else current.src = catalog.indexOf(active);
    drawSoundControls();
    feedback.textContent = sound.name + (saved ? '，已删除。' : '，仅本次移除。');
  });
  if (!film) $('#addSound').onclick = () => { user(); openEditor(null); };
  drawSoundControls();
  $('.haptic-settings').addEventListener('keydown', event => event.stopPropagation());
  document.addEventListener('visibilitychange', () => {
    if (!film && document.hidden && deviceSupportsVibration && navigator.userActivation?.hasBeenActive) navigator.vibrate(0);
  });
  $('#bearing').oninput=e=>{user();current.bearing=+e.target.value;};
  let labels=true;
  $('#labelSwitch').onclick=()=>{user();labels=!labels;$('#labelSwitch').setAttribute('aria-pressed',labels);};
  $$('.partlist button').forEach((button,i)=>button.onclick=()=>{
    const selected=sel===i || (current.stage===5 && i===7);
    if(i===7 && !selected){setStage(5);return;}
    setStage(1);
    sel=selected?-1:i;
    current.explode=1;
    opening=null;
  });
  function restart(){manual=false;tourOffset=lastT-savedTime;stageId=-1;sel=-1;rx=ry=0;zoom=1;opening=null;}
  $('.play').onclick=()=>manual?restart():user();
  canvas.onpointerdown=e=>{user();drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;user();ry+=(e.clientX-drag[0])*.009;rx+=(e.clientY-drag[1])*.009;drag=[e.clientX,e.clientY];};
  canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
  canvas.addEventListener('wheel',e=>{e.preventDefault();user();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.0015),.65,1.8);},{passive:false});
  app.addEventListener('pointerdown',e=>{if(!e.target.closest('.play')&&!film)user();});
  window.addEventListener('keydown',e=>{if(film||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('dialog'))return;if(e.target.matches('input,select')||((e.key===' '||e.key==='Enter')&&e.target.matches('button')))return;
    if(/^[1-6]$/.test(e.key)){setStage(+e.key-1);}else if(e.key===' '){manual?restart():user();}else if(e.key.startsWith('Arrow')){user();if(e.key==='ArrowLeft')ry-=.12;if(e.key==='ArrowRight')ry+=.12;if(e.key==='ArrowUp')rx-=.12;if(e.key==='ArrowDown')rx+=.12;}else return;e.preventDefault();e.stopImmediatePropagation();},true);
  function resize(){W=stage.clientWidth;H=stage.clientHeight;if(W&&H)renderer.setSize(W,H,false);}
  new ResizeObserver(resize).observe(stage);
  const explodeOffsets=[0,-9,10,24,38,52,65,0];
  function pose(c,t,drive){
    const id=c.stage,ex=id===1&&sel<0?c.explode:0,angle=t*.45;
    let yaw=-.62+.11*Math.sin(angle),pitch=.13+.06*Math.sin(angle*.55),roll=-.17;
    if(id===1){yaw=T.MathUtils.lerp(-.66,.88+.075*Math.sin(angle),ex);pitch=T.MathUtils.lerp(.14,-.61,ex);roll=T.MathUtils.lerp(-.17,.13,ex);}
    if(id===2||id===3||sel>=0){yaw=-.23+.21*Math.sin(angle*.55);pitch=.28;roll=-.10;}
    if(id===5){yaw=-.22;pitch=-.55;roll=-.12;}
    if(id===4){yaw=.12*Math.cos(angle*.60);pitch=.035;roll=.025;}
    watch.root.position.set(0,0,0);
    watch.root.rotation.set(pitch+rx,yaw+ry,roll,'YXZ');
    const focus=id===1?sel:id===2?4:id===3?3:id===5?7:-1;
    watch.layers.forEach((g,i)=>{g.visible=focus<0||focus===i;g.position.z=explodeOffsets[i]*ex;});
    // Follow the back cover out of the battery bay before passing the case rim.
    const outward=T.MathUtils.smoothstep(ex,.58,1);
    watch.actuator.layer.position.set(12.35+30*outward,-12*outward,-3.375-6.4*ex);
    watch.hardware(ex,focus);watch.root.updateMatrixWorld(true);
    const bounds=new T.Box3().makeEmpty(),v=new T.Vector3();
    watch.layers.forEach((g,i)=>{if(g.visible)for(const p of samples[i])bounds.expandByPoint(v.copy(p).applyMatrix4(g.matrixWorld));});
    const centre=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const coverage=focus>=0?.69:id===1?.76:.84;
    const height=Math.max(size.y/coverage,size.x/(W/H*coverage),1)/zoom;
    camera.left=-height*W/H/2;camera.right=-camera.left;camera.top=height/2;camera.bottom=-height/2;
    camera.position.set(centre.x,centre.y,180);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    // Frame the resting assembly first so the camera does not track its vibration.
    if(id===0 || id===4) watch.root.translateY(-1.15*drive);
    leaders.hidden=!(id===1 && ex>.76 && sel<0 && labels && W>310);
    if(!leaders.hidden){
      const dpr=Math.min(devicePixelRatio,2);
      if(leaders.width!==Math.round(W*dpr)||leaders.height!==Math.round(H*dpr)){leaders.width=Math.round(W*dpr);leaders.height=Math.round(H*dpr);}
      legend.setTransform(dpr,0,0,dpr,0,0);legend.clearRect(0,0,W,H);
      const points=[[15,-13,0],[-8,-10,-6],[4,-8,-2],[13,-8,-.5],[14,-9,1.7],[14,-8,3.9],[17,-8,5.7],[0,0,1.69]];
      const anchors=points.map((p,i)=>{v.fromArray(p).applyMatrix4(watch.layers[i].matrixWorld).project(camera);return {x:(v.x+1)*W/2,y:(1-v.y)*H/2,i};}).sort((a,b)=>a.y-b.y);
      legend.font=W<480?'500 11px "PingFang SC", sans-serif':'500 13px "PingFang SC", sans-serif';
      const labelWidth=Math.max(...parts.map(name=>legend.measureText(name).width));
      const end=Math.min(W*.865,W-labelWidth-14);let prev=-50;
      for(const {x,y,i} of anchors){const yy=Math.max(y,prev+23);prev=yy;
        legend.beginPath();legend.moveTo(x,y);legend.lineTo(Math.max(x+8,end-30),yy);legend.lineTo(end,yy);legend.strokeStyle=i===7?'#6740aa':'#777288';legend.lineWidth=i===7?1.8:.9;legend.stroke();
        legend.beginPath();legend.arc(x,y,2.3,0,7);legend.fillStyle='#6551a8';legend.fill();
        legend.fillStyle='#484458';legend.fillText(parts[i],end+7,yy+4);}
    }
    tags.forEach((tag,i)=>{tag.hidden=id!==2||!labels;if(tag.hidden)return;
      const [x,y]=microphones[i];v.set(x*1.25,y*1.25,3.0).applyMatrix4(watch.array.matrixWorld).project(camera);
      tag.style.left=((v.x+1)*W/2)+'px';tag.style.top=((1-v.y)*H/2)+'px';});
  }
  function azimuth(s){const c=polar;c.setTransform(1,0,0,1,90,90);c.clearRect(-90,-90,180,180);const a=(s.angle-90)*Math.PI/180;
    for(const r of [36,65]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.strokeStyle='#a8a7b9';c.lineWidth=1.5;c.stroke();}
    for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);c.fillStyle='#7e7b91';c.fillRect(-1,-74,2,i%3?5:10);c.restore();}
    c.beginPath();c.moveTo(0,0);c.arc(0,0,65,a-Math.PI/9,a+Math.PI/9);c.closePath();c.fillStyle='#b7a8ed';c.fill();
    c.beginPath();c.moveTo(0,0);c.lineTo(66*Math.cos(a),66*Math.sin(a));c.strokeStyle='#614cb4';c.lineWidth=3;c.stroke();c.beginPath();c.arc(0,0,4,0,7);c.fillStyle='#6251ad';c.fill();
  }
  function render(raw){
    lastT=raw;if(!film&&manual&&!drag&&performance.now()-idle>25000&&!document.querySelector('.sound-editor[open]'))restart();
    const t=(raw-tourOffset+tl.duration)%tl.duration;
    if(!manual){const a=tour(t);current={...a,bearing:sounds[a.src].angle};}
    if(manual&&opening!==null){const x=Math.min(1,(performance.now()-opening)/1450);current.explode=x*x*(3-2*x);if(x===1)opening=null;}
    const c=current,id=c.stage,s=acousticState(c.src,c.bearing,t,catalog);
    if(stageId!==id){stageId=id;const [,en,title,des]=chapters[id];$('h1').textContent=['ASSEMBLED','TEARDOWN','MIC ARRAY','AI CORE','AZIMUTH','线性振动器'][id];$('.english').textContent=title+'  /  '+en;$('#description').textContent=des;
      $('#fig').textContent='FIG. 0'+(id+1);$$('.tabs button').forEach((b,i)=>b.setAttribute('aria-pressed',i===id));}
    if(lastSound!==c.src){lastSound=c.src;$$('.options button').forEach((b,i)=>b.setAttribute('aria-pressed',c.src===i));}
    $$('.partlist button').forEach((b,i)=>b.setAttribute('aria-pressed',sel===i||(id===2&&i===4)||(id===3&&i===3)||(id===5&&i===7)));
    $('#value').textContent=s.degree+'°';$('#className').textContent=s.detected.name;$('#sound').textContent=s.detected.custom ? '自定义场景' : s.detected.en;
    if (lastDetection.split('/')[0] !== s.detected.en) {
      $('#classMode').innerHTML = s.detected.custom ? '自定义<br>场景模拟' : '端侧 AI<br>模板模拟';
    }
    $('#bearing').value=Math.round(s.angle)%360;azimuth(s);
    $$('.cellrow').forEach((row,i)=>{row.querySelector('em').style.width=(2+s.delays[i]/101*98)+'%';row.querySelector('span').textContent=Math.round(s.delays[i])+' μs';});
    spec.clearRect(0,0,560,64);s.spectrum.forEach((v,i)=>{for(let j=0;j<8;j++){spec.fillStyle=j<Math.round(v*8)?'#8264bf':'#cbcddd';spec.fillRect(i*71,57-j*7,56,5);}});
    const w=$('#wave').getContext('2d');w.clearRect(0,0,500,100);w.strokeStyle='#8d81aa';w.lineWidth=1;w.beginPath();w.moveTo(0,50);w.lineTo(500,50);w.stroke();w.beginPath();
    for(let i=0;i<=500;i++){const u=i/500;let sum=0;s.spectrum.forEach((amp,k)=>sum+=amp*Math.sin(u*(25+k*13)-t*(4+k*.45)));const y=50+sum*15*(.22+.78*Math.pow(Math.sin(u*Math.PI*2.4-t),4));if(i===0)w.moveTo(i,y);else w.lineTo(i,y);}w.strokeStyle='#d3baff';w.lineWidth=2.6;w.stroke();
    $('.play').textContent=manual?'▶':'Ⅱ';$('.play').setAttribute('aria-label',manual?'重新播放自动导览':'暂停自动导览');
    const playhead=manual?savedTime:t;
    $('#trackTime').textContent=String(Math.floor(playhead)).padStart(2,'0')+' / '+tl.duration+' s';$('.progress i').style.width=(playhead/tl.duration*100)+'%';
    $('.stagehint').textContent=film?'MODEL  /  AW–04':'拖动旋转 · 滚轮缩放';
    const sound = s.detected.en;
    const rhythmId = rhythmFor(s.detected);
    const rhythm = rhythms[rhythmId];
    const detection = sound + '/' + rhythmId;
    const tourCue = t >= tl.beats.haptic ? tl.beats.haptic : t >= tl.beats.alarm ? tl.beats.alarm : t >= tl.beats.bird ? tl.beats.bird : t >= tl.beats.dial ? tl.beats.dial : 0;
    const newTourCue = !manual && tourCue !== lastTourCue;
    if (!manual) lastTourCue = tourCue;
    if (lastDetection !== detection || newTourCue || replay) {
      lastDetection = detection;
      replay = false;
      pulseStart = performance.now();
      $('#rhythmNow').textContent = s.detected.name + ' · ' + rhythm.label;
      pulseBars.replaceChildren(...rhythm.timing.map((ms,i) => {
        const segment = document.createElement('i');
        segment.style.width = (ms * .085) + 'px';
        segment.className = i % 2 ? 'gap' : 'beat';
        return segment;
      }));
      if (!film && !document.hidden && deviceSupportsVibration && navigator.userActivation?.hasBeenActive) {
        const accepted = navigator.vibrate(rhythm.timing.length ? rhythm.timing : 0);
        if (!accepted) feedback.textContent = '当前设备使用屏幕预览。';
      }
    }
    const elapsedMs = film ? (t - tourCue)*1000 : performance.now() - pulseStart;
    const pulse = activePulse(rhythm.timing, elapsedMs);
    for (let i = 0; i < pulseBars.children.length; i++) pulseBars.children[i].classList.toggle('playing', i === pulse);
    const drive = drivePhase(rhythm.timing,pulse,elapsedMs);
    watch.actuator.update(id===5,drive);
    watch.dial.update(s);
    pose(c,manual && id===0 ? savedTime : t,drive);
    renderer.render(scene,camera);
  }
  return {render,resize,warm:()=>renderer.compileAsync(scene,camera)};
});
