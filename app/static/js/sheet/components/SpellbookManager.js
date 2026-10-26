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
          circles += `
            <button type="button" onclick="window.spellbook.toggleSlot(${lvl}, ${i})"
              class="w-4 h-4 rounded-full border border-amber-400 transition-all ${
                isUsed
                  ? 'bg-transparent border-stone-600'
                  : 'bg-gradient-to-br from-foxOrange-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              }">
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
    ['all', 0, 1, 2, 3, 4, 5].forEach(l => {
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

    if (this.currentCircle !== 'all') {
      spells = spells.filter(s => (s.level || 0) === this.currentCircle);
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
          class="p-4 rounded-xl bg-[#0e0907] border border-orange-950 hover:border-amber-400 cursor-pointer flex justify-between items-center text-xs shadow transition-all">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <strong class="text-amber-200 text-sm font-serif">${name}</strong>
              <span class="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-[10px] font-mono">${lvlLabel}</span>
              <span class="text-stone-400 text-[11px]">${school}</span>
            </div>
            ${desc ? `<p class="text-stone-300 text-[11px] italic">${desc}</p>` : ''}
          </div>
          <div class="flex items-center gap-2">
            ${dmg ? `<span class="px-2.5 py-1 rounded bg-foxOrange-700 text-amber-100 font-mono font-bold hover:scale-105 transition-transform" title="Кликните для броска">🎲 ${dmg}</span>` : ''}
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
        const res = await apiFetch('/compendium/spells');
        if (res.ok) this.compendiumSpells = await res.json();
      } catch (e) {
        console.error("Ошибка загрузки заклинаний:", e);
      }
    }
  }

  populateLevelsFilter() {
    const lvlFilter = document.getElementById('spellAvailableLevelFilter');
    if (!lvlFilter) return;

    let options = ['<option value="0">Заговоры (0 круг)</option>'];
    for (let lvl = 1; lvl <= 5; lvl++) {
      options.push(`<option value="${lvl}">${lvl} круг заклинаний</option>`);
    }
    lvlFilter.innerHTML = options.join('');

    this.loadCompendium().then(() => this.filterByLevel());
  }

  filterByLevel() {
    const sel = document.getElementById('spellCompendiumSelect');
    const lvlFilter = document.getElementById('spellAvailableLevelFilter')?.value;
    if (!sel) return;

    const char = this.state.get();
    const rawClass = (char?.class_name || '').toLowerCase().trim();
    const rawSub = (char?.subclass || '').toLowerCase().trim();
    const charLvl = char?.level || 1;

    // Определяем целевой класс
    let targetClass = rawClass;
    if (rawClass.includes('плут') && rawSub.includes('мистический ловкач')) {
      targetClass = 'волшебник';
    }

    // Бард: «Тайны магии» (10+ ур. или Коллегия Знаний 6+ ур.) могут брать чары любого класса
    const isBardSecrets = rawClass.includes('бард') && (charLvl >= 10 || (rawSub.includes('знаний') && charLvl >= 6));

    const circle = (lvlFilter === 'all' || !lvlFilter) ? null : parseInt(lvlFilter);

    // ФИЛЬТРАЦИЯ:
    const available = (this.compendiumSpells || []).filter(s => {
      // 1. Фильтр по кругу
      if (circle !== null && s.level !== circle) return false;

      // 2. Если бард с Тайнами магии — разрешаем всё
      if (isBardSecrets) return true;

      // 3. Мистический ловкач: только школы Очарование и Иллюзия
      if (rawClass.includes('плут') && rawSub.includes('мистический ловкач') && s.level > 0) {
        const sch = (s.school || '').toLowerCase();
        const allowedSchool = sch.includes('иллюз') || sch.includes('очаров');
        const isWiz = (s.classes || []).map(c => c.toLowerCase()).includes('волшебник');
        return isWiz && allowedSchool;
      }

      // 4. Стандартная фильтрация по массиву classes из spells.json
      const spellClasses = (s.classes || []).map(c => String(c).toLowerCase().trim());
      return spellClasses.some(c => c.includes(targetClass) || targetClass.includes(c));
    });

    if (available.length === 0) {
      sel.innerHTML = '<option value="">-- Нет заклинаний для вашего класса --</option>';
      return;
    }

    sel.innerHTML = '<option value="">-- Выберите чары --</option>' +
      available.map(s => `<option value="${s.id || s.name}">[${s.level === 0 ? 'Заговор' : s.level + ' круг'}] ${s.name} (${s.school || ''})</option>`).join('');
  }

  applyCompendiumSelection(spellId) {
    if (!spellId) return;
    const s = (this.compendiumSpells || []).find(x => (x.id === spellId || x.name === spellId));
    if (!s) return;

    const nameInput = document.getElementById('spellName');
    const lvlInput = document.getElementById('spellLevel');
    const schoolInput = document.getElementById('spellSchool');
    const dmgInput = document.getElementById('spellDamageDice');
    const descInput = document.getElementById('spellDescription');

    if (nameInput) nameInput.value = s.name || '';
    if (lvlInput) lvlInput.value = s.level !== undefined ? s.level : 1;
    if (schoolInput) schoolInput.value = s.school || 'Воплощение';
    if (dmgInput) dmgInput.value = s.damage_dice || '';

    if (descInput) {
      let desc = s.description || '';
      const meta = [];
      if (s.cast_time) meta.push(`Время: ${s.cast_time}`);
      if (s.range) meta.push(`Дистанция: ${s.range}`);
      if (s.duration) meta.push(`Длительность: ${s.duration}`);
      if (s.components) meta.push(`Компоненты: ${s.components}`);
      if (meta.length > 0) desc = meta.join(' • ') + '\n\n' + desc;
      descInput.value = desc;
    }
  }

  async handleCreate(e) {
    e.preventDefault();
    const char = this.state.get();
    const payload = {
      name: document.getElementById('spellName').value,
      level: parseInt(document.getElementById('spellLevel').value),
      school: document.getElementById('spellSchool').value,
      damage_dice: document.getElementById('spellDamageDice').value || null,
      description: document.getElementById('spellDescription').value,
      is_prepared: true
    };

    try {
      const res = await apiFetch(`/characters/${char.id}/spells`, { method: 'POST', body: payload });
      if (res.ok) {
        const updated = await res.json();
        char.spells = updated.spells || char.spells;
        this.closeModal();
        e.target.reset();
        this.renderSpellsList();
      }
    } catch (err) {
      alert("Ошибка добавления заклинания: " + err.message);
    }
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