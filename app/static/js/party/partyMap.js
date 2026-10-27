let mapData = null;

async function renderBattleMap() {
  try {
    const res = await apiFetch(`/parties/${partyId}/map`);
    if (res.ok) {
      mapData = await res.json();
      const canvas = document.getElementById('battleMapCanvas');
      if (mapData.image_url) {
        canvas.style.backgroundImage = `url('${mapData.image_url}')`;
        document.getElementById('mapBackgroundInput').value = mapData.image_url;
      }

      const tokens = mapData.tokens || [];
      canvas.innerHTML = tokens.map(t => `
        <div id="token_${t.id}" onmousedown="dragMapToken(event, '${t.id}')" class="absolute w-10 h-10 rounded-full border-2 border-amber-400 bg-stone-900/90 text-amber-200 font-bold text-xs flex items-center justify-center cursor-move shadow-xl select-none group" style="left: ${t.x}px; top: ${t.y}px;">
          <span>${t.name.slice(0, 2)}</span>
          <div class="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-serif text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            ${t.name}
          </div>
        </div>
      `).join('');
    }
  } catch (e) {}
}

async function saveMapBackground() {
  const url = document.getElementById('mapBackgroundInput').value.trim();
  if (!url) return;
  try {
    const res = await apiFetch(`/parties/${partyId}/map`, {
      method: 'PATCH',
      body: { image_url: url }
    });
    if (res.ok) renderBattleMap();
  } catch (e) {}
}

async function addMapToken() {
  const name = prompt("Имя токена (герой или монстр):", "Гоблин");
  if (!name) return;
  const tokens = mapData.tokens || [];
  tokens.push({
    id: "tok_" + Date.now(),
    name: name,
    x: 50 + (tokens.length * 30),
    y: 50 + (tokens.length * 20),
    color: "#f59e0b"
  });
  try {
    await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    renderBattleMap();
  } catch (e) {}
}

function dragMapToken(e, tokenId) {
  e.preventDefault();
  const el = document.getElementById(`token_${tokenId}`);
  const canvas = document.getElementById('battleMapCanvas');
  const rect = canvas.getBoundingClientRect();

  function onMouseMove(ev) {
    let x = ev.clientX - rect.left - 20;
    let y = ev.clientY - rect.top - 20;
    x = Math.max(0, Math.min(canvas.clientWidth - 40, x));
    y = Math.max(0, Math.min(canvas.clientHeight - 40, y));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  async function onMouseUp(ev) {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const x = parseInt(el.style.left) || 0;
    const y = parseInt(el.style.top) || 0;

    const tokens = mapData.tokens || [];
    const tok = tokens.find(t => t.id === tokenId);
    if (tok) {
      tok.x = x;
      tok.y = y;
      await apiFetch(`/parties/${partyId}/map`, { method: 'PATCH', body: { tokens: tokens } });
    }
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
