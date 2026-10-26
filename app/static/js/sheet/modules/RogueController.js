import { DndRules } from '../rules/DndRules.js';

export class RogueController {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;
  }

  getSneakDice() {
    const char = this.state.get();
    return DndRules.getSneakAttackDice(char?.level || 1);
  }

  // Расход и восстановление костей псионики (Клинок души)
  getPsiDiceMax(lvl) {
    const prof = DndRules.getProficiencyBonus(lvl);
    return prof * 2;
  }

  getPsiDiceSides(lvl) {
    if (lvl >= 17) return 12;
    if (lvl >= 11) return 10;
    if (lvl >= 5) return 8;
    return 6;
  }

  renderTab() {
    const char = this.state.get();
    if (!char) return;

    const lvl = char.level || 1;
    const sub = (char.subclass || '').toLowerCase();
    const sneakFormula = this.getSneakDice();

    // 1. Отображение костей Скрытой атаки
    const sneakEl = document.getElementById('rogueSneakDiceDisplay');
    if (sneakEl) sneakEl.textContent = sneakFormula;

    // 2. Видимость фич по уровню
    const uncannyCard = document.getElementById('rogueUncannyDodgeCard');
    if (uncannyCard) uncannyCard.classList.toggle('hidden', lvl < 5);

    const evasionCard = document.getElementById('rogueEvasionCard');
    if (evasionCard) evasionCard.classList.toggle('hidden', lvl < 7);

    const reliableCard = document.getElementById('rogueReliableTalentCard');
    if (reliableCard) reliableCard.classList.toggle('hidden', lvl < 11);

    const blindsenseCard = document.getElementById('rogueBlindsenseCard');
    if (blindsenseCard) blindsenseCard.classList.toggle('hidden', lvl < 14);

    const strokeCard = document.getElementById('rogueStrokeOfLuckCard');
    if (strokeCard) strokeCard.classList.toggle('hidden', lvl < 20);

    // 3. Специфические панели архетипов
    const soulknifePanel = document.getElementById('rogueSoulknifePanel');
    if (soulknifePanel) {
      const isSoulknife = sub.includes('клинок души') || sub.includes('soulknife');
      soulknifePanel.classList.toggle('hidden', !isSoulknife);
      if (isSoulknife) {
        const maxPsi = this.getPsiDiceMax(lvl);
        const sides = this.getPsiDiceSides(lvl);
        const usedPsi = parseInt(localStorage.getItem(`char_${char.id}_psi_used`) || '0');
        document.getElementById('roguePsiDicePoolDisplay').textContent = `${Math.max(0, maxPsi - usedPsi)} / ${maxPsi} (d${sides})`;
      }
    }

    const phantomPanel = document.getElementById('roguePhantomPanel');
    if (phantomPanel) {
      const isPhantom = sub.includes('фантом') || sub.includes('phantom');
      phantomPanel.classList.toggle('hidden', !isPhantom || lvl < 9);
      if (isPhantom && lvl >= 9) {
        const prof = DndRules.getProficiencyBonus(lvl);
        const count = parseInt(localStorage.getItem(`char_${char.id}_soul_trinkets`) || '0');
        document.getElementById('rogueSoulTrinketsDisplay').textContent = `${count} / ${prof}`;
      }
    }

    // 4. Отрисовка списка Компетентности
    this.renderExpertiseList();
  }

  // Бросок урона Скрытой атаки
  rollSneakAttack() {
    const char = this.state.get();
    const formula = this.getSneakDice();
    this.dice.rollFormula("🗡️ Скрытая атака (Sneak Attack)", formula);
  }

  // Опциональное правило: Точное прицеливание (Steady Aim)
  useSteadyAim() {
    this.dice.showToast(
      "🎯 Точное прицеливание (Steady Aim)",
      "Вы получили преимущество на следующую атаку в этом ходу! Ваша скорость снижена до 0 фт.",
      "crit_success"
    );
  }

  // Трата пси-кости Клинка души
  spendPsiDie(techniqueName) {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const maxPsi = this.getPsiDiceMax(lvl);
    let used = parseInt(localStorage.getItem(`char_${char.id}_psi_used`) || '0');

    if (used >= maxPsi) {
      alert("Все кости пси-энергии исчерпаны! Требуется длинный отдых.");
      return;
    }

    used += 1;
    localStorage.setItem(`char_${char.id}_psi_used`, String(used));
    this.renderTab();
    const sides = this.getPsiDiceSides(lvl);
    this.dice.rollFormula(`🧠 Пси-энергия: ${techniqueName}`, `1d${sides}`);
  }

  restorePsiDice() {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_psi_used`, '0');
    this.renderTab();
    this.dice.showToast("🧠 Пси-энергия", "Кости псионики полностью восстановлены!", "crit_success");
  }

  // Управление Компетентностью (выбор 2 навыков на 1 ур., +2 на 6 ур.)
  getExpertiseList() {
    const char = this.state.get();
    if (!char) return [];
    const local = localStorage.getItem(`char_${char.id}_expertise`);
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }
    return char.expertise || ["Скрытность", "Воровские инструменты"];
  }

  saveExpertiseList(list) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_expertise`, JSON.stringify(list));
    this.renderTab();
    if (window.sheetApp) window.sheetApp.render();
  }

  renderExpertiseList() {
    const container = document.getElementById('rogueExpertiseList');
    if (!container) return;
    const char = this.state.get();
    const lvl = char?.level || 1;
    const maxAllowed = lvl >= 6 ? 4 : 2;
    const currentList = this.getExpertiseList();

    container.innerHTML = `
      <div class="flex flex-wrap gap-2 items-center">
        ${currentList.map(item => `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-amber-500/50 text-amber-200 text-xs font-serif shadow">
            <span>⭐ ${item}</span>
            <button type="button" onclick="window.rogueApp.removeExpertise('${item}')" class="text-stone-400 hover:text-rose-400 font-bold ml-1 text-xs">&times;</button>
          </span>
        `).join('')}
        ${currentList.length < maxAllowed ? `
          <button type="button" onclick="window.rogueApp.promptAddExpertise()" class="px-2.5 py-1 rounded-lg bg-[#18100a] border border-dashed border-amber-600/70 text-amber-300 hover:border-amber-400 text-xs font-serif font-bold">
            ＋ Выбрать компетентность (${currentList.length}/${maxAllowed})
          </button>
        ` : ''}
      </div>
    `;
  }

  promptAddExpertise() {
    const char = this.state.get();
    const profs = Array.from(new Set([
      ...(char?.skills || []),
      "Акробатика", "Атлетика", "Восприятие", "Ловкость рук", "Обман", "Проницательность", "Расследование", "Скрытность", "Убеждение", "Воровские инструменты"
    ]));
    const current = this.getExpertiseList();
    const available = profs.filter(p => !current.includes(p));

    if (!available.length) {
      alert("Все доступные владения уже имеют Компетентность.");
      return;
    }

    const options = available.map((a, i) => `${i + 1}. ${a}`).join('\n');
    const pick = prompt(`Выберите номер владения для удвоения бонуса мастерства (Компетентность):\n\n${options}`);
    const idx = parseInt(pick) - 1;
    if (!isNaN(idx) && available[idx]) {
      current.push(available[idx]);
      this.saveExpertiseList(current);
    }
  }

  removeExpertise(name) {
    if (!confirm(`Убрать компетентность с «${name}»?`)) return;
    let current = this.getExpertiseList().filter(x => x !== name);
    this.saveExpertiseList(current);
  }

  rollThievesTools() {
    const char = this.state.get();
    const stats = char?.stats || {};
    const dexMod = DndRules.calcMod(stats.dex || 10);
    const prof = DndRules.getProficiencyBonus(char?.level || 1);
    const isExp = this.getExpertiseList().includes("Воровские инструменты");

    const finalBonus = dexMod + (isExp ? prof * 2 : prof);
    this.dice.rollCheck(
      `🗝️ Воровские инструменты${isExp ? " (Компетентность ⭐)" : ""}`,
      finalBonus,
      char,
      true // чтобы срабатывал «Надёжный талант» на 11+ ур!
    );
  }
}