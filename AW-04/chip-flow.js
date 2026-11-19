import * as THREE from 'three';
import {sounds} from './acoustics.js';
import {AI_START, computeStep, receiveTime} from './signal-timing.js';
import './chip-flow.css';

const channels = ['M01','M02','M03','M04'];
const svgNS = 'http://www.w3.org/2000/svg';
const packetTail = .32;

const vertexShader = `
  uniform vec2 viewport;
  uniform vec2 curves[28];
  uniform float joins[4], waves[4], pixelRatio, time;
  attribute vec3 scatter;
  varying vec3 tint;
  varying float opacity, glint, packet;
  varying vec2 direction;

  vec2 cubic(vec2 a,vec2 b,vec2 c,vec2 d,float t) {
    vec2 p=mix(a,b,t), q=mix(b,c,t), r=mix(c,d,t);
    return mix(mix(p,q,t),mix(q,r,t),t);
  }
  void main() {
    vec2 p;
    float diameter;
    packet=0.;direction=vec2(1.,0.);
    if (position.x < 0.0) {
      p=viewport*position.yz;
      opacity=(.20+.80*smoothstep(.24,.68,position.y))
             *(.42+.55*scatter.z)*(.87+.13*sin(time*1.5+scatter.x*43.));
      tint=mix(vec3(.70,.61,1.),vec3(.85,.95,1.),scatter.x);
      glint=step(.973,scatter.y);
      diameter=1.1+2.6*scatter.y+5.*glint;
    } else {
      int ch=int(position.x);
      float front=waves[ch]-position.y, t=clamp(front,0.,1.);
      int i=ch*7;
      float u=t/joins[ch];
      if(t>joins[ch]){ i+=3; u=(t-joins[ch])/(1.-joins[ch]); }
      p=cubic(curves[i],curves[i+1],curves[i+2],curves[i+3],u);
      vec2 tangent=mix(mix(curves[i+1]-curves[i],curves[i+2]-curves[i+1],u),
                       mix(curves[i+2]-curves[i+1],curves[i+3]-curves[i+2],u),u);
      direction=tangent/max(length(tangent),.001);
      vec2 normal=vec2(-direction.y,direction.x);
      float plume=sin(3.14159*t)*clamp(viewport.x*.018,3.,15.);
      float filament=sin(12.*t+scatter.x*4.)*.26+(scatter.y-.5)*1.36;
      packet=step(1.5,position.z);
      p+=normal*plume*filament*(1.-packet);
      vec3 strand=mix(vec3(.66,.48,1.),vec3(.62,.83,1.),float(ch)/3.);
      tint=mix(strand,vec3(.9,.94,1.),scatter.x*.55);
      glint=step(.96,scatter.y);
      diameter=mix(1.6+2.7*scatter.z+3.2*glint,clamp(viewport.x*.038,10.,34.),packet);
      // The leading point stays on the route. The packet tail extends back from it.
      p-=direction*.32*diameter*packet;
      opacity=step(0.,front)*(1.-step(1.,front))*mix(.53+.46*scatter.x,1.,packet);
    }
    gl_Position=vec4(2.*p.x/viewport.x-1.,1.-2.*p.y/viewport.y,0.,1.);
    gl_PointSize=diameter*pixelRatio;
  }
`;
const fragmentShader = `
  varying vec3 tint;
  varying float opacity,glint,packet;
  varying vec2 direction;
  void main(){
    vec2 uv=gl_PointCoord*2.-1.;
    if(packet>.5){
      float x=dot(uv,direction)-.64;
      float y=abs(dot(uv,vec2(-direction.y,direction.x)));
      float fade=smoothstep(-1.55,-.03,x)*(1.-smoothstep(0.,.18,x));
      float spine=exp(-y*y/.003)*fade;
      float halo=exp(-y*y/.032)*fade*.46;
      float core=exp(-(x*x+y*y)/.012);
      gl_FragColor=vec4(mix(tint,vec3(1.),max(spine*.52,core)),opacity*min(1.,spine+halo+core));
      return;
    }
    vec2 xy=abs(uv);
    float r=length(xy);
    float disc=1.-smoothstep(.15,1.,r);
    float cross=(1.-smoothstep(.02,.16,min(xy.x,xy.y)))*(1.-max(xy.x,xy.y));
    gl_FragColor=vec4(tint,opacity*max(disc*disc,cross*glint));
  }
`;

