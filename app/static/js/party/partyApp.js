window.getHpBarConfig = function(cur, max) {
  const c = Math.max(0, parseInt(cur) || 0);
  const m = Math.max(1, parseInt(max) || 1);
  const pct = Math.min(100, Math.round((c / m) * 100));

  let colorClass = "from-emerald-500 to-green-600";
  if (pct <= 25) {
    colorClass = "from-rose-600 to-red-700 animate-pulse";
  } else if (pct <= 50) {
    colorClass = "from-amber-500 to-orange-600";
  }
  return { pct, colorClass, text: `${c} / ${m}` };
};


const partyId = window.location.pathname.split('/').pop();
let partyData = null;
let currentUserData = null;
let myCharactersList = [];
let currentActiveTab = 'playerHero';
let myAttachedChar = null;
let activeCustomColors = null;

const PARTY_THEMES = {
  ember: { name: "Янтарный огонь", accent: "#f59e0b", border: "rgba(245, 158, 11, 0.4)", cardBg: "rgba(18, 13, 9, 0.95)", glow: "rgba(245, 158, 11, 0.25)", text: "#fef3c7" },
  shadow: { name: "Тени и мистика", accent: "#a855f7", border: "rgba(168, 85, 247, 0.4)", cardBg: "rgba(14, 9, 20, 0.95)", glow: "rgba(168, 85, 247, 0.25)", text: "#f3e8ff" },
  forest: { name: "Лесная чаща", accent: "#10b981", border: "rgba(16, 185, 129, 0.4)", cardBg: "rgba(9, 18, 13, 0.95)", glow: "rgba(16, 185, 129, 0.25)", text: "#d1fae5" },
  blood: { name: "Кровавая луна", accent: "#f43f5e", border: "rgba(244, 63, 94, 0.4)", cardBg: "rgba(22, 10, 12, 0.95)", glow: "rgba(244, 63, 94, 0.25)", text: "#ffe4e6" },
  celestial: { name: "Небесное сияние", accent: "#06b6d4", border: "rgba(6, 182, 212, 0.4)", cardBg: "rgba(8, 17, 24, 0.95)", glow: "rgba(6, 182, 212, 0.25)", text: "#cffafe" }
};

function getRaceEmoji(race) {
  if (!race) return '⚔️';
  const r = String(race).toLowerCase();
  if (r.includes('эльф')) return '🧝';
  if (r.includes('дварф') || r.includes('гном')) return '🛡️';
  if (r.includes('кицунэ') || r.includes('лис')) return '🦊';
  if (r.includes('дракон')) return '🐲';
  if (r.includes('тифлинг') || r.includes('демон')) return '😈';
  if (r.includes('орк') || r.includes('гоблин')) return '🦾';
  if (r.includes('волшебник') || r.includes('маг')) return '🧙';
  if (r.includes('халфлинг') || r.includes('полурослик')) return '🍃';
  if (r.includes('ящер') || r.includes('lizard')) return '🐊';
  if (r.includes('чейнджлинг')) return '🎭';
  return '👤';
}

function applyPartyTheme(themeName, customColors = null) {
  let t = PARTY_THEMES[themeName] || PARTY_THEMES.ember;
  if (themeName === 'custom' && customColors) {
    t = {
      name: "Своя палитра",
      accent: customColors.accent || '#f59e0b',
      border: customColors.border || 'rgba(245, 158, 11, 0.4)',
      cardBg: customColors.cardBg || 'rgba(18, 13, 9, 0.95)',
      glow: customColors.glow || 'rgba(245, 158, 11, 0.25)',
      text: customColors.text || '#fef3c7'
    };
  }

  const root = document.documentElement;
  root.style.setProperty('--party-accent', t.accent);
  root.style.setProperty('--party-border', t.border);
  root.style.setProperty('--party-card-bg', t.cardBg);
  root.style.setProperty('--party-glow', t.glow);
  root.style.setProperty('--party-text', t.text || '#fef3c7');

  const lbl = document.getElementById('themePreviewLabel');
  if (lbl) lbl.textContent = t.name;

  const activeBtn = document.querySelector('.party-tab-btn.active-tab');
  if (activeBtn) {
    activeBtn.style.backgroundColor = t.accent;
    activeBtn.style.boxShadow = `0 4px 15px ${t.glow}`;
  }
}

