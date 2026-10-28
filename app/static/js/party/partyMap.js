window.mapData = null;
var mapData = null;

let currentGridSize = 50;

// Инициализация линейки-стрелочки расстояний
let isMeasuring = false;
let rulerStart = { x: 0, y: 0 };

async function renderBattleMap() {
  try {
    const res = await apiFetch(`/parties/${partyId}/map`);
    if (!res.ok) return;
    mapData = await res.json();

    const canvas = document.getElementById('battleMapCanvas');
    const overlay = document.getElementById('battleMapGridOverlay');
    const tokensLayer = document.getElementById('battleMapTokensLayer');
    if (!canvas || !tokensLayer) return;

    currentGridSize = mapData.grid_size || 50;
    const gridInput = document.getElementById('mapGridCustomInput');
    if (gridInput) gridInput.value = currentGridSize;

    if (mapData.image_url && mapData.image_url.trim()) {
      canvas.style.backgroundImage = `url('${mapData.image_url}')`;
    }

    // В renderBattleMap():
    if (overlay) {
      overlay.style.backgroundSize = `${currentGridSize}px ${currentGridSize}px`;
      overlay.style.backgroundImage = `
        linear-gradient(to right, rgba(255, 255, 255, 0.22) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.22) 1px, transparent 1px)
      `;
    }

    renderMapPresetsDropdown();

    const tokens = mapData.tokens || [];
    const isDm = partyData ? !!partyData.is_current_user_dm : false;
    const myCharId = partyData ? partyData.my_character_id : null;

    // Чей сейчас ход в бою?
    const cState = window.combatState || (typeof combatState !== 'undefined' ? combatState : null);
    const currentCombatant = (cState && cState.is_active && Array.isArray(cState.combatants))
      ? cState.combatants[cState.current_turn_index]
      : null;

    tokensLayer.innerHTML = tokens.map(t => {
      const sizeMult = t.size || 1;
      const pixelSize = Math.max(24, currentGridSize * sizeMult - 6);

      // Проверка прав: DM двигает всё, игрок — только своего персонажа
      const canControl = isDm || (t.character_id && t.character_id === myCharId);

      // Рамка стороны существа
      let borderColor = 'border-amber-400';
      if (t.type === 'enemy') borderColor = 'border-rose-500 shadow-rose-950/80';
      else if (t.type === 'ally') borderColor = 'border-emerald-400 shadow-emerald-950/80';
      else if (t.type === 'neutral') borderColor = 'border-amber-300 shadow-amber-950/80';

      // Если сейчас ход этого существа — золотой ореол
      const isTurn = currentCombatant && (currentCombatant.token_id === t.id || currentCombatant.id === t.id);
      const turnRing = isTurn ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.8)] scale-105' : '';

      // Проверка невидимости (состояние 👻): полупрозрачность для скрытности
      const isInvisible = (t.conditions || []).includes('👻');
      const invisClass = isInvisible ? 'opacity-40 filter drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]' : 'opacity-100';

      // Полоска здоровья
      const curHp = t.hp_current !== undefined ? t.hp_current : (t.hp_max || 10);
      const maxHp = t.hp_max || 10;
      const pct = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
      const hpColor = pct <= 25 ? 'bg-rose-600' : (pct <= 50 ? 'bg-amber-500' : 'bg-emerald-500');

      const avatarSrc = t.avatar_url && t.avatar_url.trim() ? t.avatar_url : '';
      const cursorClass = canControl ? 'cursor-grab active:cursor-grabbing' : 'cursor-default';

      // Значки состояний
      const conditionsBadge = (t.conditions || []).map(icon => `
        <span class="text-xs drop-shadow bg-black/80 rounded px-0.5 border border-stone-800">${icon}</span>
      `).join('');

      return `
        <div id="token_${t.id}"
             ${canControl ? `onmousedown="dragMapToken(event, '${t.id}')"` : `onclick="selectTargetToken('${t.id}')"`}
             ondblclick="openTokenHud(event, '${t.id}')"
             class="absolute rounded-full border-2 ${borderColor} ${turnRing} ${invisClass} bg-stone-900 shadow-2xl flex items-center justify-center select-none group transition-all ${cursorClass}"
             style="width: ${pixelSize}px; height: ${pixelSize}px; left: ${t.x || 0}px; top: ${t.y || 0}px; z-index: ${isTurn ? 50 : sizeMult * 10};">

          ${avatarSrc ? `
            <img src="${avatarSrc}" class="w-full h-full object-cover rounded-full pointer-events-none">
          ` : `
            <span class="font-bold text-stone-100 font-serif text-xs pointer-events-none">${(t.name || 'Токен').slice(0, 2)}</span>
          `}

          <!-- Полоска HP -->
          <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4/5 h-1.5 bg-black/80 rounded-full overflow-hidden border border-black pointer-events-none">
            <div class="h-full ${hpColor} transition-all duration-300" style="width: ${pct}%;"></div>
          </div>

          <!-- Бейджи состояний -->
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 pointer-events-none z-30 whitespace-nowrap">
            ${conditionsBadge}
          </div>

          <!-- Тултип -->
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono text-amber-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-orange-950 z-50">
            ${t.name} (${curHp}/${maxHp} HP)${!canControl ? ' 🔒' : ''}
          </div>

          <!-- Кнопка HUD для управления -->
          <button type="button" onclick="openTokenHud(event, '${t.id}')" title="Урон и состояния" class="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-stone-950 border border-amber-500 text-amber-300 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-amber-950 transition-all z-50">
            ⚙️
          </button>

          <!-- Кнопка удаления для Мастера -->
          ${isDm ? `
            <button type="button" onclick="deleteMapToken('${t.id}')" title="Убрать токен" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-950 border border-rose-600 text-rose-200 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-700 transition-all z-50">
              &times;
            </button>
          ` : ''}
        </div>
      `;
    }).join('');


    initRulerEvents();
  } catch (e) {
    console.error("Ошибка renderBattleMap:", e);
  }
}


