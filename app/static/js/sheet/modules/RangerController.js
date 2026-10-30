import { DndRules } from '../rules/DndRules.js';

export class RangerController {
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
    const wisMod = DndRules.calcMod(stats.wis || 10);
    const prof = DndRules.getProficiencyBonus(lvl);
    const saveDc = 8 + prof + wisMod;

    // 1. Базовые показатели
    const dcEl = document.getElementById('rangerSpellDcDisplay');
    const wisEl = document.getElementById('rangerWisModDisplay');
    if (dcEl) dcEl.textContent = saveDc;
    if (wisEl) wisEl.textContent = DndRules.formatMod(wisMod);

    // 2. Отображение умений по уровням
    const primevalCard = document.getElementById('rangerPrimevalCard');
    if (primevalCard) primevalCard.classList.toggle('hidden', lvl < 3);

    const landStrideCard = document.getElementById('rangerLandStrideCard');
    if (landStrideCard) landStrideCard.classList.toggle('hidden', lvl < 8);

    const hideSightCard = document.getElementById('rangerHidePlainSightCard');
    if (hideSightCard) hideSightCard.classList.toggle('hidden', lvl < 10);

    const vanishCard = document.getElementById('rangerVanishCard');
    if (vanishCard) vanishCard.classList.toggle('hidden', lvl < 14);

    const feralCard = document.getElementById('rangerFeralSensesCard');
    if (feralCard) feralCard.classList.toggle('hidden', lvl < 18);

    const foeSlayerCard = document.getElementById('rangerFoeSlayerCard');
    if (foeSlayerCard) foeSlayerCard.classList.toggle('hidden', lvl < 20);

