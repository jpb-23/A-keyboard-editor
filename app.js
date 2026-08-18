const STORAGE_KEY = 'a-keyboard-layout-editor-v4';
const GITHUB_OWNER = 'jpb-23';
const GITHUB_REPO = 'A-keyboard';
const GITHUB_BRANCH = 'main';
const GITHUB_LAYOUT_PATH = 'app/src/main/assets/keyboard-layout.json';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_LAYOUT_PATH}`;
const MAX_ICON_BYTES = 64 * 1024;
const MAX_RECOMMENDED_JSON_BYTES = 900 * 1024;

let layout = null;
let currentLayerId = null;
let selected = null;
let selectedRowIndex = 0;
let githubToken = '';
let repositoryLoadedAtSha = '';

const $ = (id) => document.getElementById(id);

function key(value) {
  return { label: value, value };
}

function action(label, actionName, width = 1, style = 'normal', repeat = false) {
  return { label, action: actionName, width, style, repeat };
}

function layerKey(label, target, width = 1) {
  return { label, action: 'layer', target, width, style: 'function', repeat: false };
}

function emojiLayer() {
  return {
    id: 'emoji',
    label: '😊 Emoji',
    rows: [
      ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','🙂'].map(key),
      ['😍','🥰','😘','😎','🤓','🤔','🙄','😴','😭','😡'].map(key),
      ['👍','👎','👏','🙏','💪','👌','✌️','🤝','❤️','🔥'].map(key),
      ['🎉','✅','❌','⭐','💡','🚀','📌','📱','💻','⌚'].map(key),
      [
        layerKey('ABC', 'abc', 1.35),
        layerKey('123', 'symbols', 1.25),
        action('Leerzeichen', 'space', 3.2),
        action('⌫', 'backspace', 1.25, 'function', true),
        action('↵', 'enter', 1.25, 'accent')
      ]
    ]
  };
}

const starterLayout = {
  name: 'A-keyboard',
  version: 2,
  defaultLayer: 'abc',
  layers: [
    {
      id: 'abc',
      label: 'ABC',
      rows: [
        ['q','w','e','r','t','z','u','i','o','p'].map(key),
        ['a','s','d','f','g','h','j','k','l','ß'].map(key),
        [action('⇧','shift',1.35,'function'), ...['y','x','c','v','b','n','m','ü','ö','ä'].map(key), action('⌫','backspace',1.35,'function',true)],
        [layerKey('123','symbols',1.35), key(','), layerKey('CODE','code',1.45), layerKey('😊','emoji',1.1), action('Leerzeichen','space',3.3), key('.'), action('←','left',1.15,'function',true), action('→','right',1.15,'function',true), action('↵','enter',1.35,'accent')]
      ]
    },
    {
      id: 'symbols',
      label: '123',
      rows: [
        ['1','2','3','4','5','6','7','8','9','0'].map(key),
        ['@','#','€','_','&','-','+','(',')'].map(key),
        ['!','?','%','*',"'",'"',':',';','='].map(key).concat(action('⌫','backspace',1.35,'function',true)),
        [layerKey('ABC','abc',1.35), layerKey('CODE','code',1.45), layerKey('😊','emoji',1.1), action('Leerzeichen','space',3.8), action('←','left',1.15,'function',true), action('→','right',1.15,'function',true), action('↵','enter',1.35,'accent')]
      ]
    },
    {
      id: 'code',
      label: 'CODE',
      rows: [
        ['<','>','</','/>','=','"',"'",';'].map(key),
        ['{','}','[',']','(',')',':','_'].map(key),
        ['$','#','@','&','|','\\','/','`'].map(key).concat(action('⌫','backspace',1.35,'function',true)),
        [layerKey('ABC','abc',1.35), layerKey('123','symbols',1.35), layerKey('😊','emoji',1.1), action('TAB','tab',1.15,'function'), action('Leerzeichen','space',3.2), action('←','left',1.15,'function',true), action('→','right',1.15,'function',true), action('↵','enter',1.35,'accent')]
      ]
    },
    emojiLayer()
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(message) {
  $('statusText').textContent = message;
}

