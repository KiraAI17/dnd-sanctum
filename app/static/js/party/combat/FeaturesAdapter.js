/**
 * FeaturesAdapter.js
 * Универсальный сборщик способностей с группировкой по категориям
 * и строгой фильтрацией классовых модулей (КО только тем, у кого этот класс).
 */
export class FeaturesAdapter {
  constructor(combatState, combatFx) {
    this.state = combatState;
    this.fx = combatFx;
    this.cachedFeatures = [];
    this.activeCategory = 'all';
  }

  collectFeatures(char) {
    if (!char) return [];
    const features = [];
    const charId = char.character_id || char.id;
    const cName = String(char.class_name || '').toLowerCase();
    const sub = String(char.subclass || '').toLowerCase();

    // 1. РАСОВЫЕ ОСОБЕННОСТИ
    let traits = Array.isArray(char.traits) ? char.traits : [];
    if (traits.length === 0 && window.partyData?.custom_races) {
      const charRace = (char.race || '').toLowerCase();
      const foundRace = window.partyData.custom_races.find(r => (r.name || '').toLowerCase() === charRace);
      if (foundRace && Array.isArray(foundRace.traits)) traits = foundRace.traits;
    }

    traits.forEach(t => {
      const desc = t.description || t.desc || '';
      const lower = desc.toLowerCase();
      const isPassive = lower.includes('не нужно спать') || lower.includes('не нуждаетесь в пище') || lower.includes('ваш возраст') || lower.includes('язык');
      const hasCombatEffect = /\d+/.test(desc) || lower.includes('спасбросок') || lower.includes('урон') || lower.includes('действие');

      if (!isPassive && hasCombatEffect) {
        features.push({
          name: t.name || 'Особенность',
          category: 'race',
          source: 'Раса',
          icon: t.name.includes('нырок') ? '🦊' : (t.name.includes('песнь') ? '❄️' : '✨'),
          cost: 'Расовое',
          desc: desc,
          actionType: 'generic_feature',
          meta: t
        });
      }
    });

    // 2. ЧЕРТЫ ИЗ БД (char.feats)
    const dbFeats = Array.isArray(char.feats) ? char.feats : [];
    dbFeats.forEach(f => {
      features.push({
        name: f.name || 'Способность',
        category: 'feats',
        source: 'Черта',
        icon: '⚡',
        cost: f.activation || f.cost || 'Действие',
        desc: f.description || f.desc || '',
        actionType: 'generic_feature',
        meta: f
      });
    });

    // 3. КЛАССОВЫЕ МОДУЛИ (ПОДКЛЮЧАЮТСЯ ТОЛЬКО ЕСЛИ ЭТО ТОТ КЛАСС)
    const isBloodHunter = cName.includes('охотник') || cName.includes('blood') || sub.includes('ликантроп') || sub.includes('мутант');
    if (isBloodHunter) {
      const activeRite = localStorage.getItem(`char_${charId}_bh_active_rite`);
      features.push({
        name: activeRite ? `Обряд: ${activeRite}` : "Активировать Алый обряд",
        category: 'class',
        source: 'Кл. КО',
        icon: "🩸",
        cost: "1 кость HP",
        desc: "Напитать оружие стихийным уроном за счёт здоровья до короткого отдыха.",
        actionType: 'custom_rite'
      });

      let knownCurses = [];
      try { knownCurses = JSON.parse(localStorage.getItem(`char_${charId}_known_curses`)) || []; } catch (e) {}
      knownCurses.forEach(curse => {
        features.push({
          name: `Проклятие: ${curse}`,
          category: 'class',
          source: 'Кл. КО',
          icon: "👁️",
          cost: "1 Кровь",
          desc: `Активировать проклятие крови «${curse}».`,
          actionType: 'custom_curse',
          param: curse
        });
      });

      const brandTarget = localStorage.getItem(`char_${charId}_bh_brand_target`);
      features.push({
        name: brandTarget ? `Клеймо: ${brandTarget}` : "Наложить Клеймо",
        category: 'class',
        source: 'Кл. КО',
        icon: "⚡",
        cost: "Атака",
        desc: "Выжечь клеймо наказания на теле противника.",
        actionType: 'custom_brand'
      });

      if (sub.includes('ликантроп')) {
        const isLycan = localStorage.getItem(`char_${charId}_lycan_active`) === 'true';
        features.push({
          name: isLycan ? "🐾 Форма зверя (Активна)" : "🐺 Принять форму зверя",
          category: 'class',
          source: 'Кл. КО',
          icon: "🐺",
          cost: "Бонусное",
          desc: "+1 к КД, сопротивление урону, атака когтями.",
          actionType: 'custom_form'
        });
      }
    }

    // 4. БАЗОВЫЕ ДЕЙСТВИЯ 5e
    features.push(
      { name: "Рывок", category: 'base', source: "Базовое", icon: "🏃", cost: "Действие", desc: "Удвоить скорость перемещения на текущий ход.", actionType: 'base_dash' },
      { name: "Уклонение", category: 'base', source: "Базовое", icon: "🛡️", cost: "Действие", desc: "Все броски атаки по вам совершаются с помехой до начала следующего хода.", actionType: 'base_dodge' },
      { name: "Первая помощь", category: 'base', source: "Базовое", icon: "🩹", cost: "Действие", desc: "Стабилизировать существо при 0 HP (проверка Медицины СЛ 10).", actionType: 'base_stabilize' }
    );

    this.cachedFeatures = features;
    return features;
  }

