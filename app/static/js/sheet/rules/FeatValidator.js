import { DndRules } from './DndRules.js';

export class FeatValidator {
  /**
   * Проверяет требования черты (Prerequisite) для конкретного персонажа.
   * @param {Object} feat - объект черты из feats.json
   * @param {Object} character - объект персонажа
   * @param {Object} proficiencies - собранные владения персонажа
   * @returns {{ ok: boolean, reason: string }}
   */
  static checkPrerequisite(feat, character, proficiencies = { armor: [], weapons: [] }) {
    if (!feat || !feat.prerequisite) return { ok: true, reason: "" };

    const prereq = String(feat.prerequisite).trim();
    if (!prereq || prereq.toLowerCase() === 'null') return { ok: true, reason: "" };

    const stats = (character && character.stats) || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const race = (character && character.race ? character.race : "").toLowerCase();
    const pLower = prereq.toLowerCase();

    // 1. Проверка характеристик (например, "Сила 13", "Ловкость 13 или выше")
    const statKeys = [
      { key: 'str', names: ['сила', 'силы', 'str'] },
      { key: 'dex', names: ['ловкость', 'ловкости', 'dex'] },
      { key: 'con', names: ['телосложение', 'телосложения', 'con'] },
      { key: 'int', names: ['интеллект', 'интеллекта', 'int'] },
      { key: 'wis', names: ['мудрость', 'мудрости', 'wis'] },
      { key: 'cha', names: ['харизма', 'харизмы', 'cha'] }
    ];

    for (const s of statKeys) {
      for (const n of s.names) {
        if (pLower.includes(n)) {
          const numMatch = prereq.match(/\d+/);
          if (numMatch) {
            const reqVal = parseInt(numMatch[0]);
            const curVal = stats[s.key] || 10;
            if (curVal < reqVal) {
              return { ok: false, reason: `Требуется ${n.toUpperCase()} ${reqVal}+ (у вас ${curVal})` };
            }
          }
        }
      }
    }

    // 2. Владение доспехами
    if (pLower.includes('тяжел') && pLower.includes('доспех')) {
      if (!proficiencies.armor.some(a => a.toLowerCase().includes('тяжел'))) {
        return { ok: false, reason: "Требуется владение тяжелыми доспехами" };
      }
    }
    if (pLower.includes('средн') && pLower.includes('доспех')) {
      if (!proficiencies.armor.some(a => a.toLowerCase().includes('средн') || a.toLowerCase().includes('тяжел'))) {
        return { ok: false, reason: "Требуется владение средними доспехами" };
      }
    }

    // 3. Заклинания
    if (pLower.includes('заклинател') || pLower.includes('накладывать') || pLower.includes('маги')) {
      if (!DndRules.isSpellcaster(character)) {
        return { ok: false, reason: "Требуется способность накладывать заклинания" };
      }
    }

    // 4. Расовые ограничения
    const races = ['эльф', 'дварф', 'гном', 'полуэльф', 'полуорк', 'тифлинг', 'драконорожденный', 'халфлинг'];
    for (const r of races) {
      if (pLower.includes(r) && !race.includes(r)) {
        return { ok: false, reason: `Доступно только расе: ${r}` };
      }
    }

    return { ok: true, reason: "" };
  }

  /**
   * Проверяет, предлагает ли черта выбор характеристики (например, черта «Стойкий»).
   * @param {Object} feat
   * @returns {{ hasChoice: boolean, options: string[] }}
   */
  static extractStatChoiceOptions(feat) {
    if (!feat) return { hasChoice: false, options: [] };

    if (feat.stat_bonuses && feat.stat_bonuses.choice) {
      const opts = Array.isArray(feat.stat_bonuses.choice)
        ? feat.stat_bonuses.choice
        : String(feat.stat_bonuses.choice).split(',');
      return { hasChoice: true, options: opts.map(s => s.trim().toLowerCase()) };
    }

    if (feat.options && Array.isArray(feat.options)) {
      const opt = feat.options.find(o => o.type === 'stat_choice' || o.stats);
      if (opt && opt.stats) {
        return { hasChoice: true, options: opt.stats.map(s => s.trim().toLowerCase()) };
      }
    }

    if (feat.name && (feat.name.toLowerCase().includes('стойкий') || (feat.id && feat.id.toLowerCase().includes('resilient')))) {
      return { hasChoice: true, options: ['str', 'dex', 'con', 'int', 'wis', 'cha'] };
    }

    return { hasChoice: false, options: [] };
  }
}
