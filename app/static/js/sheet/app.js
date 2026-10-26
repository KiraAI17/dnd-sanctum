import { DndRules } from './rules/DndRules.js';
import { ApiClient } from './core/ApiClient.js';
import { CharacterState } from './core/CharacterState.js';
import { BloodHunterController } from './modules/BloodHunterController.js';
import { MonkKiController } from './modules/MonkKiController.js';
import { DiceRoller } from './components/DiceRoller.js';
import { SkillsGrid } from './components/SkillsGrid.js';
import { SpellbookManager } from './components/SpellbookManager.js';
import { LevelUpModal } from './components/LevelUpModal.js';
import { FighterController } from './modules/FighterController.js';
import { RogueController } from './modules/RogueController.js';
import { BardController } from './modules/BardController.js';


class SheetApplication {
  constructor(charId) {
    this.charId = charId;
    this.api = new ApiClient(charId);
    this.state = new CharacterState();

    this.diceRoller = new DiceRoller(this.api);
    this.skillsGrid = new SkillsGrid(this.state, this.diceRoller);
    this.spellbook = new SpellbookManager(this.state, this.api, this.diceRoller);
    this.bloodHunter = new BloodHunterController(this.state, this.api);
    this.monkKi = new MonkKiController(this.state, this.api, this.diceRoller);
    this.fighter = new FighterController(this.state, this.api, this.diceRoller);
    this.rogue = new RogueController(this.state, this.api, this.diceRoller);
    this.bard = new BardController(this.state, this.api, this.diceRoller);

    this.levelUpModal = new LevelUpModal(this.state, this.api, (updatedChar) => {
      this.state.set(updatedChar);
      this.render();
    });

    this.customInventory = [];
    this.customWeapons = [];
  }

  async init() {
    try {
      // 1. Загрузка данных персонажа
      const charData = await this.api.getCharacter();
      this.state.set(charData);

      const c = this.state.get();
      if (c && c.visual_custom) {
        try {
          const vc = typeof c.visual_custom === 'string' ? JSON.parse(c.visual_custom) : c.visual_custom;
          if (vc && vc.disguise_active !== undefined) {
            localStorage.setItem(`char_${c.id}_disguise`, JSON.stringify({
              active: vc.disguise_active,
              fakeRace: vc.disguise_race || 'Людоящер'
            }));
          }
        } catch (e) {}
      }

      // 2. Предзагрузка рас из компендиума для кастомных свойств
      if (!window.ALL_RACES_CACHE) {
        try {
          const rRes = await apiFetch('/compendium/races');
          if (rRes.ok) window.ALL_RACES_CACHE = await rRes.json();
        } catch (e) {}
      }

      // 3. Экспорт инстансов в window для onclick атрибутов в HTML
      this.exportGlobals();

      // 4. Отрисовка
      this.render();
      this.applyVisuals();
      this.loadCoins();
      this.loadArmorSelection();

      // 5. Показ интерфейса
      document.getElementById('sheetLoading')?.classList.add('hidden');
      document.getElementById('sheetContent')?.classList.remove('hidden');
    } catch (err) {
      const loadingEl = document.getElementById('sheetLoading');
      if (loadingEl) loadingEl.textContent = "Ошибка загрузки: " + err.message;
      console.error(err);
    }
  }

  exportGlobals() {
    window.monkKi = this.monkKi;
    window.spendKi = (amt, name) => this.monkKi.spendKi(amt, name);
    window.restoreKiPoints = () => this.monkKi.restoreKiPoints();
    window.quickenedHealing = () => this.monkKi.quickenedHealing();
    window.deflectMissiles = () => this.monkKi.deflectMissiles();
    window.focusedAim = (pts) => this.monkKi.focusedAim(pts);
    window.sheetApp = this;
    window.diceRoller = this.diceRoller;
    window.spellbook = this.spellbook;
    window.bloodHunter = this.bloodHunter;
    window.levelUpModal = this.levelUpModal;
    window.fighterApp = this.fighter;
    window.rogueApp = this.rogue;
    window.bardApp = this.bard;
    window.openDisguiseModal = () => this.openDisguiseModal();
    window.closeDisguiseModal = () => document.getElementById('disguiseModal')?.classList.add('hidden');
    window.onDisguiseSelectChange = (val) => {
      document.getElementById('customDisguiseBlock')?.classList.toggle('hidden', val !== 'custom');
    };
    window.applyDisguise = (isActive) => this.applyDisguise(isActive);

    // Проброс глобальных хелперов для обратной совместимости с onclick
    window.switchSheetTab = (tab) => this.switchTab(tab);
    window.openLevelUpModal = () => this.levelUpModal.open();
    window.closeLevelUpModal = () => this.levelUpModal.close();
    window.rollHpLevelUp = () => this.levelUpModal.rollHp();
    window.submitLevelUp = (e) => this.levelUpModal.submit(e);

    window.switchAsiMode = (mode) => this.levelUpModal.switchAsiMode(mode);
    window.onSubclassSelectChange = () => this.levelUpModal.onSubclassChange();
    window.onSelectFeatInLevelUp = () => this.levelUpModal.onFeatChange();

    window.rollInitiative = () => {
      const char = window.sheetApp.state.get();
      const cName = (char?.class_name || '').toLowerCase();
      const lvl = char?.level || 1;

      // Бард 20 ур: Превосходное вдохновение (Superior Inspiration)
      if ((cName.includes('бард') || cName.includes('bard')) && lvl >= 20 && window.bardApp) {
        const maxInsp = window.bardApp.getMaxInspiration(char);
        const used = window.bardApp.getUsedInspiration(char.id);
        if (used >= maxInsp) {
          window.bardApp.setUsedInspiration(char.id, maxInsp - 1);
          window.bardApp.renderTab();
          window.diceRoller.showToast(
            "🪕 Превосходное вдохновение",
            "У вас не оставалось костей: получена 1 кость Вдохновения барда на бой!",
            "crit_success"
          );
        }
      }

      const mod = DndRules.getInitiativeMod(char);
      window.diceRoller.rollCheck('⚡ Инициатива', mod, char);
    };

    window.rollCheck = (title, mod) => this.diceRoller.rollCheck(title, mod);
    window.rollFormula = (title, formula) => this.diceRoller.rollFormula(title, formula);

    window.modifyHp = (delta) => this.modifyHp(delta);
    window.applyHpDelta = () => this.applyHpDelta();
    window.handleRest = (type) => this.handleRest(type);

    window.openSpellModal = () => this.spellbook.openModal();
    window.closeSpellModal = () => this.spellbook.closeModal();
    window.selectSpellCircle = (lvl) => this.spellbook.selectCircle(lvl);
    window.filterCompendiumSpellsByLevel = () => this.spellbook.filterByLevel();
    window.applyCompendiumSpellToForm = (id) => this.spellbook.applyCompendiumSelection(id);
    window.handleCreateSpell = (e) => this.spellbook.handleCreate(e);
    window.deleteSpell = (name) => this.spellbook.deleteSpell(name);

    window.activateCrimsonRite = () => this.bloodHunter.activateCrimsonRite();
    window.deactivateCrimsonRite = () => this.bloodHunter.deactivateCrimsonRite();
    window.useBloodCurse = (name, amp) => this.bloodHunter.useBloodCurse(name, amp);
    window.restoreBloodCurses = () => this.bloodHunter.restoreBloodCurses();

    window.spendKi = (amt, name) => this.monkKi.spendKi(amt, name);
    window.restoreKiPoints = () => this.monkKi.restoreKiPoints();

    window.updateArmorSelection = () => this.updateArmorSelection();
    window.saveCoins = () => this.saveCoins();
    window.saveBackstory = () => this.saveBackstory();

    // Инвентарь
    window.openItemModal = () => document.getElementById('itemModal')?.classList.remove('hidden');
    window.closeItemModal = () => document.getElementById('itemModal')?.classList.add('hidden');
    window.onItemCategoryChange = (val) => this.onItemCategoryChange(val);
    window.handleCreateItem = (e) => this.handleCreateItem(e);
    window.deleteInventoryItem = (idx) => this.deleteInventoryItem(idx);
    window.changeItemQuantity = (idx, delta) => this.changeItemQuantity(idx, delta);
    window.usePotionEffect = (name, desc) => this.usePotionEffect(name, desc);

    // Оружие
    window.openWeaponModal = () => document.getElementById('weaponModal')?.classList.remove('hidden');
    window.closeWeaponModal = () => document.getElementById('weaponModal')?.classList.add('hidden');
    window.handleCreateWeapon = (e) => this.handleCreateWeapon(e);
    window.deleteWeapon = (idx) => this.deleteWeapon(idx);

    // Кастомизация
    window.applyPreset = (p) => this.applyPreset(p);
    window.previewCustomColors = () => this.previewCustomColors();
    window.submitVisualTheme = () => this.submitVisualTheme();
  }

