/**
 * 抹茶幸運輪盤抽籤模組 (Canvas 繪製與動畫)
 */
const WheelModule = {
  canvas: null,
  ctx: null,
  candidates: [],
  colors: ['#768A73', '#E8DCCF', '#D99B68', '#C87D75', '#6B8BA4', '#4A3E3D', '#8CA089', '#E2A676'],
  startAngle: 0,
  isSpinning: false,
  history: [],

  mode: 'student', // 'student' | 'group'

  init() {
    this.canvas = document.getElementById('wheelCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.loadCandidatesFromInput();
    this.bindEvents();
    this.drawWheel();

    // 點擊輪盤畫布或中間按鈕直接開始抽籤
    this.canvas.addEventListener('click', () => {
      this.spin();
    });

    // 點擊畫面任意處關閉中獎彈窗
    document.getElementById('winnerOverlay')?.addEventListener('click', () => {
      this.hideWinnerOverlay();
    });

    // 監聽班級變更連動 (自動重置中獎彈窗、歷史紀錄與名條)
    window.addEventListener('rosterUpdated', () => {
      this.resetOnClassSwitch();
    });
  },

  resetOnClassSwitch() {
    this.isSpinning = false;
    this.history = [];
    this.hideWinnerOverlay();

    const historyList = document.getElementById('winnerHistoryList');
    if (historyList) {
      historyList.innerHTML = '<div class="text-center text-muted" style="padding:10px; font-size:0.85rem;">尚無抽中紀錄</div>';
    }

    if (this.mode === 'student') {
      this.syncFromRoster();
    } else {
      this.syncGroups();
    }
  },

  bindEvents() {
    document.getElementById('wheelModeStudentBtn')?.addEventListener('click', () => {
      this.switchWheelMode('student');
    });

    document.getElementById('wheelModeGroupBtn')?.addEventListener('click', () => {
      this.switchWheelMode('group');
    });

    document.getElementById('spinBtn')?.addEventListener('click', () => {
      this.spin();
    });

    document.getElementById('wheelFullscreenBtn')?.addEventListener('click', () => {
      const card = document.querySelector('.wheel-canvas-card');
      if (!card) return;
      if (!document.fullscreenElement) {
        if (card.requestFullscreen) card.requestFullscreen();
        else card.classList.add('is-fullscreen');
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else card.classList.remove('is-fullscreen');
      }
    });

    document.getElementById('wheelCandidatesText')?.addEventListener('input', () => {
      this.loadCandidatesFromInput();
      this.drawWheel();
    });

    document.getElementById('wheelImportRosterBtn')?.addEventListener('click', () => {
      this.syncFromRoster();
    });

    document.getElementById('resetWheelHistoryBtn')?.addEventListener('click', () => {
      this.resetHistory();
    });
  },

  resetHistory() {
    if (this.history.length === 0 && this.candidates.length > 0) {
      alert('目前無抽中歷史紀錄！');
      return;
    }

    if (confirm('確定要清空抽中紀錄，並將所有已移除的名字全部恢復回輪盤中重新抽籤嗎？')) {
      // 1. 將被剔除的名字加回候選清單
      this.history.forEach(name => {
        if (!this.candidates.includes(name)) {
          this.candidates.push(name);
        }
      });

      // 2. 若為空，從班級名冊重新載入
      if (this.candidates.length === 0) {
        const students = StorageManager.getActiveClassStudents();
        this.candidates = students.map(s => s.name);
      }

      // 3. 清空歷史並更新 UI
      this.history = [];
      const textarea = document.getElementById('wheelCandidatesText');
      if (textarea) textarea.value = this.candidates.join('\n');

      this.renderHistory();
      this.drawWheel();
    }
  },

  switchWheelMode(newMode) {
    this.mode = newMode;
    document.getElementById('wheelModeStudentBtn')?.classList.toggle('active', newMode === 'student');
    document.getElementById('wheelModeGroupBtn')?.classList.toggle('active', newMode === 'group');

    this.history = [];
    this.renderHistory();

    if (newMode === 'student') {
      this.syncFromRoster();
    } else {
      this.syncGroups();
    }
  },

  syncGroups() {
    const groups = StorageManager.get(StorageManager.KEYS.GROUPS, []);
    let groupNames = [];

    if (groups && groups.length > 0) {
      groupNames = groups.map(g => g.name);
    } else {
      groupNames = ['第 1 組', '第 2 組', '第 3 組', '第 4 組'];
    }

    const textarea = document.getElementById('wheelCandidatesText');
    if (textarea) textarea.value = groupNames.join('\n');

    this.candidates = groupNames;
    this.drawWheel();
  },

  syncFromRoster() {
    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) return alert('目前班級沒有學生名單！');

    const names = students.map(s => s.name);
    const textarea = document.getElementById('wheelCandidatesText');
    if (textarea) textarea.value = names.join('\n');

    this.candidates = names;
    this.drawWheel();
  },

  loadCandidatesFromInput() {
    const text = document.getElementById('wheelCandidatesText')?.value || '';
    this.candidates = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  },

  drawWheel() {
    if (!this.ctx) return;
    const num = this.candidates.length;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = width / 2 - 10;

    this.ctx.clearRect(0, 0, width, height);

    if (num === 0) {
      this.ctx.save();
      this.ctx.fillStyle = '#E8DCCF';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#4A3E3D';
      this.ctx.font = "24px 'Iansui', sans-serif";
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('請輸入抽籤名單', cx, cy);
      this.ctx.restore();
      return;
    }

    const arcSize = (Math.PI * 2) / num;

    for (let i = 0; i < num; i++) {
      const angle = this.startAngle + i * arcSize;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.fillStyle = this.colors[i % this.colors.length];
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius, angle, angle + arcSize);
      this.ctx.lineTo(cx, cy);
      this.ctx.fill();
      this.ctx.strokeStyle = '#FAF6F0';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // 繪製文字
      this.ctx.translate(cx, cy);
      this.ctx.rotate(angle + arcSize / 2);
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = (i % 2 === 0) ? '#FFF' : '#3D3231';
      this.ctx.font = "bold 20px 'Iansui', sans-serif";
      this.ctx.fillText(this.candidates[i], radius - 25, 6);
      this.ctx.restore();
    }

    // 繪製中心鈕與「抽籤」標籤
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    this.ctx.fillStyle = '#4A3E3D';
    this.ctx.fill();
    this.ctx.strokeStyle = '#FAF6F0';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    this.ctx.fillStyle = '#FAF6F0';
    this.ctx.font = "bold 15px 'Iansui', sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('抽籤', cx, cy);
    this.ctx.restore();
  },

  spin() {
    if (this.isSpinning) return;
    this.loadCandidatesFromInput();
    if (this.candidates.length === 0) return alert('請先輸入抽籤名單！');

    this.isSpinning = true;
    const spinAngleStart = Math.random() * 10 + 15;
    let spinTime = 0;
    const spinTimeTotal = Math.random() * 3000 + 4000;

    const rotateWheel = () => {
      spinTime += 30;
      if (spinTime >= spinTimeTotal) {
        this.stopRotate();
        return;
      }
      const spinAngle = spinAngleStart - this.easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
      this.startAngle += (spinAngle * Math.PI) / 180;
      this.drawWheel();
      AudioEngine.playTick();
      requestAnimationFrame(rotateWheel);
    };

    rotateWheel();
  },

  easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
  },

  stopRotate() {
    this.isSpinning = false;
    const num = this.candidates.length;
    const degrees = (this.startAngle * 180) / Math.PI + 90;
    const arcd = 360 / num;
    const index = Math.floor((360 - (degrees % 360)) / arcd) % num;

    const winner = this.candidates[index];
    
    AudioEngine.playFanfare();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

    // 顯示客製化畫面中彈窗
    this.showWinnerOverlay(winner, index);
  },

  showWinnerOverlay(winner, index) {
    const nameEl = document.getElementById('winnerOverlayName');
    const subEl = document.getElementById('winnerOverlaySub');
    const detailsEl = document.getElementById('winnerOverlayDetails');
    const overlay = document.getElementById('winnerOverlay');

    if (nameEl) nameEl.textContent = winner;

    if (this.mode === 'group') {
      if (subEl) subEl.textContent = '🎉 恭 喜 小 組 抽 中';
      const groups = StorageManager.get(StorageManager.KEYS.GROUPS, []);
      const g = groups.find(item => item.name === winner);
      if (g && g.members && g.members.length > 0) {
        const memberNames = g.members.map(m => m.name).join('、');
        if (detailsEl) {
          detailsEl.textContent = `成員：${memberNames}`;
          detailsEl.classList.remove('hidden');
        }
      } else {
        if (detailsEl) detailsEl.classList.add('hidden');
      }
    } else {
      if (subEl) subEl.textContent = '恭 喜 抽 中';
      if (detailsEl) detailsEl.classList.add('hidden');
    }

    if (overlay) overlay.classList.remove('hidden');

    this.history.push(winner);
    this.renderHistory();

    // 紀錄是否需要於關閉時自動剔除
    const removeCheck = document.getElementById('removeAfterWinCheck');
    if (removeCheck && removeCheck.checked) {
      this.pendingRemoveIndex = index;
    } else {
      this.pendingRemoveIndex = null;
    }
  },

  hideWinnerOverlay() {
    const overlay = document.getElementById('winnerOverlay');
    if (overlay) overlay.classList.add('hidden');

    if (this.pendingRemoveIndex !== null && this.pendingRemoveIndex !== undefined) {
      this.candidates.splice(this.pendingRemoveIndex, 1);
      this.pendingRemoveIndex = null;
      document.getElementById('wheelCandidatesText').value = this.candidates.join('\n');
      this.drawWheel();
    }
  },

  renderHistory() {
    const ol = document.getElementById('wheelWinnerHistory');
    if (!ol) return;
    ol.innerHTML = this.history.map(w => `<li>${w}</li>`).join('');
  }
};
