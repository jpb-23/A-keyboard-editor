const STORAGE_KEY = 'a-keyboard-layout-editor-v3';
const GITHUB_OWNER = 'jpb-23';
const GITHUB_REPO = 'A-keyboard';
const GITHUB_BRANCH = 'main';
const GITHUB_LAYOUT_PATH = 'app/src/main/assets/keyboard-layout.json';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_LAYOUT_PATH}`;

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

function action(label, actionName, width = 1, style = 'normal') {
  return { label, action: actionName, width, style };
}

function layerKey(label, target, width = 1) {
  return { label, action: 'layer', target, width, style: 'function' };
}

const starterLayout = {
  name: 'A-keyboard',
  version: 1,
  defaultLayer: 'abc',
  layers: [
    {
      id: 'abc',
      label: 'ABC',
      rows: [
        ['q','w','e','r','t','z','u','i','o','p'].map(key),
        ['a','s','d','f','g','h','j','k','l','ß'].map(key),
        [action('⇧','shift',1.35,'function'), ...['y','x','c','v','b','n','m','ü','ö','ä'].map(key), action('⌫','backspace',1.35,'function')],
        [layerKey('123','symbols',1.35), key(','), layerKey('CODE','code',1.45), action('Leerzeichen','space',3.3), key('.'), action('←','left',1.15,'function'), action('→','right',1.15,'function'), action('↵','enter',1.35,'accent')]
      ]
    },
    {
      id: 'symbols',
      label: '123',
      rows: [
        ['1','2','3','4','5','6','7','8','9','0'].map(key),
        ['@','#','€','_','&','-','+','(',')'].map(key),
        ['!','?','%','*',"'",'"',':',';','='].map(key).concat(action('⌫','backspace',1.35,'function')),
        [layerKey('ABC','abc',1.35), layerKey('CODE','code',1.45), action('Leerzeichen','space',3.8), action('←','left',1.15,'function'), action('→','right',1.15,'function'), action('↵','enter',1.35,'accent')]
      ]
    },
    {
      id: 'code',
      label: 'CODE',
      rows: [
        ['<','>','</','/>','=','"',"'",';'].map(key),
        ['{','}','[',']','(',')',':','_'].map(key),
        ['$','#','@','&','|','\\','/','`'].map(key).concat(action('⌫','backspace',1.35,'function')),
        [layerKey('ABC','abc',1.35), layerKey('123','symbols',1.35), action('TAB','tab',1.15,'function'), action('Leerzeichen','space',3.2), action('←','left',1.15,'function'), action('→','right',1.15,'function'), action('↵','enter',1.35,'accent')]
      ]
    }
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

