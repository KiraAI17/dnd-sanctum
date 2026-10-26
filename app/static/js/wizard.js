// Конструктор персонажа D&D 5e - Монолитный модуль
let currentStep = 1;
const totalSteps = 5;

let ALL_RACES = [];
let CLASSES = [];
let ALL_BACKGROUNDS = [];

let selectedRace = null;
let selectedClass = null;
let selectedBackground = null;

let statMode = 'standard';
let rolledPool = [];
let assignedStats = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
let selectedChipId = null;

let wizardState = {
  name: '',
  race: '',
  class_name: '',
  subclass: null,
  background: '',
  fighting_style: null,
  spells: [],
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
};

// Загрузка данных справочников
async function loadCompendiumData() {
  try {
    const [rRes, cRes, bRes] = await Promise.all([
      apiFetch('/compendium/races'),
      apiFetch('/compendium/classes'),
      apiFetch('/compendium/backgrounds')
    ]);

    if (rRes.ok) {
      const raw = await rRes.json();
      ALL_RACES = Array.isArray(raw) ? raw : (raw.races || []);
      renderRaces();
    }
    if (cRes.ok) {
      CLASSES = await cRes.json();
      renderClasses();
    }
    if (bRes.ok) {
      ALL_BACKGROUNDS = await bRes.json();
      renderBackgrounds();
    }
  } catch (err) {
    console.error("Ошибка загрузки компендиума:", err);
  }
}

