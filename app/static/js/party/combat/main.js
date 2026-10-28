/**
 * main.js
 * Точка входа боевого движка: синхронизация и мост для глобальных вызовов.
 */
import { CombatController } from './CombatController.js';

window.combatEngine = new CombatController();

// 1. Инициализация и рендер
window.initCombatState = () => window.combatEngine.init();
window.renderCombatUI = () => window.combatEngine.render();

// 2. Управление токенами и HUD (Шестерёнка на токенах)
window.openTokenHud = (e, tokenId) => {
  if (e) e.stopPropagation();
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

  hud.style.left = `${Math.min(window.innerWidth - 260, (e ? e.clientX : 100) + 10)}px`;
  hud.style.top = `${Math.min(window.innerHeight - 250, (e ? e.clientY : 100) + 10)}px`;
  hud.classList.remove('hidden');
};

window.closeTokenHud = () => {
  document.getElementById('tokenActionHud')?.classList.add('hidden');
  window.activeHudTokenId = null;
};

window.applyTokenDamage = async (delta) => {
  await window.applyTokenDamageSilently(delta);
  if (window.activeHudTokenId) {
    const tokens = window.mapData?.tokens || [];
    const t = tokens.find(x => x.id === window.activeHudTokenId);
    if (t) {
      const hpEl = document.getElementById('hudTokenHp');
      if (hpEl) hpEl.textContent = `${t.hp_current} / ${t.hp_max || 10}`;
    }
  }
  window.combatEngine.render();
};

window.toggleTokenCondition = async (conditionIcon) => {
  const targetId = window.activeHudTokenId;
  if (!targetId || !window.mapData) return;
  const token = (window.mapData.tokens || []).find(t => t.id === targetId);
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

  const combatant = window.combatEngine.state.combatants.find(c => c.token_id === targetId);
  if (combatant) {
    combatant.conditions = token.conditions;
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: { combatants: window.combatEngine.state.combatants }
    });
  }

  if (typeof renderBattleMap === 'function') renderBattleMap();
  window.combatEngine.render();
};

// 3. Выбор цели кликом по токену
window.selectTargetToken = (tokenId) => {
  const state = window.combatEngine.state;
  const current = state.getCurrentCombatant();

  if (current && (current.token_id === tokenId || current.id === tokenId)) {
    state.selectedTargetTokenId = null;
  } else {
    state.selectedTargetTokenId = (state.selectedTargetTokenId === tokenId) ? null : tokenId;
  }

  window.updateTargetIndicators?.();
};

// 4. Отрисовка индикатора выбранной цели
window.updateTargetIndicators = () => {
  document.querySelectorAll('[id^="token_"]').forEach(el => {
    el.classList.remove('ring-4', 'ring-rose-500', 'shadow-[0_0_20px_rgba(244,63,94,0.9)]');
  });

  const targetBox = document.getElementById('combatTargetIndicatorBox');
  const targetName = document.getElementById('combatTargetNameText');
  const targetHp = document.getElementById('combatTargetHpText');
  const targetId = window.combatEngine?.state?.selectedTargetTokenId;
  const tokens = (window.mapData && window.mapData.tokens) || [];

  if (targetId) {
    const el = document.getElementById(`token_${targetId}`);
    if (el) el.classList.add('ring-4', 'ring-rose-500', 'shadow-[0_0_20px_rgba(244,63,94,0.9)]');

    const tok = tokens.find(t => t.id === targetId);
    if (tok && targetName && targetHp) {
      targetName.textContent = tok.name;
      targetHp.textContent = `(${tok.hp_current !== undefined ? tok.hp_current : 10}/${tok.hp_max || 10} HP)`;
      if (targetBox) targetBox.className = "flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-600 shadow text-xs";
    }
  } else {
    if (targetName) targetName.textContent = "Не выбрана (клик по врагу)";
    if (targetHp) targetHp.textContent = "";
    if (targetBox) targetBox.className = "flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/60 border border-orange-950 text-xs";
  }
};

// 5. Динамическое обновление скорости
window.updateMovementDisplay = () => {
  if (window.combatEngine) {
    window.combatEngine.updateEconomyUI();
  }
};

window.closeSpellDetailModal = () => {
  const modal = document.getElementById('spellDetailModal');
  if (modal) modal.classList.add('hidden');
};

