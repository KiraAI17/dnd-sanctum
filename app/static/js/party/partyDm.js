let dmNpcsList = [];
let selectedNpcGroup = 'all';
let compendiumRacesCache = [];

function renderDmScreen() {
  if (!partyData || !partyData.is_current_user_dm) return;
  const cont = document.getElementById('dmPlayersList');
  if (!cont) return;

  const players = (partyData.members || []).filter(m => !m.is_dm);
  if (players.length === 0) {
    cont.innerHTML = '<div class="text-center py-8 text-stone-500 font-serif">За столом пока нет игроков с персонажами.</div>';
    return;
  }

  cont.innerHTML = players.map(m => {
    const curHp = m.character_hp_current || 0;
    const maxHp = m.character_hp_max || 10;
    const bannerStyle = m.banner_url ? `background-image: url('${m.banner_url}'); background-size: cover; background-position: center;` : '';
    const avatarSrc = (m.avatar_url && m.avatar_url.trim()) ? m.avatar_url : ((m.banner_url && m.banner_url.trim()) ? m.banner_url : '');
    const raceEmoji = getRaceEmoji(m.character_race);

    return `
      <div class="rounded-xl border border-orange-950/80 bg-[#140e0a] overflow-hidden shadow-lg flex flex-col justify-between">
        <div class="h-16 w-full relative bg-[#1a100a] flex items-end p-2.5" style="${bannerStyle}">
          ${m.banner_url ? '<div class="absolute inset-0 bg-gradient-to-t from-[#140e0a] via-[#140e0a]/60 to-transparent"></div>' : ''}
          <div class="relative z-10 flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-lg overflow-hidden border border-amber-500/50 bg-stone-900 shrink-0 flex items-center justify-center text-sm shadow">
              ${avatarSrc ? `<img src="${avatarSrc}" class="w-full h-full object-cover">` : `<span>${raceEmoji}</span>`}
            </div>
            <div>
              <span class="text-stone-300 text-[11px] font-serif block drop-shadow">Игрок: <strong>${m.username}</strong></span>
              ${m.character_name ? `<span class="text-amber-200 font-serif font-bold text-sm drop-shadow">«${m.character_name}»</span>` : '<span class="text-stone-500 italic text-xs">Без героя</span>'}
            </div>
          </div>
        </div>

        <div class="p-3.5 flex flex-wrap justify-between items-center gap-3">
          <div class="text-stone-400 text-xs font-serif">
            ${m.character_class || 'Класс не выбран'} • КД: <strong class="text-amber-300 font-mono">${m.character_ac || 10}</strong>
          </div>

          ${m.character_id ? `
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 font-mono text-xs">
                <button onclick="dmAdjustPlayerHp(${m.character_id}, -5)" class="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900 text-rose-300 hover:bg-rose-900">-5</button>
                <button onclick="dmAdjustPlayerHp(${m.character_id}, -1)" class="px-2 py-0.5 rounded bg-rose-950/40 border border-rose-900 text-rose-300 hover:bg-rose-900">-1</button>
                <span class="px-2.5 py-0.5 bg-black/60 rounded border border-orange-950 text-foxOrange-400 font-bold min-w-[70px] text-center" id="dmHpDisplay_${m.character_id}">${curHp} / ${maxHp} HP</span>
                <button onclick="dmAdjustPlayerHp(${m.character_id}, 1)" class="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900 text-emerald-300 hover:bg-emerald-900">+1</button>
                <button onclick="dmAdjustPlayerHp(${m.character_id}, 5)" class="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900 text-emerald-300 hover:bg-emerald-900">+5</button>
              </div>
              <a href="/characters/${m.character_id}/sheet" class="px-3 py-1 rounded bg-[#1c130d] border border-orange-900/60 hover:border-amber-400 text-amber-200 text-xs font-serif">
                Лист &rarr;
              </a>
            </div>
          ` : '<span class="text-stone-500 text-xs italic">Персонаж не привязан</span>'}
        </div>
      </div>
    `;
  }).join('');
}

