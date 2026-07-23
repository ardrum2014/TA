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
  rules: [], // 各班級排座條件：[{ id, type, s1Id, s1Name, s2Id, s2Name, row }]

  seatingMap: {}, // className -> { rows, cols, seats, rules }

  init() {
    this.seatingMap = StorageManager.get(StorageManager.KEYS.SEATING, {});
    if (Array.isArray(this.seatingMap) || typeof this.seatingMap !== 'object' || this.seatingMap === null) {
      this.seatingMap = {};
    }
    this.bindEvents();
    this.loadActiveSeating();

    window.addEventListener('rosterUpdated', () => this.loadActiveSeating());
  },

  loadActiveSeating() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.seatingMap = StorageManager.get(StorageManager.KEYS.SEATING, {});
    if (Array.isArray(this.seatingMap) || typeof this.seatingMap !== 'object' || this.seatingMap === null) {
      this.seatingMap = {};
    }
    const saved = this.seatingMap[activeClass];
    const students = StorageManager.getActiveClassStudents();
    if (saved && saved.seats && saved.seats.length > 0) {
      this.rows = saved.rows || 5;
      this.cols = saved.cols || 6;
      this.seats = saved.seats;
      this.rules = saved.rules || [];
      
      const totalSeats = this.rows * this.cols;
      if (students.length > totalSeats) {
        alert(`⚠️ 警示：目前班級人數為 ${students.length} 人，但座位表格子僅有 ${totalSeats} 個（${this.rows}行 × ${this.cols}列）！\n\n部分學生將無座位。請先在「編輯模式」下修改「網格大小」來加大座位表。`);
      }

      const podiumPos = saved.podiumPosition || 'top';
      const podiumSelect = document.getElementById('podiumPosition');
      if (podiumSelect) podiumSelect.value = podiumPos;
      
      // 連動顯示講台 Banner
      document.getElementById('podiumBannerTop')?.classList.toggle('hidden', podiumPos === 'bottom');
      document.getElementById('podiumBannerBottom')?.classList.toggle('hidden', podiumPos === 'top');

      const rInput = document.getElementById('seatRows');
      const cInput = document.getElementById('seatCols');
      if (rInput) rInput.value = this.rows;
      if (cInput) cInput.value = this.cols;
    } else {
      this.rules = [];
      const podiumSelect = document.getElementById('podiumPosition');
      if (podiumSelect) podiumSelect.value = 'top';
      document.getElementById('podiumBannerTop')?.classList.remove('hidden');
      document.getElementById('podiumBannerBottom')?.classList.add('hidden');
      this.autoLoadFromRoster();
    }
    this.renderGrid();
  },

  saveActiveSeating() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.seatingMap = StorageManager.get(StorageManager.KEYS.SEATING, {});
    if (Array.isArray(this.seatingMap) || typeof this.seatingMap !== 'object' || this.seatingMap === null) {
      this.seatingMap = {};
    }
    this.seatingMap[activeClass] = {
      rows: this.rows,
      cols: this.cols,
      seats: this.seats,
      rules: this.rules || [],
      podiumPosition: document.getElementById('podiumPosition')?.value || 'top'
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
      
      const students = StorageManager.getActiveClassStudents();
      if (r * c < students.length) {
        return alert(`⚠️ 警示：設定的網格大小 (${r} 行 × ${c} 列 = ${r * c} 個座位) 小於目前班級人數 (${students.length} 人)！請設定更大的網格大小，否則部分學生將無座位。`);
      }

      this.rows = r;
      this.cols = c;
      this.saveActiveSeating();
      this.renderGrid();
    });

    document.getElementById('podiumPosition')?.addEventListener('change', (e) => {
      const pos = e.target.value;
      document.getElementById('podiumBannerTop')?.classList.toggle('hidden', pos === 'bottom');
      document.getElementById('podiumBannerBottom')?.classList.toggle('hidden', pos === 'top');
      this.saveActiveSeating();
    });

    document.getElementById('seatingImportClassBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可進行重設。');
      }
      this.autoLoadFromRoster();
    });

    document.getElementById('seatingShiftLeftBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可平移座位。');
      }
      this.shiftColumns('left');
    });

    document.getElementById('seatingShiftRightBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可平移座位。');
      }
      this.shiftColumns('right');
    });

    document.getElementById('seatingRulesBtn')?.addEventListener('click', () => {
      this.openRulesModal();
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

    if (students.length > totalSeats) {
      alert(`⚠️ 警示：目前班級人數為 ${students.length} 人，但座位格子僅有 ${totalSeats} 個（${this.rows}行 × ${this.cols}列）！\n\n部分學生將無法被分配到座位。請先在「編輯模式」下修改「網格大小」來加大座位表。`);
    }

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
    if (students.length === 0) {
      return alert('請先在名條管理中建立學生名冊！');
    }

    const totalSeats = this.rows * this.cols;
    if (students.length > totalSeats) {
      return alert(`目前學生人數 (${students.length} 人) 大於座位數 (${totalSeats} 個)，請先在「編輯模式」下點選「更新網格」加大座位表！`);
    }

    const rules = this.rules || [];
    const podiumPos = document.getElementById('podiumPosition')?.value || 'top';

    // 1. 分類學生
    const firstRowStudents = [];
    const lastRowStudents = [];
    const normalStudents = [];

    students.forEach(st => {
      const r = rules.find(rule => rule.s1Id === st.id && rule.type === 'specificRow');
      if (r) {
        if (r.row === 'first') firstRowStudents.push(st);
        else if (r.row === 'last') lastRowStudents.push(st);
      } else {
        normalStudents.push(st);
      }
    });

    // 2. 分類座位索引
    const firstRowIndices = [];
    const lastRowIndices = [];
    const otherIndices = [];

    for (let idx = 0; idx < totalSeats; idx++) {
      const r = Math.floor(idx / this.cols);
      if (podiumPos === 'top') {
        if (r === 0) firstRowIndices.push(idx);
        else if (r === this.rows - 1) lastRowIndices.push(idx);
        else otherIndices.push(idx);
      } else {
        if (r === this.rows - 1) firstRowIndices.push(idx);
        else if (r === 0) lastRowIndices.push(idx);
        else otherIndices.push(idx);
      }
    }

    // 3. 檢查基本限制
    if (firstRowStudents.length > firstRowIndices.length) {
      return alert(`設定的第一排人數 (${firstRowStudents.length}人) 超過座位表第一排的最大容納量 (${firstRowIndices.length}個)！請調整條件。`);
    }
    if (lastRowStudents.length > lastRowIndices.length) {
      return alert(`設定的最後一排人數 (${lastRowStudents.length}人) 超過座位表最後一排的最大容納量 (${lastRowIndices.length}個)！請調整條件。`);
    }

    // 隨機打亂陣列輔助函數
    const shuffleArray = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // 驗證座位表配置是否滿足相鄰條件
    const isValidSeating = (layout) => {
      const studentIndexMap = {};
      for (let i = 0; i < layout.length; i++) {
        if (layout[i]) studentIndexMap[layout[i].id] = i;
      }

      for (let rule of rules) {
        if (rule.type === 'notAdjacent') {
          const idx1 = studentIndexMap[rule.s1Id];
          const idx2 = studentIndexMap[rule.s2Id];
          if (idx1 !== undefined && idx2 !== undefined) {
            const r1 = Math.floor(idx1 / this.cols), c1 = idx1 % this.cols;
            const r2 = Math.floor(idx2 / this.cols), c2 = idx2 % this.cols;
            if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
              return false; // 8向相鄰違規
            }
          }
        } else if (rule.type === 'mustAdjacent') {
          const idx1 = studentIndexMap[rule.s1Id];
          const idx2 = studentIndexMap[rule.s2Id];
          if (idx1 !== undefined && idx2 !== undefined) {
            const r1 = Math.floor(idx1 / this.cols), c1 = idx1 % this.cols;
            const r2 = Math.floor(idx2 / this.cols), c2 = idx2 % this.cols;
            const isAdjacent = (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2);
            if (!isAdjacent) {
              return false; // 4向相鄰違規
            }
          }
        }
      }
      return true;
    };

    let bestLayout = null;
    let found = false;
    const maxAttempts = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const layout = new Array(totalSeats).fill(null);
      
      const fIndices = shuffleArray([...firstRowIndices]);
      const lIndices = shuffleArray([...lastRowIndices]);
      const oIndices = [...otherIndices];

      // 放置第一排學生
      firstRowStudents.forEach((st, i) => {
        layout[fIndices[i]] = st;
      });
      // 剩餘的第一排座位併入 oIndices
      for (let i = firstRowStudents.length; i < fIndices.length; i++) {
        oIndices.push(fIndices[i]);
      }

      // 放置最後一排學生
      lastRowStudents.forEach((st, i) => {
        layout[lIndices[i]] = st;
      });
      // 剩餘的最後一排座位併入 oIndices
      for (let i = lastRowStudents.length; i < lIndices.length; i++) {
        oIndices.push(lIndices[i]);
      }

      // 先將 oIndices 依據 row 進行分組
      const rowGroups = {};
      oIndices.forEach(idx => {
        const r = Math.floor(idx / this.cols);
        if (!rowGroups[r]) rowGroups[r] = [];
        rowGroups[r].push(idx);
      });

      // 依講台位置決定 row 的處理順序 (靠近講桌的先排)
      const sortedRows = Object.keys(rowGroups).map(Number).sort((a, b) => {
        return podiumPos === 'top' ? a - b : b - a;
      });

      // 依排數順序，將每一排的可用座位打亂，然後依序填入學生，以達成集中在前半排的效果
      let assignedCount = 0;
      const shuffledNormals = shuffleArray([...normalStudents]);
      
      for (let r of sortedRows) {
        const colsInRow = shuffleArray([...rowGroups[r]]);
        for (let idx of colsInRow) {
          if (assignedCount < shuffledNormals.length) {
            layout[idx] = shuffledNormals[assignedCount];
            assignedCount++;
          }
        }
      }

      // 驗證
      if (isValidSeating(layout)) {
        bestLayout = layout;
        found = true;
        break;
      }

      // 保留最後一個配置作為保底 fallback
      bestLayout = layout;
    }

    this.seats = bestLayout;
    this.saveActiveSeating();
    this.renderGrid();

    if (found) {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 80 });
      }
    } else if (rules.length > 0) {
      alert('⚠️ 條件設定較為嚴苛（或存在衝突），已為您生成最接近的座位表，但有部分「禁止相鄰」或「必須相鄰」的條件可能未被完全滿足。');
    }
  },

  openRulesModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = '⚙️ 座位編排條件設定';

    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) {
      modalBody.innerHTML = '<div class="text-center text-muted padding-20">⚠️ 請先在名條管理中建立學生名冊！</div>';
      backdrop.classList.remove('hidden');
      confirmBtn.style.display = 'none';
      cancelBtn.onclick = () => backdrop.classList.add('hidden');
      closeBtn.onclick = () => backdrop.classList.add('hidden');
      return;
    }

    confirmBtn.style.display = 'inline-block';
    confirmBtn.textContent = '💾 儲存設定';
    confirmBtn.className = 'btn btn-primary';

    // 複製一份暫存的 rules，按「儲存設定」時才寫回 this.rules
    let tempRules = JSON.parse(JSON.stringify(this.rules || []));

    const renderRulesList = () => {
      const listContainer = document.getElementById('seatingRulesList');
      if (!listContainer) return;
      if (tempRules.length === 0) {
        listContainer.innerHTML = '<div class="text-muted text-center padding-10" style="font-size: 0.9rem;">目前尚未設定任何條件限制。</div>';
        return;
      }
      listContainer.innerHTML = tempRules.map((rule, idx) => {
        let desc = '';
        if (rule.type === 'notAdjacent') {
          desc = `🚫 <b>${rule.s1Name}</b> 與 <b>${rule.s2Name}</b> 不能相鄰 (包含對角線)`;
        } else if (rule.type === 'mustAdjacent') {
          desc = `🤝 <b>${rule.s1Name}</b> 與 <b>${rule.s2Name}</b> 必須相鄰 (左右或前後)`;
        } else if (rule.type === 'specificRow') {
          desc = `📏 <b>${rule.s1Name}</b> 指定坐在 <b>${rule.row === 'first' ? '第一排' : '最後一排'}</b>`;
        }
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem;">
            <span>${idx + 1}. ${desc}</span>
            <button class="btn btn-sm btn-outline text-danger delete-rule-btn" data-idx="${idx}" style="padding: 2px 6px; font-size: 0.8rem; border-color: var(--color-terracotta);">
              <i class="fa-solid fa-trash"></i> 刪除
            </button>
          </div>
        `;
      }).join('');

      // 綁定刪除按鈕
      listContainer.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.onclick = () => {
          const ruleIdx = parseInt(btn.dataset.idx, 10);
          tempRules.splice(ruleIdx, 1);
          renderRulesList();
        };
      });
    };

    modalBody.innerHTML = `
      <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-main);">
        <p style="margin-bottom: 12px; font-size: 0.85rem; color: var(--text-muted); background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px;">
          💡 設定排座條件後，點擊座位表面板的「隨機編排座位」按鈕時，系統會自動依據這些條件尋找適合的座位排法。
        </p>

        <!-- 新增條件區 -->
        <fieldset style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 16px; background: var(--bg-main);">
          <legend style="padding: 0 8px; font-weight: bold; font-size: 0.9rem; color: var(--color-terracotta);">➕ 新增排座條件</legend>
          
          <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label style="font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 4px;">條件類型：</label>
              <select id="ruleTypeSelect" class="form-control" style="width: 100%;">
                <option value="notAdjacent">🚫 兩人禁止相鄰 (8向)</option>
                <option value="mustAdjacent">🤝 兩人必須相鄰 (4向/小老師)</option>
                <option value="specificRow">📏 指定排數 (第一排/最後一排)</option>
              </select>
            </div>
            
            <!-- 學生選擇器 A -->
            <div id="student1Container">
              <label id="student1Label" style="font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 4px;">學生 A：</label>
              <select id="student1Select" class="form-control" style="width: 100%;">
                ${students.map(s => `<option value="${s.id}">${s.number}號 ${s.name}</option>`).join('')}
              </select>
            </div>

            <!-- 學生選擇器 B -->
            <div id="student2Container">
              <label style="font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 4px;">學生 B：</label>
              <select id="student2Select" class="form-control" style="width: 100%;">
                ${students.map(s => `<option value="${s.id}">${s.number}號 ${s.name}</option>`).join('')}
              </select>
            </div>

            <!-- 指定排數選擇器 -->
            <div id="rowContainer" style="display: none;">
              <label style="font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 4px;">指定位置：</label>
              <select id="rowSelect" class="form-control" style="width: 100%;">
                <option value="first">第一排 (離講台最近)</option>
                <option value="last">最後一排 (離講台最遠)</option>
              </select>
            </div>
          </div>

          <div class="text-right">
            <button id="addRuleBtn" class="btn btn-sm btn-accent" style="padding: 6px 12px;"><i class="fa-solid fa-plus"></i> 新增此條件</button>
          </div>
        </fieldset>

        <!-- 已設定條件清單 -->
        <div>
          <h4 style="font-size: 0.9rem; font-weight: bold; margin-bottom: 8px; color: var(--color-leaf-green); display: flex; align-items: center; justify-content: space-between;">
            <span>📋 已設定條件清單</span>
            <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">共 <span id="rulesCount">0</span> 項</span>
          </h4>
          <div id="seatingRulesList" style="border: 1px solid var(--border-color); border-radius: 8px; max-height: 180px; overflow-y: auto; background: var(--bg-main);">
            <!-- 動態渲染清單 -->
          </div>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');

    // 切換條件類型連動 UI
    const typeSelect = document.getElementById('ruleTypeSelect');
    const s1Label = document.getElementById('student1Label');
    const s2Container = document.getElementById('student2Container');
    const rowContainer = document.getElementById('rowContainer');

    const updateFormUI = () => {
      const type = typeSelect.value;
      if (type === 'specificRow') {
        s1Label.textContent = '學生：';
        s2Container.style.display = 'none';
        rowContainer.style.display = 'block';
      } else {
        s1Label.textContent = '學生 A：';
        s2Container.style.display = 'block';
        rowContainer.style.display = 'none';
      }
    };
    typeSelect.onchange = updateFormUI;

    // 渲染規則列表
    const updateRulesCount = () => {
      const countEl = document.getElementById('rulesCount');
      if (countEl) countEl.textContent = tempRules.length;
    };
    
    const refreshListAndCount = () => {
      renderRulesList();
      updateRulesCount();
    };

    refreshListAndCount();

    // 點擊新增條件
    document.getElementById('addRuleBtn').onclick = () => {
      const type = typeSelect.value;
      const s1Select = document.getElementById('student1Select');
      const s1Id = s1Select.value;
      const s1Name = s1Select.options[s1Select.selectedIndex].text;

      if (type === 'specificRow') {
        // 檢查是否已針對此學生設定過排數
        const exists = tempRules.some(r => r.type === 'specificRow' && r.s1Id === s1Id);
        if (exists) {
          return alert('該學生已經設定過指定排數條件了！');
        }
        const row = document.getElementById('rowSelect').value;
        tempRules.push({
          id: 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type,
          s1Id,
          s1Name,
          row
        });
      } else {
        const s2Select = document.getElementById('student2Select');
        const s2Id = s2Select.value;
        const s2Name = s2Select.options[s2Select.selectedIndex].text;

        if (s1Id === s2Id) {
          return alert('學生 A 與學生 B 不能是同一個人！');
        }

        // 檢查是否重複設定過相同的相鄰關係
        const exists = tempRules.some(r => 
          (r.type === type) &&
          ((r.s1Id === s1Id && r.s2Id === s2Id) || (r.s1Id === s2Id && r.s2Id === s1Id))
        );
        if (exists) {
          return alert('已設定過這兩位同學的相同相鄰條件了！');
        }

        // 檢查是否存在矛盾條件：例如 A 與 B 不能相鄰，但又被設為必須相鄰
        const conflictType = type === 'notAdjacent' ? 'mustAdjacent' : 'notAdjacent';
        const conflict = tempRules.some(r => 
          (r.type === conflictType) &&
          ((r.s1Id === s1Id && r.s2Id === s2Id) || (r.s1Id === s2Id && r.s2Id === s1Id))
        );
        if (conflict) {
          return alert(`⚠️ 偵測到矛盾條件！這兩位同學已經被設定為「${conflictType === 'notAdjacent' ? '禁止相鄰' : '必須相鄰'}」了！`);
        }

        tempRules.push({
          id: 'rule_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          type,
          s1Id,
          s1Name,
          s2Id,
          s2Name
        });
      }
      refreshListAndCount();
    };

    const closeModal = () => {
      backdrop.classList.add('hidden');
      confirmBtn.textContent = '確定';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.onclick = null;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      this.rules = tempRules;
      this.saveActiveSeating();
      closeModal();
      if (typeof confetti === 'function') {
        confetti({ particleCount: 30, spread: 50 });
      }
    };
  },

  shiftColumns(direction) {
    const newSeats = new Array(this.seats.length).fill(null);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const oldIndex = r * this.cols + c;
        let newCol;
        if (direction === 'right') {
          newCol = (c + 1) % this.cols;
        } else {
          newCol = (c - 1 + this.cols) % this.cols;
        }
        const newIndex = r * this.cols + newCol;
        newSeats[newIndex] = this.seats[oldIndex];
      }
    }
    this.seats = newSeats;
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
           <div class="seat-number" style="display:flex; justify-content:space-between; align-items:center;">
             <span>${student ? `座號 ${student.number}` : `#${i + 1}`}</span>
             ${student ? `<button type="button" style="border:none; background:transparent; cursor:pointer; font-size:0.75rem; padding:0 2px;" title="查看學生綜合戰報" onclick="event.stopPropagation(); window.showStudentProfileModal('${student.id}')">🪪</button>` : ''}
           </div>
           <div class="seat-name">${student ? student.name : '（空位）'}</div>
           ${student ? `<div class="seat-info" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; border-top: 1px dashed var(--border-color); padding-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${student.note || ''}${student.cadre ? ` | ${student.cadre}` : ''}</div>` : ''}
         </div>
       `;
     }

     grid.innerHTML = html;
   },

   printA4Poster() {
     const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
     const seatingData = StorageManager.get(StorageManager.KEYS.SEATING, {});
     const classSeating = seatingData[activeClass];
     if (!classSeating || !classSeating.grid) return alert('目前班級尚未建立座位表！');

     const printWin = window.open('', '_blank', 'width=1000,height=800');
     if (!printWin) return alert('請允許開啟彈出視窗以進行 A4 列印！');

     const rows = classSeating.rows || 5;
     const cols = classSeating.cols || 6;
     const grid = classSeating.grid;
     const podiumPos = classSeating.podiumPosition || 'top';

     let gridHtml = '';
     for (let r = 1; r <= rows; r++) {
       for (let c = 1; c <= cols; c++) {
         const key = `${r}_${c}`;
         const st = grid[key];
         gridHtml += `
           <div style="border: 2px solid #333; padding: 12px 6px; text-align: center; border-radius: 8px; background: #fff;">
             <div style="font-size: 13pt; font-weight: bold; color: #555;">${st ? `座號 ${st.number}` : `#${(r-1)*cols + c}`}</div>
             <div style="font-size: 18pt; font-weight: bold; margin: 6px 0; color: #000;">${st ? st.name : '（空位）'}</div>
             <div style="font-size: 10pt; color: #666;">${st ? (st.note || st.cadre || '') : ''}</div>
           </div>
         `;
       }
     }

     printWin.document.write(`
       <!DOCTYPE html>
       <html>
       <head>
         <title>${activeClass} 班級座位表 (A4海報列印)</title>
         <style>
           @page { size: A4 landscape; margin: 15mm; }
           body { font-family: 'Iansui', 'Microsoft JhengHei', sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
           .header { text-align: center; margin-bottom: 15px; }
           .header h1 { margin: 0; font-size: 24pt; letter-spacing: 2px; }
           .header p { margin: 4px 0 0 0; font-size: 11pt; color: #555; }
           .podium { text-align: center; padding: 8px; border: 2px dashed #666; margin: 10px auto 16px auto; width: 60%; font-size: 15pt; font-weight: bold; background: #f0f0f0; border-radius: 6px; }
           .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px; }
         </style>
       </head>
       <body>
         <div class="header">
           <h1>🏫 【${activeClass}】班級座位表</h1>
           <p>列印日期：${new Date().toLocaleDateString('zh-TW')} | 南寧咖啡館教師智慧小手帳</p>
         </div>
         ${podiumPos === 'top' ? '<div class="podium">📺 講台 / 黑板區</div>' : ''}
         <div class="grid">${gridHtml}</div>
         ${podiumPos === 'bottom' ? '<div class="podium" style="margin-top:16px;">📺 講台 / 黑板區</div>' : ''}
         <script>
           window.onload = () => { window.print(); };
         </script>
       </body>
       </html>
     `);
     printWin.document.close();
   }
 };