  async openDisguiseModal() {
    const modal = document.getElementById('disguiseModal');
    const sel = document.getElementById('disguiseRaceSelect');
    if (!modal || !sel) return;

    // Подтягиваем все расы из базы компендиума
    if (!window.ALL_RACES_CACHE) {
      try {
        const res = await fetch('/compendium/races');
        if (res.ok) window.ALL_RACES_CACHE = await res.json();
      } catch (e) {}
    }

    const races = window.ALL_RACES_CACHE || [
      { name: "Людоящер" }, { name: "Человек" }, { name: "Эльф" },
      { name: "Дварф" }, { name: "Тифлинг" }, { name: "Полуорк" }, { name: "Халфлинг" }
    ];

    sel.innerHTML = races
      .filter(r => !r.name.toLowerCase().includes('чейнджлинг'))
      .map(r => `<option value="${r.name}">${window.getRaceEmoji(r.name)} ${r.name}</option>`)
      .join('') + '<option value="custom">✍️ Свой авторский облик...</option>';

    modal.classList.remove('hidden');
  }

  async applyDisguise(isActive) {
    const char = this.state.get();
    if (!char) return;

    const sel = document.getElementById('disguiseRaceSelect');
    const customInp = document.getElementById('customDisguiseInput');
    const isCustom = sel?.value === 'custom';
    const fakeRace = isCustom ? (customInp?.value.trim() || 'Человек') : (sel?.value || 'Людоящер');

    // 1. Обновляем локальное хранилище для мгновенного отклика
    const disguiseData = {
      active: isActive,
      fakeRace: isActive ? fakeRace : 'Чейнджлинг'
    };
    localStorage.setItem(`char_${char.id}_disguise`, JSON.stringify(disguiseData));

    // 2. Отправляем маску на бэкенд в visual_custom, чтобы весь стол видел Людоящера
    let visualCustom = {};
    try {
      visualCustom = typeof char.visual_custom === 'string'
        ? JSON.parse(char.visual_custom)
        : (char.visual_custom || {});
    } catch (e) {
      visualCustom = {};
    }

    visualCustom.disguise_active = isActive;
    visualCustom.disguise_race = isActive ? fakeRace : null;

    try {
      const res = await this.api.patchVisual({
        visual_theme: char.visual_theme || 'custom',
        visual_custom: visualCustom
      });

      if (res.ok) {
        const updated = await res.json();
        this.state.set(updated);
      }
    } catch (err) {
      console.warn("Не удалось сохранить маскировку на сервер:", err);
    }

    document.getElementById('disguiseModal')?.classList.add('hidden');
    this.render();
    this.applyVisuals();

    this.diceRoller.showToast(
      "🎭 Перевёртыш",
      isActive ? `Облик изменён: ${fakeRace}` : "Вы вернулись в свой истинный облик Чейнджлинга!",
      "crit_success"
    );
  }

    render() {
    const c = this.state.get();
    if (!c) return;

    const stats = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const profBonus = DndRules.getProficiencyBonus(c.level || 1);

    document.getElementById('charNameDisplay').textContent = c.name;
    const settingsName = document.getElementById('settingsCharName');
    if (settingsName) settingsName.value = c.name;

    document.getElementById('charLevelBadge').textContent = `Ур. ${c.level}`;

    // Логика маскировки Чейнджлинга
    const isChangeling = (c.race || '').toLowerCase().includes('чейнджлинг');
    let displayRace = c.race;

    if (isChangeling) {
      const savedDisguise = localStorage.getItem(`char_${c.id}_disguise`);
      if (savedDisguise) {
        try {
          const d = JSON.parse(savedDisguise);
          if (d.active && d.fakeRace) displayRace = d.fakeRace;
        } catch (e) {}
      }
    }

    document.getElementById('charSubDisplay').textContent = c.subclass
      ? `${displayRace} • ${c.class_name} (${c.subclass})`
      : `${displayRace} • ${c.class_name}`;

    // Кнопка перевёртыша видна только если персонаж — чейнджлинг
    const maskBtn = document.getElementById('btnChangelingMask');
    if (maskBtn) {
      maskBtn.classList.toggle('hidden', !isChangeling);
      if (isChangeling) {
        maskBtn.textContent = (displayRace !== c.race) ? `🎭 Маска: ${displayRace}` : `🎭 Сменить облик`;
      }
    }

    const initEl = document.getElementById('statInitiative') || document.getElementById('statInit');
    if (initEl) {
      const currentChar = this.state.get();
      initEl.textContent = DndRules.formatMod(DndRules.getInitiativeMod(currentChar));
    }

    const calculatedSpeed = DndRules.calculateSpeed(c);
    const speedEl = document.getElementById('statSpeed');
    if (speedEl) {
      speedEl.textContent = `${calculatedSpeed} фт`;
      if (calculatedSpeed > (c.speed || 30)) {
        speedEl.title = `Базовая раса: ${c.speed || 30} фт + Классовые бонусы: +${calculatedSpeed - (c.speed || 30)} фт`;
      }
    }
    document.getElementById('statProf').textContent = `+${profBonus}`;

    document.getElementById('hpCurrentDisplay').textContent = c.hp_current;
    document.getElementById('hpMaxDisplay').textContent = c.hp_max;
    const hpPercent = Math.max(0, Math.min(100, Math.round((c.hp_current / (c.hp_max || 1)) * 100)));
    document.getElementById('hpProgressBar').style.width = `${hpPercent}%`;

    for (const [key, val] of Object.entries(stats)) {
      const scoreEl = document.getElementById(`score-${key}`);
      const modEl = document.getElementById(`mod-${key}`);
      if (scoreEl) scoreEl.textContent = val;
      if (modEl) modEl.textContent = DndRules.formatMod(DndRules.calcMod(val));
    }

    this.skillsGrid.render();
    this.spellbook.init();
    this.renderBioTab();
    this.renderInventoryTab();
    this.renderWeaponsTab();
    this.renderFeaturesTab();
    this.updateArmorSelection();
    this.updateSpecialTabsVisibility();
  }

