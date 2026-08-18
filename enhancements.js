(() => {
  const ACTION_OPTIONS = [
    ['delete_forward', 'Entfernen (vorwärts)'],
    ['cut', 'Ausschneiden'],
    ['copy', 'Kopieren'],
    ['paste', 'Einfügen'],
    ['clipboard', 'Clipboard öffnen']
  ];

  function addActionOptions() {
    const select = document.getElementById('keyAction');
    if (!select) return;
    for (const [value, label] of ACTION_OPTIONS) {
      if ([...select.options].some(option => option.value === value)) continue;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const repeat = document.getElementById('keyRepeat');
      if (!repeat) return;
      if (select.value === 'delete_forward') {
        repeat.checked = true;
        applyKeyForm();
      } else if (['cut', 'copy', 'paste', 'clipboard', 'layer', 'shift'].includes(select.value)) {
        repeat.checked = false;
        applyKeyForm();
      }
    });
  }

  function lastNonEmptyRow(layer) {
    if (!Array.isArray(layer.rows) || layer.rows.length === 0) layer.rows = [[]];
    for (let index = layer.rows.length - 1; index >= 0; index--) {
      if (Array.isArray(layer.rows[index]) && layer.rows[index].length > 0) return layer.rows[index];
    }
    return layer.rows[layer.rows.length - 1];
  }

  function ensureActionKey(layer, actionName, keyData, beforeSpace) {
    if (layer.rows.some(row => row.some(keyDataItem => keyDataItem.action === actionName))) return;
    const row = lastNonEmptyRow(layer);
    let insertAt = row.length;
    if (beforeSpace) {
      const spaceIndex = row.findIndex(item => item.action === 'space');
      if (spaceIndex >= 0) insertAt = spaceIndex;
    } else {
      const enterIndex = row.findIndex(item => item.action === 'enter');
      if (enterIndex >= 0) insertAt = enterIndex;
    }
    row.splice(insertAt, 0, keyData);
  }

  function ensureUtilityKeys() {
    if (!layout || !Array.isArray(layout.layers)) return;
    for (const layer of layout.layers) {
      if (!['abc', 'symbols', 'code', 'emoji'].includes(layer.id)) continue;
      ensureActionKey(layer, 'clipboard', {
        label: '📋', action: 'clipboard', width: 1.05, style: 'function', repeat: false
      }, true);
      ensureActionKey(layer, 'delete_forward', {
        label: 'Entf', action: 'delete_forward', width: 1.05, style: 'function', repeat: true
      }, false);
    }
  }

  function createRowControls() {
    const container = document.querySelector('.preview-actions');
    if (!container || document.getElementById('moveRowUpButton')) return;

    const up = document.createElement('button');
    up.id = 'moveRowUpButton';
    up.type = 'button';
    up.textContent = 'Zeile ↑';
    up.title = 'Ausgewählte Zeile nach oben verschieben';
    up.addEventListener('click', () => moveSelectedRow(-1));

    const down = document.createElement('button');
    down.id = 'moveRowDownButton';
    down.type = 'button';
    down.textContent = 'Zeile ↓';
    down.title = 'Ausgewählte Zeile nach unten verschieben';
    down.addEventListener('click', () => moveSelectedRow(1));

    container.appendChild(up);
    container.appendChild(down);
  }

  function moveSelectedRow(delta) {
    const layer = currentLayer();
    if (!layer || !Array.isArray(layer.rows) || layer.rows.length < 2) return;
    const oldIndex = Math.max(0, Math.min(selectedRowIndex, layer.rows.length - 1));
    const newIndex = oldIndex + delta;
    if (newIndex < 0 || newIndex >= layer.rows.length) return;

    [layer.rows[oldIndex], layer.rows[newIndex]] = [layer.rows[newIndex], layer.rows[oldIndex]];
    selectedRowIndex = newIndex;
    if (selected && selected.row === oldIndex) selected.row = newIndex;
    saveLocal();
    render();
  }

  function updateRowButtons() {
    const layer = currentLayer();
    const up = document.getElementById('moveRowUpButton');
    const down = document.getElementById('moveRowDownButton');
    if (!up || !down || !layer || !Array.isArray(layer.rows)) return;
    up.disabled = selectedRowIndex <= 0 || layer.rows.length < 2;
    down.disabled = selectedRowIndex >= layer.rows.length - 1 || layer.rows.length < 2;
  }

  const originalSetLayout = setLayout;
  setLayout = function(newLayout, status) {
    originalSetLayout(newLayout, status);
    ensureUtilityKeys();
    saveLocal();
    render();
  };

  const originalRender = render;
  render = function() {
    originalRender();
    updateRowButtons();
  };

  addActionOptions();
  createRowControls();
  ensureUtilityKeys();
  saveLocal();
  render();
})();
