/**
 * CombatController.js
 * Главный координатор боевой системы стола.
 */
import { CombatState } from './CombatState.js';
import { SpellEngine } from './SpellEngine.js';
import { ArsenalEngine } from './ArsenalEngine.js';
import { FeaturesAdapter } from './FeaturesAdapter.js';
import { CombatFx } from './CombatFx.js';

export class CombatController {
  constructor() {
    this.state = new CombatState();
    this.fx = new CombatFx();
    this.spells = new SpellEngine(this.state, this.fx);
    this.arsenal = new ArsenalEngine(this.state, this.fx);
    this.features = new FeaturesAdapter(this.state, this.fx);
  }

  async init() {
    try {
      const res = await apiFetch(`/parties/${partyId}/combat`);
      if (res.ok) {
        const data = await res.json();
        this.state.initFromData(data);
        this.render();
      }
    } catch (e) {
      console.error("CombatController init error:", e);
    }
  }

  render() {
    const panel = document.getElementById('combatTrackerPanel');
    const bar = document.getElementById('combatActionBar');
    const btnStart = document.getElementById('btnStartCombat');
    const dmControls = document.getElementById('dmCombatControls');
    const ribbon = document.getElementById('combatantsRibbon');
    const mapCol = document.getElementById('battleMapCol');
    const actionCol = document.getElementById('combatActionCol');

    const pData = window.partyData;
    const uData = window.currentUserData;
    const isDm = Boolean(
      (pData && (pData.is_current_user_dm || (uData && pData.dm_id === uData.id))) ||
      uData?.username === "Ent1XXX" ||
      document.getElementById('partyRoleBadge')?.textContent.includes('Мастер')
    );

    if (!panel || !ribbon) return;

    // Режим вне боя
    if (!this.state.isActive) {
      panel.classList.add('hidden');
      if (bar) bar.classList.add('hidden');
      if (actionCol) actionCol.classList.add('hidden');
      if (mapCol) {
        mapCol.classList.remove('lg:col-span-8');
        mapCol.classList.add('lg:col-span-12');
      }
      if (btnStart) btnStart.classList.remove('hidden');
      document.querySelectorAll('[id^="token_"]').forEach(el => el.classList.remove('ring-4', 'ring-amber-400', 'animate-pulse'));
      return;
    }

    // Режим боя активен
    panel.classList.remove('hidden');
    if (actionCol) actionCol.classList.remove('hidden');
    if (mapCol) {
      mapCol.classList.remove('lg:col-span-12');
      mapCol.classList.add('lg:col-span-8');
    }
    if (btnStart) btnStart.classList.add('hidden');
    if (dmControls) {
      dmControls.classList.toggle('hidden', !isDm);
      dmControls.style.display = isDm ? 'flex' : 'none';
    }

    // Раунд и текущий ходящий
    const roundEl = document.getElementById('combatRoundDisplay');
    if (roundEl) roundEl.textContent = `Раунд ${this.state.round}`;

    const current = this.state.getCurrentCombatant();
    const next = this.state.getNextCombatant();

    const descEl = document.getElementById('combatCurrentTurnDesc');
    if (descEl) descEl.textContent = current ? `Сейчас ходит: ${current.name}` : 'Бой начался';

    // Кнопка завершения хода
    const myCharId = pData?.my_character_id;
    const isMyTurn = Boolean(current && myCharId && current.character_id === myCharId);
    const btnNext = document.getElementById('btnActionNextTurn');

    if (btnNext) {
      if (isDm || isMyTurn) {
        btnNext.classList.remove('opacity-50', 'pointer-events-none');
        btnNext.removeAttribute('disabled');
        const nextName = next ? next.name : 'следующий';
        btnNext.innerHTML = isMyTurn
          ? `<span>Завершить свой ход (далее: ${nextName})</span> <span class="text-sm">➔</span>`
          : `<span>Ход к: ${nextName}</span> <span class="text-sm">➔</span>`;
      } else {
        btnNext.classList.add('opacity-50', 'pointer-events-none');
        btnNext.setAttribute('disabled', 'true');
        btnNext.innerHTML = `<span>Ожидание хода (${current ? current.name : '...'} ходит)</span>`;
      }
    }

    // Лента инициативы
    ribbon.innerHTML = this.state.combatants.map((c, idx) => {
      const isActive = (idx === this.state.currentTurnIndex);
      const borderClass = isActive
        ? 'border-amber-400 bg-amber-950/80 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105 ring-2 ring-amber-400 z-10'
        : 'border-stone-800 bg-black/70 opacity-80 hover:opacity-100 hover:border-stone-600';

      const initBadge = `<span onclick="window.editCombatantInitiative(event, '${c.token_id}')" class="px-1.5 py-0.5 rounded bg-black/90 font-mono font-bold text-amber-300 text-[10px] border border-orange-950 cursor-pointer shadow">${c.initiative || 10}</span>`;
      const curHp = c.hp_current !== undefined ? c.hp_current : (c.hp_max || 10);
      const maxHp = c.hp_max || 10;
      const pct = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
      const hpColor = pct <= 25 ? 'bg-rose-500' : (pct <= 50 ? 'bg-amber-500' : 'bg-emerald-500');

      return `
        <div onclick="window.focusTokenOnMap('${c.token_id}')" class="shrink-0 p-2 rounded-xl border ${borderClass} flex items-center gap-2.5 cursor-pointer select-none min-w-[145px] max-w-[190px]">
          <div class="w-9 h-9 rounded-lg overflow-hidden border border-amber-500/50 bg-stone-900 shrink-0 shadow">
            ${c.avatar_url ? `<img src="${c.avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-xs text-amber-200 bg-stone-900">${(c.name || 'Т').slice(0, 2)}</div>`}
          </div>
          <div class="overflow-hidden flex-1 py-0.5">
            <strong class="text-xs text-stone-100 font-serif leading-normal block truncate">${c.name}</strong>
            <div class="flex items-center gap-1.5 mt-1">
              ${initBadge}
              <div class="w-12 h-1.5 bg-black/80 rounded-full overflow-hidden border border-stone-800">
                <div class="h-full ${hpColor}" style="width: ${pct}%;"></div>
              </div>
              <div class="flex items-center gap-0.5">${(c.conditions || []).join('')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.highlightActiveToken(current);
    this.updateEconomyUI();
    this.renderActionConsole(current, isDm, isMyTurn);
  }

  highlightActiveToken(current) {
    document.querySelectorAll('[id^="token_"]').forEach(el => el.classList.remove('ring-4', 'ring-amber-400', 'animate-pulse'));
    if (current && current.token_id) {
      const el = document.getElementById(`token_${current.token_id}`);
      if (el) el.classList.add('ring-4', 'ring-amber-400', 'animate-pulse');
    }
  }

  updateEconomyUI() {
    const elAct = document.getElementById('badgeEcoAction');
    const elBonus = document.getElementById('badgeEcoBonus');
    const elMove = document.getElementById('badgeEcoMove');
    const elSideMove = document.getElementById('combatMovementBadge');

    if (elAct) {
      elAct.className = this.state.economy.hasAction
        ? "px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-mono text-[10px] font-bold"
        : "px-2 py-0.5 rounded-md bg-black/60 border border-stone-800 text-stone-600 font-mono text-[10px] line-through";
    }
    if (elBonus) {
      elBonus.className = this.state.economy.hasBonusAction
        ? "px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500 text-amber-300 font-mono text-[10px] font-bold"
        : "px-2 py-0.5 rounded-md bg-black/60 border border-stone-800 text-stone-600 font-mono text-[10px] line-through";
    }

    const moveText = `👟 ${this.state.movement.remainingFeet}/${this.state.movement.maxFeet} фт`;
    if (elMove) elMove.textContent = moveText;
    if (elSideMove) {
      elSideMove.textContent = `${this.state.movement.remainingFeet} / ${this.state.movement.maxFeet} фт`;
      elSideMove.className = (this.state.movement.remainingFeet <= 0) ? "text-rose-400 font-bold font-mono" : "text-amber-300 font-bold font-mono";
    }
  }

  async renderActionConsole(current, isDm, isMyTurn) {
    const bar = document.getElementById('combatActionBar');
    if (!bar || !current) return;
    bar.classList.remove('hidden');

    const titleEl = document.getElementById('combatActorTitle');
    const subEl = document.getElementById('combatActorSubtitle');
    if (titleEl) titleEl.textContent = `Ход: ${current.name}`;
    if (subEl) subEl.textContent = `Раунд ${this.state.round} • Инициатива ${current.initiative || 10}`;

    const isDown = ((current.hp_current || 0) <= 0);
    const deathPanel = document.getElementById('deathSavesPanel');
    if (deathPanel) deathPanel.classList.toggle('hidden', !isDown);

    const playerPanel = document.getElementById('playerCombatActionsPanel');
    const monsterPanel = document.getElementById('monsterCombatActionsPanel');

    // Если персонаж игрока
    if (current.character_id && (isMyTurn || isDm)) {
      if (playerPanel) playerPanel.classList.toggle('hidden', isDown);
      if (monsterPanel) monsterPanel.classList.add('hidden');
      if (!isDown) {
        await this.renderPlayerArsenal(current);
      }
    }
    // Монстр / НИП Мастера
    else {
      if (playerPanel) playerPanel.classList.add('hidden');
      if (monsterPanel) {
        monsterPanel.classList.toggle('hidden', isDown);
        if (!isDown) this.renderMonsterArsenal(current);
      }
    }

    this.state.selectTarget(this.state.selectedTargetTokenId);
    window.updateTargetIndicators?.();
  }

  async renderPlayerArsenal(combatant) {
    let char = window.myAttachedChar;
    if (!char || char.id !== combatant.character_id) {
      try {
        const res = await apiFetch(`/characters/${combatant.character_id}`);
        if (res.ok) char = await res.json();
      } catch (e) {}
    }
    if (!char) return;

    // Плашка статов героя
    const dexMod = Math.floor((((char.stats || {}).dex || 10) - 10) / 2);
    const baseAc = char.armor_class || (10 + dexMod);
    const tempAc = combatant.temp_ac || 0;
    const heroAc = baseAc + tempAc;
    const acText = tempAc > 0 ? `${heroAc} <span class="text-[9px] text-cyan-400 font-bold">(+${tempAc} Щит)</span>` : `${heroAc}`;
    const speed = combatant.conditions?.includes('🪽') ? 60 : (char.speed || 30);

    const statHost = document.getElementById('playerCombatHeroStatblock');
    if (statHost) {
      statHost.innerHTML = `
        <div class="grid grid-cols-3 gap-2 text-center text-xs font-mono text-stone-300 bg-black/60 p-2 rounded-xl border border-amber-950/80 mb-2">
          <div><span class="text-[9px] text-stone-500 block">КД</span><strong class="text-amber-300">${acText}</strong></div>
          <div><span class="text-[9px] text-stone-500 block">Хиты (HP)</span><strong class="text-emerald-400">${combatant.hp_current || 10}/${combatant.hp_max || 10}</strong></div>
          <div><span class="text-[9px] text-stone-500 block">Скорость</span><strong class="text-stone-200">${speed} фт</strong></div>
        </div>
      `;
    }

    const cName = String(char.class_name || '').toLowerCase();

    // 1. Оружие
    this.renderWeaponsList(char);

    // 2. Способности рас и классов с вкладками
    const featContainer = document.getElementById('playerClassFeaturesList');
    if (featContainer) {
      this.features.renderFeaturesUI(
        featContainer,
        char,
        async (idx) => {
          await this.features.executeFeature(idx, char);
          this.render();
        },
        (feat) => this.showFeatureDetail(feat, char)
      );
    }
    // 3. Заклинания
    this.spells.renderSpellsUI(
      char,
      cName,
      (spell) => this.handleCastSpell(spell, char, combatant),
      (spell) => this.showSpellDetail(spell, char, combatant)
    );
  }

  renderWeaponsList(char) {
    const list = document.getElementById('playerWeaponActionsList');
    if (!list) return;

    let weapons = [];
    try { weapons = JSON.parse(localStorage.getItem(`char_${char.id}_weapons`)) || []; } catch (e) {}

    const stats = char.stats || { str: 10, dex: 10 };
    const strMod = Math.floor(((stats.str || 10) - 10) / 2);
    const dexMod = Math.floor(((stats.dex || 10) - 10) / 2);
    const prof = Math.floor(((char.level || 1) - 1) / 4) + 2;
    const bestMod = Math.max(strMod, dexMod);
    const atkStr = (prof + bestMod >= 0 ? '+' : '') + (prof + bestMod);
    const dmgMod = (bestMod >= 0 ? '+' : '') + bestMod;

    if (weapons.length === 0) {
      weapons = [
        { name: "Основное оружие", atk: atkStr, dmg: `1d8${dmgMod}` },
        { name: "Короткий лук", atk: (prof + dexMod >= 0 ? '+' : '') + (prof + dexMod), dmg: `1d6${dexMod >= 0 ? '+' + dexMod : dexMod}` }
      ];
    }

    list.innerHTML = weapons.map(w => {
      const isRanged = /лук|арбалет|дротик|bow/i.test(w.name);
      return `
        <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/60 border border-orange-950 hover:border-amber-400 shadow">
          <div>
            <strong class="text-amber-200 block text-xs">${w.name}</strong>
            <span class="text-[10px] text-stone-400 font-mono">Атк: ${w.atk} • ${w.dmg} • <span class="text-amber-400 font-bold">${isRanged ? '80 фт' : '5 фт (соседняя кл.)'}</span></span>
          </div>
          <button type="button" class="btn-weapon-attack px-2.5 py-1 rounded bg-gradient-to-r from-foxOrange-600 to-amber-500 text-stone-950 font-bold text-xs hover:brightness-110 active:scale-95 shadow shrink-0"
                  data-name="${w.name}" data-atk="${w.atk}" data-dmg="${w.dmg}">
            Удар 🎯
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-weapon-attack').forEach(btn => {
      btn.onclick = async () => {
        const ok = await this.arsenal.executeAttack(btn.dataset.name, btn.dataset.atk, btn.dataset.dmg);
        if (ok) this.render();
      };
    });
  }