// --- ПЕРЕТАСКИВАНИЕ ТОКЕНОВ СТРОГО В СВОЙ ХОД И ПО ЛИМИТУ СКОРОСТИ ---
function dragMapToken(e, tokenId) {
  if (e.button !== 0) return;
  if (e.target.tagName.toLowerCase() === 'button') return;
  e.preventDefault();

  const isCombatActive = Boolean(window.combatState && window.combatState.is_active);
  const currentCombatant = isCombatActive ? window.combatState.combatants[window.combatState.current_turn_index] : null;

  const pData = (typeof partyData !== 'undefined' && partyData) ? partyData : window.partyData;
  const uData = (typeof currentUserData !== 'undefined' && currentUserData) ? currentUserData : window.currentUserData;
  const isDm = Boolean(
    (pData && (pData.is_current_user_dm || (uData && pData.dm_id === uData.id))) ||
    uData?.username === "Ent1XXX"
  );
  const myCharId = pData ? pData.my_character_id : null;

  if (window.fogEnabled) {
    window.renderFogOfWar();
  }
  // ПРОВЕРКА ПРАВ:
  // Если идет бой:
  // - Игрок может двигать ТОЛЬКО своего персонажа и ТОЛЬКО когда сейчас его ход!
  // - Мастер может двигать ТОЛЬКО текущего ходящего комбатанта!
  if (isCombatActive) {
    const isThisTokenTurn = currentCombatant && (currentCombatant.token_id === tokenId || currentCombatant.id === tokenId);
    if (!isThisTokenTurn) {
      // Клик по чужому токену в чужой ход — это выбор цели, а не перемещение
      if (typeof selectTargetToken === 'function') {
        selectTargetToken(tokenId);
      }
      return;
    }

    if (!isDm && currentCombatant.character_id !== myCharId) {
      if (typeof selectTargetToken === 'function') {
        selectTargetToken(tokenId);
      }
      return;
    }
  }

  const el = document.getElementById(`token_${tokenId}`);
  const canvas = document.getElementById('battleMapCanvas');
  if (!el || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const tokenSize = el.offsetWidth;
  const startX = e.clientX;
  const startY = e.clientY;

  const originalLeft = parseInt(el.style.left) || 0;
  const originalTop = parseInt(el.style.top) || 0;
  let hasMoved = false;

  function onMouseMove(ev) {
    if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
      hasMoved = true;
    }
    let x = ev.clientX - rect.left - tokenSize / 2;
    let y = ev.clientY - rect.top - tokenSize / 2;
    x = Math.max(0, Math.min(canvas.clientWidth - tokenSize, x));
    y = Math.max(0, Math.min(canvas.clientHeight - tokenSize, y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  async function onMouseUp(ev) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (!hasMoved) {
      if (typeof selectTargetToken === 'function') {
        selectTargetToken(tokenId);
      }
      return;
    }

    let rawX = parseInt(el.style.left) || 0;
    let rawY = parseInt(el.style.top) || 0;

    const snappedX = Math.round(rawX / currentGridSize) * currentGridSize + 3;
    const snappedY = Math.round(rawY / currentGridSize) * currentGridSize + 3;

    // ПРОВЕРКА ЛИМИТА ДВИЖЕНИЯ В БОЮ
    if (isCombatActive) {
      const dxCells = Math.abs(Math.round(snappedX / currentGridSize) - Math.round(originalLeft / currentGridSize));
      const dyCells = Math.abs(Math.round(snappedY / currentGridSize) - Math.round(originalTop / currentGridSize));
      const distanceMoved = Math.max(dxCells, dyCells) * 5;

      const remaining = window.combatMovementPool?.remainingFeet || 0;

      if (distanceMoved > remaining) {
        alert(`Недостаточно очков движения! Попытка пройти: ${distanceMoved} фт, осталось: ${remaining} фт.`);
        el.style.left = originalLeft + 'px';
        el.style.top = originalTop + 'px';
        return;
      }

      window.combatMovementPool.remainingFeet -= distanceMoved;
      if (typeof window.updateMovementDisplay === 'function') {
        window.updateMovementDisplay();
      }
    }

    el.style.left = snappedX + 'px';
    el.style.top = snappedY + 'px';

    const tokens = mapData.tokens || [];
    const tok = tokens.find(t => t.id === tokenId);
    if (tok) {
      tok.x = snappedX;
      tok.y = snappedY;
      await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}




// --- ЛИНЕЙКА-СТРЕЛОЧКА РАССТОЯНИЯ (RULER) ---
function initRulerEvents() {
  const canvas = document.getElementById('battleMapCanvas');
  const svg = document.getElementById('battleMapRulerSvg');
  const line = document.getElementById('rulerLine');
  const badge = document.getElementById('rulerBadge');
  if (!canvas || !svg || !line || !badge) return;

  canvas.oncontextmenu = (e) => e.preventDefault(); // Запрещаем контекстное меню на карте

  canvas.addEventListener('mousedown', (e) => {
    // Активация по правой кнопке мыши (button === 2) или левой с зажатым Shift
    if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      isMeasuring = true;
      rulerStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      svg.classList.remove('hidden');
      badge.classList.remove('hidden');

      line.setAttribute('x1', rulerStart.x);
      line.setAttribute('y1', rulerStart.y);
      line.setAttribute('x2', rulerStart.x);
      line.setAttribute('y2', rulerStart.y);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMeasuring) return;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0, Math.min(canvas.clientWidth, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(canvas.clientHeight, e.clientY - rect.top));

    line.setAttribute('x2', curX);
    line.setAttribute('y2', curY);

    // Расчет расстояния: гипотенуза в пикселях / размер сетки * 5 футов
    const dx = curX - rulerStart.x;
    const dy = curY - rulerStart.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const cells = (distPx / currentGridSize).toFixed(1);
    const feet = Math.round(cells * 5);

    badge.textContent = `📏 ${feet} фт (${cells} кл)`;
    badge.style.left = `${curX + 15}px`;
    badge.style.top = `${curY - 15}px`;
  });

  window.addEventListener('mouseup', (e) => {
    if (isMeasuring && (e.button === 2 || e.button === 0)) {
      isMeasuring = false;
      svg.classList.add('hidden');
      badge.classList.add('hidden');
    }
  });
}

// --- СЕТКА И ЗАГРУЗКА КАРТ ---
async function changeMapGridSize(newSize) {
  currentGridSize = Math.max(20, Math.min(150, parseInt(newSize) || 50));
  const overlay = document.getElementById('battleMapGridOverlay');
  if (overlay) {
    overlay.style.backgroundSize = `${currentGridSize}px ${currentGridSize}px`;
  }
  try {
    await apiFetch(`/parties/${partyId}/map`, {
      method: 'PATCH',
      body: { grid_size: currentGridSize }
    });
    renderBattleMap();
  } catch (e) {}
}


async function uploadMapImageFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token.replace(/^Bearer\s+/i, '')}`;

    const res = await fetch(`/parties/${partyId}/map/upload`, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      await apiFetch(`/parties/${partyId}/map`, {
        method: 'PATCH',
        body: { image_url: data.image_url }
      });
      renderBattleMap();
      alert("Карта успешно загружена на сервер!");
    }
  } catch (e) {
    alert("Ошибка загрузки карты: " + e.message);
  } finally {
    event.target.value = '';
  }
}

// --- АТЛАС ЛОКАЦИЙ МАСТЕРА ---

// Переменная для отслеживания текущей выбранной карты в Атласе
let activeAtlasIndex = null;

function renderMapPresetsDropdown() {
  const sel = document.getElementById('mapPresetSelect');
  if (!sel) return;

  const key = `party_${partyId}_map_atlas`;
  const presets = JSON.parse(localStorage.getItem(key) || '[]');

  if (presets.length === 0) {
    sel.innerHTML = '<option value="">-- Атлас пуст --</option>';
    activeAtlasIndex = null;
    return;
  }

  // Если активная карта совпадает по URL, ставим её выбранной
  if (mapData && mapData.image_url) {
    const foundIdx = presets.findIndex(p => p.image_url === mapData.image_url);
    if (foundIdx !== -1) activeAtlasIndex = foundIdx;
  }

  sel.innerHTML = presets.map((p, idx) => {
    const isSelected = activeAtlasIndex === idx ? 'selected' : '';
    return `<option value="${idx}" ${isSelected}>📍 ${p.title}</option>`;
  }).join('');
}

async function switchActiveMapPreset(val) {
  if (val === '' || val === null) return;
  const idx = parseInt(val);
  const key = `party_${partyId}_map_atlas`;
  const presets = JSON.parse(localStorage.getItem(key) || '[]');
  const chosen = presets[idx];
  if (!chosen) return;

  activeAtlasIndex = idx;

  try {
    const res = await apiFetch(`/parties/${partyId}/map`, {
      method: 'PATCH',
      body: {
        image_url: chosen.image_url,
        grid_size: chosen.grid_size || 50
      }
    });
    if (res.ok) {
      renderBattleMap();
    }
  } catch (e) {
    console.error("Ошибка смены локации:", e);
  }
}

async function deleteActiveMapPreset() {
  const sel = document.getElementById('mapPresetSelect');
  const val = sel ? sel.value : '';

  if (val === '' || val === null || val === undefined) {
    alert("В Атласе нет выбранной карты для удаления!");
    return;
  }

  const idx = parseInt(val);
  const key = `party_${partyId}_map_atlas`;
  const presets = JSON.parse(localStorage.getItem(key) || '[]');
  const toDelete = presets[idx];
  if (!toDelete) return;

  if (!confirm(`Удалить карту «${toDelete.title}» из Атласа?`)) return;

  presets.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(presets));

  activeAtlasIndex = presets.length > 0 ? 0 : null;
  renderMapPresetsDropdown();

  // Если удалили ту, на которой стояли — переключаем на первую оставшуюся
  if (presets.length > 0) {
    switchActiveMapPreset(0);
  }

  alert(`Карта «${toDelete.title}» удалена из вашего Атласа.`);
}

function openSaveMapModal() {
  document.getElementById('saveMapModal')?.classList.remove('hidden');
}

async function confirmSaveMapPreset() {
  const title = document.getElementById('newMapTitleInput')?.value.trim();
  if (!title || !mapData || !mapData.image_url) {
    alert("Укажите название карты и загрузите фон!");
    return;
  }

  const key = `party_${partyId}_map_atlas`;
  const presets = JSON.parse(localStorage.getItem(key) || '[]');
  presets.push({
    title: title,
    image_url: mapData.image_url,
    grid_size: currentGridSize
  });
  localStorage.setItem(key, JSON.stringify(presets));

  document.getElementById('saveMapModal')?.classList.add('hidden');
  renderMapPresetsDropdown();
  alert(`Карта «${title}» сохранена в ваш Атлас!`);
}

// --- ВЫСАДКА ОТРЯДА И УПРАВЛЕНИЕ ТОКЕНАМИ ---
async function deployPartySquadToMap() {
  if (!partyData || !partyData.members) return;
  const tokens = mapData.tokens || [];

  partyData.members.forEach((m, idx) => {
    if (!m.character_id) return;
    const existing = tokens.find(t => t.character_id === m.character_id);
    if (!existing) {
      tokens.push({
        id: "tok_hero_" + m.character_id,
        character_id: m.character_id,
        name: m.character_name || m.username,
        avatar_url: m.avatar_url || m.banner_url || '',
        hp_current: m.character_hp_current !== undefined ? m.character_hp_current : 10,
        hp_max: m.character_hp_max || 10,
        type: "ally",
        size: 1,
        x: (1 + (idx % 4)) * currentGridSize + 3,
        y: (1 + Math.floor(idx / 4)) * currentGridSize + 3
      });
    }
  });

  try {
    await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    renderBattleMap();
  } catch (e) {}
}

function openAddTokenModal() {
  const modal = document.getElementById('addTokenModal');
  const sel = document.getElementById('quickNpcTokenSelect');
  if (modal) modal.classList.remove('hidden');

  if (sel && typeof dmNpcsList !== 'undefined') {
    sel.innerHTML = '<option value="">-- Создать вручную или выберите НИПа --</option>' +
      (dmNpcsList || []).map((n, idx) => `<option value="${idx}">🎭 ${n.name} (${n.hp_max || 10} HP)</option>`).join('');
  }
}

function closeAddTokenModal() {
  document.getElementById('addTokenModal')?.classList.add('hidden');
}

function fillTokenFromNpc(idx) {
  if (idx === '' || typeof dmNpcsList === 'undefined') return;
  const n = dmNpcsList[idx];
  if (!n) return;

  document.getElementById('newTokenName').value = n.name;
  document.getElementById('newTokenHp').value = n.hp_max || 20;
  document.getElementById('newTokenAvatar').value = n.avatar_url || n.banner_url || '';
  document.getElementById('newTokenType').value = 'enemy';
}

async function uploadTokenImageFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token.replace(/^Bearer\s+/i, '')}`;

    const res = await fetch(`/parties/${partyId}/tokens/upload`, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      document.getElementById('newTokenAvatar').value = data.image_url;
      document.getElementById('tokenUploadLabelText').textContent = "✓ Загружено!";
    }
  } catch (e) {
    alert("Ошибка загрузки портрета токена: " + e.message);
  } finally {
    event.target.value = '';
  }
}