window.applyTokenDamageSilently = async (delta) => {
  const targetId = window.activeHudTokenId;
  if (!targetId || !window.mapData) return;

  const token = (window.mapData.tokens || []).find(t => t.id === targetId);
  if (!token) return;

  const maxHp = token.hp_max || 10;
  const curHp = token.hp_current !== undefined ? token.hp_current : maxHp;
  const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
  token.hp_current = newHp;

  if (newHp === 0) {
    token.conditions = token.conditions || [];
    if (!token.conditions.includes('💀')) token.conditions.push('💀');
    token.conditions = token.conditions.filter(c => c !== '🛡️');
  } else if (curHp === 0 && newHp > 0) {
    token.conditions = (token.conditions || []).filter(c => c !== '💀');
  }

  await apiFetch(`/parties/${partyId}/map`, {
    method: 'PATCH',
    body: { tokens: window.mapData.tokens }
  });

  const combatant = window.combatEngine.state.combatants.find(c => c.token_id === targetId);
  if (combatant) {
    combatant.hp_current = newHp;
    combatant.conditions = token.conditions;
    await apiFetch(`/parties/${partyId}/combat`, {
      method: 'PATCH',
      body: { combatants: window.combatEngine.state.combatants }
    });
  }

  if (typeof renderBattleMap === 'function') renderBattleMap();
  window.updateTargetIndicators?.();
};

// --- ЧЕСТНЫЕ СПАСБРОСКИ ОТ СМЕРТИ (С СОХРАНЕНИЕМ И СЧЕТЧИКАМИ) ---
window.rollDeathSave = async () => {
  const state = window.combatEngine?.state;
  if (!state) return;
  const current = state.getCurrentCombatant();
  if (!current) return;

  const charId = current.character_id || current.id;
  const saveKey = `char_${charId}_death_saves`;

  let saves = { successes: 0, failures: 0, is_stable: false };
  try {
    saves = JSON.parse(localStorage.getItem(saveKey)) || saves;
  } catch (e) {}

  if (saves.is_stable) {
    alert("Персонаж уже стабилизирован!");
    return;
  }
  if (saves.failures >= 3) {
    alert("Персонаж погиб (3 провала)!");
    return;
  }

  const d20 = Math.floor(Math.random() * 20) + 1;
  let comment = "";

  if (d20 === 20) {
    saves.successes = 0;
    saves.failures = 0;
    saves.is_stable = true;
    current.hp_current = 1;
    comment = "🔥 НАТУРАЛЬНЫЙ 20! Персонаж приходит в сознание с 1 HP!";
    window.activeHudTokenId = current.token_id;
    await window.applyTokenDamageSilently(1);
  } else if (d20 >= 10) {
    saves.successes += 1;
    comment = `УСПЕХ (${saves.successes}/3)`;
    if (saves.successes >= 3) {
      saves.is_stable = true;
      comment += "\n🎉 Персонаж стабилизировался!";
    }
  } else if (d20 === 1) {
    saves.failures = Math.min(3, saves.failures + 2);
    comment = `💀 КРИТИЧЕСКИЙ ПРОВАЛ (1)! Сразу 2 провала (${saves.failures}/3)!`;
  } else {
    saves.failures += 1;
    comment = `ПРОВАЛ (${saves.failures}/3)`;
  }

  if (saves.failures >= 3) {
    comment += "\n💀 ПЕРСОНАЖ ПОГИБ!";
    current.conditions = current.conditions || [];
    if (!current.conditions.includes('💀')) current.conditions.push('💀');
  }

  localStorage.setItem(saveKey, JSON.stringify(saves));
  window.deathSaves = saves;

  // Обновляем кружочки на экране
  for (let i = 1; i <= 3; i++) {
    const sEl = document.getElementById(`dSuccess_${i}`);
    if (sEl) {
      sEl.className = i <= saves.successes
        ? "w-4 h-4 rounded-full border border-emerald-500 bg-emerald-500 text-stone-950 font-bold flex items-center justify-center text-[10px]"
        : "w-4 h-4 rounded-full border border-emerald-500 bg-transparent flex items-center justify-center text-[10px]";
      sEl.textContent = i <= saves.successes ? "✓" : "";
    }
    const fEl = document.getElementById(`dFailure_${i}`);
    if (fEl) {
      fEl.className = i <= saves.failures
        ? "w-4 h-4 rounded-full border border-rose-500 bg-rose-500 text-stone-950 font-bold flex items-center justify-center text-[10px]"
        : "w-4 h-4 rounded-full border border-rose-500 bg-transparent flex items-center justify-center text-[10px]";
      fEl.textContent = i <= saves.failures ? "✕" : "";
    }
  }

  window.combatEngine.fx.showDiceModal("Спасбросок от смерти", d20, 0, d20, comment);
  window.combatEngine.features.broadcast(`🎲 Спасбросок от смерти «${current.name}»: [${d20}] ➔ ${comment}`);
};

// Свойства для внешних модулей
Object.defineProperty(window, 'combatState', {
  get: () => window.combatEngine.state.toPayload()
});
Object.defineProperty(window, 'selectedTargetTokenId', {
  get: () => window.combatEngine.state.selectedTargetTokenId,
  set: (val) => { window.combatEngine.state.selectedTargetTokenId = val; }
});
Object.defineProperty(window, 'combatMovementPool', {
  get: () => window.combatEngine.state.movement
});
Object.defineProperty(window, 'combatEconomy', {
  get: () => window.combatEngine.state.economy
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.combatEngine.init());
} else {
  window.combatEngine.init();
}