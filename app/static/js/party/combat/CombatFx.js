/**
 * CombatFx.js
 * Настоящий 3D-движок для дайсов D&D (d4, d6, d8, d10, d12, d20, d100)
 * Увеличенный масштаб, честный выбор геометрии под каждый куб,
 * отсутствие автозакрытия и отмена AOE-прицеливания по Escape / ПКМ.
 */
export class CombatFx {
  constructor() {
    this.activeAoe = null;
    this.animFrameId = null;
  }

  detectDiceSides(title, comment) {
    const text = `${title} ${comment}`.toLowerCase();
    // Ищем d4, d6, d8, d10, d12, d20, d100 или русские аналоги к4, к6...
    const match = text.match(/[dкDК](100|20|12|10|8|6|4)/i);
    if (match) {
      return parseInt(match[1]);
    }
    return 20;
  }

  getGeometry(sides) {
    switch (sides) {
      case 4: return this.getD4Geometry();
      case 6: return this.getD6Geometry();
      case 8: return this.getD8Geometry();
      case 10: return this.getD10Geometry();
      case 12: return this.getD12Geometry();
      case 100: return this.getD10Geometry();
      case 20:
      default: return this.getD20Geometry();
    }
  }

  getD4Geometry() {
    const a = 1.05 / Math.sqrt(3);
    const vertices = [
      [ a, a, a],
      [-a, -a, a],
      [-a, a, -a],
      [ a, -a, -a]
    ];
    const faces = [
      [0, 2, 1],
      [0, 1, 3],
      [0, 3, 2],
      [1, 2, 3]
    ];
    return { vertices, faces };
  }

  getD6Geometry() {
    const s = 0.95;
    const vertices = [
      [-s,-s,-s], [ s,-s,-s], [ s, s,-s], [-s, s,-s],
      [-s,-s, s], [ s,-s, s], [ s, s, s], [-s, s, s]
    ];
    const faces = [
      [0, 2, 1], [0, 3, 2],
      [4, 5, 6], [4, 6, 7],
      [0, 1, 5], [0, 5, 4],
      [2, 3, 7], [2, 7, 6],
      [0, 4, 7], [0, 7, 3],
      [1, 2, 6], [1, 6, 5]
    ];
    return { vertices, faces };
  }

  getD8Geometry() {
    const s = 1.35;
    const vertices = [
      [ s, 0, 0], [-s, 0, 0],
      [ 0, s, 0], [ 0,-s, 0],
      [ 0, 0, s], [ 0, 0,-s]
    ];
    const faces = [
      [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
      [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]
    ];
    return { vertices, faces };
  }

  getD10Geometry() {
    const vertices = [];
    const faces = [];
    const h = 1.3;
    const r = 1.15;
    vertices.push([0, h, 0]);
    vertices.push([0, -h, 0]);

    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      const y = (i % 2 === 0) ? 0.35 : -0.35;
      vertices.push([r * Math.cos(angle), y, r * Math.sin(angle)]);
    }

    for (let i = 0; i < 10; i++) {
      const cur = 2 + i;
      const next = 2 + ((i + 1) % 10);
      if (i % 2 === 0) {
        faces.push([0, cur, next]);
      } else {
        faces.push([1, next, cur]);
      }
    }
    return { vertices, faces };
  }

  getD12Geometry() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const a = 0.8;
    const b = 0.8 / phi;
    const c = 0.8 * phi;

    const rawVertices = [
      [-a,-a,-a], [-a,-a, a], [-a, a,-a], [-a, a, a],
      [ a,-a,-a], [ a,-a, a], [ a, a,-a], [ a, a, a],
      [ 0,-b,-c], [ 0,-b, c], [ 0, b,-c], [ 0, b, c],
      [-b,-c, 0], [-b, c, 0], [ b,-c, 0], [ b, c, 0],
      [-c, 0,-b], [-c, 0, b], [ c, 0,-b], [ c, 0, b]
    ];