// One GPU draw covers the four streams and the stationary field of distant stars.
function starRenderer(canvas, curves, joins, waves) {
  const gl=canvas.getContext('webgl2',{alpha:true,depth:false,antialias:false,powerPreference:'low-power'});
  if(!gl) return null;
  const renderer=new THREE.WebGLRenderer({canvas,context:gl,alpha:true});
  renderer.setClearColor(0,0);
  let seed=913;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],scatter=[];
  function point(channel,u,v){
    positions.push(channel,u,v);
    scatter.push(random(),random(),random());
  }
  const clusters=[[.62,.23,.14,.09],[.76,.83,.10,.07],[.93,.31,.09,.10]];
  const spread=()=>random()+random()+random()-1.5;
  for(let i=0;i<340;i++){
    if(i<200){point(-1,random(),random());continue;}
    const [x,y,w,h]=clusters[i%clusters.length];
    point(-1,x+spread()*w,y+spread()*h);
  }
  for(let ch=0;ch<4;ch++){
    for(let i=0;i<132;i++){
      const t=i/131;
      const offset=packetTail*(t+.030*Math.sin(8*Math.PI*t));
      point(ch,offset,0);
    }
    for(let j=0;j<3;j++)point(ch,packetTail*j/3,2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('scatter',new THREE.Float32BufferAttribute(scatter,3));
  const uniforms={
    viewport:{value:new THREE.Vector2()},curves:{value:curves},joins:{value:joins},waves:{value:waves},
    pixelRatio:{value:1},time:{value:0}
  };
  const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,transparent:true,
    depthTest:false,depthWrite:false});
  const scene=new THREE.Scene(),camera=new THREE.Camera();
  const points=new THREE.Points(geometry,material);
  points.frustumCulled=false;
  scene.add(points);
  return {
    resize(width,height){
      const dpr=Math.min(2,window.devicePixelRatio||1);
      renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
      uniforms.pixelRatio.value=dpr;uniforms.viewport.value.set(width,height);
    },
    draw(time,quiet){
      uniforms.time.value=quiet?0:time;
      renderer.render(scene,camera);
    }
  };
}

// The die and the analysis panel read the same simulated signal, on the same clock.
function drawDie({phase:stage,count},received,model,plot,label,caption) {
  let shapes='',detail='';
  if(stage==='capture') {
    label.textContent='Input';
    shapes=channels.map((_,i)=>'<rect x="'+(7+13*i)+'" y="4" width="8" height="12" rx="2" fill="'+(received[i]?'#d7bdff':'#58526b')+'"/>').join('');
    detail=received.filter(Boolean).length+' / 4 inputs';
  } else if(stage==='filter') {
    label.textContent='Filter';
    shapes=model.inputSpectrum.map((v,i)=>{
      const x=3+7*i, mixed=v*19, clean=model.cleanSpectrum[i]*19;
      return '<path stroke="#8b86a4" stroke-width="4.5" d="M'+x+' 20v-'+mixed+'"/>'+
        (i<count?'<path stroke="#dbbaff" stroke-width="2.5" d="M'+(x+2)+' 20v-'+clean+'"/>':'');
    }).join('');
    detail=count===model.inputSpectrum.length?'−'+model.noiseReductionDb.toFixed(1)+' dB noise':'Band '+count+' / '+model.inputSpectrum.length;
  } else if(stage==='fit') {
    label.textContent='Match';
    const peak=Math.max(...model.classShares);
    shapes=model.classShares.map((value,i)=>{
      const y=3+7*i;
      const highlight=count===sounds.length?value===peak:i===count-1;
      return '<path stroke="#58526b" stroke-width="3.5" d="M5 '+y+'h48"/>'+
        (i<count?'<path stroke="'+(highlight?'#d7bdff':'#91aac6')+'" stroke-width="3.5" d="M5 '+y+'h'+(48*value)+'"/>':'');
    }).join('');
    detail=count===sounds.length?model.detected.name+' · '+Math.round(100*peak)+'%':sounds[count-1].name+' · '+Math.round(100*model.classShares[count-1])+'%';
  } else {
    const bearing=model.hasBearing?model.dialState.degree+'°':'No bearing';
    label.textContent=stage==='output'?'Output':'Locate';
    const firstPair=stage==='locate' && count===1;
    const east=model.delays[3]-model.delays[1];
    shapes='<circle cx="29" cy="11" r="9.3" fill="none" stroke="#9691ae"/>'+
      (firstPair?'<path d="M29 11h'+(east*.09)+'" stroke="#dbbaff" stroke-width="2"/>':
        model.hasBearing?'<g transform="rotate('+model.degree+' 29 11)"><path d="M29 11l-4-8a9 9 0 0 1 8 0Z" fill="#bb96f0"/><path d="M29 11V2" stroke="#f4e8ff"/></g>':'')+
      '<circle cx="29" cy="11" r="1.8" fill="#f4e8ff"/>';
    detail=firstPair?'W − E · '+Math.round(east)+' µs':stage==='output'?model.detected.name+' · '+bearing:'Δt → '+bearing;
  }
  plot.innerHTML=shapes;
  caption.textContent=detail;
  return label.textContent+'. '+detail;
}

