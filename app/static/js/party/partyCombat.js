// ==========================================
// COMBAT & ACTION SYSTEM (partyCombat.js)
// ==========================================

window.combatState = {
  is_active: false,
  round: 1,
  current_turn_index: 0,
  combatants: []
};

window.selectedTargetTokenId = null;
window.activeHudTokenId = null;
window.deathSaves = { successes: 0, failures: 0 };

// --- 1. ВЫБОР ЦЕЛИ И ОБНОВЛЕНИЕ ИНДИКАТОРОВ ---

window.selectTargetToken = function(tokenId) {
  if (window.selectedTargetTokenId === tokenId) {
    window.selectedTargetTokenId = null;
  } else {
    window.selectedTargetTokenId = tokenId;
  }
  window.updateTargetIndicators();
};

window.updateTargetIndicators = function() {
  document.querySelectorAll('[id^="token_"]').forEach(el => {
    el.classList.remove('ring-4', 'ring-rose-500', 'shadow-[0_0_20px_rgba(244,63,94,0.9)]');
  });

  const targetBox = document.getElementById('combatTargetIndicatorBox');
  const targetName = document.getElementById('combatTargetNameText');
  const targetHp = document.getElementById('combatTargetHpText');

  const tokens = (window.mapData && window.mapData.tokens) || [];

  if (window.selectedTargetTokenId) {
    const el = document.getElementById(`token_${window.selectedTargetTokenId}`);
    if (el) el.classList.add('ring-4', 'ring-rose-500', 'shadow-[0_0_20px_rgba(244,63,94,0.9)]');

    const tok = tokens.find(t => t.id === window.selectedTargetTokenId);
    if (tok && targetName && targetHp) {
      targetName.textContent = tok.name;
      targetHp.textContent = `(${tok.hp_current || 10}/${tok.hp_max || 10} HP)`;
      if (targetBox) targetBox.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-600 shadow";
    }
  } else {
    if (targetName) targetName.textContent = "Не выбрана (клик по токену)";
    if (targetHp) targetHp.textContent = "";
    if (targetBox) targetBox.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-orange-950";
  }
};

// --- 2. ИНИЦИАЛИЗАЦИЯ И РЕНДЕР БОЯ ---

window.initCombatState = async function() {
  try {
    const res = await apiFetch(`/parties/${partyId}/combat`);
    if (res.ok) {
      window.combatState = await res.json();
      window.renderCombatUI();
    }
  } catch (e) {
    console.error("Ошибка загрузки боя:", e);
  }
};

