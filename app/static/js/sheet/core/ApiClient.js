// Безопасный вызов apiFetch из base.html внутри ES6-модулей
const fetchApi = (...args) => (window.apiFetch ? window.apiFetch(...args) : fetch(...args));

export class ApiClient {
  constructor(charId) {
    this.charId = charId;
  }

  async getCharacter() {
    const res = await fetchApi(`/characters/${this.charId}`);
    if (!res.ok) throw new Error("Не удалось загрузить данные персонажа");
    return await res.json();
  }

  async patchHp(currentHp) {
    return await fetchApi(`/characters/${this.charId}/hp`, {
      method: 'PATCH',
      body: { hp_current: currentHp }
    });
  }

  async levelUp(payload) {
    return await fetchApi(`/characters/${this.charId}/level-up`, {
      method: 'POST',
      body: payload
    });
  }

  async patchVisual(payload) {
    return await fetchApi(`/characters/${this.charId}/visual`, {
      method: 'PATCH',
      body: payload
    });
  }

  async patchBackstory(text) {
    return await fetchApi(`/characters/${this.charId}/backstory`, {
      method: 'PATCH',
      body: { backstory: text }
    });
  }

  async roll(formula) {
    return await fetchApi(`/characters/${this.charId}/roll`, {
      method: 'POST',
      body: { formula }
    });
  }

  async rest(restType) {
    return await fetchApi(`/characters/${this.charId}/rest`, {
      method: 'POST',
      body: { rest_type: restType }
    });
  }
}