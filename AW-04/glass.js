// Displace the backdrop close to a rounded edge. Neutral red/green leaves the
// center untouched, so moving scenery keeps its position under the glass.
function lensMap(width, height, radius) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const rim = Math.min(12, radius);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x + .5 - width / 2, dy = y + .5 - height / 2;
      const qx = Math.abs(dx) - width / 2 + radius;
      const qy = Math.abs(dy) - height / 2 + radius;
      const cx = Math.max(qx, 0), cy = Math.max(qy, 0);
      const corner = Math.hypot(cx, cy);
      const depth = radius - corner - Math.min(Math.max(qx, qy), 0);
      const bend = 120 * Math.pow(1 - Math.min(1, Math.max(0, depth) / rim), 2);
      const nx = corner ? cx / corner : Number(qx >= qy);
      const ny = corner ? cy / corner : Number(qy > qx);
      const i = (y * width + x) * 4;
      image.data[i] = 128 - Math.sign(dx) * nx * bend;
      image.data[i+1] = 128 - Math.sign(dy) * ny * bend;
      image.data[i+3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function bindGlass(panels) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('width','0');
  svg.setAttribute('height','0');
  svg.setAttribute('aria-hidden','true');
  svg.style.position = 'absolute';
  const defs = document.createElementNS(ns,'defs');
  svg.append(defs);
  document.body.prepend(svg);
  const maps = new Map();
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) {
      const panel = entry.target;
      const width = panel.offsetWidth, height = panel.offsetHeight;
      if (!width || !height) continue;
      const map = maps.get(panel);
      map.setAttribute('width',width);
      map.setAttribute('height',height);
      map.setAttribute('href',lensMap(width,height,parseFloat(getComputedStyle(panel).borderRadius)));
    }
  });
  panels.forEach((panel,index) => {
    const filter = document.createElementNS(ns,'filter');
    filter.id = 'panel-lens-' + index;
    filter.setAttribute('color-interpolation-filters','sRGB');
    for (const [key,value] of Object.entries({x:'0',y:'0',width:'100%',height:'100%'})) filter.setAttribute(key,value);
    const map = document.createElementNS(ns,'feImage');
    map.setAttribute('result','lens');
    map.setAttribute('preserveAspectRatio','none');
    const displace = document.createElementNS(ns,'feDisplacementMap');
    for (const [key,value] of Object.entries({in:'SourceGraphic',in2:'lens',scale:'22',xChannelSelector:'R',yChannelSelector:'G'})) displace.setAttribute(key,value);
    filter.append(map,displace);
    defs.append(filter);
    maps.set(panel,map);
    resize.observe(panel);
    panel.style.setProperty('--lens','url("#'+filter.id+'")');
    panel.addEventListener('pointermove',event => {
      const box = panel.getBoundingClientRect();
      panel.style.setProperty('--shine-x',(event.clientX-box.left)+'px');
      panel.style.setProperty('--shine-y',(event.clientY-box.top)+'px');
    },{passive:true});
    panel.addEventListener('pointerleave',() => {
      panel.style.removeProperty('--shine-x');
      panel.style.removeProperty('--shine-y');
    });
  });
}