    const faces = [
      [3, 11, 7], [3, 7, 15], [3, 15, 13],
      [7, 19, 17], [7, 11, 19], [11, 9, 19],
      [1, 9, 11], [1, 11, 3], [1, 3, 17],
      [12, 1, 17], [12, 17, 16], [12, 16, 0],
      [8, 0, 16], [8, 16, 2], [8, 2, 10],
      [4, 8, 10], [4, 10, 6], [4, 6, 18],
      [5, 4, 18], [5, 18, 19], [5, 19, 9],
      [14, 5, 9], [14, 9, 1], [14, 1, 12],
      [14, 12, 0], [14, 0, 8], [14, 8, 4],
      [15, 7, 6], [15, 6, 2], [15, 2, 13],
      [13, 2, 16], [13, 16, 17], [13, 17, 3],
      [18, 6, 10], [18, 10, 8], [18, 8, 4]
    ];
    return { vertices: rawVertices, faces };
  }

  getD20Geometry() {
    const t = ((1 + Math.sqrt(5)) / 2) * 0.85;
    const s = 0.85;

    const vertices = [
      [-s, t, 0], [ s, t, 0], [-s, -t, 0], [ s, -t, 0],
      [ 0, -s, t], [ 0, s, t], [ 0, -s, -t], [ 0, s, -t],
      [ t, 0, -s], [ t, 0, s], [ -t, 0, -s], [ -t, 0, s]
    ];

    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    return { vertices, faces };
  }

  /**
   * Отрисовка увеличенного 3D-многогранника с честным освещением граней
   */
  init3dCanvas(canvas, sides, finalValue, isCrit, isFail) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const geom = this.getGeometry(sides);
    const vertices = geom.vertices;
    const faces = geom.faces;

    let rotX = 0.2;
    let rotY = 0.3;
    let rotZ = 0.1;
    let velX = 15.0;
    let velY = 20.0;
    let velZ = 12.0;

    const startTime = performance.now();
    const duration = 1100;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = w * 0.42; // Увеличенный размер куба

    const renderLoop = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      const damp = Math.pow(1.0 - progress, 2.4);

      rotX += velX * 0.016 * damp;
      rotY += velY * 0.016 * damp;
      rotZ += velZ * 0.016 * damp;

      if (progress >= 0.85) {
        const snap = (progress - 0.85) / 0.15;
        rotX = rotX * (1 - snap * 0.25);
        rotY = rotY * (1 - snap * 0.25);
      }

      ctx.clearRect(0, 0, w, h);

      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);

      const projected = vertices.map(v => {
        let x = v[0], y = v[1], z = v[2];

        let y1 = y * cosX - z * sinX;
        let z1 = y * sinX + z * cosX;

        let x2 = x * cosY + z1 * sinY;
        let z2 = -x * sinY + z1 * cosY;

        let x3 = x2 * cosZ - y1 * sinZ;
        let y3 = x2 * sinZ + y1 * cosZ;

        const fov = 3.2;
        const pz = z2 + fov;
        const px = (x3 / pz) * scale + cx;
        const py = (y3 / pz) * scale + cy;

        return { x: px, y: py, z: z2 };
      });

      const renderedFaces = faces.map(f => {
        const p0 = projected[f[0]];
        const p1 = projected[f[1]];
        const p2 = projected[f[2]];

        const avgZ = (p0.z + p1.z + p2.z) / 3;

        const ax = p1.x - p0.x, ay = p1.y - p0.y;
        const bx = p2.x - p0.x, by = p2.y - p0.y;
        const normalZ = ax * by - ay * bx;

        return { f, avgZ, normalZ, p0, p1, p2 };
      });

      renderedFaces
        .filter(rf => rf.normalZ > 0)
        .sort((a, b) => a.avgZ - b.avgZ)
        .forEach(rf => {
          const { p0, p1, p2 } = rf;
          const lightNorm = Math.min(1.0, Math.max(0.18, (rf.avgZ + 1.4) / 2.2));

          let baseR = 217, baseG = 119, baseB = 6;
          if (isCrit) { baseR = 16; baseG = 185; baseB = 129; }
          if (isFail) { baseR = 225; baseG = 29; baseB = 72; }

          const r = Math.round(baseR * lightNorm);
          const g = Math.round(baseG * lightNorm);
          const b = Math.round(baseB * lightNorm);

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.closePath();

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fill();

          ctx.strokeStyle = `rgba(251, 191, 36, 0.55)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

      if (progress < 1.0) {
        this.animFrameId = requestAnimationFrame(renderLoop);
      }
    };

    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  /**
   * Модальное окно без автоматического закрытия по таймеру
   */
  showDiceModal(title, rollVal, modVal, totalVal, comment = '') {
    let modal = document.getElementById('combatDiceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'combatDiceModal';
      modal.className = "fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none";
      document.body.appendChild(modal);
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const sides = this.detectDiceSides(title, comment);
    const isNat20 = (sides === 20 && rollVal === 20);
    const isNat1 = (sides === 20 && rollVal === 1);

    modal.innerHTML = `
      <div id="diceModalCard" class="fox-card border-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.4)] rounded-3xl p-6 max-w-sm w-full text-center space-y-4 bg-[#120a06] border-2 font-serif relative shadow-2xl transition-all duration-300">

        <div class="flex items-center justify-between border-b border-orange-950/80 pb-2">
          <span class="text-xs font-mono px-2.5 py-1 rounded bg-black/70 text-amber-400 border border-orange-950 uppercase font-bold tracking-wider">
            🎲 d${sides}
          </span>
          <h3 class="text-xs uppercase tracking-widest text-stone-300 font-mono truncate max-w-[200px]">${this.escape(title)}</h3>
          <button type="button" onclick="document.getElementById('combatDiceModal').remove()" class="text-stone-400 hover:text-amber-300 font-bold text-lg leading-none">&times;</button>
        </div>

        <!-- Увеличенная область 3D сцены (190x190) -->
        <div class="relative w-48 h-48 mx-auto flex items-center justify-center">
          <canvas id="dice3dCanvas" width="190" height="190" class="w-full h-full drop-shadow-[0_15px_30px_rgba(0,0,0,0.95)]"></canvas>

          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span id="rollingDiceNumber" class="text-4xl font-mono font-black text-amber-100 drop-shadow-[0_4px_14px_rgba(0,0,0,1)]">
              ${Math.floor(Math.random() * sides) + 1}
            </span>
          </div>
        </div>

        <div class="text-xs text-stone-300 font-mono bg-black/60 py-2.5 px-3 rounded-xl border border-orange-950/80">
          Бросок: <strong class="text-amber-300 text-base" id="finalDiceDisplay">...</strong>
          ${modVal !== 0 ? `(${modVal >= 0 ? '+' + modVal : modVal}) = <strong class="text-amber-200 text-base">${totalVal}</strong>` : ''}
        </div>

        <p id="diceResultComment" class="text-xs font-serif text-amber-300 font-bold leading-relaxed min-h-[1.5rem] whitespace-pre-line"></p>

        <button type="button" onclick="document.getElementById('combatDiceModal').remove()"
                class="w-full py-2.5 rounded-xl bg-gradient-to-r from-foxOrange-600 to-amber-500 text-stone-950 font-bold text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-lg">
          Принять
        </button>
      </div>
    `;

    const canvas = document.getElementById('dice3dCanvas');
    if (canvas) {
      this.init3dCanvas(canvas, sides, rollVal, isNat20, isNat1);
    }

    const numEl = document.getElementById('rollingDiceNumber');
    const finalEl = document.getElementById('finalDiceDisplay');
    const cardEl = document.getElementById('diceModalCard');
    const commentEl = document.getElementById('diceResultComment');

    let frame = 0;
    const interval = setInterval(() => {
      if (numEl) {
        if (sides === 100) {
          numEl.textContent = (Math.floor(Math.random() * 10) * 10).toString().padStart(2, '0');
        } else {
          numEl.textContent = Math.floor(Math.random() * sides) + 1;
        }
      }
      frame++;

      if (frame >= 14) {
        clearInterval(interval);
        if (numEl) numEl.textContent = rollVal;
        if (finalEl) finalEl.textContent = rollVal;
        if (commentEl) commentEl.textContent = comment;

        if (isNat20 && cardEl) {
          cardEl.className = cardEl.className.replace('border-amber-500/80', 'border-emerald-500 shadow-[0_0_55px_rgba(16,185,129,0.9)]');
          numEl.className = numEl.className.replace('text-amber-100', 'text-emerald-400 animate-pulse');
        } else if (isNat1 && cardEl) {
          cardEl.className = cardEl.className.replace('border-amber-500/80', 'border-rose-600 shadow-[0_0_55px_rgba(244,63,94,0.9)]');
          numEl.className = numEl.className.replace('text-amber-100', 'text-rose-500');
        }
      }
    }, 65);
    // Автоматический таймаут удален: окно закрывается только вручную
  }

  /**
   * Интерактивный AOE-прицел с кнопкой отмены и отменой по Escape / ПКМ
   */
  startAoeTargeting(spellData, onConfirmCallback, onCancelCallback) {
    const canvas = document.getElementById('battleMapCanvas');
    if (!canvas) return;

    let overlay = document.getElementById('aoeTargetingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aoeTargetingOverlay';
      overlay.className = "absolute rounded-full border-2 border-rose-500 bg-rose-500/25 pointer-events-none z-40 hidden shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse";
      canvas.appendChild(overlay);
    }

    // Создаем плавающую плашку подсказки и кнопки отмены
    let cancelBar = document.getElementById('aoeCancelBar');
    if (!cancelBar) {
      cancelBar = document.createElement('div');
      cancelBar.id = 'aoeCancelBar';
      cancelBar.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#120a06]/95 border border-amber-500/70 shadow-2xl px-4 py-2.5 rounded-2xl flex items-center gap-4 text-xs font-serif text-amber-200 select-none backdrop-blur-md";
      document.body.appendChild(cancelBar);
    }

    const radiusFeet = spellData.radiusFeet || 20;
    const gridSize = window.currentGridSize || 50;
    // Радиус в пикселях: (радиус / 5) * размер_клетки
    const radiusPx = (radiusFeet / 5) * gridSize;
    const diameterPx = radiusPx * 2;

    overlay.style.width = diameterPx + 'px';
    overlay.style.height = diameterPx + 'px';

    cancelBar.innerHTML = `
      <span>🎯 Область: <b>${spellData.name}</b> (радиус ${radiusFeet} фт / ${radiusFeet / 5} кл.)</span>
      <button type="button" id="btnCancelAoeTargeting" class="px-3 py-1 rounded-lg bg-rose-950 border border-rose-600 hover:bg-rose-900 text-rose-200 font-bold active:scale-95 transition-all">
        Отменить каст (Esc)
      </button>
    `;
    cancelBar.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      cancelBar.classList.add('hidden');
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      overlay.style.left = (curX - radiusPx) + 'px';
      overlay.style.top = (curY - radiusPx) + 'px';
      overlay.classList.remove('hidden');
    };

    const onClick = (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;
      cleanup();
      onConfirmCallback({ centerX, centerY, radiusPx, spellData });
    };

    const onCancel = () => {
      cleanup();
      if (typeof onCancelCallback === 'function') onCancelCallback();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      onCancel();
    };

    document.getElementById('btnCancelAoeTargeting').onclick = onCancel;
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('contextmenu', onContextMenu);
  }

  triggerFx(targetTokenId, type = 'slash') {
    const tokenEl = document.getElementById(`token_${targetTokenId}`);
    if (!tokenEl) return;

    const fx = document.createElement('div');
    fx.className = "absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-ping duration-300";

    if (type === 'slash') {
      fx.innerHTML = `<span class="text-3xl filter drop-shadow-[0_0_15px_rgba(244,63,94,1)]">⚔️</span>`;
    } else if (type === 'fire') {
      fx.innerHTML = `<span class="text-4xl filter drop-shadow-[0_0_20px_rgba(245,158,11,1)]">💥</span>`;
    } else if (type === 'heal') {
      fx.innerHTML = `<span class="text-3xl filter drop-shadow-[0_0_15px_rgba(16,185,129,1)]">✨</span>`;
    }

    tokenEl.appendChild(fx);
    setTimeout(() => fx.remove(), 600);
  }

  escape(text) {
    if (!text) return '';
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}