  renderFeaturesUI(container, char, onExecute, onInfo) {
    if (!container) return;
    const all = this.collectFeatures(char);

    const categories = [
      { id: 'all', label: 'Все' },
      { id: 'class', label: 'Класс' },
      { id: 'race', label: 'Раса' },
      { id: 'feats', label: 'Черты' },
      { id: 'base', label: 'Базовые' }
    ];

    const filterTabsHtml = `
      <div class="flex items-center gap-1 overflow-x-auto pb-1 mb-2 text-[10px] font-mono scrollbar-thin">
        ${categories.map(c => `
          <button type="button" class="btn-feat-cat px-2 py-0.5 rounded shrink-0 ${this.activeCategory === c.id ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-900 border border-stone-800 text-stone-400'}" data-cat="${c.id}">
            ${c.label}
          </button>
        `).join('')}
      </div>
    `;

    let filtered = all;
    if (this.activeCategory !== 'all') {
      filtered = all.filter(f => f.category === this.activeCategory);
    }

    const itemsHtml = filtered.map(f => {
      const idx = all.indexOf(f);
      return `
        <div class="flex items-center justify-between gap-1 p-1.5 rounded-xl bg-black/60 border border-orange-950 hover:border-amber-400 shadow transition-all">
          <button type="button" class="btn-feat-exec flex items-center gap-1.5 text-left truncate flex-1 active:scale-95 transition-transform" data-index="${idx}">
            <span class="text-sm shrink-0">${f.icon}</span>
            <div class="truncate">
              <div class="flex items-center gap-1 truncate">
                <strong class="text-xs text-stone-200 block truncate">${f.name}</strong>
                <span class="text-[8px] font-mono px-1 rounded bg-stone-900 border border-stone-800 text-stone-400">${f.source}</span>
              </div>
              <span class="text-[9px] text-stone-500 font-mono block">${f.cost}</span>
            </div>
          </button>
          <button type="button" class="btn-feat-info w-6 h-6 rounded bg-stone-900 border border-stone-800 hover:border-amber-400 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0 shadow" data-index="${idx}">
            ℹ️
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = filterTabsHtml + (itemsHtml || '<div class="text-stone-500 text-[11px] p-2 text-center col-span-full">Нет способностей в этой категории.</div>');

    container.querySelectorAll('.btn-feat-cat').forEach(btn => {
      btn.onclick = () => {
        this.activeCategory = btn.dataset.cat;
        this.renderFeaturesUI(container, char, onExecute, onInfo);
      };
    });

    container.querySelectorAll('.btn-feat-exec').forEach(btn => {
      btn.onclick = () => onExecute(parseInt(btn.dataset.index));
    });

    container.querySelectorAll('.btn-feat-info').forEach(btn => {
      btn.onclick = () => onInfo(all[parseInt(btn.dataset.index)]);
    });
  }

  async executeFeature(featureIndex, char) {
    const f = this.cachedFeatures[featureIndex];
    if (!f) return;

    const current = this.state.getCurrentCombatant();
    if (!current) return;
    const charId = char.character_id || char.id;

    switch (f.actionType) {
      // 1. РЫВОК: УДВАИВАЕТ РЕАЛЬНУЮ СКОРОСТЬ ГЕРОЯ
      case 'base_dash':
        if (this.state.useDash()) {
          this.broadcast(`🏃 «${current.name}» совершает Рывок (+${this.state.movement.maxFeet} фт скорости)!`);
        } else {
          alert("Действие уже потрачено или Рывок уже активирован!");
        }
        break;

      case 'base_dodge':
        if (this.state.spendAction()) {
          current.conditions = current.conditions || [];
          if (!current.conditions.includes('🛡️')) current.conditions.push('🛡️');
          this.broadcast(`🛡️ «${current.name}» встает в защитную стойку (Уклонение)!`);
        } else {
          alert("Действие уже потрачено в этом ходу!");
        }
        break;

      case 'base_stabilize':
        if (typeof window.stabilizeDownedHero === 'function') {
          window.stabilizeDownedHero();
        }
        break;

      case 'custom_form': {
        const isLycan = localStorage.getItem(`char_${charId}_lycan_active`) === 'true';
        if (isLycan) {
          localStorage.setItem(`char_${charId}_lycan_active`, 'false');
          current.temp_ac = Math.max(0, (current.temp_ac || 0) - 1);
          this.broadcast(`🐺 «${current.name}» выходит из формы зверя.`);
        } else {
          localStorage.setItem(`char_${charId}_lycan_active`, 'true');
          current.temp_ac = (current.temp_ac || 0) + 1;
          this.fx.triggerFx(current.token_id, 'slash');
          this.broadcast(`🐺 «${current.name}» принимает форму зверя (+1 КД)!`);
        }
        break;
      }

      // 2. КЛЕЙМО НАКАЗАНИЯ (СТРОГО ОДНА МЕТКА НА ВСЁ ПОЛЕ)
      case 'custom_brand': {
        const charId = char.character_id || char.id;
        const currentTargetName = localStorage.getItem(`char_${charId}_bh_brand_target`);

        // Снимаем метку с предыдущей цели на карте, если она была
        const allTokens = window.mapData?.tokens || [];
        allTokens.forEach(t => {
          if (t.conditions && t.conditions.includes('⚡')) {
            t.conditions = t.conditions.filter(c => c !== '⚡');
          }
        });

        if (currentTargetName) {
          const action = confirm(`Клеймо сейчас наложено на «${currentTargetName}».\n\n[ОК] — Перенести на новую цель\n[Отмена] — Полностью снять`);
          if (!action) {
            localStorage.removeItem(`char_${charId}_bh_brand_target`);
            await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: allTokens } });
            this.broadcast(`⚡ «${current.name}» рассеивает Клеймо наказания.`);
            if (typeof renderBattleMap === 'function') renderBattleMap();
            return;
          }
        }

        const validTargets = allTokens.filter(t => t.id !== current.token_id && !t.id.startsWith('hazard_'));
        let targetToken = validTargets.find(t => t.id === this.state.selectedTargetTokenId);

        if (!targetToken) {
          if (validTargets.length === 0) {
            alert("На поле нет противников!");
            return;
          }
          const options = validTargets.map((t, idx) => `${idx + 1}. ${t.name}`).join('\n');
          const choice = prompt(`Выберите цель для Клейма наказания:\n\n${options}`, "1");
          if (!choice) return;
          targetToken = validTargets[parseInt(choice) - 1];
        }

        if (!targetToken) return;

        // Вешаем ровно одну метку ⚡ на новую цель
        targetToken.conditions = targetToken.conditions || [];
        if (!targetToken.conditions.includes('⚡')) targetToken.conditions.push('⚡');
        await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: allTokens } });

        localStorage.setItem(`char_${charId}_bh_brand_target`, targetToken.name);
        this.fx.triggerFx(targetToken.id, 'fire');
        this.broadcast(`⚡ «${current.name}» выжигает Клеймо наказания на «${targetToken.name}»! Теперь цель получает урон при атаках.`);
        if (typeof renderBattleMap === 'function') renderBattleMap();
        break;
      }

      // 3. ПРОКЛЯТИЕ (БЬЁТ СТРОГО ПО МЕЧЕНОЙ ЦЕЛИ ИЛИ ТАРГЕТУ)
      case 'custom_curse': {
        const charId = char.character_id || char.id;
        const brandTargetName = localStorage.getItem(`char_${charId}_bh_brand_target`);
        const allTokens = window.mapData?.tokens || [];

        // Ищем цель: сначала по метке Клейма ⚡, затем по таргету клика, затем с 🎯
        let targetToken = allTokens.find(t => t.name === brandTargetName);
        if (!targetToken) {
          targetToken = allTokens.find(t => t.id === this.state.selectedTargetTokenId);
        }
        if (!targetToken) {
          targetToken = allTokens.find(t => (t.conditions || []).includes('🎯'));
        }

        if (!targetToken) {
          alert("Выберите цель или заклеймите противника перед использованием проклятия!");
          return;
        }

        // Проклятие наносит урон костью гемокрафта или активирует эффект
        const lvl = parseInt(char.level) || 1;
        const dieSides = lvl >= 17 ? 10 : (lvl >= 11 ? 8 : (lvl >= 5 ? 6 : 4));
        const dmgRoll = Math.floor(Math.random() * dieSides) + 1;

        window.activeHudTokenId = targetToken.id;
        await window.applyTokenDamageSilently(-dmgRoll);

        targetToken.conditions = targetToken.conditions || [];
        if (!targetToken.conditions.includes('🎯')) targetToken.conditions.push('🎯');
        await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: allTokens } });

        this.fx.triggerFx(targetToken.id, 'fire');
        this.fx.showDiceModal(`Проклятие: ${f.param}`, dmgRoll, 0, dmgRoll, `Урон меченой цели «${targetToken.name}»: ${dmgRoll} (1d${dieSides})`);
        this.broadcast(`👁️ «${current.name}» активирует «${f.param}» по «${targetToken.name}»! Нанесено ${dmgRoll} урона.`);
        if (typeof renderBattleMap === 'function') renderBattleMap();
        break;
      }

      case 'generic_feature':
      default: {
        const d20 = Math.floor(Math.random() * 20) + 1;
        this.fx.showDiceModal(`Способность: ${f.name}`, d20, 0, d20, f.desc);
        this.broadcast(`⚡ «${current.name}» применяет «${f.name}» (d20: ${d20}):\n${f.desc}`);
        break;
      }
    }
  }

  broadcast(text) {
    if (window.partySocket && window.partySocket.readyState === WebSocket.OPEN) {
      window.partySocket.send(JSON.stringify({ type: "chat_message", text }));
    }
  }
}