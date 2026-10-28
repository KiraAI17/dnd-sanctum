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
    const currentCombatant = (combatState && combatState.is_active && combatState.combatants)
      ? combatState.combatants[combatState.current_turn_index]
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

      // Если сейчас ход этого существа — золотой пульсирующий ореол
      const isTurn = currentCombatant && (currentCombatant.token_id === t.id || currentCombatant.id === t.id);
      const turnRing = isTurn ? 'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.8)] scale-105' : '';

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
             class="absolute rounded-full border-2 ${borderColor} ${turnRing} bg-stone-900 shadow-2xl flex items-center justify-center select-none group transition-all ${cursorClass}"
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


// --- ПЕРЕТАСКИВАНИЕ С ПРИЛИПАНИЕМ К СЕТКЕ ---
function dragMapToken(e, tokenId) {
  if (e.button !== 0) return;
  if (e.target.tagName.toLowerCase() === 'button') return;
  e.preventDefault();

  const el = document.getElementById(`token_${tokenId}`);
  const canvas = document.getElementById('battleMapCanvas');
  if (!el || !canvas) return;

  const rect = canvas.getBoundingClientRect();
  const tokenSize = el.offsetWidth;
  const startX = e.clientX;
  const startY = e.clientY;
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

    // ЕСЛИ НЕ ДВИГАЛИ МЫШЬЮ — ЭТО ВЫБОР ЦЕЛИ!
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

