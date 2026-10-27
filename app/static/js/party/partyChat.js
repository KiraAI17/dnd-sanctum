let chatInterval = null;

function populateChatRecipients() {
  const sel = document.getElementById('chatRecipientSelect');
  if (!sel || !partyData.members) return;
  const currentUserId = currentUserData ? currentUserData.id : null;

  sel.innerHTML = '<option value="">Всем за столом</option>';
  partyData.members.forEach(m => {
    if (m.user_id !== currentUserId) {
      const roleLabel = m.is_dm ? '(👑 Мастер)' : (m.character_name ? `(${m.character_name})` : '');
      sel.innerHTML += `<option value="${m.user_id}">Шёпот: ${m.username} ${roleLabel}</option>`;
    }
  });
}

async function loadChatMessages() {
  try {
    const res = await apiFetch(`/parties/${partyId}/messages`);
    if (!res.ok) return;
    const msgs = await res.json();
    renderChatMessages(msgs);
  } catch (e) {}
}

function renderChatMessages(msgs) {
  const feed = document.getElementById('chatMessagesFeed');
  const pinnedCont = document.getElementById('pinnedMessagesContainer');
  if (!feed) return;

  const pinned = msgs.filter(m => m.is_pinned);
  if (pinned.length > 0) {
    pinnedCont.classList.remove('hidden');
    pinnedCont.innerHTML = pinned.map(p => `
      <div class="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex justify-between items-center text-xs font-serif shadow-md">
        <div class="flex items-center gap-2">
          <span class="text-sm">📌</span>
          <div><span class="font-bold text-amber-300">${p.sender_name}:</span> <span class="text-stone-200">${p.content}</span></div>
        </div>
        ${partyData.is_current_user_dm ? `<button onclick="togglePinMessage(${p.id})" class="text-stone-400 hover:text-amber-200 text-xs font-bold px-1.5 py-0.5 rounded bg-black/40 border border-orange-900">&times;</button>` : ''}
      </div>
    `).join('');
  } else {
    pinnedCont.classList.add('hidden');
  }

  if (msgs.length === 0) {
    feed.innerHTML = '<div class="text-center py-12 text-stone-500 italic">Летопись стола пуста. Начните общение или бросьте кубик!</div>';
    return;
  }

  feed.innerHTML = msgs.map(m => {
    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let borderClass = 'border-orange-950/60 bg-[#0d0907]';
    let tagBadge = '';

    if (m.message_type === 'roll') {
      borderClass = 'border-amber-500/40 bg-gradient-to-r from-[#181109] to-[#120d09] shadow';
      tagBadge = '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-foxOrange-600/30 text-foxOrange-300 border border-foxOrange-600/50 font-bold">КУБИКИ</span>';
    } else if (m.message_type === 'secret_roll') {
      borderClass = 'border-amber-600/60 bg-[#160f0a]';
      tagBadge = '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/60 font-bold">ЗА ШИРМОЙ</span>';
    } else if (m.message_type === 'whisper') {
      borderClass = 'border-purple-900/60 bg-[#140b18]';
      tagBadge = `<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-900/40 text-purple-300 border border-purple-800">ШЁПОТ</span>`;
    } else if (m.message_type === 'system') {
      borderClass = 'border-blue-900/60 bg-[#0a0f18] text-stone-300';
      tagBadge = '<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-900/40 text-blue-300 border border-blue-800">ЛЕТОПИСЬ</span>';
    }

    return `
      <div class="p-2.5 rounded-xl border ${borderClass} space-y-1">
        <div class="flex justify-between items-center text-[10px] font-mono">
          <div class="flex items-center gap-1.5">
            <strong class="text-amber-300 font-serif text-xs">${m.sender_name}</strong>
            ${tagBadge}
          </div>
          <span class="text-stone-500">${timeStr}</span>
        </div>
        <p class="text-stone-200 font-serif text-xs leading-relaxed break-words">${m.content}</p>
      </div>
    `;
  }).join('');
}

function scrollChatToBottom() {
  const feed = document.getElementById('chatMessagesFeed');
  if (feed) feed.scrollTop = feed.scrollHeight;
}

async function submitChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInputText');
  const text = input.value.trim();
  if (!text) return;

  const sel = document.getElementById('chatRecipientSelect');
  const whisperId = sel.value ? parseInt(sel.value) : null;
  const pinCheck = document.getElementById('chatIsPinnedCheck');

  try {
    const res = await apiFetch(`/parties/${partyId}/messages`, {
      method: 'POST',
      body: { content: text, whisper_to_id: whisperId, is_pinned: pinCheck ? pinCheck.checked : false }
    });
    if (res.ok) {
      input.value = '';
      if (pinCheck) pinCheck.checked = false;
      await loadChatMessages();
      scrollChatToBottom();
    }
  } catch (e) {}
}

async function togglePinMessage(msgId) {
  try {
    const res = await apiFetch(`/parties/${partyId}/messages/${msgId}/pin`, { method: 'PATCH' });
    if (res.ok) loadChatMessages();
  } catch (e) {}
}

async function executeDmSecretRoll() {
  const dice = parseInt(document.getElementById('dmSecretDiceSelect').value) || 20;
  const mod = parseInt(document.getElementById('dmSecretModInput').value) || 0;
  const title = document.getElementById('dmSecretTitleInput').value.trim() || 'Тайная проверка';

  try {
    const res = await apiFetch(`/parties/${partyId}/secret-roll`, {
      method: 'POST',
      body: { dice_sides: dice, modifier: mod, title: title }
    });
    if (res.ok) {
      const data = await res.json();
      const resBox = document.getElementById('dmSecretRollResult');
      resBox.textContent = `🎯 ${title}: ${data.result}`;
      resBox.classList.remove('hidden');
      loadChatMessages();
    }
  } catch (e) {}
}






