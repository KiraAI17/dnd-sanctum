import { DndRules } from '../rules/DndRules.js';
import { FeatValidator } from '../rules/FeatValidator.js';

export class LevelUpModal {
  constructor(state, apiClient, onLevelUpSuccess) {
    this.state = state;
    this.api = apiClient;
    this.onSuccess = onLevelUpSuccess;

    this.nextTargetLevel = 2;
    this.hitDieSides = 8;
    this.currentAsiChoiceMode = 'stats';
    this.compendiumFeats = [];
    this.subclassesMap = {};
    this.monkDisciplinesCache = [];

    this.initSubclassesFallback();
    this.exportGlobalHandlers();
  }

  exportGlobalHandlers() {
    window.onMonkDisciplineChange = () => this.onMonkDisciplineChange();
  }

  initSubclassesFallback() {
    this.subclassesFallback = {
      "кровавый охотник": {
        "Орден Призрачного клинка": { source: "Mercer", summary: "Охотники, истребляющие нежить ритуалами чистого эфира.", key_feature: "Ритуал эфира: доп. урон излучением против нежити." },
        "Орден Мутанта": { source: "Mercer", summary: "Алхимики крови, меняющие тело мутагенами.", key_feature: "Мутагены: временные мутации характеристик." },
        "Орден Ликантропа": { source: "Mercer", summary: "Воины с проклятием оборотня.", key_feature: "Звериная форма: КД, сопротивление урону и когти." },
        "Орден Профанической души": { source: "Mercer", summary: "Договор с покровителями ради тёмных чар.", key_feature: "Договорная магия: ячейки магии колдуна." }
      },
      "монах": {
        "Путь открытой ладони": { source: "PHB", summary: "Мастера безоружного боя и контроля энергии врагов.", key_feature: "Техника открытой ладони: нокдаун, отталкивание на 15 фт или лишение реакций." },
        "Путь тени": { source: "PHB", summary: "Ниндзя, использующие тени для маскировки и телепортации.", key_feature: "Искусство тени: заговор Малая иллюзия, чары Тьмы и шаг сквозь тень на 60 фт." },
        "Путь четырех стихий": { source: "PHB", summary: "Обуздание стихий через Ци.", key_feature: "Стихийные техники: водяной кнут, огненные змеи, воздушный кулак и заклинания стихий." },
        "Путь долгой смерти": { source: "SCAG", summary: "Мрачные монахи, питающиеся жизненной силой павших врагов.", key_feature: "Касание смерти: временные хиты при убийстве врага (МУД + Уровень)." },
        "Путь кэнсэя": { source: "XGtE", summary: "Мастера клинка и лука, делающие оружие продолжением духа.", key_feature: "Оружие кэнсэя: монашеское оружие, +2 к КД при Ловком парировании и +1к4 к выстрелам." },
        "Путь пьяного мастера": { source: "XGtE", summary: "Непредсказуемые бойцы с хаотичными движениями пьяницы.", key_feature: "Техника пьяницы: Шквал ударов дарует Отход и +10 фт к скорости." },
        "Путь солнечной души": { source: "XGtE", summary: "Воины света, стреляющие лучами чистой энергии солнца.", key_feature: "Луч сияющего солнца: дальнобойные атаки излучением на 30 фт от Ловкости." },
        "Путь астрального тела": { source: "TCoE", summary: "Мастера, проецирующие спектральную броню и руки души.", key_feature: "Руки астрального тела: призыв за 1 Ци, атаки силовым полем на 10 фт от Мудрости." },
        "Путь милосердия": { source: "TCoE", summary: "Чумные доктора и целители, балансирующие между исцелением и ядом.", key_feature: "Руки милосердия: Исцеляющая рука (хил) и Повреждающая рука (некротический урон)." },
        "Путь восходящего дракона": { source: "FToD", summary: "Бойцы, воплотившие дыхание, крылья и первородную ярость драконов.", key_feature: "Дыхание дракона: конус 20 фт или линия 30 фт стихийного урона вместо атаки." }
      },
      "воин": {
        "Чемпион": { source: "PHB", summary: "Атлет с повышенной вероятностью крита.", key_feature: "Улучшенный крит: крит на 19 и 20." },
        "Мастер боевых искусств": { source: "PHB", summary: "Тактический гений поля боя.", key_feature: "Маневры: кубы превосходства d8." },
        "Рыцарь-мистик": { source: "PHB", summary: "Воин с боевой магией.", key_feature: "Связь с оружием и магия ограждения/воплощения." }
      }
    };
  }

