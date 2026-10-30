import { DndRules } from '../rules/DndRules.js';

export class WizardController {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;
  }

  renderTab() {
    const char = this.state.get();
    if (!char) return;

    const lvl = char.level || 1;
    const sub = (char.subclass || '').toLowerCase();
    const stats = char.stats || {};
    const intMod = DndRules.calcMod(stats.int || 10);
    const prof = DndRules.getProficiencyBonus(lvl);
    const spellDc = 8 + prof + intMod;

    // 1. Верхние показатели
    const dcEl = document.getElementById('wizSpellDcDisplay');
    const intEl = document.getElementById('wizIntModDisplay');
    const prepEl = document.getElementById('wizPrepCountDisplay');
    if (dcEl) dcEl.textContent = spellDc;
    if (intEl) intEl.textContent = DndRules.formatMod(intMod);
    if (prepEl) prepEl.textContent = Math.max(1, lvl + intMod);

    // 2. Базовые умения
    const recCard = document.getElementById('wizArcaneRecoveryCard');
    if (recCard) {
      const maxSlots = Math.ceil(lvl / 2);
      const usedRec = localStorage.getItem(`char_${char.id}_arcane_rec_used`) === 'true';
      document.getElementById('wizArcaneRecMaxDisplay').textContent = `${maxSlots} уровней ячеек`;
      document.getElementById('wizArcaneRecStatus').textContent = usedRec ? "Использовано" : "Доступно";
      document.getElementById('btnWizArcaneRecovery').disabled = usedRec;
    }

    const masteryCard = document.getElementById('wizSpellMasteryCard');
    if (masteryCard) masteryCard.classList.toggle('hidden', lvl < 18);

    const sigCard = document.getElementById('wizSignatureSpellsCard');
    if (sigCard) sigCard.classList.toggle('hidden', lvl < 20);

    // 3. Подклассовые панели (все 13 школ)
    this.renderTraditions(char, lvl, sub, intMod, prof, spellDc);
  }

  renderTraditions(char, lvl, sub, intMod, prof, spellDc) {
    // 1. Воплощение (Evocation)
    const evoPanel = document.getElementById('wizEvocationPanel');
    if (evoPanel) {
      const isEvo = sub.includes('воплощен') || sub.includes('evocation');
      evoPanel.classList.toggle('hidden', !isEvo);
      if (isEvo) {
        document.getElementById('wizOverchannelBlock')?.classList.toggle('hidden', lvl < 14);
      }
    }

    // 2. Вызов (Conjuration)
    const conjPanel = document.getElementById('wizConjurationPanel');
    if (conjPanel) {
      const isConj = sub.includes('вызов') || sub.includes('созидан') || sub.includes('conjuration');
      conjPanel.classList.toggle('hidden', !isConj);
      if (isConj) {
        document.getElementById('wizBenignTransBlock')?.classList.toggle('hidden', lvl < 6);
      }
    }

    // 3. Иллюзия (Illusion)
    const illPanel = document.getElementById('wizIllusionPanel');
    if (illPanel) {
      const isIll = sub.includes('иллюзи') || sub.includes('illusion');
      illPanel.classList.toggle('hidden', !isIll);
      if (isIll) {
        document.getElementById('wizIllusoryRealityBlock')?.classList.toggle('hidden', lvl < 14);
      }
    }

    // 4. Некромантия (Necromancy)
    const necroPanel = document.getElementById('wizNecromancyPanel');
    if (necroPanel) {
      const isNecro = sub.includes('некромант') || sub.includes('necromancy');
      necroPanel.classList.toggle('hidden', !isNecro);
      if (isNecro) {
        document.getElementById('wizCommandUndeadBlock')?.classList.toggle('hidden', lvl < 14);
      }
    }

    // 5. Ограждение (Abjuration)
    const abjPanel = document.getElementById('wizAbjurationPanel');
    if (abjPanel) {
      const isAbj = sub.includes('огражден') || sub.includes('abjuration');
      abjPanel.classList.toggle('hidden', !isAbj);
      if (isAbj) {
        const maxWard = (lvl * 2) + intMod;
        const curWard = parseInt(localStorage.getItem(`char_${char.id}_arcane_ward_hp`) || String(maxWard));
        const wardEl = document.getElementById('wizArcaneWardHpDisplay');
        if (wardEl) wardEl.textContent = `${curWard} / ${maxWard}`;
      }
    }

    // 6. Очарование (Enchantment)
    const enchPanel = document.getElementById('wizEnchantmentPanel');
    if (enchPanel) {
      const isEnch = sub.includes('очарован') || sub.includes('enchantment');
      enchPanel.classList.toggle('hidden', !isEnch);
    }

    // 7. Преобразование (Transmutation)
    const transPanel = document.getElementById('wizTransmutationPanel');
    if (transPanel) {
      const isTrans = sub.includes('преобразован') || sub.includes('transmutation');
      transPanel.classList.toggle('hidden', !isTrans);
      if (isTrans) {
        document.getElementById('wizTransmuterStoneBlock')?.classList.toggle('hidden', lvl < 6);
      }
    }

    // 8. Прорицание (Divination)
    const divPanel = document.getElementById('wizDivinationPanel');
    if (divPanel) {
      const isDiv = sub.includes('прорицан') || sub.includes('divination');
      divPanel.classList.toggle('hidden', !isDiv);
      if (isDiv) {
        const portentList = JSON.parse(localStorage.getItem(`char_${char.id}_portent_dice`) || '[]');
        const pCont = document.getElementById('wizPortentContainer');
        if (pCont) {
          if (!portentList.length) {
            pCont.innerHTML = `<span class="text-stone-500 italic text-[11px]">Кубы Знамения не брошены на отдыхе.</span>`;
          } else {
            pCont.innerHTML = portentList.map((val, idx) => `
              <button type="button" onclick="window.wizardApp.usePortentDie(${idx})"
                      class="w-8 h-8 rounded-lg bg-black/60 border border-amber-500/60 font-mono font-bold text-amber-300 text-sm hover:border-amber-400">
                ${val}
              </button>
            `).join('');
          }
        }
      }
    }

    // 9. Военная магия (War Magic)
    const warPanel = document.getElementById('wizWarMagicPanel');
    if (warPanel) {
      const isWar = sub.includes('военная') || sub.includes('war magic');
      warPanel.classList.toggle('hidden', !isWar);
      if (isWar) {
        const maxSurge = Math.max(1, intMod);
        const curSurge = parseInt(localStorage.getItem(`char_${char.id}_power_surge_count`) || '1');
        document.getElementById('wizPowerSurgeDisplay').textContent = `${curSurge} / ${maxSurge}`;
        document.getElementById('wizPowerSurgeBlock')?.classList.toggle('hidden', lvl < 6);
      }
    }

    // 10. Хронургия (Chronurgy)
    const chronoPanel = document.getElementById('wizChronurgyPanel');
    if (chronoPanel) {
      const isChrono = sub.includes('хронург') || sub.includes('chronurgy');
      chronoPanel.classList.toggle('hidden', !isChrono);
      if (isChrono) {
        const usedShift = parseInt(localStorage.getItem(`char_${char.id}_chronal_shift_used`) || '0');
        document.getElementById('wizChronalShiftDisplay').textContent = `${Math.max(0, 2 - usedShift)} / 2`;
      }
    }

    // 11. Гравитургия (Graviturgy)
    const graviPanel = document.getElementById('wizGraviturgyPanel');
    if (graviPanel) {
      const isGravi = sub.includes('гравитург') || sub.includes('graviturgy');
      graviPanel.classList.toggle('hidden', !isGravi);
    }

    // 12. Орден Писцов (Order of Scribes)
    const scribesPanel = document.getElementById('wizOrderOfScribesPanel');
    if (scribesPanel) {
      const isScribes = sub.includes('писц') || sub.includes('scribes');
      scribesPanel.classList.toggle('hidden', !isScribes);
      if (isScribes) {
        document.getElementById('wizManifestMindBlock')?.classList.toggle('hidden', lvl < 6);
      }
    }

    // 13. Песнь клинка (Bladesinging)
    const bladesongPanel = document.getElementById('wizBladesingingPanel');
    if (bladesongPanel) {
      const isBlade = sub.includes('песнь клинка') || sub.includes('bladesing');
      bladesongPanel.classList.toggle('hidden', !isBlade);
      if (isBlade) {
        const maxSongs = prof;
        const usedSongs = parseInt(localStorage.getItem(`char_${char.id}_bladesong_used`) || '0');
        const isActive = localStorage.getItem(`char_${char.id}_bladesong_active`) === 'true';
        document.getElementById('wizBladesongUsesDisplay').textContent = `${Math.max(0, maxSongs - usedSongs)} / ${maxSongs}`;
        const activeBtn = document.getElementById('btnToggleBladesong');
        if (activeBtn) {
          activeBtn.textContent = isActive ? "⚔️ Песнь клинка АКТИВНА (деактивировать)" : "✨ Активировать Песнь клинка";
          activeBtn.className = isActive
            ? "px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-200 font-bold text-xs"
            : "px-3 py-1.5 rounded-lg bg-foxOrange-700 text-stone-950 font-bold text-xs hover:bg-foxOrange-600";
        }
      }
    }
  }

  // --- МЕХАНИКИ И ДЕЙСТВИЯ ---

  useArcaneRecovery() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const maxSlots = Math.ceil(lvl / 2);
    const used = localStorage.getItem(`char_${char.id}_arcane_rec_used`) === 'true';

    if (used) {
      alert("Магическое восстановление уже совершено сегодня!");
      return;
    }

    localStorage.setItem(`char_${char.id}_arcane_rec_used`, 'true');
    this.renderTab();
    this.dice.showToast(
      "📖 Магическое восстановление",
      `Вы восстановили ячейки суммарным кругом до ${maxSlots} (не выше 5-го круга)!`,
      "crit_success"
    );
  }

  // Прорицание: Бросок кубов Знамения (Portent)
  rollPortentDice() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 2;
    const count = lvl >= 14 ? 3 : 2;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * 20) + 1);
    }

    localStorage.setItem(`char_${char.id}_portent_dice`, JSON.stringify(rolls));
    this.renderTab();
    this.dice.showToast("🔮 Знамение (Portent)", `Вы заглянули в будущее: выпали [${rolls.join(', ')}]!`, "crit_success");
  }

  usePortentDie(index) {
    const char = this.state.get();
    if (!char) return;
    const portentList = JSON.parse(localStorage.getItem(`char_${char.id}_portent_dice`) || '[]');
    const val = portentList[index];

    if (!confirm(`Использовать куб Знамения со значением [${val}] для замены броска d20?`)) return;

    portentList.splice(index, 1);
    localStorage.setItem(`char_${char.id}_portent_dice`, JSON.stringify(portentList));
    this.renderTab();

    this.dice.showToast("🔮 Знамение воплощено", `Бросок заменён значением: ${val}!`, "crit_success");
  }

  // Ограждение: Изменение хитов Магической защиты (Arcane Ward)
  modifyArcaneWard(delta) {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const intMod = DndRules.calcMod(char.stats?.int || 10);
    const maxWard = (lvl * 2) + intMod;

    let curWard = parseInt(localStorage.getItem(`char_${char.id}_arcane_ward_hp`) || String(maxWard));
    curWard = Math.max(0, Math.min(maxWard, curWard + delta));

    localStorage.setItem(`char_${char.id}_arcane_ward_hp`, String(curWard));
    this.renderTab();
  }

  // Песнь клинка: активация стойки
  toggleBladesong() {
    const char = this.state.get();
    if (!char) return;
    const prof = DndRules.getProficiencyBonus(char.level || 1);
    let used = parseInt(localStorage.getItem(`char_${char.id}_bladesong_used`) || '0');
    let isActive = localStorage.getItem(`char_${char.id}_bladesong_active`) === 'true';

    if (!isActive) {
      if (used >= prof) {
        alert("Заряды Песни клинка исчерпаны до длинного отдыха!");
        return;
      }
      used += 1;
      localStorage.setItem(`char_${char.id}_bladesong_used`, String(used));
      localStorage.setItem(`char_${char.id}_bladesong_active`, 'true');
      this.dice.showToast("⚔️ Песнь клинка активна", "+Интеллект к КД и концентрации, +10 фт скорости, преимущество на Акробатику!", "crit_success");
    } else {
      localStorage.setItem(`char_${char.id}_bladesong_active`, 'false');
      this.dice.showToast("⚔️ Песнь клинка", "Боевая стойка деактивирована.", "normal");
    }

    this.renderTab();
    if (window.sheetApp) {
      window.sheetApp.render();
      window.sheetApp.updateArmorSelection();
    }
  }

  // Военная магия: Всплеск мощи (Power Surge)
  spendPowerSurge() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 6;
    let cur = parseInt(localStorage.getItem(`char_${char.id}_power_surge_count`) || '1');

    if (cur <= 0) {
      alert("Нет зарядов Всплеска мощи! Успешно отмените заклинание для пополнения.");
      return;
    }

    cur -= 1;
    localStorage.setItem(`char_${char.id}_power_surge_count`, String(cur));
    this.renderTab();

    const dmg = Math.max(1, Math.floor(lvl / 2));
    this.dice.showToast("⚡ Всплеск мощи", `Добавлено +${dmg} урона силовым полем к заклинанию!`, "crit_success");
  }

  // Хронургия: Хроно-сдвиг
  useChronalShift() {
    const char = this.state.get();
    if (!char) return;
    let used = parseInt(localStorage.getItem(`char_${char.id}_chronal_shift_used`) || '0');

    if (used >= 2) {
      alert("Все использования Хроно-сдвига исчерпаны до отдыха!");
      return;
    }

    used += 1;
    localStorage.setItem(`char_${char.id}_chronal_shift_used`, String(used));
    this.renderTab();
    this.dice.showToast("⏳ Хроно-сдвиг", "Цель обязана перебросить кубик d20 и применить новый результат!", "crit_success");
  }

  // Сброс ресурсов на длинном отдыхе
  restoreAllWizardResources() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const intMod = DndRules.calcMod(char.stats?.int || 10);

    localStorage.removeItem(`char_${char.id}_arcane_rec_used`);
    localStorage.removeItem(`char_${char.id}_bladesong_used`);
    localStorage.setItem(`char_${char.id}_bladesong_active`, 'false');
    localStorage.removeItem(`char_${char.id}_chronal_shift_used`);
    localStorage.setItem(`char_${char.id}_arcane_ward_hp`, String((lvl * 2) + intMod));

    // Автоматический переброс кубов Знамения при длительном отдыхе для Прорицателя
    const sub = (char.subclass || '').toLowerCase();
    if (sub.includes('прорицан') || sub.includes('divination')) {
      this.rollPortentDice();
    }

    this.renderTab();
  }
}