    // 3. Подклассовые секции
    this.renderArchetypePanels(char, lvl, sub, saveDc, wisMod, prof);
  }

  renderArchetypePanels(char, lvl, sub, saveDc, wisMod, prof) {
    // 1. Охотник (Hunter)
    const hunterPanel = document.getElementById('rangerHunterPanel');
    if (hunterPanel) {
      const isHunter = sub.includes('охотник') && !sub.includes('сумрачный');
      hunterPanel.classList.toggle('hidden', !isHunter);
      if (isHunter) {
        document.getElementById('hunterDefTacticsBlock')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('hunterMultiattackBlock')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('hunterDefense15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 2. Повелитель зверей (Beast Master)
    const beastPanel = document.getElementById('rangerBeastMasterPanel');
    if (beastPanel) {
      const isBeast = sub.includes('звер') || sub.includes('beast');
      beastPanel.classList.toggle('hidden', !isBeast);
      if (isBeast) {
        const beastHp = Math.max(12, lvl * 4);
        const curHp = localStorage.getItem(`char_${char.id}_beast_hp`) || beastHp;
        const hpEl = document.getElementById('rangerBeastHpDisplay');
        if (hpEl) hpEl.textContent = `${curHp} / ${beastHp}`;
        document.getElementById('beastTraining7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('beastFury11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('beastShareSpells15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 3. Странник горизонта (Horizon Walker)
    const horizonPanel = document.getElementById('rangerHorizonWalkerPanel');
    if (horizonPanel) {
      const isHorizon = sub.includes('горизонт') || sub.includes('horizon');
      horizonPanel.classList.toggle('hidden', !isHorizon);
      if (isHorizon) {
        const planarDice = lvl >= 11 ? "2d8" : "1d8";
        const planarEl = document.getElementById('horizonPlanarDiceDisplay');
        if (planarEl) planarEl.textContent = planarDice;
        document.getElementById('horizonEthereal7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('horizonDistant11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('horizonSpectral15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 4. Сумрачный охотник (Gloom Stalker)
    const gloomPanel = document.getElementById('rangerGloomStalkerPanel');
    if (gloomPanel) {
      const isGloom = sub.includes('сумрачн') || sub.includes('gloom');
      gloomPanel.classList.toggle('hidden', !isGloom);
      if (isGloom) {
        document.getElementById('gloomIronMind7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('gloomFlurry11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('gloomDodge15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 5. Убийца чудовищ (Monster Slayer)
    const monsterPanel = document.getElementById('rangerMonsterSlayerPanel');
    if (monsterPanel) {
      const isMonster = sub.includes('чудовищ') || sub.includes('monster');
      monsterPanel.classList.toggle('hidden', !isMonster);
      if (isMonster) {
        const maxSense = Math.max(1, wisMod);
        const usedSense = parseInt(localStorage.getItem(`char_${char.id}_hunter_sense_used`) || '0');
        const senseEl = document.getElementById('monsterSenseTracker');
        if (senseEl) senseEl.textContent = `${Math.max(0, maxSense - usedSense)} / ${maxSense}`;

        const preyTarget = localStorage.getItem(`char_${char.id}_slayer_prey_target`) || 'Нет цели';
        const preyBadge = document.getElementById('slayerPreyTargetBadge');
        if (preyBadge) preyBadge.textContent = preyTarget;

        document.getElementById('monsterDefense7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('monsterNemesis11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('monsterCounter15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 6. Странник фей (Fey Wanderer)
    const feyPanel = document.getElementById('rangerFeyWandererPanel');
    if (feyPanel) {
      const isFey = sub.includes('фей') || sub.includes('fey');
      feyPanel.classList.toggle('hidden', !isFey);
      if (isFey) {
        const feyDie = lvl >= 11 ? "1d6" : "1d4";
        const feyEl = document.getElementById('feyDreadfulDiceDisplay');
        if (feyEl) feyEl.textContent = feyDie;
        document.getElementById('feyTwist7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('feyReinforce11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('feyMisty15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 7. Хранитель роя (Swarmkeeper)
    const swarmPanel = document.getElementById('rangerSwarmkeeperPanel');
    if (swarmPanel) {
      const isSwarm = sub.includes('роя') || sub.includes('swarm');
      swarmPanel.classList.toggle('hidden', !isSwarm);
      if (isSwarm) {
        const swarmDie = lvl >= 11 ? "1d8" : "1d6";
        const sDieEl = document.getElementById('swarmDamageDiceDisplay');
        if (sDieEl) sDieEl.textContent = swarmDie;
        document.getElementById('swarmTide7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('swarmMighty11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('swarmDispersal15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }

    // 8. Наездник на дрейке (Drakewarden)
    const drakePanel = document.getElementById('rangerDrakewardenPanel');
    if (drakePanel) {
      const isDrake = sub.includes('дрейк') || sub.includes('drake');
      drakePanel.classList.toggle('hidden', !isDrake);
      if (isDrake) {
        const drakeType = localStorage.getItem(`char_${char.id}_drake_type`) || 'Огонь';
        const typeEl = document.getElementById('drakeTypeBadge');
        if (typeEl) typeEl.textContent = drakeType;
        const breathDmg = lvl >= 15 ? "10d6" : "8d6";
        const brEl = document.getElementById('drakeBreathDmgDisplay');
        if (brEl) brEl.textContent = breathDmg;
        document.getElementById('drakeBond7Block')?.classList.toggle('hidden', lvl < 7);
        document.getElementById('drakeBreath11Block')?.classList.toggle('hidden', lvl < 11);
        document.getElementById('drakePerfect15Block')?.classList.toggle('hidden', lvl < 15);
      }
    }
  }

  // --- МЕХАНИКИ И БРОСКИ СПОСОБНОСТЕЙ ---

  // 1. Охотник: Убийца колоссов (+1к8 урона раненому врагу)
  rollColossusSlayer() {
    this.dice.rollFormula("🏹 Убийца колоссов (Colossus Slayer)", "1d8");
  }

  // 2. Странник горизонта: Планарный воин
  usePlanarWarrior() {
    const char = this.state.get();
    const lvl = char?.level || 3;
    const dice = lvl >= 11 ? "2d8" : "1d8";
    this.dice.showToast(
      "🌌 Планарный воин",
      `Следующая атака оружием наносит урон силовым полем +${dice}!`,
      "crit_success"
    );
    this.dice.rollFormula("🌌 Урон Планарного воина (Силовое поле)", dice);
  }

  useEtherealStep() {
    this.dice.showToast(
      "👻 Эфирный шаг",
      "Вы наложили на себя заклинание «Эфирность» до конца текущего хода без траты ячейки!",
      "crit_success"
    );
  }

  // 3. Сумрачный охотник: Атака из засады (1-й раунд)
  rollDreadAmbusher() {
    this.dice.rollFormula("🌑 Угроза из засады (+1к8 урона в 1-м раунде)", "1d8");
  }

  // 4. Убийца чудовищ: Анализ существа (Hunter's Sense)
  useHuntersSense() {
    const char = this.state.get();
    if (!char) return;
    const wisMod = DndRules.calcMod(char.stats?.wis || 10);
    const max = Math.max(1, wisMod);
    let used = parseInt(localStorage.getItem(`char_${char.id}_hunter_sense_used`) || '0');

    if (used >= max) {
      alert("Заряды «Охотничьих чувств» исчерпаны до отдыха!");
      return;
    }

    used += 1;
    localStorage.setItem(`char_${char.id}_hunter_sense_used`, String(used));
    this.renderTab();

    const target = prompt("Укажите имя или тип существа для анализа:");
    if (target) {
      this.dice.showToast(
        "👁️ Охотничьи чувства",
        `Анализ цели «${target}»: вы раскрыли её уязвимости, сопротивления и иммунитеты!`,
        "crit_success"
      );
    }
  }

  setSlayersPrey() {
    const char = this.state.get();
    if (!char) return;
    const target = prompt("Введите имя цели для метки «Добыча убийцы»:", "Враг");
    if (target) {
      localStorage.setItem(`char_${char.id}_slayer_prey_target`, target);
      this.renderTab();
      this.dice.showToast("🎯 Добыча убийцы", `Метка наложена на «${target}» (+1к6 урона при первом попадании за ход).`, "crit_success");
    }
  }

  rollSlayersPreyDamage() {
    this.dice.rollFormula("🎯 Добыча убийцы (Slayer's Prey)", "1d6");
  }

  // 5. Странник фей: Ужасающие удары
  rollDreadfulStrikes() {
    const char = this.state.get();
    const lvl = char?.level || 3;
    const die = lvl >= 11 ? "1d6" : "1d4";
    this.dice.rollFormula("🧚 Ужасающие удары (Психический урон)", die);
  }

  // 6. Хранитель роя: Действия роя
  useSwarmEffect(type) {
    const char = this.state.get();
    const lvl = char?.level || 3;
    const die = lvl >= 11 ? "1d8" : "1d6";
    const saveDc = 8 + DndRules.getProficiencyBonus(lvl) + DndRules.calcMod(char?.stats?.wis || 10);

    if (type === 'damage') {
      this.dice.rollFormula("🐝 Урон Собранного роя (Колющий)", die);
    } else if (type === 'push') {
      this.dice.showToast(
        "💨 Толчок роя",
        `Цель делает спасбросок Силы Сл ${saveDc}: при провале рой толкает её на 15 футов${lvl >= 11 ? ' и сбивает с ног!' : '!'}`,
        "normal"
      );
    } else if (type === 'move') {
      this.dice.showToast(
        "🌀 Смещение роем",
        `Рой переместил вас на 5 футов по горизонтали${lvl >= 11 ? ' (+2 к КД и спасброскам Ловкости за укрытие)!' : '!'}`,
        "crit_success"
      );
    }
  }

  // 7. Наездник на дрейке: Смена стихии и выдох
  setDrakeType(type) {
    const char = this.state.get();
    if (!char) return;
    localStorage.setItem(`char_${char.id}_drake_type`, type);
    this.renderTab();
    this.dice.showToast("🐲 Сущность дрейка", `Выбрана стихия: ${type}. Вы и дрейк синхронизированы!`, "crit_success");
  }

  rollDrakeBreath() {
    const char = this.state.get();
    const lvl = char?.level || 3;
    const type = localStorage.getItem(`char_${char.id}_drake_type`) || 'Огонь';
    const dice = lvl >= 15 ? "10d6" : "8d6";
    const saveDc = 8 + DndRules.getProficiencyBonus(lvl) + DndRules.calcMod(char?.stats?.wis || 10);

    this.dice.showToast("🔥 Дыхание дрейка", `30-футовый конус (${type}). Спасбросок Ловкости Сл ${saveDc} на половинный урон.`, "normal");
    this.dice.rollFormula(`🐲 Дыхание дрейка (${type})`, dice);
  }

  // Восстановление ресурсов на отдыхе
  restoreAllRangerResources() {
    const char = this.state.get();
    if (!char) return;
    localStorage.removeItem(`char_${char.id}_hunter_sense_used`);
    this.renderTab();
  }
}
