/**
 * 智慧座位表編輯器模組 (支援 🔒 唯讀模式防誤觸、✏️ 編輯模式、點擊/拖放對換、僅列印中間座位表、PNG 圖片下載)
 */
const SeatingModule = {
  rows: 5,
  cols: 6,
  seats: [], // Array of student objects or null
  selectedSeatIndex: null,
  draggedSeatIndex: null,
  isEditing: false, // 預設為 🔒 唯讀預覽模式 (防止日常教學誤觸對換)

  seatingMap: {}, // className -> { rows, cols, seats }

  init() {
    this.seatingMap = StorageManager.get(StorageManager.KEYS.SEATING, {});
    this.bindEvents();
    this.loadActiveSeating();

    window.addEventListener('rosterUpdated', () => this.loadActiveSeating());
  },

  loadActiveSeating() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    const saved = this.seatingMap[activeClass];
    if (saved && saved.seats && saved.seats.length > 0) {
      this.rows = saved.rows || 5;
      this.cols = saved.cols || 6;
      this.seats = saved.seats;
      const rInput = document.getElementById('seatRows');
      const cInput = document.getElementById('seatCols');
      if (rInput) rInput.value = this.rows;
      if (cInput) cInput.value = this.cols;
    } else {
      this.autoLoadFromRoster();
    }
    this.renderGrid();
  },

  saveActiveSeating() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.seatingMap[activeClass] = {
      rows: this.rows,
      cols: this.cols,
      seats: this.seats
    };
    StorageManager.set(StorageManager.KEYS.SEATING, this.seatingMap);
  },

  bindEvents() {
    // ✏️ 切換編輯模式 / 🔒 鎖定唯讀模式
    document.getElementById('toggleSeatEditBtn')?.addEventListener('click', () => {
      this.toggleEditMode();
    });

    // 💾 儲存座位表
    document.getElementById('saveSeatEditBtn')?.addEventListener('click', () => {
      this.saveEditMode();
    });

    document.getElementById('applySeatGridBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('請先點擊右上角「✏️ 編輯模式」再修改網格大小！');
      }
      const r = parseInt(document.getElementById('seatRows').value, 10) || 5;
      const c = parseInt(document.getElementById('seatCols').value, 10) || 6;
      this.rows = r;
      this.cols = c;
      this.saveActiveSeating();
      this.renderGrid();
    });

    document.getElementById('podiumPosition')?.addEventListener('change', (e) => {
      const pos = e.target.value;
      document.getElementById('podiumBannerTop')?.classList.toggle('hidden', pos === 'bottom');
      document.getElementById('podiumBannerBottom')?.classList.toggle('hidden', pos === 'top');
    });

    document.getElementById('seatingImportClassBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可帶入名冊。');
      }
      this.autoLoadFromRoster();
    });

    document.getElementById('randomizeSeatingBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可隨機編排座位。');
      }
      this.randomize();
    });

    // 僅列印/轉存 PDF 中間座位表
    document.getElementById('printSeatingBtn')?.addEventListener('click', () => {
      this.print();
    });

    // 匯出座位表高畫質 PNG 圖片
    document.getElementById('exportSeatingPngBtn')?.addEventListener('click', () => {
      this.exportPng();
    });
  },

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    const toggleBtn = document.getElementById('toggleSeatEditBtn');
    const saveBtn = document.getElementById('saveSeatEditBtn');
    const bannerText = document.getElementById('seatModeText');
    const bannerIcon = document.getElementById('seatModeIcon');

    if (this.isEditing) {
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i> 🔒 鎖定唯讀';
      if (saveBtn) saveBtn.classList.remove('hidden');
      if (bannerText) bannerText.textContent = '目前為「✏️ 編輯模式」（可以自由拖曳或點擊對換座位，修改完成後請點擊右上角「💾 儲存座位表」）';
      if (bannerIcon) bannerIcon.className = 'fa-solid fa-pen';
    } else {
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pen"></i> ✏️ 編輯模式';
      if (saveBtn) saveBtn.classList.add('hidden');
      if (bannerText) bannerText.textContent = '目前為「🔒 唯讀預覽模式」（防止誤觸對換名牌，點擊右上角「✏️ 編輯模式」開始修改）';
      if (bannerIcon) bannerIcon.className = 'fa-solid fa-lock';
      this.selectedSeatIndex = null;
    }
    this.renderGrid();
  },

  saveEditMode() {
    this.saveActiveSeating();
    this.isEditing = false;
    this.selectedSeatIndex = null;

    const toggleBtn = document.getElementById('toggleSeatEditBtn');
    const saveBtn = document.getElementById('saveSeatEditBtn');
    const bannerText = document.getElementById('seatModeText');
    const bannerIcon = document.getElementById('seatModeIcon');

    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pen"></i> ✏️ 編輯模式';
    if (saveBtn) saveBtn.classList.add('hidden');
    if (bannerText) bannerText.textContent = '目前為「🔒 唯讀預覽模式」（防止誤觸對換名牌，點擊右上角「✏️ 編輯模式」開始修改）';
    if (bannerIcon) bannerIcon.className = 'fa-solid fa-lock';

    if (typeof confetti === 'function') {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    }
    alert('💾 座位表已成功儲存！已自動切換回 🔒 唯讀防誤觸模式。');
    this.renderGrid();
  },

  print() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    const header = document.getElementById('seatingPrintHeader');
    const titleEl = document.getElementById('seatingPrintTitle');
    const dateEl = document.getElementById('seatingPrintDate');

    if (header && titleEl && dateEl) {
      titleEl.textContent = `🏫 ${activeClass} 班級座位表`;
      const today = new Date();
      dateEl.textContent = `列印日期：${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      header.style.display = 'block';
    }

    window.print();

    if (header) {
      header.style.display = 'none';
    }
  },

  async exportPng() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    const card = document.getElementById('seatingBoardCard');
    const header = document.getElementById('seatingPrintHeader');
    const titleEl = document.getElementById('seatingPrintTitle');
    const dateEl = document.getElementById('seatingPrintDate');

    if (!card) return;

    if (typeof html2canvas === 'undefined') {
      return alert('圖片繪製套件未載入，請重新整理網頁！');
    }

    try {
      if (header && titleEl && dateEl) {
        titleEl.textContent = `🏫 ${activeClass} 班級座位表`;
        const today = new Date();
        dateEl.textContent = `產出日期：${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
        header.style.display = 'block';
      }

      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      if (header) {
        header.style.display = 'none';
      }

      const timestamp = StorageManager.getFormattedTimestamp();
      const link = document.createElement('a');
      link.download = `${timestamp}_${activeClass}_班級座位表.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      if (header) header.style.display = 'none';
      alert(`匯出圖片失敗：${err.message || err}`);
      console.error(err);
    }
  },

  autoLoadFromRoster() {
    const students = StorageManager.getActiveClassStudents();
    const totalSeats = this.rows * this.cols;
    this.seats = new Array(totalSeats).fill(null);

    students.forEach((st, idx) => {
      if (idx < totalSeats) {
        this.seats[idx] = st;
      }
    });

    this.saveActiveSeating();
    this.renderGrid();
  },

  randomize() {
    const students = StorageManager.getActiveClassStudents();
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const totalSeats = this.rows * this.cols;
    this.seats = new Array(totalSeats).fill(null);

    shuffled.forEach((st, idx) => {
      if (idx < totalSeats) {
        this.seats[idx] = st;
      }
    });

    this.saveActiveSeating();
    this.renderGrid();
  },

  handleSeatDragStart(e, index) {
    if (!this.isEditing || !this.seats[index]) return;
    this.draggedSeatIndex = index;
    e.dataTransfer.effectAllowed = 'move';
  },

  handleSeatDragOver(e, index) {
    if (!this.isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const cell = document.getElementById(`seatCell_${index}`);
    if (cell) cell.classList.add('drag-over');
  },

  handleSeatDragLeave(index) {
    const cell = document.getElementById(`seatCell_${index}`);
    if (cell) cell.classList.remove('drag-over');
  },

  handleSeatDrop(e, targetIndex) {
    if (!this.isEditing) return;
    e.preventDefault();
    this.handleSeatDragLeave(targetIndex);

    if (this.draggedSeatIndex === null || this.draggedSeatIndex === targetIndex) return;

    const temp = this.seats[this.draggedSeatIndex];
    this.seats[this.draggedSeatIndex] = this.seats[targetIndex];
    this.seats[targetIndex] = temp;

    this.draggedSeatIndex = null;
    this.selectedSeatIndex = null;
    this.saveActiveSeating();
    this.renderGrid();
  },

  handleSeatClick(index) {
    if (!this.isEditing) return;

    if (this.selectedSeatIndex === null) {
      this.selectedSeatIndex = index;
    } else {
      const temp = this.seats[this.selectedSeatIndex];
      this.seats[this.selectedSeatIndex] = this.seats[index];
      this.seats[index] = temp;
      this.selectedSeatIndex = null;
      this.saveActiveSeating();
    }
    this.renderGrid();
  },

  renderGrid() {
    const grid = document.getElementById('seatingGrid');
    if (!grid) return;

    grid.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    const totalSeats = this.rows * this.cols;

    let html = '';
    for (let i = 0; i < totalSeats; i++) {
      const student = this.seats[i];
      const isSelected = this.selectedSeatIndex === i;
      const hasStudent = !!student;

      html += `
        <div class="seat-cell ${hasStudent ? 'has-student' : ''} ${isSelected ? 'selected' : ''} ${!this.isEditing ? 'locked' : ''}"
             id="seatCell_${i}"
             draggable="${this.isEditing && hasStudent}"
             ${this.isEditing ? `
               ondragstart="SeatingModule.handleSeatDragStart(event, ${i})"
               ondragover="SeatingModule.handleSeatDragOver(event, ${i})"
               ondragleave="SeatingModule.handleSeatDragLeave(${i})"
               ondrop="SeatingModule.handleSeatDrop(event, ${i})"
               onclick="SeatingModule.handleSeatClick(${i})"
             ` : 'title="目前為 🔒 唯讀防誤觸模式（點擊右上角「✏️ 編輯模式」進行修改）"'} >
          <div class="seat-number">#${i + 1}</div>
          <div class="seat-name">${student ? student.name : '（空位）'}</div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }
};