function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(base64) {
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = text;
    }
  }

  if (!response.ok) {
    const error = new Error(body?.message || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function fetchRepositoryFile() {
  if (!githubToken) throw new Error('Kein GitHub-Token gesetzt.');
  const data = await githubRequest(`${GITHUB_API}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
  if (!data || data.type !== 'file' || !data.content) {
    throw new Error('GitHub lieferte keine Layout-Datei.');
  }
  return {
    sha: data.sha,
    layout: JSON.parse(base64ToUtf8(data.content))
  };
}

function isRepeatAction(actionName) {
  return actionName === 'backspace' || actionName === 'left' || actionName === 'right';
}

function normalizeKey(keyData) {
  if (!keyData || typeof keyData !== 'object') return { label: '', value: '', width: 1, style: 'normal' };
  if (keyData.width == null || Number.isNaN(Number(keyData.width))) keyData.width = 1;
  if (!keyData.style) keyData.style = 'normal';
  if (keyData.repeat == null) keyData.repeat = isRepeatAction(keyData.action || '');
  return keyData;
}

function normalizeLayout(input) {
  if (!input || !Array.isArray(input.layers) || input.layers.length === 0) {
    throw new Error('Ungültiges Layout: layers fehlt oder ist leer.');
  }

  if (!input.name) input.name = 'A-keyboard';
  input.version = Math.max(2, Number(input.version) || 1);
  if (!input.defaultLayer) input.defaultLayer = input.layers[0].id;

  for (const layer of input.layers) {
    if (!Array.isArray(layer.rows)) layer.rows = [[]];
    for (const row of layer.rows) {
      if (!Array.isArray(row)) continue;
      row.forEach(normalizeKey);
    }
  }

  ensureEmojiSupport(input);
  return input;
}

function ensureEmojiSupport(input) {
  if (!input.layers.some(layer => layer.id === 'emoji')) {
    input.layers.push(emojiLayer());
  }

  for (const layerId of ['abc', 'symbols', 'code']) {
    const layer = input.layers.find(item => item.id === layerId);
    if (!layer) continue;

    const exists = layer.rows.some(row => Array.isArray(row) && row.some(item => item.action === 'layer' && item.target === 'emoji'));
    if (exists) continue;

    let targetRow = [...layer.rows].reverse().find(row => Array.isArray(row) && row.length > 0);
    if (!targetRow) {
      targetRow = [];
      layer.rows.push(targetRow);
    }

    const spaceIndex = targetRow.findIndex(item => item.action === 'space');
    const emojiKey = layerKey('😊', 'emoji', 1.1);
    if (spaceIndex >= 0) targetRow.splice(spaceIndex, 0, emojiKey);
    else targetRow.push(emojiKey);
  }
}

function setLayout(newLayout, status) {
  layout = normalizeLayout(newLayout);
  currentLayerId = layout.defaultLayer || layout.layers[0].id;
  if (!findLayer(currentLayerId)) currentLayerId = layout.layers[0].id;
  selected = null;
  selectedRowIndex = 0;
  saveLocal();
  setStatus(status);
  render();
}

function findLayer(id = currentLayerId) {
  return layout.layers.find(layer => layer.id === id);
}

function currentLayer() {
  return findLayer(currentLayerId);
}

function saveLocal() {
  if (layout) localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function render() {
  renderLayerTabs();
  renderKeyboard();
  renderSelection();
  renderLayerForm();
}

function renderLayerTabs() {
  const container = $('layerTabs');
  container.innerHTML = '';
  for (const layer of layout.layers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${layer.label} · ${layer.id}`;
    button.classList.toggle('active', layer.id === currentLayerId);
    button.addEventListener('click', () => {
      currentLayerId = layer.id;
      selected = null;
      selectedRowIndex = 0;
      render();
    });
    container.appendChild(button);
  }
}

function renderKeyboard() {
  const container = $('keyboardPreview');
  container.innerHTML = '';
  const layer = currentLayer();
  if (!layer) return;

  layer.rows.forEach((row, rowIndex) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'keyboard-row';
    if (rowIndex === selectedRowIndex) rowElement.classList.add('selected-row');
    rowElement.addEventListener('click', (event) => {
      if (event.target === rowElement) {
        selectedRowIndex = rowIndex;
        selected = null;
        render();
      }
    });

    row.forEach((keyData, keyIndex) => {
      normalizeKey(keyData);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `keyboard-key ${keyData.style || 'normal'}`;
      button.style.flexGrow = String(Math.max(0.35, Number(keyData.width) || 1));
      button.style.position = 'relative';
      if (keyData.backgroundColor) button.style.background = keyData.backgroundColor;
      if (keyData.textColor) button.style.color = keyData.textColor;

      if (keyData.icon) {
        const image = document.createElement('img');
        image.className = 'key-icon';
        image.src = keyData.icon;
        image.alt = '';
        button.appendChild(image);
      }

      const label = document.createElement('span');
      label.textContent = keyData.label || keyData.value || 'Taste';
      button.appendChild(label);

      if (keyData.repeat) {
        const badge = document.createElement('span');
        badge.className = 'repeat-badge';
        badge.textContent = '↻';
        badge.title = 'Wiederholt bei Gedrückthalten';
        button.appendChild(badge);
      }

      if (selected && selected.row === rowIndex && selected.key === keyIndex) {
        button.classList.add('selected');
      }
      button.title = describeKey(keyData);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        selected = { row: rowIndex, key: keyIndex };
        selectedRowIndex = rowIndex;
        render();
      });
      rowElement.appendChild(button);
    });

    container.appendChild(rowElement);
  });
}

