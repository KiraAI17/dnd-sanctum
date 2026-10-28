/**
 * SpellEngine.js
 * Механика заклинаний D&D 5e: разделение полных магов и полузаклинателей (Паладин),
 * честное списание ячеек без сброса в 0.
 */
export class SpellEngine {
  constructor(combatState, combatFx) {
    this.state = combatState;
    this.fx = combatFx;
    this.selectedCircle = 'all';
    this.cachedSpells = [];

    // 1. Полные заклинатели (Волшебник, Жрец, Друид, Чародей, Бард)
    this.fullCasterTable = {
      1: { 1: 2 },
      2: { 1: 3 },
      3: { 1: 4, 2: 2 },
      4: { 1: 4, 2: 3 },
      5: { 1: 4, 2: 3, 3: 2 },
      6: { 1: 4, 2: 3, 3: 3 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
    };

    // 2. Полузаклинатели (Паладин, Следопыт) - ячейки появляются с 2 уровня!
    this.halfCasterTable = {
      1: {},
      2: { 1: 2 },
      3: { 1: 3 },
      4: { 1: 3 },
      5: { 1: 4, 2: 2 },
      6: { 1: 4, 2: 2 },
      7: { 1: 4, 2: 3 },
      8: { 1: 4, 2: 3 },
      9: { 1: 4, 2: 3, 3: 2 },
      10: { 1: 4, 2: 3, 3: 2 },
      11: { 1: 4, 2: 3, 3: 3 },
      12: { 1: 4, 2: 3, 3: 3 },
      13: { 1: 4, 2: 3, 3: 3, 4: 1 },
      14: { 1: 4, 2: 3, 3: 3, 4: 1 },
      15: { 1: 4, 2: 3, 3: 3, 4: 2 },
      16: { 1: 4, 2: 3, 3: 3, 4: 2 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
    };
  }

  isHalfCaster(className) {
    const c = String(className || '').toLowerCase();
    return c.includes('паладин') || c.includes('paladin') || c.includes('следопыт') || c.includes('ranger');
  }

  /**
  * Получение ячеек персонажа строго по схеме бэкенда (Character.spell_slots)
  */
  getCharacterSlots(char) {
    if (!char) return {};

    // Берем актуальные ячейки из объекта персонажа (БД)
    let slotsData = char.spell_slots || {};
    if (typeof slotsData === 'string') {
      try { slotsData = JSON.parse(slotsData); } catch (e) { slotsData = {}; }
    }

    const slots = {};
    for (let lvl = 1; lvl <= 9; lvl++) {
      const s = slotsData[String(lvl)] || slotsData[lvl];
      if (s && s.max > 0) {
        const used = s.used || 0;
        slots[lvl] = {
          cur: Math.max(0, s.max - used),
          max: s.max,
          used: used
        };
      }
    }

    // Если у персонажа в БД поле пустое — рассчитываем по правилам 5e
    if (Object.keys(slots).length === 0) {
      const level = Math.max(1, Math.min(20, parseInt(char.level) || 1));
      const isHalf = this.isHalfCaster(char.class_name);
      const defaultTable = isHalf
        ? (this.halfCasterTable[level] || {})
        : (this.fullCasterTable[level] || { 1: 2 });

      for (let c = 1; c <= 9; c++) {
        if (defaultTable[c]) {
          slots[c] = { cur: defaultTable[c], max: defaultTable[c], used: 0 };
        }
      }
    }

    return slots;
  }

  /**
   * Списание ячейки через штатный API роутер бэкенда: PATCH /characters/{id}/slots
   */
  async spendSlot(charId, circle, char) {
    if (circle < 1 || !charId) return true;

    const slots = this.getCharacterSlots(char);
    const slot = slots[circle];
    if (!slot) return false;

    const newUsed = Math.min(slot.max, (slot.used || 0) + 1);

    // 1. Немедленно обновляем локально в объекте
    slot.used = newUsed;
    slot.cur = Math.max(0, slot.max - newUsed);
    if (char && char.spell_slots) {
      char.spell_slots[String(circle)] = { max: slot.max, used: newUsed };
    }

    // 2. Отправляем на бэкенд точно так же, как делает SpellbookManager.js
    try {
      await apiFetch(`/characters/${charId}/slots`, {
        method: 'PATCH',
        body: { level: circle, used: newUsed }
      });
    } catch (e) {
      console.error("Ошибка синхронизации ячейки с сервером:", e);
    }

    return true;
  }

  /**
   * Сбор заклинаний с автопоиском кубов урона (8к6 / 8d6)
   */
  extractSpells(char, cName) {
    let spells = [];
    if (Array.isArray(char.spells) && char.spells.length > 0) spells = char.spells;
    else if (Array.isArray(char.spells_known) && char.spells_known.length > 0) spells = char.spells_known;
    else {
      const raw = localStorage.getItem(`char_${char.character_id || char.id}_spells`);
      if (raw) {
        try { spells = JSON.parse(raw) || []; } catch (e) {}
      }
    }

    spells = spells.map(s => {
      if (typeof s === 'string') return { name: s, level: 1, range: "60 футов" };

      // Извлечение формулы урона из damage_dice или текста описания
      let dmg = s.damage_dice || s.damage || null;
      if (!dmg && s.description) {
        const match = s.description.match(/(\d+\s*[dкDК]\s*\d+(?:\s*[\+\-]\s*\d+)?)/i);
        if (match) dmg = match[1];
      }

      return {
        ...s,
        damage: dmg,
        level: s.level !== undefined ? parseInt(s.level) : 1
      };
    });

    this.cachedSpells = spells;
    return spells;
  }


  restoreAllSlots(charId) {
    localStorage.removeItem(`char_${charId}_spent_slots`);
  }

  parseRangeFeet(rangeStr) {
    if (!rangeStr) return 60;
    const s = String(rangeStr).toLowerCase().trim();
    if (s.includes('на себя') || s.includes('self')) return 0;
    if (s.includes('касание') || s.includes('touch')) return 5;
    const match = s.match(/(\d+)/);
    return match ? parseInt(match[1]) : 60;
  }

  renderSpellsUI(char, cName, onCastCallback, onDetailCallback) {
    const section = document.getElementById('playerSpellActionsSection');
    const list = document.getElementById('playerSpellActionsList');
    const slotsDisplay = document.getElementById('playerSpellSlotsDisplay');
    if (!section || !list) return;

    const isCaster = ['волшебник', 'колдун', 'жрец', 'бард', 'друид', 'чародей', 'паладин', 'следопыт', 'изобретатель', 'wizard', 'sorcerer', 'cleric', 'bard', 'druid', 'warlock', 'paladin', 'ranger'].some(k => cName.includes(k));

    if (!isCaster) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');

    const slots = this.getCharacterSlots(char);
    const spells = this.extractSpells(char, cName);

    // Отрисовка слотов выбранного круга
    if (slotsDisplay) {
      if (this.selectedCircle === 'all' || this.selectedCircle === 0 || this.selectedCircle === '0') {
        slotsDisplay.innerHTML = `<span class="text-stone-400 font-mono text-[10px]">Заговоры (без ячеек)</span>`;
      } else {
        const curCircle = parseInt(this.selectedCircle) || 1;
        const slotData = slots[curCircle] || { cur: 0, max: 0 };
        const color = slotData.cur <= 0 ? "text-rose-400 border-rose-900 bg-rose-950/40" : "text-cyan-300 border-cyan-800 bg-cyan-950/40";
        slotsDisplay.innerHTML = `
          <span class="px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${color}">
            ${curCircle} круг: [${slotData.cur} / ${slotData.max}]
          </span>
        `;
      }
    }

    const availableCircles = Array.from(new Set(spells.map(s => parseInt(s.level) || 0))).sort((a, b) => a - b);
    const filterButtonsHtml = `
      <div class="flex items-center gap-1 overflow-x-auto pb-1 mb-2 text-[10px] font-mono scrollbar-thin">
        <button type="button" data-circle="all"
                class="btn-spell-circle px-2 py-0.5 rounded shrink-0 ${this.selectedCircle === 'all' ? 'bg-cyan-500 text-stone-950 font-bold' : 'bg-stone-900 border border-stone-800 text-stone-400'}">
          Все (${spells.length})
        </button>
        ${availableCircles.map(c => `
          <button type="button" data-circle="${c}"
                  class="btn-spell-circle px-2 py-0.5 rounded shrink-0 ${this.selectedCircle === String(c) || this.selectedCircle === c ? 'bg-cyan-500 text-stone-950 font-bold' : 'bg-stone-900 border border-stone-800 text-stone-400'}">
            ${c === 0 ? 'Заговоры' : `${c} круг`}
          </button>
        `).join('')}
      </div>
    `;

    let filtered = spells;
    if (this.selectedCircle !== 'all') {
      const targetLvl = parseInt(this.selectedCircle);
      filtered = spells.filter(s => (parseInt(s.level) || 0) === targetLvl);
    }

    if (filtered.length === 0) {
      list.innerHTML = filterButtonsHtml + '<div class="text-stone-500 text-[11px] p-2 text-center">Нет заклинаний этого круга.</div>';
      return;
    }

    list.innerHTML = filterButtonsHtml + filtered.map((sp) => {
      const lvlNum = parseInt(sp.level) || 0;
      const lvlText = lvlNum === 0 ? "Заговор" : `${lvlNum} круг`;
      const dmg = sp.damage ? ` • ${sp.damage}` : (sp.damage_dice ? ` • ${sp.damage_dice}` : '');
      const rangeDisplay = sp.range || "60 фт";
      const isAoe = sp.is_aoe || rangeDisplay.includes('сфера') || rangeDisplay.includes('конус') || rangeDisplay.includes('линия');

      return `
        <div class="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-black/60 border border-cyan-950 hover:border-cyan-500 shadow transition-all">
          <div class="truncate flex-1">
            <div class="flex items-center gap-1.5 truncate">
              <strong class="text-cyan-200 block text-xs truncate">${sp.name}</strong>
              ${isAoe ? '<span class="text-[9px] bg-rose-950/60 border border-rose-800 text-rose-300 px-1 rounded font-mono">AOE</span>' : ''}
            </div>
            <span class="text-[10px] text-stone-400 font-mono">${lvlText}${dmg} • <span class="text-cyan-400">${rangeDisplay}</span></span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" class="btn-spell-info w-6 h-6 rounded bg-stone-900 border border-stone-700 hover:border-cyan-400 text-cyan-300 flex items-center justify-center text-xs font-bold" data-index="${spells.indexOf(sp)}">
              ℹ️
            </button>
            <button type="button" class="btn-spell-cast px-2.5 py-1 rounded bg-cyan-950 border border-cyan-600 hover:bg-cyan-900 text-cyan-200 font-bold text-xs shadow active:scale-95" data-index="${spells.indexOf(sp)}">
              Каст ✨
            </button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-spell-circle').forEach(btn => {
      btn.onclick = () => {
        this.selectedCircle = btn.dataset.circle;
        this.renderSpellsUI(char, cName, onCastCallback, onDetailCallback);
      };
    });

    list.querySelectorAll('.btn-spell-info').forEach(btn => {
      btn.onclick = () => onDetailCallback(spells[parseInt(btn.dataset.index)]);
    });

    list.querySelectorAll('.btn-spell-cast').forEach(btn => {
      btn.onclick = () => onCastCallback(spells[parseInt(btn.dataset.index)]);
    });
  }
}


