// Adapted from the supplied Originkit Tunnel Wrap. The atlas, seeded cylinder,
// wrapping depth and per-glyph palette follow the original transparent scene.
import * as T from 'three';

function mulberry32(a) {
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Binary only. The Glyphs enum (Binary / Hex / Katakana) is gone, so the
// fragment shader's rowOffset is a constant 0 and the hex and katakana row
// bands were unreachable — the strings that filled them went with the control.
const ATLAS_SIZE = 1024
const ATLAS_COLS = 16
const ATLAS_BINARY = "01"

function buildAtlasCanvas(doc) {
    const c = doc.createElement("canvas")
    c.width = ATLAS_SIZE
    c.height = ATLAS_SIZE
    const ctx = c.getContext("2d")
    if (!ctx) return c
    const charSize = ATLAS_SIZE / ATLAS_COLS
    ctx.font = `bold ${charSize * 0.6}px monospace`
    ctx.fillStyle = "white"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const rnd = mulberry32(0x51a7ee)
    const total = ATLAS_COLS * ATLAS_COLS
    for (let i = 0; i < total; i++) {
        const col = i % ATLAS_COLS
        const row = Math.floor(i / ATLAS_COLS)
        const x = col * charSize + charSize / 2
        const y = row * charSize + charSize / 2
        const char = ATLAS_BINARY[Math.floor(rnd() * ATLAS_BINARY.length)]
        ctx.fillText(char, x, y)
    }
    return c
}

// Four hashes per point: the three the CPU loop drew for angle / radius / z,
// plus aRandom, which drives the glyph pick and the flicker.
function buildSeeds(n, seed) {
    const a = new Float32Array(n * 4)
    const rnd = mulberry32(seed)
    for (let i = 0; i < n; i++) {
        a[i * 4] = rnd()
        a[i * 4 + 1] = rnd()
        a[i * 4 + 2] = rnd()
        a[i * 4 + 3] = rnd()
    }
    return a
}


const vertexShader = `
precision highp float;
attribute vec4 position;
uniform mat4 projectionMatrix;
uniform float uTravel;
uniform float uPointScale;
uniform vec2 uCurve;
varying float vRandom;
void main(){
    vRandom = position.w;
    float angle = position.x * 6.2831853;
    float radius = 22.0 + (position.y - 0.5) * 10.0;
    float z = mod(-position.z * 105.0 + uTravel, 105.0) - 105.0;
    vec3 pos = vec3(cos(angle) * radius, sin(angle) * radius, z);
    pos.xy += uCurve * pow(abs(z / 105.0), 2.0);
    gl_Position = projectionMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(uPointScale / max(-z, 1.0), 1.0, 64.0);
}
`;

const fragmentShader = `
precision highp float;
uniform sampler2D uTex;
uniform float uCols;
uniform float uTime;
uniform vec3 uSlate;
uniform vec3 uViolet;
varying float vRandom;
void main() {
    float charTick = floor(uTime * 10.0 + vRandom * 10.0);

    float charIndex = mod(charTick, 10.0) + floor(vRandom * 10.0);

    vec2 uv = gl_PointCoord;
    float charSize = 1.0 / uCols;
    float col = mod(charIndex, uCols);
    float row = floor(charIndex / uCols);
    vec2 charUV = vec2((col + uv.x) * charSize, 1.0 - ((row + 1.0 - uv.y) * charSize));

    vec4 tex = texture2D(uTex, charUV);
    if (tex.a < 0.08) discard;

    float cMix = fract(sin(vRandom * 91.7 + 3.1) * 43758.5453);

    vec3 color = mix(uSlate, uViolet, cMix);

    float flicker = sin(uTime * 20.0 + vRandom * 100.0) * 0.5 + 0.5;
    color += flicker * 0.025;

    gl_FragColor = vec4(color, tex.a);
}
`;

export function createTunnel(canvas, duration) {
    let renderer;
    try {
        renderer = new T.WebGLRenderer({canvas, alpha:true, antialias:false, depth:false});
    } catch {
        return () => {}; // The lavender surface also works without a background context.
    }
    renderer.setClearColor(0, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(70, 1, .1, 200);
    const texture = new T.CanvasTexture(buildAtlasCanvas(document));
    texture.generateMipmaps = true;
    texture.minFilter = T.LinearMipmapLinearFilter;
    const uniforms = {
        uTex:{value:texture}, uCols:{value:ATLAS_COLS}, uTime:{value:0},
        uTravel:{value:0}, uPointScale:{value:0}, uCurve:{value:new T.Vector2()},
        uSlate:{value:new T.Vector3(.36,.39,.53)},
        uViolet:{value:new T.Vector3(.49,.36,.70)},
    };
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(buildSeeds(3600, 0x5eed01), 4));
    const particles = new T.Points(geometry, new T.RawShaderMaterial({
        vertexShader, fragmentShader, uniforms, transparent:true, depthTest:false, depthWrite:false,
    }));
    particles.frustumCulled = false;
    scene.add(particles);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const aim = new T.Vector2();
    window.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || event.buttons || reducedMotion.matches) return;
        aim.set(3 * (1 - 2 * event.clientX / innerWidth), 3 * (2 * event.clientY / innerHeight - 1));
    }, {passive:true});
    let width = 0, height = 0, lastTick = -1;
    return function draw(seconds) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        const tick = reducedMotion.matches ? 0 : Math.floor(seconds * 30);
        if (w === width && h === height && tick === lastTick) return;
        if (w !== width || h !== height) {
            width = w; height = h;
            const ratio = Math.min(devicePixelRatio, 1.5);
            renderer.setPixelRatio(ratio);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            geometry.setDrawRange(0, w < 760 ? 1550 : 3600);
            uniforms.uPointScale.value = 510 * ratio * Math.sqrt(w*h/(1920*1080));
        }
        if (reducedMotion.matches) uniforms.uCurve.value.set(0, 0);
        else uniforms.uCurve.value.lerp(aim, 1 - Math.exp(-.1 * Math.max(1, tick-lastTick)));
        lastTick = tick;
        uniforms.uTravel.value = 105 * tick / (30 * duration);
        uniforms.uTime.value = tick / 120;
        renderer.render(scene, camera);
    };
}