function setLayout(newLayout, status) {
  if (!newLayout || !Array.isArray(newLayout.layers) || newLayout.layers.length === 0) {
    throw new Error('Ungültiges Layout: layers fehlt oder ist leer.');
  }
  layout = newLayout;
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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `keyboard-key ${keyData.style || 'normal'}`;
      button.textContent = keyData.label || keyData.value || 'Taste';
      button.style.flexGrow = String(Math.max(0.35, Number(keyData.width) || 1));
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
  if (keyData.action === 'layer') return `Ebene wechseln → ${keyData.target || '?'}`;
  if (keyData.action) return `Funktion: ${keyData.action}`;
  return `Ausgabe: ${keyData.value ?? ''}`;
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

  $('keyLabel').value = keyData.label ?? '';
  $('keyValue').value = keyData.value ?? '';
  $('keyAction').value = keyData.action ?? '';
  $('keyTarget').value = keyData.target ?? '';
  $('keyWidth').value = keyData.width ?? 1;
  $('keyStyle').value = keyData.style ?? 'normal';
  toggleTargetField();
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

  delete keyData.value;
  delete keyData.action;
  delete keyData.target;

  if (actionName) {
    keyData.action = actionName;
    if (actionName === 'layer') keyData.target = $('keyTarget').value;
  } else {
    keyData.value = $('keyValue').value;
  }

  saveLocal();
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
  row.push({ label: 'neu', value: 'neu', width: 1, style: 'normal' });
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

function exportLayout() {
  const json = JSON.stringify(layout, null, 2) + '\n';
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

async function connectAndLoad() {
  if (!readTokenFromField()) {
    setStatus('Bitte zuerst ein GitHub-Token eingeben.');
    return;
  }

  setBusy('testGithubButton', true, 'Lade …');
  try {
    const result = await fetchRepositoryFile();
    repositoryLoadedAtSha = result.sha;
    setLayout(result.layout, 'GitHub-Verbindung erfolgreich. Aktuelles Layout aus dem privaten Repository geladen.');
    $('githubButton').textContent = 'GitHub verbunden';
    $('githubPanel').hidden = true;
  } catch (error) {
    setStatus(`GitHub-Verbindung fehlgeschlagen: ${friendlyGithubError(error)}`);
  } finally {
    setBusy('testGithubButton', false, 'Verbinden & laden');
  }
}

function disconnectGithub() {
  githubToken = '';
  repositoryLoadedAtSha = '';
  $('githubToken').value = '';
  $('githubButton').textContent = 'GitHub verbinden';
  setStatus('GitHub-Token aus dieser Seite entfernt.');
}

async function loadRepositoryLayout() {
  if (!githubToken) {
    $('githubPanel').hidden = false;
    $('githubToken').focus();
    setStatus('Zum Laden aus dem privaten Repository zuerst GitHub verbinden.');
    return;
  }

  setBusy('reloadButton', true, 'Lade …');
  try {
    const result = await fetchRepositoryFile();
    repositoryLoadedAtSha = result.sha;
    setLayout(result.layout, 'Aktuelles Layout aus GitHub geladen.');
  } catch (error) {
    setStatus(`Repository konnte nicht geladen werden: ${friendlyGithubError(error)}`);
  } finally {
    setBusy('reloadButton', false, 'Aus Repository laden');
  }
}

async function saveLayoutToRepository() {
  if (!layout) return;
  if (!githubToken && !readTokenFromField()) {
    $('githubPanel').hidden = false;
    $('githubToken').focus();
    setStatus('Zum direkten Speichern bitte zuerst GitHub verbinden.');
    return;
  }

  setBusy('saveRepositoryButton', true, 'Speichere …');
  try {
    const current = await fetchRepositoryFile();

    if (repositoryLoadedAtSha && repositoryLoadedAtSha !== current.sha) {
      const proceed = confirm('Die Layout-Datei wurde seit dem letzten Laden auf GitHub geändert. Deine lokale Version kann diese Änderung überschreiben. Trotzdem speichern?');
      if (!proceed) {
        setStatus('Speichern abgebrochen. Lade zuerst die aktuelle Repository-Version.');
        return;
      }
    }

    const json = JSON.stringify(layout, null, 2) + '\n';
    const result = await githubRequest(GITHUB_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update keyboard layout from graphical editor',
        content: utf8ToBase64(json),
        sha: current.sha,
        branch: GITHUB_BRANCH
      })
    });

    repositoryLoadedAtSha = result?.content?.sha || '';
    saveLocal();
    setStatus('Layout auf GitHub gespeichert. Der Commit auf main startet automatisch den APK-Build.');
  } catch (error) {
    setStatus(`Speichern fehlgeschlagen: ${friendlyGithubError(error)}`);
  } finally {
    setBusy('saveRepositoryButton', false, 'Im Repository speichern');
  }
}

function friendlyGithubError(error) {
  if (error?.status === 401) return 'Token ungültig oder abgelaufen.';
  if (error?.status === 403) return 'Zugriff verweigert. Prüfe beim Fine-grained Token „Contents: Read and write“ für jpb-23/A-keyboard.';
  if (error?.status === 404) return 'Repository oder Layout-Datei nicht gefunden. Prüfe, ob das Token Zugriff auf das private Repository jpb-23/A-keyboard hat.';
  if (error?.status === 409) return 'GitHub meldet einen Konflikt. Lade das Repository-Layout neu und versuche es erneut.';
  return error?.message || String(error);
}

function setBusy(id, busy, busyText) {
  const button = $(id);
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

['keyLabel','keyValue','keyWidth','keyStyle','keyTarget'].forEach(id => {
  $(id).addEventListener('input', applyKeyForm);
  $(id).addEventListener('change', applyKeyForm);
});

$('keyAction').addEventListener('change', () => {
  toggleTargetField();
  applyKeyForm();
});
$('addRowButton').addEventListener('click', addRow);
$('addKeyButton').addEventListener('click', addKeyToSelectedRow);
$('deleteKeyButton').addEventListener('click', deleteSelectedKey);
$('moveLeftButton').addEventListener('click', () => moveSelected(-1));
$('moveRightButton').addEventListener('click', () => moveSelected(1));
$('addLayerButton').addEventListener('click', addLayer);
$('deleteLayerButton').addEventListener('click', deleteLayer);
$('saveLayerButton').addEventListener('click', saveLayerMetadata);
$('exportButton').addEventListener('click', exportLayout);
$('githubButton').addEventListener('click', toggleGithubPanel);
$('testGithubButton').addEventListener('click', connectAndLoad);
$('disconnectGithubButton').addEventListener('click', disconnectGithub);
$('saveRepositoryButton').addEventListener('click', saveLayoutToRepository);
$('reloadButton').addEventListener('click', loadRepositoryLayout);
$('githubToken').addEventListener('change', readTokenFromField);
$('importFile').addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) importLayout(file);
  event.target.value = '';
});

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  try {
    setLayout(JSON.parse(saved), 'Lokale Bearbeitung geladen. Mit „GitHub verbinden“ kannst du die aktuelle Repository-Version laden.');
  } catch (_) {
    setLayout(clone(starterLayout), 'Starter-Layout geladen.');
  }
} else {
  setLayout(clone(starterLayout), 'Starter-Layout geladen. Zum Bearbeiten des privaten Repository-Layouts bitte „GitHub verbinden“ wählen.');
}
