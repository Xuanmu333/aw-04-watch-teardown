import tl from './timeline.json';
export const chapters=[
  ['总成','OVERVIEW','声向仪','四枚麦克风记录声音抵达的先后。表盘用紫色扇区标出声音来自哪个方向。'],
  ['分层','EXPLODED VIEW','沿轴拆解','沿表盘法线分开展示七组部件，查看显示屏下方的阵列、计算板与电池。'],
  ['拾音','MICROPHONE ARRAY','四点拾音','同一声波先后抵达四枚麦克风。比较相对到达时间，便能估计平面方位。'],
  ['识别','ON-DEVICE AI','辨认声音','端侧 AI 识别的模拟过程：将输入频带与声音模板比对，选出最接近的类别。'],
  ['表盘','DIRECTIONAL DIAL','方向入表','以十二点为 0°，顺时针读取方位。扇形中心指向声源，内圈显示声音类别。']
];
export const parts=['表壳与链带','底盖','电池','AI 计算板','四麦阵列','显示屏','表圈'];
const b=tl.beats;
export function tour(t){
  const stage=t>=3.15&&t<b.open?0:t<b.open?1:t<b.array?1:t<b.processor?2:t<b.dial?3:4;
  const src=t<b.bird?0:t<b.alarm?1:2;
  let explode=0;
  if(stage===1){const v=t<b.open?Math.min(1,Math.max(0,(t-1.55)/1.60)):Math.min(1,(t-b.open)/1.9);
    const smooth=v*v*(3-2*v);explode=t<b.open?1-smooth:smooth;}
  return {stage,src,explode};
}
export {tl};
