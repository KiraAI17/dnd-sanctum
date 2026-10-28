export class CanvasRenderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  render(activeTool = null, previewObj = null) {
    const ctx = this.ctx;
    const { width, height, gridSize, bgImage, objects, selectedObjectId } = this.state;

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Фоновый цвет
    ctx.fillStyle = '#0f0b08';
    ctx.fillRect(0, 0, width, height);

    // Фоновое изображение
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, width, height);
    }

    // Сетка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Отрисовка расставленных объектов
    objects.forEach(obj => this.drawObject(obj, obj.id === selectedObjectId));

    // Отрисовка предпросмотра текущего рисования
    if (previewObj) {
      this.drawObject(previewObj, false, true);
    }

    ctx.restore();
  }

  drawObject(obj, isSelected = false, isPreview = false) {
    const ctx = this.ctx;
    ctx.save();
    if (isPreview) ctx.globalAlpha = 0.6;

    if (obj.type === 'wall') {
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#e0f2fe';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(obj.x1, obj.y1);
      ctx.lineTo(obj.x2, obj.y2);
      ctx.stroke();
    } else if (obj.type === 'door') {
      ctx.fillStyle = obj.isLocked ? '#ef4444' : '#f59e0b';
      ctx.fillRect(obj.x - 12, obj.y - 12, 24, 24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(obj.x - 12, obj.y - 12, 24, 24);
      ctx.font = '14px serif';
      ctx.fillStyle = '#000';
      ctx.fillText(obj.isLocked ? '🔒' : '🚪', obj.x - 7, obj.y + 5);
    } else if (obj.type === 'light') {
      // Факел / свет
      const grad = ctx.createRadialGradient(obj.x, obj.y, 5, obj.x, obj.y, obj.radius || 80);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius || 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.type === 'hazard') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