async function submitNewMapToken(e) {
  e.preventDefault();
  const name = document.getElementById('newTokenName').value.trim();
  const type = document.getElementById('newTokenType').value;
  const size = parseInt(document.getElementById('newTokenSize').value) || 1;
  const hp = parseInt(document.getElementById('newTokenHp').value) || 15;
  const avatar = document.getElementById('newTokenAvatar').value.trim();

  const tokens = mapData.tokens || [];
  tokens.push({
    id: "tok_" + Date.now(),
    name: name,
    type: type,
    size: size,
    hp_current: hp,
    hp_max: hp,
    avatar_url: avatar,
    x: 2 * currentGridSize + 3,
    y: 2 * currentGridSize + 3
  });

  try {
    await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    closeAddTokenModal();
    renderBattleMap();
    e.target.reset();
  } catch (err) {}
}

async function deleteMapToken(tokenId) {
  if (!confirm("Удалить этот токен с карты?")) return;
  const tokens = (mapData.tokens || []).filter(t => t.id !== tokenId);
  try {
    await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    renderBattleMap();
  } catch (e) {}
}

let isDarkGrid = false;
function toggleGridContrast() {
  const overlay = document.getElementById('battleMapGridOverlay');
  if (!overlay) return;
  isDarkGrid = !isDarkGrid;
  const color = isDarkGrid ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.25)';
  overlay.style.backgroundImage = `
    linear-gradient(to right, ${color} 1px, transparent 1px),
    linear-gradient(to bottom, ${color} 1px, transparent 1px)
  `;
}

