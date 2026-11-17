"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mountRingField, preset } from "./cursor-ring-renderer";
import FineParticleFallback from "./FineParticleFallback";

const motionQuery = "(prefers-reduced-motion: reduce)";
const reduced = () => window.matchMedia(motionQuery).matches;
function watchMotion(notify: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

export default function CursorRingField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const staticField = useSyncExternalStore(watchMotion, reduced, () => true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const node = canvas.current;
    if (!node || staticField || unavailable) return;
    let active = true;
    const fallback = () => queueMicrotask(() => { if (active) setUnavailable(true); });
    let dispose: (() => void) | undefined;
    try {
      dispose = mountRingField(node);
      if (!dispose) fallback();
    } catch {
      fallback();
    }
    node.addEventListener("webglcontextlost", fallback);
    return () => {
      active = false;
      node.removeEventListener("webglcontextlost", fallback);
      dispose?.();
    };
  }, [staticField, unavailable]);
  if (staticField || unavailable) return <FineParticleFallback />;
  return <canvas ref={canvas} data-renderer="webgl" className="tpm-ring-field" style={{ background: preset.background }} aria-hidden="true" />;
}