function describeKey(keyData) {
  const parts = [];
  if (keyData.action === 'layer') parts.push(`Ebene wechseln → ${keyData.target || '?'}`);
  else if (keyData.action) parts.push(`Funktion: ${keyData.action}`);
  else parts.push(`Ausgabe: ${keyData.value ?? ''}`);
  if (keyData.repeat) parts.push('Wiederholung bei Halten');
  if (keyData.backgroundColor) parts.push(`Farbe: ${keyData.backgroundColor}`);
  if (keyData.icon) parts.push('eigenes Icon');
  return parts.join(' · ');
}

function selectedKey() {
  if (!selected) return null;
  return currentLayer()?.rows?.[selected.row]?.[selected.key] || null;
}

function renderSelection() {
  const keyData = selectedKey();
  const form = $('keyForm');
  $('selectionHint').hidden = Boolean(keyData);
  form.hidden = !keyData;
  fillTargetOptions();
  if (!keyData) return;

  normalizeKey(keyData);
  $('keyLabel').value = keyData.label ?? '';
  $('keyValue').value = keyData.value ?? '';
  $('keyAction').value = keyData.action ?? '';
  $('keyTarget').value = keyData.target ?? '';
  $('keyWidth').value = keyData.width ?? 1;
  $('keyStyle').value = keyData.style ?? 'normal';
  $('keyRepeat').checked = Boolean(keyData.repeat);

  setColorControls('Background', keyData.backgroundColor, '#ffffff');
  setColorControls('Text', keyData.textColor, '#202124');
  renderIconPreview(keyData.icon || '');
  toggleTargetField();
}

function setColorControls(kind, value, fallback) {
  const checkbox = $(`use${kind}Color`);
  const picker = $(`key${kind}Color`);
  const text = $(`key${kind}ColorText`);
  const active = Boolean(value);
  checkbox.checked = active;
  const normalized = normalizeHexColor(value || fallback) || fallback;
  picker.value = normalized.length === 9 ? normalized.slice(0, 7) : normalized;
  text.value = value || normalized;
  picker.disabled = !active;
  text.disabled = !active;
}

function normalizeHexColor(value) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text) || /^#[0-9a-fA-F]{8}$/.test(text)) return text.toUpperCase();
  return '';
}

function fillTargetOptions() {
  const select = $('keyTarget');
  const previous = select.value;
  select.innerHTML = '';
  for (const layer of layout.layers) {
    const option = document.createElement('option');
    option.value = layer.id;
    option.textContent = `${layer.label} (${layer.id})`;
    select.appendChild(option);
  }
  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }
}

function renderLayerForm() {
  const layer = currentLayer();
  $('layerId').value = layer?.id ?? '';
  $('layerLabel').value = layer?.label ?? '';
}

function toggleTargetField() {
  $('targetField').hidden = $('keyAction').value !== 'layer';
}