  updateSpecialTabsVisibility() {
    const c = this.state.get();
    if (!c) return;
    const cName = (c.class_name || '').toLowerCase();
    const lvl = c.level || 1;

    // Магия Крови (только Кровавый охотник)
    const isBH = cName.includes('охотник') || cName.includes('blood');
    const bhBtn = document.getElementById('tabBtnBloodHunter');
    if (bhBtn) {
      bhBtn.classList.toggle('hidden', !isBH);
      if (isBH) this.bloodHunter.renderTab();
    }

    // Энергия Ци (только Монах со 2 ур.)
    const isMonk = (cName.includes('монах') || cName.includes('monk')) && lvl >= 2;
    const monkBtn = document.getElementById('tabBtnMonkKi');
    if (monkBtn) {
      monkBtn.classList.toggle('hidden', !isMonk);
      if (isMonk) this.monkKi.renderTab();
    }

    // Боевые приёмы (только Воин)
    const isFighter = cName.includes('воин') || cName.includes('fighter');
    const ftrBtn = document.getElementById('tabBtnFighterManeuvers');
    if (ftrBtn) {
      ftrBtn.classList.toggle('hidden', !isFighter);
      if (isFighter) this.fighter.renderTab();
    }

    const isRogue = cName.includes('плут') || cName.includes('rogue');
    const rogueBtn = document.getElementById('tabBtnRogue');
    if (rogueBtn) {
      rogueBtn.classList.toggle('hidden', !isRogue);
      if (isRogue) this.rogue.renderTab();
    }

    const isBard = cName.includes('бард') || cName.includes('bard');
    const bardBtn = document.getElementById('tabBtnBard');
    if (bardBtn) {
      bardBtn.classList.toggle('hidden', !isBard);
      if (isBard) this.bard.renderTab();
    }

    // Книга Заклинаний (только заклинатели)
    const isCaster = DndRules.isSpellcaster(c);
    const spellsBtn = document.getElementById('tabBtnSpells');
    if (spellsBtn) {
      spellsBtn.classList.toggle('hidden', !isCaster);
    }
  }

  switchTab(tab) {
    const tabs = ['Stats', 'Combat', 'BloodHunter', 'MonkKi', 'FighterManeuvers', 'Rogue', 'Bard', 'Spells', 'Inventory', 'Features', 'Bio', 'Settings'];
    tabs.forEach(t => {
      const el = document.getElementById(`tab${t}`);
      const btn = document.getElementById(`tabBtn${t}`);
      const isCur = t.toLowerCase() === tab.toLowerCase();

      if (el) el.classList.toggle('hidden', !isCur);

      if (btn) {
        if (isCur) {
          btn.classList.add('text-amber-300', 'border-foxOrange-500');
          btn.classList.remove('text-stone-400', 'border-transparent');
        } else {
          btn.classList.remove('text-amber-300', 'border-foxOrange-500');
          btn.classList.add('text-stone-400', 'border-transparent');
        }
      }
    });

    this.updateSpecialTabsVisibility();
  }

  // --- ЗДОРОВЬЕ И ОТДЫХ ---

  async modifyHp(delta) {
    const c = this.state.get();
    if (!c) return;
    const newHp = Math.max(0, Math.min(c.hp_max, c.hp_current + delta));
    await this.api.patchHp(newHp);
    this.state.updateHp(newHp);
    this.render();
  }

  async applyHpDelta() {
    const input = document.getElementById('hpDeltaInput');
    const val = parseInt(input?.value);
    if (!isNaN(val)) {
      await this.modifyHp(val);
      if (input) input.value = '';
    }
  }

  async handleRest(type) {
    if (!confirm(type === 'long' ? "Совершить длинный отдых?" : "Короткий отдых?")) return;
    const res = await this.api.rest(type);
    if (res.ok) {
      const updated = await res.json();
      const current = this.state.get();
      current.hp_current = updated.hp_current;
      current.spell_slots = updated.spell_slots;
      this.state.set(current);

      // Получаем актуального персонажа для проверки классов
      const char = current;
      const cName = (char?.class_name || '').toLowerCase();
      const lvl = char?.level || 1;

      // 1. Бард:
      // В длинный отдых вдохновение восстанавливается всегда.
      // В короткий — начиная с 5-го уровня («Источник вдохновения»).
      const isBard = cName.includes('бард') || cName.includes('bard');
      if (isBard && (type === 'long' || lvl >= 5)) {
        if (this.bard) this.bard.restoreInspiration();
      }

      // Напоминание о Песне отдыха союзникам при коротком отдыхе
      if (isBard && lvl >= 2 && type === 'short') {
        const songDie = DndRules.getSongOfRestDie(lvl);
        this.diceRoller.showToast(
          "🎵 Песнь отдыха активна",
          `Вы и союзники восстанавливаете дополнительно +1${songDie} хитов при трате Костей Хитов!`,
          "normal"
        );
      }

      // 2. Сброс ресурсов остальных классов
      if (this.bloodHunter) this.bloodHunter.restoreBloodCurses();
      if (this.monkKi) this.monkKi.restoreKiPoints();
      if (this.fighter) this.fighter.restoreDice();
      if (this.rogue) this.rogue.restorePsiDice();

      this.render();
      alert(`Отдых завершён. Здоровье, заклинания и классовые ресурсы восстановлены!`);
    }
  }


  // --- ИНВЕНТАРЬ И КОШЕЛЬ ---