async function uploadPartyBannerFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await apiFetch(`/parties/${partyId}/banner`, {
      method: "POST",
      body: formData // apiFetch сам определит FormData и не будет ставить application/json
    });

    if (res.ok) {
      const data = await res.json();
      // Мгновенно обновляем фон шапки без перезагрузки страницы
      const bannerEl = document.getElementById("partyBannerHeader");
      if (bannerEl) {
        bannerEl.style.backgroundImage = `linear-gradient(to top, rgba(12, 10, 9, 0.95) 0%, rgba(12, 10, 9, 0.4) 60%, transparent 100%), url('${data.banner_url}')`;
      }
      alert("Баннер кампании успешно обновлен!");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Ошибка при загрузке баннера");
    }
  } catch (e) {
    console.error("Сбой загрузки баннера:", e);
    alert("Не удалось загрузить изображение");
  } finally {
    event.target.value = ""; // сбрасываем инпут
  }
}

// --- ЗУМ И МАСШТАБИРОВАНИЕ КАРТЫ ---
let currentMapZoom = 1.0;

function zoomBattleMap(delta) {
  currentMapZoom = Math.max(0.5, Math.min(2.0, parseFloat((currentMapZoom + delta).toFixed(2))));
  applyMapZoom();
}

function resetBattleMapZoom() {
  currentMapZoom = 1.0;
  applyMapZoom();
}

