import {sounds} from './acoustics.js';
import {rhythms} from './haptics.js';

const storageKey = 'aw04.custom-sounds.v1';
const nameKey = name => name.normalize('NFKC').trim().toLowerCase();

// Custom scenes carry a generic simulated input, independent of their display name.
export function customSound(en, name, rhythm) {
  return {en, name, rhythm, custom:true, angle:0, bins:[.12,.44,.70,.40,.25,.52,.19,.08]};
}

export function loadCustomSounds() {
  const result = [];
  try {
    const entries = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(entries)) return result;
    const names = new Set(sounds.map(sound => nameKey(sound.name)));
    const ids = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string' || !/^custom-[a-z0-9-]+$/.test(entry.en)) continue;
      const name = entry.name.trim();
      if (!name || name.length > 24 || names.has(nameKey(name)) || ids.has(entry.en)) continue;
      names.add(nameKey(name));
      ids.add(entry.en);
      result.push(customSound(entry.en, name, Object.hasOwn(rhythms, entry.rhythm) ? entry.rhythm : 'single'));
    }
  } catch { /* Keep the simulator usable without browser storage. */ }
  return result;
}

export function saveCustomSounds(catalog) {
  try {
    const entries = catalog.filter(s => s.custom).map(({en,name,rhythm}) => ({en,name,rhythm}));
    localStorage.setItem(storageKey, JSON.stringify(entries));
    return true;
  } catch { return false; }
}

export function createSoundEditor(catalog, onSave, onRemove) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sound-editor';
  dialog.setAttribute('aria-labelledby','soundEditorTitle');
  dialog.innerHTML = `<form>
    <h2 id="soundEditorTitle"></h2>
    <label for="customName">声音名称</label>
    <input id="customName" maxlength="24" placeholder="例如：洗衣机完成提示" required>
    <label for="customRhythm">振动节奏</label><select id="customRhythm"></select>
    <p>保存后，可在「声源场景」中模拟这类声音并试振。</p>
    <div class="editor-actions"><button type="button" data-delete>删除类型</button>
      <button type="button" data-cancel>取消</button><button type="submit">保存</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const name = form.querySelector('input');
  const rhythm = form.querySelector('select');
  const remove = form.querySelector('[data-delete]');
  for (const [id, preset] of Object.entries(rhythms)) rhythm.add(new Option(preset.label,id));
  let editing;
  const cancel = () => dialog.close();
  form.querySelector('[data-cancel]').onclick = cancel;
  name.oninput = () => name.setCustomValidity('');
  dialog.addEventListener('keydown', event => event.stopPropagation());
  form.onsubmit = event => {
    event.preventDefault();
    const value = name.value.trim();
    const duplicate = catalog.some(sound => sound !== editing && nameKey(sound.name) === nameKey(value));
    name.setCustomValidity(!value ? '请输入声音名称。' : duplicate ? '已有同名声音，请换一个名称。' : '');
    if (!form.reportValidity()) return;
    dialog.close();
    onSave(editing,value,rhythm.value);
  };
  remove.onclick = () => {
    dialog.close();
    onRemove(editing);
  };
  return sound => {
    editing = sound;
    form.querySelector('h2').textContent = sound ? '编辑声音类型' : '添加自定义声音';
    name.value = sound?.name ?? '';
    name.setCustomValidity('');
    rhythm.value = sound?.rhythm ?? 'single';
    remove.hidden = !sound;
    dialog.showModal();
    name.focus();
  };
}