async function dmAdjustPlayerHp(charId, delta) {
  const member = partyData.members.find(m => m.character_id === charId);
  const curHp = member ? (member.character_hp_current || 0) : 10;
  const maxHp = member ? (member.character_hp_max || 10) : 10;
  const newHp = Math.max(0, Math.min(maxHp, curHp + delta));

  try {
    const res = await apiFetch(`/parties/${partyId}/members/${charId}/hp`, {
      method: 'PATCH',
      body: { hp_current: newHp }
    });
    if (res.ok) {
      if (member) member.character_hp_current = newHp;
      const el = document.getElementById(`dmHpDisplay_${charId}`);
      if (el) el.textContent = `${newHp} / ${maxHp} HP`;
    }
  } catch (e) {}
}

function filterNpcGroup(group) {
  selectedNpcGroup = group;
  renderNpcCards();
}

function renderNpcCards() {
  const grid = document.getElementById('dmNpcsGrid');
  if (!grid) return;

  let list = dmNpcsList || [];
  if (selectedNpcGroup !== 'all') {
    list = list.filter(n => (n.class_name || '').toLowerCase().includes(selectedNpcGroup.toLowerCase()) ||
                            (n.backstory || '').toLowerCase().includes(selectedNpcGroup.toLowerCase()));
  }

  if (list.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center py-6 text-stone-500 font-serif">В этой группе пока нет НИПов.</div>';
    return;
  }

  grid.innerHTML = list.map(n => `
    <div class="fox-card p-4 rounded-xl border border-orange-950/80 bg-[#120d09] space-y-2 shadow flex flex-col justify-between">
      <div>
        <div class="flex justify-between items-start">
          <h4 class="font-serif font-bold text-amber-200 text-sm">${n.name}</h4>
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-800">${n.class_name || 'НИП'}</span>
            <button type="button" onclick="deleteNpc(${n.id})" title="Удалить НИПа" class="text-stone-500 hover:text-rose-400 p-1 text-xs">
              🗑️
            </button>
          </div>
        </div>
        <span class="text-[11px] text-stone-400 font-serif block">${n.race}</span>
        <p class="text-[11px] text-stone-400 font-serif line-clamp-2 mt-1">${n.backstory || ''}</p>
      </div>

      <div class="pt-2 border-t border-orange-950/60 flex justify-between items-center">
        <span class="font-mono text-foxOrange-400 font-bold text-xs">${n.hp_current}/${n.hp_max} HP</span>
        <a href="/characters/${n.id}/sheet" class="px-2.5 py-1 rounded bg-[#1c130d] border border-orange-900 text-amber-200 text-xs font-serif hover:border-amber-400">Лист</a>
      </div>
    </div>
  `).join('');
}

async function loadDmNpcs() {
  try {
    const res = await apiFetch(`/parties/${partyId}/npcs`);
    if (res.ok) {
      dmNpcsList = await res.json();
      const cnt = document.getElementById('dmNpcsCount');
      if (cnt) cnt.textContent = dmNpcsList.length;
      renderNpcCards();
    }
  } catch (e) {
    console.error("Ошибка загрузки НИПов:", e);
  }
}

async function deleteNpc(npcId) {
  if (!confirm("Вы уверены, что хотите удалить этого НИПа?")) return;
  try {
    let res = await apiFetch(`/characters/${npcId}`, { method: 'DELETE' });
    if (!res.ok && res.status === 404) {
      res = await apiFetch(`/parties/${partyId}/npcs/${npcId}`, { method: 'DELETE' });
    }

    if (res.ok || res.status === 204) {
      dmNpcsList = (dmNpcsList || []).filter(n => n.id !== npcId);
      const cnt = document.getElementById('dmNpcsCount');
      if (cnt) cnt.textContent = dmNpcsList.length;
      renderNpcCards();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Не удалось удалить НИПа.");
    }
  } catch (e) {
    alert("Сбой сети при удалении: " + e.message);
  }
}

function openQuickNpcModal() { document.getElementById('quickNpcModal').classList.remove('hidden'); }
function closeQuickNpcModal() { document.getElementById('quickNpcModal').classList.add('hidden'); }