function applyMapZoom() {
  const wrapper = document.getElementById('battleMapZoomWrapper');
  const badge = document.getElementById('mapZoomBadge');
  if (wrapper) {
    wrapper.style.transform = `scale(${currentMapZoom})`;
  }
  if (badge) {
    badge.textContent = `${Math.round(currentMapZoom * 100)}%`;
  }
}

// --- НАСТРОЙКИ РАДИУСОВ ЗРЕНИЯ (В КЛЕТКАХ) ---
window.fogNormalVisionCells = parseInt(localStorage.getItem('fog_normal_cells')) || 6;
window.fogDarkVisionCells = parseInt(localStorage.getItem('fog_dark_cells')) || 12;

window.changeVisionRadius = function(type, val) {
  const cells = parseInt(val) || 6;
  if (type === 'normal') {
    window.fogNormalVisionCells = cells;
    localStorage.setItem('fog_normal_cells', cells);
    const lbl = document.getElementById('labelNormalVision');
    if (lbl) lbl.textContent = cells;
  } else if (type === 'dark') {
    window.fogDarkVisionCells = cells;
    localStorage.setItem('fog_dark_cells', cells);
    const lbl = document.getElementById('labelDarkVision');
    if (lbl) lbl.textContent = cells;
  }
  if (window.fogEnabled) {
    window.renderFogOfWar();
  }
};