window.renderCombatUI = function() {
  const panel = document.getElementById('combatTrackerPanel');
  const btnStart = document.getElementById('btnStartCombat');
  const dmControls = document.getElementById('dmCombatControls');
  const ribbon = document.getElementById('combatantsRibbon');
  const isDm = partyData && partyData.is_current_user_dm;

  if (!panel || !ribbon) return;

  if (!window.combatState.is_active) {
    panel.classList.add('hidden');
    const bar = document.getElementById('combatActionBar');
    if (bar) bar.classList.add('hidden');
    if (btnStart) btnStart.classList.remove('hidden');
    document.querySelectorAll('[id^="token_"]').forEach(el => el.classList.remove('ring-4', 'ring-amber-400', 'animate-pulse'));
    return;
  }

  panel.classList.remove('hidden');
  if (btnStart) btnStart.classList.add('hidden');
  if (dmControls) dmControls.classList.toggle('hidden', !isDm);

  // Раунд
  const roundEl = document.getElementById('combatRoundDisplay');
  if (roundEl) roundEl.textContent = `Раунд ${window.combatState.round || 1}`;

  const currentCombatant = window.combatState.combatants[window.combatState.current_turn_index] || null;
  const descEl = document.getElementById('combatCurrentTurnDesc');
  if (descEl) {
    descEl.textContent = currentCombatant ? `Сейчас ходит: ${currentCombatant.name}` : 'Бой начался';
  }

  // Горизонтальная лента
  ribbon.innerHTML = window.combatState.combatants.map((c, idx) => {
    const isActive = idx === window.combatState.current_turn_index;
    const borderClass = isActive ? 'border-amber-400 bg-amber-950/60 shadow-lg scale-105 ring-2 ring-amber-400' : 'border-stone-800 bg-black/60 opacity-80';
    const initBadge = `<span onclick="editCombatantInitiative(event, '${c.token_id}')" title="Кликните для редактирования инициативы" class="px-1.5 py-0.5 rounded bg-black/80 font-mono font-bold text-amber-300 text-[10px] border border-orange-950 hover:border-amber-400 cursor-pointer">${c.initiative !== undefined ? c.initiative : 10}</span>`;
    const condHtml = (c.conditions || []).map(icon => `<span class="text-xs">${icon}</span>`).join('');

    return `
      <div onclick="focusTokenOnMap('${c.token_id}')" class="shrink-0 p-2 rounded-xl border ${borderClass} flex items-center gap-2 cursor-pointer transition-all select-none min-w-[130px]">
        <div class="w-8 h-8 rounded-lg overflow-hidden border border-amber-500/40 bg-stone-900 shrink-0">
          ${c.avatar_url ? `<img src="${c.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-xs">${c.name.slice(0, 2)}</div>`}
        </div>
        <div class="overflow-hidden">
          <strong class="text-xs text-stone-100 font-serif truncate block max-w-[80px]">${c.name}</strong>
          <div class="flex items-center gap-1.5 mt-0.5">
            ${initBadge}
            <div class="flex items-center gap-0.5">${condHtml}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Подсветка токена на поле
  window.highlightActiveTokenOnMap(currentCombatant);

  // Проверка очереди хода
  window.checkMyTurnAlert(currentCombatant);

  // Рендер консоли действий
  window.renderActiveCombatActions();
};

window.highlightActiveTokenOnMap = function(currentCombatant) {
  document.querySelectorAll('[id^="token_"]').forEach(el => {
    el.classList.remove('ring-4', 'ring-amber-400', 'animate-pulse');
  });

  if (currentCombatant && currentCombatant.token_id) {
    const el = document.getElementById(`token_${currentCombatant.token_id}`);
    if (el) {
      el.classList.add('ring-4', 'ring-amber-400', 'animate-pulse');
    }
  }
};

window.focusTokenOnMap = function(tokenId) {
  const el = document.getElementById(`token_${tokenId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
};

window.checkMyTurnAlert = function(currentCombatant) {
  if (!currentCombatant || !partyData || !partyData.my_character_id) return;
  if (currentCombatant.character_id === partyData.my_character_id) {
    const toast = document.getElementById('diceToast');
    if (toast) {
      const tIcon = document.getElementById('toastIcon');
      const tTitle = document.getElementById('toastTitle');
      const tBody = document.getElementById('toastBody');
      if (tIcon) tIcon.textContent = '⚔️';
      if (tTitle) tTitle.textContent = 'Твой ход!';
      if (tBody) tBody.textContent = 'Ваша очередь действовать в раунде!';
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 4000);
    }
  }
};

// --- 3. УПРАВЛЕНИЕ ХОДАМИ И БОЕМ (DM) ---

window.startCombat = async function() {
  // 1. Если mapData в памяти пуста или не загружена — подтягиваем прямо с бэкенда!
  let currentMap = window.mapData;
  if (!currentMap || !currentMap.tokens || currentMap.tokens.length === 0) {
    try {
      const mapRes = await apiFetch(`/parties/${partyId}/map`);
      if (mapRes.ok) {
        currentMap = await mapRes.json();
        window.mapData = currentMap;
      }
    } catch (e) {
      console.error("Ошибка загрузки карты перед боем:", e);
    }
  }

  let tokens = (currentMap && currentMap.tokens) ? currentMap.tokens : [];

  // 2. Если на карте действительно пусто — предлагаем в 1 клик высадить отряд
  if (tokens.length === 0) {
    const doDeploy = confirm("На поле боя пока нет фишек. Высадить весь отряд игроков на карту автоматически?");
    if (doDeploy && typeof window.deployPartySquadToMap === 'function') {
      await window.deployPartySquadToMap();
      currentMap = window.mapData;
      tokens = (currentMap && currentMap.tokens) ? currentMap.tokens : [];
    }
  }

  if (tokens.length === 0) {
    alert("На карте всё ещё нет токенов! Добавьте существо через «＋ Токен» или нажмите «🛡️ Отряд на поле».");
    return;
  }

  // 3. Собираем комбатантов
  const combatants = tokens.map(t => {
    let initValue = 0;
    if (t.character_id && window.partyData && window.partyData.members) {
      const member = window.partyData.members.find(m => m.character_id === t.character_id);
      let dexMod = 0;
      if (member && member.stats) {
        dexMod = Math.floor(((member.stats.dex || 10) - 10) / 2);
      }
      initValue = (Math.floor(Math.random() * 20) + 1) + dexMod;
    } else {
      initValue = (Math.floor(Math.random() * 20) + 1) + 1;
    }

    return {
      id: t.id,
      token_id: t.id,
      character_id: t.character_id || null,
      name: t.name,
      avatar_url: t.avatar_url || '',
      initiative: initValue,
      hp_current: t.hp_current !== undefined ? t.hp_current : (t.hp_max || 10),
      hp_max: t.hp_max || 10,
      conditions: t.conditions || []
    };
  });

  combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  window.combatState = {
    is_active: true,
    round: 1,
    current_turn_index: 0,
    combatants: combatants
  };

  try {
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: window.combatState
    });
  } catch (e) {
    console.error("Ошибка сохранения старта боя:", e);
  }

  window.renderCombatUI();
  if (typeof renderBattleMap === 'function') {
    renderBattleMap();
  }
};


window.nextCombatTurn = async function() {
  if (!window.combatState.is_active || window.combatState.combatants.length === 0) return;

  let nextIdx = window.combatState.current_turn_index + 1;
  let nextRound = window.combatState.round;

  if (nextIdx >= window.combatState.combatants.length) {
    nextIdx = 0;
    nextRound += 1;
  }

  window.combatState.current_turn_index = nextIdx;
  window.combatState.round = nextRound;

  await apiFetch(`/parties/${partyId}/combat`, {
    method: 'PATCH',
    body: {
      current_turn_index: nextIdx,
      round: nextRound
    }
  });

  window.renderCombatUI();
};

window.endCombat = async function() {
  if (!confirm("Завершить бой и сбросить инициативу?")) return;

  window.combatState = {
    is_active: false,
    round: 1,
    current_turn_index: 0,
    combatants: []
  };

  await apiFetch(`/parties/${partyId}/combat`, {
    method: 'PATCH',
    body: window.combatState
  });

  window.renderCombatUI();
};

window.rollAllNpcInitiative = async function() {
  window.combatState.combatants.forEach(c => {
    if (!c.character_id) {
      c.initiative = Math.floor(Math.random() * 20) + 1 + 1;
    }
  });

  window.combatState.combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  await apiFetch(`/parties/${partyId}/combat`, {
    method: 'PATCH',
    body: { combatants: window.combatState.combatants }
  });

  window.renderCombatUI();
};