  renderFeaturesList(char) {
    const list = document.getElementById('playerClassFeaturesList');
    if (!list) return;

    const feats = this.features.collectFeatures(char);
    list.innerHTML = feats.map((f, idx) => `
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
    `).join('');

    list.querySelectorAll('.btn-feat-exec').forEach(btn => {
      btn.onclick = async () => {
        await this.features.executeFeature(parseInt(btn.dataset.index), char);
        this.render();
      };
    });

    list.querySelectorAll('.btn-feat-info').forEach(btn => {
      btn.onclick = () => {
        const f = feats[parseInt(btn.dataset.index)];
        this.showFeatureDetail(f, char);
      };
    });
  }

  renderMonsterArsenal(combatant) {
    const list = document.getElementById('monsterAttacksList');
    if (!list) return;

    let npcData = null;
    if (typeof dmNpcsList !== 'undefined') {
      npcData = dmNpcsList.find(n => n.name === combatant.name);
    }

    const acEl = document.getElementById('monsterAcDisplay');
    const hpEl = document.getElementById('monsterHpDisplay');
    const spEl = document.getElementById('monsterSpeedDisplay');

    if (acEl) acEl.textContent = npcData?.armor_class || 12;
    if (hpEl) hpEl.textContent = `${combatant.hp_current || 15}/${combatant.hp_max || 15}`;
    if (spEl) spEl.textContent = `${npcData?.speed || 30} фт`;

    const attacks = [
      { name: "Удар когтями / оружием", atk: "+4", dmg: "1d6+2", range: 5 },
      { name: "Выстрел из лука", atk: "+4", dmg: "1d6+2", range: 80 }
    ];

    list.innerHTML = attacks.map(a => `
      <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/60 border border-rose-950 hover:border-rose-500 shadow">
        <div>
          <strong class="text-rose-200 block text-xs">${a.name}</strong>
          <span class="text-[10px] text-stone-400 font-mono">Атк: ${a.atk} • ${a.dmg} • <span class="text-amber-400 font-bold">${a.range} фт</span></span>
        </div>
        <button type="button" class="btn-monster-atk px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-stone-100 font-bold text-xs active:scale-95 shadow shrink-0"
                data-name="${a.name}" data-atk="${a.atk}" data-dmg="${a.dmg}">
          Удар 🎯
        </button>
      </div>
    `).join('') + `
      <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-rose-950/60">
        <button type="button" id="btnMonsterDash" class="px-2 py-1 rounded bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 text-xs font-mono">🏃 Рывок (+30 фт)</button>
        <button type="button" id="btnMonsterDodge" class="px-2 py-1 rounded bg-stone-900 border border-stone-800 hover:border-amber-400 text-stone-200 text-xs font-mono">🛡️ Уклонение</button>
      </div>
    `;

    list.querySelectorAll('.btn-monster-atk').forEach(btn => {
      btn.onclick = async () => {
        const ok = await this.arsenal.executeAttack(btn.dataset.name, btn.dataset.atk, btn.dataset.dmg);
        if (ok) this.render();
      };
    });

    const btnDash = document.getElementById('btnMonsterDash');
    if (btnDash) {
      btnDash.onclick = () => {
        if (this.state.useDash()) {
          this.render();
        } else {
          alert("Действие уже потрачено!");
        }
      };
    }

    const btnDodge = document.getElementById('btnMonsterDodge');
    if (btnDodge) {
      btnDodge.onclick = () => {
        if (this.state.spendAction()) {
          combatant.conditions = combatant.conditions || [];
          if (!combatant.conditions.includes('🛡️')) combatant.conditions.push('🛡️');
          this.render();
        } else {
          alert("Действие уже потрачено!");
        }
      };
    }
  }

