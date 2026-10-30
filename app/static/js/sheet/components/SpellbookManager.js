export class SpellbookManager {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;
    this.currentCircle = 'all';
    this.compendiumSpells = [];
  }

  init() {
    this.renderSlotsTracker();
    this.renderSpellsList();
  }

  // --- ЯЧЕЙКИ ЗАКЛИНАНИЙ ---

  renderSlotsTracker() {
    const tracker = document.getElementById('slotsTrackerGrid');
    if (!tracker) return;

    const char = this.state.get();
    const slots = char?.spell_slots || {};
    tracker.innerHTML = '';
    let hasSlots = false;

    for (let lvl = 1; lvl <= 9; lvl++) {
      const s = slots[String(lvl)];
      if (s && s.max > 0) {
        hasSlots = true;
        let circles = '';
        for (let i = 0; i < s.max; i++) {
          const isUsed = i < s.used;
          const usedStyle = "background-color: transparent; border: 1.5px dashed #78716c; opacity: 0.4;";
          const activeStyle = "background: linear-gradient(135deg, #ea580c, #fbbf24); border: 1.5px solid #fef08a; box-shadow: 0 0 10px rgba(245, 158, 11, 0.7);";
          circles += `
            <button type="button" onclick="window.spellbook.toggleSlot(${lvl}, ${i})"
              style="width: 1.1rem; height: 1.1rem; border-radius: 9999px; transition: all 0.2s; ${isUsed ? usedStyle : activeStyle}"
              title="${isUsed ? 'Потрачена (клик — восстановить)' : 'Доступна (клик — потратить)'}">
            </button>
          `;
        }
        tracker.innerHTML += `
          <div class="bg-[#0e0907]/90 dynamic-border border rounded-xl p-3 text-center shadow space-y-2">
            <span class="text-xs text-amber-300 font-bold block">${lvl} круг</span>
            <div class="flex flex-wrap items-center justify-center gap-1">${circles}</div>
            <span class="font-mono text-stone-400 text-[11px]">${s.max - s.used} / ${s.max}</span>
          </div>`;
      }
    }

    if (!hasSlots) {
      tracker.innerHTML = '<div class="col-span-full text-center text-xs text-stone-500 italic">Нет ячеек магии.</div>';
    }
  }

  async toggleSlot(level, index) {
    const char = this.state.get();
    const slots = char?.spell_slots || {};
    const slot = slots[String(level)];
    if (!slot) return;

    const newUsed = (index < slot.used) ? index : index + 1;
    try {
      const res = await apiFetch(`/characters/${char.id}/slots`, {
        method: 'PATCH',
        body: { level, used: newUsed }
      });
      if (res.ok) {
        slot.used = newUsed;
        this.renderSlotsTracker();
      }
    } catch (e) {
      console.error("Ошибка обновления ячеек:", e);
    }
  }

  // --- СПИСОК ЗАКЛИНАНИЙ И ФИЛЬТРАЦИЯ ---

  selectCircle(lvl) {
    this.currentCircle = lvl;
    ['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(l => {
      const b = document.getElementById(`sc_tab_${l}`);
      if (b) {
        b.className = (l === lvl)
          ? "px-3 py-1 rounded-lg bg-amber-400 text-stone-950 font-bold text-xs"
          : "px-3 py-1 rounded-lg bg-stone-900 text-stone-400 text-xs hover:text-stone-200";
      }
    });
    this.renderSpellsList();
  }

  renderSpellsList() {
    const cont = document.getElementById('spellsContainer');
    if (!cont) return;

    const char = this.state.get();
    let spells = char?.spells || [];

    if (this.currentCircle !== 'all' && this.currentCircle !== null && this.currentCircle !== undefined) {
      const targetLvl = parseInt(this.currentCircle);
      spells = spells.filter(s => {
        const spLvl = typeof s === 'object' ? (parseInt(s.level) || 0) : 0;
        return spLvl === targetLvl;
      });
    }

    if (!spells.length) {
      cont.innerHTML = '<div class="p-6 fox-card dynamic-card rounded-xl border border-dashed border-orange-900/40 text-center text-stone-400 text-xs">Заклинания для этого круга не найдены.</div>';
      return;
    }

    cont.innerHTML = spells.map(sp => {
      const name = typeof sp === 'string' ? sp : sp.name;
      const school = typeof sp === 'object' ? (sp.school || 'Магия') : 'Магия';
      const lvl = typeof sp === 'object' ? (sp.level || 0) : 0;
      let dmg = typeof sp === 'object' && sp.damage_dice ? sp.damage_dice : null;
      const desc = typeof sp === 'object' && sp.description ? sp.description : '';

      if (!dmg && desc) {
        const match = desc.toLowerCase().replace(/к/g, 'd').match(/(\d+d\d+(?:[\+\-]\d+)?)/);
        if (match) dmg = match[1];
      }

      const lvlLabel = lvl === 0 ? 'Заговор' : `${lvl} круг`;

      return `
        <div onclick="window.diceRoller.rollFormula('Каст: ${name}', '${dmg || '1d8'}')"
          style="background-color: #120c08; border: 1px solid rgba(245, 158, 11, 0.25);"
          class="p-3.5 rounded-xl hover:border-amber-400 cursor-pointer flex justify-between items-center text-xs shadow transition-all">
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <strong style="color: #fde68a; font-size: 0.95rem; text-shadow: 0 1px 2px rgba(0,0,0,0.8);" class="font-serif">${name}</strong>
              <span style="background-color: rgba(67, 20, 7, 0.7); border: 1px solid rgba(245, 158, 11, 0.4); color: #fb923c;" class="px-2 py-0.5 rounded text-[10px] font-mono font-bold">${lvlLabel}</span>
              <span style="color: #a8a29e;" class="text-[11px] font-serif">• ${school}</span>
            </div>
            ${desc ? `<p style="color: #9ca3af; line-height: 1.45;" class="text-[11px] font-serif">${desc}</p>` : ''}
          </div>
          <div class="flex items-center gap-2 shrink-0 ml-3">
            ${dmg ? `<span style="background: linear-gradient(135deg, #c2410c, #ea580c); color: #fff; box-shadow: 0 2px 8px rgba(194, 65, 12, 0.4);" class="px-2.5 py-1 rounded font-mono font-bold hover:scale-105 transition-transform" title="Кликните для броска">🎲 ${dmg}</span>` : ''}
            <button type="button" onclick="event.stopPropagation(); window.spellbook.deleteSpell('${name}')" class="text-rose-400 font-bold hover:text-rose-300 p-1">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- МОДАЛКА D&D.SU ---

  async openModal() {
    this.populateLevelsFilter();
    document.getElementById('spellModal')?.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('spellModal')?.classList.add('hidden');
  }

  async loadCompendium() {
    if (this.compendiumSpells.length === 0) {
      try {
        // Пробуем сначала spells-list (из гримуара), если нет — spells
        let res = await apiFetch('/compendium/spells-list');
        if (!res.ok) {
          res = await apiFetch('/compendium/spells');
        }
        if (res.ok) {
          this.compendiumSpells = await res.json();
          // Сразу обновляем список для текущего выбранного круга
          this.filterByLevel();
        }
      } catch (e) {
        console.error("Ошибка загрузки заклинаний:", e);
      }
    }
  }

  // 1. Заполнение полей формы при выборе заклинания из Compensium
  applyCompendiumSelection(spellId) {
    if (!spellId) return;

    // Ищем заклинание и по id, и по русскому названию
    const s = (this.compendiumSpells || []).find(x =>
      String(x.id).toLowerCase().trim() === String(spellId).toLowerCase().trim() ||
      String(x.name).toLowerCase().trim() === String(spellId).toLowerCase().trim()
    );
    if (!s) return;

    const nameInput = document.getElementById('spellName');
    const lvlInput = document.getElementById('spellLevel');
    const schoolInput = document.getElementById('spellSchool');
    const dmgInput = document.getElementById('spellDamageDice');
    const descInput = document.getElementById('spellDescription');

    if (nameInput) nameInput.value = s.name || '';
    if (lvlInput) lvlInput.value = (s.level !== undefined && s.level !== null) ? s.level : 1;
    if (schoolInput) schoolInput.value = s.school || 'Воплощение';
    if (dmgInput) dmgInput.value = s.damage_dice || '';

    // Сохраняем скрытые мета-поля прямо в DOM-объект формы, чтобы передать в Pydantic SpellSchema
    const modalForm = document.querySelector('#spellModal form');
    if (modalForm) {
      modalForm.dataset.castTime = s.cast_time || '1 действие';
      modalForm.dataset.range = s.range || '60 футов';
      modalForm.dataset.components = s.components || 'В, С';
      modalForm.dataset.duration = s.duration || 'Мгновенная';
    }

    if (descInput) {
      descInput.value = s.description || '';
    }
  }

  // 2. Отправка формы строго под схему SpellSchema бэкенда
    async handleCreate(e) {
    e.preventDefault();
    const char = this.state.get();
    if (!char) return;

    const sName = document.getElementById('spellName')?.value?.trim();
    if (!sName) {
      alert("Укажите название заклинания!");
      return;
    }

    const sLevel = parseInt(document.getElementById('spellLevel')?.value) || 0;
    const sSchool = document.getElementById('spellSchool')?.value?.trim() || 'Воплощение';
    const sDmg = document.getElementById('spellDamageDice')?.value?.trim() || null;
    const sDesc = document.getElementById('spellDescription')?.value?.trim() || '';

    const modalForm = e.target;
    const castTime = modalForm.dataset?.castTime || "1 действие";
    const range = modalForm.dataset?.range || "60 футов";
    const components = modalForm.dataset?.components || "В, С";
    const duration = modalForm.dataset?.duration || "Мгновенная";

    // Строго под SpellSchema
    const payload = {
      name: sName,
      level: sLevel,
      school: sSchool,
      cast_time: castTime,
      range: range,
      components: components,
      duration: duration,
      description: sDesc,
      is_prepared: (sLevel === 0),
      is_cantrip: (sLevel === 0),
      damage_dice: sDmg
    };

    console.log("Отправка заклинания на сервер:", payload);

    try {
      // Передаем payload как обычный JS-объект (apiFetch сам сделает JSON.stringify)
      const res = await apiFetch(`/characters/${char.id}/spells`, {
        method: 'POST',
        body: payload
      });

      console.log("Статус ответа сервера:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("Ответ сервера:", data);

        if (data && Array.isArray(data.spells)) {
          char.spells = data.spells;
        } else {
          char.spells = char.spells || [];
          char.spells = char.spells.filter(s => (typeof s === 'string' ? s : s.name) !== sName);
          char.spells.push(payload);
        }

        this.closeModal();
        modalForm.reset();

        // Сбрасываем фильтр круга на добавленный спелл
        this.selectCircle(sLevel);

        if (window.diceRoller) {
          window.diceRoller.showToast(
            "📖 Гримуар пополнен",
            `«${sName}» (${sLevel === 0 ? 'Заговор' : sLevel + ' круг'}) вписано в книгу!`,
            "crit_success"
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Ошибка от сервера:", err);
        alert("Сервер отклонил запись: " + (err.detail || JSON.stringify(err)));
      }
    } catch (err) {
      console.error("Сетевая ошибка:", err);
      alert("Сбой сети: " + err.message);
    }
  }

  // 3. Открытие всех кругов вплоть до максимального ячеечного круга персонажа (6+ круг)
  populateLevelsFilter() {
    const lvlFilter = document.getElementById('spellAvailableLevelFilter');
    if (!lvlFilter) return;

    const char = this.state.get();
    const slots = char.spell_slots || {};
    let maxSlot = 5;

    for (let lvl = 1; lvl <= 9; lvl++) {
      if (slots[String(lvl)] && slots[String(lvl)].max > 0) {
        maxSlot = Math.max(maxSlot, lvl);
      }
    }
    if (char.level >= 11) maxSlot = Math.max(maxSlot, 6);
    if (char.level >= 13) maxSlot = Math.max(maxSlot, 7);
    if (char.level >= 15) maxSlot = Math.max(maxSlot, 8);
    if (char.level >= 17) maxSlot = Math.max(maxSlot, 9);

    let options = ['<option value="0">Заговоры (0 круг)</option>'];
    for (let lvl = 1; lvl <= maxSlot; lvl++) {
      options.push(`<option value="${lvl}">${lvl} круг заклинаний</option>`);
    }
    lvlFilter.innerHTML = options.join('');

    this.loadCompendium().then(() => this.filterByLevel());
  }



  filterByLevel() {
    const sel = document.getElementById('spellCompendiumSelect');
    const lvlFilter = document.getElementById('spellAvailableLevelFilter')?.value;
    if (!sel) return;

    const char = this.state.get() || {};
    const rawClass = String(char.class_name || '').toLowerCase().trim();
    const rawSub = String(char.subclass || '').toLowerCase().trim();

    // Определяем базовое имя класса без подклассов в скобках
    let targetClass = rawClass.split('(')[0].trim();
    if (targetClass.includes('волшебник') || rawSub.includes('очарован')) {
      targetClass = 'волшебник';
    }

    const circle = (lvlFilter === 'all' || !lvlFilter) ? null : parseInt(lvlFilter);

    // Считываем сохранённые закладки
    let bookmarkedIds = new Set();
    try {
      const rawBm = localStorage.getItem('user_bookmarked_spells');
      if (rawBm) {
        JSON.parse(rawBm).forEach(id => bookmarkedIds.add(String(id).toLowerCase().trim()));
      }
    } catch(e) {}

    // 1. Фильтруем заклинания
    let available = (this.compendiumSpells || []).filter(s => {
      // Фильтр по выбранному кругу
      if (circle !== null && s.level !== circle) return false;

      // Проверка принадлежности к классу
      const spellClasses = (s.classes || []).map(c => String(c).toLowerCase().trim());
      if (spellClasses.length === 0) return true; // Если классы не указаны, показываем всем

      return spellClasses.some(c => c.includes(targetClass) || targetClass.includes(c));
    });

    // Fallback: если из-за названия класса отфильтровалось вообще всё, показываем все заклинания этого круга
    if (available.length === 0 && (this.compendiumSpells || []).length > 0) {
      available = (this.compendiumSpells || []).filter(s => circle === null || s.level === circle);
    }

    if (available.length === 0) {
      sel.innerHTML = '<option value="">-- Заклинания для этого круга не найдены --</option>';
      return;
    }

    // 2. Раскладываем на закладки и обычные
    const bookmarkedList = [];
    const regularList = [];

    available.forEach(s => {
      const sId = String(s.id || '').toLowerCase().trim();
      const sName = String(s.name || '').toLowerCase().trim();
      if (bookmarkedIds.has(sId) || bookmarkedIds.has(sName)) {
        bookmarkedList.push(s);
      } else {
        regularList.push(s);
      }
    });

    let html = '<option value="">-- Выберите чары --</option>';

    if (bookmarkedList.length > 0) {
      html += `<optgroup label="⭐ Закладки из гримуара (${bookmarkedList.length})">`;
      html += bookmarkedList.map(s => {
        const lvlStr = s.level === 0 ? 'Заговор' : `${s.level} круг`;
        return `<option value="${s.id || s.name}">⭐ [${lvlStr}] ${s.name} (${s.school || 'Магия'})</option>`;
      }).join('');
      html += `</optgroup>`;
    }

    html += `<optgroup label="📖 Все доступные заклинания (${regularList.length})">`;
    html += regularList.map(s => {
      const lvlStr = s.level === 0 ? 'Заговор' : `${s.level} круг`;
      return `<option value="${s.id || s.name}">[${lvlStr}] ${s.name} (${s.school || 'Магия'})</option>`;
    }).join('');
    html += `</optgroup>`;

    sel.innerHTML = html;
  }



  async deleteSpell(name) {
    if (!confirm(`Удалить «${name}» из книги заклинаний?`)) return;
    const char = this.state.get();
    try {
      const res = await apiFetch(`/characters/${char.id}/spells/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (res.ok) {
        char.spells = (char.spells || []).filter(s => (typeof s === 'string' ? s : s.name) !== name);
        this.renderSpellsList();
      }
    } catch (e) {
      alert("Не удалось удалить заклинание: " + e.message);
    }
  }
}