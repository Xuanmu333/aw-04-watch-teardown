// Metals are shared across the watch. Only swap in local translucent materials
// during a fade, so a solid part keeps its original depth and draw order.
function makeFade(groups) {
  const materials = new Map();
  const meshes = [];
  for (const group of groups) group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const solid = mesh.material;
    if (!materials.has(solid)) {
      const fading = solid.clone();
      fading.transparent = true;
      materials.set(solid, fading);
    }
    meshes.push({mesh, solid, fading: materials.get(solid)});
  });

  let previous = 1;
  return amount => {
    const opacity = Math.min(1, Math.max(0, amount));
    for (const group of groups) group.visible = opacity > .001;
    if (opacity === previous) return;
    previous = opacity;
    for (const [solid, fading] of materials) fading.opacity = solid.opacity * opacity;
    for (const {mesh, solid, fading} of meshes) mesh.material = opacity < .999 ? fading : solid;
  };
}

export function createPartVisibility(watch) {
  const {root, layers, actuator} = watch;
  const vibrator = layers.indexOf(actuator.layer);
  const parts = layers.map(layer => makeFade(layer === actuator.layer
    ? layer.children.filter(child => child !== actuator.cap)
    : [layer]));
  const hardware = root.children.filter(group => !layers.includes(group));
  const fadeHardware = makeFade([...hardware, actuator.cap]);

  return weights => {
    const detail = weights.reduce((sum, weight) => sum + weight, 0);
    // Clear surrounding layers before the camera turns the selected face toward the viewer.
    const context = Math.max(0, 1 - detail / .65) ** 2;
    const opacity = weight => detail > 0 ? context + (1 - context) * weight / detail : 1;
    parts.forEach((fade, index) => fade(opacity(weights[index])));
    actuator.layer.visible = opacity(weights[vibrator]) > .001;
    actuator.cap.position.z = 2.5 * weights[vibrator];
    fadeHardware(context);
  };
}
