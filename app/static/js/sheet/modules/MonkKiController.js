import { DndRules } from '../rules/DndRules.js';

export class MonkKiController {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;
  }

  getMartialArtsDie(level = 1) {
    return DndRules.getMartialArtsDie(level);
  }

  renderTab() {
    const char = this.state.get();
    if (!char) return;

    const lvl = char.level || 1;
    const stats = char.stats || {};
    const prof = DndRules.getProficiencyBonus(lvl);
    const wisMod = DndRules.calcMod(stats.wis || 10);
    const dexMod = DndRules.calcMod(stats.dex || 10);
    const saveDc = 8 + prof + wisMod;
    const dieSides = this.getMartialArtsDie(lvl);

    // 1. Сл спасброска Ци
    const dcEl = document.getElementById('kiSaveDcDisplay');
    if (dcEl) dcEl.textContent = `${saveDc} (8 + ${prof} БМ + ${DndRules.formatMod(wisMod)} МУД)`;

    // 2. Трекер очков Ци
    const maxKi = lvl;
    const usedKi = parseInt(localStorage.getItem(`char_${char.id}_ki_used`) || '0');
    const pointsEl = document.getElementById('kiPointsDisplay');
    if (pointsEl) pointsEl.textContent = `${Math.max(0, maxKi - usedKi)} / ${maxKi}`;

    // 3. Кость боевых искусств
    const dieEl = document.getElementById('monkDieDisplay');
    if (dieEl) dieEl.textContent = `1d${dieSides}`;

    // 4. Защита без доспехов (КД)
    const unarmoredAc = 10 + dexMod + wisMod;
    const acEl = document.getElementById('monkUnarmoredAcDisplay');
    if (acEl) acEl.textContent = `${unarmoredAc} (10 + ${dexMod} ЛОВ + ${wisMod} МУД)`;

    // 5. Видимость продвинутых карт по уровню
    const stunCard = document.getElementById('monkStunStrikeCard');
    if (stunCard) stunCard.classList.toggle('hidden', lvl < 5);

    const healCard = document.getElementById('monkQuickHealCard');
    if (healCard) healCard.classList.toggle('hidden', lvl < 4);

    const aimCard = document.getElementById('monkFocusedAimCard');
    if (aimCard) aimCard.classList.toggle('hidden', lvl < 5);
  }

  spendKi(amount, techniqueName) {
    const char = this.state.get();
    if (!char) return false;

    const maxKi = char.level || 1;
    let usedKi = parseInt(localStorage.getItem(`char_${char.id}_ki_used`) || '0');

    if (usedKi + amount > maxKi) {
      alert(`Недостаточно очков Ци (требуется: ${amount}, осталось: ${maxKi - usedKi})! Совершите короткий отдых или медитацию.`);
      return false;
    }

    usedKi += amount;
    localStorage.setItem(`char_${char.id}_ki_used`, String(usedKi));
    this.renderTab();

    if (this.dice) {
      this.dice.showToast(
        "☯️ Энергия Ци",
        `Использовано ${amount} Ци: «${techniqueName}» (Осталось: ${maxKi - usedKi}/${maxKi})`
      );
    }
    return true;
  }

  restoreKiPoints() {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_ki_used`, '0');
    this.renderTab();
    if (this.dice) {
      this.dice.showToast("☯️ Гармония Ци", "Очки Ци полностью восстановлены!", "crit_success");
    }
  }

  // Приём: Ускоренное исцеление (4+ ур.)
  async quickenedHealing() {
    const char = this.state.get();
    if (!char) return;

    if (!this.spendKi(2, "Ускоренное исцеление")) return;

    const lvl = char.level || 1;
    const die = this.getMartialArtsDie(lvl);
    const prof = DndRules.getProficiencyBonus(lvl);
    const rolled = Math.floor(Math.random() * die) + 1;
    const healTotal = rolled + prof;

    const newHp = Math.min(char.hp_max, char.hp_current + healTotal);
    await this.api.patchHp(newHp);
    this.state.updateHp(newHp);
    if (window.sheetApp) window.sheetApp.render();

    alert(`✨ Ускоренное исцеление!\nБросок 1d${die} (${rolled}) + ${prof} БМ = +${healTotal} HP восстановлено!`);
  }

  // Приём: Отражение снарядов (3+ ур.)
  deflectMissiles() {
    const char = this.state.get();
    const lvl = char.level || 1;
    const dexMod = DndRules.calcMod(char?.stats?.dex || 10);
    const rolled = Math.floor(Math.random() * 10) + 1;
    const totalReduced = rolled + dexMod + lvl;

    if (this.dice) {
      this.dice.showToast(
        "🖐️ Отражение снарядов",
        `1d10 (${rolled}) + ${dexMod} ЛОВ + ${lvl} Ур. = Снижение урона на ${totalReduced} ед.! Если урон = 0, снаряд пойман!`
      );
    }
  }

  // Приём: Фокусировка на цели (5+ ур.)
  focusedAim(points) {
    if (this.spendKi(points, `Фокусировка на цели (+${points * 2} к атаке)`)) {
      alert(`🎯 К результату атаки добавлено +${points * 2}!`);
    }
  }
}
