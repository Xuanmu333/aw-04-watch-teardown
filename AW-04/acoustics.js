// Concept dimensions in millimetres. +Y is twelve o'clock, +X is three.
export const radius = 17;
export const microphones = [[0,radius],[radius,0],[0,-radius],[-radius,0]];
export const sounds = [
  {name:'门铃', en:'DOORBELL', angle:48, bins:[.03,.10,.93,.82,.18,.07,.02,.01]},
  {name:'鸟鸣', en:'BIRDSONG', angle:302, bins:[.01,.02,.03,.07,.20,.77,.98,.57]},
  {name:'警报', en:'ALARM', angle:132, bins:[.02,.73,.22,.10,.89,.12,.45,.08]}
];
export function acousticState(source, bearing, t) {
  const rad = bearing*Math.PI/180;
  const arrivals = microphones.map(([x,y])=>-(x*Math.sin(rad)+y*Math.cos(rad))*1000/343);
  const first = Math.min(...arrivals);
  const delays = arrivals.map(v=>v-first);
  const angle = (360+Math.atan2(delays[3]-delays[1], delays[2]-delays[0])*180/Math.PI)%360;
  const spectrum = sounds[source].bins.map((v,i)=>v*(.86+.14*Math.sin(t*4+i*1.7)));
  const scores = sounds.map(({bins})=>bins.reduce((s,v,i)=>s+v*spectrum[i],0)/Math.hypot(...bins));
  const detected = sounds[scores.indexOf(Math.max(...scores))];
  return {delays, angle, degree:String(Math.round(angle)%360).padStart(3,'0'), spectrum, detected};
}
