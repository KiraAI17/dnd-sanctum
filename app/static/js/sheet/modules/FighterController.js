import { DndRules } from '../rules/DndRules.js';

export class FighterController {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;
    this.compendiumManeuvers = [];
  }

  getManeuverDie(level = 1, subclass = '') {
    // У Мастера боя кости растут быстрее (d8 на 3, d10 на 5, d12 на 11)
    if (subclass.toLowerCase().includes('мастер боя')) {
      if (level >= 11) return 12;
      if (level >= 5) return 10;
      if (level >= 3) return 8;
    }
    // Базовая прогрессия Альт воина
    if (level >= 17) return 10;
    if (level >= 11) return 8;
    if (level >= 5) return 6;
    return 6;
  }

  getMaxDicePool(level = 1, subclass = '') {
    if (level < 2) return 0;
    let base = 2;
    if (level >= 17) base = 6;
    else if (level >= 13) base = 5;
    else if (level >= 7) base = 4;
    else if (level >= 3) base = 3;

    if (subclass.toLowerCase().includes('мастер боя')) base += 1;
    return base;
  }

  getPrimaryAbility() {
    const char = this.state.get();
    return localStorage.getItem(`char_${char?.id}_fighter_stat`) || 'str';
  }

  setPrimaryAbility(statKey) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_fighter_stat`, statKey);
    this.renderTab();
  }

  getKnownManeuvers() {
    const char = this.state.get();
    if (!char) return [];
    const raw = localStorage.getItem(`char_${char.id}_known_maneuvers`);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return ["Опрокидывающий удар", "Парирование", "Стиснуть зубы"];
  }

  saveKnownManeuvers(list) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_known_maneuvers`, JSON.stringify(list));
    this.renderTab();
  }

  async loadCompendium() {
    if (this.compendiumManeuvers.length === 0) {
      try {
        const res = await apiFetch('/compendium/maneuvers');
        if (res.ok) this.compendiumManeuvers = await res.json();
      } catch (e) {}
    }
  }

  async renderTab() {
    const char = this.state.get();
    if (!char) return;

    await this.loadCompendium();

    const lvl = char.level || 1;
    const sub = char.subclass || '';
    const stats = char.stats || {};
    const prof = DndRules.getProficiencyBonus(lvl);
    const chosenStat = this.getPrimaryAbility();
    const statMod = DndRules.calcMod(stats[chosenStat] || 10);
    const saveDc = 8 + prof + statMod;
    const dieSides = this.getManeuverDie(lvl, sub);

    // 1. Сл спасброска приёмов
    const dcEl = document.getElementById('ftrSaveDcDisplay');
    if (dcEl) dcEl.textContent = `${saveDc} (8 + ${prof} БМ + ${DndRules.formatMod(statMod)} ${chosenStat.toUpperCase()})`;

    const selStat = document.getElementById('ftrAbilitySelect');
    if (selStat) selStat.value = chosenStat;

    // 2. Куб превосходства
    const dieEl = document.getElementById('ftrDieDisplay');
    if (dieEl) dieEl.textContent = `1d${dieSides}`;

    // 3. Пул костей
    const maxPool = this.getMaxDicePool(lvl, sub);
    const usedDice = parseInt(localStorage.getItem(`char_${char.id}_maneuver_dice_used`) || '0');
    const poolEl = document.getElementById('ftrDicePoolDisplay');
    if (poolEl) poolEl.textContent = `${Math.max(0, maxPool - usedDice)} / ${maxPool}`;

    // 4. Второе дыхание и Всплеск действий
    const secondWindCard = document.getElementById('ftrSecondWindCard');
    if (secondWindCard) {
      const swHeal = `1d10 + ${lvl}`;
      const swBtn = document.getElementById('btnFtrSecondWind');
      if (swBtn) swBtn.textContent = `Исцелиться (${swHeal})`;
    }

    const eyeCard = document.getElementById('ftrStudiedEyeCard');
    if (eyeCard) eyeCard.classList.toggle('hidden', lvl < 3);

    const indomitableCard = document.getElementById('ftrIndomitableCard');
    if (indomitableCard) indomitableCard.classList.toggle('hidden', lvl < 9);

    // 5. Отрисовка списка приёмов
    this.renderManeuversList();
  }

  spendDie(amount = 1, maneuverName = '') {
    const char = this.state.get();
    if (!char) return false;

    const lvl = char.level || 1;
    const maxPool = this.getMaxDicePool(lvl, char.subclass || '');
    let used = parseInt(localStorage.getItem(`char_${char.id}_maneuver_dice_used`) || '0');

    if (used + amount > maxPool) {
      alert("Все кости приёмов исчерпаны! Совершите короткий или длительный отдых.");
      return false;
    }

    used += amount;
    localStorage.setItem(`char_${char.id}_maneuver_dice_used`, String(used));
    this.renderTab();

    if (this.dice) {
      this.dice.showToast(
        "⚔️ Приём воина",
        `Потрачена кость приёма на «${maneuverName}» (Осталось: ${maxPool - used}/${maxPool})`
      );
    }
    return true;
  }

  restoreDice() {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_maneuver_dice_used`, '0');
    this.renderTab();
    if (this.dice) {
      this.dice.showToast("⚔️ Тактическая передышка", "Кости приёмов полностью восстановлены!", "crit_success");
    }
  }

  async useSecondWind() {
    const char = this.state.get();
    if (!char) return;

    const lvl = char.level || 1;
    const rolled = Math.floor(Math.random() * 10) + 1;
    const healTotal = rolled + lvl;

    const newHp = Math.min(char.hp_max, char.hp_current + healTotal);
    await this.api.patchHp(newHp);
    this.state.updateHp(newHp);
    if (window.sheetApp) window.sheetApp.render();

    alert(`💨 Второе дыхание!\nБросок 1d10 (${rolled}) + ${lvl} Ур. = +${healTotal} HP восстановлено!`);
  }

  rollStudiedEye() {
    const char = this.state.get();
    const wisMod = DndRules.calcMod(char?.stats?.wis || 10);
    this.dice.rollCheck("👁️ Намётанный глаз (Внимательность)", wisMod);
  }

  renderManeuversList() {
    const container = document.getElementById('ftrKnownManeuversList');
    if (!container) return;

    const knownNames = this.getKnownManeuvers();
    const maneuvers = knownNames.map(name => {
      const f = this.compendiumManeuvers.find(m => m.name === name || m.id === name);
      return f || { name: name, activation: "Действие", description: "Описание не найдено." };
    });

    container.innerHTML = maneuvers.map(m => `
      <div class="p-3.5 rounded-xl bg-[#140e0a] border border-orange-950 flex flex-col justify-between space-y-2 shadow">
        <div>
          <div class="flex justify-between items-start gap-1">
            <strong class="text-amber-200 font-serif text-xs">${m.name}</strong>
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-amber-400 border border-orange-900">${m.activation || 'Приём'}</span>
          </div>
          ${m.prerequisite ? `<span class="text-[10px] text-stone-500 font-mono block mt-0.5">Треб.: ${m.prerequisite}</span>` : ''}
          <p class="text-[11px] text-stone-300 font-serif mt-1 leading-relaxed">${m.description}</p>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-orange-950/60">
          <button type="button" onclick="window.fighterApp.spendDie(1, '${m.name}')" class="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800 text-amber-200 text-[10px] font-bold hover:bg-amber-900">
            Использовать (1 кость)
          </button>
          <button type="button" onclick="window.fighterApp.forgetManeuver('${m.name}')" class="text-stone-500 hover:text-rose-400 text-xs px-1" title="Забыть приём">✕</button>
        </div>
      </div>
    `).join('') + `
      <div class="col-span-full pt-2 flex justify-end">
        <button type="button" onclick="window.fighterApp.openLearnModal()" class="px-3 py-1.5 rounded-lg bg-foxOrange-700 hover:bg-foxOrange-600 text-amber-100 text-xs font-bold shadow">
          ➕ Изучить новый приём
        </button>
      </div>
    `;
  }

  openLearnModal() {
    const known = this.getKnownManeuvers();
    const available = this.compendiumManeuvers.filter(m => !known.includes(m.name));

    if (available.length === 0) {
      alert("Все доступные приёмы уже изучены.");
      return;
    }

    const optionsList = available.map((m, i) => `${i + 1}. ${m.name} [${m.activation}]\n${m.description}`).join('\n\n');
    const pick = prompt(`Выберите номер приёма для изучения (1–${available.length}):\n\n${optionsList}`);

    const idx = parseInt(pick) - 1;
    if (!isNaN(idx) && available[idx]) {
      known.push(available[idx].name);
      this.saveKnownManeuvers(known);
    }
  }

  forgetManeuver(name) {
    if (!confirm(`Удалить «${name}» из списка изученных приёмов?`)) return;
    let known = this.getKnownManeuvers().filter(n => n !== name);
    this.saveKnownManeuvers(known);
  }
}