window.editCombatantInitiative = async function(e, tokenId) {
  e.stopPropagation();
  const c = window.combatState.combatants.find(x => x.token_id === tokenId);
  if (!c) return;
  const val = prompt(`Введите значение инициативы для «${c.name}»:`, c.initiative || 10);
  if (val === null) return;
  const num = parseInt(val);
  if (!isNaN(num)) {
    c.initiative = num;
    window.combatState.combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: { combatants: window.combatState.combatants }
    });
    window.renderCombatUI();
  }
};

// --- 4. БОЕВАЯ КОНСОЛЬ ДЕЙСТВИЙ И АРСЕНАЛ ---

window.renderActiveCombatActions = async function() {
  const bar = document.getElementById('combatActionBar');
  if (!bar) return;

  if (!window.combatState.is_active || window.combatState.combatants.length === 0) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  const currentCombatant = window.combatState.combatants[window.combatState.current_turn_index];
  if (!currentCombatant) return;

  const isDm = partyData && partyData.is_current_user_dm;
  const isMyHeroTurn = partyData && partyData.my_character_id && currentCombatant.character_id === partyData.my_character_id;

  const playerPanel = document.getElementById('playerCombatActionsPanel');
  const monsterPanel = document.getElementById('monsterCombatActionsPanel');
  const deathPanel = document.getElementById('deathSavesPanel');

  const titleEl = document.getElementById('combatActorTitle');
  const subEl = document.getElementById('combatActorSubtitle');
  if (titleEl) titleEl.textContent = `Ход: ${currentCombatant.name}`;
  if (subEl) subEl.textContent = `Раунд ${window.combatState.round || 1} • Инициатива ${currentCombatant.initiative || 10}`;

  const isDown = (currentCombatant.hp_current || 0) <= 0;
  if (currentCombatant.character_id && isDown) {
    if (deathPanel) deathPanel.classList.remove('hidden');
    window.renderDeathSavesTrack(currentCombatant);
  } else {
    if (deathPanel) deathPanel.classList.add('hidden');
  }

  // Персонаж игрока
  if (currentCombatant.character_id && (isMyHeroTurn || isDm)) {
    if (playerPanel) playerPanel.classList.toggle('hidden', isDown);
    if (monsterPanel) monsterPanel.classList.add('hidden');
    if (!isDown) {
      await window.renderPlayerFullArsenal(currentCombatant);
    }
  } 
  // Монстр / НИП (для Мастера)
  else if (!currentCombatant.character_id && isDm) {
    if (playerPanel) playerPanel.classList.add('hidden');
    if (monsterPanel) monsterPanel.classList.remove('hidden');
    window.renderMonsterStatblock(currentCombatant);
  } else {
    if (playerPanel) playerPanel.classList.add('hidden');
    if (monsterPanel) monsterPanel.classList.add('hidden');
  }

  window.updateTargetIndicators();
};

window.renderPlayerFullArsenal = async function(combatant) {
  let char = myAttachedChar;
  if (!char || char.id !== combatant.character_id) {
    try {
      const res = await apiFetch(`/characters/${combatant.character_id}`);
      if (res.ok) char = await res.json();
    } catch (e) {}
  }

  if (!char) {
    char = {
      id: combatant.character_id,
      name: combatant.name,
      class_name: "Воин",
      level: 1,
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    };
  }

  const cName = String(char.class_name || '').toLowerCase().trim();
  const sub = String(char.subclass || '').toLowerCase().trim();
  const race = String(char.race || '').toLowerCase().trim();
  const lvl = parseInt(char.level) || 1;

  window.renderPlayerWeapons(char, combatant);
  window.renderClassSpecialFeatures(char, cName, sub, race, lvl);
  window.renderPlayerSpells(char, cName, sub, lvl);
};

window.renderPlayerWeapons = function(char, combatant) {
  const list = document.getElementById('playerWeaponActionsList');
  if (!list) return;

  const rawWeapons = localStorage.getItem(`char_${char.id}_weapons`);
  let weapons = [];
  try { weapons = JSON.parse(rawWeapons) || []; } catch (e) { weapons = []; }

  const stats = char.stats || { str: 10, dex: 10 };
  const strMod = Math.floor(((stats.str || 10) - 10) / 2);
  const dexMod = Math.floor(((stats.dex || 10) - 10) / 2);
  const prof = Math.floor(((char.level || 1) - 1) / 4) + 2;

  const bestMod = Math.max(strMod, dexMod);
  const atkStr = (prof + bestMod >= 0 ? '+' : '') + (prof + bestMod);
  const dmgModStr = (bestMod >= 0 ? '+' : '') + bestMod;

  if (!Array.isArray(weapons) || weapons.length === 0) {
    const cName = String(char.class_name || '').toLowerCase();
    if (cName.includes('монах') || cName.includes('monk')) {
      const monkDie = (char.level || 1) >= 17 ? '1d10' : ((char.level || 1) >= 11 ? '1d8' : ((char.level || 1) >= 5 ? '1d6' : '1d4'));
      weapons = [
        { name: "Безоружный удар монаха", atk: atkStr, dmg: `${monkDie}${dmgModStr}` },
        { name: "Короткий меч", atk: atkStr, dmg: `1d6${dmgModStr}` }
      ];
    } else if (cName.includes('плут') || cName.includes('rogue')) {
      weapons = [
        { name: "Рапира / Кинжал", atk: (prof + dexMod >= 0 ? '+' : '') + (prof + dexMod), dmg: `1d8${(dexMod >= 0 ? '+' : '') + dexMod}` },
        { name: "Короткий лук", atk: (prof + dexMod >= 0 ? '+' : '') + (prof + dexMod), dmg: `1d6${(dexMod >= 0 ? '+' : '') + dexMod}` }
      ];
    } else {
      weapons = [
        { name: "Основное оружие", atk: atkStr, dmg: `1d8${dmgModStr}` },
        { name: "Безоружный удар", atk: atkStr, dmg: `1d4${dmgModStr}` }
      ];
    }
  }

  list.innerHTML = weapons.map(w => {
    const wName = window.escapeHtml(w.name || 'Оружие');
    const wAtk = window.escapeHtml(w.atk || '+4');
    const wDmg = window.escapeHtml(w.dmg || '1d8+2');

    return `
      <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/60 border border-orange-950 hover:border-amber-400 shadow">
        <div>
          <strong class="text-amber-200 block text-xs">${wName}</strong>
          <span class="text-[10px] text-stone-400 font-mono">Атк: ${wAtk} • Урон: ${wDmg}</span>
        </div>
        <button type="button" onclick="executePlayerAttack('${wName}', '${wAtk}', '${wDmg}')" 
                class="px-2.5 py-1 rounded bg-gradient-to-r from-foxOrange-600 to-amber-500 text-stone-950 font-bold text-xs hover:brightness-110 active:scale-95 shadow">
          Атаковать 🎯
        </button>
      </div>
    `;
  }).join('');
};