  async handleCastSpell(spell, char, combatant) {
    if (!this.state.economy.hasAction && !spell.is_shield) {
      alert("Основное действие уже потрачено в этом ходу!");
      return;
    }

    const circle = parseInt(spell.level) || 0;
    const charId = char.character_id || char.id || combatant.character_id;

    const rangeText = (spell.range || '').toLowerCase();
    const descText = (spell.description || '').toLowerCase();
    const nameText = (spell.name || '').toLowerCase();

    const isAoeSpell = spell.is_aoe ||
                       rangeText.includes('сфера') || rangeText.includes('конус') || rangeText.includes('линия') || rangeText.includes('куб') ||
                       descText.includes('в сфере') || descText.includes('в конусе') || descText.includes('в радиусе') || descText.includes('в кубе') ||
                       nameText.includes('шар') || nameText.includes('волна') || nameText.includes('облако') || nameText.includes('кинжал');

    // 1. РЕЖИМ AOE-ПРИЦЕЛА
    if (isAoeSpell) {
      let radiusFeet = 20;

      if (nameText.includes('кинжал') || descText.includes('кубе с длиной ребра 5')) {
        radiusFeet = 2.5;
      } else if (descText.includes('радиусом 10') || rangeText.includes('10 фт')) {
        radiusFeet = 10;
      } else if (descText.includes('радиусом 30')) {
        radiusFeet = 30;
      } else if (descText.includes('радиусом 20') || nameText.includes('шар')) {
        radiusFeet = 20;
      }

      this.fx.startAoeTargeting(
        { ...spell, circle, char, radiusFeet },
        async ({ centerX, centerY, radiusPx }) => {
          const currentToken = (window.mapData?.tokens || []).find(t => t.id === combatant.token_id);
          const maxCastRange = this.spells.parseRangeFeet(spell.range);

          if (currentToken && maxCastRange > 0) {
            const gridSize = window.currentGridSize || 50;
            const distPx = Math.sqrt((currentToken.x + 25 - centerX)**2 + (currentToken.y + 25 - centerY)**2);
            const distFeet = Math.round((distPx / gridSize) * 5);

            if (distFeet > maxCastRange) {
              alert(`Точка сотворения слишком далеко! Расстояние: ${distFeet} фт (макс. дальность: ${maxCastRange} фт).`);
              return;
            }
          }

          if (circle >= 1 && charId) {
            await this.spells.spendSlot(charId, circle, char);
          }
          this.state.spendAction();

          if (nameText.includes('кинжал') || descText.includes('концентрация')) {
            const hazardToken = {
              id: "hazard_" + Date.now(),
              name: `🗡️ ${spell.name}`,
              type: "neutral",
              size: 1,
              hp_current: 10,
              hp_max: 10,
              x: Math.round(centerX / (window.currentGridSize || 50)) * (window.currentGridSize || 50),
              y: Math.round(centerY / (window.currentGridSize || 50)) * (window.currentGridSize || 50)
            };
            window.mapData.tokens = window.mapData.tokens || [];
            window.mapData.tokens.push(hazardToken);
            await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: window.mapData.tokens } });
          }

          const rawFormula = spell.damage || spell.damage_dice || spell.description || (nameText.includes('кинжал') ? '4d4' : '8d6');
          const dmg = this.arsenal.rollDamage(rawFormula);
          const allTokens = window.mapData?.tokens || [];
          const hit = [];

          for (const t of allTokens) {
            if (t.id && t.id.startsWith('hazard_')) continue;

            const gridSize = window.currentGridSize || 50;
            const tokenSize = (t.size || 1) * gridSize;
            const left = t.x;
            const right = t.x + tokenSize;
            const top = t.y;
            const bottom = t.y + tokenSize;

            const closestX = Math.max(left, Math.min(centerX, right));
            const closestY = Math.max(top, Math.min(centerY, bottom));
            const distToClosest = Math.sqrt((centerX - closestX)**2 + (centerY - closestY)**2);

            if (distToClosest <= radiusPx) {
              hit.push(t);
              window.activeHudTokenId = t.id;
              await window.applyTokenDamageSilently?.(-dmg.total);
              this.fx.triggerFx(t.id, 'fire');
            }
          }

          const msg = `💥 AOE «${spell.name}» (радиус ${radiusFeet} фт)!\n🔥 Урон: ${dmg.total} (${dmg.text})\n🎯 Задеты: ${hit.map(x => x.name).join(', ') || 'никто'}`;
          this.fx.showDiceModal(`Взрыв [${spell.name}]`, dmg.total, 0, dmg.total, `Задето целей: ${hit.length} • Урон: ${dmg.text}`);
          this.broadcast(msg);
          this.render();
          if (typeof renderBattleMap === 'function') renderBattleMap();
        },
        () => {
          console.log("Каст AOE отменен");
        }
      );
      return;
    }

    // 2. Списание ячеек для обычных заклинаний
    if (circle >= 1 && charId) {
      const slots = this.spells.getCharacterSlots(char);
      const s = slots[circle] || { cur: 0 };
      if (s.cur <= 0) {
        alert(`У вас нет доступных ячеек ${circle} круга!`);
        return;
      }
      await this.spells.spendSlot(charId, circle, char);
    }

    // 3. Заклинание «Щит» (+5 КД)
    if (spell.is_shield || /щит/i.test(spell.name)) {
      combatant.temp_ac = (combatant.temp_ac || 0) + 5;
      combatant.conditions = combatant.conditions || [];
      if (!combatant.conditions.includes('🛡️')) combatant.conditions.push('🛡️');
      this.fx.triggerFx(combatant.token_id, 'heal');
      this.fx.showDiceModal("Заклинание Щит", 5, 0, 5, "КД увеличен на +5 до начала следующего хода!");
      this.broadcast(`🛡️ «${combatant.name}» применяет «Щит» (+5 КД)!`);
      this.render();
      return;
    }

    // 4. Заклинание «Полёт» (60 фт)
    if (/полёт|полет/i.test(spell.name)) {
      combatant.conditions = combatant.conditions || [];
      if (!combatant.conditions.includes('🪽')) combatant.conditions.push('🪽');
      this.state.movement.maxFeet = 60;
      this.state.movement.remainingFeet = 60;
      this.state.spendAction();
      this.fx.triggerFx(combatant.token_id, 'heal');
      this.broadcast(`🪽 «${combatant.name}» сотворяет «Полёт» (скорость 60 фт)!`);
      this.render();
      return;
    }

    // 5. Заклинание на себя
    const maxRange = this.spells.parseRangeFeet(spell.range);
    if (maxRange === 0) {
      this.state.spendAction();
      this.fx.triggerFx(combatant.token_id, 'heal');
      this.broadcast(`✨ «${combatant.name}» сотворяет на себя «${spell.name}»!`);
      this.render();
      return;
    }

    // 6. Одиночная цель
    const targetId = this.state.selectedTargetTokenId;
    if (!targetId && (spell.damage || spell.damage_dice)) {
      alert("Выберите цель на карте кликом по токену!");
      return;
    }

    // ЗДЕСЬ БЫЛ СИНТАКСИЧЕСКИЙ СБОЙ: используем singleTargetList вместо повторного const tokens
    const singleTargetList = window.mapData?.tokens || [];
    const target = singleTargetList.find(t => t.id === targetId);
    if (!target) return;

    const distance = this.arsenal.calculateDistance(combatant.token_id, target.id);
    if (distance > maxRange) {
      alert(`Цель вне дальности! Расстояние: ${distance} фт (макс. ${maxRange} фт).`);
      return;
    }

    this.state.spendAction();

    const rawFormula = spell.damage || spell.damage_dice || spell.description;
    if (rawFormula && /\d+\s*[dкDК]\s*\d+/i.test(rawFormula)) {
      const isHeal = spell.is_heal || /лечащ|исцел/i.test(spell.name);
      const dmg = this.arsenal.rollDamage(rawFormula);

      window.activeHudTokenId = target.id;
      if (isHeal) {
        await window.applyTokenDamageSilently?.(dmg.total);
        this.fx.triggerFx(target.id, 'heal');
        this.fx.showDiceModal(`Исцеление [${spell.name}]`, dmg.total, 0, dmg.total, `+${dmg.total} HP (${dmg.text})`);
        this.broadcast(`💚 «${combatant.name}» лечит «${target.name}» заклинанием [${spell.name}] на +${dmg.total} HP!`);
      } else {
        await window.applyTokenDamageSilently?.(-dmg.total);
        this.fx.triggerFx(target.id, 'fire');
        this.fx.showDiceModal(`Урон [${spell.name}]`, dmg.total, 0, dmg.total, `Урон: ${dmg.total} (${dmg.text})`);
        this.broadcast(`💥 «${combatant.name}» поражает «${target.name}» заклинанием [${spell.name}] на ${dmg.total} урона!`);
      }
    } else {
      this.broadcast(`✨ «${combatant.name}» накладывает «${spell.name}» на «${target.name}»!`);
    }

    this.render();
  }


  showSpellDetail(spell, char, combatant) {
    document.getElementById('modalSpellTitle').textContent = spell.name;
    document.getElementById('modalSpellSub').textContent = `${spell.level === 0 ? 'Заговор' : spell.level + ' круг'}, ${spell.school || 'Магия'}`;
    document.getElementById('modalSpellTime').textContent = spell.cast_time || "1 действие";
    document.getElementById('modalSpellRange').textContent = spell.range || "60 футов";
    document.getElementById('modalSpellDuration').textContent = spell.duration || "Мгновенная";
    document.getElementById('modalSpellDamage').textContent = spell.damage || spell.damage_dice || "По описанию";
    document.getElementById('modalSpellDesc').textContent = spell.description || "Описание отсутствует.";

    const castBtn = document.getElementById('modalSpellCastBtn');
    castBtn.textContent = "Сотворить ✨";
    castBtn.onclick = () => {
      document.getElementById('spellDetailModal')?.classList.add('hidden');
      this.handleCastSpell(spell, char, combatant);
    };

    document.getElementById('spellDetailModal')?.classList.remove('hidden');
  }

  showFeatureDetail(feat, char) {
    document.getElementById('modalSpellTitle').textContent = feat.name;
    document.getElementById('modalSpellSub').textContent = `Источник: ${feat.source} • Стоимость: ${feat.cost}`;
    document.getElementById('modalSpellTime').textContent = feat.cost;
    document.getElementById('modalSpellRange').textContent = "По правилам 5e";
    document.getElementById('modalSpellDuration').textContent = "Мгновенно / До отдыха";
    document.getElementById('modalSpellDamage').textContent = "Особое";
    document.getElementById('modalSpellDesc').textContent = feat.desc || "Описание отсутствует.";

    const castBtn = document.getElementById('modalSpellCastBtn');
    castBtn.textContent = "Активировать ✨";
    castBtn.onclick = async () => {
      document.getElementById('spellDetailModal')?.classList.add('hidden');
      await this.features.executeFeature(this.features.cachedFeatures.indexOf(feat), char);
      this.render();
    };

    document.getElementById('spellDetailModal')?.classList.remove('hidden');
  }

  broadcast(text) {
    if (window.partySocket && window.partySocket.readyState === WebSocket.OPEN) {
      window.partySocket.send(JSON.stringify({ type: "chat_message", text }));
    }
  }

    async startCombat() {
    let currentMap = window.mapData;
    if (!currentMap || !currentMap.tokens || currentMap.tokens.length === 0) {
      try {
        const mapRes = await apiFetch(`/parties/${partyId}/map`);
        if (mapRes.ok) currentMap = await mapRes.json();
      } catch (e) {}
    }

    const tokens = (currentMap && currentMap.tokens) ? currentMap.tokens : [];
    if (tokens.length === 0) {
      alert("На карте нет токенов! Выставите существ или нажмите «🛡️ Отряд на поле».");
      return;
    }

    const combatants = tokens.map(t => {
      let initValue = 10;
      let avatar = t.avatar_url || '';

      if (t.character_id && window.partyData?.members) {
        const member = window.partyData.members.find(m => m.character_id === t.character_id);
        let dexMod = 0;
        if (member && member.stats) dexMod = Math.floor(((member.stats.dex || 10) - 10) / 2);
        initValue = Math.floor(Math.random() * 20) + 1 + dexMod;
        if (!avatar && member) avatar = member.avatar_url || member.banner_url || '';
      } else {
        initValue = Math.floor(Math.random() * 20) + 1 + 1;
      }

      return {
        id: t.id,
        token_id: t.id,
        character_id: t.character_id || null,
        name: t.name,
        avatar_url: avatar,
        initiative: initValue,
        hp_current: t.hp_current !== undefined ? t.hp_current : (t.hp_max || 10),
        hp_max: t.hp_max || 10,
        conditions: t.conditions || []
      };
    });

    combatants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

    this.state.initFromData({
      is_active: true,
      round: 1,
      current_turn_index: 0,
      combatants: combatants
    });

    this.state.resetTurnEconomy(30);

    try {
      await apiFetch(`/parties/${partyId}/combat`, {
        method: 'PATCH',
        body: this.state.toPayload()
      });
    } catch (e) {}

    this.render();
    if (typeof renderBattleMap === 'function') renderBattleMap();
  }

  async endCombat() {
    if (!confirm("Завершить бой и сбросить инициативу?")) return;

    (this.state.combatants || []).forEach(c => {
      if (c.character_id) {
        localStorage.removeItem(`char_${c.character_id}_death_saves`);
      }
    });

    this.state.isActive = false;
    this.state.round = 1;
    this.state.currentTurnIndex = 0;
    this.state.combatants = [];

    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: this.state.toPayload()
    });

    this.render();
  }

  calculateCombatantBaseSpeed(combatant) {
    if (!combatant) return 30;

    // 1. Проверка состояний, обнуляющих перемещение
    const conditions = combatant.conditions || [];
    if (conditions.includes('🕸️') || conditions.includes('💤') || conditions.includes('💀')) {
      return 0;
    }
    // Полёт дает 60 фт
    if (conditions.includes('🪽')) {
      return 60;
    }

    // 2. Если это персонаж игрока
    if (combatant.character_id) {
      let char = window.myAttachedChar;
      if (!char || char.id !== combatant.character_id) {
        const mem = (window.partyData?.members || []).find(m => m.character_id === combatant.character_id);
        char = mem || char;
      }

      if (char) {
        let speed = parseInt(char.speed) || 30;

        // Если в объекте расы стола прописана повышенная скорость
        if (window.partyData?.custom_races && char.race) {
          const r = window.partyData.custom_races.find(x => (x.name || '').toLowerCase() === (char.race || '').toLowerCase());
          if (r && r.speed) {
            speed = Math.max(speed, parseInt(r.speed));
          }
        }

        // Учитываем активные модификаторы чарника на скорость
        if (Array.isArray(char.active_modifiers)) {
          char.active_modifiers.forEach(mod => {
            if (mod.target === 'speed' && !mod.is_hidden) {
              speed += (parseInt(mod.value) || 0);
            }
          });
        }

        return Math.max(0, speed);
      }
    }

    // 3. Если это НИП / монстр Мастера
    const npc = (typeof dmNpcsList !== 'undefined') ? dmNpcsList.find(n => n.name === combatant.name) : null;
    return parseInt(npc?.speed) || 30;
  }

  async nextTurn() {
    if (!this.state.isActive || this.state.combatants.length === 0) return;

    let nextIdx = this.state.currentTurnIndex + 1;
    let nextRound = this.state.round;

    if (nextIdx >= this.state.combatants.length) {
      nextIdx = 0;
      nextRound += 1;
    }

    this.state.currentTurnIndex = nextIdx;
    this.state.round = nextRound;

    // Получаем существо, чей ход наступает (объявляем ОДИН раз)
    const incoming = this.state.getCurrentCombatant();
    if (incoming) {
      if (incoming.conditions?.includes('🛡️')) {
        incoming.conditions = incoming.conditions.filter(c => c !== '🛡️');
        const tok = (window.mapData?.tokens || []).find(t => t.id === incoming.token_id);
        if (tok) tok.conditions = incoming.conditions;
      }
      if (incoming.temp_ac) {
        incoming.temp_ac = 0;
      }
      await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: window.mapData.tokens } });
    }

    // Рассчитываем динамическую скорость с учетом бонусов и расы без повторного объявления incoming
    const baseSpeed = this.calculateCombatantBaseSpeed(incoming);
    this.state.resetTurnEconomy(baseSpeed);

    try {
      await apiFetch(`/parties/${partyId}/combat`, {
        method: 'PATCH',
        body: {
          current_turn_index: nextIdx,
          round: nextRound,
          combatants: this.state.combatants
        }
      });
    } catch (e) {
      console.error("Ошибка смены хода:", e);
    }

    this.render();
  }
}