// --- ТУМАН ВОЙНЫ: ЧЕТКАЯ ГРАНИЦА ДЛЯ ДМ, КИСТЬ И ДИНАМИКА ---
window.fogEnabled = false;
window.fogMode = 'combat'; // 'combat' | 'vision' | 'brush'
window.fogBrushAction = 'erase'; // 'erase' (ластик) | 'paint' (закраска)
window.fogBrushRadius = 50;
let isFogDrawing = false;

// Оффскрин-маска ручной кисти
let brushMaskCanvas = null;
let brushMaskCtx = null;

function ensureBrushMask() {
  if (!brushMaskCanvas) {
    brushMaskCanvas = document.createElement('canvas');
    brushMaskCanvas.width = 1000;
    brushMaskCanvas.height = 750;
    brushMaskCtx = brushMaskCanvas.getContext('2d');
    // По умолчанию маска пустая (всё покрыто туманом)
    brushMaskCtx.clearRect(0, 0, 1000, 750);
  }
}

window.toggleFogOfWarMode = function() {
  window.fogEnabled = !window.fogEnabled;
  const fogCanvas = document.getElementById('fogOfWarCanvas');
  const btn = document.getElementById('btnToggleFog');
  const modeBlock = document.getElementById('fogModeSelectBlock');
  if (!fogCanvas) return;

  if (window.fogEnabled) {
    fogCanvas.classList.remove('hidden');
    if (btn) btn.className = "px-2.5 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold shadow";
    if (modeBlock) modeBlock.classList.remove('hidden');
    initFogBrushEvents();
    window.renderFogOfWar();
  } else {
    fogCanvas.classList.add('hidden');
    if (btn) btn.className = "px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 text-xs font-bold hover:border-amber-400";
    if (modeBlock) modeBlock.classList.add('hidden');
    document.querySelectorAll('[id^="token_"]').forEach(el => el.classList.remove('token-fog-hidden'));
  }
};

window.setFogMode = function(mode) {
  window.fogMode = mode;
  const fogCanvas = document.getElementById('fogOfWarCanvas');
  const subBar = document.getElementById('fogBrushSubBar');

  const btnCombat = document.getElementById('btnFogCombat');
  const btnVision = document.getElementById('btnFogVision');
  const btnBrush = document.getElementById('btnFogBrush');

  if (btnCombat) btnCombat.className = (mode === 'combat') ? "px-2 py-1 rounded bg-amber-400 text-stone-950 font-bold" : "px-2 py-1 rounded text-stone-300 hover:text-amber-200";
  if (btnVision) btnVision.className = (mode === 'vision') ? "px-2 py-1 rounded bg-amber-400 text-stone-950 font-bold" : "px-2 py-1 rounded text-stone-300 hover:text-amber-200";
  if (btnBrush) btnBrush.className = (mode === 'brush') ? "px-2 py-1 rounded bg-amber-400 text-stone-950 font-bold" : "px-2 py-1 rounded text-stone-300 hover:text-amber-200";

  if (mode === 'brush') {
    if (subBar) subBar.classList.remove('hidden');
    // Включаем прием кликов мыши на холст тумана
    if (fogCanvas) {
      fogCanvas.style.pointerEvents = 'auto';
      fogCanvas.style.cursor = 'crosshair';
    }
  } else {
    if (subBar) subBar.classList.add('hidden');
    // Отключаем перехват кликов, чтобы мышь двигала фишки на карте
    if (fogCanvas) {
      fogCanvas.style.pointerEvents = 'none';
      fogCanvas.style.cursor = 'default';
    }
  }

  window.renderFogOfWar();
};

window.setFogBrushAction = function(action) {
  window.fogBrushAction = action;
  const btnE = document.getElementById('btnBrushErase');
  const btnP = document.getElementById('btnBrushPaint');
  if (btnE) btnE.className = (action === 'erase') ? "px-2 py-0.5 rounded bg-emerald-600 text-white font-bold" : "px-2 py-0.5 rounded bg-stone-800 text-stone-300";
  if (btnP) btnP.className = (action === 'paint') ? "px-2 py-0.5 rounded bg-rose-700 text-white font-bold" : "px-2 py-0.5 rounded bg-stone-800 text-stone-300";
};

window.changeFogBrushRadius = function(val) {
  window.fogBrushRadius = parseInt(val) || 50;
};

