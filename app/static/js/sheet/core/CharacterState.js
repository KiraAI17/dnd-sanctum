export class CharacterState {
  constructor(initialData = null) {
    this.data = initialData;
    this.listeners = new Map();
  }

  get() {
    return this.data;
  }

  set(newData) {
    this.data = newData;
    this.emit('change', this.data);
  }

  updateHp(current, max = null) {
    if (!this.data) return;
    this.data.hp_current = current;
    if (max !== null) this.data.hp_max = max;
    this.emit('hp_change', { current: this.data.hp_current, max: this.data.hp_max });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(payload));
    }
  }
}

