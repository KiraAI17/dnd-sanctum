import { DndRules } from '../rules/DndRules.js';

export class SkillsGrid {
  constructor(state, dice, containerId = 'skillsGrid') {
    this.state = state;
    this.dice = dice;
    this.containerId = containerId;
  }

  extractProficiencies(character) {
    if (!character) return { skills: [], expertise: [], armor: [], weapons: [] };

    const profSkills = new Set(character.proficient_skills || character.skills || []);
    const expSkills = new Set(character.expertise_skills || []);
    const armorProfs = new Set(character.armor_proficiencies || []);
    const weaponProfs = new Set(character.weapon_proficiencies || []);

    let raceTraits = character.traits || character.race_traits || [];
    if (raceTraits.length === 0 && character.race && window.ALL_RACES_CACHE) {
      const rObj = (window.ALL_RACES_CACHE || []).find(r => r.name.toLowerCase() === character.race.toLowerCase());
      if (rObj && rObj.traits) raceTraits = rObj.traits;
    }

    const corpus = [
      ...raceTraits,
      ...(character.features || []),
      ...(character.feats || [])
    ];

    const fullText = corpus.map(it => {
      if (typeof it === 'string') return it;
      return `${it.name || ''}: ${it.description || it.desc || ''}`;
    }).join('\n').toLowerCase();

    Object.keys(DndRules.SKILLS_MAP).forEach(sk => {
      const skLower = sk.toLowerCase();
      const regexExp = new RegExp(`(компетентност|удваивает[^.\\n]*?мастерств)[^.\\n]*?${skLower}`, 'i');
      const regexProf = new RegExp(`(владе(ние|ете|ет)|навык(ом|а)?)[^.\\n]*?${skLower}`, 'i');

      if (regexExp.test(fullText)) {
        expSkills.add(sk);
        profSkills.add(sk);
      } else if (regexProf.test(fullText)) {
        profSkills.add(sk);
      }
    });

    ["легкие доспехи", "средние доспехи", "тяжелые доспехи", "щиты"].forEach(a => {
      if (fullText.includes(a)) {
        if (a.includes("легк")) armorProfs.add("Легкие доспехи");
        if (a.includes("средн")) armorProfs.add("Средние доспехи");
        if (a.includes("тяжел")) armorProfs.add("Тяжелые доспехи");
        if (a.includes("щит")) armorProfs.add("Щиты");
      }
    });

    return {
      skills: Array.from(profSkills),
      expertise: Array.from(expSkills),
      armor: Array.from(armorProfs),
      weapons: Array.from(weaponProfs)
    };
  }

  render() {
    const container = document.getElementById(this.containerId || 'skillsGrid');
    if (!container) return;

    const char = this.state.get();
    if (!char) return;

    const skills = [
      { key: 'acrobatics', name: 'Акробатика', stat: 'dex' },
      { key: 'athletics', name: 'Атлетика', stat: 'str' },
      { key: 'perception', name: 'Внимательность', stat: 'wis' },
      { key: 'survival', name: 'Выживание', stat: 'wis' },
      { key: 'performance', name: 'Выступление', stat: 'cha' },
      { key: 'intimidation', name: 'Запугивание', stat: 'cha' },
      { key: 'history', name: 'История', stat: 'int' },
      { key: 'sleight_of_hand', name: 'Ловкость рук', stat: 'dex' },
      { key: 'arcana', name: 'Магия', stat: 'int' },
      { key: 'medicine', name: 'Медицина', stat: 'wis' },
      { key: 'deception', name: 'Обман', stat: 'cha' },
      { key: 'nature', name: 'Природа', stat: 'int' },
      { key: 'insight', name: 'Проницательность', stat: 'wis' },
      { key: 'investigation', name: 'Расследование', stat: 'int' },
      { key: 'religion', name: 'Религия', stat: 'int' },
      { key: 'stealth', name: 'Скрытность', stat: 'dex' },
      { key: 'persuasion', name: 'Убеждение', stat: 'cha' },
      { key: 'animal_handling', name: 'Уход за животными', stat: 'wis' }
    ];

    const profList = (char.skills || []).map(s => s.toLowerCase());

    container.innerHTML = skills.map(sk => {
      const isProf = profList.includes(sk.name.toLowerCase()) || profList.includes(sk.key);
      const isExp = DndRules.isExpertise(sk.name, char) || DndRules.isExpertise(sk.key, char);
      const mod = DndRules.getSkillMod(sk.name, sk.stat, char);
      const modStr = DndRules.formatMod(mod);

      // Значок статуса: ⭐ для Компетентности, ● для владения, ○ для базы
      let icon = '○';
      let badgeStyle = 'text-stone-600';
      if (isExp) {
        icon = '⭐';
        badgeStyle = 'text-amber-400 font-bold drop-shadow';
      } else if (isProf) {
        icon = '●';
        badgeStyle = 'text-foxOrange-400 font-bold';
      }

      return `
        <div class="flex justify-between items-center p-1.5 rounded-lg hover:bg-black/40 text-xs font-serif transition-colors cursor-pointer group"
             onclick="window.diceRoller.rollCheck('${sk.name}${isExp ? ' (Компетентность ⭐)' : ''}', ${mod}, window.sheetApp.state.get(), ${isProf || isExp})">
          <div class="flex items-center gap-2">
            <span class="${badgeStyle} text-xs select-none">${icon}</span>
            <span class="${isExp ? 'text-amber-200 font-bold' : (isProf ? 'text-stone-200 font-medium' : 'text-stone-400')} group-hover:text-amber-300">
              ${sk.name} <span class="text-[9px] text-stone-500 font-mono">(${sk.stat.toUpperCase()})</span>
            </span>
          </div>
          <span class="font-mono font-bold ${isExp ? 'text-amber-300' : 'text-stone-300'}">${modStr}</span>
        </div>
      `;
    }).join('');
  }
}