  loadCoins() {
    const raw = localStorage.getItem(`char_${this.charId}_coins`);
    if (raw) {
      try {
        const c = JSON.parse(raw);
        ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(coin => {
          const el = document.getElementById(`coin_${coin}`);
          if (el && c[coin] !== undefined) el.value = c[coin];
        });
      } catch (e) {}
    }
  }

  saveCoins() {
    const coins = {};
    ['pp', 'gp', 'ep', 'sp', 'cp'].forEach(coin => {
      coins[coin] = document.getElementById(`coin_${coin}`)?.value || 0;
    });
    localStorage.setItem(`char_${this.charId}_coins`, JSON.stringify(coins));
  }

  loadInventory() {
    const raw = localStorage.getItem(`char_${this.charId}_inventory`);
    if (raw) {
      try { this.customInventory = JSON.parse(raw); } catch (e) { this.customInventory = []; }
    } else {
      const c = this.state.get();
      if (c && c.starting_equipment) {
        this.customInventory = c.starting_equipment.map(item => ({
          name: typeof item === 'string' ? item : item.name,
          category: 'Прочее',
          attribute: '',
          description: '',
          quantity: 1
        }));
      }
    }
  }

  saveInventory() {
    localStorage.setItem(`char_${this.charId}_inventory`, JSON.stringify(this.customInventory));
  }

