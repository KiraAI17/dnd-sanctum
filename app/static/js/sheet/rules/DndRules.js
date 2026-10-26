export class DndRules {
  static SKILLS_MAP = {
    "Акробатика": "dex",
    "Анализ": "int",
    "Атлетика": "str",
    "Внимательность": "wis",
    "Выживание": "wis",
    "Выступление": "cha",
    "Запугивание": "cha",
    "История": "int",
    "Ловкость рук": "dex",
    "Магия": "int",
    "Медицина": "wis",
    "Обман": "cha",
    "Природа": "int",
    "Проницательность": "wis",
    "Религия": "int",
    "Скрытность": "dex",
    "Убеждение": "cha",
    "Уход за животными": "wis"
  };

  static calcMod(score = 10) {
    return Math.floor((score - 10) / 2);
  }

  static formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  static getProficiencyBonus(level = 1) {
    return 2 + Math.floor((Math.max(1, level) - 1) / 4);
  }

  static getHitDieSides(className = '') {
    const name = className.toLowerCase();
    if (name.includes('варвар')) return 12;
    if (name.includes('воин') || name.includes('охотник') || name.includes('паладин') || name.includes('следопыт')) return 10;
    if (name.includes('волшебник') || name.includes('чародей')) return 6;
    return 8; // Монах, плут, бард, жрец, друид, колдун
  }

  static isSpellcaster(character) {
    if (!character) return false;
    const name = (character.class_name || '').toLowerCase();
    const sub = (character.subclass || '').toLowerCase();
    const lvl = character.level || 1;

    const fullCasters = ['волшебник', 'чародей', 'жрец', 'друид', 'бард', 'колдун', 'wizard', 'sorcerer', 'cleric', 'druid', 'bard', 'warlock'];
    if (fullCasters.some(fc => name.includes(fc))) return true;
    if ((name.includes('паладин') || name.includes('следопыт')) && lvl >= 2) return true;

    // Подклассы-заклинатели (включая Альт Воина и Кровавого охотника)
    const casterSubclasses = [
      'мистический ловкач',
      'рыцарь-мистик',
      'мистический рыцарь',
      'колдовской клинок',
      'профанической души',
      'осквернённых душ'
    ];
    if (lvl >= 3 && casterSubclasses.some(cs => sub.includes(cs))) return true;

    // Мистический ловкач (Arcane Trickster) активирует спеллбук с 3-го уровня
    if (lvl >= 3 && (sub.includes('мистический ловкач') || sub.includes('arcane trickster'))) return true;
    if (character.spells && character.spells.length > 0) return true;
    if (character.spell_slots && Object.values(character.spell_slots).some(s => s.max > 0)) return true;

    return false;
  }

    /**
   * Возвращает куб боевых искусств монаха в зависимости от уровня
   */
  static getMartialArtsDie(level = 1) {
    if (level >= 17) return 10;
    if (level >= 11) return 8;
    if (level >= 5) return 6;
    return 4;
  }

  /**
   * Проверяет, экипирован ли персонаж в броню или держит щит
   */
  static isUnarmoredAndNoShield(charId) {
    const raw = localStorage.getItem(`char_${charId}_armor`);
    if (!raw) return true;
    try {
      const a = JSON.parse(raw);
      const isArmorNone = !a.type || a.type === 'none';
      const noShield = !a.shield;
      return isArmorNone && noShield;
    } catch {
      return true;
    }
  }

  /**
   * Вычисляет итоговую скорость с учётом доспехов и классовых пассивок
   */
  static calculateSpeed(character) {
    if (!character) return 30;

    let totalSpeed = character.speed || 30;
    const cName = (character.class_name || '').toLowerCase();
    const sub = (character.subclass || '').toLowerCase();
    const lvl = character.level || 1;

    // 1. Кровавый охотник: Тёмное усиление (10+ ур.) -> +5 фт
    if ((cName.includes('охотник') || cName.includes('blood')) && lvl >= 10) {
      totalSpeed += 5;
    }

    // 2. Ликантроп: Мастерство преследователя (7+ ур.) -> +10 фт
    if (sub.includes('ликантроп') && lvl >= 7) {
      totalSpeed += 10;
    }

    // 3. Варвар: Быстрое передвижение (5+ ур.) -> +10 фт
    if ((cName.includes('варвар') || cName.includes('barbarian')) && lvl >= 5) {
      totalSpeed += 10;
    }

    // 4. Монах: Движение без доспехов (СТРОГО без доспехов и щита)
    if (cName.includes('монах') || cName.includes('monk')) {
      if (this.isUnarmoredAndNoShield(character.id)) {
        if (lvl >= 18) totalSpeed += 30;
        else if (lvl >= 14) totalSpeed += 25;
        else if (lvl >= 10) totalSpeed += 20;
        else if (lvl >= 6) totalSpeed += 15;
        else if (lvl >= 2) totalSpeed += 10;
      }
    }

    return totalSpeed;
  }

  /**
   * Вычисляет модификатор спасброска с учетом владения и умения 14 ур. «Алмазная душа»
   */
  static getSavingThrowMod(statKey, character) {
    if (!character) return 0;
    const stats = character.stats || {};
    const baseMod = this.calcMod(stats[statKey] || 10);
    const lvl = character.level || 1;
    const profBonus = this.getProficiencyBonus(lvl);
    const cName = (character.class_name || '').toLowerCase();

    let isProficient = false;
    const saves = (character.saving_throws || []).map(s => s.toLowerCase());

    if (saves.includes(statKey.toLowerCase())) {
      isProficient = true;
    }

    // Монах 14+ ур: Алмазная душа (владение ВСЕМИ спасбросками)
    if ((cName.includes('монах') || cName.includes('monk')) && lvl >= 14) {
      isProficient = true;
    }

    let total = baseMod + (isProficient ? profBonus : 0);

    // Кровавый охотник 10+ ур: Тёмное усиление (+мод Гемокрафта к STR, DEX, CON)
    if ((cName.includes('охотник') || cName.includes('blood')) && lvl >= 10) {
      if (['str', 'dex', 'con'].includes(statKey.toLowerCase())) {
        const hemoMod = Math.max(1, this.calcMod(stats.int || stats.wis || 10));
        total += hemoMod;
      }
    }

    // Плут 15+ ур: Скользкий ум (Slippery Mind -> владение спасбросками Мудрости)
    if ((cName.includes('плут') || cName.includes('rogue')) && lvl >= 15 && statKey.toLowerCase() === 'wis') {
      isProficient = true;
    }

    return total;
  }

  /**
   * Возвращает кубы Скрытой атаки плута по уровню (1d6 .. 10d6)
   */
  static getSneakAttackDice(level = 1) {
    const diceCount = Math.ceil(level / 2);
    return `${diceCount}d6`;
  }

  /**
   * Проверяет наличие Компетентности (удвоение бонуса мастерства)
   */
  static isExpertise(skillKey, character) {
    if (!character) return false;
    const expList = character.expertise || [];
    // Также считываем сохраненную компетентность из локального профиля
    const localExp = JSON.parse(localStorage.getItem(`char_${character.id}_expertise`) || '[]');
    const merged = Array.from(new Set([...expList, ...localExp])).map(s => s.toLowerCase());
    return merged.includes(skillKey.toLowerCase());
  }

  /**
   * Возвращает размер кости Вдохновения барда (d6, d8, d10, d12)
   */
  static getBardicDie(level = 1) {
    if (level >= 15) return 'd12';
    if (level >= 10) return 'd10';
    if (level >= 5) return 'd8';
    return 'd6';
  }

  /**
   * Возвращает размер кости Песни отдыха (d6, d8, d10, d12)
   */
  static getSongOfRestDie(level = 2) {
    if (level >= 17) return 'd12';
    if (level >= 13) return 'd10';
    if (level >= 9) return 'd8';
    return 'd6';
  }

  /**
   * Расчет модификатора инициативы с учетом «Мастера на все руки» Барда
   */
  static getInitiativeMod(character) {
    if (!character) return 0;
    const dexMod = this.calcMod(character.stats?.dex || 10);
    let total = dexMod;

    const cName = (character.class_name || '').toLowerCase();
    const lvl = character.level || 1;
    const sub = (character.subclass || '').toLowerCase();

    // Бард 2+ ур: Мастер на все руки (половина бонуса мастерства к инициативе!)
    if ((cName.includes('бард') || cName.includes('bard')) && lvl >= 2) {
      const halfProf = Math.floor(this.getProficiencyBonus(lvl) / 2);
      total += halfProf;
    }

    // Дуэлянт плута: Харизма к инициативе
    if (sub.includes('дуэлянт') || sub.includes('swashbuckler')) {
      const chaMod = this.calcMod(character.stats?.cha || 10);
      total += Math.max(0, chaMod);
    }

    return total;
  }

  /**
   * Расчет модификатора навыка с учетом Мастера на все руки и Компетентности
   */
  static getSkillMod(skillKey, statKey, character) {
    if (!character) return 0;
    const stats = character.stats || {};
    const statMod = this.calcMod(stats[statKey] || 10);
    const profBonus = this.getProficiencyBonus(character.level || 1);

    const profs = (character.skills || []).map(s => String(s).toLowerCase());
    const isProf = profs.includes(String(skillKey).toLowerCase());
    const isExp = this.isExpertise ? this.isExpertise(skillKey, character) : false;

    if (isExp) {
      return statMod + (profBonus * 2);
    } else if (isProf) {
      return statMod + profBonus;
    }

    // Бард 2+ ур: Мастер на все руки (Jack of All Trades) ко всем навыкам без владения
    const cName = (character.class_name || '').toLowerCase();
    const lvl = character.level || 1;
    if ((cName.includes('бард') || cName.includes('bard')) && lvl >= 2) {
      return statMod + Math.floor(profBonus / 2);
    }

    return statMod;
  }
}