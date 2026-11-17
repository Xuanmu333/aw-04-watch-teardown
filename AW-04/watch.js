import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {microphones} from './acoustics.js';
import {makeDial} from './dial.js';

const tau=Math.PI*2;
const mat=(color,metalness=.8,roughness=.34)=>new T.MeshStandardMaterial({color,metalness,roughness});
const ti=mat('#585961',.91,.34),bright=mat('#c9cbd8',.94,.23),graphite=mat('#1c1c20',.78,.38),brushed=mat('#35363d',.90,.36),black=mat('#171824',.22,.58),violet=mat('#8048b2',.55,.38),boardMat=mat('#27242c',.48,.47);
function group(p){const g=new T.Group();p?.add(g);return g;}
function mesh(p,geo,m,x=0,y=0,z=0){const a=new T.Mesh(geo,m);a.position.set(x,y,z);p.add(a);return a;}
function box(p,w,h,d,r,m,x,y,z){return mesh(p,new RoundedBoxGeometry(w,h,d,2,r),m,x,y,z);}
function disc(p,r,h,m,x,y,z,n=96){const g=new T.CylinderGeometry(r,r,h,n);g.rotateX(Math.PI/2);return mesh(p,g,m,x,y,z);}
function profile(p,points,m,n=128){const g=new T.LatheGeometry(points.map(([r,z])=>new T.Vector2(r,z)),n);g.rotateX(Math.PI/2);return mesh(p,g,m);}
function ring(p,ri,ro,lo,hi,m,bev=.12){return profile(p,[[ri,lo],[ro-bev,lo],[ro,lo+bev],[ro,hi-bev],[ro-bev,hi],[ri,hi],[ri,lo]],m);}
function painted(p,side,fn,x,y,z,w,h=w){
  const c=document.createElement('canvas');c.width=c.height=side;fn(c.getContext('2d'),side);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return mesh(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),x,y,z);
}
function screw(p,x,y,z,r=.75,slotAngle=-.55){
  disc(p,r,.18,bright,x,y,z,24);const slot=box(p,r*1.38,.22,.06,.05,black,x,y,z+.11);slot.rotation.z=slotAngle;
}
function consolidate(g){
  g.updateWorldMatrix(true,true);
  const pools=new Map(),inverse=g.matrixWorld.clone().invert(),children=[];
  g.traverse(o=>{if(!o.isMesh)return;const geom=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    geom.applyMatrix4(inverse.clone().multiply(o.matrixWorld));geom.clearGroups();
    const pool=pools.get(o.material)||[];pool.push(geom);pools.set(o.material,pool);children.push(o);});
  g.clear();for(const [m,geos] of pools){mesh(g,mergeGeometries(geos),m);geos.forEach(v=>v.dispose());}children.forEach(o=>o.geometry.dispose());
}
// Coin LRA with an in-plane moving mass. The cap comes off for the section view.
function buildActuator(root){
  const layer=group(root),housing=group(layer),mover=group(layer),springs=group(layer),cap=group(layer);
  const copper=mat('#ad674e',.78,.38),steel=mat('#a9a9b6',.86,.42);
  disc(housing,3.85,.12,black,0,0,-1.59); // Adhesive foot against the back cover.
  disc(housing,3.98,.22,graphite,0,0,-1.42);
  ring(housing,3.64,4,-1.38,1.36,ti,.09);
  for(let i=0;i<9;i++)ring(housing,1.36+i*.118,1.46+i*.118,-1.28,-.72,copper,.025);
  box(housing,2.45,1.05,.14,.12,violet,4.35,0,-1.05);
  for(const side of [-1,1]){
    box(housing,.90,.24,.12,.04,bright,4.70,side*.25,-.95);
    // Folded leaf springs join the moving bridge to the can on either side.
    for(const y of [-.88,.88]){
      const path=[[side*1.94,y],[side*2.37,y+.26],[side*2.74,y-.25],[side*3.05,y+.21],[side*3.63,y]];
      for(let i=1;i<path.length;i++){
        const [x0,y0]=path[i-1],[x1,y1]=path[i];
        const leaf=box(springs,Math.hypot(x1-x0,y1-y0)+.06,.12,.27,.04,steel,(x0+x1)/2,(y0+y1)/2,.13);
        leaf.rotation.z=Math.atan2(y1-y0,x1-x0);
      }
    }
    box(mover,1.07,3.44,1.00,.2,steel,side*1.47,0,.17);
  }
  box(mover,2.1,1.36,.80,.16,graphite,0,0,.18);
  box(mover,1.56,.75,.12,.08,violet,0,0,.63);
  disc(cap,3.96,.26,bright,0,0,1.52);
  disc(cap,3.55,.04,ti,0,0,1.66);
  painted(cap,256,c=>{c.fillStyle='#edebf4';c.textAlign='center';c.font='bold 66px monospace';c.fillText('LRA',128,143);c.font='23px monospace';c.fillText('AW / 08',128,183);},0,0,1.69,5.3);
  for(const g of [housing,mover,springs,cap])consolidate(g);
  const springMesh=springs.children[0];
  const positions=springMesh.geometry.attributes.position;
  const bent=positions.clone();
  for(let i=0;i<bent.count;i++){
    const weight=T.MathUtils.clamp((3.63-Math.abs(positions.getX(i)))/(3.63-1.94),0,1);
    bent.setY(i,positions.getY(i)+.23*weight);
  }
  springMesh.geometry.morphAttributes.position=[bent];
  springMesh.updateMorphTargets();
  return {layer,update(section,pulse,elapsed){
    cap.visible=!section;
    // Slow the carrier so its direction is readable; preserve the actual pulse envelope.
    const phase=section && pulse>=0 ? Math.sin(elapsed*.032) : 0;
    mover.position.y=.23*phase;
    springMesh.morphTargetInfluences[0]=phase;
  }};
}
export function buildWatch(){
  const root=group(),base=group(root),battery=group(root),pcb=group(root),array=group(root),display=group(root),bezel=group(root),back=group(root);
  // Articulated bracelet follows the wrist ellipse; individual rows share hinge lines.
  const ry=32,rz=22,zc=-21,entry=.77,count=29,step=(tau-2*entry)/count;
  for(let i=0;i<count;i++){
    const a=entry+(i+.5)*step, y=ry*Math.sin(a),z=zc+rz*Math.cos(a),dy=ry*Math.cos(a),dz=-rz*Math.sin(a),rotation=Math.atan2(dz,dy);
    const row=group(base);row.position.set(0,y,z);row.rotation.x=rotation;
    const len=Math.hypot(dy,dz)*step, width=17+2*Math.abs(Math.cos(a/2));
    for(const sign of [-1,1]){
      box(row,4.65,len-.19,2.9,.57,ti,sign*(width*.5-2.325),0,0);
      const pin=disc(row,.60,.12,brushed,sign*(width*.5+.03),0,0,18);pin.rotation.y=Math.PI/2;
    }
    box(row,width-9.4,len-.25,3.05,.45,brushed,0,.34,.0);
    box(row,width-12,len-.43,.45,.16,ti,0,.33,1.42);
  }
  for(const sign of [-1,1]){
    const end=box(base,19,8.3,3.5,.8,brushed,0,sign*20.15,-3.5);end.rotation.x=-sign*.45;
    for(const sx of [-1,1]){const lug=box(base,3.35,11.7,5.2,.9,ti,sx*10.6,sign*17.3,-2.3);lug.rotation.x=-sign*.30;}
  }
  ring(base,17.9,20.65,-5.05,4.1,ti,.8);
  ring(base,20.33,20.77,-1.8,-.90,graphite,.10);
  // The knurled crown with two flank guards sits at three o'clock.
  for(const sy of [-1,1])box(base,4.4,3.5,4.6,.9,ti,20.0,sy*4.9,-.35);
  const crown=group(base);crown.position.set(22,0,-.45);crown.rotation.y=Math.PI/2;
  disc(crown,2.85,3.3,brushed,0,0,0,48);disc(crown,2.55,.28,graphite,0,0,1.7);
  disc(crown,1.55,.32,violet,0,0,1.76);
  for(let i=0;i<28;i++){let a=i*tau/28;const rib=box(crown,.34,.33,2.8,.1,bright,Math.sin(a)*2.78,Math.cos(a)*2.78,0);rib.rotation.z=-a;}
  disc(back,19.88,1.15,brushed,0,0,-5.6);disc(back,15.5,.8,graphite,0,0,-6.43);disc(back,10.5,.35,ti,0,0,-6.96);
  for(let i=0;i<6;i++){let a=i*tau/6;screw(back,18*Math.cos(a),18*Math.sin(a),-6.20);}
  disc(battery,12.8,2.75,brushed,-5,0,-3.42);disc(battery,12.2,.24,ti,-5,0,-1.94);
  box(battery,5,3,.38,.4,violet,-5,11.2,-1.78);
  painted(battery,256,(c,n)=>{c.fillStyle='#494959';c.textAlign='center';c.font='600 36px monospace';c.fillText('Li-ion',n/2,115);c.font='20px monospace';c.fillText('AW / CELL',n/2,155);},-5,0,-1.78,17);
  disc(pcb,17.6,1.0,boardMat,0,0,-1.03);
  // Spring contacts meet the two LRA flex pads when the board is seated.
  for(const y of [-.25,.25])disc(pcb,.11,2.735,bright,17.05,y,-2.8975,16);
  for(let j=0;j<4;j++){const a=(j+.5)*tau/4;
    disc(pcb,1.13,.10,ti,15.8*Math.sin(a),15.8*Math.cos(a),-.46,24);
    disc(pcb,.68,.13,black,15.8*Math.sin(a),15.8*Math.cos(a),-.43,20);}
  painted(pcb,512,(c,n)=>{const mid=n/2;c.translate(mid,mid);c.beginPath();c.arc(0,0,246,0,tau);c.clip();
    for(let i=0;i<82;i++){const a=i*tau/82;c.save();c.rotate(a);c.strokeStyle=i%4?'#93909e':'#bcb1e9';c.lineWidth=i%3?1.3:2.5;
      const x=42+(i*17)%40,y=32+(i*29)%90;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+25);c.lineTo(x+17,y+42);c.lineTo(x+17,205+i%19);c.stroke();c.beginPath();c.arc(x+17,205+i%19,2.3,0,tau);c.stroke();c.restore();}
  },0,0,-.49,34.8);
  box(pcb,10.8,10.8,1.22,.4,graphite,0,0,.2);box(pcb,8.65,8.65,.32,.36,violet,0,0,.94);
  painted(pcb,256,(c,n)=>{c.textAlign='center';c.fillStyle='#f4f0ff';c.font='bold 78px Inter,sans-serif';c.fillText('AI',128,140);c.font='20px monospace';c.fillText('AURA • NPU',128,181);},0,0,1.12,8.3);
  for(let i=0;i<12;i++){const u=(i-5.5)*.77;for(const s of [-1,1]){box(pcb,.39,1.1,.24,.04,bright,u,s*5.52,-.26);box(pcb,1.1,.39,.24,.04,bright,s*5.52,u,-.26);}}
  for(let i=0;i<33;i++){const a=i*tau/33,r=10.5+(i%3)*1.9,x=r*Math.sin(a),y=r*Math.cos(a);const g=group(pcb);g.position.set(x,y,0);g.rotation.z=Math.round(a/(Math.PI/2))*Math.PI/2;
    box(g,2.2,1.03,.61,.12,black,0,0,-.13);for(const s of [-1,1])box(g,.4,1.05,.60,.08,ti,s*.9,0,-.13);}
  ring(array,15.3,18.35,1.18,1.63,violet);
  // Copper routing, test pads and capsule ports are visible in the array close-up.
  for(const r of [15.7,16.0,17.9])ring(array,r,r+.07,1.64,1.68,brushed,.01);
  for(let j=0;j<24;j++){const a=(j+.5)*tau/24,r=16.4;
    disc(array,.31,.07,ti,r*Math.sin(a),r*Math.cos(a),1.67,12);
    disc(array,.135,.09,graphite,r*Math.sin(a),r*Math.cos(a),1.68,10);}
  for(const [i,[x,y]] of microphones.entries()){
    const g=group(array);g.position.set(x,y,0);g.rotation.z=-i*Math.PI/2;
    box(g,5.0,3.75,.75,.46,graphite,0,0,1.92);
    box(g,4.35,3.12,.71,.4,bright,0,0,2.57);
    disc(g,.70,.07,black,0,.2,2.97,32);
    for(let j=-2;j<=2;j++)box(g,.065,.85,.04,.012,brushed,j*.19,.2,3.03);
    for(const q of [-1,1])box(g,.70,.105,.05,.025,graphite,q*1.36,-.77,2.96);
    painted(g,96,(c)=>{c.fillStyle='#474653';c.font='bold 30px monospace';c.textAlign='center';c.fillText('M0'+(i+1),48,44);},1.38,.25,2.96,1.05);
    for(let j=0;j<3;j++)box(g,.48,1.2,.10,.06,ti,(j-1)*1.19,-2.0,1.71);
  }
  disc(display,17.8,.72,graphite,0,0,3.55);
  const dial=makeDial();mesh(display,new T.CircleGeometry(17.58,144),new T.MeshBasicMaterial({map:dial.texture}),0,0,3.93);
  ring(bezel,17.62,21,4.0,5.78,brushed,.38);
  ring(bezel,17.62,18.02,5.53,5.85,bright,.08);ring(bezel,20.67,20.94,5.34,5.61,bright,.07);
  for(let i=0;i<60;i++){const a=i*tau/60,m=i%5===0;
    const b=box(bezel,m?.37:.17,m?1.19:.48,.065,.03,m?bright:black,19.5*Math.sin(a),19.5*Math.cos(a),5.80);b.rotation.z=-a;}
  const fasteners=[];
  for(let i=0;i<4;i++){
    const a=(i+.5)*Math.PI/2,x=19.28*Math.sin(a),y=19.28*Math.cos(a),g=group(root);
    disc(bezel,1.02,.07,black,x,y,5.82,24);
    screw(g,0,0,0,1.13,-a);disc(g,.49,3.15,graphite,0,0,-1.63,20);
    for(let k=0;k<7;k++)disc(g,.56,.13,brushed,0,0,-.42-k*.4,20);
    consolidate(g);fasteners.push({g,x,y});
  }
  const seals=[group(root),group(root)];
  ring(seals[0],17.72,18.12,0,.36,black,.095);
  ring(seals[1],17.08,17.32,0,.18,violet,.05);
  const guidePins=[];
  for(let i=0;i<4;i++){const a=(i+.5)*Math.PI/2,g=group(root);
    disc(g,.55,4.2,brushed,0,0,0,24);disc(g,.84,.48,bright,0,0,2.12,24);
    guidePins.push({g,x:16*Math.sin(a),y:16*Math.cos(a)});}
  function hardware(ex,focus){
    for(const {g,x,y} of fasteners){g.visible=focus<0||focus===6;g.position.set(x*(1+.32*ex),y*(1+.32*ex),5.99+75*ex);}
    seals.forEach((g,i)=>{g.visible=focus<0;g.position.z=i?2.91+45*ex:3.98+59*ex;});
    for(const {g,x,y} of guidePins){g.visible=focus<0;g.position.set(x*(1+.72*ex),y*(1+.72*ex),-2+32*ex);}
  }
  // Four dark acoustic inlets in the bezel, aligned to the capsule ports below.
  for(let i=0;i<4;i++){const a=i*Math.PI/2;const g=group(bezel);g.rotation.z=-a;
    box(g,3.25,1.14,.13,.45,black,0,19.1,5.84);
    for(let j=-2;j<=2;j++)box(g,.15,.71,.08,.04,brushed,j*.50,19.1,5.93);}
  const layers=[base,back,battery,pcb,array,display,bezel];
  layers.forEach(consolidate);
  const actuator=buildActuator(root);
  layers.push(actuator.layer);
  return {root,layers,dial,pcb,array,display,hardware,actuator};
}