  open() {
    const char = this.state.get();
    if (!char) return;

    const curLevel = char.level || 1;
    this.nextTargetLevel = curLevel + 1;

    const curText = document.getElementById('lvlCurrentText');
    const nextText = document.getElementById('lvlNextText');
    if (curText) curText.textContent = curLevel;
    if (nextText) nextText.textContent = this.nextTargetLevel;

    this.hitDieSides = DndRules.getHitDieSides(char.class_name);
    const conMod = DndRules.calcMod(char.stats?.con || 10);
    const avgHp = Math.max(1, Math.floor(this.hitDieSides / 2) + 1 + conMod);

    const formulaEl = document.getElementById('lvlHpFormula');
    const hpInput = document.getElementById('lvlHpIncreaseInput');
    if (formulaEl) formulaEl.textContent = `d${this.hitDieSides} + ${DndRules.formatMod(conMod)}`;
    if (hpInput) hpInput.value = avgHp;

    const cName = (char.class_name || '').toLowerCase();

    // 1. Боевой стиль на 2 ур.
    const isMartial = cName.includes('охотник') || cName.includes('воин') || cName.includes('паладин') || cName.includes('следопыт');
    const styleBlock = document.getElementById('lvlFightingStyleBlock');
    if (styleBlock) styleBlock.classList.toggle('hidden', !(this.nextTargetLevel === 2 && isMartial));

    // 2. Архетип на 3 ур.
    const subBlock = document.getElementById('lvlSubclassBlock');
    if (subBlock) {
      const showSub = (this.nextTargetLevel === 3);
      subBlock.classList.toggle('hidden', !showSub);
      if (showSub) this.loadSubclasses(char.class_name);
    }

    // 3. Практики монаха (Стихии / Кэнсэй на 3, 6, 11, 17 ур.)
    this.checkAndLoadMonkDisciplines(char);

    // 4. ASI или Черта на 4, 8, 12, 16, 19 ур.
    const asiBlock = document.getElementById('lvlAsiBlock');
    const isAsi = [4, 8, 12, 16, 19].includes(this.nextTargetLevel);
    if (asiBlock) {
      asiBlock.classList.toggle('hidden', !isAsi);
      if (isAsi) this.switchAsiMode('stats');
    }

    // Компетентность: Плут на 6 ур., Бард на 3 и 10 ур.
    const isRogueLvl6 = (cName.includes('плут') || cName.includes('rogue')) && (this.nextTargetLevel === 6);
    const isBardExp = (cName.includes('бард') || cName.includes('bard')) && (this.nextTargetLevel === 3 || this.nextTargetLevel === 10);
    const showExp = isRogueLvl6 || isBardExp;

    const expBlock = document.getElementById('lvlExpertiseBlock');
    if (expBlock) {
      expBlock.classList.toggle('hidden', !showExp);
      if (showExp) this.loadLvl6ExpertiseOptions(char);
    }

    document.getElementById('levelUpModal')?.classList.remove('hidden');
  }

  loadLvl6ExpertiseOptions(char) {
    const s1 = document.getElementById('lvlExpertiseChoice1');
    const s2 = document.getElementById('lvlExpertiseChoice2');
    if (!s1 || !s2) return;

    const currentExp = JSON.parse(localStorage.getItem(`char_${char.id}_expertise`) || '[]');
    const allOptions = Array.from(new Set([
      ...(char.skills || []),
      "Акробатика", "Атлетика", "Внимательность", "Ловкость рук", "Обман",
      "Проницательность", "Расследование", "Скрытность", "Убеждение", "Воровские инструменты"
    ])).filter(opt => !currentExp.includes(opt));

    s1.innerHTML = allOptions.map(o => `<option value="${o}">${o}</option>`).join('');
    s2.innerHTML = allOptions.slice(1).map(o => `<option value="${o}">${o}</option>`).join('');
  }

