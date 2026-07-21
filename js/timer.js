/**
 * 獨立全螢幕大字體倒數計時與碼錶模組
 */
const TimerModule = {
  mode: 'countdown', // 'countdown' | 'stopwatch'
  timerId: null,
  seconds: 300,
  isRunning: false,

  init() {
    this.bindEvents();
    this.updateDisplay();
  },

  bindEvents() {
    // 全螢幕投影
    document.getElementById('timerFullscreenBtn')?.addEventListener('click', () => {
      const card = document.querySelector('.timer-main-card');
      if (!card) return;
      if (!document.fullscreenElement) {
        if (card.requestFullscreen) card.requestFullscreen();
        else card.classList.add('is-fullscreen');
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else card.classList.remove('is-fullscreen');
      }
    });

    // 模式切換
    document.getElementById('modeCountdownBtn')?.addEventListener('click', () => {
      this.setMode('countdown');
    });
    document.getElementById('modeStopwatchBtn')?.addEventListener('click', () => {
      this.setMode('stopwatch');
    });

    // 快捷按鈕
    document.querySelectorAll('#countdownPresets .btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.sec, 10);
        this.stop();
        this.seconds = sec;
        this.updateDisplay();
      });
    });

    // 自訂設定
    document.getElementById('setCustomTimerBtn')?.addEventListener('click', () => {
      const min = parseInt(document.getElementById('customMin').value, 10) || 0;
      const sec = parseInt(document.getElementById('customSec').value, 10) || 0;
      this.stop();
      this.seconds = min * 60 + sec;
      this.updateDisplay();
    });

    // 開始/暫停
    document.getElementById('bigTimerStartBtn')?.addEventListener('click', () => {
      this.toggle();
    });

    // 重置
    document.getElementById('bigTimerResetBtn')?.addEventListener('click', () => {
      this.stop();
      this.seconds = (this.mode === 'countdown') ? 300 : 0;
      this.updateDisplay();
    });
  },

  setMode(mode) {
    this.stop();
    this.mode = mode;
    document.getElementById('modeCountdownBtn').classList.toggle('active', mode === 'countdown');
    document.getElementById('modeStopwatchBtn').classList.toggle('active', mode === 'stopwatch');

    document.getElementById('countdownPresets').style.display = (mode === 'countdown') ? 'flex' : 'none';
    document.getElementById('customTimerBox').style.display = (mode === 'countdown') ? 'flex' : 'none';

    this.seconds = (mode === 'countdown') ? 300 : 0;
    this.updateDisplay();
  },

  toggle() {
    this.isRunning = !this.isRunning;
    const btn = document.getElementById('bigTimerStartBtn');

    if (this.isRunning) {
      if (btn) btn.innerHTML = `<i class="fa-solid fa-pause"></i> 暫停`;
      this.timerId = setInterval(() => {
        if (this.mode === 'countdown') {
          if (this.seconds > 0) {
            this.seconds--;
          } else {
            this.onFinish();
          }
        } else {
          this.seconds++;
        }
        this.updateDisplay();
      }, 1000);
    } else {
      if (btn) btn.innerHTML = `<i class="fa-solid fa-play"></i> 繼續`;
      clearInterval(this.timerId);
    }
  },

  stop() {
    clearInterval(this.timerId);
    this.isRunning = false;
    const btn = document.getElementById('bigTimerStartBtn');
    if (btn) btn.innerHTML = `<i class="fa-solid fa-play"></i> 開始`;
  },

  onFinish() {
    this.stop();
    AudioEngine.playChime();
    alert('⏰ 時間到！');
  },

  updateDisplay() {
    const mins = Math.floor(this.seconds / 60);
    const secs = this.seconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const display = document.getElementById('bigTimerDisplay');
    if (display) display.textContent = formatted;
  }
};