function selectPartyPreset(themeKey) {
  document.getElementById('setThemeSelect').value = themeKey;
  document.getElementById('customColorsBlock').classList.add('hidden');
  activeCustomColors = null;
  applyPartyTheme(themeKey);
}

function toggleCustomColorPickers() {
  const block = document.getElementById('customColorsBlock');
  block.classList.toggle('hidden');
  document.getElementById('setThemeSelect').value = 'custom';

  const style = getComputedStyle(document.documentElement);
  document.getElementById('pickerAccent').value = style.getPropertyValue('--party-accent').trim() || '#f59e0b';
  onCustomColorChange();
}

function onCustomColorChange() {
  const accent = document.getElementById('pickerAccent').value;
  const border = document.getElementById('pickerBorder').value;
  const cardBg = document.getElementById('pickerCardBg').value;
  const glow = document.getElementById('pickerGlow').value;

  activeCustomColors = { accent, border, cardBg, glow };
  applyPartyTheme('custom', activeCustomColors);
}

function setupRoleView() {
  const isDm = partyData.is_current_user_dm;
  document.getElementById('partyRoleBadge').textContent = isDm ? '👑 Вы — Мастер стола' : '👤 Вы — Игрок';

  const dmElems = ['tabBtnDmScreen', 'tabBtnDmNpcs', 'tabBtnSettings', 'btnTabAddRace', 'chatPinOption', 'dmMapControls', 'dmAudioControls'];
  dmElems.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !isDm);
  });

  const dmBannerBtn = document.getElementById('dmBannerUploadBtnBlock');
  if (dmBannerBtn) dmBannerBtn.classList.toggle('hidden', !isDm);

  if (!isDm) {
    document.getElementById('dmNotesTextarea').readOnly = true;
    document.getElementById('dmNotesTextarea').value = "Сюжетные тайны доступны только Мастеру стола.";
    document.getElementById('dmNotesSaveBtnRow').classList.add('hidden');
    document.getElementById('dmPlotBadge').textContent = "Закрыто Мастером";
    switchPartyTab('playerHero');
  } else {
    switchPartyTab('dmScreen');
  }
}

function renderPartyHeader() {
  document.getElementById('partyTitle').textContent = partyData.name;
  document.getElementById('partyDesc').textContent = partyData.description || 'Описание кампании отсутствует.';
  document.getElementById('partyPrivacyBadge').textContent = partyData.is_private ? '🔒 Закрытая' : '🌍 Открытая';
  document.getElementById('squadCount').textContent = (partyData.members || []).length;
  document.getElementById('partyRacesCount').textContent = (partyData.custom_races || []).length;

  const banner = (partyData.settings || {}).banner_url;
  const bannerBox = document.getElementById('partyHeaderBanner');
  if (bannerBox) {
    bannerBox.style.backgroundImage = (banner && banner.trim()) ? `url('${banner}')` : 'none';
  }
  if (document.getElementById('btnCreateNewHeroForTable')) document.getElementById('btnCreateNewHeroForTable').href = `/wizard?party_id=${partyId}`;
  if (document.getElementById('btnDmCreateCustomHero')) document.getElementById('btnDmCreateCustomHero').href = `/wizard?party_id=${partyId}`;
}

