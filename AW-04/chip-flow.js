import * as THREE from 'three';
import {AI_START, OUTPUT_START, receiveTime} from './signal-timing.js';
import './chip-flow.css';

const channels = ['M01','M02','M03','M04'];
const svgNS = 'http://www.w3.org/2000/svg';

const vertexShader = `
  uniform vec2 viewport;
  uniform vec2 curves[28];
  uniform float joins[4], waves[4], pixelRatio, time, intensity;
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
      float phase=waves[ch], t=fract(phase-position.y);
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
      opacity=step(position.y,phase)*mix(.53+.46*scatter.x,1.,packet)*intensity;
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
      const t=i/132;
      const offset=t+.030*Math.sin(8*Math.PI*t);
      point(ch,offset,0);
    }
    for(let j=0;j<3;j++)point(ch,j/3,2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('scatter',new THREE.Float32BufferAttribute(scatter,3));
  const uniforms={
    viewport:{value:new THREE.Vector2()},curves:{value:curves},joins:{value:joins},waves:{value:waves},
    pixelRatio:{value:1},time:{value:0},intensity:{value:1}
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
      uniforms.intensity.value=time<OUTPUT_START?1:.78;
      renderer.render(scene,camera);
    }
  };
}

export function createChipFlow(scene,chipMount){
  const pins=Array.from(scene.querySelectorAll('.sl-mic-pin'));
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('class','sl-chip-routes');
  svg.setAttribute('aria-hidden','true');
  let gradient=scene.id;
  if(!gradient){gradient='chip-'+THREE.MathUtils.generateUUID();}
  gradient+='-route-ink';
  svg.innerHTML='<defs><linearGradient id="'+gradient+'">'+
    '<stop stop-color="#c8a7ff"/><stop offset=".48" stop-color="#a293dd"/>'+
    '<stop offset="1" stop-color="#c3d9ff"/></linearGradient></defs>';
  const tracks=channels.map(name=>{
    const path=document.createElementNS(svgNS,'path');
    path.setAttribute('data-channel-route',name);
    path.setAttribute('stroke','url(#'+gradient+')');
    svg.append(path);
    return path;
  });
  const canvas=document.createElement('canvas');
  canvas.className='sl-chip-particles';canvas.setAttribute('aria-hidden','true');
  scene.append(svg,canvas);
  chipMount.setAttribute('role','img');
  chipMount.setAttribute('aria-label','AI chip with four microphone signal inputs');
  chipMount.innerHTML='<div class="sl-chip-package"><div class="sl-chip-die"><b>AI</b></div></div>'+
    channels.map((name,i)=>'<i aria-hidden="true" data-chip-inlet="'+name+'" style="top:'+(22+i*18.5)+'%"></i>').join('');
  const inlets=Array.from(chipMount.querySelectorAll('[data-chip-inlet]'));
  const curves=Array.from({length:28},()=>new THREE.Vector2());
  const joins=new Float32Array(4),waves=new Float32Array(4);
  const gpu=starRenderer(canvas,curves,joins,waves);
  let arrivals=[],transferTime=1,hasLayout=false,lastStatic=false;

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
      const a=new THREE.CubicBezierCurve(p[0],p[1],p[2],p[3]).getLength();
      const b=new THREE.CubicBezierCurve(p[3],p[4],p[5],p[6]).getLength();
      joins[i]=Math.max(.045,Math.min(.94,a/Math.max(.01,a+b)));
      const xy=v=>v.x+' '+v.y;
      tracks[i].setAttribute('d','M'+xy(p[0])+'C'+p.slice(1,4).map(xy).join(' ')+'C'+p.slice(4).map(xy).join(' '));
    }
    gpu?.resize(box.width,box.height);lastStatic=false;
  }
  const observer=new ResizeObserver(resize);
  observer.observe(scene);observer.observe(chipMount);
  if(pins[0])observer.observe(pins[0].ownerSVGElement);
  resize();
  canvas.addEventListener('webglcontextlost',()=>{canvas.hidden=true;lastStatic=false;});
  canvas.addEventListener('webglcontextrestored',()=>{canvas.hidden=false;resize();});
  if(!gpu)canvas.hidden=true;

  function update(model,selectedId){
    const source=model.sources.find(item=>item.id===selectedId);
    arrivals=source?channels.map((_,i)=>receiveTime(source.arrivalsUs,i)):[];
    if(source)transferTime=Math.max(.08,AI_START-Math.max(...arrivals));
    lastStatic=false;
  }
  function render(elapsed,reducedMotion){
    if(!hasLayout||!arrivals.length||(reducedMotion&&lastStatic))return;
    const stage=reducedMotion||elapsed>=OUTPUT_START?'output':elapsed>=AI_START?'computing':'capture';
    if(chipMount.dataset.stage!==stage)chipMount.dataset.stage=stage;
    for(let i=0;i<4;i++){
      const age=elapsed-arrivals[i];
      waves[i]=reducedMotion?1.29+i*.08:age<transferTime?age/transferTime:1+(age-transferTime)*.72;
      const state=reducedMotion?'static':waves[i]>=0?'active':'pending';
      if(tracks[i].dataset.carrying!==state)tracks[i].dataset.carrying=state;
      const input=reducedMotion?'static':waves[i]>=1?'active':'pending';
      if(inlets[i].dataset.carrying!==input)inlets[i].dataset.carrying=input;
    }
    if(!canvas.hidden)gpu?.draw(elapsed,reducedMotion);
    lastStatic=reducedMotion;
  }
  return {update,render,resize};
}