function applyKeyForm() {
  const keyData = selectedKey();
  if (!keyData) return;

  keyData.label = $('keyLabel').value;
  const actionName = $('keyAction').value;
  keyData.width = Math.max(0.35, Number($('keyWidth').value) || 1);
  keyData.style = $('keyStyle').value || 'normal';
  keyData.repeat = $('keyRepeat').checked;

  delete keyData.value;
  delete keyData.action;
  delete keyData.target;

  if (actionName) {
    keyData.action = actionName;
    if (actionName === 'layer') keyData.target = $('keyTarget').value;
  } else {
    keyData.value = $('keyValue').value;
  }

  applyColorField(keyData, 'Background', 'backgroundColor');
  applyColorField(keyData, 'Text', 'textColor');
  saveLocal();
  renderKeyboard();
}

function applyColorField(keyData, kind, property) {
  if (!$(`use${kind}Color`).checked) {
    delete keyData[property];
    return;
  }
  const value = normalizeHexColor($(`key${kind}ColorText`).value);
  if (value) keyData[property] = value;
}

function syncColorFromPicker(kind) {
  const value = $(`key${kind}Color`).value.toUpperCase();
  $(`key${kind}ColorText`).value = value;
  applyKeyForm();
}

function syncColorFromText(kind) {
  const value = normalizeHexColor($(`key${kind}ColorText`).value);
  if (value && value.length === 7) $(`key${kind}Color`).value = value;
  applyKeyForm();
}

function toggleCustomColor(kind) {
  const active = $(`use${kind}Color`).checked;
  $(`key${kind}Color`).disabled = !active;
  $(`key${kind}ColorText`).disabled = !active;
  applyKeyForm();
}

function renderIconPreview(icon) {
  const container = $('iconPreview');
  container.innerHTML = '';
  if (!icon) {
    container.textContent = 'Kein Icon';
    return;
  }
  const image = document.createElement('img');
  image.src = icon;
  image.alt = 'Icon-Vorschau';
  container.appendChild(image);
}