  close() {
    document.getElementById('levelUpModal')?.classList.add('hidden');
  }

  rollHp() {
    const rolled = Math.floor(Math.random() * this.hitDieSides) + 1;
    const conMod = DndRules.calcMod(this.state.get()?.stats?.con || 10);
    const total = Math.max(1, rolled + conMod);
    const hpInput = document.getElementById('lvlHpIncreaseInput');
    if (hpInput) hpInput.value = total;
    alert("Бросок d" + this.hitDieSides + ": (" + rolled + ") " + DndRules.formatMod(conMod) + " = +" + total + " к максимуму HP!");
  }

  async loadSubclasses(className) {
    const sel = document.getElementById('lvlSubclassSelect');
    if (!sel) return;

    this.subclassesMap = {};
    const norm = (className || '').toLowerCase().trim();

    try {
      const res = await fetch('/compendium/subclasses');
      if (res.ok) {
        let raw = await res.json();

        if (raw && raw.subclasses && typeof raw.subclasses === 'object') {
          raw = raw.subclasses;
        } else if (raw && raw.data && typeof raw.data === 'object') {
          raw = raw.data;
        }

        for (const [sName, sData] of Object.entries(raw)) {
          if (!sData || typeof sData !== 'object') continue;

          const targetClass = (sData.class || sData.class_name || '').toLowerCase().trim();

          const isCharAlt = norm.includes('альт');
          const isTargetAlt = targetClass.includes('альт');
          if (isCharAlt !== isTargetAlt) continue;

          const isMonkMatch = (norm.includes('монах') || norm.includes('monk')) &&
                              (targetClass.includes('монах') || targetClass.includes('monk'));

          const matches = isMonkMatch ||
                          targetClass === norm ||
                          (norm && targetClass.includes(norm)) ||
                          (targetClass && norm.includes(targetClass));

          if (matches) {
            this.subclassesMap[sName] = sData;
          }
        }
      }
    } catch (err) {
      console.warn("Сбой загрузки подклассов:", err);
    }

    if (Object.keys(this.subclassesMap).length === 0) {
      for (const [fbClass, subs] of Object.entries(this.subclassesFallback)) {
        if (norm.includes(fbClass) || fbClass.includes(norm)) {
          this.subclassesMap = { ...subs };
        }
      }
    }

    if (Object.keys(this.subclassesMap).length === 0) {
      sel.innerHTML = '<option value="">-- Архетипы не найдены в базе --</option>' +
                      '<option value="custom">✍️ Свой авторский архетип...</option>';
    } else {
      sel.innerHTML = '<option value="">-- Выберите монастырскую традицию --</option>' +
        Object.keys(this.subclassesMap).map(n => '<option value="' + n + '">🥋 ' + n + '</option>').join('') +
        '<option value="custom">✍️ Свой авторский архетип...</option>';
    }

    this.onSubclassChange();
  }