// ----------------------------------------------------
// ШАГ 1: РАСЫ
// ----------------------------------------------------
function renderRaces() {
  const grid = document.getElementById('racesGrid') || document.getElementById('raceOptionsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_RACES.forEach(r => {
    const card = document.createElement('div');
    const isSel = selectedRace && (selectedRace.id === r.id || selectedRace.name === r.name);
    card.className = `p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${isSel ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
    card.onclick = () => { selectRace(r); };

    const bonusStr = r.ability_bonuses ? Object.entries(r.ability_bonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') : '';

    card.innerHTML = `
      <div>
        <div class="flex justify-between items-center mb-1">
          <h4 class="font-serif font-bold text-amber-200 text-sm">${r.name}</h4>
          <span class="text-[10px] font-mono text-stone-400">${r.speed || 30} фт.</span>
        </div>
        <p class="text-[11px] text-stone-400 font-serif line-clamp-2">${r.description || ''}</p>
      </div>
      ${bonusStr ? `<div class="mt-2 text-[10px] font-mono text-amber-400/90 font-bold">${bonusStr}</div>` : ''}
    `;
    grid.appendChild(card);
  });

  // Карточка создания авторской расы
  const customCard = document.createElement('div');
  const isCustomSel = selectedRace && selectedRace.is_custom;
  customCard.className = `p-3 rounded-xl border border-dashed cursor-pointer transition-all flex flex-col justify-center items-center text-center ${isCustomSel ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400' : 'border-amber-500/40 bg-[#0e0907]/40 hover:border-amber-400'}`;
  customCard.onclick = () => { openCustomRacePrompt(); };
  customCard.innerHTML = `
    <span class="text-xl mb-1">✍️</span>
    <span class="font-serif font-bold text-amber-300 text-xs">Создать авторскую расу</span>
    <span class="text-[10px] text-stone-500 mt-0.5">Имя, скорость и бонусы</span>
  `;
  grid.appendChild(customCard);

  updateSelectedRaceDetails();
}

function openCustomRacePrompt() {
  const name = prompt("Введите название вашей расы:", "Скиталец теней");
  if (!name) return;
  const speed = parseInt(prompt("Скорость (в футах):", "30")) || 30;
  const customRace = {
    id: "custom_" + Date.now(),
    name: name.trim(),
    speed: speed,
    ability_bonuses: {},
    description: "Авторская раса, созданная игроком для кампании.",
    traits: [
      { name: "Авторское происхождение", description: "Особенности согласованы с Мастером." },
      { name: "Базовая скорость", description: `${speed} футов.` }
    ],
    is_custom: true
  };
  ALL_RACES.push(customRace);
  selectRace(customRace);
}

function selectRace(r) {
  selectedRace = r;
  wizardState.race = r.name;
  renderRaces();
  calcStartingHp();
  updateSummary();
}

function updateSelectedRaceDetails() {
  const traitsEl = document.getElementById('selectedRaceTraits');
  if (!traitsEl) return;
  if (!selectedRace) {
    traitsEl.innerHTML = '<span class="text-stone-500 italic text-xs">Выберите расу из списка выше, чтобы увидеть подробные свойства и особенности.</span>';
    return;
  }

  const traitsHtml = (selectedRace.traits || []).map(t => `
    <span class="inline-block bg-[#160f0b] border border-orange-950 text-stone-300 text-xs px-2 py-1 rounded font-serif">
      <strong class="text-amber-400">${t.name}:</strong> ${t.description}
    </span>
  `).join(' ');

  const bonuses = selectedRace.ability_bonuses ? Object.entries(selectedRace.ability_bonuses).map(([k,v]) => `+${v} ${k.toUpperCase()}`).join(', ') : 'нет';

  traitsEl.innerHTML = `
    <div class="space-y-1.5 w-full">
      <div class="flex items-center justify-between border-b border-orange-950/60 pb-1">
        <span class="font-serif font-bold text-amber-200 text-xs">Выбрано: ${selectedRace.name} (Скорость ${selectedRace.speed} фт., Бонусы: ${bonuses})</span>
      </div>
      <div class="flex flex-wrap gap-1.5 pt-0.5">
        ${traitsHtml || '<span class="text-stone-400 text-xs">Стандартные особенности D&D 5e.</span>'}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// ШАГ 2: КЛАССЫ И ОСОБЕННОСТИ 1-ГО УРОВНЯ
// ----------------------------------------------------
function renderClasses() {
  const grid = document.getElementById('classesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  CLASSES.forEach(c => {
    const card = document.createElement('div');
    const isSel = selectedClass && (selectedClass.name === c.name || selectedClass.id === c.id);

    card.className = `p-3.5 rounded-xl border cursor-pointer transition-all ${isSel ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)]' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
    card.onclick = () => { selectClass(c); };

    const hitVal = c.hit_die || c.hitDie || 8;
    const featuresHtml = (c.level1_features || []).map(f => `
      <span class="inline-block bg-[#160f0b] border border-orange-950 text-stone-300 text-[10px] px-1.5 py-0.5 rounded mr-1 mb-1 font-serif">• ${f}</span>
    `).join('');

    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <h4 class="font-serif font-bold text-amber-200 text-sm">${c.name}</h4>
        <span class="text-[10px] font-mono font-bold text-foxOrange-400 bg-black/40 px-1.5 py-0.5 rounded border border-orange-950">d${hitVal}</span>
      </div>
      <p class="text-[11px] text-stone-400 font-serif mb-2 line-clamp-2">${c.description || c.desc || ''}</p>
      <div class="border-t border-orange-950/60 pt-2">
        <span class="text-[10px] text-amber-400/90 font-bold block mb-1">Умения 1-го уровня:</span>
        <div class="flex flex-wrap">${featuresHtml}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  renderClassLvl1Config();
}

function selectClass(c) {
  selectedClass = c;
  wizardState.class_name = c.name;
  renderClasses();
  calcStartingHp();
  updateSummary();
}

function renderClassLvl1Config() {
  const block = document.getElementById('classLvl1ConfigBlock');
  if (!block) return;

  if (!selectedClass) {
    block.classList.add('hidden');
    return;
  }

  block.classList.remove('hidden');
  const titleEl = document.getElementById('classLvl1Title');
  if (titleEl) titleEl.textContent = `Особенности 1-го уровня: ${selectedClass.name}`;

  const subBlock = document.getElementById('lvl1SubclassChoiceBlock');
  const fightBlock = document.getElementById('lvl1FightingStyleBlock');
  const wizBlock = document.getElementById('lvl1WizardSpellsBlock');

  if (subBlock) subBlock.classList.add('hidden');
  if (fightBlock) fightBlock.classList.add('hidden');
  if (wizBlock) wizBlock.classList.add('hidden');

  if (selectedClass.name === 'Жрец' && subBlock) {
    subBlock.classList.remove('hidden');
    document.getElementById('lvl1SubclassLabel').textContent = "Божественный домен Жреца (1 уровень):";
    document.getElementById('lvl1SubclassSelect').innerHTML = `
      <option value="Домен Жизни">Домен Жизни (Усиленное исцеление, тяжелые доспехи)</option>
      <option value="Домен Света">Домен Света (Вспышка защиты, урон огнем и излучением)</option>
      <option value="Домен Войны">Домен Войны (Боевое превосходство, тяжелые доспехи)</option>
      <option value="Домен Бури">Домен Бури (Гнев бури, максимальный урон молнией)</option>
    `;
    onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
  } else if (selectedClass.name === 'Чародей' && subBlock) {
    subBlock.classList.remove('hidden');
    document.getElementById('lvl1SubclassLabel').textContent = "Происхождение чародейства (1 уровень):";
    document.getElementById('lvl1SubclassSelect').innerHTML = `
      <option value="Драконья кровь">Драконья кровь (Хиты +1/ур, базовый КД 13)</option>
      <option value="Дикая магия">Дикая магия (Всплески неконтролируемой магии)</option>
      <option value="Божественная душа">Божественная душа (Заклинания жреца, благословение богов)</option>
    `;
    onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
  } else if (selectedClass.name === 'Колдун' && subBlock) {
    subBlock.classList.remove('hidden');
    document.getElementById('lvl1SubclassLabel').textContent = "Потусторонний покровитель (1 уровень):";
    document.getElementById('lvl1SubclassSelect').innerHTML = `
      <option value="Исчадие">Исчадие (Временные хиты за убийство врагов)</option>
      <option value="Архифея">Архифея (Очарование и страх на врагов)</option>
      <option value="Великий Древний">Великий Древний (Телепатия разума на 30 фт.)</option>
      <option value="Небожитель">Небожитель (Пул исцеляющего света d6)</option>
    `;
    onLvl1SubclassSelected(document.getElementById('lvl1SubclassSelect').value);
  } else if (selectedClass.name === 'Воин' && fightBlock) {
    fightBlock.classList.remove('hidden');
    wizardState.fighting_style = document.getElementById('lvl1FightingStyleSelect').value;
  } else if (selectedClass.name === 'Волшебник' && wizBlock) {
    wizBlock.classList.remove('hidden');
    validateWizardSpells();
  }
}

function onLvl1SubclassSelected(val) {
  wizardState.subclass = val;
  updateSummary();
}

function onLvl1FightingStyleSelected(val) {
  wizardState.fighting_style = val;
}

function validateWizardSpells() {
  const cantrips = Array.from(document.querySelectorAll('#wizardCantripsCheckboxes input:checked')).map(el => el.value);
  const spells = Array.from(document.querySelectorAll('#wizardLevel1SpellsCheckboxes input:checked')).map(el => el.value);
  wizardState.spells = [...cantrips, ...spells];
}

// ----------------------------------------------------
// ШАГ 3: СТАТЫ
// ----------------------------------------------------
function setStatMode(mode) {
  statMode = mode;
  ['Roll', 'Standard', 'PointBuy'].forEach(m => {
    const btn = document.getElementById(`modeBtn${m}`);
    if (btn) {
      if (m.toLowerCase() === mode.toLowerCase()) {
        btn.className = "px-3 py-1.5 rounded font-bold bg-foxOrange-600 text-stone-950";
      } else {
        btn.className = "px-3 py-1.5 rounded font-bold text-stone-400 hover:text-amber-200";
      }
    }
  });

  const poolPanel = document.getElementById('poolPanel');
  const pointBuyPanel = document.getElementById('pointBuyPanel');
  if (poolPanel) poolPanel.classList.toggle('hidden', mode === 'pointbuy');
  if (pointBuyPanel) pointBuyPanel.classList.toggle('hidden', mode !== 'pointbuy');

  const rollBtn = document.getElementById('btnRollDice');
  if (rollBtn) rollBtn.classList.toggle('hidden', mode !== 'roll');

  selectedChipId = null;

  if (mode === 'standard') {
    const poolTitle = document.getElementById('poolTitle');
    if (poolTitle) poolTitle.textContent = "Стандартный набор D&D 5e:";
    initPool([15, 14, 13, 12, 10, 8]);
  } else if (mode === 'roll') {
    const poolTitle = document.getElementById('poolTitle');
    if (poolTitle) poolTitle.textContent = "Бросок 4d6 (отсев меньшего):";
    rollDicePool();
  }
  renderSlots();
  calcStartingHp();
}

function initPool(vals) {
  rolledPool = vals.map((v, i) => ({ id: i, value: v, used: false }));
  assignedStats = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  renderPool();
  renderSlots();
}

function rollDicePool() {
  const vals = [];
  for (let i = 0; i < 6; i++) {
    const d = [1,2,3,4].map(() => Math.floor(Math.random() * 6) + 1);
    d.sort((a,b) => a - b);
    vals.push(d[1] + d[2] + d[3]);
  }
  vals.sort((a,b) => b - a);
  initPool(vals);
}

function renderPool() {
  const cont = document.getElementById('dicePoolContainer');
  if (!cont) return;
  cont.innerHTML = '';
  rolledPool.forEach(chip => {
    if (chip.used) return;
    const isSel = selectedChipId === chip.id;
    const d = document.createElement('div');
    d.className = `w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-base cursor-pointer border transition-all ${isSel ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400 scale-105' : 'border-orange-950 bg-black/60 text-stone-200 hover:border-amber-500/50'}`;
    d.textContent = chip.value;
    d.onclick = () => {
      selectedChipId = selectedChipId === chip.id ? null : chip.id;
      renderPool();
    };
    cont.appendChild(d);
  });
}

function renderSlots() {
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
    const slot = document.getElementById(`slot_${stat}`);
    if (!slot) return;
    const val = assignedStats[stat];
    slot.innerHTML = val !== null ? `
      <div class="flex items-center justify-between w-full px-2">
        <span class="font-mono font-bold text-amber-200 text-base">${val}</span>
        <button onclick="clearSlot('${stat}')" class="text-rose-400 hover:text-rose-300 text-xs font-bold">&times;</button>
      </div>
    ` : `
      <span class="text-[11px] text-stone-500 italic">Нажмите фишку</span>
    `;
    slot.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      assignSelectedToSlot(stat);
    };
  });
  calcStartingHp();
  updateSummary();
}

