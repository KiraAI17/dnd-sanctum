import { DndRules } from '../rules/DndRules.js';

export class BardController {
  constructor(state, apiClient, diceRoller) {
    this.state = state;
    this.api = apiClient;
    this.dice = diceRoller;

    this.spiritTales = [
      { roll: 1, name: "Умное животное", desc: "+Кость вдохновения ко всем проверкам ИНТ/МУД/ХАР на 10 минут." },
      { roll: 2, name: "Знаменитый дуэлянт", desc: "Рукопашная атака заклинанием: 2 кости вдохновения + ХАР урона силовым полем." },
      { roll: 3, name: "Возлюбленные друзья", desc: "Цель и союзник в 5 фт получают временные хиты: 1 кость + ХАР." },
      { roll: 4, name: "Беглец", desc: "Реакцией телепортация цели и до ХАР союзников на 30 фт." },
      { roll: 5, name: "Мститель", desc: "На 1 мин любой ударивший цель в ближнем бою получает 1 кость урона силовым полем." },
      { roll: 6, name: "Путешественник", desc: "Временные хиты 1 кость + уровень барда; пока они есть: +10 фт скорости и +1 к КД." },
      { roll: 7, name: "Обольститель", desc: "Спасбросок Мудрости: урон психикой (2 кости) и недееспособность на раунд." },
      { roll: 8, name: "Фантом", desc: "Невидимость до конца хода; удар из невидимости наносит 1 кость некротики и пугает." },
      { roll: 9, name: "Зверь", desc: "Враги в 30 фт делают спасбросок Силы против 3 костей урона звуком и падения плашмя." },
      { roll: 10, name: "Дракон", desc: "Конус огня 30 фт: спасбросок Ловкости против 4 костей урона огнём." },
      { roll: 11, name: "Ангел", desc: "Лечение 2 кости + ХАР со снятием глухоты, окаменения, отравления, паралича, слепоты." },
      { roll: 12, name: "Повелитель разума", desc: "Спасбросок Интеллекта: 3 кости психики и ошеломление на 1 раунд." }
    ];
  }

  getMaxInspiration(char) {
    const chaMod = DndRules.calcMod(char?.stats?.cha || 10);
    return Math.max(1, chaMod);
  }

  getUsedInspiration(charId) {
    return parseInt(localStorage.getItem(`char_${charId}_bard_insp_used`) || '0');
  }

  setUsedInspiration(charId, val) {
    localStorage.setItem(`char_${charId}_bard_insp_used`, String(val));
  }

  renderTab() {
    const char = this.state.get();
    if (!char) return;

    const lvl = char.level || 1;
    const sub = (char.subclass || '').toLowerCase();
    const die = DndRules.getBardicDie(lvl);
    const maxInsp = this.getMaxInspiration(char);
    const used = this.getUsedInspiration(char.id);
    const remaining = Math.max(0, maxInsp - used);

    // 1. Кость и счетчик
    const dieEl = document.getElementById('bardInspDieDisplay');
    const poolEl = document.getElementById('bardInspPoolDisplay');
    if (dieEl) dieEl.textContent = die;
    if (poolEl) poolEl.textContent = `${remaining} / ${maxInsp}`;

    // 2. Песнь отдыха
    const songCard = document.getElementById('bardSongOfRestCard');
    if (songCard) {
      songCard.classList.toggle('hidden', lvl < 2);
      const songDieEl = document.getElementById('bardSongDieDisplay');
      if (songDieEl) songDieEl.textContent = DndRules.getSongOfRestDie(lvl);
    }

    // 3. Контрочарование (6+ ур)
    const countercharmCard = document.getElementById('bardCountercharmCard');
    if (countercharmCard) countercharmCard.classList.toggle('hidden', lvl < 6);

    // 4. Подклассовые панели
    // Коллегия Мечей
    const swordsPanel = document.getElementById('bardSwordsPanel');
    if (swordsPanel) swordsPanel.classList.toggle('hidden', !(sub.includes('мечей') || sub.includes('swords')));

    // Коллегия Шёпотов
    const whispersPanel = document.getElementById('bardWhispersPanel');
    if (whispersPanel) {
      const isWhispers = sub.includes('шёпот') || sub.includes('whisper');
      whispersPanel.classList.toggle('hidden', !isWhispers);
      if (isWhispers) {
        let pDmg = "2d6";
        if (lvl >= 15) pDmg = "8d6";
        else if (lvl >= 10) pDmg = "5d6";
        else if (lvl >= 5) pDmg = "3d6";
        const wDmgEl = document.getElementById('bardWhispersDiceDisplay');
        if (wDmgEl) wDmgEl.textContent = pDmg;
      }
    }

    // Коллегия Духов
    const spiritsPanel = document.getElementById('bardSpiritsPanel');
    if (spiritsPanel) {
      const isSpirits = sub.includes('духов') || sub.includes('spirit');
      spiritsPanel.classList.toggle('hidden', !isSpirits);
    }
  }

