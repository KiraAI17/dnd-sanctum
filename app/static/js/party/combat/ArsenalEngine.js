/**
 * ArsenalEngine.js
 * Механика атак: учет Уклонения (помеха), проверка КД цели,
 * драматический бросок атаки и пошаговый подсчет урона.
 */
export class ArsenalEngine {
  constructor(combatState, combatFx) {
    this.state = combatState;
    this.fx = combatFx;
  }

  calculateDistance(tokenIdA, tokenIdB) {
    const tokens = window.mapData?.tokens || [];
    const tokA = tokens.find(t => t.id === tokenIdA);
    const tokB = tokens.find(t => t.id === tokenIdB);
    if (!tokA || !tokB) return 999;

    const gridSize = window.currentGridSize || 50;
    const cellXA = Math.round(tokA.x / gridSize);
    const cellYA = Math.round(tokA.y / gridSize);
    const cellXB = Math.round(tokB.x / gridSize);
    const cellYB = Math.round(tokB.y / gridSize);

    const dx = Math.abs(cellXA - cellXB);
    const dy = Math.abs(cellYA - cellYB);

    return Math.max(dx, dy) * 5;
  }

  getTargetArmorClass(targetToken) {
    if (!targetToken) return 10;
    if (targetToken.character_id) {
      const pData = window.partyData;
      const mem = (pData?.members || []).find(m => m.character_id === targetToken.character_id);
      return mem?.character_ac || 10;
    }
    const npc = (typeof dmNpcsList !== 'undefined') ? dmNpcsList.find(n => n.name === targetToken.name) : null;
    return npc?.armor_class || 12;
  }

  rollDamage(formula, isCrit = false) {
    if (!formula) return { total: 0, text: "0", rolls: [] };

    let str = String(formula);
    const match = str.match(/(\d+)\s*[dкDК]\s*(\d+)(?:\s*([\+\-]\s*\d+))?/i);

    if (!match) {
      const numMatch = str.match(/\b(\d+)\b/);
      const val = numMatch ? parseInt(numMatch[1]) : 4;
      return { total: val, text: `${val}`, rolls: [val] };
    }

    let count = parseInt(match[1]) || 1;
    if (isCrit) count *= 2;
    const sides = parseInt(match[2]) || 6;
    let mod = 0;
    if (match[3]) {
      mod = parseInt(match[3].replace(/\s+/g, '')) || 0;
    }

    const rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }

    const total = Math.max(1, sum + mod);
    return {
      total,
      count,
      sides,
      rolls,
      mod,
      text: `[${rolls.join('+')}]${mod !== 0 ? (mod > 0 ? ' +' + mod : ' ' + mod) : ''}`
    };
  }

  async executeAttack(weaponName, atkBonusStr, dmgFormula) {
    if (!this.state.economy.hasAction) {
      alert("Основное действие уже потрачено в этом ходу!");
      return false;
    }

    const current = this.state.getCurrentCombatant();
    if (!current) return false;

    const targetId = this.state.selectedTargetTokenId;
    if (!targetId) {
      alert("Сначала выберите цель кликом по токену на карте!");
      return false;
    }

    const tokens = window.mapData?.tokens || [];
    const target = tokens.find(t => t.id === targetId);
    if (!target) return false;

    const isRanged = /лук|арбалет|дротик|bow|crossbow/i.test(weaponName);
    const maxRange = isRanged ? 80 : 5;
    const distance = this.calculateDistance(current.token_id, target.id);

    if (distance > maxRange) {
      alert(`Цель вне досягаемости! Расстояние: ${distance} фт (макс. ${maxRange} фт). Подойдите вплотную на соседнюю клетку!`);
      return false;
    }

    // 1. ПРОВЕРКА УКЛОНЕНИЯ У ЦЕЛИ (ПОМЕХА)
    const targetConditions = target.conditions || [];
    const hasDisadvantage = targetConditions.includes('🛡️');

    const atkBonus = parseInt(atkBonusStr) || 0;
    const roll1 = Math.floor(Math.random() * 20) + 1;
    let finalD20 = roll1;
    let rollComment = "";

    if (hasDisadvantage) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      finalD20 = Math.min(roll1, roll2);
      rollComment = `🛡️ Цель уклоняется! Помеха: [${roll1}, ${roll2}] ➔ выбран худший: ${finalD20}`;
    }

    const totalAtk = finalD20 + atkBonus;
    const isCrit = (finalD20 === 20);
    const targetAc = this.getTargetArmorClass(target);

    this.state.spendAction();

    // ЭТАП 1: Бросок попадания d20
    this.fx.showDiceModal(
      `Атака: ${weaponName}`,
      finalD20,
      atkBonus,
      totalAtk,
      hasDisadvantage ? rollComment : `Против КД ${targetAc}`
    );

    // ПРОМАХ
    if (!isCrit && totalAtk < targetAc) {
      const missMsg = `💨 ${current.name} атакует «${target.name}» [${weaponName}]: бросок ${finalD20}${atkBonus >= 0 ? '+' + atkBonus : atkBonus} = ${totalAtk} против КД ${targetAc} ➔ ПРОМАХ!`;
      setTimeout(() => this.broadcast(missMsg), 1200);
      return true;
    }

    // ЭТАП 2: САСПЕНС УРОНА ПРИ ПОПАДАНИИ
    const dmg = this.rollDamage(dmgFormula, isCrit);

    setTimeout(async () => {
      // Показываем драматический бросок урона
      this.fx.showDiceModal(
        `💥 Урон: ${weaponName}`,
        dmg.total,
        dmg.mod || 0,
        dmg.total,
        `${isCrit ? '🔥 КРИТИЧЕСКИЙ УДАР!\n' : ''}Кости: ${dmg.text}`
      );

      window.activeHudTokenId = target.id;
      await window.applyTokenDamageSilently?.(-dmg.total);

      this.fx.triggerFx(target.id, 'slash');
      const hitMsg = `⚔️ ${current.name} попадает по «${target.name}» [${weaponName}] (КД ${targetAc}):\n🎲 Атака: ${totalAtk}${isCrit ? ' 🔥 КРИТ!' : ''}\n💥 Урон: ${dmg.total} (${dmg.text})`;
      this.broadcast(hitMsg);
    }, 1500);

    return true;
  }

  broadcast(text) {
    if (window.partySocket && window.partySocket.readyState === WebSocket.OPEN) {
      window.partySocket.send(JSON.stringify({ type: "chat_message", text }));
    }
  }
}