function assignSelectedToSlot(stat) {
  if (selectedChipId === null) return;
  const chip = rolledPool.find(c => c.id === selectedChipId);
  if (!chip || chip.used) return;

  if (assignedStats[stat] !== null) {
    const prevVal = assignedStats[stat];
    const prevChip = rolledPool.find(c => c.value === prevVal && c.used);
    if (prevChip) prevChip.used = false;
  }

  assignedStats[stat] = chip.value;
  chip.used = true;
  selectedChipId = null;
  renderPool();
  renderSlots();
}

function clearSlot(stat) {
  const val = assignedStats[stat];
  if (val === null) return;
  const chip = rolledPool.find(c => c.value === val && c.used);
  if (chip) chip.used = false;
  assignedStats[stat] = null;
  renderPool();
  renderSlots();
}

function calcStartingHp() {
  const hpEl = document.getElementById('startingHpDisplay');
  if (!hpEl) return;
  const hitDie = selectedClass ? (selectedClass.hit_die || selectedClass.hitDie || 8) : 8;
  const conScore = assignedStats.con !== null ? assignedStats.con : 10;
  const conMod = Math.floor((conScore - 10) / 2);
  const totalHp = Math.max(1, hitDie + conMod);
  hpEl.textContent = `${totalHp} HP (d${hitDie}: ${hitDie} + ТЕЛ: ${conMod >= 0 ? '+' + conMod : conMod})`;
}

