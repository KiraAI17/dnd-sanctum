import { DndRules } from '../rules/DndRules.js';

export class DiceRoller {
  constructor(apiClient) {
    this.api = apiClient;
    this.toastEl = document.getElementById('diceToast');
    this.iconEl = document.getElementById('toastIcon');
    this.titleEl = document.getElementById('toastTitle');
    this.bodyEl = document.getElementById('toastBody');
    this.timer = null;
  }

  showToast(title, bodyText, type = 'normal') {
    if (!this.toastEl) return;

    if (this.timer) clearTimeout(this.timer);

    if (type === 'crit_success') {
      if (this.iconEl) this.iconEl.textContent = "🔥";
      if (this.titleEl) this.titleEl.textContent = "КРИТИЧЕСКИЙ УСПЕХ (НАТ 20)!";
      this.toastEl.className = "fixed bottom-6 right-6 z-[99999] fox-card p-4 rounded-xl border-2 border-amber-400 bg-amber-950/95 text-amber-100 text-xs shadow-2xl flex items-center gap-3 animate-bounce";
    } else if (type === 'crit_fail') {
      if (this.iconEl) this.iconEl.textContent = "💀";
      if (this.titleEl) this.titleEl.textContent = "КРИТИЧЕСКИЙ ПРОВАЛ (1)!";
      this.toastEl.className = "fixed bottom-6 right-6 z-[99999] fox-card p-4 rounded-xl border-2 border-rose-600 bg-rose-950/95 text-rose-100 text-xs shadow-2xl flex items-center gap-3 animate-bounce";
    } else {
      if (this.iconEl) this.iconEl.textContent = "🎲";
      if (this.titleEl) this.titleEl.textContent = title;
      this.toastEl.className = "fixed bottom-6 right-6 z-[99999] fox-card p-4 rounded-xl border border-amber-500 bg-stone-950/95 text-amber-200 text-xs shadow-2xl flex items-center gap-3 animate-bounce";
    }

    if (this.bodyEl) this.bodyEl.textContent = bodyText;
    this.toastEl.classList.remove('hidden');

    this.timer = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 6000);
  }

  getCriticalThreshold(character) {
    if (!character) return 20;
    const sub = (character.subclass || '').toLowerCase();
    const lvl = character.level || 1;

    // Витязь (Champion): 19-20 на 3 ур., 18-20 на 15 ур.
    if (sub.includes('витязь') || sub.includes('чемпион')) {
      return lvl >= 15 ? 18 : 19;
    }

    // Мутаген «Точность» у Мутанта
    const activeMutagens = localStorage.getItem(`char_${character.id}_active_mutagens`) || '';
    if (activeMutagens.includes('Точность')) return 19;

    return 20;
  }

  rollCheck(title, mod = 0, character = null, isProficientOrExpert = false) {
    let d20 = Math.floor(Math.random() * 20) + 1;
    let reliableApplied = false;

    // Плут 11+ ур: Надёжный талант (Reliable Talent)
    if (character) {
      const cName = (character.class_name || '').toLowerCase();
      const lvl = character.level || 1;
      if ((cName.includes('плут') || cName.includes('rogue')) && lvl >= 11 && isProficientOrExpert) {
        if (d20 < 10) {
          d20 = 10;
          reliableApplied = true;
        }
      }
    }

    // Бард: Коллегия Красноречия (Златоуст: минимум 10 на Убеждение и Обман)
    if (character) {
      const sub = (character.subclass || '').toLowerCase();
      const tLower = String(title || '').toLowerCase();
      if ((sub.includes('красноречи') || sub.includes('eloquence')) &&
          (tLower.includes('убеждение') || tLower.includes('обман'))) {
        if (d20 < 10) {
          d20 = 10;
          reliableApplied = true;
          extraNote = " (Златоуст: мин. 10)";
        }
      }
    }

    const total = d20 + mod;
    const modStr = DndRules.formatMod(mod);
    const critThreshold = this.getCriticalThreshold(character);

    let extraNote = reliableApplied ? " (Надёжный талант: мин. 10)" : "";

    if (d20 >= critThreshold) {
      this.showToast(title, `${title}: d20 (${d20}) ${modStr} = ${total} (КРИТИЧЕСКИЙ ТРИУМФ!)${extraNote}`, 'crit_success');
    } else if (d20 === 1 && !reliableApplied) {
      this.showToast(title, `${title}: d20 (${d20}) ${modStr} = ${total} (КАТАСТРОФА!)`, 'crit_fail');
    } else {
      this.showToast(title, `${title}: d20 (${d20}) ${modStr} = ${total}${extraNote}`, 'normal');
    }
  }

  async rollFormula(title, formula) {
    try {
      const res = await this.api.roll(formula);
      if (res.ok) {
        const data = await res.json();
        this.showToast(`${title} (${formula})`, `${data.breakdown} = ${data.total}`, 'normal');
      } else {
        // Fallback на локальный бросок, если бэкенд недоступен
        this.rollFormulaLocal(title, formula);
      }
    } catch {
      this.rollFormulaLocal(title, formula);
    }
  }

  rollFormulaLocal(title, formula) {
    const norm = formula.toLowerCase().replace(/к/g, 'd').replace(/ /g, '');
    const m = norm.match(/(\d+)d(\d+)([\+\-]\d+)?/);
    if (!m) return;

    const count = parseInt(m[1]) || 1;
    const sides = parseInt(m[2]) || 6;
    const bonus = parseInt(m[3]) || 0;

    let rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }
    const total = sum + bonus;
    const breakdown = `[${rolls.join(', ')}]${bonus !== 0 ? DndRules.formatMod(bonus) : ''}`;
    this.showToast(`${title} (${formula})`, `${breakdown} = ${total}`, 'normal');
  }
}