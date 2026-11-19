import { speedOfSound } from './acoustics.js';
import { waveTimeUs } from './signal-timing.js';
import './sound-waves.css';

// The spacing is schematic so individual pressure crests are legible at room scale.
const packetSpacing = 8; // metres between successive packets
const crestOffsets = [0, .48, 1.08];
const compressionWidth = .24;

function element(tag, attributes, parent) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (parent) parent.append(node);
  return node;
}

export function createSoundWaves(plane, axisLimit) {
  const unitsPerMetre = 100 / axisLimit;
  const svg = element('svg', {class:'sl-sound-waves', 'aria-hidden':'true', focusable:'false'});
  plane.before(svg);
  const emitters = new Map();
  let arrivalsUs, staticFrameDrawn = false;
  let halfWidth = axisLimit, halfHeight = axisLimit;

  function sizeField() {
    const bounds = svg.getBoundingClientRect(), room = plane.getBoundingClientRect();
    if (!room.width) return;
    const unitsPerPixel = 200 / room.width;
    const width = bounds.width * unitsPerPixel, height = bounds.height * unitsPerPixel;
    svg.setAttribute('viewBox', [-width / 2, -height / 2, width, height].join(' '));
    halfWidth = width / (2 * unitsPerMetre);
    halfHeight = height / (2 * unitsPerMetre);
    staticFrameDrawn = false;
  }
  new ResizeObserver(sizeField).observe(plane);
  sizeField();

  function makePacket(group) {
    const packet = element('g', {}, group);
    const band = element('circle', {class:'sl-wave-compression', 'stroke-width':compressionWidth * unitsPerMetre}, packet);
    const crests = crestOffsets.map((_, i) => element('circle', {'data-wave-crest':i}, packet));
    return {packet, band, crests};
  }

  function update(sources, model, selectedId) {
    arrivalsUs = model.sources.find(signal => signal.id === selectedId)?.arrivalsUs;
    svg.style.display = arrivalsUs ? '' : 'none';
    for (const [id, emitter] of emitters) {
      if (sources.some(source => source.id === id)) continue;
      emitter.group.remove();
      emitters.delete(id);
    }
    for (const source of sources) {
      let emitter = emitters.get(source.id);
      if (!emitter) {
        emitter = {group:element('g', {'data-wave-source':source.id}, svg), packets:[]};
        emitters.set(source.id, emitter);
      }
      emitter.x = source.x;
      emitter.y = source.y;
      emitter.group.setAttribute('transform', 'translate('+source.x * unitsPerMetre+' '+(-source.y * unitsPerMetre)+')');
      emitter.group.dataset.waveSelected = String(source.id === selectedId);
    }
    const selected = emitters.get(selectedId);
    if (selected) svg.append(selected.group);
    staticFrameDrawn = false;
  }

  function render(elapsed, reducedMotion) {
    if (!arrivalsUs || (reducedMotion && staticFrameDrawn)) return;
    const physicalUs = reducedMotion ? Math.max(...arrivalsUs) : waveTimeUs(elapsed, arrivalsUs);
    const travel = physicalUs * speedOfSound / 1e6;
    staticFrameDrawn = reducedMotion;
    for (const {group, packets, x, y} of emitters.values()) {
      const farCorner = Math.hypot(halfWidth + Math.abs(x), halfHeight + Math.abs(y));
      const first = Math.max(0, Math.ceil((travel - farCorner - crestOffsets[2]) / packetSpacing));
      const last = Math.floor(travel / packetSpacing);
      const count = last - first + 1;
      while (packets.length < count) packets.push(makePacket(group));
      packets.forEach(({packet, band, crests}, slot) => {
        packet.style.display = slot < count ? '' : 'none';
        if (slot >= count) return;
        const emission = first + slot;
        const radius = travel - emission * packetSpacing;
        packet.dataset.wavePacket = String(emission);
        packet.style.opacity = 1 / (1 + .045 * radius);
        // The compression band stays inside the measured leading edge.
        band.setAttribute('r', Math.max(0, radius - compressionWidth / 2) * unitsPerMetre);
        crests.forEach((crest, i) => crest.setAttribute('r', Math.max(0, radius - crestOffsets[i]) * unitsPerMetre));
      });
    }
  }

  return {update, render};
}