window.renderClassSpecialFeatures = function(char, cName, sub, race, lvl) {
  const container = document.getElementById('playerClassFeaturesList');
  if (!container) return;

  const features = [];

  // Варвар
  if (cName.includes('варвар') || cName.includes('barbarian')) {
    features.push({
      name: "Впасть в Ярость",
      icon: "🪓",
      cost: "Бонусное",
      desc: "+2 к урону, полу-урон от оружия",
      funcName: "triggerBarbarianRage"
    });
    if (lvl >= 2) {
      features.push({
        name: "Безрассудная атака",
        icon: "⚡",
        cost: "В свой ход",
        desc: "Атаки Силой с преимуществом",
        funcName: "triggerRecklessAttack"
      });
    }
  }

  // Паладин
  if (cName.includes('паладин') || cName.includes('paladin')) {
    features.push({
      name: "Божественная кара (+2d8)",
      icon: "✨",
      cost: "1 ячейка",
      desc: "+2d8 излучением по цели",
      funcName: "triggerDivineSmite"
    });
    features.push({
      name: `Наложение рук (+${lvl * 5} HP)`,
      icon: "💚",
      cost: "Действие",
      desc: "Исцелить цель",
      funcName: "triggerLayOnHands"
    });
  }

  // Плут
  if (cName.includes('плут') || cName.includes('rogue')) {
    const sneakCount = Math.ceil(lvl / 2);
    features.push({
      name: `Скрытая атака (+${sneakCount}d6)`,
      icon: "🗡️",
      cost: "1/ход",
      desc: `Доп. урон +${sneakCount}d6`,
      funcName: "triggerSneakAttackDynamic"
    });
    if (lvl >= 2) {
      features.push({
        name: "Хитрое действие",
        icon: "💨",
        cost: "Бонусное",
        desc: "Рывок или Отход бонусным действием",
        funcName: "triggerCunningAction"
      });
    }
  }

  // Воин
  if (cName.includes('воин') || cName.includes('fighter')) {
    features.push({
      name: `Второе дыхание (1d10+${lvl})`,
      icon: "💨",
      cost: "Бонусное",
      desc: "Восстановить здоровье в бою",
      funcName: "triggerSecondWindCombat"
    });
    if (lvl >= 2) {
      features.push({
        name: "Всплеск действий",
        icon: "⚡",
        cost: "1/отдых",
        desc: "+1 действие в ход",
        funcName: "triggerActionSurge"
      });
    }
  }

  // Монах
  if (cName.includes('монах') || cName.includes('monk')) {
    features.push({
      name: "Шквал ударов (1 Ци)",
      icon: "🌪️",
      cost: "1 Ци",
      desc: "Два безоружных удара бонусным действием",
      funcName: "triggerMonkFlurry"
    });
    features.push({
      name: "Терпеливая оборона (1 Ци)",
      icon: "🛡️",
      cost: "1 Ци",
      desc: "Уклонение бонусным действием",
      funcName: "triggerMonkPatientDefense"
    });
    if (lvl >= 5) {
      features.push({
        name: "Ошеломляющий удар (1 Ци)",
        icon: "⚡",
        cost: "1 Ци",
        desc: "Спасбросок Телосложения или ошеломление",
        funcName: "triggerStunningStrike"
      });
    }

    const savedDisciplines = JSON.parse(localStorage.getItem(`char_${char.id}_monk_disciplines`) || '[]');
    savedDisciplines.forEach(d => {
      features.push({
        name: `${d.name} (${d.ki_cost} Ци)`,
        icon: "🥋",
        cost: `${d.ki_cost} Ци`,
        desc: d.description || '',
        funcName: "triggerMonkDisciplineAction"
      });
    });
  }

  // Бард
  if (cName.includes('бард') || cName.includes('bard')) {
    const bardDie = lvl >= 15 ? 'd12' : (lvl >= 10 ? 'd10' : (lvl >= 5 ? 'd8' : 'd6'));
    features.push({
      name: `Вдохновение барда (${bardDie})`,
      icon: "🪕",
      cost: "Бонусное",
      desc: `Дать кость ${bardDie} союзнику`,
      funcName: "triggerBardicInspiration"
    });
  }

  // Кровавый охотник
  if (cName.includes('охотник') || cName.includes('blood')) {
    features.push({
      name: "Алый обряд",
      icon: "🩸",
      cost: "1 кость HP",
      desc: "+1d4 стихийного урона к атакам",
      funcName: "triggerCrimsonRiteCombat"
    });
  }

  // Расовое дыхание
  if (race.includes('дракон') || race.includes('dragon')) {
    features.push({
      name: "Дыхание дракона",
      icon: "🐲",
      cost: "Действие",
      desc: "Конус 15 фт стихийного урона 2d6",
      funcName: "triggerDragonBreath"
    });
  }

  // Базовые действия для всех
  features.push(
    { name: "Рывок", icon: "🏃", cost: "Действие", desc: "Удвоить скорость", funcName: "triggerDashAction" },
    { name: "Уклонение", icon: "🛡️", cost: "Действие", desc: "Атаки по вам с помехой", funcName: "triggerDodgeAction" }
  );

  container.innerHTML = features.map(f => `
    <button type="button" onclick="window['${f.funcName}']('${window.escapeHtml(f.name)}')" 
            class="px-2.5 py-1.5 rounded-xl bg-black/60 border border-orange-950 hover:border-amber-400 flex items-center gap-1.5 text-stone-200 hover:text-amber-200 transition-all shadow group active:scale-95" 
            title="${window.escapeHtml(f.desc)}">
      <span class="text-sm">${f.icon}</span>
      <div class="text-left">
        <strong class="block text-xs leading-tight">${window.escapeHtml(f.name)}</strong>
        <span class="text-[9px] text-stone-400 font-mono block">${window.escapeHtml(f.cost)}</span>
      </div>
    </button>
  `).join('');
};

