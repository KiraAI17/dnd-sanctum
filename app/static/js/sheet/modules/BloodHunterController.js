import { DndRules } from '../rules/DndRules.js';

export class BloodHunterController {
  constructor(state, apiClient) {
    this.state = state;
    this.api = apiClient;
    this.compendiumCurses = [];
  }

  getHemocraftDie(level = 1) {
    if (level >= 17) return 10;
    if (level >= 11) return 8;
    if (level >= 5) return 6;
    return 4;
  }

  getMaxBloodCurses(level = 1) {
    if (level >= 17) return 4;
    if (level >= 13) return 3;
    if (level >= 6) return 2;
    return 1;
  }

  getHemocraftAbility() {
    const char = this.state.get();
    return localStorage.getItem(`char_${char?.id}_bh_ability`) || 'int';
  }

  changeHemocraftAbility(abilityKey) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_bh_ability`, abilityKey);
    this.renderTab();
    if (window.sheetApp) window.sheetApp.render();
  }

  getHemocraftMod() {
    const char = this.state.get();
    const stats = char?.stats || {};
    const ability = this.getHemocraftAbility();
    return Math.max(1, DndRules.calcMod(stats[ability] || 10));
  }

  async loadCurses() {
    if (this.compendiumCurses.length === 0) {
      try {
        const res = await apiFetch('/compendium/blood-curses');
        if (res.ok) this.compendiumCurses = await res.json();
      } catch (e) {}
    }
  }

  async renderTab() {
    const char = this.state.get();
    if (!char) return;

    await this.loadCurses();

    const level = char.level || 1;
    const dieSides = this.getHemocraftDie(level);
    const prof = DndRules.getProficiencyBonus(level);
    const hemoMod = this.getHemocraftMod();
    const saveDc = 8 + prof + hemoMod;
    const hemoAbility = this.getHemocraftAbility();

    // 1. Отображение характеристик в шапке
    const dieEl = document.getElementById('bhDieDisplay');
    const hemoModEl = document.getElementById('bhHemocraftModDisplay');
    const dcEl = document.getElementById('bhSaveDcDisplay');
    const selEl = document.getElementById('bhAbilitySelect');

    if (dieEl) dieEl.textContent = `1d${dieSides}`;
    if (hemoModEl) hemoModEl.textContent = DndRules.formatMod(hemoMod);
    if (dcEl) dcEl.textContent = `${saveDc} (8 + ${prof} БМ + ${hemoMod} ${hemoAbility.toUpperCase()})`;
    if (selEl) selEl.value = hemoAbility;

    // 2. Трекер проклятий
    const maxCurses = this.getMaxBloodCurses(level);
    const usedCurses = parseInt(localStorage.getItem(`char_${char.id}_bh_curses_used`) || '0');
    const cursesEl = document.getElementById('bhCursesTracker');
    if (cursesEl) cursesEl.textContent = `${Math.max(0, maxCurses - usedCurses)} / ${maxCurses}`;

    // 3. Статус Багрового кодекса
    const activeRite = localStorage.getItem(`char_${char.id}_bh_active_rite`);
    const badge = document.getElementById('bhActiveRiteBadge');
    if (badge) {
      if (activeRite) {
        badge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold";
        badge.textContent = `Активен: ${activeRite}`;
      } else {
        badge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 text-stone-500 border border-stone-800";
        badge.textContent = "Ритуал не активен";
      }
    }

    // 4. Доступность продвинутых ритуалов
    const sub = (char.subclass || '').toLowerCase();
    const riteDawnOpt = document.getElementById('bhRiteDawnOpt');
    if (riteDawnOpt) riteDawnOpt.classList.toggle('hidden', !sub.includes('призрачн'));

    ['Dead', 'Oracle', 'Roar'].forEach(r => {
      const el = document.getElementById(`bhRite${r}Opt`);
      if (el) el.classList.toggle('hidden', level < 14);
    });

    // 5. Клеймо наказания (6+ ур)
    const brandSec = document.getElementById('bhBrandSection');
    if (brandSec) {
      brandSec.classList.toggle('hidden', level < 6);
      const brandDmg = level >= 13 ? hemoMod * 2 : hemoMod;
      const dmgEl = document.getElementById('bhBrandDmgDisplay');
      if (dmgEl) dmgEl.textContent = `${brandDmg} (психикой)`;

      const savedTarget = localStorage.getItem(`char_${char.id}_bh_brand_target`);
      const statusBadge = document.getElementById('bhBrandStatusBadge');
      if (statusBadge) {
        if (savedTarget) {
          statusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold";
          statusBadge.textContent = `Цель: ${savedTarget}`;
        } else {
          statusBadge.className = "text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 text-stone-500 border border-stone-800";
          statusBadge.textContent = "Клеймо свободно";
        }
      }
    }

    // 6. Мрачная психометрия (9+ ур)
    const psychoEl = document.getElementById('bhPsychometryCard');
    if (psychoEl) psychoEl.classList.toggle('hidden', level < 9);

    // 7. Панель Ордена Ликантропов (3+ ур)
    const lycanPanel = document.getElementById('bhLycanPanel');
    const isLycan = sub.includes('ликантроп');
    if (lycanPanel) {
      lycanPanel.classList.toggle('hidden', !(isLycan && level >= 3));
      this.updateLycanFormUI();
    }

    // 8. Список известных проклятий крови
    this.renderKnownCurses();
  }

  // --- ЛОГИКА ЛИКАНТРОПА ---

  isLycanActive() {
    const char = this.state.get();
    return localStorage.getItem(`char_${char?.id}_lycan_active`) === 'true';
  }

  toggleLycanForm() {
    const char = this.state.get();
    if (!char) return;

    const isActive = this.isLycanActive();
    const nextState = !isActive;
    localStorage.setItem(`char_${char.id}_lycan_active`, String(nextState));

    this.updateLycanFormUI();

    if (window.sheetApp) {
      window.sheetApp.render();
      window.sheetApp.updateArmorSelection();
    }

    if (nextState) {
      alert("🐺 Вы приняли гибридную форму зверя!\nПолучен бонус +1 к КД, сопротивление к немагическому дробящему/колющему/рубящему урону и безоружные атаки когтями (1к6).");
    } else {
      alert("Вы вернулись в свой естественный гуманоидный облик.");
    }
  }

  updateLycanFormUI() {
    const btn = document.getElementById('btnToggleLycanForm');
    const active = this.isLycanActive();
    if (btn) {
      if (active) {
        btn.textContent = "🐾 Выйти из формы зверя (Активна)";
        btn.className = "px-4 py-1.5 rounded-lg bg-emerald-600 text-stone-950 font-bold text-xs shadow-md active:scale-95 transition-all";
      } else {
        btn.textContent = "🐺 Принять форму зверя";
        btn.className = "px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-foxOrange-600 text-stone-950 font-bold text-xs shadow-md active:scale-95 transition-all";
      }
    }
  }

  // --- БАГРОВЫЙ КОДЕКС ---

  async activateCrimsonRite() {
    const char = this.state.get();
    if (!char) return;

    const level = char.level || 1;
    const dieSides = this.getHemocraftDie(level);
    const rolled = Math.floor(Math.random() * dieSides) + 1;
    const riteName = document.getElementById('bhRiteTypeSelect')?.value || "Пламя";

    const newHp = Math.max(0, char.hp_current - rolled);
    await this.api.patchHp(newHp);
    this.state.updateHp(newHp);

    localStorage.setItem(`char_${char.id}_bh_active_rite`, `${riteName} (+1d${dieSides})`);
    this.renderTab();
    if (window.sheetApp) window.sheetApp.render();

    alert(`🩸 Алый обряд «${riteName}» активирован!\nВы пожертвовали ${rolled} HP (бросок 1d${dieSides}). Теперь оружие наносит +1d${dieSides} стихийного урона при каждом попадании!`);
  }

  deactivateCrimsonRite() {
    const char = this.state.get();
    if (!char) return;
    localStorage.removeItem(`char_${char.id}_bh_active_rite`);
    this.renderTab();
    alert("Алый обряд рассеян.");
  }

  // --- КЛЕЙМО НАКАЗАНИЯ ---

  applyBrand() {
    const char = this.state.get();
    const input = document.getElementById('bhBrandTargetInput');
    const target = input?.value.trim() || 'Враг';
    localStorage.setItem(`char_${char.id}_bh_brand_target`, target);
    this.renderTab();
    alert(`⚡ Клеймо наказания наложено на «${target}»!`);
  }

  clearBrand() {
    const char = this.state.get();
    localStorage.removeItem(`char_${char.id}_bh_brand_target`);
    const input = document.getElementById('bhBrandTargetInput');
    if (input) input.value = '';
    this.renderTab();
    alert("Клеймо наказания снято.");
  }

  // --- ПРОВЕРКИ С ПРЕИМУЩЕСТВОМ ---

  rollHuntersBane(type) {
    const char = this.state.get();
    const stats = char?.stats || {};
    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = Math.floor(Math.random() * 20) + 1;
    const picked = Math.max(d1, d2);

    if (type === 'track') {
      const mod = DndRules.calcMod(stats.wis || 10);
      const total = picked + mod;
      window.diceRoller.showToast(
        "🏹 Охотничья погибель (Выслеживание)",
        `d20 с преимуществом: [${d1}, ${d2}] -> ${picked} ${DndRules.formatMod(mod)} = ${total}`,
        picked === 20 ? 'crit_success' : 'normal'
      );
    } else {
      const mod = DndRules.calcMod(stats.int || 10);
      const total = picked + mod;
      window.diceRoller.showToast(
        "📜 Охотничья погибель (Знания о нежити/исчадиях)",
        `d20 с преимуществом: [${d1}, ${d2}] -> ${picked} ${DndRules.formatMod(mod)} = ${total}`,
        picked === 20 ? 'crit_success' : 'normal'
      );
    }
  }

  rollPsychometry() {
    const char = this.state.get();
    const mod = DndRules.calcMod(char?.stats?.int || 10);
    const d1 = Math.floor(Math.random() * 20) + 1;
    const d2 = Math.floor(Math.random() * 20) + 1;
    const picked = Math.max(d1, d2);
    const total = picked + mod;

    window.diceRoller.showToast(
      "🔮 Мрачная психометрия (История)",
      `d20 с преимуществом: [${d1}, ${d2}] -> ${picked} ${DndRules.formatMod(mod)} = ${total}`,
      picked === 20 ? 'crit_success' : 'normal'
    );
  }

  // --- ПРОКЛЯТИЯ КРОВИ ---

  // Максимальное число известных проклятий по уровню
  getMaxKnownCurses(level = 1) {
    if (level >= 18) return 5;
    if (level >= 14) return 4;
    if (level >= 10) return 3;
    if (level >= 6) return 2;
    return 1;
  }

  // Получить список изученных персонажем проклятий
  getKnownCurses() {
    const char = this.state.get();
    if (!char) return [];

    // Если бэкенд уже хранит blood_curses в модели:
    if (Array.isArray(char.blood_curses) && char.blood_curses.length > 0) {
      return char.blood_curses;
    }

    // Иначе читаем из локального хранилища персонажа
    const raw = localStorage.getItem(`char_${char.id}_known_curses`);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }

    return [];
  }

  saveKnownCurses(cursesList) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_known_curses`, JSON.stringify(cursesList));
    this.renderKnownCurses();
  }

  renderKnownCurses() {
    const container = document.getElementById('bhKnownCursesList');
    if (!container) return;

    const char = this.state.get();
    const level = char?.level || 1;
    const maxKnown = this.getMaxKnownCurses(level);
    const knownNames = this.getKnownCurses();

    // Собираем полные объекты известных проклятий из компендиума
    const knownObjects = knownNames.map(name => {
      const found = this.compendiumCurses.find(c => c.name === name || c.id === name);
      return found || { name: name, activation: "Действие", description: "Описание не найдено." };
    });

    let html = '';

    if (knownObjects.length === 0) {
      html += `
        <div class="col-span-full p-4 rounded-xl border border-dashed border-rose-950/80 bg-black/40 text-center space-y-2">
          <p class="text-xs text-stone-400 italic">Вы еще не выбрали ни одного проклятия крови (доступно слотов: ${maxKnown}).</p>
          <button type="button" onclick="window.bloodHunter.openLearnCurseModal()" class="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-bold transition-all shadow">
            ➕ Изучить первое проклятие крови
          </button>
        </div>
      `;
    } else {
      html += knownObjects.map(c => `
        <div class="p-3 rounded-xl bg-[#160a0a] border border-rose-950 flex flex-col justify-between space-y-2">
          <div>
            <div class="flex justify-between items-start gap-1">
              <strong class="text-rose-200 font-serif text-xs">${c.name}</strong>
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-stone-400 border border-rose-900">${c.activation || 'Бонусное'}</span>
                <button type="button" onclick="window.bloodHunter.forgetCurse('${c.name}')" title="Забыть / заменить проклятие" class="text-stone-500 hover:text-rose-400 text-xs px-1">✕</button>
              </div>
            </div>
            <p class="text-[11px] text-stone-300 font-serif mt-1 leading-relaxed">${c.description || c.desc}</p>
            ${c.amplify ? `<p class="text-[10px] text-amber-300/90 font-mono mt-1">🩸 Усиление: ${c.amplify}</p>` : ''}
          </div>
          <div class="flex items-center gap-1.5 pt-1 border-t border-rose-950/60">
            <button type="button" onclick="window.bloodHunter.useBloodCurse('${c.name}', false)" class="px-2 py-1 rounded bg-stone-900 border border-rose-900 text-rose-300 text-[10px] hover:bg-rose-950 font-bold">Применить</button>
            <button type="button" onclick="window.bloodHunter.useBloodCurse('${c.name}', true)" class="px-2 py-1 rounded bg-rose-900 text-amber-100 text-[10px] font-bold hover:brightness-110 shadow" title="Пожертвуйте 1 кость HP">🩸 Усилить (урон HP)</button>
          </div>
        </div>
      `).join('');

      // Если лимит не исчерпан, показываем кнопку добавления следующего
      if (knownObjects.length < maxKnown) {
        html += `
          <div class="col-span-full pt-1 flex justify-between items-center text-xs">
            <span class="text-stone-400 font-mono text-[11px]">Изучено: ${knownObjects.length} / ${maxKnown}</span>
            <button type="button" onclick="window.bloodHunter.openLearnCurseModal()" class="px-2.5 py-1 rounded bg-rose-950 border border-rose-800 text-rose-300 text-xs font-bold hover:bg-rose-900">
              ➕ Изучить ещё одно (+1)
            </button>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  openLearnCurseModal() {
    const char = this.state.get();
    const level = char?.level || 1;
    const known = this.getKnownCurses();

    // Фильтруем доступные проклятия из compendiumCurses
    const available = this.compendiumCurses.filter(c => {
      if (known.includes(c.name)) return false;
      // Проверка уровня в prerequisite (если есть)
      if (c.prerequisite) {
        const reqLvl = parseInt((c.prerequisite.match(/\d+/) || [])[0]);
        if (reqLvl && level < reqLvl) return false;
      }
      return true;
    });

    if (available.length === 0) {
      alert("Нет доступных для изучения проклятий крови.");
      return;
    }

    const optionsList = available.map((c, i) => `${i + 1}. ${c.name} (${c.activation})\n${c.description}`).join('\n\n');
    const pickIndex = prompt(`Выберите номер проклятия для изучения (от 1 до ${available.length}):\n\n${optionsList}`);

    const idx = parseInt(pickIndex) - 1;
    if (!isNaN(idx) && available[idx]) {
      known.push(available[idx].name);
      this.saveKnownCurses(known);
      alert(`Вы изучили «${available[idx].name}»!`);
    }
  }

  forgetCurse(curseName) {
    if (!confirm(`Удалить «${curseName}» из изученных проклятий?`)) return;
    let known = this.getKnownCurses();
    known = known.filter(n => n !== curseName);
    this.saveKnownCurses(known);
  }

  async useBloodCurse(name, isAmplified) {
    const char = this.state.get();
    if (!char) return;

    const level = char.level || 1;
    const maxCurses = this.getMaxBloodCurses(level);
    let usedCurses = parseInt(localStorage.getItem(`char_${char.id}_bh_curses_used`) || '0');

    if (usedCurses >= maxCurses) {
      if (!confirm("У вас закончились проклятия крови до отдыха! Всё равно использовать?")) return;
    } else {
      usedCurses++;
      localStorage.setItem(`char_${char.id}_bh_curses_used`, String(usedCurses));
    }

    if (isAmplified) {
      const dieSides = this.getHemocraftDie(level);
      const hpDmg = Math.floor(Math.random() * dieSides) + 1;
      const newHp = Math.max(0, char.hp_current - hpDmg);
      await this.api.patchHp(newHp);
      this.state.updateHp(newHp);

      alert(`🩸 УСИЛЕННОЕ ${name}!\nВы пожертвовали ${hpDmg} HP (бросок 1d${dieSides}) ради разрушительного вторичного эффекта!`);
    } else {
      alert(`👁️ ${name} успешно применено к цели.`);
    }

    this.renderTab();
    if (window.sheetApp) window.sheetApp.render();
  }

  restoreBloodCurses() {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_bh_curses_used`, '0');
    this.renderTab();
    alert("Использования проклятий крови восстановлены.");
  }
}