// ----------------------------------------------------
// ШАГ 4: ЛИЧНОСТЬ (ПРЕДЫСТОРИЯ)
// ----------------------------------------------------
function renderBackgrounds() {
  const grid = document.getElementById('backgroundsGrid') || document.getElementById('backgroundOptions');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_BACKGROUNDS.forEach(b => {
    const card = document.createElement('div');
    const isSel = selectedBackground && (selectedBackground.id === b.id || selectedBackground.name === b.name);
    card.className = `p-3.5 rounded-xl border cursor-pointer transition-all ${isSel ? 'border-amber-400 bg-amber-950/50 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-orange-950 bg-[#0e0907]/70 hover:border-amber-500/50'}`;
    card.onclick = () => { selectBackground(b); };

    const skillsStr = (b.skill_proficiencies || b.skills || []).join(', ') || 'На выбор игрока';
    const toolsStr = (b.tool_proficiencies || b.tools || []).join(', ') || 'Нет инструментов';
    const langStr = (b.languages || []).join(', ') || 'Нет языков';
    const featName = b.feature ? (b.feature.name || b.feature.title || 'Особенность') : '';
    const featDesc = b.feature ? (b.feature.description || b.feature.desc || '') : '';

    card.innerHTML = `
      <h4 class="font-serif font-bold text-amber-200 text-sm mb-1">${b.name}</h4>
      <p class="text-[11px] text-stone-400 font-serif mb-2">${b.description || b.desc || ''}</p>
      <div class="border-t border-orange-950/60 pt-2 space-y-1 text-[11px] font-serif">
        <div><span class="text-amber-400/90 font-bold">Навыки:</span> <span class="text-stone-300">${skillsStr}</span></div>
        <div><span class="text-amber-400/90 font-bold">Инструменты:</span> <span class="text-stone-300">${toolsStr}</span></div>
        <div><span class="text-amber-400/90 font-bold">Языки:</span> <span class="text-stone-300">${langStr}</span></div>
        ${featName ? `<div class="mt-1 pt-1 border-t border-orange-950/40"><span class="text-foxOrange-400 font-bold">Умение: ${featName}</span> <p class="text-[10px] text-stone-400">${featDesc}</p></div>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

function selectBackground(b) {
  selectedBackground = b;
  wizardState.background = b.name;
  renderBackgrounds();
  updateSummary();
}

// ----------------------------------------------------
// НАВИГАЦИЯ ПО ШАГАМ (wizardStep1..5)
// ----------------------------------------------------
function goToStep(step) {
  if (step < 1 || step > 5) return;

  if (step > currentStep) {
    if (currentStep === 1 && !selectedRace) {
      alert("Выберите расу персонажа!");
      return;
    }
    if (currentStep === 2 && !selectedClass) {
      alert("Выберите класс персонажа!");
      return;
    }
    if (currentStep === 3 && Object.values(assignedStats).some(v => v === null)) {
      alert("Распределите все 6 характеристик!");
      return;
    }
  }

  for (let i = 1; i <= 5; i++) {
    const panel = document.getElementById(`wizardStep${i}`);
    const indicator = document.getElementById(`stepIndicator${i}`);
    if (panel) {
      if (i === step) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }
    if (indicator) {
      if (i === step) {
        indicator.className = "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-amber-400 text-stone-950 ring-2 ring-amber-300";
      } else if (i < step) {
        indicator.className = "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-stone-800 text-amber-400 border border-amber-500/50";
      } else {
        indicator.className = "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-[#140e0a] text-stone-500 border border-orange-950";
      }
    }
  }

  currentStep = step;
  const prevBtn = document.getElementById('btnPrevStep');
  const nextBtn = document.getElementById('btnNextStep');
  const submitBtn = document.getElementById('btnSubmitChar');

  if (prevBtn) prevBtn.classList.toggle('hidden', step === 1);
  if (nextBtn) {
    nextBtn.classList.toggle('hidden', step === 5);
    const stepNames = ['', 'Класс', 'Статы', 'Личность', 'Снаряжение'];
    if (step < 5) nextBtn.textContent = `Далее: ${stepNames[step]} →`;
  }
  if (submitBtn) submitBtn.classList.toggle('hidden', step !== 5);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() { goToStep(currentStep + 1); }
function prevStep() { goToStep(currentStep - 1); }

function updateSummary() {
  const nameInput = document.getElementById('charNameInput');
  if (nameInput) wizardState.name = nameInput.value.trim();

  const sumName = document.getElementById('summaryCharName');
  const sumRace = document.getElementById('summaryCharRace');
  const sumClass = document.getElementById('summaryCharClass');
  const sumBg = document.getElementById('summaryCharBackground');

  if (sumName) sumName.textContent = wizardState.name || "Безымянный герой";
  if (sumRace) sumRace.textContent = wizardState.race || "Не выбрана";
  if (sumClass) sumClass.textContent = wizardState.class_name ? `${wizardState.class_name} ${wizardState.subclass ? '(' + wizardState.subclass + ')' : ''}` : "Не выбран";
  if (sumBg) sumBg.textContent = wizardState.background || "Не выбрана";
}

// ----------------------------------------------------
// ФИНАЛЬНАЯ ОТПРАВКА НА СЕРВЕР
// ----------------------------------------------------
async function submitCharacter() {
  const charName = (document.getElementById('charNameInput')?.value || '').trim();
  if (!charName) {
    alert("Укажите имя персонажа!");
    goToStep(1);
    return;
  }
  if (!selectedRace) {
    alert("Выберите расу!");
    goToStep(1);
    return;
  }
  if (!selectedClass) {
    alert("Выберите класс!");
    goToStep(2);
    return;
  }

  const finalStats = { ...assignedStats };
  const bonuses = (selectedRace && selectedRace.ability_bonuses) ? selectedRace.ability_bonuses : {};
  for (const [k, v] of Object.entries(bonuses)) {
    if (finalStats[k] !== null && finalStats[k] !== undefined) {
      finalStats[k] += v;
    }
  }

  const hitDie = selectedClass.hit_die || selectedClass.hitDie || 8;
  const conMod = Math.floor(((finalStats.con || 10) - 10) / 2);
  const maxHp = Math.max(1, hitDie + conMod);

  const payload = {
    name: charName,
    race: selectedRace.name,
    class_name: selectedClass.name,
    subclass: wizardState.subclass || null,
    level: 1,
    max_hp: maxHp,
    current_hp: maxHp,
    speed: selectedRace.speed || 30,
    stats: finalStats,
    background: selectedBackground ? selectedBackground.name : "Обыватель",
    spells: wizardState.spells || []
  };

  const submitBtn = document.getElementById('btnSubmitChar');
  if (submitBtn) {
    submitBtn.textContent = "Создание персонажа...";
    submitBtn.disabled = true;
  }

  try {
    const res = await apiFetch('/characters/', {
      method: 'POST',
      body: payload
    });
    if (res.ok) {
      const char = await res.json();
      window.location.href = `/characters/${char.id}/sheet`;
    } else {
      const err = await res.json();
      alert(err.detail || "Ошибка при создании персонажа");
    }
  } catch (e) {
    alert("Сбой соединения с сервером: " + e.message);
  } finally {
    if (submitBtn) {
      submitBtn.textContent = "Завершить и перейти к листу";
      submitBtn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCompendiumData();
  setStatMode('standard');
});
