let audioState = null;
let isAudioMutedByUser = false;
let playMode = 'loop';

async function syncPartyAudio() {
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`);
    if (!res.ok) return;
    const remoteState = await res.json();
    audioState = remoteState;

    const player = document.getElementById('globalAudioPlayer');
    const miniTitle = document.getElementById('miniTrackTitle');
    const miniStatus = document.getElementById('miniTrackStatus');
    const playBtn = document.getElementById('btnMiniPlayToggle');

    if (!player) return;

    if (miniTitle) miniTitle.textContent = remoteState.track_title || 'Тишина';
    if (miniStatus) miniStatus.textContent = remoteState.is_playing ? (playMode === 'loop' ? '🔁 Зациклено' : '▶ Играет') : 'Пауза';
    if (playBtn) playBtn.textContent = remoteState.is_playing ? '⏸' : '▶';

    if (remoteState.current_track_url) {
      const currentPath = new URL(player.src || 'http://dummy', window.location.origin).pathname;
      const targetPath = new URL(remoteState.current_track_url, window.location.origin).pathname;

      if (currentPath !== targetPath) {
        player.src = remoteState.current_track_url;
      }
    }

    player.loop = (playMode === 'loop');

    if (remoteState.is_playing && !isAudioMutedByUser) {
      if (player.paused) {
        player.play().catch(() => {});
      }
    } else {
      if (!player.paused) {
        player.pause();
      }
    }

    renderPlaylistItems();
  } catch (e) {}
}

function renderPlaylistItems() {
  const listCont = document.getElementById('partyPlaylistContainer');
  if (!listCont || !audioState) return;
  const pl = audioState.playlist || [];

  if (pl.length === 0) {
    listCont.innerHTML = '<div class="text-center py-6 text-stone-500 font-serif text-xs">Плейлист пока пуст.</div>';
    return;
  }

  listCont.innerHTML = pl.map((t, idx) => `
    <div class="p-3 rounded-xl border border-orange-950/80 bg-[#0a0705] flex justify-between items-center text-xs font-serif shadow">
      <div class="flex items-center gap-2">
        <span class="text-amber-400 font-mono">0${idx+1}.</span>
        <strong class="text-stone-200">${t.title}</strong>
      </div>
      ${partyData && partyData.is_current_user_dm ? `
        <div class="flex items-center gap-2">
          <button type="button" onclick="playTrackFromList('${t.url}', '${t.title}')" class="px-3 py-1 rounded bg-amber-400 text-stone-950 font-bold hover:brightness-110">
            Включить ▶
          </button>
          <button type="button" onclick="deletePartyAudioTrack(${idx})" title="Удалить трек" class="p-1 text-stone-500 hover:text-rose-400 text-xs">
            🗑️
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function deletePartyAudioTrack(idx) {
  if (!confirm("Удалить этот трек из плейлиста?")) return;
  const pl = ((audioState && audioState.playlist) || []).filter((_, i) => i !== idx);
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`, {
      method: 'PATCH',
      body: { playlist: pl }
    });
    if (res.ok) await syncPartyAudio();
  } catch (e) {
    alert("Ошибка удаления трека: " + e.message);
  }
}

async function stopAndResetPartyAudio() {
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`, {
      method: 'PATCH',
      body: { current_track_url: '', track_title: 'Тишина', is_playing: false }
    });
    if (res.ok) {
      const player = document.getElementById('globalAudioPlayer');
      if (player) {
        player.pause();
        player.src = '';
      }
      await syncPartyAudio();
    }
  } catch (e) {}
}

function togglePlayMode() {
  playMode = (playMode === 'loop') ? 'queue' : 'loop';
  const btn = document.getElementById('btnTogglePlayMode');
  if (btn) btn.textContent = playMode === 'loop' ? '🔁 Зацикливание' : '📑 Очередь треков';
  const player = document.getElementById('globalAudioPlayer');
  if (player) player.loop = (playMode === 'loop');
}

async function togglePartyAudioPlay() {
  if (!partyData.is_current_user_dm) {
    isAudioMutedByUser = !isAudioMutedByUser;
    const p = document.getElementById('globalAudioPlayer');
    if (isAudioMutedByUser) p.pause(); else p.play().catch(() => {});
    document.getElementById('btnMiniPlayToggle').textContent = isAudioMutedByUser ? '🔇' : '▶';
    return;
  }

  const nextState = !audioState.is_playing;
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`, {
      method: 'PATCH',
      body: { is_playing: nextState }
    });
    if (res.ok) syncPartyAudio();
  } catch (e) {}
}

async function playTrackFromList(url, title) {
  if (!partyData.is_current_user_dm) return;
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`, {
      method: 'PATCH',
      body: { current_track_url: url, track_title: title, is_playing: true }
    });
    if (res.ok) syncPartyAudio();
  } catch (e) {}
}

async function uploadMp3Track(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const btn = document.getElementById('btnUploadMp3Label');
  if (btn) btn.textContent = '⏳ Загрузка на сервер...';

  try {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || sessionStorage.getItem('token') || sessionStorage.getItem('access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token.replace(/^Bearer\s+/i, '')}`;

    const res = await fetch(`/parties/${partyId}/audio/upload`, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: formData
    });

    if (res.ok) {
      closeAddTrackModal();
      await syncPartyAudio();
      alert("Трек успешно загружен в плейлист кампании!");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Не удалось загрузить аудиофайл.");
    }
  } catch (e) {
    alert("Ошибка отправки файла: " + e.message);
  } finally {
    if (btn) btn.textContent = '📁 Загрузить файл с устройства (MP3/OGG)';
    const inp = document.getElementById('fileUploadInput');
    if (inp) inp.value = '';
  }
}

function openAddTrackModal() { document.getElementById('addTrackModal').classList.remove('hidden'); }
function closeAddTrackModal() { document.getElementById('addTrackModal').classList.add('hidden'); }

async function submitAddTrack() {
  const title = document.getElementById('newTrackTitle').value.trim();
  const url = document.getElementById('newTrackUrl').value.trim();
  if (!title || !url) { alert("Укажите название и ссылку!"); return; }

  const pl = (audioState && audioState.playlist) || [];
  pl.push({ title: title, url: url });
  try {
    const res = await apiFetch(`/parties/${partyId}/audio`, {
      method: 'PATCH',
      body: { playlist: pl }
    });
    if (res.ok) {
      closeAddTrackModal();
      syncPartyAudio();
    }
  } catch (e) {}
}

document.addEventListener('click', () => {
  const p = document.getElementById('globalAudioPlayer');
  if (p && audioState && audioState.is_playing && !isAudioMutedByUser) {
    p.play().catch(() => {});
  }
}, { once: true });

document.getElementById('globalAudioPlayer')?.addEventListener('ended', async () => {
  if (playMode === 'queue' && partyData && partyData.is_current_user_dm) {
    const pl = (audioState && audioState.playlist) || [];
    if (pl.length <= 1) return;
    const currentIdx = pl.findIndex(t => t.url === audioState.current_track_url);
    const nextIdx = (currentIdx + 1) % pl.length;
    const nextTrack = pl[nextIdx];
    await playTrackFromList(nextTrack.url, nextTrack.title);
  }
});