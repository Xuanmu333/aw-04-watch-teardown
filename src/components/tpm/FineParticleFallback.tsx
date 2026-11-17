"use client";
import {useEffect, useRef} from "react";

// Seeded full-width scatter with a slow, position-dependent travelling wave.
const TAU = 2*Math.PI, MAX_POINTS = 8500;
function mulberry32(a: number) {
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function poissonDisk(
    width: number, height: number,
    minD: number,
    maxD: number,
    tries: number,
    rand: () => number
) {
    const cell = minD / Math.SQRT2
    const gw = Math.ceil(width / cell)
    const gh = Math.ceil(height / cell)
    const grid = new Int32Array(gw * gh).fill(-1)
    const px: number[] = []
    const py: number[] = []
    const active: number[] = []
    const minD2 = minD * minD

    const add = (x: number, y: number) => {
        const i = px.length
        px.push(x)
        py.push(y)
        grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = i
        active.push(i)
    }

    add(rand() * width, rand() * height)

    while (active.length > 0 && px.length < MAX_POINTS) {
        const ai = (rand() * active.length) | 0
        const idx = active[ai]
        let placed = false
        for (let t = 0; t < tries; t++) {
            const ang = rand() * TAU
            const r = minD + (maxD - minD) * rand()
            const nx = px[idx] + Math.cos(ang) * r
            const ny = py[idx] + Math.sin(ang) * r
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const cx = (nx / cell) | 0
            const cy = (ny / cell) | 0
            let ok = true
            for (let j = Math.max(0, cy - 2); j <= Math.min(gh - 1, cy + 2) && ok; j++) {
                for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i++) {
                    const q = grid[j * gw + i]
                    if (q < 0) continue
                    const dx = px[q] - nx
                    const dy = py[q] - ny
                    if (dx * dx + dy * dy < minD2) {
                        ok = false
                        break
                    }
                }
            }
            if (ok) {
                add(nx, ny)
                placed = true
                break
            }
        }
        if (!placed) {
            active[ai] = active[active.length - 1]
            active.pop()
        }
    }
    return { px, py, count: px.length }
}

export default function FineParticleFallback(){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current!, host=canvas.parentElement!, ctx=canvas.getContext("2d");
    if(!ctx)return;
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    let w=0,h=0,dpr=1,frame=0,previous=0,time=0,visible=true;
    let px:number[]=[],py:number[]=[];
    function draw(dt:number){
      if(!ctx||!w||!h)return;
      time+=dt;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="rgba(113,139,142,.50)";
      ctx.beginPath();
      for(let i=0;i<px.length;i++){
        const x=px[i]+5*Math.sin(py[i]*.014+px[i]*.004+time*.29);
        const y=py[i]+6*Math.cos(px[i]*.011-py[i]*.005-time*.24);
        ctx.moveTo(x+1.075,y);ctx.arc(x,y,1.075,0,TAU);
      }
      ctx.fill();
    }
    function tick(now:number){
      frame=requestAnimationFrame(tick);
      if(previous&&now-previous<1000/32)return;
      draw(Math.min(.08,(now-previous)/1000)||1/30);previous=now;
    }
    function schedule(){
      cancelAnimationFrame(frame);previous=0;
      if(!visible||document.hidden)return;
      if(motion.matches)draw(0);else frame=requestAnimationFrame(tick);
    }
    function resize(){
      const rect=canvas.getBoundingClientRect();
      const cw=Math.round(rect.width),ch=Math.round(rect.height);
      if(!cw||!ch)return;
      const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(5500000/(cw*ch)));
      if(w===cw&&h===ch&&ratio===dpr)return;
      w=cw;h=ch;dpr=ratio;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      ctx!.setTransform(dpr,0,0,dpr,0,0);
      const spacing=Math.max(24,Math.sqrt(w*h/10500));
      ({px,py}=poissonDisk(w,h,spacing,spacing*1.65,16,mulberry32(0x9e3779b9)));
      draw(.05);schedule();
    }
    const ro=new ResizeObserver(resize);ro.observe(host);resize();
    const io=new IntersectionObserver(([v])=>{visible=v.isIntersecting;schedule();});io.observe(host);
    document.addEventListener("visibilitychange",schedule);motion.addEventListener("change",schedule);
    return ()=>{cancelAnimationFrame(frame);ro.disconnect();io.disconnect();document.removeEventListener("visibilitychange",schedule);motion.removeEventListener("change",schedule);};
  },[]);
  return <canvas ref={ref} className="tpm-ring-field" aria-hidden="true"/>;
}
