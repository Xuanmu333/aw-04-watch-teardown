import tl from './timeline.json';
export const chapters=[
  ['Assembled','OVERVIEW','AW-04','Four microphones compare sound arrival times. The purple sector indicates the source direction.'],
  ['Exploded','EXPLODED VIEW','Axial teardown','Eight assemblies separate. The vibrator moves out beside the battery and mounts to the wrist-facing back cover.'],
  ['Microphones','MICROPHONE ARRAY','Four-point capture','Arrival-time differences across four microphones estimate the sound source bearing.'],
  ['AI','ON-DEVICE AI','Sound classification','On-device AI simulation compares the input spectrum with sound templates to find the closest match.'],
  ['Dial','DIRECTIONAL DIAL','Source direction','The dial shows the sound type and direction. Select Test to preview its assigned vibration rhythm.'],
  ['Vibrator','LINEAR RESONANT VIBRATOR','Vibrator section','With the cap removed, the coil and moving mass are visible. Select Test to preview how vibration reaches the wrist.']
];
export const parts=['Case & bracelet','Back cover','Battery','AI board','Mic array','Display','Bezel','Vibrator'];
const b=tl.beats;
export function tour(t){
  const stage=t<b.open?0:t<b.array?1:t<b.processor?2:t<b.dial?3:t<b.alarm?4:t<b.haptic?0:5;
  const src=t<b.horn?0:t<b.alarm?1:2;
  let explode=0;
  if(stage===1){
    const v=Math.min(1,(t-b.open)/1.9);
    explode=v*v*(3-2*v);
  }
  return {stage,src,explode};
}
export {tl};
