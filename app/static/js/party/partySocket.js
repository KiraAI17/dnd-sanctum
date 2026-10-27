let partySocket = null;

function initPartyWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/parties/${partyId}/ws`;

  partySocket = new WebSocket(wsUrl);

  partySocket.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);

      // 1. Тема стола
      if (data.type === 'theme_update') {
        applyPartyTheme(data.theme, data.custom_colors);
        if (partyData && partyData.settings) {
          partyData.settings.theme = data.theme;
          partyData.settings.custom_colors = data.custom_colors;
        }
      }

      // 2. Обновление HP
      if (data.type === 'hp_update') {
        const conf = getHpBarConfig(data.hp_current, data.hp_max);

        // 1. Обновляем блок "Мой персонаж"
        if (myAttachedChar && myAttachedChar.id === data.character_id) {
          myAttachedChar.hp_current = data.hp_current;
          const elHp = document.getElementById('myHeroHpText');
          if (elHp) elHp.textContent = conf.text;
          const barEl = document.getElementById('myHeroProgressBar');
          if (barEl) {
            barEl.style.width = `${conf.pct}%`;
            barEl.className = `h-full bg-gradient-to-r ${conf.colorClass} transition-all duration-300`;
          }
        }

        // 2. Обновляем строку на ширме Мастера
        const dmHp = document.getElementById(`dmHpDisplay_${data.character_id}`);
        if (dmHp) dmHp.textContent = conf.text;
        const dmBar = document.getElementById(`dmHpBar_${data.character_id}`);
        if (dmBar) {
          dmBar.style.width = `${conf.pct}%`;
          dmBar.className = `h-full bg-gradient-to-r ${conf.colorClass} transition-all duration-300`;
        }

        // 3. Обновляем список отряда
        if (partyData && partyData.members) {
          const member = partyData.members.find(m => m.character_id === data.character_id);
          if (member) {
            member.character_hp_current = data.hp_current;
            member.character_hp_max = data.hp_max;
            renderSquadList();
          }
        }
      }

      // 3. Динамические токены и карта
      if (data.type === 'map_update') {
        mapData = data.map_data;
        renderBattleMap();
      }
    } catch (err) {
      console.error("Ошибка парсинга WS события:", err);
    }
  };

  partySocket.onclose = function() {
    setTimeout(initPartyWebSocket, 3000);
  };
}