  onSubclassChange() {
    const sel = document.getElementById('lvlSubclassSelect');
    const preview = document.getElementById('lvlSubclassPreviewBox');
    const customBlock = document.getElementById('lvlCustomSubclassInputBlock');
    if (!sel || !preview) return;

    const val = sel.value;
    if (val === 'custom') {
      if (customBlock) customBlock.classList.remove('hidden');
      preview.classList.add('hidden');
      return;
    } else {
      if (customBlock) customBlock.classList.add('hidden');
    }

    if (!val || !this.subclassesMap[val]) {
      preview.classList.add('hidden');
      return;
    }

    // Если Бард выбирает Коллегию Мечей
    const styleBlock = document.getElementById('lvlFightingStyleBlock');
    const styleSelect = document.getElementById('lvlFightingStyleSelect');
    if (val.includes('Мечей') || val.includes('Swords')) {
      if (styleBlock && styleSelect) {
        styleBlock.classList.remove('hidden');
        styleSelect.innerHTML = `
          <option value="Дуэлянт">Дуэлянт (+2 к урону одноручным оружием)</option>
          <option value="Сражение двумя оружиями">Сражение двумя оружиями (модификатор ко 2-й руке)</option>
        `;
      }
    }

    const data = this.subclassesMap[val];
    preview.classList.remove('hidden');
    document.getElementById('lvlSubclassPreviewTitle').textContent = val;
    document.getElementById('lvlSubclassPreviewSource').textContent = data.source || '5e';
    document.getElementById('lvlSubclassPreviewSummary').textContent = data.summary || '';
    document.getElementById('lvlSubclassPreviewKeyFeature').textContent = data.key_feature || '';

    // Перепроверяем отображение блока практик при выборе архетипа
    const char = this.state.get();
    if (char) {
      this.checkAndLoadMonkDisciplines(char, val);
    }
  }

  // --- ЛОГИКА ПРАКТИК МОНАХА (Стихии / Кэнсэй) ---

  async checkAndLoadMonkDisciplines(char, selectedSubclassName = null) {
    const discBlock = document.getElementById('lvlMonkDisciplineBlock');
    if (!discBlock) return;

    const cName = (char.class_name || '').toLowerCase();
    const isMonk = cName.includes('монах') || cName.includes('monk');
    const effectiveSub = (selectedSubclassName || char.subclass || '').toLowerCase();

    // Практики выбираются на 3, 6, 11 и 17 уровнях
    const isDisciplineLevel = [3, 6, 11, 17].includes(this.nextTargetLevel);
    const hasDisciplines = effectiveSub.includes('стихи') || effectiveSub.includes('кэнсэй') || effectiveSub.includes('elements') || effectiveSub.includes('kensei');

    if (!isMonk || !isDisciplineLevel || !hasDisciplines) {
      discBlock.classList.add('hidden');
      return;
    }

    discBlock.classList.remove('hidden');
    const titleEl = document.getElementById('lvlMonkDisciplineTitle');
    const badgeEl = document.getElementById('lvlMonkDisciplineBadge');
    const helpEl = document.getElementById('lvlMonkDisciplineHelp');

    if (badgeEl) badgeEl.textContent = `${this.nextTargetLevel} уровень`;

    if (effectiveSub.includes('стихи') || effectiveSub.includes('elements')) {
      if (titleEl) titleEl.textContent = "Стихийная практика (Путь четырёх стихий):";
      if (helpEl) helpEl.textContent = "Выберите новую стихийную технику для управления потоками Ци:";
      await this.loadDisciplinesList("Путь четырех стихий", char);
    } else if (effectiveSub.includes('кэнсэй') || effectiveSub.includes('kensei')) {
      if (titleEl) titleEl.textContent = "Боевая практика / Оружие (Путь кэнсэя):";
      if (helpEl) helpEl.textContent = "Выберите технику или специализированное оружие кэнсэя:";
      await this.loadDisciplinesList("Путь кэнсэя", char);
    }
  }