// ОБРАБОТЧИКИ МЫШИ ДЛЯ КИСТИ
let fogEventsBound = false;
function initFogBrushEvents() {
  if (fogEventsBound) return;
  const fogCanvas = document.getElementById('fogOfWarCanvas');
  if (!fogCanvas) return;
  ensureBrushMask();

  fogCanvas.addEventListener('mousedown', (e) => {
    if (!window.fogEnabled || window.fogMode !== 'brush') return;
    isFogDrawing = true;
    applyBrushStroke(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isFogDrawing && window.fogMode === 'brush') {
      applyBrushStroke(e);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isFogDrawing) {
      isFogDrawing = false;
    }
  });

  function applyBrushStroke(e) {
    const rect = fogCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    brushMaskCtx.beginPath();
    brushMaskCtx.arc(x, y, window.fogBrushRadius, 0, Math.PI * 2);

    if (window.fogBrushAction === 'erase') {
      // Стираем туман (делаем прозрачным)
      brushMaskCtx.globalCompositeOperation = 'destination-out';
      brushMaskCtx.fill();
    } else {
      // Закрашиваем (возвращаем тьму)
      brushMaskCtx.globalCompositeOperation = 'source-over';
      brushMaskCtx.fillStyle = 'rgba(0,0,0,1)';
      brushMaskCtx.fill();
    }
    window.renderFogOfWar();
  }

  fogEventsBound = true;
}

