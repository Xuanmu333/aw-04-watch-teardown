// The TPM Tools heading uses a 200px proximity field and a 300ms settling time.
export function bindWeightTitle(title) {
  const text = title.textContent;
  title.setAttribute('aria-label', text);
  const name = document.createElement('span');
  name.className = 'product-name';
  name.setAttribute('aria-hidden', 'true');
  const letters = [...text].map(char => {
    const letter = document.createElement('span');
    letter.className = 'weight-letter';
    letter.textContent = char;
    letter.setAttribute('aria-hidden', 'true');
    return letter;
  });
  const split = text.indexOf('，') + 1;
  name.append(...letters.slice(0, split));
  title.replaceChildren(name, ...letters.slice(split));

  const enabled = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  const factors = letters.map(() => 0);
  let pointer = null, frame = 0, last = 0;
  function tick(now) {
    frame = 0;
    const ease = 1 - Math.exp(-Math.min(.1, (now - (last || now - 16)) / 1000) / .3);
    const targets = letters.map(letter => {
      if (!pointer) return 0;
      const rect = letter.getBoundingClientRect();
      const distance = Math.hypot(pointer.x - rect.left - rect.width / 2, pointer.y - rect.top - rect.height / 2);
      return Math.max(0, 1 - distance / 200);
    });
    let settling = false;
    letters.forEach((letter, i) => {
      const delta = targets[i] - factors[i];
      const moving = Math.abs(delta) >= .001;
      factors[i] = moving ? factors[i] + delta * ease : targets[i];
      letter.style.fontVariationSettings = "'wght' " + Math.round(400 + factors[i] * 500);
      settling ||= moving;
    });
    last = settling ? now : 0;
    if (settling) frame = requestAnimationFrame(tick);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  function reset() {
    if (!pointer) return;
    pointer = null;
    schedule();
  }
  window.addEventListener('pointermove', event => {
    if (!enabled.matches || event.pointerType === 'touch') return;
    const r = title.getBoundingClientRect(), x = event.clientX, y = event.clientY;
    if (x < r.left - 200 || x > r.right + 200 || y < r.top - 200 || y > r.bottom + 200) {
      reset();
      return;
    }
    pointer = {x,y};
    schedule();
  }, {passive:true});
  window.addEventListener('blur', reset);
  window.addEventListener('scroll', reset, {passive:true});
  document.documentElement.addEventListener('pointerleave', reset);
  document.addEventListener('visibilitychange', reset);
  enabled.addEventListener('change', reset);
}