  async loadDisciplinesList(subclassFilter, char) {
    const sel = document.getElementById('lvlMonkDisciplineSelect');
    if (!sel) return;

    if (this.monkDisciplinesCache.length === 0) {
      try {
        const res = await fetch('/compendium/monk-disciplines');
        if (res.ok) {
          const data = await res.json();
          this.monkDisciplinesCache = data.disciplines || [];
        }
      } catch (err) {
        console.warn("Сбой загрузки /compendium/monk-disciplines:", err);
      }
    }

    // Список уже известных черт и фич персонажа
    const knownNames = new Set((char.feats || []).map(f => (typeof f === 'string' ? f : f.name).toLowerCase()));
    (char.features || []).forEach(f => {
      const name = typeof f === 'string' ? f.split(':')[0] : f.name;
      if (name) knownNames.add(name.toLowerCase().trim());
    });

    const targetSub = subclassFilter.toLowerCase();
    const available = this.monkDisciplinesCache.filter(d => {
      const matchesSub = (d.subclass || '').toLowerCase().includes(targetSub) || targetSub.includes((d.subclass || '').toLowerCase());
      const levelOk = (d.required_level || 3) <= this.nextTargetLevel;
      const notKnown = !knownNames.has(d.name.toLowerCase().trim());
      return matchesSub && levelOk && notKnown;
    });

    if (available.length === 0) {
      sel.innerHTML = '<option value="">-- Все доступные практики уже изучены --</option>';
    } else {
      sel.innerHTML = '<option value="">-- Выберите технику для изучения --</option>' +
        available.map(d => {
          const ki = d.ki_cost > 0 ? ` (${d.ki_cost} Ци)` : ' (Пассивно)';
          return `<option value="${d.id}">⚡ ${d.name}${ki}</option>`;
        }).join('');
    }

    this.onMonkDisciplineChange();
  }

  onMonkDisciplineChange() {
    const sel = document.getElementById('lvlMonkDisciplineSelect');
    const preview = document.getElementById('lvlMonkDisciplinePreview');
    if (!sel || !preview) return;

    const val = sel.value;
    if (!val) {
      preview.classList.add('hidden');
      return;
    }

    const disc = this.monkDisciplinesCache.find(d => d.id === val);
    if (!disc) {
      preview.classList.add('hidden');
      return;
    }

    preview.classList.remove('hidden');
    const kiBadge = disc.ki_cost > 0 ? `<span class="text-amber-400 font-mono font-bold">${disc.ki_cost} Ци</span>` : '<span class="text-emerald-400 font-mono font-bold">Без траты Ци</span>';
    const actionBadge = disc.action_type ? `<span class="text-stone-400 font-mono">${disc.action_type}</span>` : '';
    const dmg = disc.damage_dice ? `<span class="text-rose-400 font-mono font-bold"> • ${disc.damage_dice} ${disc.damage_type || ''}</span>` : '';

    preview.innerHTML = `
      <div class="flex justify-between items-center border-b border-orange-950/60 pb-1 mb-1">
        <strong class="text-amber-200 text-xs">${disc.name}</strong>
        <div class="flex items-center gap-1.5 text-[10px]">
          ${kiBadge} ${actionBadge} ${dmg}
        </div>
      </div>
      <p class="text-stone-300 text-[11px] leading-relaxed">${disc.description}</p>
    `;
  }

  switchAsiMode(mode) {
    this.currentAsiChoiceMode = mode;
    const btnStats = document.getElementById('btnModeStats');
    const btnFeat = document.getElementById('btnModeFeat');
    const bStats = document.getElementById('asiStatsSubBlock');
    const bFeat = document.getElementById('asiFeatSubBlock');

    if (mode === 'stats') {
      if (btnStats) btnStats.className = "py-1.5 rounded font-bold text-stone-950 bg-amber-400 transition-all";
      if (btnFeat) btnFeat.className = "py-1.5 rounded font-bold text-stone-400 hover:text-amber-200 transition-all";
      if (bStats) bStats.classList.remove('hidden');
      if (bFeat) bFeat.classList.add('hidden');
    } else {
      if (btnFeat) btnFeat.className = "py-1.5 rounded font-bold text-stone-950 bg-amber-400 transition-all";
      if (btnStats) btnStats.className = "py-1.5 rounded font-bold text-stone-400 hover:text-amber-200 transition-all";
      if (bFeat) bFeat.classList.remove('hidden');
      if (bStats) bStats.classList.add('hidden');
      this.loadFeats();
    }
  }

