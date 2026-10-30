/**
 * CharacterWizard - ООП-контроллер пошагового создания персонажа D&D 5e
 */
export class CharacterWizard {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;

    // Справочники
    this.allRaces = [];
    this.classes = [];
    this.allBackgrounds = [];

    // Выбранные сущности
    this.selectedRace = null;
    this.selectedClass = null;
    this.selectedBackground = null;
    this.equipmentMode = 'class_kit';

    // Режим характеристик (pointbuy, standard, roll)
    this.statMode = 'pointbuy';
    this.pointBuyRemaining = 27;
    this.pointBuyStats = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    this.rolledPool = [];
    this.assignedStats = { str: null, dex: null, con: null, int: null, wis: null, cha: null };

    // Заклинания
    this.maxCantripsAllowed = 2;
    this.maxSpellsAllowed = 2;
    this.selectedCantrips = new Set();
    this.selectedSpells = new Set();

    // Состояние персонажа
    this.state = {
      name: '',
      race: '',
      class_name: '',
      subclass: null,
      background: '',
      alignment: 'Истинно нейтральный',
      fighting_style: null,
      blood_curse: null,
      spells: [],
      backstory: '',
      notes: '',
      equipment_mode: 'class_kit'
    };

    this.urlParams = new URLSearchParams(window.location.search);
    this.activePartyId = this.urlParams.get('party_id');
    this.isDmMode = false;

    this.pointBuyCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

