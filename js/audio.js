/**
 * Web Audio API 溫和舒壓音效引擎 (無需外連音效檔)
 */
const AudioEngine = {
  ctx: null,
  muted: false,

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  },

  // 播放頻率音符
  playNote(freq, type = 'sine', duration = 0.3, startOffset = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    const now = this.ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  },

  // 計時器結束提醒 (舒緩雙音)
  playChime() {
    this.playNote(523.25, 'sine', 0.5, 0);     // C5
    this.playNote(659.25, 'sine', 0.5, 0.15);  // E5
    this.playNote(783.99, 'sine', 0.8, 0.3);   // G5
    this.playNote(1046.50, 'sine', 1.2, 0.45); // C6
  },

  // 輪盤旋轉喀嗒聲
  playTick() {
    this.playNote(300, 'triangle', 0.05, 0);
  },

  // 抽中慶祝音效
  playFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playNote(freq, 'sine', 0.4, idx * 0.1);
    });
  },

  // 加分獎勵音效果
  playPointSound() {
    this.playNote(587.33, 'sine', 0.2, 0);    // D5
    this.playNote(880.00, 'sine', 0.4, 0.1);  // A5
  }
};