  async loadFeats() {
    const sel = document.getElementById('lvlFeatSelect');
    if (!sel) return;

    if (this.compendiumFeats.length === 0) {
      try {
        const res = await apiFetch('/compendium/feats');
        if (res.ok) this.compendiumFeats = await res.json();
      } catch {}
    }

    const char = this.state.get();
    sel.innerHTML = '<option value="">-- Выберите черту --</option>' + this.compendiumFeats.map(f => {
      const check = FeatValidator.checkPrerequisite(f, char);
      const isLocked = !check.ok;
      const icon = isLocked ? '🔒 ' : '✨ ';
      const disabled = isLocked ? 'disabled class="text-stone-600 bg-stone-950"' : 'class="text-amber-200 bg-stone-900"';
      const hint = isLocked ? ` [${check.reason}]` : '';
      return `<option value="${f.id || f.name}" ${disabled}>${icon}${f.name}${hint}</option>`;
    }).join('');
  }

  onFeatChange() {
    const sel = document.getElementById('lvlFeatSelect');
    const preview = document.getElementById('lvlFeatPreviewBox');
    const choiceBlock = document.getElementById('lvlFeatDynamicChoiceBlock');
    const choiceSelect = document.getElementById('lvlFeatDynamicChoiceSelect');
    if (!sel || !preview) return;

    const featId = sel.value;
    if (!featId) {
      preview.classList.add('hidden');
      if (choiceBlock) choiceBlock.classList.add('hidden');
      return;
    }

    const f = this.compendiumFeats.find(x => (x.id === featId || x.name === featId));
    if (!f) return;

    preview.classList.remove('hidden');
    document.getElementById('lvlFeatPreviewName').textContent = f.name;
    document.getElementById('lvlFeatPreviewPrereq').textContent = f.prerequisite ? `Треб.: ${f.prerequisite}` : 'Без требований';
    document.getElementById('lvlFeatPreviewDesc').textContent = f.description || '';

    const badge = document.getElementById('lvlFeatStatBonusBadge');
    const choiceInfo = FeatValidator.extractStatChoiceOptions(f);
    const statDict = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };

    if (choiceInfo.hasChoice && choiceBlock && choiceSelect) {
      choiceBlock.classList.remove('hidden');
      choiceSelect.innerHTML = choiceInfo.options.map(st => `<option value="${st}">+1 к ${statDict[st] || st.toUpperCase()}</option>`).join('');
      if (badge) badge.classList.add('hidden');
    } else {
      if (choiceBlock) choiceBlock.classList.add('hidden');
      if (f.stat_bonuses && typeof f.stat_bonuses === 'object' && !f.stat_bonuses.choice) {
        const clean = Object.entries(f.stat_bonuses).filter(([k, v]) => typeof v === 'number');
        if (clean.length > 0) {
          const bStr = clean.map(([k, v]) => `+${v} к ${(statDict[k] || k).toUpperCase()}`).join(', ');
          if (badge) {
            badge.textContent = `⚡ Бонус к статам: ${bStr}`;
            badge.classList.remove('hidden');
          }
        }
      } else if (badge) {
        badge.classList.add('hidden');
      }
    }
  }

  async submit(e) {
    e.preventDefault();
    const char = this.state.get();
    if (!char) return;

    const hpIncrease = parseInt(document.getElementById('lvlHpIncreaseInput')?.value) || 6;
    const submitBtn = document.getElementById('btnSubmitLevelUp');
    if (submitBtn) submitBtn.textContent = 'Сохраняем...';

    const payload = { hp_increase: hpIncrease };

    // 1. Боевой стиль
    const styleBlock = document.getElementById('lvlFightingStyleBlock');
    if (styleBlock && !styleBlock.classList.contains('hidden')) {
      const selectedStyle = document.getElementById('lvlFightingStyleSelect')?.value;
      payload.new_feat = {
        name: `Боевой стиль: ${selectedStyle}`,
        description: `Специализация в боевом стиле «${selectedStyle}».`
      };
    }

    // 2. Архетип
    const subBlock = document.getElementById('lvlSubclassBlock');
    if (subBlock && !subBlock.classList.contains('hidden')) {
      const selVal = document.getElementById('lvlSubclassSelect')?.value;
      const finalSub = selVal === 'custom' ? document.getElementById('lvlCustomSubclassInput')?.value.trim() : selVal;
      if (finalSub) payload.chosen_subclass = finalSub;
    }

    // 3. Выбранная практика монаха (Стихии / Кэнсэй)
    const discBlock = document.getElementById('lvlMonkDisciplineBlock');
    if (discBlock && !discBlock.classList.contains('hidden')) {
      const discId = document.getElementById('lvlMonkDisciplineSelect')?.value;
      if (discId) {
        const discObj = this.monkDisciplinesCache.find(d => d.id === discId);
        if (discObj) {
          // Если боевой стиль не выбирался — пишем в new_feat, иначе сохраняем в список практик
          payload.new_feat = {
            name: `Практика: ${discObj.name}`,
            description: `${discObj.description} (Стоимость: ${discObj.ki_cost} Ци)`
          };

          // Сохраняем в локальное хранилище персонажа для вкладки Ци
          const storageKey = `char_${char.id}_monk_disciplines`;
          const learned = JSON.parse(localStorage.getItem(storageKey) || '[]');
          learned.push(discObj);
          localStorage.setItem(storageKey, JSON.stringify(learned));
        }
      }
    }

    // 4. ASI или Черта
    const asiBlock = document.getElementById('lvlAsiBlock');
    if (asiBlock && !asiBlock.classList.contains('hidden')) {
      if (this.currentAsiChoiceMode === 'stats') {
        const s1 = document.getElementById('lvlAsiStat1')?.value;
        const s2 = document.getElementById('lvlAsiStat2')?.value;
        const statMap = {};
        if (s1) statMap[s1] = (statMap[s1] || 0) + 1;
        if (s2) statMap[s2] = (statMap[s2] || 0) + 1;
        if (Object.keys(statMap).length > 0) payload.stat_increases = statMap;
      } else {
        const featId = document.getElementById('lvlFeatSelect')?.value;
        const chosenFeat = this.compendiumFeats.find(x => (x.id === featId || x.name === featId));
        if (chosenFeat) {
          let featName = chosenFeat.name;
          const choiceSelect = document.getElementById('lvlFeatDynamicChoiceSelect');
          const choiceBlock = document.getElementById('lvlFeatDynamicChoiceBlock');

          if (choiceBlock && !choiceBlock.classList.contains('hidden') && choiceSelect) {
            const picked = choiceSelect.value;
            const statDict = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
            featName = `${chosenFeat.name} (${statDict[picked] || picked.toUpperCase()})`;
            payload.stat_increases = { [picked]: 1 };
          } else if (chosenFeat.stat_bonuses && typeof chosenFeat.stat_bonuses === 'object') {
            const numB = {};
            for (const [k, v] of Object.entries(chosenFeat.stat_bonuses)) {
              if (typeof v === 'number') numB[k] = v;
            }
            if (Object.keys(numB).length > 0) payload.stat_increases = numB;
          }

          payload.new_feat = { name: featName, description: chosenFeat.description || '' };
        }
      }
    }

    // Сохранение компетентности 6-го уровня (Плут)
    const expBlock = document.getElementById('lvlExpertiseBlock');
    if (expBlock && !expBlock.classList.contains('hidden')) {
      const c1 = document.getElementById('lvlExpertiseChoice1')?.value;
      const c2 = document.getElementById('lvlExpertiseChoice2')?.value;
      if (c1 && c2 && c1 !== c2) {
        const storageKey = "char_" + char.id + "_expertise";
        let currentExp = JSON.parse(localStorage.getItem(storageKey) || '[]');
        currentExp.push(c1, c2);
        localStorage.setItem(storageKey, JSON.stringify(Array.from(new Set(currentExp))));
      }
    }

    try {
      const res = await this.api.levelUp(payload);
      if (res.ok) {
        const updated = await res.json();
        this.close();
        if (this.onSuccess) this.onSuccess(updated);
        alert(`🎉 Персонаж достиг ${updated.level} уровня!`);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Не удалось повысить уровень.");
      }
    } catch (err) {
      alert("Сбой сети: " + err.message);
    } finally {
      if (submitBtn) submitBtn.textContent = 'Подтвердить уровень';
    }
  }
}