function switchPartyTab(tab) {
  if (!partyData.is_current_user_dm && ['dmScreen', 'dmNpcs', 'settings'].includes(tab)) {
    tab = 'playerHero';
  }

  currentActiveTab = tab;
  document.querySelectorAll('.party-tab-pane').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.party-tab-btn').forEach(btn => {
    btn.className = "party-tab-btn px-3.5 py-2 rounded-lg font-bold text-stone-400 hover:text-amber-200 transition-all";
    btn.classList.remove('active-tab');
    btn.style.backgroundColor = '';
    btn.style.boxShadow = '';
    btn.style.color = '';
  });

  const activePane = document.getElementById(`tabContent_${tab}`);
  if (activePane) activePane.classList.remove('hidden');

  const activeBtn = document.getElementById(`tabBtn${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (activeBtn) {
    activeBtn.classList.add('active-tab');
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--party-accent') || '#f59e0b';
    const glow = getComputedStyle(document.documentElement).getPropertyValue('--party-glow') || 'rgba(245,158,11,0.25)';
    activeBtn.style.backgroundColor = accent;
    activeBtn.style.color = '#0c0806';
    activeBtn.style.boxShadow = `0 4px 15px ${glow}`;
  }

  if (tab === 'chat') scrollChatToBottom();
}

async function rollStatCheck(statName, mod) {
  const heroName = myAttachedChar ? myAttachedChar.name : (currentUserData?.username || 'Герой');
  try {
    const res = await apiFetch(`/parties/${partyId}/roll-stat`, {
      method: 'POST',
      body: { stat_name: statName, stat_mod: mod, character_name: heroName }
    });
    if (res.ok) {
      const data = await res.json();
      const toast = document.getElementById('diceRollToast');
      document.getElementById('diceRollToastText').textContent = data.content;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 5000);
      loadChatMessages();
    }
  } catch (e) {}
}

function populateUserCharactersDropdown() {
  const sel = document.getElementById('userCharactersDropdown');
  if (!sel) return;
  if (!myCharactersList || myCharactersList.length === 0) {
    sel.innerHTML = '<option value="">У вас нет созданных персонажей</option>';
    return;
  }
  sel.innerHTML = myCharactersList.map(c => `
    <option value="${c.id}">${c.name} (${c.race} ${c.class_name} ${c.level} ур.)</option>
  `).join('');
}

async function attachSelectedCharacter() {
  const sel = document.getElementById('userCharactersDropdown');
  const charId = sel ? parseInt(sel.value) : null;
  if (!charId) { alert("Выберите персонажа!"); return; }

  try {
    const res = await apiFetch(`/parties/${partyId}/attach-character`, {
      method: 'POST',
      body: { character_id: charId }
    });
    if (res.ok) {
      partyData.my_character_id = charId;
      renderMyHeroSection();
      const updatedParty = await (await apiFetch(`/parties/${partyId}`)).json();
      partyData = updatedParty;
      renderSquadList();
      loadChatMessages();
    }
  } catch (e) {}
}

function showSelectCharacterDialog() {
  document.getElementById('attachedHeroBlock').classList.add('hidden');
  document.getElementById('noAttachedHeroBlock').classList.remove('hidden');
  populateUserCharactersDropdown();
}

async function adjustHeroHp(delta) {
  if (!myAttachedChar) return;
  const newHp = Math.max(0, Math.min(myAttachedChar.hp_max || 10, (myAttachedChar.hp_current || 0) + delta));
  try {
    const res = await apiFetch(`/parties/${partyId}/members/${myAttachedChar.id}/hp`, {
      method: 'PATCH',
      body: { hp_current: newHp }
    });
    if (res.ok) {
      myAttachedChar.hp_current = newHp;
      document.getElementById('myHeroHpText').textContent = `${newHp} / ${myAttachedChar.hp_max}`;
    }
  } catch (e) {}
}

// --- 1. МОЙ ПЕРСОНАЖ ---
async function renderMyHeroSection() {
  const attachedBlock = document.getElementById('attachedHeroBlock');
  const noAttachedBlock = document.getElementById('noAttachedHeroBlock');
  if (!attachedBlock || !noAttachedBlock) return;

  if (!partyData || !partyData.my_character_id) {
    attachedBlock.classList.add('hidden');
    noAttachedBlock.classList.remove('hidden');
    populateUserCharactersDropdown();
    return;
  }

  try {
    const res = await apiFetch(`/characters/${partyData.my_character_id}`);
    if (res.ok) {
      myAttachedChar = await res.json();
      noAttachedBlock.classList.add('hidden');
      attachedBlock.classList.remove('hidden');

      const elName = document.getElementById('myHeroName');
      const elSub = document.getElementById('myHeroSub');
      const elAc = document.getElementById('myHeroAc');
      const elSpeed = document.getElementById('myHeroSpeed');
      const elSheetBtn = document.getElementById('btnOpenFullSheet');

      if (elName) elName.textContent = myAttachedChar.name || 'Безымянный';
      if (elSub) elSub.textContent = `${myAttachedChar.race || 'Человек'} • ${myAttachedChar.class_name || 'Воин'} ${myAttachedChar.level || 1} ур.`;

      const dexMod = Math.floor((((myAttachedChar.stats || {}).dex || 10) - 10) / 2);
      if (elAc) elAc.textContent = myAttachedChar.armor_class || (10 + dexMod);
      if (elSpeed) elSpeed.textContent = `${myAttachedChar.speed || 30} фт.`;
      if (elSheetBtn) elSheetBtn.href = `/characters/${myAttachedChar.id}/sheet`;

      // 1. Полоска HP
      const curHp = myAttachedChar.hp_current !== undefined ? myAttachedChar.hp_current : 10;
      const maxHp = myAttachedChar.hp_max || 10;
      const hpConf = window.getHpBarConfig(curHp, maxHp);

      const elHpText = document.getElementById('myHeroHpText');
      if (elHpText) elHpText.textContent = hpConf.text;

      let heroBar = document.getElementById('myHeroProgressBar');
      if (!heroBar) {
        const hpBox = elHpText ? elHpText.closest('.p-4') : null;
        if (hpBox) {
          const barWrapper = document.createElement('div');
          barWrapper.className = "w-full bg-black/60 h-2.5 rounded-full overflow-hidden border border-orange-950/80 my-1.5 shadow-inner";
          barWrapper.innerHTML = `<div id="myHeroProgressBar" class="h-full bg-gradient-to-r ${hpConf.colorClass} transition-all duration-300" style="width: ${hpConf.pct}%;"></div>`;
          const btnRow = hpBox.querySelector('.pt-1');
          if (btnRow) hpBox.insertBefore(barWrapper, btnRow);
          else hpBox.appendChild(barWrapper);
        }
      } else {
        heroBar.style.width = `${hpConf.pct}%`;
        heroBar.className = `h-full bg-gradient-to-r ${hpConf.colorClass} transition-all duration-300`;
      }

      // 2. Баннер и аватарка
      const bannerBox = document.getElementById('myHeroBannerBox');
      const avatarImg = document.getElementById('myHeroAvatarImg');
      const avatarEmoji = document.getElementById('myHeroAvatarEmoji');

      const bannerSrc = myAttachedChar.banner_url || '';
      if (bannerBox) {
        bannerBox.style.backgroundImage = bannerSrc ? `url('${bannerSrc}')` : 'none';
      }

      const avatarSrc = myAttachedChar.avatar_url || bannerSrc || '';
      if (avatarImg && avatarEmoji) {
        if (avatarSrc) {
          avatarImg.src = avatarSrc;
          avatarImg.classList.remove('hidden');
          avatarEmoji.classList.add('hidden');
        } else {
          avatarImg.classList.add('hidden');
          avatarEmoji.classList.remove('hidden');
          avatarEmoji.textContent = getRaceEmoji(myAttachedChar.race);
        }
      }

      // 3. Сетка характеристик
      const statsGrid = document.getElementById('myHeroStatsGrid');
      if (statsGrid) {
        const s = myAttachedChar.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const statConfig = [
          { key: 'str', label: 'СИЛА' },
          { key: 'dex', label: 'ЛОВКОСТЬ' },
          { key: 'con', label: 'ТЕЛОСЛОЖ.' },
          { key: 'int', label: 'ИНТЕЛЛЕКТ' },
          { key: 'wis', label: 'МУДРОСТЬ' },
          { key: 'cha', label: 'ХАРИЗМА' }
        ];

        statsGrid.innerHTML = statConfig.map(cfg => {
          const val = s[cfg.key] !== undefined ? s[cfg.key] : 10;
          const mod = Math.floor((val - 10) / 2);
          const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
          return `
            <div onclick="rollStatCheck('${cfg.label}', ${mod})" title="Бросить d20 ${modStr}" class="p-2.5 rounded-xl bg-black/60 border border-orange-950 hover:border-amber-400 hover:bg-amber-950/30 cursor-pointer active:scale-95 transition-all group">
              <span class="text-[10px] text-amber-400/90 group-hover:text-amber-300 font-bold block">${cfg.label}</span>
              <strong class="text-base text-stone-100 block my-0.5">${val}</strong>
              <span class="text-[11px] font-bold text-amber-300 block bg-[#160f0b] rounded px-1 py-0.5 border border-orange-950/80">${modStr}</span>
            </div>
          `;
        }).join('');
      }
    } else {
      attachedBlock.classList.add('hidden');
      noAttachedBlock.classList.remove('hidden');
      populateUserCharactersDropdown();
    }
  } catch (e) {
    console.error("Ошибка renderMyHeroSection:", e);
    attachedBlock.classList.add('hidden');
    noAttachedBlock.classList.remove('hidden');
    populateUserCharactersDropdown();
  }
}

// --- 2. ОТРЯД ---
function renderSquadList() {
  const cont = document.getElementById('squadList');
  if (!cont) return;

  const members = (partyData && partyData.members) || [];
  if (members.length === 0) {
    cont.innerHTML = '<div class="col-span-full text-center py-6 text-stone-500 font-serif">В отряде пока никого нет.</div>';
    return;
  }

  cont.innerHTML = members.map(m => {
    const isLeader = m.is_dm ? '<span class="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/60 px-1.5 py-0.5 rounded shadow">👑 МАСТЕР</span>' : '';
    const charName = m.character_name
      ? `<a href="/characters/${m.character_id}/sheet" class="text-amber-200 font-serif font-bold text-base hover:text-amber-300 hover:underline transition-colors">${m.character_name}</a>`
      : '<span class="text-stone-500 text-xs italic">Персонаж не привязан</span>';

    const squadRace = m.character_race || 'Герой';
    const charClass = m.character_class
      ? `<span class="text-xs text-stone-300 font-serif block mt-0.5">${squadRace} • ${m.character_class}</span>`
      : '';

    // Полоска здоровья
    let hpBarHtml = '';
    if (m.character_id) {
      const cur = m.character_hp_current !== undefined ? m.character_hp_current : 10;
      const max = m.character_hp_max || 10;
      const conf = window.getHpBarConfig(cur, max);

      hpBarHtml = `
        <div class="space-y-1 w-28 sm:w-36">
          <div class="flex justify-between items-center text-[10px] font-mono">
            <span class="text-stone-400">Хиты:</span>
            <span class="font-bold text-amber-200">${conf.text}</span>
          </div>
          <div class="w-full bg-black/80 h-2 rounded-full overflow-hidden border border-orange-950 shadow-inner">
            <div class="h-full bg-gradient-to-r ${conf.colorClass} transition-all duration-300" style="width: ${conf.pct}%;"></div>
          </div>
        </div>
      `;
    }

    const bannerSrc = m.banner_url || '';
    const avatarSrc = m.avatar_url || bannerSrc || '';
    const bannerStyle = bannerSrc
      ? `background-image: linear-gradient(to top, rgba(18, 13, 9, 0.98) 0%, rgba(18, 13, 9, 0.45) 50%, rgba(18, 13, 9, 0.2) 100%), url('${bannerSrc}');`
      : `background-image: linear-gradient(135deg, #1f140e 0%, #120a06 100%);`;
    const raceEmoji = getRaceEmoji(squadRace);

    return `
      <div class="rounded-2xl border border-orange-950/80 bg-[#120d09] overflow-hidden flex flex-col justify-between shadow-xl relative group hover:border-amber-500/50 transition-all">
        <!-- Шапка с баннером героя -->
        <div class="h-24 sm:h-28 w-full relative bg-cover bg-center flex items-end p-3.5 transition-all" style="${bannerStyle}">
          <div class="relative z-10 flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-500/60 bg-stone-900 shrink-0 shadow-2xl flex items-center justify-center text-lg">
              ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover">` : `<span>${raceEmoji}</span>`}
            </div>
            <div>
              <strong class="text-stone-100 text-sm font-serif block drop-shadow-md">${m.username || 'Игрок'}</strong>
              <div class="flex items-center gap-1.5 mt-0.5">${isLeader}</div>
            </div>
          </div>
        </div>

        <!-- Нижняя плашка со статами -->
        <div class="p-3.5 space-y-2.5 flex flex-wrap justify-between items-center gap-2 bg-[#100b08]/90">
          <div>
            <div>${charName}</div>
            ${charClass}
          </div>
          <div class="flex items-center gap-3">
            ${hpBarHtml}
            ${m.character_id ? `<a href="/characters/${m.character_id}/sheet" class="px-3 py-1.5 rounded-xl bg-[#1c130d] border border-orange-900/60 hover:border-amber-400 text-amber-300 text-xs font-serif shadow-md transition-all active:scale-95">Лист &rarr;</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// Обновление полоски при кликах на кнопки -5/-1/+1/+5
async function adjustHeroHp(delta) {
  if (!myAttachedChar) return;
  const newHp = Math.max(0, Math.min(myAttachedChar.hp_max || 10, (myAttachedChar.hp_current || 0) + delta));
  try {
    const res = await apiFetch(`/parties/${partyId}/members/${myAttachedChar.id}/hp`, {
      method: 'PATCH',
      body: { hp_current: newHp }
    });
    if (res.ok) {
      myAttachedChar.hp_current = newHp;
      const hpConf = getHpBarConfig(newHp, myAttachedChar.hp_max || 10);
      const textEl = document.getElementById('myHeroHpText');
      if (textEl) textEl.textContent = hpConf.text;
      const barEl = document.getElementById('myHeroProgressBar');
      if (barEl) {
        barEl.style.width = `${hpConf.pct}%`;
        barEl.className = `h-full bg-gradient-to-r ${hpConf.colorClass} transition-all duration-300`;
      }
    }
  } catch (e) {}
}

async function savePlayerNotes() {
  const text = document.getElementById('playerNotesTextarea').value;
  try {
    const res = await apiFetch(`/parties/${partyId}/my-notes`, {
      method: 'PATCH',
      body: { notes: text }
    });
    if (res.ok) alert("Личные заметки сохранены!");
  } catch (e) {}
}

async function saveDmNotes() {
  const text = document.getElementById('dmNotesTextarea').value;
  try {
    const res = await apiFetch(`/parties/${partyId}/dm-notes`, {
      method: 'PATCH',
      body: { notes: text }
    });
    if (res.ok) alert("Сюжет кампании обновлен!");
  } catch (e) {}
}

function populateSettingsForm() {
  if (!partyData) return;
  const s = partyData.settings || {};
  const elName = document.getElementById('setPartyName');
  const elDesc = document.getElementById('setPartyDesc');
  const elBanner = document.getElementById('setPartyBanner');
  const elMax = document.getElementById('setMaxPlayers');
  const elTheme = document.getElementById('setThemeSelect');
  const elPriv = document.getElementById('setIsPrivateCheck');
  const elPwdRow = document.getElementById('setPasswordRow');

  if (elName) elName.value = partyData.name || '';
  if (elDesc) elDesc.value = partyData.description || '';
  if (elBanner) elBanner.value = s.banner_url || '';
  if (elMax) elMax.value = s.max_players || 6;
  if (elTheme) elTheme.value = s.theme || 'ember';
  if (elPriv) elPriv.checked = !!partyData.is_private;
  if (elPwdRow) elPwdRow.classList.toggle('hidden', !partyData.is_private);

  if (s.theme === 'custom' && s.custom_colors) {
    activeCustomColors = s.custom_colors;
    document.getElementById('customColorsBlock').classList.remove('hidden');
    if (s.custom_colors.accent) document.getElementById('pickerAccent').value = s.custom_colors.accent;
    if (s.custom_colors.border) document.getElementById('pickerBorder').value = s.custom_colors.border;
    if (s.custom_colors.cardBg) document.getElementById('pickerCardBg').value = s.custom_colors.cardBg;
    if (s.custom_colors.glow) document.getElementById('pickerGlow').value = s.custom_colors.glow;
  }
}

async function submitPartySettings(e) {
  e.preventDefault();
  const name = document.getElementById('setPartyName')?.value.trim() || '';
  const desc = document.getElementById('setPartyDesc')?.value.trim() || '';
  const banner = document.getElementById('setPartyBanner')?.value.trim() || '';
  const maxP = parseInt(document.getElementById('setMaxPlayers')?.value) || 6;
  const theme = document.getElementById('setThemeSelect')?.value || 'ember';
  const isPriv = document.getElementById('setIsPrivateCheck')?.checked || false;
  const pwd = document.getElementById('setPartyPassword')?.value;

  const payload = {
    name,
    description: desc,
    banner_url: banner,
    max_players: maxP,
    theme,
    is_private: isPriv,
    password: pwd || null,
    custom_colors: activeCustomColors
  };

  try {
    const res = await apiFetch(`/parties/${partyId}/settings`, {
      method: 'PATCH',
      body: payload
    });
    if (res.ok) {
      alert("Оформление и настройки стола успешно сохранены!");
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.detail || "Ошибка сохранения настроек");
    }
  } catch (e) {
    alert("Сбой сети: " + e.message);
  }
}

async function initPartyDetail() {
  try {
    const [uRes, pRes, charsRes] = await Promise.all([
      apiFetch('/auth/me'),
      apiFetch(`/parties/${partyId}`),
      apiFetch('/characters/')
    ]);

    if (uRes.ok) {
      currentUserData = await uRes.json();
      window.currentUserData = currentUserData; // <- сохраняем в window
    }
    if (pRes.ok) {
      partyData = await pRes.json();
      window.partyData = partyData; // <- сохраняем в window
    }
    if (charsRes.ok) myCharactersList = await charsRes.json();

    // Инициализируем боевой движок
    if (typeof initCombatState === 'function') initCombatState();

    if (!partyData) {
      alert("Не удалось загрузить данные стола.");
      window.location.href = '/parties-lobby';
      return;
    }

    try {
      const s = partyData.settings || {};
      applyPartyTheme(s.theme || 'ember', s.custom_colors || null);
      setupRoleView();
      renderPartyHeader();
    } catch (err) { console.error("Ошибка темы:", err); }

    try { renderMyHeroSection(); } catch (err) { console.error("Ошибка героя:", err); }
    try { renderSquadList(); } catch (err) { console.error("Ошибка отряда:", err); }
    try { renderRacesList(); } catch (err) { console.error("Ошибка рас:", err); }

    try {
      const pNotes = document.getElementById('playerNotesTextarea');
      if (pNotes) pNotes.value = partyData.my_notes || '';
      const dmNotes = document.getElementById('dmNotesTextarea');
      if (dmNotes && partyData.is_current_user_dm && partyData.dm_notes !== null) {
        dmNotes.value = partyData.dm_notes || '';
      }
    } catch (err) { console.error("Ошибка заметок:", err); }

    try { renderBattleMap(); } catch (err) { console.error("Ошибка карты:", err); }

    try {
      loadChatMessages();
      populateChatRecipients();
      if (chatInterval) clearInterval(chatInterval);
      chatInterval = setInterval(loadChatMessages, 3000);
    } catch (err) { console.error("Ошибка чата:", err); }

    if (partyData.is_current_user_dm) {
      try { renderDmScreen(); } catch (err) { console.error("Ошибка DM экрана:", err); }
      try { loadDmNpcs(); } catch (err) { console.error("Ошибка НИПов:", err); }
      try { populateSettingsForm(); } catch (err) { console.error("Ошибка формы настроек:", err); }
    }

    // Показываем кнопку баннера, если текущий пользователь — DM
    if (partyData && partyData.is_current_user_dm) {
      const dmBtn = document.getElementById('dmBannerUploadBtnBlock');
      if (dmBtn) {
        dmBtn.classList.remove('hidden');
      }
    }

    try {
      syncPartyAudio();
      setInterval(syncPartyAudio, 3000);
    } catch (err) { console.error("Ошибка аудио:", err); }

    try {
      initPartyWebSocket();
    } catch (err) { console.error("Ошибка вебсокета:", err); }

  } catch (e) {
    console.error("Глобальная ошибка инициализации стола:", e);
  }
}

// Обработчик загрузки баннера стола
async function uploadPartyBannerFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await apiFetch(`/parties/${partyId}/banner`, {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const bannerEl = document.getElementById("partyHeaderBanner");
      if (bannerEl) {
        bannerEl.style.backgroundImage = `url('${data.banner_url}')`;
      }
      alert("Баннер кампании успешно обновлен!");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Ошибка при загрузке баннера");
    }
  } catch (e) {
    console.error("Сбой загрузки баннера:", e);
    alert("Не удалось загрузить файл баннера");
  } finally {
    event.target.value = "";
  }
}

document.addEventListener('DOMContentLoaded', initPartyDetail);