  spendInspiration(purpose = "Вдохновение барда") {
    const char = this.state.get();
    if (!char) return false;

    const maxInsp = this.getMaxInspiration(char);
    let used = this.getUsedInspiration(char.id);

    if (used >= maxInsp) {
      alert("Все кости Вдохновения барда исчерпаны!");
      return false;
    }

    used += 1;
    this.setUsedInspiration(char.id, used);
    this.renderTab();

    const die = DndRules.getBardicDie(char.level || 1);
    this.dice.rollFormula(`✨ ${purpose}`, `1${die}`);
    return true;
  }

  restoreInspiration() {
    const char = this.state.get();
    if (!char) return;
    this.setUsedInspiration(char.id, 0);
    this.renderTab();
    this.dice.showToast("✨ Вдохновение барда", "Кости вдохновения полностью восстановлены!", "crit_success");
  }

  // Росчерки клинка (Коллегия Мечей)
  useFlourish(type) {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const die = DndRules.getBardicDie(lvl);

    // На 14 ур. можно бесплатно использовать d6 (Мастерский росчерк)
    let formula = `1${die}`;
    if (lvl >= 14 && confirm("Использовать бесплатный d6 от умения «Мастерский росчерк» вместо кости вдохновения?")) {
      formula = "1d6";
      this.dice.rollFormula(`⚔️ Росчерк: ${type} (Мастерский d6)`, formula);
      return;
    }

    if (this.spendInspiration(`Росчерк клинка: ${type}`)) {
      // Бросок уже совершён
    }
  }

  // Психические клинки (Коллегия Шёпотов)
  usePsychicBlades() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    let dice = "2d6";
    if (lvl >= 15) dice = "8d6";
    else if (lvl >= 10) dice = "5d6";
    else if (lvl >= 5) dice = "3d6";

    const maxInsp = this.getMaxInspiration(char);
    let used = this.getUsedInspiration(char.id);

    if (used >= maxInsp) {
      alert("Нет доступных костей вдохновения для Психических клинков!");
      return;
    }

    used += 1;
    this.setUsedInspiration(char.id, used);
    this.renderTab();

    this.dice.rollFormula("🗡️🧠 Психические клинки (College of Whispers)", dice);
  }

  // Истории с того света (Коллегия Духов)
  rollSpiritsTable() {
    const char = this.state.get();
    if (!char) return;
    const lvl = char.level || 1;
    const dieStr = DndRules.getBardicDie(lvl);
    const maxVal = parseInt(dieStr.replace('d', '')) || 6;

    if (!this.spendInspiration("Призыв духов (Истории с того света)")) return;

    const r = Math.floor(Math.random() * maxVal) + 1;
    const tale = this.spiritTales.find(t => t.roll === r) || this.spiritTales[0];

    const display = document.getElementById('bardActiveSpiritTaleBox');
    if (display) {
      display.classList.remove('hidden');
      document.getElementById('bardSpiritTaleTitle').textContent = `Сказание #${tale.roll}: ${tale.name}`;
      document.getElementById('bardSpiritTaleDesc').textContent = tale.desc;
    }
  }

  rollSongOfRest() {
    const char = this.state.get();
    const lvl = char?.level || 2;
    const die = DndRules.getSongOfRestDie(lvl);
    this.dice.rollFormula("🎵 Песнь отдыха (Song of Rest)", `1${die}`);
  }
}
