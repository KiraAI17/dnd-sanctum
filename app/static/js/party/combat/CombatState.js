/**
 * CombatState.js
 * Управление состоянием инициативы, комбатантов и экономикой действий раунда.
 */
export class CombatState {
  constructor() {
    this.isActive = false;
    this.round = 1;
    this.currentTurnIndex = 0;
    this.combatants = [];

    // Экономика действий текущего ходящего
    this.economy = {
      hasAction: true,
      hasBonusAction: true,
      hasReaction: true
    };

    // Пул движения текущего ходящего
    this.movement = {
      maxFeet: 30,
      remainingFeet: 30,
      hasUsedDash: false,
      hasRolledDeathSave: false
    };

    this.selectedTargetTokenId = null;
    this.activeHudTokenId = null;
  }

  initFromData(data) {
    if (!data) return;
    this.isActive = Boolean(data.is_active);
    this.round = data.round || 1;
    this.currentTurnIndex = data.current_turn_index || 0;
    this.combatants = Array.isArray(data.combatants) ? data.combatants : [];
  }

  getCurrentCombatant() {
    if (!this.isActive || this.combatants.length === 0) return null;
    return this.combatants[this.currentTurnIndex] || null;
  }

  getNextCombatant() {
    if (!this.isActive || this.combatants.length === 0) return null;
    const nextIdx = (this.currentTurnIndex + 1) % this.combatants.length;
    return this.combatants[nextIdx] || null;
  }

  resetTurnEconomy(baseSpeed = 30) {
    this.economy.hasAction = true;
    this.economy.hasBonusAction = true;
    this.economy.hasReaction = true;

    this.movement.maxFeet = baseSpeed;
    this.movement.remainingFeet = baseSpeed;
    this.movement.hasUsedDash = false;
    this.movement.hasRolledDeathSave = false;
  }

  spendAction() {
    if (!this.economy.hasAction) return false;
    this.economy.hasAction = false;
    return true;
  }

  spendBonusAction() {
    if (!this.economy.hasBonusAction) return false;
    this.economy.hasBonusAction = false;
    return true;
  }

  useDash() {
    if (!this.economy.hasAction) return false;
    if (this.movement.hasUsedDash) return false;
    this.economy.hasAction = false;
    this.movement.hasUsedDash = true;
    this.movement.remainingFeet += this.movement.maxFeet;
    return true;
  }

  consumeMovement(feet) {
    if (this.movement.remainingFeet < feet) return false;
    this.movement.remainingFeet -= feet;
    return true;
  }

  selectTarget(tokenId) {
    const current = this.getCurrentCombatant();
    // Нельзя таргетить самого себя
    if (current && (current.token_id === tokenId || current.id === tokenId)) {
      this.selectedTargetTokenId = null;
      return null;
    }
    this.selectedTargetTokenId = (this.selectedTargetTokenId === tokenId) ? null : tokenId;
    return this.selectedTargetTokenId;
  }

  toPayload() {
    return {
      is_active: this.isActive,
      round: this.round,
      current_turn_index: this.currentTurnIndex,
      combatants: this.combatants
    };
  }
}
