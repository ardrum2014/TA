/**
 * 課堂活動提醒與流程倒數模組
 */
const ScheduleModule = {
  timerId: null,
  remainingSeconds: 0,
  isRunning: false,
  currentIndex: 0,
  schedules: [],

  mode: 'flow', // 'flow' | 'freeCountdown' | 'stopwatch'

  init() {
    this.schedules = StorageManager.get(StorageManager.KEYS.SCHEDULE, []);
    if (!Array.isArray(this.schedules)) {
      this.schedules = [];
    }
    this.renderTable();
    this.bindEvents();
    this.startClock();
  },

  bindEvents() {
    // 模式按鈕綁定
    document.getElementById('modeFlowBtn')?.addEventListener('click', () => {
      this.switchMode('flow');
    });

    document.getElementById('modeFreeCountdownBtn')?.addEventListener('click', () => {
      this.switchMode('freeCountdown');
    });

    document.getElementById('modeStopwatchBtn')?.addEventListener('click', () => {
      this.switchMode('stopwatch');
    });

    document.getElementById('modeClockBtn')?.addEventListener('click', () => {
      this.switchMode('clock');
    });

    // 快捷時間按鈕 (1分, 3分, 5分, 10分, 15分)
    document.querySelectorAll('#integratedPresets .btn-preset-sm').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.sec, 10);
        this.startInstantTimer('自由倒數計時', '快捷倒數進行中...', sec);
        if (this.mode !== 'freeCountdown') {
          this.switchMode('freeCountdown');
        }
      });
    });

    // 即時輸入與倒數
    document.getElementById('quickScheduleForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const topic = document.getElementById('quickTopic').value.trim();
      const task = document.getElementById('quickTask').value.trim();
      const mins = parseInt(document.getElementById('quickMinutes').value, 10) || 10;

      this.startInstantTimer(topic, task, mins * 60);
    });

    // 快捷分鐘數點擊
    document.querySelectorAll('.quick-min-preset .btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('quickMinutes');
        const added = parseInt(btn.dataset.min, 10);
        input.value = (parseInt(input.value, 10) || 0) + added;
      });
    });

    // 開始/暫停
    document.getElementById('scheduleStartPauseBtn')?.addEventListener('click', () => {
      this.toggleTimer();
    });

    // 切換下一項
    document.getElementById('scheduleNextBtn')?.addEventListener('click', () => {
      this.nextSchedule();
    });

    // 重置
    document.getElementById('scheduleResetBtn')?.addEventListener('click', () => {
      this.resetTimer();
    });

    // 全螢幕切換
    document.getElementById('activityFullscreenBtn')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 監聽原生 HTML5 全螢幕狀態改變（包括使用者按下 ESC 退出）
    const onFullscreenChange = () => {
      const card = document.getElementById('currentActivityCard');
      const btnIcon = document.querySelector('#activityFullscreenBtn i');
      const isFull = document.fullscreenElement || document.webkitFullscreenElement;

      if (card) {
        card.classList.toggle('is-fullscreen', !!isFull);
      }
      if (btnIcon) {
        btnIcon.className = isFull ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // 清空流程
    document.getElementById('clearScheduleBtn')?.addEventListener('click', () => {
      if (confirm('確定要清空所有活動流程嗎？')) {
        this.schedules = [];
        StorageManager.set(StorageManager.KEYS.SCHEDULE, []);
        this.renderTable();
      }
    });

    // Excel 匯入活動流程
    document.getElementById('scheduleExcelInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const json = await StorageManager.parseExcelFile(file);
        if (!json || json.length === 0) return alert('活動流程 Excel 為空！');

        this.schedules = json.map((row, idx) => ({
          id: idx,
          startTime: row['預計時間'] || row['開始時間'] || row['Time'] || '08:30',
          minutes: parseInt(row['時長(分)'] || row['時長'] || row['Duration'] || 10, 10),
          topic: row['主題'] || row['Topic'] || `活動${idx + 1}`,
          task: row['任務內容'] || row['Task'] || row['內容'] || '',
          status: idx === 0 ? 'active' : 'pending'
        }));

        StorageManager.set(StorageManager.KEYS.SCHEDULE, this.schedules);
        this.renderTable();
        if (this.schedules.length > 0) {
          this.loadScheduleIndex(0);
        }
        alert(`成功匯入 ${this.schedules.length} 項活動流程！`);
      } catch (err) {
        alert('匯入活動流程 Excel 失敗。');
        console.error(err);
      }
      e.target.value = '';
    });

    // 下載活動範例 Excel
    document.getElementById('downloadScheduleSampleBtn')?.addEventListener('click', () => {
      const sample = [
        { '預計時間': '08:30', '時長(分)': 5, '主題': '課前準備與收作業', '任務內容': '請拿出來今日作業並組長收齊' },
        { '預計時間': '08:35', '時長(分)': 15, '主題': '第一階段：概念講解', '任務內容': '觀看教學影片並撰寫講義第 10 頁' },
        { '預計時間': '08:50', '時長(分)': 15, '主題': '第二階段：分組討論與實作', '任務內容': '依排定組別進行題目解答與海報繪製' },
        { '預計時間': '09:05', '時长(分)': 10, '主題': '總結與成果分享', '任務內容': '邀請 2 組同學上台分享成果' }
      ];
      StorageManager.exportExcel(sample, '課堂活動流程範例檔.xlsx');
    });
  },

  // 切換模式 (課堂流程 / 自由倒數 / 正計時碼錶 / 現在時間)
  switchMode(newMode) {
    this.stopTimer();
    this.mode = newMode;

    document.getElementById('modeFlowBtn')?.classList.toggle('active', newMode === 'flow');
    document.getElementById('modeFreeCountdownBtn')?.classList.toggle('active', newMode === 'freeCountdown');
    document.getElementById('modeStopwatchBtn')?.classList.toggle('active', newMode === 'stopwatch');
    document.getElementById('modeClockBtn')?.classList.toggle('active', newMode === 'clock');

    const topicEl = document.getElementById('currentScheduleTopic');
    const taskEl = document.getElementById('currentScheduleTask');
    const presets = document.getElementById('integratedPresets');
    const controls = document.querySelector('.timer-controls');
    const tagEl = document.getElementById('activityCardTag');

    if (newMode === 'flow') {
      if (tagEl) tagEl.textContent = '課堂流程進行中';
      if (presets) presets.style.display = 'none';
      if (controls) controls.style.display = 'flex';
      if (this.schedules[this.currentIndex]) {
        this.loadScheduleIndex(this.currentIndex);
      } else {
        if (topicEl) topicEl.textContent = '課堂準備中';
        if (taskEl) taskEl.textContent = '請即時輸入或匯入活動流程 Excel 開始！';
        this.remainingSeconds = 0;
        this.updateDisplay();
      }
    } else if (newMode === 'freeCountdown') {
      if (tagEl) tagEl.textContent = '自由倒數';
      if (presets) presets.style.display = 'flex';
      if (controls) controls.style.display = 'flex';
      if (topicEl) topicEl.textContent = '⏱️ 自由倒數計時';
      if (taskEl) taskEl.textContent = '請點選快捷時間或於右側即時輸入...';
      this.remainingSeconds = 300;
      this.updateDisplay();
    } else if (newMode === 'stopwatch') {
      if (tagEl) tagEl.textContent = '正計時碼錶';
      if (presets) presets.style.display = 'none';
      if (controls) controls.style.display = 'flex';
      if (topicEl) topicEl.textContent = '⏱️ 正計時碼錶';
      if (taskEl) taskEl.textContent = '點擊「開始」即刻啟動碼表...';
      this.remainingSeconds = 0;
      this.updateDisplay();
    } else if (newMode === 'clock') {
      if (tagEl) tagEl.textContent = '實時時鐘';
      if (presets) presets.style.display = 'none';
      if (controls) controls.style.display = 'none';
      const now = new Date();
      const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const dateStr = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${days[now.getDay()]}`;
      if (topicEl) topicEl.textContent = '🕒 現在時間';
      if (taskEl) taskEl.textContent = dateStr;
    }
  },

  // 開啟實時鐘
  startClock() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const clockEl = document.getElementById('scheduleCurrentTime');
      if (clockEl) clockEl.textContent = timeStr;

      // 若目前切換為「現在時間」大字體模式，同步更新中央大字體時鐘
      if (this.mode === 'clock') {
        const display = document.getElementById('scheduleTimerDisplay');
        if (display) display.textContent = timeStr;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  },

  // 切換全螢幕投影模式
  toggleFullscreen() {
    const card = document.getElementById('currentActivityCard');
    if (!card) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (card.requestFullscreen) {
        card.requestFullscreen();
      } else if (card.webkitRequestFullscreen) {
        card.webkitRequestFullscreen();
      } else {
        card.classList.add('is-fullscreen');
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      card.classList.remove('is-fullscreen');
    }
  },

  // 啟動即時倒數
  startInstantTimer(topic, task, seconds) {
    this.stopTimer();
    document.getElementById('currentScheduleTopic').textContent = topic;
    document.getElementById('currentScheduleTask').textContent = task || '即時課堂任務進行中...';
    
    // 更新頂部高亮 status
    document.getElementById('topActivityTitle').textContent = topic;

    this.remainingSeconds = seconds;
    this.isRunning = true;
    this.updateDisplay();

    this.timerId = setInterval(() => {
      if (this.mode === 'stopwatch') {
        this.remainingSeconds++;
        this.updateDisplay();
      } else {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
          this.updateDisplay();
        } else {
          this.onTimerFinish();
        }
      }
    }, 1000);
  },

  loadScheduleIndex(idx) {
    if (idx < 0 || idx >= this.schedules.length) return;
    this.currentIndex = idx;
    const item = this.schedules[idx];
    this.startInstantTimer(item.topic, item.task, item.minutes * 60);

    this.schedules.forEach((sch, i) => {
      sch.status = i < idx ? 'done' : (i === idx ? 'active' : 'pending');
    });
    StorageManager.set(StorageManager.KEYS.SCHEDULE, this.schedules);
    this.renderTable();
  },

  toggleTimer() {
    this.isRunning = !this.isRunning;
    const btn = document.getElementById('scheduleStartPauseBtn');

    if (this.isRunning) {
      if (btn) btn.innerHTML = `<i class="fa-solid fa-pause"></i> 暫停`;
      this.timerId = setInterval(() => {
        if (this.mode === 'stopwatch') {
          this.remainingSeconds++;
          this.updateDisplay();
        } else {
          if (this.remainingSeconds > 0) {
            this.remainingSeconds--;
            this.updateDisplay();
          } else {
            this.onTimerFinish();
          }
        }
      }, 1000);
    } else {
      if (btn) btn.innerHTML = `<i class="fa-solid fa-play"></i> 繼續`;
      clearInterval(this.timerId);
    }
  },

  stopTimer() {
    clearInterval(this.timerId);
    this.isRunning = false;
    const btn = document.getElementById('scheduleStartPauseBtn');
    if (btn) btn.innerHTML = `<i class="fa-solid fa-play"></i> 開始`;
  },

  resetTimer() {
    this.stopTimer();
    if (this.schedules[this.currentIndex]) {
      this.remainingSeconds = this.schedules[this.currentIndex].minutes * 60;
    } else {
      this.remainingSeconds = 600;
    }
    this.updateDisplay();
  },

  nextSchedule() {
    if (this.currentIndex + 1 < this.schedules.length) {
      this.loadScheduleIndex(this.currentIndex + 1);
    } else {
      alert('所有排定活動已全數完成！');
    }
  },

  onTimerFinish() {
    this.stopTimer();
    AudioEngine.playChime();
    document.getElementById('currentScheduleTopic').textContent = '🔔 時間到！活動結束';
    document.getElementById('topActivityTitle').textContent = '時間到！';

    if (this.schedules[this.currentIndex]) {
      this.schedules[this.currentIndex].status = 'done';
      StorageManager.set(StorageManager.KEYS.SCHEDULE, this.schedules);
      this.renderTable();
    }
  },

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const display = document.getElementById('scheduleTimerDisplay');
    const topDisplay = document.getElementById('topCountdownDisplay');

    if (display) display.textContent = formatted;
    if (topDisplay) topDisplay.textContent = formatted;
  },

  renderTable() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    if (this.schedules.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">尚未匯入活動流程，請下載範例檔填寫後匯入。</td></tr>`;
      return;
    }

    tbody.innerHTML = this.schedules.map((sch, i) => `
      <tr class="${sch.status === 'active' ? 'table-primary' : ''}">
        <td>${i + 1}</td>
        <td>${sch.startTime}</td>
        <td>${sch.minutes} 分鐘</td>
        <td><strong>${sch.topic}</strong></td>
        <td>${sch.task || '-'}</td>
        <td>
          <span class="status-tag ${sch.status}">
            ${sch.status === 'active' ? '進行中 ⏳' : (sch.status === 'done' ? '已完成 ✔' : '預備中')}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="ScheduleModule.loadScheduleIndex(${i})">
            切換至此
          </button>
        </td>
      </tr>
    `).join('');
  }
};