  renderInventoryTab() {
    const eq = document.getElementById('equipmentListContainer');
    if (!eq) return;
    this.loadInventory();

    if (!this.customInventory.length) {
      eq.innerHTML = '<div class="col-span-full text-center py-6 text-stone-500 italic">Рюкзак пуст.</div>';
      return;
    }

    eq.innerHTML = this.customInventory.map((item, idx) => {
      const name = item.name || 'Предмет';
      const cat = item.category || 'Предмет';
      const desc = item.description || '';
      const attr = item.attribute || '';
      const qty = item.quantity !== undefined ? item.quantity : 1;
      const isPotion = cat.includes('Расходник') || name.toLowerCase().includes('зель') || name.toLowerCase().includes('свиток');

      return `
        <div class="p-3.5 rounded-xl bg-[#0e0907] border border-orange-950 flex flex-col justify-between space-y-2 shadow">
          <div>
            <div class="flex justify-between items-start">
              <strong class="text-amber-200 text-sm font-serif">${name}</strong>
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-800">${cat}</span>
            </div>
            ${attr ? `<span class="text-amber-400 text-[11px] font-mono block mt-0.5">⚡ ${attr}</span>` : ''}
            ${desc ? `<p class="text-stone-300 text-[11px] mt-1">${desc}</p>` : ''}
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-orange-950/60 gap-2 text-xs">
            <div class="flex items-center gap-1 bg-[#140e0a] border border-orange-900/60 rounded-lg px-1.5 py-0.5 font-mono">
              <button type="button" onclick="window.sheetApp.changeItemQuantity(${idx}, -1)" class="text-stone-400 hover:text-amber-300 px-1 font-bold">−</button>
              <span class="text-amber-200 font-bold px-1">${qty}</span>
              <button type="button" onclick="window.sheetApp.changeItemQuantity(${idx}, 1)" class="text-stone-400 hover:text-amber-300 px-1 font-bold">＋</button>
            </div>
            <div class="flex items-center gap-1.5">
              ${isPotion ? `<button type="button" onclick="window.sheetApp.usePotionEffect('${name}', '${attr || desc}')" class="px-2 py-1 rounded bg-emerald-950 border border-emerald-900 text-emerald-300 text-[10px] font-bold">✨ Применить</button>` : ''}
              <button type="button" onclick="window.sheetApp.deleteInventoryItem(${idx})" class="text-rose-400 hover:text-rose-300 text-xs font-bold p-1">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  onItemCategoryChange(val) {
    const customBlock = document.getElementById('customCategoryBlock');
    const attrBlock = document.getElementById('itemDynamicAttrBlock');
    const attrLabel = document.getElementById('itemAttrLabel');
    const attrInput = document.getElementById('iAttrValue');

    if (customBlock) customBlock.classList.toggle('hidden', val !== 'custom');

    if (attrBlock && attrLabel && attrInput) {
      if (val === 'Оружие') {
        attrBlock.classList.remove('hidden');
        attrLabel.textContent = "Кубы урона (например, 1d8+3):";
        attrInput.placeholder = "1d8+3";
      } else if (val === 'Броня / Щит') {
        attrBlock.classList.remove('hidden');
        attrLabel.textContent = "Бонус КД (например, +2):";
        attrInput.placeholder = "+2";
      } else if (val.includes('Расходник')) {
        attrBlock.classList.remove('hidden');
        attrLabel.textContent = "Эффект / Хил (например, хил 2d4+2):";
        attrInput.placeholder = "хил 2d4+2";
      } else {
        attrBlock.classList.add('hidden');
      }
    }
  }

  handleCreateItem(e) {
    e.preventDefault();
    const name = document.getElementById('iName')?.value.trim();
    const catSel = document.getElementById('iCategory')?.value;
    const customCat = document.getElementById('iCustomCategory')?.value.trim();
    const cat = catSel === 'custom' ? (customCat || 'Прочее') : catSel;
    const attr = document.getElementById('iAttrValue')?.value.trim();
    const desc = document.getElementById('iDesc')?.value.trim();
    if (!name) return;

    this.loadInventory();
    this.customInventory.push({ name, category: cat, attribute: attr, description: desc, quantity: 1 });
    this.saveInventory();
    window.closeItemModal();
    e.target.reset();
    this.renderInventoryTab();
  }

  deleteInventoryItem(idx) {
    if (!confirm("Удалить предмет из рюкзака?")) return;
    this.loadInventory();
    this.customInventory.splice(idx, 1);
    this.saveInventory();
    this.renderInventoryTab();
  }

  changeItemQuantity(idx, delta) {
    this.loadInventory();
    if (this.customInventory[idx]) {
      const cur = this.customInventory[idx].quantity !== undefined ? this.customInventory[idx].quantity : 1;
      const n = cur + delta;
      if (n <= 0) {
        if (confirm(`Удалить «${this.customInventory[idx].name}» из инвентаря?`)) {
          this.customInventory.splice(idx, 1);
        }
      } else {
        this.customInventory[idx].quantity = n;
      }
      this.saveInventory();
      this.renderInventoryTab();
    }
  }

  async usePotionEffect(name, desc) {
    if (desc.toLowerCase().includes('хил') || desc.toLowerCase().includes('hp') || desc.toLowerCase().includes('восстанавл')) {
      await this.modifyHp(10);
      alert(`Расходник «${name}» использован! Восстановлено здоровье.`);
    } else {
      alert(`Эффект «${name}» активирован: ${desc}`);
    }
  }

  // --- ОРУЖИЕ ---

  loadWeapons() {
    const raw = localStorage.getItem(`char_${this.charId}_weapons`);
    if (raw) {
      try { this.customWeapons = JSON.parse(raw); } catch (e) { this.customWeapons = []; }
    } else {
      this.customWeapons = [
        { name: "Боевой посох", atk: "+3", dmg: "1d6+1" },
        { name: "Легкий арбалет", atk: "+4", dmg: "1d8+2" }
      ];
    }
  }

  saveWeapons() {
    localStorage.setItem(`char_${this.charId}_weapons`, JSON.stringify(this.customWeapons));
  }

  renderWeaponsTab() {
    const list = document.getElementById('combatWeaponsList');
    if (!list) return;
    this.loadWeapons();

    const char = this.state.get();
    const cName = (char?.class_name || '').toLowerCase();
    const isRogue = cName.includes('плут') || cName.includes('rogue');
    const sneakDice = isRogue ? DndRules.getSneakAttackDice(char.level || 1) : null;

    const stats = char?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const lvl = char?.level || 1;
    const prof = DndRules.getProficiencyBonus(lvl);

    let html = '';

    const sub = (char?.subclass || '').toLowerCase();
    if (cName.includes('плут') || cName.includes('rogue')) {
      if (sub.includes('клинок души') || sub.includes('soulknife')) {
        const dexMod = DndRules.calcMod(stats.dex || 10);
        const strMod = DndRules.calcMod(stats.str || 10);
        const atkMod = Math.max(dexMod, strMod) + prof;
        const dmgMod = Math.max(dexMod, strMod);

        html += `
          <div class="p-3 bg-gradient-to-r from-[#170e1a] to-[#0d090f] border border-purple-500/60 rounded-xl flex flex-wrap justify-between items-center text-xs gap-2 shadow-lg mb-2">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm">🗡️✨</span>
                <strong class="text-purple-200 text-sm font-serif">Психический клинок (Soulknife)</strong>
                <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">Псионика • 60 фт</span>
              </div>
              <span class="text-stone-400 block text-[11px] mt-0.5">
                Основной: 1d6${DndRules.formatMod(dmgMod)} психикой • Бонусным действием: 1d4${DndRules.formatMod(dmgMod)}
              </span>
            </div>
            <div class="flex gap-1.5">
              <button type="button" onclick="window.diceRoller.rollFormula('Атака пси-клинком', '1d20${DndRules.formatMod(atkMod)}')" class="px-2.5 py-1 rounded bg-[#1e1124] border border-purple-700 text-purple-300 font-mono font-bold hover:border-purple-400">
                Атака (${DndRules.formatMod(atkMod)})
              </button>
              <button type="button" onclick="window.diceRoller.rollFormula('Урон пси-клинка (осн.)', '1d6${DndRules.formatMod(dmgMod)}')" class="px-2 py-1 rounded bg-purple-700 text-purple-100 font-mono font-bold hover:bg-purple-600">
                1d6 Урон
              </button>
              <button type="button" onclick="window.diceRoller.rollFormula('Урон пси-клинка (бонус)', '1d4${DndRules.formatMod(dmgMod)}')" class="px-2 py-1 rounded bg-purple-900 text-purple-200 font-mono font-bold hover:bg-purple-800" title="Второй клинок бонусным действием">
                1d4 Бон.
              </button>
            </div>
          </div>
        `;
      }
    }

    // Если монах — всегда выводим «Безоружный удар» с актуальной костью и бонусами
    if (cName.includes('монах') || cName.includes('monk')) {
      const dexMod = DndRules.calcMod(stats.dex || 10);
      const strMod = DndRules.calcMod(stats.str || 10);
      const attackMod = Math.max(dexMod, strMod); // Ловкость или Сила
      const totalAtk = prof + attackMod;
      const dieSides = DndRules.getMartialArtsDie(lvl);
      const dmgFormula = `1d${dieSides}${DndRules.formatMod(attackMod)}`;
      const atkFormula = `1d20${DndRules.formatMod(totalAtk)}`;

      const initMod = DndRules.getInitiativeMod(char);
      const initEl = document.getElementById('statInitiative');
      if (initEl) {
        initEl.textContent = DndRules.formatMod(initMod);
      }

      html += `
        <div class="p-3 bg-gradient-to-r from-[#18110a] to-[#0e0907] border border-amber-500/50 rounded-lg flex flex-wrap justify-between items-center text-xs gap-2 shadow">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-sm">👊</span>
              <strong class="text-amber-200 text-sm font-serif">Безоружный удар (Боевые искусства)</strong>
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">Монах</span>
            </div>
            <span class="text-stone-400 block text-[11px] mt-0.5">
              Атака: ${DndRules.formatMod(totalAtk)} • Урон: ${dmgFormula} дробящий • Бонусным действием: доп. удар
            </span>
          </div>
          <div class="flex gap-2">
            <button type="button" onclick="window.diceRoller.rollFormula('Удар кулаком', '${atkFormula}')" class="px-2.5 py-1 rounded bg-[#160f0b] border border-amber-700 text-amber-300 font-mono font-bold hover:border-amber-400">
              Атака (${DndRules.formatMod(totalAtk)})
            </button>
            <button type="button" onclick="window.diceRoller.rollFormula('Урон кулаком', '${dmgFormula}')" class="px-2.5 py-1 rounded bg-amber-600 text-stone-950 font-mono font-bold hover:bg-amber-500">
              Урон (${dmgFormula})
            </button>
          </div>
        </div>
      `;
    }

    if (!this.customWeapons.length && !html) {
      list.innerHTML = '<div class="text-center py-4 text-stone-500 italic">Оружие не добавлено.</div>';
      return;
    }

    // Рендер обычного оружия из инвентаря:
    html += this.customWeapons.map((w, idx) => {
      const isFinesseOrRanged = (w.props || '').toLowerCase().includes('фехт') ||
                                (w.props || '').toLowerCase().includes('дальн') ||
                                ['рапира', 'короткий меч', 'кинжал', 'лук', 'арбалет'].some(k => w.name.toLowerCase().includes(k));

      return `
        <div class="p-3 bg-[#0d0a08] border border-orange-950 rounded-xl flex flex-wrap justify-between items-center text-xs gap-2">
          <div>
            <div class="flex items-center gap-1.5">
              <strong class="text-amber-200 text-sm font-serif">${w.name}</strong>
              ${isRogue && isFinesseOrRanged ? `<span class="text-[9px] font-mono px-1 rounded bg-amber-950 text-amber-300 border border-amber-800">Скрытая атака возможна</span>` : ''}
            </div>
            <span class="text-stone-400 block text-[11px] mt-0.5">Атака: ${w.atk} • Урон: ${w.dmg}</span>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" onclick="window.diceRoller.rollFormula('Атака: ${w.name}', '1d20${w.atk}')" class="px-2.5 py-1 rounded bg-[#160f0b] border border-orange-900 text-amber-300 font-mono font-bold hover:border-amber-400">
              Атака (${w.atk})
            </button>

            <button type="button" onclick="window.diceRoller.rollFormula('Урон: ${w.name}', '${w.dmg}')" class="px-2.5 py-1 rounded bg-foxOrange-700 text-amber-100 font-mono font-bold hover:bg-foxOrange-600">
              Урон (${w.dmg})
            </button>

            <!-- КНОПКА СОВМЕСТНОГО БРОСКА С СКРЫТОЙ АТАКОЙ ДЛЯ ПЛУТА -->
            ${isRogue && isFinesseOrRanged ? `
              <button type="button" onclick="window.diceRoller.rollFormula('Критический укол (${w.name} + Скрытая атака)', '${w.dmg} + ${sneakDice}')"
                      class="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 text-rose-200 font-mono font-bold hover:bg-rose-900 shadow"
                      title="Бросить урон оружия вместе с костями Скрытой атаки (${sneakDice})">
                🗡️ +${sneakDice}
              </button>
            ` : ''}

            <button type="button" onclick="window.sheetApp.deleteWeapon(${idx})" class="text-stone-600 hover:text-rose-400 p-1 font-bold">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;
  }


  handleCreateWeapon(e) {
    e.preventDefault();
    const name = document.getElementById('wName')?.value.trim();
    let atk = document.getElementById('wAtk')?.value.trim();
    const dmg = document.getElementById('wDmg')?.value.trim();
    if (!name) return;

    if (!atk.startsWith('+') && !atk.startsWith('-')) atk = `+${atk}`;
    this.loadWeapons();
    this.customWeapons.push({ name, atk, dmg });
    this.saveWeapons();
    window.closeWeaponModal();
    e.target.reset();
    this.renderWeaponsTab();
  }

  deleteWeapon(idx) {
    this.loadWeapons();
    this.customWeapons.splice(idx, 1);
    this.saveWeapons();
    this.renderWeaponsTab();
  }

  // --- БРОНЯ И ЩИТ ---

  updateArmorSelection() {
    const sel = document.getElementById('armorTypeSelect');
    const customBlock = document.getElementById('customArmorInputBlock');
    const shieldToggle = document.getElementById('shieldEquippedToggle');
    if (!sel) return;

    const val = sel.value;
    if (customBlock) customBlock.classList.toggle('hidden', val !== 'custom');

    const char = this.state.get();
    const cName = (char?.class_name || '').toLowerCase();
    const sub = (char?.subclass || '').toLowerCase();
    const dexMod = DndRules.calcMod(char?.stats?.dex || 10);
    const wisMod = DndRules.calcMod(char?.stats?.wis || 10);
    const conMod = DndRules.calcMod(char?.stats?.con || 10);

    let effRace = (char?.race || '').toLowerCase();
    try {
      const d = JSON.parse(localStorage.getItem(`char_${char?.id}_disguise`) || '{}');
      if (d.active && d.fakeRace) effRace = d.fakeRace.toLowerCase();
    } catch (e) {}

    const isLizard = effRace.includes('ящер') || effRace.includes('lizard');

    let baseAc = 10 + dexMod;
    let descArmor = "Без доспеха (10 + Ловкость)";

    // Природный доспех Людоящера (13 + Ловкость)
    if (val === 'none' && isLizard) {
      baseAc = 13 + dexMod;
      descArmor = `Природный доспех (13 + ${dexMod} ЛОВ)`;
    }

    if (val === 'leather') { baseAc = 11 + dexMod; descArmor = "Кожаный (11 + Ловкость)"; }
    else if (val === 'studded') { baseAc = 12 + dexMod; descArmor = "Проклепанная кожа (12 + Ловкость)"; }
    else if (val === 'chain_shirt') { baseAc = 13 + Math.min(2, dexMod); descArmor = "Кольчужная рубашка (13 + Ловкость [макс 2])"; }
    else if (val === 'breastplate') { baseAc = 14 + Math.min(2, dexMod); descArmor = "Нагрудник (14 + Ловкость [макс 2])"; }
    else if (val === 'plate') { baseAc = 18; descArmor = "Латы (18, без ловкости)"; }
    else if (val === 'custom') {
      const customText = document.getElementById('customArmorText')?.value || '';
      const match = customText.match(/кд\s*(\d+)/i);
      if (match) {
        baseAc = parseInt(match[1]);
        descArmor = customText;
      }
    }

    const isShield = shieldToggle?.checked || false;

    // Монах: Защита без доспехов ТОЛЬКО если нет доспехов И нет щита
    if (val === 'none' && !isShield && (cName.includes('000') || cName.includes('000'))) {
      baseAc = 10 + dexMod + wisMod;
      descArmor = `Защита без доспехов (10 + ${dexMod} ЛОВ + ${wisMod} МУД)`;
    } else if (val === 'leather') {
      baseAc = 11 + dexMod;
      descArmor = "Кожаный (11 + Ловкость)";
    } else if (val === 'studded') {
      baseAc = 12 + dexMod;
      descArmor = "Проклепанная кожа (12 + Ловкость)";
    } else if (val === 'chain_shirt') {
      baseAc = 13 + Math.min(2, dexMod);
      descArmor = "Кольчужная рубашка (13 + Ловкость [макс 2])";
    } else if (val === 'breastplate') {
      baseAc = 14 + Math.min(2, dexMod);
      descArmor = "Нагрудник (14 + Ловкость [макс 2])";
    } else if (val === 'plate') {
      baseAc = 18;
      descArmor = "Латы (18, без ловкости)";
    }

    let finalAc = baseAc + (isShield ? 2 : 0);

    // Ликантроп бонус
    const isLycan = (typeof window.bloodHunter?.isLycanActive === 'function')
      ? window.bloodHunter.isLycanActive()
      : false;
    if (isLycan && val !== 'plate') {
      finalAc += 1;
      descArmor += ' + 1 (Звериная форма)';
    }

    // 1. Монах без доспехов: 10 + DEX + WIS
    if (val === 'none' && !isShield && (cName.includes('монах') || cName.includes('monk'))) {
      baseAc = 10 + dexMod + wisMod;
      descArmor = `Защита без доспехов (10 + ${dexMod} ЛОВ + ${wisMod} МУД)`;
    }
    // 2. Альт Воин (Борец): 10 + DEX + CON (без доспехов) или CON вместо DEX в легких/средних
    else if (val === 'none' && !isShield && sub.includes('борец')) {
      baseAc = 10 + dexMod + conMod;
      descArmor = `Стальное телосложение (10 + ${dexMod} ЛОВ + ${conMod} ТЕЛ)`;
    }

    const statAc = document.getElementById('statAc');
    const combatAc = document.getElementById('combatAcSummary');
    if (statAc) statAc.textContent = finalAc;
    if (combatAc) combatAc.textContent = `${finalAc} (${descArmor}${isShield ? ' + 2 щит' : ''})`;

    localStorage.setItem(`char_${this.charId}_armor`, JSON.stringify({
      type: val,
      custom: document.getElementById('customArmorText')?.value || '',
      shield: isShield
    }));

    // Скорость могла измениться из-за снятия/надевания брони монахом
    const speedEl = document.getElementById('statSpeed');
    if (speedEl) speedEl.textContent = `${DndRules.calculateSpeed(char)} фт`;
  }

  loadArmorSelection() {
    const raw = localStorage.getItem(`char_${this.charId}_armor`);
    if (raw) {
      try {
        const a = JSON.parse(raw);
        const sel = document.getElementById('armorTypeSelect');
        const custom = document.getElementById('customArmorText');
        const shield = document.getElementById('shieldEquippedToggle');
        if (sel) sel.value = a.type || 'none';
        if (custom) custom.value = a.custom || '';
        if (shield) shield.checked = !!a.shield;
      } catch (e) {}
    }
    this.updateArmorSelection();
  }

  // --- ОСОБЕННОСТИ И РАСА ---

  async renderFeaturesTab() {
    const cont = document.getElementById('featsListContainer');
    if (!cont) return;
    const c = this.state.get();
    if (!c) return;

    let html = '';

    // Расовые свойства
    let raceTraits = c.traits || c.race_traits || [];
    if (raceTraits.length === 0 && c.race) {
      if (!window.ALL_RACES_CACHE) {
        try {
          const rRes = await apiFetch('/compendium/races');
          if (rRes.ok) window.ALL_RACES_CACHE = await rRes.json();
        } catch (e) {}
      }
      const rObj = (window.ALL_RACES_CACHE || []).find(r => r.name.toLowerCase() === c.race.toLowerCase());
      if (rObj && rObj.traits) raceTraits = rObj.traits;
    }

    html += `
      <div class="space-y-2">
        <div class="flex items-center gap-2 border-b border-orange-950/80 pb-1">
          <span class="text-sm">🧬</span>
          <h4 class="font-serif font-bold text-amber-200 text-sm">Расовые особенности: ${c.race}</h4>
        </div>
    `;

    if (raceTraits.length > 0) {
      raceTraits.forEach(t => {
        const name = typeof t === 'string' ? t.split(':')[0].trim() : t.name;
        const desc = typeof t === 'string' ? (t.split(':')[1] || '').trim() : (t.description || t.desc || '');
        html += `
          <div class="p-3 bg-[#0d0a08] border border-orange-950 rounded-xl space-y-1 shadow">
            <strong class="text-amber-300 text-xs font-serif block">${name}</strong>
            ${desc ? `<p class="text-stone-300 text-xs font-serif leading-relaxed whitespace-pre-line">${desc}</p>` : ''}
          </div>
        `;
      });
    } else {
      html += `<div class="p-3 bg-[#0d0a08] border border-orange-950/60 rounded-xl text-stone-400 text-xs font-serif">Стандартные свойства расы ${c.race}.</div>`;
    }
    html += `</div>`;

    // Архетип
    if (c.subclass) {
      html += `
        <div class="space-y-2 pt-2">
          <div class="flex items-center justify-between border-b border-purple-950/80 pb-1">
            <div class="flex items-center gap-2">
              <span class="text-sm">👑</span>
              <h4 class="font-serif font-bold text-purple-300 text-sm">Специализация: ${c.subclass}</h4>
            </div>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-200">Архетип</span>
          </div>
          <div class="p-3 bg-[#130b18] border border-purple-950/80 rounded-xl text-stone-300 text-xs font-serif">
            Способности и ритуалы подкласса активны и доступны в вашем листе.
          </div>
        </div>
      `;
    }

    // Классовые умения
    let classFeatures = c.features || c.class_features || [];
    if (classFeatures.length === 0) {
      try {
        if (!window.ALL_CLASSES_CACHE) {
          const res = await apiFetch('/compendium/classes');
          if (res.ok) window.ALL_CLASSES_CACHE = await res.json();
        }
        const cls = (window.ALL_CLASSES_CACHE || []).find(
          x => x.name.toLowerCase() === (c.class_name || '').toLowerCase() || x.id === (c.class_id || '')
        );
        if (cls) {
          if (cls.features && Array.isArray(cls.features)) {
            classFeatures = cls.features.filter(f => (f.level || 1) <= (c.level || 1));
          } else if (cls.level1_features) {
            classFeatures = cls.level1_features;
          }
        }
      } catch (e) {}
    }

    html += `
      <div class="space-y-2 pt-2">
        <div class="flex items-center justify-between border-b border-orange-950/80 pb-1">
          <div class="flex items-center gap-2">
            <span class="text-sm">⚔️</span>
            <h4 class="font-serif font-bold text-amber-200 text-sm">Классовые умения: ${c.class_name}</h4>
          </div>
          <span class="text-[10px] font-mono text-stone-400">До ${c.level || 1} уровня</span>
        </div>
    `;

    if (classFeatures.length > 0) {
      classFeatures.forEach(f => {
        let name = f.name;
        let desc = f.description || f.desc;
        let lvl = f.level ? `${f.level} ур.` : '';

        if (typeof f === 'string') {
          const parts = f.split(':');
          name = parts[0].trim();
          desc = parts.slice(1).join(':').trim();
        }

        if ((name.includes('Орден') || name.includes('Архетип')) && c.subclass) {
          desc = `Вы посвящены в ${c.subclass}. Способности специализации активны.`;
        }

        html += `
          <div class="p-3 bg-[#0d0a08] border border-orange-950 rounded-xl space-y-1 shadow">
            <div class="flex justify-between items-start gap-2">
              <strong class="text-amber-300 text-xs font-serif block">${name}</strong>
              ${lvl ? `<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/60 border border-orange-900 text-amber-400 shrink-0">${lvl}</span>` : ''}
            </div>
            ${desc ? `<p class="text-stone-300 text-xs font-serif leading-relaxed whitespace-pre-line">${desc}</p>` : ''}
          </div>
        `;
      });
    }
    html += `</div>`;

    // Черты
    const feats = c.feats || [];
    if (feats.length > 0) {
      html += `
        <div class="space-y-2 pt-2">
          <div class="flex items-center gap-2 border-b border-orange-950/80 pb-1">
            <span class="text-sm">✨</span>
            <h4 class="font-serif font-bold text-amber-200 text-sm">Черты и таланты (Feats)</h4>
          </div>
      `;
      feats.forEach(f => {
        html += `
          <div class="p-3 bg-[#0d0a08] border border-orange-950 rounded-xl space-y-1 shadow">
            <strong class="text-amber-300 text-xs font-serif block">${f.name}</strong>
            ${f.description ? `<p class="text-stone-300 text-xs font-serif leading-relaxed whitespace-pre-line">${f.description}</p>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }

    cont.innerHTML = html;
  }

  // --- КВЕНТА И ВИЗУАЛ ---

  renderBioTab() {
    const c = this.state.get();
    if (!c) return;
    const alignEl = document.getElementById('bioAlignmentDisplay');
    const bgEl = document.getElementById('bioBackgroundDisplay');
    const textEl = document.getElementById('sheetBackstoryInput');
    if (alignEl) alignEl.textContent = c.alignment || 'Нейтральный';
    if (bgEl) bgEl.textContent = c.background || 'Обыватель';
    if (textEl) textEl.value = c.backstory || '';
  }

  async saveBackstory() {
    const text = document.getElementById('sheetBackstoryInput')?.value || '';
    const btn = document.getElementById('btnSaveBackstory');
    if (btn) btn.textContent = "Сохраняем...";
    try {
      const res = await this.api.patchBackstory(text);
      if (res.ok) {
        this.state.get().backstory = text;
        if (btn) {
          btn.textContent = "✓ Сохранено!";
          setTimeout(() => { btn.textContent = "💾 Сохранить квенту"; }, 2000);
        }
      }
    } catch {
      if (btn) btn.textContent = "Ошибка!";
    }
  }

  applyVisuals() {
    const c = this.state.get();
    if (!c) return;
    const bannerEl = document.getElementById('heroCoverBg');
    const avatarImg = document.getElementById('charAvatarImg');
    const avatarPh = document.getElementById('charAvatarPlaceholder');

    if (avatarPh) {
      avatarPh.classList.remove('hidden');
      // Берем расу с учетом маскировки
      let effRace = c.race;
      try {
        const d = JSON.parse(localStorage.getItem(`char_${c.id}_disguise`) || '{}');
        if (d.active && d.fakeRace) effRace = d.fakeRace;
      } catch (e) {}
      avatarPh.textContent = window.getRaceEmoji ? window.getRaceEmoji(effRace) : '👤';
    }

    if (c.banner_url && c.banner_url.trim()) {
      if (bannerEl) bannerEl.style.backgroundImage = `url('${c.banner_url}')`;
      const inp = document.getElementById('visualBannerInput');
      if (inp) inp.value = c.banner_url;
    } else {
      if (bannerEl) bannerEl.style.backgroundImage = 'none';
    }

    if (c.avatar_url && c.avatar_url.trim()) {
      if (avatarImg) { avatarImg.src = c.avatar_url; avatarImg.classList.remove('hidden'); }
      if (avatarPh) avatarPh.classList.add('hidden');
    } else {
      if (avatarImg) avatarImg.classList.add('hidden');
      if (avatarPh) {
        avatarPh.classList.remove('hidden');
        avatarPh.textContent = window.getRaceEmoji ? window.getRaceEmoji(c.race) : '🦉';
      }
    }

    let custom = {};
    try { custom = typeof c.visual_custom === 'string' ? JSON.parse(c.visual_custom) : (c.visual_custom || {}); } catch {}
    const accent = custom.accent || '#f59e0b';
    const border = custom.border || '#d97706';
    const cardBg = custom.cardBg || '#0e0907';
    const textColor = custom.textColor || '#fde68a';

    const root = document.documentElement;
    root.style.setProperty('--theme-accent', accent);
    root.style.setProperty('--theme-border', border);
    root.style.setProperty('--theme-card-bg', cardBg);

    const pAcc = document.getElementById('pickerAccent');
    const pBrd = document.getElementById('pickerBorder');
    const pCbg = document.getElementById('pickerCardBg');
    const pTxt = document.getElementById('pickerText');
    if (pAcc) pAcc.value = accent;
    if (pBrd) pBrd.value = border;
    if (pCbg) pCbg.value = cardBg;
    if (pTxt) pTxt.value = textColor;
  }

  applyPreset(presetName) {
    const presets = {
      ember: { accent: '#f59e0b', border: '#d97706', cardBg: '#0e0907', textColor: '#fde68a' },
      arcane: { accent: '#a855f7', border: '#7e22ce', cardBg: '#0b070f', textColor: '#f3e8ff' },
      forest: { accent: '#10b981', border: '#047857', cardBg: '#070a08', textColor: '#d1fae5' },
      dark: { accent: '#71717a', border: '#3f3f46', cardBg: '#09090b', textColor: '#f4f4f5' }
    };
    const p = presets[presetName];
    if (!p) return;
    document.getElementById('pickerAccent').value = p.accent;
    document.getElementById('pickerBorder').value = p.border;
    document.getElementById('pickerCardBg').value = p.cardBg;
    document.getElementById('pickerText').value = p.textColor;
    this.previewCustomColors();
  }

  previewCustomColors() {
    const accent = document.getElementById('pickerAccent')?.value || '#f59e0b';
    const border = document.getElementById('pickerBorder')?.value || '#d97706';
    const cardBg = document.getElementById('pickerCardBg')?.value || '#0e0907';
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', accent);
    root.style.setProperty('--theme-border', border);
    root.style.setProperty('--theme-card-bg', cardBg);
  }

  async submitVisualTheme() {
    const name = document.getElementById('settingsCharName')?.value.trim();
    const avatar = document.getElementById('visualAvatarInput')?.value.trim();
    const banner = document.getElementById('visualBannerInput')?.value.trim();

    const accent = document.getElementById('pickerAccent')?.value;
    const border = document.getElementById('pickerBorder')?.value;
    const cardBg = document.getElementById('pickerCardBg')?.value;
    const textColor = document.getElementById('pickerText')?.value;

    const payload = {
      name: name || this.state.get()?.name,
      avatar_url: avatar || null,
      banner_url: banner || null,
      visual_theme: 'custom',
      visual_custom: { accent, border, cardBg, textColor }
    };

    try {
      const res = await this.api.patchVisual(payload);
      if (res.ok) {
        const updated = await res.json();
        this.state.set(updated);
        this.render();
        this.applyVisuals();
        alert("Кастомизация успешно сохранена!");
      }
    } catch (err) {
      alert("Ошибка сохранения: " + err.message);
    }
  }
}

// Запуск при загрузке документа
function startSheetApp() {
  const charId = window.CHARACTER_ID || (window.location.pathname.match(/\/characters\/(\d+)/) || [])[1];
  if (charId) {
    const app = new SheetApplication(charId);
    app.init();
  } else {
    console.error("Не найден CHARACTER_ID для инициализации листа!");
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSheetApp);
} else {
  startSheetApp();
}