function importKeyIcon(file) {
  const keyData = selectedKey();
  if (!keyData || !file) return;

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    alert('Bitte PNG, JPG oder WebP verwenden.');
    return;
  }
  if (file.size > MAX_ICON_BYTES) {
    alert(`Das Icon ist zu groß (${Math.ceil(file.size / 1024)} KB). Maximal erlaubt sind ${MAX_ICON_BYTES / 1024} KB.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    keyData.icon = String(reader.result || '');
    saveLocal();
    renderSelection();
    renderKeyboard();
    setStatus(`Icon für „${keyData.label || 'Taste'}“ übernommen.`);
  };
  reader.readAsDataURL(file);
}

function removeKeyIcon() {
  const keyData = selectedKey();
  if (!keyData) return;
  delete keyData.icon;
  $('keyIconFile').value = '';
  saveLocal();
  renderSelection();
  renderKeyboard();
}

function addRow() {
  const layer = currentLayer();
  layer.rows.push([]);
  selectedRowIndex = layer.rows.length - 1;
  selected = null;
  saveLocal();
  render();
}

function addKeyToSelectedRow() {
  const layer = currentLayer();
  if (!layer.rows.length) layer.rows.push([]);
  selectedRowIndex = Math.min(selectedRowIndex, layer.rows.length - 1);
  const row = layer.rows[selectedRowIndex];
  row.push({ label: 'neu', value: 'neu', width: 1, style: 'normal', repeat: false });
  selected = { row: selectedRowIndex, key: row.length - 1 };
  saveLocal();
  render();
}

function deleteSelectedKey() {
  if (!selected) return;
  const row = currentLayer().rows[selected.row];
  row.splice(selected.key, 1);
  selected = null;
  saveLocal();
  render();
}

function moveSelected(delta) {
  if (!selected) return;
  const row = currentLayer().rows[selected.row];
  const newIndex = selected.key + delta;
  if (newIndex < 0 || newIndex >= row.length) return;
  [row[selected.key], row[newIndex]] = [row[newIndex], row[selected.key]];
  selected.key = newIndex;
  saveLocal();
  render();
}

function addLayer() {
  let index = layout.layers.length + 1;
  let id = `layer${index}`;
  while (findLayer(id)) id = `layer${++index}`;
  layout.layers.push({ id, label: `Ebene ${index}`, rows: [[]] });
  currentLayerId = id;
  selectedRowIndex = 0;
  selected = null;
  saveLocal();
  render();
}

function deleteLayer() {
  if (currentLayerId === 'emoji') {
    alert('Die Emoji-Ebene ist Teil der Tastaturfunktion und kann bearbeitet, aber nicht gelöscht werden.');
    return;
  }
  if (layout.layers.length <= 1) {
    alert('Mindestens eine Ebene muss erhalten bleiben.');
    return;
  }
  const layer = currentLayer();
  if (!confirm(`Ebene „${layer.label}“ wirklich löschen?`)) return;
  layout.layers = layout.layers.filter(item => item.id !== layer.id);
  if (layout.defaultLayer === layer.id) layout.defaultLayer = layout.layers[0].id;
  currentLayerId = layout.layers[0].id;
  selected = null;
  selectedRowIndex = 0;
  saveLocal();
  render();
}

function saveLayerMetadata() {
  const layer = currentLayer();
  const oldId = layer.id;
  const newId = $('layerId').value.trim();
  const newLabel = $('layerLabel').value.trim();

  if (oldId === 'emoji' && newId !== 'emoji') {
    alert('Die System-ID der Emoji-Ebene muss „emoji“ bleiben. Die Beschriftung kannst du ändern.');
    return;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(newId)) {
    alert('Die Ebenen-ID darf nur Buchstaben, Zahlen, _ und - enthalten.');
    return;
  }
  if (newId !== oldId && findLayer(newId)) {
    alert('Diese Ebenen-ID existiert bereits.');
    return;
  }

  layer.id = newId;
  layer.label = newLabel || newId;
  if (layout.defaultLayer === oldId) layout.defaultLayer = newId;

  for (const otherLayer of layout.layers) {
    for (const row of otherLayer.rows) {
      for (const keyData of row) {
        if (keyData.action === 'layer' && keyData.target === oldId) {
          keyData.target = newId;
        }
      }
    }
  }

  currentLayerId = newId;
  saveLocal();
  render();
}

function serializedLayout() {
  normalizeLayout(layout);
  return JSON.stringify(layout, null, 2) + '\n';
}

function exportLayout() {
  const json = serializedLayout();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'keyboard-layout.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus('keyboard-layout.json exportiert.');
}

function importLayout(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      repositoryLoadedAtSha = '';
      setLayout(JSON.parse(reader.result), `Importiert: ${file.name}`);
    } catch (error) {
      alert(`JSON konnte nicht geladen werden: ${error.message}`);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function toggleGithubPanel() {
  $('githubPanel').hidden = !$('githubPanel').hidden;
  if (!$('githubPanel').hidden) $('githubToken').focus();
}

function readTokenFromField() {
  githubToken = $('githubToken').value.trim();
  return githubToken;
}

function setBusy(busy) {
  for (const id of ['testGithubButton', 'reloadButton', 'saveRepositoryButton']) {
    $(id).disabled = busy;
  }
}

async function connectAndLoad() {
  if (!readTokenFromField()) {
    alert('Bitte zuerst das Fine-grained GitHub-Token eingeben.');
    return;
  }
  await loadFromRepository();
  $('githubPanel').hidden = true;
}

async function loadFromRepository() {
  if (!githubToken) {
    $('githubPanel').hidden = false;
    $('githubToken').focus();
    setStatus('GitHub-Token erforderlich.');
    return;
  }

  setBusy(true);
  setStatus('Layout wird aus dem privaten Repository geladen …');
  try {
    const result = await fetchRepositoryFile();
    repositoryLoadedAtSha = result.sha;
    setLayout(result.layout, `Geladen aus ${GITHUB_OWNER}/${GITHUB_REPO} · ${GITHUB_BRANCH}`);
  } catch (error) {
    setStatus(`GitHub-Laden fehlgeschlagen: ${error.message}`);
    alert(`GitHub-Laden fehlgeschlagen:\n${error.message}\n\nPrüfe Token, Repository-Auswahl und Contents: Read and write.`);
  } finally {
    setBusy(false);
  }
}

async function saveToRepository() {
  if (!githubToken) {
    $('githubPanel').hidden = false;
    $('githubToken').focus();
    setStatus('GitHub-Token erforderlich.');
    return;
  }

  setBusy(true);
  setStatus('Prüfe aktuelle Repository-Version …');
  try {
    const current = await fetchRepositoryFile();
    if (repositoryLoadedAtSha && current.sha !== repositoryLoadedAtSha) {
      const overwrite = confirm('keyboard-layout.json wurde seit deinem letzten Laden im Repository geändert. Trotzdem mit dem aktuellen Editor-Stand überschreiben?');
      if (!overwrite) {
        setStatus('Speichern abgebrochen: Repository-Datei wurde zwischenzeitlich geändert.');
        return;
      }
    }

    const json = serializedLayout();
    const byteLength = new TextEncoder().encode(json).length;
    if (byteLength > MAX_RECOMMENDED_JSON_BYTES) {
      const proceed = confirm(`Das Layout ist durch eingebettete Icons bereits ${Math.ceil(byteLength / 1024)} KB groß. Trotzdem speichern? Zu viele große Icons können die GitHub-Dateigrenze erreichen.`);
      if (!proceed) return;
    }

    setStatus('Speichere keyboard-layout.json direkt auf main …');
    const response = await githubRequest(GITHUB_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update keyboard layout from graphical editor',
        content: utf8ToBase64(json),
        sha: current.sha,
        branch: GITHUB_BRANCH
      })
    });

    repositoryLoadedAtSha = response?.content?.sha || '';
    saveLocal();
    setStatus('Gespeichert auf main. Der APK-Build wurde durch den Commit gestartet.');
  } catch (error) {
    setStatus(`GitHub-Speichern fehlgeschlagen: ${error.message}`);
    alert(`GitHub-Speichern fehlgeschlagen:\n${error.message}`);
  } finally {
    setBusy(false);
  }
}

function disconnectGithub() {
  githubToken = '';
  repositoryLoadedAtSha = '';
  $('githubToken').value = '';
  setStatus('GitHub-Token aus dieser Browser-Sitzung entfernt.');
}

function bindEvents() {
  $('githubButton').addEventListener('click', toggleGithubPanel);
  $('testGithubButton').addEventListener('click', connectAndLoad);
  $('disconnectGithubButton').addEventListener('click', disconnectGithub);
  $('reloadButton').addEventListener('click', loadFromRepository);
  $('saveRepositoryButton').addEventListener('click', saveToRepository);
  $('exportButton').addEventListener('click', exportLayout);
  $('importFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importLayout(file);
    event.target.value = '';
  });

  for (const id of ['keyLabel', 'keyValue', 'keyWidth', 'keyStyle', 'keyTarget']) {
    $(id).addEventListener('input', applyKeyForm);
    $(id).addEventListener('change', applyKeyForm);
  }
  $('keyAction').addEventListener('change', () => {
    toggleTargetField();
    applyKeyForm();
    renderSelection();
  });
  $('keyRepeat').addEventListener('change', applyKeyForm);

  $('useBackgroundColor').addEventListener('change', () => toggleCustomColor('Background'));
  $('keyBackgroundColor').addEventListener('input', () => syncColorFromPicker('Background'));
  $('keyBackgroundColorText').addEventListener('change', () => syncColorFromText('Background'));
  $('useTextColor').addEventListener('change', () => toggleCustomColor('Text'));
  $('keyTextColor').addEventListener('input', () => syncColorFromPicker('Text'));
  $('keyTextColorText').addEventListener('change', () => syncColorFromText('Text'));

  $('keyIconFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importKeyIcon(file);
    event.target.value = '';
  });
  $('removeIconButton').addEventListener('click', removeKeyIcon);

  $('moveLeftButton').addEventListener('click', () => moveSelected(-1));
  $('moveRightButton').addEventListener('click', () => moveSelected(1));
  $('deleteKeyButton').addEventListener('click', deleteSelectedKey);
  $('addRowButton').addEventListener('click', addRow);
  $('addKeyButton').addEventListener('click', addKeyToSelectedRow);
  $('addLayerButton').addEventListener('click', addLayer);
  $('deleteLayerButton').addEventListener('click', deleteLayer);
  $('saveLayerButton').addEventListener('click', saveLayerMetadata);
}

function initialize() {
  bindEvents();
  let initial = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) initial = JSON.parse(saved);
  } catch (_) {
    initial = null;
  }

  try {
    setLayout(initial || clone(starterLayout), initial ? 'Lokalen Editor-Stand geladen.' : 'Starter-Layout geladen. Mit GitHub verbinden, um das aktuelle Repository-Layout zu laden.');
  } catch (error) {
    setLayout(clone(starterLayout), `Lokaler Stand war ungültig: ${error.message}`);
  }
}

initialize();