window.renderPlayerSpells = function(char, cName, sub, lvl) {
  const section = document.getElementById('playerSpellActionsSection');
  const list = document.getElementById('playerSpellActionsList');
  if (!section || !list) return;

  const isCaster = ['волшебник', 'колдун', 'жрец', 'бард', 'друид', 'чародей', 'паладин', 'следопыт', 'изобретатель', 'wizard', 'sorcerer', 'cleric', 'bard', 'druid', 'warlock', 'paladin', 'ranger'].some(k => cName.includes(k)) || 
                   sub.includes('мистический') || sub.includes('профан');

  if (!isCaster) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  const rawSpells = localStorage.getItem(`char_${char.id}_spells`);
  let spells = [];
  try { spells = JSON.parse(rawSpells) || []; } catch (e) { spells = []; }

  if (!Array.isArray(spells) || spells.length === 0) {
    if (cName.includes('жрец') || cName.includes('cleric')) {
      spells = [
        { name: "Священное пламя", level: 0, damage: "1d8", type: "излучение" },
        { name: "Направляющий луч", level: 1, damage: "4d6", type: "излучение" },
        { name: "Лечащее слово", level: 1, damage: "1d4+3", type: "хил" }
      ];
    } else {
      spells = [
        { name: "Огненный снаряд", level: 0, damage: "1d10", type: "огонь" },
        { name: "Волшебная стрела", level: 1, damage: "3d4+3", type: "силовое поле" },
        { name: "Щит (+5 КД)", level: 1, damage: null, type: "защита" }
      ];
    }
  }

  list.innerHTML = spells.map(sp => {
    const spName = window.escapeHtml(sp.name || 'Заклинание');
    const lvlText = sp.level === 0 ? "Заговор" : `${sp.level} круг`;
    const dmg = sp.damage ? ` • ${sp.damage}` : '';
    const dmgArg = sp.damage ? `'${sp.damage}'` : "''";

    return `
      <div class="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-black/60 border border-cyan-950 hover:border-cyan-400 shadow">
        <div>
          <strong class="text-cyan-200 block text-xs">${spName}</strong>
          <span class="text-[9px] text-stone-400 font-mono">${lvlText}${dmg}</span>
        </div>
        <button type="button" onclick="castPlayerSpell('${spName}', ${sp.level || 0}, ${dmgArg})" 
                class="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 hover:bg-cyan-900 text-cyan-200 font-bold text-xs shadow ml-1 active:scale-95">
          Каст ✨
        </button>
      </div>
    `;
  }).join('');
};

window.renderMonsterStatblock = function(combatant) {
  const attacksList = document.getElementById('monsterAttacksList');
  if (!attacksList) return;

  let npcData = null;
  if (typeof dmNpcsList !== 'undefined') {
    npcData = dmNpcsList.find(n => n.name === combatant.name);
  }

  const acEl = document.getElementById('monsterAcDisplay');
  const hpEl = document.getElementById('monsterHpDisplay');
  const spEl = document.getElementById('monsterSpeedDisplay');

  if (acEl) acEl.textContent = npcData?.armor_class || 12;
  if (hpEl) hpEl.textContent = `${combatant.hp_current || 15} / ${combatant.hp_max || 15}`;
  if (spEl) spEl.textContent = `${npcData?.speed || 30} фт`;

  const attacks = [
    { name: "Удар оружием / когтями", atk: "+4", dmg: "1d6+2" },
    { name: "Укус / мощный выпад", atk: "+4", dmg: "1d8+2" }
  ];

  attacksList.innerHTML = attacks.map(a => `
    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/60 border border-rose-950 hover:border-rose-500 shadow">
      <div>
        <strong class="text-rose-200 block text-xs">${window.escapeHtml(a.name)}</strong>
        <span class="text-[10px] text-stone-400 font-mono">Атк: ${a.atk} • Урон: ${a.dmg}</span>
      </div>
      <button type="button" onclick="executeMonsterAttack('${window.escapeHtml(combatant.name)}', '${window.escapeHtml(a.name)}', '${a.atk}', '${a.dmg}')" 
              class="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-stone-100 font-bold text-xs active:scale-95 shadow ml-2">
        Удар по цели 🎯
      </button>
    </div>
  `).join('');
};