async function submitQuickNpc(e) {
  e.preventDefault();
  const name = document.getElementById('npcNameInput').value.trim();
  const race = document.getElementById('npcRaceInput').value.trim();
  const cClass = document.getElementById('npcClassInput').value.trim();
  const hp = parseInt(document.getElementById('npcHpInput').value) || 20;
  const ac = parseInt(document.getElementById('npcAcInput').value) || 12;
  const notes = document.getElementById('npcNotesInput').value.trim();

  try {
    const res = await apiFetch(`/parties/${partyId}/npc`, {
      method: 'POST',
      body: { name, race, class_name: cClass, hp_max: hp, armor_class: ac, notes }
    });
    if (res.ok) {
      closeQuickNpcModal();
      loadDmNpcs();
    }
  } catch (e) {}
}

function renderRacesList() {
  const grid = document.getElementById('partyRacesGrid');
  if (!grid) return;
  const races = partyData.custom_races || [];
  document.getElementById('partyRacesCount').textContent = races.length;

  if (races.length === 0) {
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-stone-500 font-serif">В этой кампании пока нет авторских рас.</div>';
    return;
  }

  grid.innerHTML = races.map(r => {
    const isDm = !!partyData.is_current_user_dm;
    const deleteBtn = isDm ? `
      <button type="button" onclick="deletePartyRace('${r.id}')" title="Удалить расу из стола" class="text-stone-500 hover:text-rose-400 p-1 text-xs transition-colors">
        🗑️
      </button>
    ` : '';

    return `
      <div class="fox-card p-4 rounded-xl border border-orange-950/80 bg-[#120d09] space-y-2 shadow flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center">
            <h4 class="font-serif font-bold text-amber-200 text-sm flex items-center gap-1.5">${r.name}</h4>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-mono text-stone-400">${r.speed || 30} фт.</span>
              ${deleteBtn}
            </div>
          </div>
          <p class="text-[11px] text-stone-400 font-serif line-clamp-3 mt-1">${r.description || 'Описание отсутствует.'}</p>
        </div>
        ${r.dm_only ? '<span class="text-[9px] font-mono text-amber-400">👑 Только для DM</span>' : ''}
      </div>
    `;
  }).join('');
}

async function deletePartyRace(raceId) {
  if (!confirm("Удалить эту расу из стола?")) return;
  try {
    const res = await apiFetch(`/parties/${partyId}/races/${raceId}`, { method: 'DELETE' });
    if (res.ok) {
      partyData.custom_races = (partyData.custom_races || []).filter(r => r.id !== raceId);
      renderRacesList();
    } else {
      const err = await res.json();
      alert(err.detail || "Не удалось удалить расу.");
    }
  } catch (e) {
    alert("Сбой сети: " + e.message);
  }
}

function switchRaceModalTab(tab) {
  const tabComp = document.getElementById('modalTab_compendiumRaces');
  const tabNew = document.getElementById('modalTab_newRace');
  const btnComp = document.getElementById('tabBtnCompendiumRaces');
  const btnNew = document.getElementById('tabBtnNewRace');

  if (tab === 'compendium') {
    tabComp.classList.remove('hidden');
    tabNew.classList.add('hidden');
    btnComp.className = 'pb-2.5 font-bold border-b-2 border-amber-400 text-amber-300 transition-all';
    btnNew.className = 'pb-2.5 font-bold border-b-2 border-transparent text-stone-400 hover:text-amber-200 transition-all';
    loadCompendiumRacesForModal();
  } else {
    tabComp.classList.add('hidden');
    tabNew.classList.remove('hidden');
    btnNew.className = 'pb-2.5 font-bold border-b-2 border-amber-400 text-amber-300 transition-all';
    btnComp.className = 'pb-2.5 font-bold border-b-2 border-transparent text-stone-400 hover:text-amber-200 transition-all';
  }
}

async function openPartyRaceModal() {
  document.getElementById('partyRaceModal').classList.remove('hidden');
  switchRaceModalTab('compendium');
}

function closePartyRaceModal() {
  document.getElementById('partyRaceModal').classList.add('hidden');
}

