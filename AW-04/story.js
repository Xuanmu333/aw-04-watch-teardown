import tl from './timeline.json';
export const chapters=[
  ['总成','OVERVIEW','声向仪','四枚麦克风记录声音抵达的先后。表盘用紫色扇区标出声音来自哪个方向。'],
  ['分层','EXPLODED VIEW','沿轴拆解','八组部件展开。振动器从电池旁侧向移出，其底面固定在贴腕底盖上。'],
  ['拾音','MICROPHONE ARRAY','四点拾音','同一声波先后抵达四枚麦克风。比较相对到达时间，便能估计平面方位。'],
  ['识别','ON-DEVICE AI','辨认声音','端侧 AI 识别的模拟过程：将输入频带与声音模板比对，选出最接近的类别。'],
  ['表盘','DIRECTIONAL DIAL','方向入表','表盘显示声音名称，紫色扇区指向声源。注意表壳和表带随声音节奏一起振动。'],
  ['振动器','LINEAR RESONANT ACTUATOR','振动器剖视','移去顶盖，可见铜色线圈和银色动子。动子按所选节拍往复，振感经底盖传到手腕。']
];
export const parts=['表壳与链带','底盖','电池','AI 计算板','四麦阵列','显示屏','表圈','振动器'];
const b=tl.beats;
export function tour(t){
  const stage=t>=3.15&&t<b.open?0:t<b.open?1:t<b.array?1:t<b.processor?2:t<b.dial?3:t<b.alarm?4:t<b.haptic?0:5;
  const src=t<b.bird?0:t<b.alarm?1:2;
  let explode=0;
  if(stage===1){const v=t<b.open?Math.min(1,Math.max(0,(t-1.55)/1.60)):Math.min(1,(t-b.open)/1.9);
    const smooth=v*v*(3-2*v);explode=t<b.open?1-smooth:smooth;}
  return {stage,src,explode};
}
export {tl};