// --- 5. СПАСБРОСКИ ОТ СМЕРТИ ---

window.renderDeathSavesTrack = function(combatant) {
  const charKey = `char_${combatant.character_id}_death_saves`;
  window.deathSaves = JSON.parse(localStorage.getItem(charKey) || '{"successes":0,"failures":0}');

  for (let i = 1; i <= 3; i++) {
    const sEl = document.getElementById(`dSuccess_${i}`);
    if (sEl) {
      sEl.className = i <= window.deathSaves.successes 
        ? "w-4 h-4 rounded-full border border-emerald-500 bg-emerald-500 text-stone-950 font-bold flex items-center justify-center text-[10px]" 
        : "w-4 h-4 rounded-full border border-emerald-500 bg-transparent flex items-center justify-center text-[10px]";
      sEl.textContent = i <= window.deathSaves.successes ? "✓" : "";
    }

    const fEl = document.getElementById(`dFailure_${i}`);
    if (fEl) {
      fEl.className = i <= window.deathSaves.failures 
        ? "w-4 h-4 rounded-full border border-rose-500 bg-rose-500 text-stone-950 font-bold flex items-center justify-center text-[10px]" 
        : "w-4 h-4 rounded-full border border-rose-500 bg-transparent flex items-center justify-center text-[10px]";
      fEl.textContent = i <= window.deathSaves.failures ? "✕" : "";
    }
  }
};

window.rollDeathSave = async function() {
  const currentCombatant = window.combatState.combatants[window.combatState.current_turn_index];
  if (!currentCombatant || !currentCombatant.character_id) return;

  const d20 = Math.floor(Math.random() * 20) + 1;
  let msg = `💀 Спасбросок от смерти «${currentCombatant.name}»: d20(${d20}) ➔ `;

  if (d20 === 20) {
    window.deathSaves = { successes: 0, failures: 0 };
    currentCombatant.hp_current = 1;
    msg += "🔥 НАТУРАЛЬНАЯ 20! Персонаж поднимается на ноги с 1 HP!";
    alert(msg);
    window.activeHudTokenId = currentCombatant.token_id;
    await window.applyTokenDamage(1);
  } else if (d20 >= 10) {
    window.deathSaves.successes += 1;
    msg += `УСПЕХ (${window.deathSaves.successes}/3)`;
    if (window.deathSaves.successes >= 3) {
      msg += " 🎉 Персонаж стабилизирован!";
      alert(msg);
    }
  } else if (d20 === 1) {
    window.deathSaves.failures += 2;
    msg += `КРИТИЧЕСКИЙ ПРОВАЛ (1)! Получено 2 провала (${window.deathSaves.failures}/3)!`;
  } else {
    window.deathSaves.failures += 1;
    msg += `ПРОВАЛ (${window.deathSaves.failures}/3)`;
  }

  if (window.deathSaves.failures >= 3) {
    msg += " 💀 ПЕРСОНАЖ ПОГИБ!";
    alert(msg);
    currentCombatant.conditions = currentCombatant.conditions || [];
    if (!currentCombatant.conditions.includes('💀')) currentCombatant.conditions.push('💀');
  }

  const charKey = `char_${currentCombatant.character_id}_death_saves`;
  localStorage.setItem(charKey, JSON.stringify(window.deathSaves));
  window.renderDeathSavesTrack(currentCombatant);

  window.broadcastFeatureUse(msg);
};

// --- 6. ИСПОЛНЕНИЕ АТАК И УРОНА ---

window.executePlayerAttack = async function(weaponName, atkBonusStr, dmgFormula) {
  if (!window.selectedTargetTokenId) {
    alert("Сначала выберите цель: кликните по токену врага на карте!");
    return;
  }

  const tokens = (window.mapData && window.mapData.tokens) || [];
  const target = tokens.find(t => t.id === window.selectedTargetTokenId);
  if (!target) return;

  const atkBonus = parseInt(atkBonusStr) || 0;
  const d20 = Math.floor(Math.random() * 20) + 1;
  const totalAtk = d20 + atkBonus;
  const isCrit = d20 === 20;

  const dmgResult = window.rollDiceFormula(dmgFormula, isCrit);

  const currentCombatant = window.combatState.combatants[window.combatState.current_turn_index];
  const attackerName = currentCombatant ? currentCombatant.name : 'Герой';

  let resultMsg = `⚔️ ${attackerName} атакует «${target.name}» [${weaponName}]:\n🎲 Атака: d20(${d20}) + ${atkBonus} = ${totalAtk}`;
  if (isCrit) resultMsg += ` 🔥 КРИТ!`;
  resultMsg += `\n💥 Урон: ${dmgResult.total} (${dmgResult.text})`;

  window.activeHudTokenId = window.selectedTargetTokenId;
  await window.applyTokenDamage(-dmgResult.total);

  alert(resultMsg);
  window.broadcastFeatureUse(resultMsg);
};

window.executeMonsterAttack = async function(monsterName, attackName, atkBonusStr, dmgFormula) {
  if (!window.selectedTargetTokenId) {
    alert("Выберите персонажа игрока кликом по его токену!");
    return;
  }

  const tokens = (window.mapData && window.mapData.tokens) || [];
  const target = tokens.find(t => t.id === window.selectedTargetTokenId);
  if (!target) return;

  const atkBonus = parseInt(atkBonusStr) || 0;
  const d20 = Math.floor(Math.random() * 20) + 1;
  const totalAtk = d20 + atkBonus;
  const isCrit = d20 === 20;
  const dmgResult = window.rollDiceFormula(dmgFormula, isCrit);

  let resultMsg = `👹 ${monsterName} проводит «${attackName}» по «${target.name}»:\n🎲 Атака: d20(${d20}) + ${atkBonus} = ${totalAtk}\n💥 Урон: ${dmgResult.total} (${dmgResult.text})`;

  window.activeHudTokenId = window.selectedTargetTokenId;
  await window.applyTokenDamage(-dmgResult.total);

  alert(resultMsg);
  window.broadcastFeatureUse(resultMsg);
};

