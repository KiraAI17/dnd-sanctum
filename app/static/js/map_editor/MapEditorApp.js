import { MapState } from './MapState.js';
import { CanvasRenderer } from './CanvasRenderer.js';

export class MapEditorApp {
  constructor() {
    this.state = new MapState();
    this.canvas = document.getElementById('editorCanvas');
    this.renderer = new CanvasRenderer(this.canvas, this.state);
    this.currentTool = 'select'; // 'select' | 'wall' | 'door' | 'light' | 'hazard'
    this.isDrawing = false;
    this.dragStart = null;
    this.previewObj = null;
  }

  init() {
    this.bindEvents();
    this.renderer.render();
  }

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => {
      b.className = "tool-btn px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 text-xs font-bold hover:border-amber-400";
    });
    const active = document.getElementById(`tool_${tool}`);
    if (active) active.className = "tool-btn px-3 py-1.5 rounded-lg bg-amber-400 text-stone-950 text-xs font-bold shadow";
  }

  setGridSize(val) {
    this.state.gridSize = Math.max(20, Math.min(150, parseInt(val) || 50));
    this.renderer.render();
  }

  snap(val) {
    const g = this.state.gridSize;
    return Math.round(val / g) * g;
  }

  clearObjects() {
    if (confirm("Удалить все расставленные стены, двери и источники света?")) {
      this.state.clear();
      this.renderer.render();
    }
  }

  bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.currentTool === 'wall' || this.currentTool === 'hazard') {
        this.isDrawing = true;
        this.dragStart = { x: this.snap(x), y: this.snap(y) };
      } else if (this.currentTool === 'door') {
        this.state.addObject({ type: 'door', x: this.snap(x), y: this.snap(y), isLocked: false });
        this.renderer.render();
      } else if (this.currentTool === 'light') {
        this.state.addObject({ type: 'light', x: Math.round(x), y: Math.round(y), radius: 100 });
        this.renderer.render();
      }
    });

    c.addEventListener('mousemove', (e) => {
      if (!this.isDrawing || !this.dragStart) return;
      const rect = c.getBoundingClientRect();
      const curX = this.snap(e.clientX - rect.left);
      const curY = this.snap(e.clientY - rect.top);

      if (this.currentTool === 'wall') {
        this.previewObj = { type: 'wall', x1: this.dragStart.x, y1: this.dragStart.y, x2: curX, y2: curY };
        this.renderer.render(this.currentTool, this.previewObj);
      } else if (this.currentTool === 'hazard') {
        this.previewObj = {
          type: 'hazard',
          x: Math.min(this.dragStart.x, curX),
          y: Math.min(this.dragStart.y, curY),
          w: Math.abs(curX - this.dragStart.x),
          h: Math.abs(curY - this.dragStart.y)
        };
        this.renderer.render(this.currentTool, this.previewObj);
      }
    });

    c.addEventListener('mouseup', (e) => {
      if (!this.isDrawing || !this.dragStart) return;
      const rect = c.getBoundingClientRect();
      const endX = this.snap(e.clientX - rect.left);
      const endY = this.snap(e.clientY - rect.top);

      if (this.currentTool === 'wall') {
        if (this.dragStart.x !== endX || this.dragStart.y !== endY) {
          this.state.addObject({ type: 'wall', x1: this.dragStart.x, y1: this.dragStart.y, x2: endX, y2: endY });
        }
      } else if (this.currentTool === 'hazard') {
        const w = Math.abs(endX - this.dragStart.x);
        const h = Math.abs(endY - this.dragStart.y);
        if (w > 0 && h > 0) {
          this.state.addObject({
            type: 'hazard',
            x: Math.min(this.dragStart.x, endX),
            y: Math.min(this.dragStart.y, endY),
            w, h,
            name: "Опасная зона"
          });
        }
      }

      this.isDrawing = false;
      this.dragStart = null;
      this.previewObj = null;
      this.renderer.render();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.isDrawing = false;
        this.dragStart = null;
        this.previewObj = null;
        this.renderer.render();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        this.state.undo();
        this.renderer.render();
      }
    });
  }

  loadBgImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.state.bgImage = img;
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.state.width = img.width;
        this.state.height = img.height;
        this.renderer.render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.state.fromJSON(data);
        this.canvas.width = this.state.width;
        this.canvas.height = this.state.height;
        const gridInput = document.getElementById('editorGridSize');
        if (gridInput) gridInput.value = this.state.gridSize;
        this.renderer.render();
        alert("Карта успешно импортирована!");
      } catch (err) {
        alert("Ошибка чтения JSON-файла: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  exportJson() {
    const jsonStr = JSON.stringify(this.state.toJSON(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dnd_map_${Date.now()}.json`;
    a.click();
  }
}

// Создаем глобальный экземпляр
window.mapEditor = new MapEditorApp();
document.addEventListener('DOMContentLoaded', () => {
  window.mapEditor.init();
});