export function createChipFlow(scene,chipMount){
  const pins=Array.from(scene.querySelectorAll('.sl-mic-pin'));
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('class','sl-chip-routes');
  svg.setAttribute('aria-hidden','true');
  const tracks=channels.map(name=>{
    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('data-channel-route',name);
    path.setAttribute('visibility','hidden');
    svg.append(path);
    return path;
  });
  const dots=document.createElementNS(svgNS,'g');
  svg.append(dots);
  const fallback=channels.map(()=>[2.1,1.8,1.4,1.1,.8].map(r=>{
    const dot=document.createElementNS(svgNS,'circle');
    dot.setAttribute('r',r);dot.setAttribute('visibility','hidden');
    dots.append(dot);
    return dot;
  }));
  const canvas=document.createElement('canvas');
  canvas.className='sl-chip-particles';canvas.setAttribute('aria-hidden','true');
  scene.append(svg,canvas);
  chipMount.setAttribute('role','img');
  chipMount.innerHTML='<div class="sl-chip-package"><div class="sl-chip-die"><b></b><svg viewBox="0 0 58 22" aria-hidden="true"></svg></div></div>'+
    '<span class="sl-die-caption"></span>'+
    channels.map((name,i)=>'<i aria-hidden="true" data-chip-inlet="'+name+'" style="top:'+(22+i*18.5)+'%"></i>').join('');
  const inlets=Array.from(chipMount.querySelectorAll('[data-chip-inlet]'));
  const label=chipMount.querySelector('.sl-chip-die b'), plot=chipMount.querySelector('svg'), caption=chipMount.querySelector('.sl-die-caption');
  const curves=Array.from({length:28},()=>new THREE.Vector2());
  const segments=channels.map((_,i)=>[0,3].map(j=>new THREE.CubicBezierCurve(...curves.slice(7*i+j,7*i+j+4))));
  const sample=new THREE.Vector2();
  const joins=new Float32Array(4),waves=new Float32Array(4);
  const gpu=starRenderer(canvas,curves,joins,waves);
  let arrivals=[], model, lastDie='', transferTime=1,hasLayout=false,lastStatic=false;

  function resize(){
    const box=svg.getBoundingClientRect();
    hasLayout=box.width>0 && box.height>0 && pins.length===4;
    if(!hasLayout)return;
    const center=element=>{
      const r=element.getBoundingClientRect();
      return new THREE.Vector2(r.left+r.width/2-box.left,r.top+r.height/2-box.top);
    };
    const from=pins.map(center),to=inlets.map(center);
    const radius=from[0].distanceTo(from[2])/2;
    const hub=from[0].clone().lerp(from[2],.5);
    const shifts=[-1.55,-.36,1.20,2.12];
    const lead=[[0,-.90],[.95,-.12],[.08,.92],[-1.45,.25]];
    for(let i=0;i<4;i++){
      const p=curves.slice(7*i,7*i+7);
      p[0].copy(from[i]);p[6].copy(to[i]);
      // Fan outward from the actual N/E/S/W pads; route M04 around the underside of the watch.
      p[1].set(from[i].x+lead[i][0]*radius,from[i].y+lead[i][1]*radius);
      const gap=Math.max(2,to[i].x-hub.x);
      p[3].set(hub.x+Math.min(radius*1.9,gap*.42),hub.y+shifts[i]*radius);
      p[2].set(i===3?from[i].x-radius:Math.min(p[1].x,p[3].x-.35*radius),p[3].y);
      const aisle=to[i].x-p[3].x;
      p[4].set(p[3].x+aisle*.4,p[3].y);
      p[5].set(to[i].x-aisle*.38,to[i].y);
      const xy=p.map(v=>v.x+','+v.y);
      tracks[i].setAttribute('d','M'+xy[0]+' C'+xy.slice(1).join(' '));
      const [a,b]=segments[i].map(segment=>{
        segment.updateArcLengths();
        return segment.getLength();
      });
      joins[i]=Math.max(.045,Math.min(.94,a/Math.max(.01,a+b)));
    }
    gpu?.resize(box.width,box.height);lastStatic=false;
  }
  const observer=new ResizeObserver(resize);
  observer.observe(scene);observer.observe(chipMount);
  if(pins[0])observer.observe(pins[0].ownerSVGElement);
  resize();
  function useGpu(available){
    canvas.hidden=!available;
    dots.style.display=available?'none':'';
    lastStatic=false;
  }
  useGpu(!!gpu);
  canvas.addEventListener('webglcontextlost',()=>useGpu(false));
  canvas.addEventListener('webglcontextrestored',()=>{useGpu(true);resize();});

  function update(next,selectedId){
    model=next;
    const source=model.sources.find(item=>item.id===selectedId);
    arrivals=source?channels.map((_,i)=>receiveTime(source.arrivalsUs,i)):[];
    if(source)transferTime=Math.max(.08,AI_START-Math.max(...arrivals));
    lastStatic=false;lastDie='';
  }
  function render(elapsed,reducedMotion){
    if(!hasLayout||!arrivals.length||(reducedMotion&&lastStatic))return;
    const step=computeStep(reducedMotion?Infinity:elapsed);
    const received=[];
    for(let i=0;i<4;i++){
      waves[i]=reducedMotion?2:(elapsed-arrivals[i])*(1+packetTail)/transferTime;
      // The leading particle starts at zero; the last trails it by packetTail.
      const visibility=waves[i]>=0 && waves[i]<1+packetTail?'visible':'hidden';
      if(tracks[i].getAttribute('visibility')!==visibility)tracks[i].setAttribute('visibility',visibility);
      received[i]=waves[i]>=1;
      const input=received[i]?'active':'pending';
      if(inlets[i].dataset.carrying!==input)inlets[i].dataset.carrying=input;
      if(canvas.hidden) fallback[i].forEach((dot,j)=>{
        const t=waves[i]-j*packetTail/(fallback[i].length-1);
        const visible=t>=0 && t<1;
        dot.setAttribute('visibility',visible?'visible':'hidden');
        if(!visible)return;
        const join=joins[i], part=t>join?1:0;
        segments[i][part].getPoint(part?(t-join)/(1-join):t/join,sample);
        dot.setAttribute('cx',sample.x);dot.setAttribute('cy',sample.y);
      });
    }
    const die=step.phase+(step.phase==='capture'?received.join(''):step.count);
    if(die!==lastDie){
      chipMount.dataset.stage=step.phase;
      const summary=drawDie(step,received,model,plot,label,caption);
      chipMount.setAttribute('aria-label','AI processor. '+summary);
      lastDie=die;
    }
    if(!canvas.hidden)gpu?.draw(elapsed,reducedMotion);
    lastStatic=reducedMotion;
  }
  return {update,render,resize};
}
