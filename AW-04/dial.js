import * as T from 'three';
export function makeDial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=640;
  const c=canvas.getContext('2d'), texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  function line(x,y,xx,yy,color,w){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
  function arc(r,a,b,color,w){c.beginPath();c.arc(0,0,r,a,b);c.strokeStyle=color;c.lineWidth=w;c.stroke();}
  function txt(str,x,y,size,weight,color,mono=false,maxWidth){c.fillStyle=color;c.font=weight+' '+size+'px '+(mono?'"JetBrains Mono", monospace':'Inter, "PingFang SC", sans-serif');c.textAlign='center';if(maxWidth)c.fillText(str,x,y,maxWidth);else c.fillText(str,x,y);}
  function update(s){
    c.setTransform(1,0,0,1,320,320);c.fillStyle='#131421';c.fillRect(-320,-320,640,640);
    const a=(s.angle-90)*Math.PI/180, spread=Math.PI/9;
    for(const r of [96,150,206,252,289])arc(r,0,2*Math.PI,'#34354a',1.5);
    for(let i=0;i<60;i++){const major=i%5===0;c.save();c.rotate(i*Math.PI/30);line(0,-299,0,major?-278:-290,major?'#d6d6e5':'#77798e',major?4:2);c.restore();}
    if(s.hasBearing!==false){
      const gradient=c.createRadialGradient(0,0,42,0,0,278);gradient.addColorStop(0,'rgba(129,102,246,0.03)');gradient.addColorStop(1,'rgba(134,109,247,0.82)');
      c.beginPath();c.moveTo(0,0);c.arc(0,0,272,a-spread,a+spread);c.closePath();c.fillStyle=gradient;c.fill();arc(271,a-spread,a+spread,'#b7a5ff',8);
      const ray=c.createRadialGradient(0,0,72,0,0,128);
      ray.addColorStop(0,'rgba(173,157,255,0)');ray.addColorStop(1,'#ad9dff');
      line(0,0,Math.cos(a)*268,Math.sin(a)*268,ray,2);c.beginPath();c.arc(Math.cos(a)*251,Math.sin(a)*251,6,0,7);c.fillStyle='#f5edff';c.fill();
    }
    txt('A U R A   /   0 4',0,-180,21,650,'#c9c9dd');
    txt('10:08',0,-87,63,550,'#f2f1fb',true);
    txt(s.hasBearing===false?'—':s.degree+'°',0,29,69,600,'#d4c7ff',true);
    txt(s.detected.name,0,68,29,600,'#f4f1ff',false,340);
    texture.needsUpdate=true;
  }
  return {texture,update};
}