async function loadCompendiumRacesForModal() {
  const listCont = document.getElementById('compendiumRacesList');
  if (!listCont) return;

  try {
    listCont.innerHTML = '<div class="text-center py-6 text-stone-500 text-xs font-serif">Загрузка рас из компендиума...</div>';
    const res = await apiFetch('/compendium/races?is_dm=true');
    if (!res.ok) {
      listCont.innerHTML = '<div class="text-center py-6 text-rose-400 text-xs font-serif">Ошибка загрузки рас из компендиума.</div>';
      return;
    }

    const allRaces = await res.json();
    compendiumRacesCache = allRaces;

    const existingNames = new Set((partyData.custom_races || []).map(r => r.name.toLowerCase()));

    if (allRaces.length === 0) {
      listCont.innerHTML = '<div class="text-center py-6 text-stone-500 text-xs font-serif">В компендиуме пока нет доступных рас.</div>';
      return;
    }

    listCont.innerHTML = allRaces.map((r, idx) => {
      const isAlreadyAdded = existingNames.has(r.name.toLowerCase());
      const tag = r.is_custom
        ? '<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-300 font-bold">Авторская</span>'
        : '<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">Базовая</span>';

      return `
        <div class="p-3 rounded-xl border border-orange-950/70 bg-[#120d09] flex flex-wrap justify-between items-center gap-3 shadow hover:border-amber-500/40 transition-all">
          <div class="space-y-0.5 max-w-sm">
            <div class="flex items-center gap-2">
              <strong class="text-amber-200 font-serif text-xs">${r.name}</strong>
              ${tag}
              <span class="text-[10px] font-mono text-stone-400">${r.speed || 30} фт.</span>
            </div>
            <p class="text-[11px] text-stone-400 font-serif line-clamp-2">${r.description || 'Описание отсутствует.'}</p>
          </div>
          <div>
            ${isAlreadyAdded ? `
              <span class="text-[11px] font-serif text-emerald-400 flex items-center gap-1 font-bold">
                ✓ В столе
              </span>
            ` : `
              <button type="button" onclick="attachRaceFromCompendium(${idx})" class="px-3 py-1.5 rounded-lg bg-amber-400 text-stone-950 font-bold text-xs font-serif hover:brightness-110 active:scale-95 transition-all">
                ＋ Добавить к столу
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    listCont.innerHTML = `<div class="text-center py-6 text-rose-400 text-xs font-serif">Ошибка: ${e.message}</div>`;
  }
}

async function attachRaceFromCompendium(idx) {
  const race = compendiumRacesCache[idx];
  if (!race) return;

  try {
    const res = await apiFetch(`/parties/${partyId}/races`, {
      method: 'POST',
      body: {
        name: race.name,
        speed: race.speed || 30,
        description: race.description || '',
        ability_bonuses: race.ability_bonuses || {},
        traits: race.traits || [],
        dm_only: !!race.dm_only
      }
    });
    if (res.ok) {
      const newRace = await res.json();
      partyData.custom_races = partyData.custom_races || [];
      partyData.custom_races.push(newRace);
      renderRacesList();
      loadCompendiumRacesForModal();
    } else {
      const err = await res.json();
      alert(err.detail || "Не удалось добавить расу.");
    }
  } catch (e) {
    alert("Сбой сети: " + e.message);
  }
}

async function submitPartyRace(e) {
  e.preventDefault();
  const name = document.getElementById('prNameInput').value.trim();
  const speed = parseInt(document.getElementById('prSpeedInput').value) || 30;
  const desc = document.getElementById('prDescInput').value.trim();
  const dmOnly = document.getElementById('prDmOnlyCheck').checked;

  const bonuses = {
    str: parseInt(document.getElementById('prStat_str')?.value) || 0,
    dex: parseInt(document.getElementById('prStat_dex')?.value) || 0,
    con: parseInt(document.getElementById('prStat_con')?.value) || 0,
    int: parseInt(document.getElementById('prStat_int')?.value) || 0,
    wis: parseInt(document.getElementById('prStat_wis')?.value) || 0,
    cha: parseInt(document.getElementById('prStat_cha')?.value) || 0,
  };

  try {
    const res = await apiFetch(`/parties/${partyId}/races`, {
      method: 'POST',
      body: { name, speed, description: desc, traits: [], dm_only: dmOnly, ability_bonuses: bonuses }
    });
    if (res.ok) {
      closePartyRaceModal();
      const updated = await (await apiFetch(`/parties/${partyId}`)).json();
      partyData = updated;
      renderRacesList();
    } else {
      const err = await res.json();
      alert(err.detail || "Не удалось создать расу.");
    }
  } catch (e) {
    alert("Сбой сети: " + e.message);
  }
}
