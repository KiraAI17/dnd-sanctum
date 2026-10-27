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

    // Вызываем отрисовку изученных практик и традиций
    this.renderTraditionPanel(char, lvl, dieSides, wisMod, dexMod, prof, saveDc);
  }

  renderTraditionPanel(char, lvl, dieSides, wisMod, dexMod, prof, saveDc) {
    let container = document.getElementById('monkTraditionContainer');
    if (!container) {
      const tabCard = document.querySelector('#tabMonkKi .fox-card');
      if (!tabCard) return;
      container = document.createElement('div');
      container.id = 'monkTraditionContainer';
      container.className = 'space-y-4 pt-3 border-t border-amber-950/60 font-serif';
      tabCard.appendChild(container);
    }

    // Достаем практики из localStorage или из char.feats
    const storageKey = `char_${char.id}_monk_disciplines`;
    let learnedDisciplines = JSON.parse(localStorage.getItem(storageKey) || '[]');

    if (learnedDisciplines.length === 0 && char.feats) {
      char.feats.forEach(f => {
        const fName = typeof f === 'string' ? f : f.name;
        if (fName && fName.startsWith('Практика: ')) {
          const cleanName = fName.replace('Практика: ', '').trim();
          learnedDisciplines.push({
            id: 'disc_' + cleanName.toLowerCase().replace(/\s+/g, '_'),
            name: cleanName,
            description: typeof f === 'string' ? '' : (f.description || ''),
            ki_cost: 1
          });
        }
      });
    }

    if (learnedDisciplines.length === 0) {
      container.innerHTML = `
        <div class="p-3 bg-black/40 border border-amber-950/60 rounded-xl text-stone-400 text-xs text-center">
          Изученные практики традиции (Стихии / Кэнсэй) появятся здесь после выбора при повышении уровня.
        </div>
      `;
      return;
    }

    let cardsHtml = learnedDisciplines.map(d => {
      const kiText = d.ki_cost > 0 ? `${d.ki_cost} Ци` : 'Пассивно';
      const dmg = d.damage_dice ? ` • ${d.damage_dice} ${d.damage_type || ''}` : '';
      const save = d.saving_throw ? ` • Спасбросок ${d.saving_throw.toUpperCase()}` : '';

      return `
        <div class="p-3 rounded-xl bg-black/60 border border-amber-950/80 flex flex-col justify-between space-y-2 shadow">
          <div>
            <div class="flex justify-between items-start gap-2">
              <strong class="text-amber-300 text-xs font-bold">${d.name}</strong>
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 shrink-0">${kiText}</span>
            </div>
            <p class="text-[11px] text-stone-300 mt-1 leading-relaxed">${d.description || ''}</p>
            ${dmg || save ? `<div class="text-[10px] font-mono text-stone-400 pt-1">${save}${dmg}</div>` : ''}
          </div>
          ${d.ki_cost > 0 ? `
            <div class="flex justify-end pt-1">
              <button type="button" onclick="window.monkKi.useDiscipline('${d.id}', '${d.name}', ${d.ki_cost}, '${d.damage_dice || ''}')"
                      class="px-3 py-1 rounded bg-gradient-to-r from-amber-600 to-foxOrange-600 hover:brightness-110 text-stone-950 font-bold text-xs shadow active:scale-95 transition-all">
                Активировать (${d.ki_cost} Ци)
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-2">
        <div class="flex justify-between items-center border-b border-orange-950/60 pb-1.5">
          <strong class="text-amber-200 text-sm flex items-center gap-1.5">
            <span>🥋</span> <span>Изученные боевые практики</span>
          </strong>
          <span class="text-[10px] font-mono text-amber-400">Сл спасброска: ${saveDc}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  useDiscipline(id, name, cost, damageDice) {
    if (this.spendKi(cost, name)) {
      if (damageDice && damageDice !== 'null' && damageDice !== '') {
        window.diceRoller.rollFormula(`Урон: ${name}`, damageDice);
      }
    }
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
