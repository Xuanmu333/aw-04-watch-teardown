import { microphones, radius, speedOfSound } from './acoustics.js';
import { AI_START, OUTPUT_START, receiveTime, waveTimeUs } from './signal-timing.js';
import './mic-paths.css';

const svgNS = 'http://www.w3.org/2000/svg';
// The 52 mm watch artwork occupies 31% of the 200-unit field.
const watchUnitsPerMm = 200 * .31 / 52;
const capsules = microphones.map(([x,y]) => [x * watchUnitsPerMm, -y * watchUnitsPerMm]);
const aperture = (radius + 5) * watchUnitsPerMm;
const unitsPerUs = speedOfSound * .001 * watchUnitsPerMm;
let instance = 0;

function svgElement(tag, attributes, parent) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key,value] of Object.entries(attributes)) element.setAttribute(key,value);
  parent.append(element);
  return element;
}

// The emitter lies on the local +X axis. Only construct the circular arc inside
// the watch aperture, even when the full wave is thousands of watch widths wide.
function waveArc(distance, r) {
  if (r <= 0) return '';
  if (distance + r <= aperture) {
    return `M${distance-r} 0a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
  }
  if (Math.abs(distance - r) >= aperture) return '';
  const x = ((distance-r)*(distance+r) + aperture*aperture) / (2*distance);
  const y = Math.sqrt(Math.max(0, (aperture-x)*(aperture+x)));
  return `M${x} ${y}A${r} ${r} 0 ${x > distance ? 1 : 0} 1 ${x} ${-y}`;
}

export function createMicPaths(plane) {
  const svg = svgElement('svg', {
    class:'sl-mic-paths', viewBox:'-100 -100 200 200', 'aria-hidden':'true', focusable:'false'
  }, plane);
  const clipId = 'sl-watch-aperture-' + ++instance;
  const clip = svgElement('clipPath', {id:clipId}, svgElement('defs', {}, svg));
  svgElement('circle', {r:aperture}, clip);
  const wave = svgElement('g', {'data-watch-wave':'', 'clip-path':`url(#${clipId})`}, svg);
  const crests = svgElement('g', {}, wave);
  const trails = [7.5, 3.5].map(offset => ({
    offset, path:svgElement('path', {class:'sl-watch-trail'}, crests)
  }));
  const band = svgElement('path', {class:'sl-watch-pressure'}, crests);
  const front = svgElement('path', {'data-watch-front':''}, crests);
  const handoff = svgElement('g', {'data-mic-handoff':'hidden'}, svg);
  const markers = svgElement('g', {}, svg);
  const channels = capsules.map(([x,y],i) => {
    const name = 'M0'+(i+1);
    const chipX = 7 * Math.sign(x), chipY = 7 * Math.sign(y);
    svgElement('line', {class:'sl-mic-bus', x1:x, y1:y, x2:chipX, y2:chipY}, handoff);
    const busPulse = svgElement('circle', {class:'sl-mic-bus-pulse', r:1.7}, handoff);
    const marker = svgElement('g', {'data-mic':name, transform:'translate('+x+' '+y+')'}, markers);
    const leader = svgElement('line', {class:'sl-mic-leader'}, marker);
    const ring = svgElement('circle', {class:'sl-mic-ring', r:3.4}, marker);
    svgElement('circle', {class:'sl-mic-pin', r:2.15}, marker);
    const label = svgElement('text', {class:'sl-mic-label', 'text-anchor':'middle', dy:'.34em'}, marker);
    label.textContent = name;
    return {x, y, marker, leader, ring, label, chipX, chipY, busPulse, arrival:0};
  });
  const chip = svgElement('g', {class:'sl-mic-chip'}, handoff);
  svgElement('path', {class:'sl-mic-chip-pins',
    d:'M-4 -9v3 M0 -9v3 M4 -9v3 M-4 9v-3 M0 9v-3 M4 9v-3 M-9 -4h3 M-9 0h3 M-9 4h3 M9 -4h-3 M9 0h-3 M9 4h-3'
  }, chip);
  svgElement('rect', {x:-7,y:-7,width:14,height:14,rx:1.7}, chip);
  const chipText = svgElement('text', {'text-anchor':'middle',dy:'.34em'}, chip);
  chipText.textContent = 'AI';
  let distance = 0, arrivalsUs, lastArrival = 0, staticFrameDrawn = false;

  function layoutLabels() {
    const field = svg.getBoundingClientRect();
    if (!field.width) return;
    const textSize = channels[0].label.getBoundingClientRect();
    const centerX = field.left + field.width / 2, centerY = field.top + field.height / 2;
    const scale = field.width / 200;
    const receivers = [[0,0,9], ...capsules.map(([x,y])=>[x,y,3.4])];
    const coversReceiver = rect => receivers.some(([x,y,r]) =>
      rect.left < centerX+(x+r)*scale && rect.right > centerX+(x-r)*scale &&
      rect.top < centerY+(y+r)*scale && rect.bottom > centerY+(y-r)*scale);
    const obstacles = [];
    for (const node of plane.querySelectorAll('.sl-node:not([hidden])')) {
      const rect = node.getBoundingClientRect();
      const placeLeft = rect.left + rect.width/2 < centerX;
      node.classList.toggle('sl-over-chip', coversReceiver(rect));
      const caption = node.querySelector('.sl-node-label');
      caption.style.removeProperty('--caption-shift');
      const captionRect = caption.getBoundingClientRect();
      if (coversReceiver(captionRect)) {
        const clearance = aperture*scale + 3;
        const shift = placeLeft ? centerX-clearance-captionRect.right : centerX+clearance-captionRect.left;
        caption.style.setProperty('--caption-shift',shift+'px');
      }
      obstacles.push(rect,caption.getBoundingClientRect());
    }

    for (const {x,y,leader,label} of channels) {
      // Keep callouts clear of the draggable buttons, their captions and one another.
      const dx = Math.sign(x), dy = Math.sign(y);
      let labelX, labelY;
      for (const offset of [0,-18,18,-32,32]) {
        labelX = dx * 16 - dy * offset;
        labelY = dy * 13 + dx * offset;
        const cx = field.left + (100 + x + labelX) * field.width / 200;
        const cy = field.top + (100 + y + labelY) * field.height / 200;
        const bounds = {left:cx-textSize.width/2-2, right:cx+textSize.width/2+2,
          top:cy-textSize.height/2-2, bottom:cy+textSize.height/2+2};
        if (obstacles.every(r => bounds.left >= r.right || bounds.right <= r.left ||
            bounds.top >= r.bottom || bounds.bottom <= r.top)) {
          obstacles.push(bounds);
          break;
        }
      }
      leader.setAttribute('x2',labelX * .69);
      leader.setAttribute('y2',labelY * .69);
      label.setAttribute('x',labelX);
      label.setAttribute('y',labelY);
    }
  }
  new ResizeObserver(layoutLabels).observe(plane);

  function update(sources, model, selectedId) {
    const source = sources.find(s => s.id === selectedId);
    const signal = model.sources.find(s => s.id === selectedId);
    svg.style.display = source && signal ? '' : 'none';
    arrivalsUs = signal?.arrivalsUs;
    staticFrameDrawn = false;
    if (!source || !signal) return;
    const originX = source.x * 1000 * watchUnitsPerMm;
    const originY = -source.y * 1000 * watchUnitsPerMm;
    distance = Math.hypot(originX, originY);
    wave.dataset.originX = originX;
    wave.dataset.originY = originY;
    crests.setAttribute('transform',`rotate(${Math.atan2(originY,originX)*180/Math.PI})`);
    channels.forEach((channel,i) => {
      channel.arrival = receiveTime(arrivalsUs,i);
    });
    lastArrival = Math.max(...channels.map(channel => channel.arrival));
    layoutLabels();
  }

  function render(elapsedSeconds, reducedMotion) {
    if (!arrivalsUs || (reducedMotion && staticFrameDrawn)) return;
    staticFrameDrawn = reducedMotion;
    const us = reducedMotion ? Math.max(...arrivalsUs) : waveTimeUs(elapsedSeconds,arrivalsUs);
    const r = us * unitsPerUs;
    const edge = waveArc(distance,r);
    wave.dataset.radius = r;
    wave.dataset.state = reducedMotion ? 'static' : edge ? 'crossing' : r > distance ? 'passed' : 'ahead';
    front.setAttribute('d',edge);
    band.setAttribute('d',waveArc(distance,r-1));
    for (const {offset,path} of trails) path.setAttribute('d',waveArc(distance,r-offset));
    const handoffVisible = !reducedMotion && elapsedSeconds >= lastArrival && elapsedSeconds < OUTPUT_START;
    const transferring = handoffVisible && elapsedSeconds < AI_START;
    const state = handoffVisible ? (transferring ? 'transfer' : 'process') : 'hidden';
    if (handoff.dataset.micHandoff !== state) handoff.dataset.micHandoff = state;
    const transferProgress = transferring ? (elapsedSeconds - lastArrival) / (AI_START - lastArrival) : 0;
    for (const {x,y,marker,ring,arrival,chipX,chipY,busPulse} of channels) {
      const age = elapsedSeconds - arrival;
      const received = reducedMotion || age >= 0;
      marker.setAttribute('data-received',String(received));
      const flash = !reducedMotion && age >= 0 && age < .45;
      ring.style.opacity = flash ? 1 - age / .45 : 0;
      if (flash) ring.setAttribute('r',3.4 + 5 * age / .45);
      if (transferring) {
        busPulse.setAttribute('cx',x + (chipX - x) * transferProgress);
        busPulse.setAttribute('cy',y + (chipY - y) * transferProgress);
      }
    }
  }

  return {update, render};
}