// ОСНОВНОЙ РЕНДЕР ТУМАНА
window.renderFogOfWar = function() {
  const fogCanvas = document.getElementById('fogOfWarCanvas');
  if (!fogCanvas || !window.fogEnabled) return;
  const ctx = fogCanvas.getContext('2d');
  const tokens = window.mapData?.tokens || [];
  const gSize = window.currentGridSize || 50;

  const pData = window.partyData;
  const uData = window.currentUserData;
  const isDm = Boolean(
    (pData && (pData.is_current_user_dm || (uData && pData.dm_id === uData.id))) ||
    uData?.username === "Ent1XXX" ||
    document.getElementById('partyRoleBadge')?.textContent.includes('Мастер')
  );

  ensureBrushMask();
  ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

  // 1. БАЗОВАЯ ПЛОТНОСТЬ ТУМАНА
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = isDm ? "rgba(4, 2, 2, 0.78)" : "rgba(0, 0, 0, 1.0)";
  ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

  // Кисть DM
  if (window.fogMode === 'brush') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(brushMaskCanvas, 0, 0);
  }

  // 2. РАСЧЕТ ИСТОЧНИКОВ СВЕТА СТРОГО ПО ПОЛЗУНКАМ
  const lightSources = [];

  tokens.forEach(t => {
    if (t.type === 'ally' || t.character_id) {
      const tokenPx = (t.size || 1) * gSize;
      const cx = t.x + tokenPx / 2;
      const cy = t.y + tokenPx / 2;

      // Проверка на темное зрение
      const charRace = String(t.race || '').toLowerCase();
      const hasDarkvision = /эльф|гном|дворф|тифлинг|полуорк|илверн/i.test(charRace);

      const cells = hasDarkvision ? window.fogDarkVisionCells : window.fogNormalVisionCells;
      const exactRadiusPx = cells * gSize;

      lightSources.push({ cx, cy, radius: exactRadiusPx, isDarkvision: hasDarkvision });
    }
  });

  // 3. ПРОРЕЗАЕМ СВЕТ БЕЗ РАЗДУВАНИЯ
  ctx.globalCompositeOperation = 'destination-out';
  lightSources.forEach(s => {
    // Делаем четкий срез света: до 95% радиуса 100% прозрачность, без градиентных хвостов
    const grad = ctx.createRadialGradient(s.cx, s.cy, s.radius * 0.92, s.cx, s.cy, s.radius);
    grad.addColorStop(0, "rgba(0, 0, 0, 1)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 4. ПУНКТИРНАЯ ГРАНИЦА ДЛЯ ДМА (СТРОГО ПО ТОМУ ЖЕ РАДИУСУ)
  if (isDm) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

    lightSources.forEach(s => {
      // Янтарный пунктир для обычного зрения, голубоватый для темного
      ctx.strokeStyle = s.isDarkvision ? "rgba(56, 189, 248, 0.85)" : "rgba(245, 158, 11, 0.85)";
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  // 5. СКРЫТИЕ ВРАГОВ ВНЕ ЗОНЫ
  tokens.forEach(t => {
    const tokenEl = document.getElementById(`token_${t.id}`);
    if (!tokenEl) return;

    if (t.type === 'ally' || t.character_id) {
      tokenEl.classList.remove('token-fog-hidden');
      tokenEl.style.opacity = "1";
      return;
    }

    const tPx = (t.size || 1) * gSize;
    const tCx = t.x + tPx / 2;
    const tCy = t.y + tPx / 2;

    const isVisible = lightSources.some(s => {
      const dist = Math.sqrt((s.cx - tCx) ** 2 + (s.cy - tCy) ** 2);
      return dist <= s.radius;
    });

    if (isVisible) {
      tokenEl.classList.remove('token-fog-hidden');
      tokenEl.style.opacity = "1";
    } else {
      if (isDm) {
        tokenEl.classList.remove('token-fog-hidden');
        tokenEl.style.opacity = "0.35";
      } else {
        tokenEl.classList.add('token-fog-hidden');
        tokenEl.style.opacity = "0";
      }
    }
  });
};


// --- ИНТЕРАКТИВНОЕ НАВЕДЕНИЕ И ПОДСВЕТКА AOE-ЗАКЛИНАНИЙ ---

function initAoeTargeting() {
  const canvas = document.getElementById('battleMapCanvas');
  if (!canvas) return;

  // Создаем слой подсветки области, если его нет
  let aoeOverlay = document.getElementById('aoeTargetingOverlay');
  if (!aoeOverlay) {
    aoeOverlay = document.createElement('div');
    aoeOverlay.id = 'aoeTargetingOverlay';
    aoeOverlay.className = "absolute rounded-full border-2 border-rose-500 bg-rose-500/25 pointer-events-none z-40 hidden shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse";
    canvas.appendChild(aoeOverlay);
  }

  function onMapMouseMove(e) {
    if (!window.activeAoeSpell) return;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    const gridSize = currentGridSize || 50;
    // Радиус сферы: 20 футов = 4 клетки сетки = gridSize * 4 радиус (диаметр * 2)
    const radiusPx = (window.activeAoeSpell.radiusFeet / 5) * gridSize;
    const diameterPx = radiusPx * 2;

    aoeOverlay.style.width = diameterPx + 'px';
    aoeOverlay.style.height = diameterPx + 'px';
    aoeOverlay.style.left = (curX - radiusPx) + 'px';
    aoeOverlay.style.top = (curY - radiusPx) + 'px';
    aoeOverlay.classList.remove('hidden');
  }

  async function onMapClick(e) {
    if (!window.activeAoeSpell) return;
    e.stopPropagation();

    const spell = window.activeAoeSpell;
    window.activeAoeSpell = null;
    aoeOverlay.classList.add('hidden');

    canvas.removeEventListener('mousemove', onMapMouseMove);
    canvas.removeEventListener('click', onMapClick);

    const rect = canvas.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;

    // Списываем ячейку
    if (spell.circle >= 1 && spell.char) {
      const slots = window.getCharacterSlots(spell.char);
      if (slots[spell.circle] && slots[spell.circle].cur > 0) {
        slots[spell.circle].cur -= 1;
        window.saveCharacterSlots(spell.char.id, slots);
      }
    }

    // Бросок урона (например 8d6 для Огненного шара)
    const dmg = window.rollDiceFormula(spell.damage || '8d6', false);

    // Находим все токены в радиусе взрыва
    const gridSize = currentGridSize || 50;
    const radiusPx = (spell.radiusFeet / 5) * gridSize;
    const tokens = window.mapData?.tokens || [];
    const hitTokens = [];

    tokens.forEach(t => {
      const tokCenterX = t.x + 25;
      const tokCenterY = t.y + 25;
      const distPx = Math.sqrt((tokCenterX - centerX)**2 + (tokCenterY - centerY)**2);
      if (distPx <= radiusPx) {
        hitTokens.push(t);
      }
    });

    // Наносим урон пораженным существам
    for (const t of hitTokens) {
      window.activeHudTokenId = t.id;
      await window.applyTokenDamageSilently(-dmg.total);
      window.triggerVisualFx(t.id, 'fire');
    }

    window.combatEconomy.hasAction = false;
    window.updateEconomyBadges();

    const targetNames = hitTokens.map(t => t.name).join(', ') || 'никто не задет';
    const msg = `💥 ВЗРЫВ AOE: «${spell.name}» (сфера ${spell.radiusFeet} фт)!\n🔥 Урон: ${dmg.total} (${dmg.text})\n🎯 Задеты: ${targetNames}`;

    window.showDiceRollModal(`Взрыв [${spell.name}]`, dmg.total, 0, dmg.total, `Задето целей: ${hitTokens.length}`);
    window.broadcastFeatureUse(msg);

    const currentCombatant = window.combatState.combatants[window.combatState.current_turn_index];
    if (currentCombatant) window.renderPlayerFullArsenal(currentCombatant);
  }

  canvas.addEventListener('mousemove', onMapMouseMove);
  canvas.addEventListener('click', onMapClick);
}

document.addEventListener('DOMContentLoaded', () => {
  const slNorm = document.getElementById('sliderNormalVision');
  const slDark = document.getElementById('sliderDarkVision');
  const lbNorm = document.getElementById('labelNormalVision');
  const lbDark = document.getElementById('labelDarkVision');
  if (slNorm && lbNorm) {
    slNorm.value = window.fogNormalVisionCells;
    lbNorm.textContent = window.fogNormalVisionCells;
  }
  if (slDark && lbDark) {
    slDark.value = window.fogDarkVisionCells;
    lbDark.textContent = window.fogDarkVisionCells;
  }
});