    this.spellCompendium = {
      cantrips: [
        { name: "Огненный снаряд", school: "Воплощение", cast: "1 действ.", desc: "Дальнобойная атака на 120 фт. Урон 1d10 огнем." },
        { name: "Луч холода", school: "Проявление", cast: "1 действ.", desc: "Ледяной луч наносит 1d8 холода и снижает скорость цели на 10 фт." },
        { name: "Волшебная рука", school: "Преобразование", cast: "1 действ.", desc: "Призрачная рука манипулирует предметами на расстоянии до 30 фт." },
        { name: "Злая насмешка", school: "Очарование", cast: "1 действ.", desc: "Оскорбление наносит 1d4 психического урона и дает помеху на атаку." },
        { name: "Священное пламя", school: "Воплощение", cast: "1 действ.", desc: "Сияние наносит 1d8 урона излучением без укрытия." },
        { name: "Свет", school: "Воплощение", cast: "1 действ.", desc: "Предмет светится ярким светом на 20 футов." },
        { name: "Фокусы", school: "Преобразование", cast: "1 действ.", desc: "Простые магические эффекты, звуки или очистка одежды." },
        { name: "Терновый кнут", school: "Преобразование", cast: "1 действ.", desc: "1d6 колющего урона и притягивает цель на 10 фт." },
        { name: "Указание", school: "Прорицание", cast: "1 действ.", desc: "+1d4 к одной проверке характеристики цели." }
      ],
      level1: [
        { name: "Волшебная стрела", school: "Воплощение", cast: "1 действ.", desc: "3 самонаводящиеся стрелы по 1d4+1 силового поля каждая." },
        { name: "Щит", school: "Ограждение", cast: "1 реакция", desc: "+5 к КД до начала следующего хода и иммунитет к Волшебной стреле." },
        { name: "Доспехи мага", school: "Ограждение", cast: "1 действ.", desc: "Базовый КД существа без доспехов становится 13 + ЛОВ." },
        { name: "Лечащее слово", school: "Воплощение", cast: "1 бон. действ.", desc: "Дистанционное исцеление на 1d4 + модификатор заклинателя." },
        { name: "Лечение ран", school: "Воплощение", cast: "1 действ.", desc: "Прикосновение восстанавливает 1d8 + модификатор хитов." },
        { name: "Опознание", school: "Прорицание", cast: "1 мин (ритуал)", desc: "Раскрывает все свойства и тайны магического предмета." },
        { name: "Обнаружение магии", school: "Прорицание", cast: "1 действ (ритуал)", desc: "Чувствует присутствие и школу магии в радиусе 30 футов." },
        { name: "Усыпление", school: "Очарование", cast: "1 действ.", desc: "Погружает в сон существ суммарно до 5d8 хитов." },
        { name: "Огненные ладони", school: "Воплощение", cast: "1 действ.", desc: "Конус пламени на 15 фт наносит 3d6 урона огнем." },
        { name: "Дрожь земли", school: "Воплощение", cast: "1 действ.", desc: "1d6 дробящего урона всем вокруг и сбивает с ног." }
      ]
    };
  }

  async init() {
    this.exportGlobals();
    await Promise.all([
      this.loadRaces(),
      this.loadClasses(),
      this.loadBackgrounds()
    ]);
    this.setStatMode('pointbuy');
  }

  exportGlobals() {
    // Делаем экземпляр доступным для обработчиков onclick в HTML
    window.wizard = this;
    window.goToStep = (s) => this.goToStep(s);
    window.nextStep = () => this.nextStep();
    window.prevStep = () => this.prevStep();
    window.selectAlignment = (a) => this.selectAlignment(a);
    window.selectEquipmentMode = (m) => this.selectEquipmentMode(m);
    window.setStatMode = (m) => this.setStatMode(m);
    window.changePointBuy = (stat, delta) => this.changePointBuy(stat, delta);
    window.rollDicePool = () => this.rollDicePool();
    window.clearSlot = (s) => this.clearSlot(s);
    window.allowDrop = (e) => e.preventDefault();
    window.handleDrop = (e, stat) => this.handleDrop(e, stat);
    window.submitCharacter = () => this.submitCharacter();
    window.openCreateRaceModal = () => this.openCreateRaceModal();
    window.closeCreateRaceModal = () => this.closeCreateRaceModal();
    window.addCustomTraitField = () => this.addCustomTraitField();
    window.saveCustomRace = () => this.saveCustomRace();
    window.deleteCustomRace = (id) => this.deleteCustomRace(id);
    window.switchSpellTab = (t) => this.switchSpellTab(t);
    window.onLvl1SubclassSelected = (val) => this.onLvl1SubclassSelected(val);
    window.updateSummary = () => this.updateSummary();
  }

  // --- ЗАГРУЗКА ДАННЫХ ---

  async loadRaces() {
    try {
      try {
        const meRes = await apiFetch('/auth/me');
        if (meRes.ok) {
          const u = await meRes.json();
          this.isDmMode = (u.role === 'DM' || u.is_dm);
        }
      } catch (e) {}

      let url = `/compendium/races?is_dm=${this.isDmMode}`;
      if (this.activePartyId) {
        url = `/parties/${this.activePartyId}/compendium/races`;
        const pBadge = document.getElementById('partyContextBadge');
        if (pBadge) {
          pBadge.textContent = `Кампания #${this.activePartyId}`;
          pBadge.classList.remove('hidden');
        }
      }

      const res = await apiFetch(url);
      if (res.ok) {
        const raw = await res.json();
        const rawList = Array.isArray(raw) ? raw : (raw.races || []);
        const uniqueMap = new Map();
        rawList.forEach(r => {
          if (!r || !r.name) return;
          const k = r.name.trim().toLowerCase();
          if (!uniqueMap.has(k) || r.is_custom) uniqueMap.set(k, r);
        });
        this.allRaces = Array.from(uniqueMap.values());
        this.renderRaces();
      }
    } catch (e) {
      console.error("Ошибка загрузки рас:", e);
    }
  }

  async loadClasses() {
    try {
      const res = await apiFetch('/compendium/classes');
      if (res.ok) {
        this.classes = await res.json();
        this.renderClasses();
      }
    } catch (e) {
      console.error("Ошибка загрузки классов:", e);
    }
  }

  async loadBackgrounds() {
    try {
      const res = await apiFetch('/compendium/backgrounds');
      if (res.ok) {
        this.allBackgrounds = await res.json();
        this.renderBackgrounds();
      }
    } catch (e) {
      console.error("Ошибка загрузки предысторий:", e);
    }
  }

  // --- ШАГ 1: РАСЫ ---

  renderRaces() {
    const grid = document.getElementById('racesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    this.allRaces.forEach(r => {
      const card = document.createElement('div');
      const isSel = this.selectedRace && (
        (this.selectedRace.id && r.id && this.selectedRace.id === r.id) ||
        this.selectedRace.name.trim().toLowerCase() === r.name.trim().toLowerCase()
      );

      card.className = `p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${isSel ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
      card.onclick = (e) => {
        if (e.target.closest('.btn-delete-race')) return;
        this.selectRace(r);
      };

      const bonusStr = r.ability_bonuses ? Object.entries(r.ability_bonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') : '';
      const dmBadge = r.dm_only ? '<span class="text-[9px] bg-amber-500/30 text-amber-300 border border-amber-500/50 px-1 rounded font-mono">👑 DM ONLY</span>' : '';
      const deleteBtn = (this.isDmMode && r.is_custom) ? `<button type="button" onclick="window.wizard.deleteCustomRace('${r.id}')" title="Удалить расу" class="btn-delete-race text-stone-500 hover:text-rose-400 text-xs px-1 font-bold">&times;</button>` : '';

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-center mb-1">
            <h4 class="font-serif font-bold text-amber-200 text-sm flex items-center gap-1.5">
              ${r.name} ${dmBadge}
            </h4>
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-mono text-stone-400">${r.speed || 30} фт.</span>
              ${deleteBtn}
            </div>
          </div>
          <p class="text-[11px] text-stone-400 font-serif line-clamp-2">${r.description || ''}</p>
        </div>
        ${bonusStr ? `<div class="mt-2 text-[10px] font-mono text-amber-400/90 font-bold">${bonusStr}</div>` : ''}
      `;
      grid.appendChild(card);
    });

    this.updateSelectedRaceDetails();
  }

  selectRace(r) {
    this.selectedRace = r;
    this.state.race = r.name;
    this.renderRaces();
    this.calcStartingHp();
    this.updateSummary();
  }

  updateSelectedRaceDetails() {
    const traitsEl = document.getElementById('selectedRaceTraits');
    if (!traitsEl) return;
    if (!this.selectedRace) {
      traitsEl.innerHTML = '<span class="text-xs text-stone-500 italic font-serif">Выберите расу из списка выше, чтобы увидеть подробные свойства, скорость и прибавки к характеристикам.</span>';
      return;
    }

    const traitsHtml = (this.selectedRace.traits || []).map(t => `
      <span class="inline-block bg-[#160f0b] border border-orange-950 text-stone-300 text-xs px-2 py-1 rounded font-serif">
        <strong class="text-amber-400">${t.name}:</strong> ${t.description}
      </span>
    `).join(' ');

    const bonuses = this.selectedRace.ability_bonuses ? Object.entries(this.selectedRace.ability_bonuses).map(([k,v]) => `+${v} ${k.toUpperCase()}`).join(', ') : 'нет';

    traitsEl.innerHTML = `
      <div class="space-y-1.5 w-full">
        <div class="flex items-center justify-between border-b border-orange-950/60 pb-1">
          <span class="font-serif font-bold text-amber-200 text-xs">Выбрано: ${this.selectedRace.name} (Скорость: ${this.selectedRace.speed} фт., Прибавки: ${bonuses})</span>
        </div>
        <div class="flex flex-wrap gap-1.5 pt-0.5">
          ${traitsHtml || '<span class="text-stone-400 text-xs">Стандартные особенности D&D 5e.</span>'}
        </div>
      </div>
    `;
  }

  // --- ШАГ 2: КЛАССЫ И ОСОБЕННОСТИ 1 УРОВНЯ ---

  renderClasses() {
    const grid = document.getElementById('classesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    this.classes.forEach(c => {
      const card = document.createElement('div');
      const isSel = this.selectedClass && (this.selectedClass.name === c.name || this.selectedClass.id === c.id);

      card.className = `p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${isSel ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)]' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
      card.onclick = () => this.selectClass(c);

      const hitVal = c.hit_die || c.hitDie || 8;

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-center mb-1">
            <h4 class="font-serif font-bold text-amber-200 text-sm">${c.name}</h4>
            <span class="text-[10px] font-mono font-bold text-foxOrange-400 bg-black/40 px-1.5 py-0.5 rounded border border-orange-950">d${hitVal}</span>
          </div>
          <p class="text-[11px] text-stone-400 font-serif line-clamp-2">${c.description || c.desc || ''}</p>
        </div>
        <div class="mt-2 text-[10px] font-mono text-amber-400/80">Кость хитов: d${hitVal}</div>
      `;
      grid.appendChild(card);
    });

    this.updateSelectedClassDetails();
    this.renderClassLvl1Config();
  }

  selectClass(c) {
    this.selectedClass = c;
    this.state.class_name = c.name;
    this.state.spells = [];
    this.renderClasses();
    this.calcStartingHp();
    this.updateSummary();
  }

  updateSelectedClassDetails() {
    const traitsEl = document.getElementById('selectedClassTraits');
    if (!traitsEl) return;
    if (!this.selectedClass) {
      traitsEl.innerHTML = '<span class="text-xs text-stone-500 italic font-serif">Выберите класс из списка выше, чтобы увидеть подробные особенности 1-го уровня, владения и механику.</span>';
      return;
    }

    const hitVal = this.selectedClass.hit_die || this.selectedClass.hitDie || 8;
    const featuresHtml = (this.selectedClass.level1_features || []).map(f => {
      const parts = f.split(':');
      if (parts.length > 1) {
        return `
          <div class="p-2.5 bg-[#140e0a] border border-orange-950 rounded-xl space-y-1">
            <strong class="text-amber-400 text-xs font-serif block">${parts[0].replace(/^[•\s]+/, '')}</strong>
            <p class="text-stone-300 text-[11px] font-serif leading-relaxed whitespace-pre-line">${parts.slice(1).join(':').trim()}</p>
          </div>
        `;
      }
      return `
        <div class="p-2.5 bg-[#140e0a] border border-orange-950 rounded-xl">
          <p class="text-stone-300 text-[11px] font-serif leading-relaxed whitespace-pre-line">${f}</p>
        </div>
      `;
    }).join('');

    traitsEl.innerHTML = `
      <div class="space-y-2.5 w-full">
        <div class="flex items-center justify-between border-b border-orange-950/60 pb-1.5">
          <div class="flex items-center gap-2">
            <span class="font-serif font-bold text-amber-200 text-sm">Класс: ${this.selectedClass.name}</span>
            <span class="text-[10px] font-mono font-bold text-foxOrange-400 bg-black/60 px-1.5 py-0.5 rounded border border-orange-900">Кость d${hitVal}</span>
          </div>
          <span class="text-[10px] text-stone-400 font-mono">1-й Уровень D&D 5e</span>
        </div>
        <p class="text-xs text-stone-300 font-serif italic">${this.selectedClass.description || ''}</p>
        <div class="space-y-2 pt-1 max-h-[220px] overflow-y-auto pr-1">
          ${featuresHtml}
        </div>
      </div>
    `;
  }

  renderClassLvl1Config() {
    const block = document.getElementById('classLvl1ConfigBlock');
    if (!block) return;

    if (!this.selectedClass) {
      block.classList.add('hidden');
      return;
    }

    block.classList.remove('hidden');
    document.getElementById('classLvl1Title').textContent = `Конфигуратор 1-го уровня: ${this.selectedClass.name}`;

    const bhBlock = document.getElementById('bloodHunterBlock');
    const subBlock = document.getElementById('lvl1SubclassChoiceBlock');
    const fightBlock = document.getElementById('lvl1FightingStyleBlock');
    const spellTome = document.getElementById('spellbookTomeBlock');

    bhBlock.classList.add('hidden');
    subBlock.classList.add('hidden');
    fightBlock.classList.add('hidden');
    spellTome.classList.add('hidden');

    const cName = this.selectedClass.name;
    const isAnyFighter = cName.includes('Воин') || cName.includes('воин') || cName.toLowerCase().includes('fighter');

    // Кровавый охотник
    if (cName.includes('охотник') || cName.includes('blood')) {
      bhBlock.classList.remove('hidden');
      const bSel = document.getElementById('bloodMaledictSelect');
      if (bSel) this.state.blood_curse = bSel.value;
    }
    // Любой воин (включая Альтернативного воина)
    else if (isAnyFighter) {
      fightBlock.classList.remove('hidden');
      const fSel = document.getElementById('lvl1FightingStyleSelect');
      if (fSel) this.state.fighting_style = fSel.value;
    }

        const isRanger = cName.toLowerCase().includes('следопыт') || cName.toLowerCase().includes('ranger');

    if (isRanger) {
      subBlock.classList.remove('hidden');
      document.getElementById('lvl1SubclassLabel').textContent = "Избранный враг Следопыта (1 уровень):";
      document.getElementById('lvl1SubclassSelect').innerHTML = `
        <option value="Нежить">Нежить (Язык: Загробный / Некротический)</option>
        <option value="Исчадия">Исчадия (Язык: Бездны или Инфернальный)</option>
        <option value="Драконы">Драконы (Язык: Драконий)</option>
        <option value="Аберрации">Аберрации (Язык: Глубинная речь)</option>
        <option value="Звери">Звери (Охота и повадки)</option>
        <option value="Феи">Феи (Язык: Сильван)</option>
        <option value="Гуманоиды (Орки и Гоблины)">Гуманоиды (Орки и Гоблины)</option>
      `;
      document.getElementById('lvl1SubclassInfo').textContent = "Преимущество на выслеживание (Выживание) и знания (Интеллект), а также изучение языка врага.";
      this.state.favored_enemy = document.getElementById('lvl1SubclassSelect').value;

      // Выводим также блок боевого стиля, так как стиль выбирается со 2 уровня, но игроки могут подготовить его заранее
      fightBlock.classList.remove('hidden');
      const fSel = document.getElementById('lvl1FightingStyleSelect');
      if (fSel) {
        fSel.innerHTML = `
          <option value="Стрельба">Стрельба (+2 к атакам дальнобойным оружием)</option>
          <option value="Оборона">Оборона (+1 к КД при ношении брони)</option>
          <option value="Дуэлянт">Дуэлянт (+2 к урону одноручным оружием)</option>
          <option value="Сражение двумя оружиями">Сражение двумя оружиями (модификатор ко 2-й руке)</option>
        `;
        this.state.fighting_style = fSel.value;
      }
    }

    // Подклассы 1-го уровня и заклинатели
    if (cName === 'Жрец') {
      subBlock.classList.remove('hidden');
      document.getElementById('lvl1SubclassLabel').textContent = "Божественный домен Жреца (1 уровень):";
      document.getElementById('lvl1SubclassSelect').innerHTML = `
        <option value="Домен Жизни">Домен Жизни (Усиленное исцеление, тяжелые доспехи)</option>
        <option value="Домен Света">Домен Света (Вспышка защиты, урон пламенем)</option>
        <option value="Домен Войны">Домен Войны (Боевое превосходство, тяжелые доспехи)</option>
        <option value="Домен Бури">Домен Бури (Гнев бури, максимальный урон молнией)</option>
      `;
      document.getElementById('lvl1SubclassInfo').textContent = "Заклинания домена всегда подготовлены!";
      this.onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
      this.initSpellbookTome(3, 2, "Жрец");
    } else if (cName === 'Чародей') {
      subBlock.classList.remove('hidden');
      document.getElementById('lvl1SubclassLabel').textContent = "Происхождение чародейства (1 уровень):";
      document.getElementById('lvl1SubclassSelect').innerHTML = `
        <option value="Драконья кровь">Драконья кровь (Хиты +1/ур, базовый КД 13)</option>
        <option value="Дикая магия">Дикая магия (Всплески неконтролируемого хаоса)</option>
        <option value="Божественная душа">Божественная душа (Доступ к магии жреца)</option>
      `;
      this.onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
      this.initSpellbookTome(4, 2, "Чародей");
    } else if (cName === 'Колдун') {
      subBlock.classList.remove('hidden');
      document.getElementById('lvl1SubclassLabel').textContent = "Потусторонний покровитель (1 уровень):";
      document.getElementById('lvl1SubclassSelect').innerHTML = `
        <option value="Исчадие">Исчадие (Временные хиты за убийство врагов)</option>
        <option value="Архифея">Архифея (Очарование и страх)</option>
        <option value="Великий Древний">Великий Древний (Телепатия на 30 фт)</option>
      `;
      this.onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
      this.initSpellbookTome(2, 2, "Колдун");
    } else if (cName === 'Волшебник') {
      this.initSpellbookTome(3, 6, "Волшебник");
    } else if (cName === 'Бард') {
      this.initSpellbookTome(2, 4, "Бард");
    } else if (cName === 'Друид') {
      this.initSpellbookTome(2, 2, "Друид");
    } else if (cName === 'Изобретатель') {
      this.initSpellbookTome(2, 2, "Изобретатель");
    }
  }

  onLvl1SubclassSelected(val) {
    this.state.subclass = val;
    this.updateSummary();
  }

  initSpellbookTome(cantripsLimit, spellsLimit, className) {
    const spellTome = document.getElementById('spellbookTomeBlock');
    if (!spellTome) return;
    spellTome.classList.remove('hidden');
    this.maxCantripsAllowed = cantripsLimit;
    this.maxSpellsAllowed = spellsLimit;
    this.selectedCantrips.clear();
    this.selectedSpells.clear();

    document.getElementById('spellbookClassNotice').textContent = `Гримуар класса ${className}: выберите ${cantripsLimit} заговора и ${spellsLimit} заклинаний 1-го круга.`;
    this.renderSpellTomePages();
    this.updateSpellCounters();
  }

  renderSpellTomePages() {
    const cantripsGrid = document.getElementById('tomeCantripsPage');
    const level1Grid = document.getElementById('tomeLevel1Page');
    if (!cantripsGrid || !level1Grid) return;
    cantripsGrid.innerHTML = '';
    level1Grid.innerHTML = '';

    this.spellCompendium.cantrips.forEach(s => {
      const isSel = this.selectedCantrips.has(s.name);
      const card = document.createElement('div');
      card.className = `p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${isSel ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400' : 'border-stone-800 bg-[#0e0a07] hover:border-stone-600'}`;
      card.onclick = () => this.toggleSpellSelection(s.name, 'cantrip');
      card.innerHTML = `
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-amber-200 text-xs">${s.name}</span>
            <span class="text-[9px] font-mono text-stone-400">${s.cast}</span>
          </div>
          <p class="text-[10px] text-stone-400 leading-tight">${s.desc}</p>
        </div>
        <div class="mt-1 text-[9px] font-mono text-amber-400/80">${s.school}</div>
      `;
      cantripsGrid.appendChild(card);
    });

    this.spellCompendium.level1.forEach(s => {
      const isSel = this.selectedSpells.has(s.name);
      const card = document.createElement('div');
      card.className = `p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${isSel ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400' : 'border-stone-800 bg-[#0e0a07] hover:border-stone-600'}`;
      card.onclick = () => this.toggleSpellSelection(s.name, 'spell');
      card.innerHTML = `
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-amber-200 text-xs">${s.name}</span>
            <span class="text-[9px] font-mono text-stone-400">${s.cast}</span>
          </div>
          <p class="text-[10px] text-stone-400 leading-tight">${s.desc}</p>
        </div>
        <div class="mt-1 text-[9px] font-mono text-amber-400/80">${s.school}</div>
      `;
      level1Grid.appendChild(card);
    });
  }

  toggleSpellSelection(name, type) {
    if (type === 'cantrip') {
      if (this.selectedCantrips.has(name)) this.selectedCantrips.delete(name);
      else {
        if (this.selectedCantrips.size >= this.maxCantripsAllowed) {
          alert(`Максимум заговоров для вашего класса: ${this.maxCantripsAllowed}`);
          return;
        }
        this.selectedCantrips.add(name);
      }
    } else {
      if (this.selectedSpells.has(name)) this.selectedSpells.delete(name);
      else {
        if (this.selectedSpells.size >= this.maxSpellsAllowed) {
          alert(`Максимум заклинаний 1-го круга: ${this.maxSpellsAllowed}`);
          return;
        }
        this.selectedSpells.add(name);
      }
    }
    this.state.spells = [...Array.from(this.selectedCantrips), ...Array.from(this.selectedSpells)];
    this.renderSpellTomePages();
    this.updateSpellCounters();
  }

  updateSpellCounters() {
    const cEl = document.getElementById('cantripQuotaBadge');
    const sEl = document.getElementById('spellQuotaBadge');
    if (cEl) cEl.textContent = `Заговоры: ${this.selectedCantrips.size} / ${this.maxCantripsAllowed}`;
    if (sEl) sEl.textContent = `1 Круг: ${this.selectedSpells.size} / ${this.maxSpellsAllowed}`;
  }

  switchSpellTab(tab) {
    const btnC = document.getElementById('tabSpellsCantrips');
    const btnS = document.getElementById('tabSpellsLevel1');
    const pageC = document.getElementById('tomeCantripsPage');
    const pageS = document.getElementById('tomeLevel1Page');

    if (tab === 'cantrips') {
      btnC.className = "px-3 py-1 rounded-t-lg bg-foxOrange-600 text-stone-950 font-bold text-xs font-serif";
      btnS.className = "px-3 py-1 rounded-t-lg text-stone-400 hover:text-amber-200 font-bold text-xs font-serif";
      pageC.classList.remove('hidden');
      pageS.classList.add('hidden');
    } else {
      btnS.className = "px-3 py-1 rounded-t-lg bg-foxOrange-600 text-stone-950 font-bold text-xs font-serif";
      btnC.className = "px-3 py-1 rounded-t-lg text-stone-400 hover:text-amber-200 font-bold text-xs font-serif";
      pageS.classList.remove('hidden');
      pageC.classList.add('hidden');
    }
  }

  // --- ШАГ 3: ХАРАКТЕРИСТИКИ ---

  setStatMode(mode) {
    this.statMode = mode;
    ['PointBuy', 'Standard', 'Roll'].forEach(m => {
      const btn = document.getElementById(`modeBtn${m}`);
      if (btn) {
        if (m.toLowerCase() === mode.toLowerCase()) btn.className = "px-3 py-1 rounded bg-foxOrange-600 text-stone-950 font-bold";
        else btn.className = "px-3 py-1 rounded text-stone-400 hover:text-amber-200 font-bold";
      }
    });

    const pbPanel = document.getElementById('pointBuyPanel');
    const poolPanel = document.getElementById('poolPanel');
    const rollBtn = document.getElementById('btnRollDice');

    if (mode === 'pointbuy') {
      pbPanel?.classList.remove('hidden');
      poolPanel?.classList.add('hidden');
    } else {
      pbPanel?.classList.add('hidden');
      poolPanel?.classList.remove('hidden');

      if (mode === 'standard') {
        rollBtn?.classList.add('hidden');
        document.getElementById('poolTitle').textContent = "Стандартный набор D&D 5e (перетащите в слоты):";
        this.initPool([15, 14, 13, 12, 10, 8]);
      } else {
        rollBtn?.classList.remove('hidden');
        document.getElementById('poolTitle').textContent = "Бросок 4d6 (отсев меньшего):";
        this.rollDicePool();
      }
    }
    this.calcStartingHp();
  }

  changePointBuy(stat, delta) {
    const curVal = this.pointBuyStats[stat];
    const newVal = curVal + delta;
    if (newVal < 8 || newVal > 15) return;

    const curCost = this.pointBuyCosts[curVal];
    const newCost = this.pointBuyCosts[newVal];
    const costDiff = newCost - curCost;

    if (costDiff > this.pointBuyRemaining) {
      alert("Недостаточно очков для этого значения!");
      return;
    }

    this.pointBuyRemaining -= costDiff;
    this.pointBuyStats[stat] = newVal;

    document.getElementById(`pbVal_${stat}`).textContent = newVal;
    document.getElementById('pointBuyRemaining').textContent = this.pointBuyRemaining;
    this.calcStartingHp();
    this.updateSummary();
  }

  initPool(vals) {
    this.rolledPool = vals.map((v, i) => ({ id: i, value: v, used: false }));
    this.assignedStats = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    this.renderPool();
    this.renderSlots();
  }

  rollDicePool() {
    const vals = [];
    for (let i = 0; i < 6; i++) {
      const d = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1).sort((a,b) => a - b);
      vals.push(d[1] + d[2] + d[3]);
    }
    vals.sort((a,b) => b - a);
    this.initPool(vals);
  }

  renderPool() {
    const cont = document.getElementById('dicePoolContainer');
    if (!cont) return;
    cont.innerHTML = '';
    this.rolledPool.forEach(chip => {
      if (chip.used) return;
      const d = document.createElement('div');
      d.draggable = true;
      d.ondragstart = (e) => { e.dataTransfer.setData("text/plain", chip.id); };
      d.className = "w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-base cursor-grab border border-orange-950 bg-black/60 text-amber-200 hover:border-amber-400 active:cursor-grabbing transition-all";
      d.textContent = chip.value;
      d.onclick = () => { this.assignFirstEmptySlot(chip); };
      cont.appendChild(d);
    });
  }

  renderSlots() {
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
      const slot = document.getElementById(`slot_${stat}`);
      if (!slot) return;
      const val = this.assignedStats[stat];
      slot.innerHTML = val !== null ? `
        <div class="flex items-center justify-between w-full px-2">
          <span class="font-mono font-bold text-amber-200 text-base">${val}</span>
          <button onclick="window.wizard.clearSlot('${stat}')" class="text-rose-400 hover:text-rose-300 text-xs font-bold">&times;</button>
        </div>
      ` : `<span class="text-[11px] text-stone-500 italic">Сюда</span>`;
    });
    this.calcStartingHp();
    this.updateSummary();
  }

  handleDrop(e, stat) {
    e.preventDefault();
    const chipId = parseInt(e.dataTransfer.getData("text/plain"));
    const chip = this.rolledPool.find(c => c.id === chipId);
    if (!chip || chip.used) return;

    if (this.assignedStats[stat] !== null) {
      const prevChip = this.rolledPool.find(c => c.value === this.assignedStats[stat] && c.used);
      if (prevChip) prevChip.used = false;
    }

    this.assignedStats[stat] = chip.value;
    chip.used = true;
    this.renderPool();
    this.renderSlots();
  }

  assignFirstEmptySlot(chip) {
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      if (this.assignedStats[k] === null) {
        this.assignedStats[k] = chip.value;
        chip.used = true;
        this.renderPool();
        this.renderSlots();
        return;
      }
    }
  }

  clearSlot(stat) {
    const val = this.assignedStats[stat];
    if (val === null) return;
    const chip = this.rolledPool.find(c => c.value === val && c.used);
    if (chip) chip.used = false;
    this.assignedStats[stat] = null;
    this.renderPool();
    this.renderSlots();
  }

  calcStartingHp() {
    const hpEl = document.getElementById('startingHpDisplay');
    if (!hpEl) return;
    const hitDie = this.selectedClass ? (this.selectedClass.hit_die || this.selectedClass.hitDie || 8) : 8;
    const conVal = this.statMode === 'pointbuy' ? this.pointBuyStats.con : (this.assignedStats.con || 10);
    const conMod = Math.floor((conVal - 10) / 2);
    const totalHp = Math.max(1, hitDie + conMod);
    hpEl.textContent = `${totalHp} HP (d${hitDie}: ${hitDie} + ТЕЛ: ${conMod >= 0 ? '+' + conMod : conMod})`;
    const sumHp = document.getElementById('summaryCharHp');
    if (sumHp) sumHp.textContent = `${totalHp} HP`;
  }

  // --- ШАГ 4: ЛИЧНОСТЬ ---

  selectAlignment(align) {
    this.state.alignment = align;
    document.querySelectorAll('.align-btn').forEach(btn => {
      if (btn.textContent.trim() === align) {
        btn.className = "align-btn p-2 rounded border border-amber-400 bg-amber-950/40 text-amber-200 font-bold ring-1 ring-amber-400 transition-all";
      } else {
        btn.className = "align-btn p-2 rounded border border-orange-950 bg-[#0e0907] text-stone-300 hover:border-amber-400 transition-all";
      }
    });
  }

  renderBackgrounds() {
    const grid = document.getElementById('backgroundsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    this.allBackgrounds.forEach(b => {
      const card = document.createElement('div');
      const isSel = this.selectedBackground && (this.selectedBackground.id === b.id || this.selectedBackground.name === b.name);
      card.className = `p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${isSel ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
      card.onclick = () => this.selectBackground(b);

      card.innerHTML = `
        <h4 class="font-serif font-bold text-amber-200 text-xs mb-0.5">${b.name}</h4>
        <p class="text-[10px] text-stone-400 font-serif line-clamp-2">${b.description || b.desc || ''}</p>
      `;
      grid.appendChild(card);
    });
  }

  selectBackground(b) {
    this.selectedBackground = b;
    this.state.background = b.name;
    this.renderBackgrounds();

    const dEl = document.getElementById('selectedBackgroundDetails');
    if (dEl) {
      const skillsStr = (b.skill_proficiencies || b.skills || []).join(', ') || 'На выбор';
      const toolsStr = (b.tool_proficiencies || b.tools || []).join(', ') || 'Нет';
      const langStr = (b.languages || []).join(', ') || 'Нет';
      const featName = b.feature ? (b.feature.name || 'Особенность') : '';
      const featDesc = b.feature ? (b.feature.description || '') : '';

      dEl.innerHTML = `
        <div class="space-y-1 w-full">
          <div><strong class="text-amber-300">Навыки:</strong> ${skillsStr} | <strong class="text-amber-300">Инструменты:</strong> ${toolsStr} | <strong class="text-amber-300">Языки:</strong> ${langStr}</div>
          ${featName ? `<div><strong class="text-foxOrange-400">Умение (${featName}):</strong> ${featDesc}</div>` : ''}
        </div>
      `;
    }
    this.updateSummary();
  }

  selectEquipmentMode(mode) {
    this.equipmentMode = mode;
    this.state.equipment_mode = mode;
    const kitCard = document.getElementById('eqKitCard');
    const goldCard = document.getElementById('eqGoldCard');

    if (mode === 'class_kit') {
      kitCard.className = "p-4 rounded-xl border-2 border-amber-400 bg-amber-950/30 cursor-pointer transition-all";
      goldCard.className = "p-4 rounded-xl border border-orange-950 bg-[#0e0907] cursor-pointer hover:border-amber-500/50 transition-all";
    } else {
      goldCard.className = "p-4 rounded-xl border-2 border-amber-400 bg-amber-950/30 cursor-pointer transition-all";
      kitCard.className = "p-4 rounded-xl border border-orange-950 bg-[#0e0907] cursor-pointer hover:border-amber-500/50 transition-all";
    }
  }

  // --- НАВИГАЦИЯ ШАГОВ ---

  goToStep(step) {
    if (step < 1 || step > 5) return;

    if (step > this.currentStep) {
      if (this.currentStep === 1 && !this.selectedRace) { alert("Выберите расу персонажа!"); return; }
      if (this.currentStep === 2 && !this.selectedClass) { alert("Выберите класс персонажа!"); return; }
      if (this.currentStep === 3) {
        if (this.statMode === 'pointbuy' && this.pointBuyRemaining > 0) {
          if (!confirm(`У вас осталось ${this.pointBuyRemaining} очков покупки. Продолжить?`)) return;
        } else if (this.statMode !== 'pointbuy' && Object.values(this.assignedStats).some(v => v === null)) {
          alert("Распределите все 6 характеристик в слоты!");
          return;
        }
      }
    }

    for (let i = 1; i <= 5; i++) {
      const p = document.getElementById(`wizardStep${i}`);
      const ind = document.getElementById(`stepIndicator${i}`);
      if (p) p.classList.toggle('hidden', i !== step);
      if (ind) {
        if (i === step) ind.className = "py-2.5 rounded-lg text-xs font-bold transition-all bg-amber-400 text-stone-950 shadow-md";
        else ind.className = "py-2.5 rounded-lg text-xs font-bold transition-all text-stone-400 hover:text-amber-200";
      }
    }

    this.currentStep = step;
    document.getElementById('btnPrevStep')?.classList.toggle('hidden', step === 1);
    const nextBtn = document.getElementById('btnNextStep');
    const submitBtn = document.getElementById('btnSubmitChar');

    if (nextBtn) {
      nextBtn.classList.toggle('hidden', step === 5);
      const names = ['', 'Класс', 'Статы', 'Личность', 'Снаряжение'];
      if (step < 5) nextBtn.textContent = `Далее: ${names[step]} →`;
    }
    if (submitBtn) submitBtn.classList.toggle('hidden', step !== 5);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep() { this.goToStep(this.currentStep + 1); }
  prevStep() { this.goToStep(this.currentStep - 1); }

  updateSummary() {
    this.state.name = document.getElementById('charNameInput')?.value.trim() || '';
    const sumName = document.getElementById('summaryCharName');
    const sumRace = document.getElementById('summaryCharRace');
    const sumClass = document.getElementById('summaryCharClass');

    if (sumName) sumName.textContent = this.state.name || "Безымянный герой";
    if (sumRace) sumRace.textContent = this.state.race || "Не выбрана";
    if (sumClass) sumClass.textContent = this.state.class_name ? `${this.state.class_name} ${this.state.subclass ? '(' + this.state.subclass + ')' : ''}` : "Не выбран";
  }

  // --- ФИНАЛЬНЫЙ SUBMIT ---

  async submitCharacter() {
    const name = (document.getElementById('charNameInput')?.value || '').trim();
    if (!name) { alert("Укажите имя персонажа!"); this.goToStep(4); return; }
    if (!this.selectedRace) { alert("Выберите расу!"); this.goToStep(1); return; }
    if (!this.selectedClass) { alert("Выберите класс!"); this.goToStep(2); return; }

    const finalStats = this.statMode === 'pointbuy' ? { ...this.pointBuyStats } : { ...this.assignedStats };
    const bonuses = (this.selectedRace && this.selectedRace.ability_bonuses) ? this.selectedRace.ability_bonuses : {};
    for (const [k, v] of Object.entries(bonuses)) {
      if (finalStats[k] !== null && finalStats[k] !== undefined) finalStats[k] += v;
    }

    const hitDie = this.selectedClass.hit_die || this.selectedClass.hitDie || 8;
    const conMod = Math.floor(((finalStats.con || 10) - 10) / 2);
    const maxHp = Math.max(1, hitDie + conMod);
    const dexMod = Math.floor(((finalStats.dex || 10) - 10) / 2);
    const armorClass = 10 + dexMod;

    // Считываем боевой стиль, если отображался блок
    const fStyleSelect = document.getElementById('lvl1FightingStyleSelect');
    const fightingStyle = (fStyleSelect && !fStyleSelect.closest('#lvl1FightingStyleBlock').classList.contains('hidden'))
      ? fStyleSelect.value
      : null;

    const payload = {
      name: name,
      race: this.selectedRace.name,
      class_name: this.selectedClass.name,
      subclass: this.state.subclass || null,
      level: 1,
      hp_max: maxHp,
      hp_current: maxHp,
      max_hp: maxHp,
      current_hp: maxHp,
      armor_class: armorClass,
      speed: this.selectedRace.speed || 30,
      stats: finalStats,
      background: this.selectedBackground ? this.selectedBackground.name : "Обыватель",
      fighting_style: fightingStyle,
      blood_curse: this.state.blood_curse || null,
      spells: (this.state.spells || []).map(sName => {
        const cantrip = (this.spellCompendium.cantrips || []).find(c => c.name === sName);
        if (cantrip) {
          return {
            name: cantrip.name, level: 0, school: cantrip.school || "Универсальная",
            casting_time: cantrip.cast || "1 действие", description: cantrip.desc || "",
            is_cantrip: true, is_prepared: true
          };
        }
        const lvl1 = (this.spellCompendium.level1 || []).find(c => c.name === sName);
        if (lvl1) {
          return {
            name: lvl1.name, level: 1, school: lvl1.school || "Универсальная",
            casting_time: lvl1.cast || "1 действие", description: lvl1.desc || "",
            is_cantrip: false, is_prepared: true
          };
        }
        return {
          name: sName, level: 1, school: "Универсальная",
          casting_time: "1 действие", description: "Заклинание персонажа",
          is_cantrip: false, is_prepared: true
        };
      }),
      alignment: this.state.alignment || "Истинно нейтральный",
      backstory: document.getElementById('charBackstory')?.value.trim() || '',
      notes: document.getElementById('charNotes')?.value.trim() || '',
      equipment_mode: this.state.equipment_mode || "class_kit"
    };

    const submitBtn = document.getElementById('btnSubmitChar');
    if (submitBtn) { submitBtn.textContent = "Создание персонажа..."; submitBtn.disabled = true; }

    try {
      const res = await apiFetch('/characters/', { method: 'POST', body: payload });
      if (res.ok) {
        const char = await res.json();
        if (this.activePartyId) {
          try {
            await apiFetch(`/parties/${this.activePartyId}/join`, {
              method: 'POST',
              body: { character_id: char.id }
            });
            window.location.href = `/party/${this.activePartyId}`;
            return;
          } catch (e) {}
        }
        window.location.href = `/characters/${char.id}/sheet`;
      } else {
        const err = await res.json();
        let errMsg = "Ошибка при создании персонажа:";
        if (Array.isArray(err.detail)) {
          errMsg += "\n" + err.detail.map(d => `• ${d.loc.slice(1).join('.')}: ${d.msg}`).join('\n');
        } else if (typeof err.detail === 'string') {
          errMsg = err.detail;
        }
        alert(errMsg);
      }
    } catch (e) {
      alert("Сбой соединения с сервером: " + e.message);
    } finally {
      if (submitBtn) { submitBtn.textContent = "Создать персонажа ✓"; submitBtn.disabled = false; }
    }
  }

  // --- КАСТОМНЫЕ РАСЫ ДЛЯ DM ---
  openCreateRaceModal() {
    document.getElementById('crTraitsContainer').innerHTML = '';
    this.addCustomTraitField();
    document.getElementById('createRaceModal').classList.remove('hidden');
  }

  closeCreateRaceModal() {
    document.getElementById('createRaceModal').classList.add('hidden');
  }

  addCustomTraitField() {
    const container = document.getElementById('crTraitsContainer');
    const row = document.createElement('div');
    row.className = "flex gap-2 items-center bg-[#120d09] p-2 rounded border border-orange-950";
    row.innerHTML = `
      <input type="text" placeholder="Название черты" class="trait-name w-1/3 bg-black/60 border border-stone-800 rounded p-1 text-xs text-amber-200">
      <input type="text" placeholder="Описание особенности" class="trait-desc w-2/3 bg-black/60 border border-stone-800 rounded p-1 text-xs text-stone-200">
      <button type="button" onclick="this.parentElement.remove()" class="text-rose-400 text-xs font-bold px-1">&times;</button>
    `;
    container.appendChild(row);
  }

  async saveCustomRace() {
    const name = document.getElementById('crNameInput').value.trim();
    if (!name) { alert("Укажите название расы!"); return; }
    const speed = parseInt(document.getElementById('crSpeedInput').value) || 30;
    const desc = document.getElementById('crDescInput').value.trim();
    const dmOnly = document.getElementById('crDmOnlyCheck').checked;

    const bonuses = {};
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(k => {
      const v = parseInt(document.getElementById(`crStat_${k}`).value) || 0;
      if (v !== 0) bonuses[k] = v;
    });

    const traits = [];
    document.querySelectorAll('#crTraitsContainer > div').forEach(row => {
      const tName = row.querySelector('.trait-name').value.trim();
      const tDesc = row.querySelector('.trait-desc').value.trim();
      if (tName) traits.push({ name: tName, description: tDesc });
    });

    const payload = {
      name: name,
      speed: speed,
      description: desc || "Авторская раса",
      ability_bonuses: bonuses,
      traits: traits,
      dm_only: dmOnly
    };

    try {
      const res = await apiFetch('/compendium/races', { method: 'POST', body: payload });
      if (res.ok) {
        this.closeCreateRaceModal();
        this.loadRaces();
      } else {
        const err = await res.json();
        alert(err.detail || "Ошибка при сохранении расы");
      }
    } catch (e) {
      alert("Сбой сети: " + e.message);
    }
  }

  async deleteCustomRace(raceId) {
    if (!confirm("Удалить эту авторскую расу из компендиума?")) return;
    try {
      const res = await apiFetch(`/compendium/races/${raceId}`, { method: 'DELETE' });
      if (res.ok) {
        if (this.selectedRace && this.selectedRace.id === raceId) this.selectedRace = null;
        this.loadRaces();
      }
    } catch (e) {
      alert("Ошибка удаления: " + e.message);
    }
  }
}

