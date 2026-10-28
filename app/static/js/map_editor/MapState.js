export class MapState {
  constructor() {
    this.gridSize = 50;
    this.width = 1200;
    this.height = 800;
    this.bgImage = null;
    this.bgImageUrl = '';
    this.objects = [];
    this.selectedObjectId = null;
    this.history = [];
    this.historyIndex = -1;
  }

  addObject(obj) {
    obj.id = obj.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.objects.push(obj);
    this.saveSnapshot();
  }

  removeObject(id) {
    this.objects = this.objects.filter(o => o.id !== id);
    if (this.selectedObjectId === id) this.selectedObjectId = null;
    this.saveSnapshot();
  }

  clear() {
    this.objects = [];
    this.selectedObjectId = null;
    this.saveSnapshot();
  }

  saveSnapshot() {
    const snap = JSON.stringify(this.objects);
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    this.historyIndex++;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.objects = JSON.parse(this.history[this.historyIndex]);
    }
  }

  toJSON() {
    return {
      version: 1,
      grid_size: this.gridSize,
      width: this.width,
      height: this.height,
      bg_url: this.bgImageUrl,
      objects: this.objects
    };
  }

  fromJSON(data) {
    if (!data) return;
    this.gridSize = data.grid_size || 50;
    this.width = data.width || 1200;
    this.height = data.height || 800;
    this.bgImageUrl = data.bg_url || '';
    this.objects = Array.isArray(data.objects) ? data.objects : [];
    this.saveSnapshot();
  }
}