window.castPlayerSpell = async function(spellName, circle, damageFormula) {
  if (!window.selectedTargetTokenId && damageFormula) {
    alert("Выберите цель на карте кликом по токену!");
    return;
  }

  const tokens = (window.mapData && window.mapData.tokens) || [];
  const target = tokens.find(t => t.id === window.selectedTargetTokenId);
  let msg = `✨ Сотворение заклинания «${spellName}» (${circle === 0 ? 'Заговор' : circle + ' круг'})!`;

  if (damageFormula && target) {
    const dmgResult = window.rollDiceFormula(damageFormula, false);
    msg += `\n💥 Урон по «${target.name}»: ${dmgResult.total} (${dmgResult.text})`;
    window.activeHudTokenId = window.selectedTargetTokenId;
    await window.applyTokenDamage(-dmgResult.total);
  }

  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.rollDiceFormula = function(formula, isCrit = false) {
  const match = String(formula).match(/(\d+)d(\d+)([\+\-]\d+)?/i);
  if (!match) return { total: 4, text: "4" };

  let count = parseInt(match[1]) || 1;
  if (isCrit) count *= 2;
  const sides = parseInt(match[2]) || 6;
  const mod = match[3] ? parseInt(match[3]) : 0;

  let rolls = [];
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  const total = Math.max(1, sum + mod);
  return {
    total,
    text: `[${rolls.join('+')}] ${mod >= 0 ? '+' + mod : mod}`
  };
};

// --- 7. КЛАССОВЫЕ ХЕНДЛЕРЫ ДЛЯ ИНЛАЙНОВЫХ КНОПОК ---

window.broadcastFeatureUse = function(text) {
  if (window.partySocket && window.partySocket.readyState === WebSocket.OPEN) {
    window.partySocket.send(JSON.stringify({ type: "chat_message", text }));
  }
};

window.triggerBarbarianRage = async function() {
  await window.toggleTokenCondition('🔥');
  window.broadcastFeatureUse("🪓 Варвар впадает в ЯРОСТЬ! Получено сопротивление немагическому оружию и +2 к броскам урона Силой.");
};

window.triggerRecklessAttack = function() {
  window.broadcastFeatureUse("⚡ Безрассудная атака: атаки Силой в этом ходу с преимуществом!");
};

window.triggerDivineSmite = async function() {
  if (!window.selectedTargetTokenId) {
    alert("Сначала выберите цель на карте кликом по токену врага!");
    return;
  }
  const target = (window.mapData.tokens || []).find(t => t.id === window.selectedTargetTokenId);
  const dmgResult = window.rollDiceFormula('2d8', false);
  const msg = `✨ БОЖЕСТВЕННАЯ КАРА по «${target ? target.name : 'врагу'}»: +${dmgResult.total} урона излучением (${dmgResult.text})!`;
  window.activeHudTokenId = window.selectedTargetTokenId;
  await window.applyTokenDamage(-dmgResult.total);
  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.triggerLayOnHands = async function() {
  const amtStr = prompt("Сколько HP передать из пула Наложения рук?", "5");
  if (!amtStr) return;
  const amt = parseInt(amtStr);
  if (isNaN(amt) || amt <= 0) return;

  if (window.selectedTargetTokenId) {
    window.activeHudTokenId = window.selectedTargetTokenId;
    await window.applyTokenDamage(amt);
  } else if (myAttachedChar && typeof adjustHeroHp === 'function') {
    await adjustHeroHp(amt);
  }
  window.broadcastFeatureUse(`💚 Наложение рук: восстановлено +${amt} HP!`);
};

window.triggerSneakAttackDynamic = async function() {
  if (!window.selectedTargetTokenId) {
    alert("Сначала выберите цель на карте кликом по токену врага!");
    return;
  }
  const target = (window.mapData.tokens || []).find(t => t.id === window.selectedTargetTokenId);
  const lvl = myAttachedChar ? (myAttachedChar.level || 1) : 1;
  const count = Math.ceil(lvl / 2);
  const dmgResult = window.rollDiceFormula(`${count}d6`, false);

  const msg = `🗡️ СКРЫТАЯ АТАКА по «${target ? target.name : 'врагу'}»: +${dmgResult.total} колющего урона (${dmgResult.text})!`;
  window.activeHudTokenId = window.selectedTargetTokenId;
  await window.applyTokenDamage(-dmgResult.total);
  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.triggerCunningAction = function() {
  window.broadcastFeatureUse("💨 Хитрое действие: Плут совершает Отход / Рывок бонусным действием!");
};

window.triggerSecondWindCombat = async function() {
  const lvl = myAttachedChar ? (myAttachedChar.level || 1) : 1;
  const roll = Math.floor(Math.random() * 10) + 1;
  const total = roll + lvl;
  if (myAttachedChar && typeof adjustHeroHp === 'function') {
    await adjustHeroHp(total);
  }
  const msg = `💨 Второе дыхание Воина: 1d10(${roll}) + ${lvl} = +${total} HP восстановлено!`;
  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.triggerActionSurge = function() {
  window.broadcastFeatureUse("⚡ Всплеск действий: получено ещё одно полноценное действие в свой ход!");
};

window.triggerMonkFlurry = function() {
  window.broadcastFeatureUse("🌪️ Шквал ударов: потрачено 1 очко Ци на два безоружных удара бонусным действием!");
};

window.triggerMonkPatientDefense = async function() {
  await window.toggleTokenCondition('🛡️');
  window.broadcastFeatureUse("🛡️ Терпеливая оборона: потрачено 1 Ци, персонаж в Уклонении!");
};

window.triggerStunningStrike = async function() {
  if (!window.selectedTargetTokenId) {
    alert("Выберите цель для Ошеломляющего удара!");
    return;
  }
  const target = (window.mapData.tokens || []).find(t => t.id === window.selectedTargetTokenId);
  window.activeHudTokenId = window.selectedTargetTokenId;
  await window.toggleTokenCondition('⚡');
  const msg = `⚡ Ошеломляющий удар: «${target ? target.name : 'враг'}» проходит спасбросок Телосложения или становится ОШЕЛОМЛЁННЫМ!`;
  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.triggerBardicInspiration = function() {
  window.broadcastFeatureUse("🪕 Вдохновение барда: союзник наделён костью вдохновения!");
};

window.triggerCrimsonRiteCombat = function() {
  window.broadcastFeatureUse("🩸 Алый обряд: оружие напитано магией крови (+1d4 стихийного урона)!");
};

window.triggerDragonBreath = async function() {
  const dmgResult = window.rollDiceFormula('2d6', false);
  const msg = `🐲 Оружие дыхания дракона: волна пламени наносит ${dmgResult.total} урона (${dmgResult.text}) в конусе 15 фт!`;
  alert(msg);
  window.broadcastFeatureUse(msg);
};

window.triggerDashAction = function() {
  window.broadcastFeatureUse("🏃 Действие: Рывок (скорость перемещения удваивается)!");
};

window.triggerDodgeAction = async function() {
  await window.toggleTokenCondition('🛡️');
  window.broadcastFeatureUse("🛡️ Действие: Уклонение (атаки по персонажу идут с помехой)!");
};

window.triggerMonkDisciplineAction = function(name) {
  window.broadcastFeatureUse(`🥋 Активирована монашеская практика: «${name}»!`);
};

// Хелпер экранирования строк
window.escapeHtml = function(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- 8. КОНТЕКСТНЫЙ ХУД ТОКЕНА (УРОН И СОСТОЯНИЯ) ---

window.openTokenHud = function(e, tokenId) {
  e.stopPropagation();
  window.activeHudTokenId = tokenId;
  const hud = document.getElementById('tokenActionHud');
  const tokens = (window.mapData && window.mapData.tokens) || [];
  const token = tokens.find(t => t.id === tokenId);
  if (!hud || !token) return;

  const nameEl = document.getElementById('hudTokenName');
  const hpEl = document.getElementById('hudTokenHp');
  if (nameEl) nameEl.textContent = token.name;
  const cur = token.hp_current !== undefined ? token.hp_current : 10;
  const max = token.hp_max || 10;
  if (hpEl) hpEl.textContent = `${cur} / ${max}`;

  hud.style.left = `${Math.min(window.innerWidth - 260, e.clientX + 10)}px`;
  hud.style.top = `${Math.min(window.innerHeight - 250, e.clientY + 10)}px`;
  hud.classList.remove('hidden');
};

window.closeTokenHud = function() {
  document.getElementById('tokenActionHud')?.classList.add('hidden');
  window.activeHudTokenId = null;
};

window.applyTokenDamage = async function(delta) {
  if (!window.activeHudTokenId || !window.mapData) return;
  const token = (window.mapData.tokens || []).find(t => t.id === window.activeHudTokenId);
  if (!token) return;

  const maxHp = token.hp_max || 10;
  const curHp = token.hp_current !== undefined ? token.hp_current : maxHp;
  const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
  token.hp_current = newHp;

  if (newHp === 0 && !token.conditions?.includes('💀')) {
    token.conditions = token.conditions || [];
    token.conditions.push('💀');
  } else if (newHp > 0 && token.conditions?.includes('💀')) {
    token.conditions = token.conditions.filter(c => c !== '💀');
  }

  await apiFetch(`/parties/${partyId}/map`, {
    method: 'PATCH',
    body: { tokens: window.mapData.tokens }
  });

  const combatant = window.combatState.combatants.find(c => c.token_id === window.activeHudTokenId);
  if (combatant) {
    combatant.hp_current = newHp;
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: { combatants: window.combatState.combatants }
    });
  }

  const hpEl = document.getElementById('hudTokenHp');
  if (hpEl) hpEl.textContent = `${newHp} / ${maxHp}`;
  if (typeof renderBattleMap === 'function') renderBattleMap();
  window.renderCombatUI();
};

window.toggleTokenCondition = async function(conditionIcon) {
  if (!window.activeHudTokenId || !window.mapData) return;
  const token = (window.mapData.tokens || []).find(t => t.id === window.activeHudTokenId);
  if (!token) return;

  token.conditions = token.conditions || [];
  if (token.conditions.includes(conditionIcon)) {
    token.conditions = token.conditions.filter(c => c !== conditionIcon);
  } else {
    token.conditions.push(conditionIcon);
  }

  await apiFetch(`/parties/${partyId}/map`, {
    method: 'PATCH',
    body: { tokens: window.mapData.tokens }
  });

  const combatant = window.combatState.combatants.find(c => c.token_id === window.activeHudTokenId);
  if (combatant) {
    combatant.conditions = token.conditions;
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: { combatants: window.combatState.combatants }
    });
  }

  if (typeof renderBattleMap === 'function') renderBattleMap();
  window.renderCombatUI();
};

