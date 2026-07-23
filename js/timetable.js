/**
 * 教師個人週課表與下一節課即時提醒模組 (支援代課/調課/節次時間自訂/一鍵切換當前班級)
 */
const TimetableModule = {
  data: null,
  isEditing: false,

  DAY_NAMES: ['', '週一', '週二', '週三', '週四', '週五'],

  init() {
    this.data = StorageManager.get(StorageManager.KEYS.TIMETABLE, StorageManager.getDefaultTimetable());
    if (!this.data || !this.data.periods || !Array.isArray(this.data.periods) || this.data.periods.length === 0) {
      this.data = StorageManager.getDefaultTimetable();
      StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
    }
    
    if (!this.data.commonSubjects) {
      this.data.commonSubjects = ['生活科技', '資訊科技', '生物科技', '專題研究', '彈性學習', '班會與導師時間', '社團活動'];
    }
    if (!this.data.commonLocations) {
      this.data.commonLocations = ['生科教室', '電腦教室', '理化實驗室', '圖書館', '501教室', '生科準備室', '會議室'];
    }

    // 跨週自動檢查並清空過期代課註記
    this.checkAndClearExpiredSubstitutes();

    this.bindEvents();
    this.renderGrid();
    this.updateSidebarWidget();

    // 每一分鐘自動更新提醒 Widget 與檢查跨週代課重置
    setInterval(() => {
      this.checkAndClearExpiredSubstitutes();
      this.updateSidebarWidget();
    }, 30000);

    window.addEventListener('rosterUpdated', () => {
      this.data = StorageManager.get(StorageManager.KEYS.TIMETABLE, StorageManager.getDefaultTimetable());
      if (!this.data || !this.data.periods || !Array.isArray(this.data.periods) || this.data.periods.length === 0) {
        this.data = StorageManager.getDefaultTimetable();
        StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
      }
      this.checkAndClearExpiredSubstitutes();
      this.renderGrid();
      this.updateSidebarWidget();
    });
  },

  // 取得西元 ISO 週數 ID (例如: 2026-W30)
  getWeekId(d = new Date()) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNum = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
    return `${target.getFullYear()}-W${weekNum}`;
  },

  // 跨週自動清空過期的代課紀錄 (維持一週，時間跨週即消失)
  checkAndClearExpiredSubstitutes() {
    if (!this.data || !this.data.grid) return;
    const currentWeekId = this.getWeekId(new Date());
    let modified = false;

    Object.keys(this.data.grid).forEach(key => {
      const cell = this.data.grid[key];
      if (cell && cell.substituteWeekId && cell.substituteWeekId !== currentWeekId) {
        cell.substitute = '';
        cell.substituteNote = '';
        delete cell.substituteWeekId;
        modified = true;
      }
    });

    if (modified) {
      StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
    }
  },

  saveCommonSettings() {
    if (!this.data) {
      this.data = StorageManager.get(StorageManager.KEYS.TIMETABLE, StorageManager.getDefaultTimetable());
    }

    const subInput = document.getElementById('commonSubjectsInput');
    const locInput = document.getElementById('commonLocationsInput');

    if (subInput && locInput) {
      const subs = subInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      const locs = locInput.value.split(',').map(l => l.trim()).filter(l => l.length > 0);

      this.data.commonSubjects = subs.length > 0 ? subs : ['生活科技', '資訊科技', '生物科技', '專題研究', '彈性學習', '班會與導師時間', '社團活動'];
      this.data.commonLocations = locs.length > 0 ? locs : ['生科教室', '電腦教室', '理化實驗室', '圖書館', '501教室', '生科準備室', '會議室'];

      StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
      alert('🎉 已成功儲存常用科目與教室清單！');
    }
  },

  syncCommonInputs() {
    const subInput = document.getElementById('commonSubjectsInput');
    const locInput = document.getElementById('commonLocationsInput');
    if (subInput && locInput && this.data) {
      subInput.value = (this.data.commonSubjects || []).join(',');
      locInput.value = (this.data.commonLocations || []).join(',');
    }
  },

  openCommonSubjectsModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    if (!this.data) {
      this.data = StorageManager.get(StorageManager.KEYS.TIMETABLE, StorageManager.getDefaultTimetable());
    }

    const currentSubs = (this.data.commonSubjects || []).join(',');
    const currentLocs = (this.data.commonLocations || []).join(',');

    modalTitle.textContent = `⚙️ 管理常用科目與教室清單`;
    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 0.95rem; color: var(--text-main);">
        <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">
          在此可自由編輯課表選單中的常用科目與教室名稱，項目之間請用半形逗號（,）分隔。
        </p>
        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">常用科目 (半形逗號分隔)：</label>
          <input type="text" id="commonSubjectsInput" class="form-control" value="${currentSubs}" placeholder="生活科技,資訊科技,生物科技..." style="width: 100%;">
        </div>
        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">常用教室 (半形逗號分隔)：</label>
          <input type="text" id="commonLocationsInput" class="form-control" value="${currentLocs}" placeholder="生科教室,電腦教室,理化實驗室..." style="width: 100%;">
        </div>
        <div style="font-size: 0.82rem; color: var(--color-amber); background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px;">
          💡 提示：設定完成後，點選課表格子編輯時即可一鍵快速套用選取！
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '💾 儲存常用設定';
    confirmBtn.className = 'btn btn-primary';

    const closeModal = () => { backdrop.classList.add('hidden'); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      this.saveCommonSettings();
      closeModal();
    };
  },

  saveData() {
    StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
    this.renderGrid();
    this.updateSidebarWidget();
  },

  toggleEdit() {
    this.isEditing = !this.isEditing;
    const btn = document.getElementById('toggleTimetableEditBtn');
    if (btn) {
      if (this.isEditing) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 💾 完成編輯';
        btn.className = 'btn btn-success';
        alert('✏️ 已開啟【編輯學期課表模式】！\n現在點擊課表任何一格，即可修改固定班級、科目與上課教室。\n編輯完成請記得再次點擊右上角「💾 完成編輯」。');
      } else {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> ✏️ 編輯學期課表';
        btn.className = 'btn btn-primary';
        alert('💾 已儲存學期固定課表！\n平常狀況點擊課表格子，可用於登記本週代課與調課備註（跨週會自動清空重置）。');
      }
    }
    this.renderGrid();
  },

  // 📸 一鍵將教師週課表匯出為高畫質 PNG 圖片
  async exportPNG() {
    const card = document.getElementById('timetableGridContainer');
    if (!card) {
      alert('無法取得課表容器！');
      return;
    }

    try {
      // 建立暫時性繪製標題與日期 Header
      const tempHeader = document.createElement('div');
      tempHeader.className = 'export-temp-header';
      tempHeader.style.cssText = 'text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #d97706;';
      const now = new Date();
      const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      tempHeader.innerHTML = `
        <h2 style="margin: 0; color: #78350f; font-family: var(--font-family-title), sans-serif; font-size: 1.4rem;">🏫 南寧高中 教師個人週課表</h2>
        <div style="font-size: 0.85rem; color: #92400e; margin-top: 4px;">產出日期：${dateStr} | 課表版本：114學年度第二學期</div>
      `;
      card.insertBefore(tempHeader, card.firstChild);

      const actionBtns = card.querySelectorAll('.btn-chip, .btn-outline, .btn-sm, .empty-cell-text, .edit-icon-hint');
      actionBtns.forEach(btn => btn.style.visibility = 'hidden');

      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      actionBtns.forEach(btn => btn.style.visibility = 'visible');
      tempHeader.remove();

      const timestamp = StorageManager.getFormattedTimestamp();
      const link = document.createElement('a');
      link.download = `${timestamp}_南寧高中_教師個人週課表.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      const existHeader = card.querySelector('.export-temp-header');
      if (existHeader) existHeader.remove();
      alert(`匯出圖片失敗：${err.message || err}`);
      console.error(err);
    }
  },

  // 🖨️ 一鍵將教師週課表渲染為滿版圖檔列印 (100% 保證單頁 A4 不跨頁)
  async printTimetable() {
    const card = document.getElementById('timetableGridContainer');
    if (!card) return;

    if (typeof html2canvas === 'undefined') {
      return alert('圖片繪製套件未載入，請重新整理網頁！');
    }

    const actionBtns = card.querySelectorAll('.btn-chip, .btn-outline, .btn-sm, .empty-cell-text, .edit-icon-hint');
    actionBtns.forEach(btn => btn.style.visibility = 'hidden');

    // 建立暫時性繪製標題與日期 Header
    const tempHeader = document.createElement('div');
    tempHeader.className = 'export-temp-header';
    tempHeader.style.cssText = 'text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #d97706; background: #ffffff;';
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    tempHeader.innerHTML = `
      <h2 style="margin: 0; color: #78350f; font-family: var(--font-family-title), sans-serif; font-size: 1.4rem;">🏫 南寧高中 教師個人週課表</h2>
      <div style="font-size: 0.85rem; color: #92400e; margin-top: 4px;">產出日期：${dateStr} | 課表版本：114學年度第二學期</div>
    `;
    card.insertBefore(tempHeader, card.firstChild);

    try {
      const canvas = await html2canvas(card, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      actionBtns.forEach(btn => btn.style.visibility = 'visible');
      tempHeader.remove();

      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        alert('請允許開啟彈出視窗以進行列印！');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>🏫 南寧高中 教師個人週課表 列印</title>
          <style>
            @page { size: A4 landscape; margin: 0; }
            html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; background: #ffffff; overflow: hidden; }
            img { max-width: 96vw; max-height: 94vh; object-fit: contain; display: block; }
          </style>
        </head>
        <body>
          <img src="${imgData}" onload="setTimeout(function(){ window.print(); window.close(); }, 300);" />
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      actionBtns.forEach(btn => btn.style.visibility = 'visible');
      const existHeader = card.querySelector('.export-temp-header');
      if (existHeader) existHeader.remove();
      alert('列印產生失敗：' + (err.message || err));
      console.error(err);
    }
  },

  bindEvents() {
    // 頂部按鈕已於 index.html 設定 onclick 直通觸發器，無需重覆 addEventListener
  },

  // 開啟 📥 讀取/訂閱 Google 日曆網址彈窗
  openGoogleImportModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `📥 讀取並訂閱線上 Google 日曆 (反向自動同步)`;

    const currentUrl = this.data.googleCalendarUrl || '';

    modalBody.innerHTML = `
      <div style="font-size: 0.95rem; line-height: 1.6; color: var(--text-main);">
        <p style="color: var(--color-leaf-green); font-weight: bold; font-size: 1.05rem; margin-bottom: 8px;">
          🔗 方式一：貼入 Google 日曆網址或非公開 .ics 網址
        </p>
        
        <div style="margin: 10px 0;">
          <input type="url" id="googleIcalUrlInput" class="form-control" value="${currentUrl}" placeholder="貼入 非公開網址 (iCal 格式) 或 日曆 ID (如 23020-03@nnjh.tn.edu.tw)">
        </div>

        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
          <p style="color: var(--color-terracotta); font-weight: bold; font-size: 1.05rem; margin-bottom: 6px;">
            📁 方式二：直接上傳 Google 行事曆匯出的 .ics 檔案 (100% 免連線成功)
          </p>
          <input type="file" id="localIcsFileInput" accept=".ics" class="form-control">
        </div>

        <div style="padding: 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px dashed var(--border-color); font-size: 0.85rem; margin-top: 14px;">
          <b>📖 如何使用「方式一」非公開網址？</b>
          <ol style="margin-left: 20px; margin-top: 6px; margin-bottom: 4px;">
            <li>開啟 <a href="https://calendar.google.com" target="_blank" style="color: var(--color-terracotta); text-decoration: underline;">Google 日曆網頁版</a>，點擊左側日曆旁的 <b>「⋮」->「設定與共用」</b>。</li>
            <li>捲動至最下方找到 <b>「整合日曆」</b>。</li>
            <li>在 <b>「非公開網址 (iCal 格式)」</b> 處按右側 <b>📋 複製圖示</b>，貼至上面方式一即可！</li>
          </ol>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '📥 讀取網址並同步';
    confirmBtn.className = 'btn btn-accent';

    const closeModal = () => {
      backdrop.classList.add('hidden');
      confirmBtn.textContent = '確定';
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    // 監聽方式二：本機檔案上傳
    document.getElementById('localIcsFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        closeModal();
        this.loadIcsFile(file);
      }
    });

    confirmBtn.onclick = () => {
      const url = document.getElementById('googleIcalUrlInput').value.trim();
      if (!url) {
        alert('請輸入 Google 日曆網址或選取 .ics 檔案！');
        return;
      }
      closeModal();
      this.syncFromGoogleCalendarUrl(url);
    };
  },

  // 本機直接讀取解析 .ics 檔案 (離線 100% 成功)
  loadIcsFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const icsText = e.target.result;
        const events = this.parseICS(icsText);
        if (events.length === 0) {
          return alert('未在該 .ics 檔案中找到任何有效的行程活動！');
        }
        this.data.remoteEvents = events;
        this.saveData();
        alert(`🎉 成功從行事曆檔案【${file.name}】讀取並匯入了 ${events.length} 個行程活動！`);
      } catch (err) {
        alert(`解析 .ics 檔案失敗：${err.message || err}`);
      }
    };
    reader.readAsText(file);
  },

  // 從 Google 日曆 iCal / ICS 網址抓取與解析行程 (帶有 4 秒超時防護與代理切換)
  async syncFromGoogleCalendarUrl(url) {
    if (!url) return;

    try {
      let fetchUrl = url.trim();

      // 1. 若使用者填入 日曆 ID (例如: test@gmail.com)
      if (!fetchUrl.startsWith('http') && fetchUrl.includes('@')) {
        fetchUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(fetchUrl)}/public/basic.ics`;
      }

      // 2. 若使用者貼入網頁內嵌網址 (embed)
      if (fetchUrl.includes('calendar.google.com/calendar/embed')) {
        const match = fetchUrl.match(/src=([^&]+)/);
        if (match && match[1]) {
          fetchUrl = `https://calendar.google.com/calendar/ical/${match[1]}/public/basic.ics`;
        }
      }

      let icsText = null;

      const fetchWithTimeout = async (srcUrl, timeoutMs = 4000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(srcUrl, { signal: controller.signal });
          clearTimeout(id);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.includes('BEGIN:VCALENDAR')) return txt;
          }
        } catch (e) {
          clearTimeout(id);
        }
        return null;
      };

      // 嘗試直接連線或代理連線
      icsText = await fetchWithTimeout(fetchUrl);
      if (!icsText) {
        icsText = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`);
      }
      if (!icsText) {
        icsText = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(fetchUrl)}`);
      }

      if (!icsText) {
        return alert(`💡 網路連線提醒：\n受限於瀏覽器跨網域安全保護 (CORS) 限制，網頁無法直接聯網讀取此 Google 日曆密用網址。\n\n請改用「方式二：上傳 .ics 檔案」：\n點擊視窗中的「方式二：選擇檔案」，選取您從 Google 日曆「匯出」下載的 .ics 檔，即可 100% 秒速離線匯入！`);
      }

      const events = this.parseICS(icsText);

      if (events.length === 0) {
        return alert('未能從該日曆讀取到任何行程，請確認日曆中是否有建立行程活動！');
      }

      this.data.googleCalendarUrl = fetchUrl;
      this.data.remoteEvents = events;
      this.saveData();

      alert(`🎉 成功從您的 Google 日曆自動讀取並同步了 ${events.length} 個行程活動！`);
    } catch (err) {
      alert(`💡 建議解法：\n請使用「方式二：上傳 .ics 檔案」，選取您從 Google 日曆下載的 .ics 檔案即可 100% 秒速匯入！`);
      console.error(err);
    }
  },

  // 簡易通用 iCalendar (ICS) 格式解析器
  parseICS(icsText) {
    const events = [];
    const lines = icsText.split(/\r?\n/);
    let inEvent = false;
    let currentEvent = {};

    for (let line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        currentEvent = {};
      } else if (line.startsWith('END:VEVENT')) {
        inEvent = false;
        if (currentEvent.summary) {
          events.push(currentEvent);
        }
      } else if (inEvent) {
        if (line.startsWith('SUMMARY:')) currentEvent.summary = line.replace('SUMMARY:', '').trim();
        else if (line.startsWith('LOCATION:')) currentEvent.location = line.replace('LOCATION:', '').trim();
        else if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.replace('DESCRIPTION:', '').trim();
        else if (line.startsWith('DTSTART')) currentEvent.dtstart = line.split(':')[1] || '';
        else if (line.startsWith('DTEND')) currentEvent.dtend = line.split(':')[1] || '';
      }
    }
    return events;
  },

  // 匯出全週課表為 .ics 標準行事曆檔案 (相容 Google Calendar, Apple Calendar, Outlook)
  exportToICS() {
    if (!this.data || !this.data.periods) return alert('目前尚無課表資料！');

    const periods = this.data.periods;
    const grid = this.data.grid || {};

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nanning Cafe//Teacher Weekly Schedule//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:南寧高中-教師個人週課表'
    ];

    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);

    const pad = num => String(num).padStart(2, '0');

    for (let day = 1; day <= 5; day++) {
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + (day - 1));

      const yyyy = targetDate.getFullYear();
      const mm = pad(targetDate.getMonth() + 1);
      const dd = pad(targetDate.getDate());

      for (let p of periods) {
        const cellKey = `${day}_${p.period}`;
        const cell = grid[cellKey];

        if (cell && cell.className && cell.className !== '空堂' && cell.className !== '無課') {
          const startParts = (p.startTime || '08:00').split(':');
          const endParts = (p.endTime || '09:00').split(':');

          const dtStart = `${yyyy}${mm}${dd}T${pad(startParts[0])}${pad(startParts[1])}00`;
          const dtEnd = `${yyyy}${mm}${dd}T${pad(endParts[0])}${pad(endParts[1])}00`;

          const summary = `[${cell.className}] ${cell.subject || '課程'}`;
          const location = cell.location || '';
          const description = cell.substitute ? `代課備註：${cell.substitute}` : '南寧高中每週固定課程';

          icsContent.push('BEGIN:VEVENT');
          icsContent.push(`SUMMARY:${summary}`);
          icsContent.push(`DTSTART:${dtStart}`);
          icsContent.push(`DTEND:${dtEnd}`);
          icsContent.push(`RRULE:FREQ=WEEKLY;BYDAY=${['', 'MO', 'TU', 'WE', 'TH', 'FR'][day]}`);
          if (location) icsContent.push(`LOCATION:${location}`);
          icsContent.push(`DESCRIPTION:${description}`);
          icsContent.push('END:VEVENT');
        }
      }
    }

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const timestamp = StorageManager.getFormattedTimestamp();
    link.download = `${timestamp}_教師個人課表_Google行事曆匯入檔.ics`;
    link.click();

    setTimeout(() => {
      this.openGoogleCalendarHelpModal();
    }, 500);
  },

  // 開啟 Google 行事曆匯入說明彈窗
  openGoogleCalendarHelpModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `📅 成功匯出！匯入至 Google 行事曆說明`;

    modalBody.innerHTML = `
      <div style="font-size: 0.95rem; line-height: 1.6; color: var(--text-main);">
        <p style="color: var(--color-leaf-green); font-weight: bold; font-size: 1.05rem;">
          🎉 已成功生成並下載【.ics 通用行事曆檔案】！
        </p>
        <p>請按照以下 3 個步驟，即可將全週課表同步至您的 <b>Google 行事曆</b>（手機/電腦跨裝置同步）：</p>
        <ol style="margin-left: 20px; margin-bottom: 16px;">
          <li style="margin-bottom: 6px;">點擊下方按鈕開啟 <b><a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" style="color: var(--color-terracotta); text-decoration: underline;">Google 日曆「匯入與匯出」頁面</a></b>。</li>
          <li style="margin-bottom: 6px;">點擊<b>「從電腦中選取檔案」</b>，選擇剛下載的 <code>.ics</code> 課表檔案。</li>
          <li style="margin-bottom: 6px;">選擇要加入的目標日曆（如個人主要日曆），並點擊<b>「匯入」</b>按鈕。</li>
        </ol>
        <div style="padding: 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px dashed var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
          💡 提示：匯入後每週的課表會自動按時間出現在您的 Google 日曆中，手機也會自動收到上課通知提醒！
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '📆 開啟 Google 日曆設定';
    confirmBtn.className = 'btn btn-primary';

    const closeModal = () => {
      backdrop.classList.add('hidden');
      confirmBtn.textContent = '確定';
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank');
      closeModal();
    };
  },

  // 一鍵單節新增至 Google 日曆
  openGoogleQuickAdd(day, period) {
    const cellKey = `${day}_${period}`;
    const cell = this.data.grid[cellKey];
    if (!cell || !cell.className) return alert('此節課尚無班級資料！');

    const periodObj = (this.data.periods || []).find(p => p.period === period) || { startTime: '08:10', endTime: '09:00' };

    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distanceToMon + (day - 1));

    const pad = n => String(n).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    const mm = pad(targetDate.getMonth() + 1);
    const dd = pad(targetDate.getDate());

    const startParts = (periodObj.startTime || '08:10').split(':');
    const endParts = (periodObj.endTime || '09:00').split(':');

    const dtStart = `${yyyy}${mm}${dd}T${pad(startParts[0])}${pad(startParts[1])}00`;
    const dtEnd = `${yyyy}${mm}${dd}T${pad(endParts[0])}${pad(endParts[1])}00`;

    const title = encodeURIComponent(`[${cell.className}] ${cell.subject || '課程'}`);
    const details = encodeURIComponent(cell.substitute ? `代課備註：${cell.substitute}` : '南寧高中課表排程');
    const location = encodeURIComponent(cell.location || '');

    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
    window.open(googleUrl, '_blank');
  },

  // 計算並更新側邊欄時間下方的「📢 下一節課提醒」Widget
  updateSidebarWidget() {
    const textEl = document.getElementById('nextClassText');
    if (!textEl) return;

    const info = this.calculateNextClassInfo();
    textEl.innerHTML = info.html;
  },

  // 計算下一節課與目前課程邏輯
  calculateNextClassInfo() {
    if (!this.data || !this.data.periods) {
      return { html: '<span style="color:var(--text-muted);">課表載入中...</span>' };
    }

    const now = new Date();
    let day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const timeToMins = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // 假日 (週六、週日)：提醒週一第一節
    if (day === 0 || day === 6) {
      const monFirst = this.data.grid['1_1'];
      if (monFirst && monFirst.className) {
        return {
          html: `📅 週一第 1 節：<b style="color:var(--color-terracotta);">${monFirst.className}</b> ${monFirst.subject}`
        };
      }
      return { html: '☕ 週末假期，祝您休息愉快！' };
    }

    const periods = this.data.periods;
    let currentCourse = null;
    let nextCourse = null;

    for (let p of periods) {
      const start = timeToMins(p.startTime);
      const end = timeToMins(p.endTime);
      const cellKey = `${day}_${p.period}`;
      const cell = this.data.grid[cellKey];

      if (cell && cell.className && cell.className !== '空堂' && cell.className !== '無課') {
        // 目前正在上課中
        if (currentMins >= start && currentMins < end) {
          currentCourse = { period: p, cell };
        }
        // 即將到來的下一節課
        else if (currentMins < start && !nextCourse) {
          nextCourse = { period: p, cell };
        }
      }
    }

    // 1. 若目前正在上課中
    if (currentCourse) {
      const subBadge = currentCourse.cell.substitute ? 
        `<span style="color:var(--color-amber); font-weight:bold;"> [代課: ${currentCourse.cell.substitute}]</span>` : '';
      return {
        html: `⚡ 上課中 (${currentCourse.period.name})：<b style="color:var(--color-leaf-green);">${currentCourse.cell.className}</b> ${currentCourse.cell.subject}${subBadge}`
      };
    }

    // 2. 若今天接下來還有課
    if (nextCourse) {
      const subBadge = nextCourse.cell.substitute ? 
        `<span style="color:var(--color-amber); font-weight:bold;"> [代課: ${nextCourse.cell.substitute}]</span>` : '';
      return {
        html: `📢 下一節 (${nextCourse.period.startTime})：<b style="color:var(--color-terracotta);">${nextCourse.cell.className}</b> ${nextCourse.cell.subject}${subBadge}`
      };
    }

    // 3. 今天課程已結束，尋找明天或週一的第一節課
    let nextDay = day + 1;
    if (nextDay > 5) nextDay = 1;
    const nextDayName = this.DAY_NAMES[nextDay] || '明天';

    for (let p of periods) {
      const cellKey = `${nextDay}_${p.period}`;
      const cell = this.data.grid[cellKey];
      if (cell && cell.className && cell.className !== '空堂') {
        const subBadge = cell.substitute ? ` [代: ${cell.substitute}]` : '';
        return {
          html: `🌅 ${nextDayName}第 ${p.period} 節 (${p.startTime})：<b>${cell.className}</b> ${cell.subject}${subBadge}`
        };
      }
    }

    return { html: '✨ 今日與明日無課，享受充實時光！' };
  },

  // 渲染 5 天 x 8 節 主課表表格
  renderGrid() {
    const container = document.getElementById('timetableGridContainer');
    if (!container) return;

    if (!this.data || !this.data.periods || !Array.isArray(this.data.periods) || this.data.periods.length === 0 || !this.data.grid || Object.keys(this.data.grid).length < 3) {
      this.data = StorageManager.getDefaultTimetable();
      StorageManager.set(StorageManager.KEYS.TIMETABLE, this.data);
    }

    const periods = this.data.periods || [];
    const grid = this.data.grid || {};

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;

    let html = `
      <div class="print-only-header" style="display: none; text-align: center; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 1.35rem; font-weight: bold; color: #000; font-family: var(--font-family-title), sans-serif;">🏫 南寧高中 教師個人週課表</h2>
        <div style="font-size: 0.8rem; color: #333; margin-top: 2px;">印製日期：${dateStr} | 114學年度第二學期</div>
      </div>
      <div class="table-responsive">
        <table class="table table-bordered timetable-table" style="width:100%; border-collapse:collapse; text-align:center; border: 2px solid var(--border-color);">
          <thead>
            <tr style="background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--color-latte) 100%); color: var(--text-main);">
              <th style="width: 12%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;"><i class="fa-solid fa-clock"></i> 節次 / 時間</th>
              <th style="width: 17.6%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;">🗓️ 星期一</th>
              <th style="width: 17.6%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;">🗓️ 星期二</th>
              <th style="width: 17.6%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;">🗓️ 星期三</th>
              <th style="width: 17.6%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;">🗓️ 星期四</th>
              <th style="width: 17.6%; padding: 12px; border: 1.5px solid var(--border-color); font-family: var(--font-family-title); font-size: 1.05rem;">🗓️ 星期五</th>
            </tr>
          </thead>
          <tbody>
    `;

    periods.forEach(p => {
      html += `
        <tr>
          <td style="background: var(--bg-secondary); vertical-align: middle; padding: 10px 6px; border: 1.5px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 1rem; color: var(--color-leaf-green); font-family: var(--font-family-title);">${p.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${p.startTime} - ${p.endTime}</div>
          </td>
      `;

      for (let day = 1; day <= 5; day++) {
        const cellKey = `${day}_${p.period}`;
        const cell = grid[cellKey] || { className: '', subject: '', location: '', substitute: '', substituteNote: '' };
        const hasClass = (cell.className && cell.className !== '空堂' && cell.className !== '無課') || (cell.substitute && cell.substitute.trim() !== '');

        html += `
          <td class="timetable-cell ${hasClass ? 'has-class' : 'empty-cell'}" 
              style="position: relative; vertical-align: middle; padding: 10px 8px; cursor: pointer; border: 1.5px solid var(--border-color); background: ${hasClass ? 'var(--bg-card)' : 'transparent'}; transition: background var(--transition-fast);"
              onclick="TimetableModule.handleCellClick(${day}, ${p.period})">
        `;

        if (hasClass) {
          html += `
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--color-terracotta);">${cell.className || '代課/無班級'}</div>
            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-top: 2px;">${cell.subject || '-'}</div>
            ${cell.location ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;"><i class="fa-solid fa-location-dot" style="color: var(--color-amber);"></i> ${cell.location}</div>` : ''}
          `;

          // 若有代課備註
          if (cell.substitute) {
            html += `
              <div style="margin-top: 5px; padding: 2px 8px; border-radius: 12px; background: rgba(217, 119, 6, 0.15); color: #b45309; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-user-check"></i> ${cell.substitute}
              </div>
            `;
          }

          // 快捷切換班級按鈕
          if (!this.isEditing && cell.className && cell.className !== '空堂') {
            html += `
              <div style="margin-top: 6px; display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-sm btn-chip" style="font-size: 0.75rem; padding: 2px 8px;" title="點擊切換為當前班級" onclick="event.stopPropagation(); TimetableModule.switchToClass('${cell.className}')">
                  🚀 切換此班
                </button>
              </div>
            `;
          }
        } else {
          html += `<div class="empty-cell-text" style="color: var(--text-muted); font-size: 0.88rem; opacity: 0.5;">—</div>`;
        }

        if (this.isEditing) {
          html += `
            <div class="edit-icon-hint" style="position: absolute; top: 4px; right: 4px; color: var(--color-leaf-green); font-size: 0.8rem;">
              <i class="fa-solid fa-pen"></i>
            </div>
          `;
        }

        html += `</td>`;
      }

      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
    this.syncCommonInputs();
  },

  // 快捷切換當前班級
  switchToClass(className) {
    if (!className) return;
    if (typeof changeActiveClassWithGuard === 'function') {
      changeActiveClassWithGuard(className);
    } else {
      StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, className);
      window.dispatchEvent(new Event('rosterUpdated'));
    }
  },

  // 點擊格子開啟對應彈窗
  handleCellClick(day, period) {
    const cellKey = `${day}_${period}`;
    const cell = this.data.grid[cellKey] || { className: '', subject: '', location: '', substitute: '', substituteNote: '', substituteWeekId: '' };
    const periodObj = (this.data.periods || []).find(p => p.period === period) || { name: `第 ${period} 節` };
    const dayName = this.DAY_NAMES[day] || `週${day}`;

    const hasClass = cell.className && cell.className !== '空堂' && cell.className !== '無課';

    // 若該節課尚未設定固定班級，或是開啟了編輯模式，一律點擊直接開啟【編輯學期固定課表】彈窗
    if (this.isEditing || !hasClass) {
      this.openScheduleEditModal(day, period, cell, periodObj, dayName);
    } else {
      // 否則開啟【登錄本週代課與調課紀錄】彈窗
      this.openSubstituteModal(day, period, cell, periodObj, dayName);
    }
  },

  // A. 平常模式彈窗：登錄 / 編輯 / 清除 本週代課註記 (維持一週，跨週自動清空)
  openSubstituteModal(day, period, cell, periodObj, dayName) {
    const cellKey = `${day}_${period}`;
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `📋 登錄本週代課與調課紀錄（${dayName} ${periodObj.name}）`;

    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 0.95rem;">
        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-weight: bold; color: var(--color-terracotta); font-size: 1.05rem;">
            ${cell.className || '無固定班級'} ${cell.subject ? `— ${cell.subject}` : ''}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
            上課地點：${cell.location || '無登記教室'} (${periodObj.startTime || ''} - ${periodObj.endTime || ''})
          </div>
        </div>

        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block; color: var(--color-amber);">
            <i class="fa-solid fa-user-pen"></i> 本週代課 / 請假 / 調課人員：
          </label>
          <input type="text" id="cellSubstituteInput" class="form-control" value="${cell.substitute || ''}" placeholder="例如：由張明雄老師代課 / 代502班">
        </div>

        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">
            <i class="fa-solid fa-clipboard-list"></i> 代課事由 / 說明 (選填)：
          </label>
          <input type="text" id="cellSubstituteNoteInput" class="form-control" value="${cell.substituteNote || ''}" placeholder="例如：教務處公假派代 / 請事假">
        </div>

        <div style="padding: 10px; border-radius: 6px; background: rgba(217, 119, 6, 0.1); border: 1px dashed var(--color-amber); font-size: 0.82rem; color: var(--text-main);">
          💡 <b>跨週自動重置機制</b>：本代課紀錄僅維持本週生效。當時間跨至下一週時，系統將全自動清空備註並恢復固定課表！
        </div>

        ${cell.substitute ? `
          <div style="text-align: right;">
            <button type="button" class="btn btn-sm btn-outline-danger" id="clearSubBtn">
              <i class="fa-solid fa-trash"></i> 清除本節代課紀錄
            </button>
          </div>
        ` : ''}
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '💾 儲存本週代課';
    confirmBtn.className = 'btn btn-accent';

    const closeModal = () => {
      backdrop.classList.add('hidden');
      confirmBtn.textContent = '確定';
      confirmBtn.className = 'btn btn-primary';
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    document.getElementById('clearSubBtn')?.addEventListener('click', () => {
      if (this.data.grid[cellKey]) {
        this.data.grid[cellKey].substitute = '';
        this.data.grid[cellKey].substituteNote = '';
        delete this.data.grid[cellKey].substituteWeekId;
        this.saveData();
      }
      closeModal();
    });

    confirmBtn.onclick = () => {
      const substitute = document.getElementById('cellSubstituteInput').value.trim();
      const substituteNote = document.getElementById('cellSubstituteNoteInput').value.trim();

      if (!this.data.grid[cellKey]) {
        this.data.grid[cellKey] = { className: '', subject: '', location: '' };
      }

      this.data.grid[cellKey].substitute = substitute;
      this.data.grid[cellKey].substituteNote = substituteNote;
      this.data.grid[cellKey].substituteWeekId = this.getWeekId(new Date());

      this.saveData();
      closeModal();
    };
  },

  // B. 編輯學期課表模式彈窗 (點擊右上角「✏️ 編輯學期課表」時才可以修改班級、科目、地點)
  openScheduleEditModal(day, period, cell, periodObj, dayName) {
    const cellKey = `${day}_${period}`;
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `✏️ 編輯學期固定課表（${dayName} ${periodObj.name}）`;

    const classesMap = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    const classOptions = Object.keys(classesMap).sort((a, b) => a.localeCompare(b, 'zh-TW', { numeric: true }));

    modalBody.innerHTML = `
      <form id="cellEditForm" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">固定上課班級：</label>
          <input type="text" id="cellClassName" list="classOptionsList" class="form-control" value="${cell.className || ''}" placeholder="例如：501班 或 401班 (留空代表空堂)">
          <datalist id="classOptionsList">
            ${classOptions.map(cls => `<option value="${cls}">`).join('')}
          </datalist>
        </div>

        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">固定科目 / 活動名稱：</label>
          <input type="text" id="cellSubject" list="commonSubjectsList" class="form-control" value="${cell.subject || ''}" placeholder="例如：生活科技、資訊科技、班會">
          <datalist id="commonSubjectsList">
            ${(this.data.commonSubjects || []).map(sub => `<option value="${sub}">`).join('')}
          </datalist>
        </div>

        <div>
          <label style="font-weight: bold; margin-bottom: 4px; display: block;">固定教室 / 上課地點：</label>
          <input type="text" id="cellLocation" list="commonLocationsList" class="form-control" value="${cell.location || ''}" placeholder="例如：生科教室、電腦教室">
          <datalist id="commonLocationsList">
            ${(this.data.commonLocations || []).map(loc => `<option value="${loc}">`).join('')}
          </datalist>
        </div>

        <!-- 常用項目快捷管理展開區域 -->
        <div style="border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 4px;">
          <details>
            <summary style="font-size: 0.85rem; color: var(--color-espresso); cursor: pointer; font-weight: bold; user-select: none;">
              ⚙️ 管理常用科目與教室清單
            </summary>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 6px;">
              <div>
                <label style="font-size: 0.82rem; font-weight: bold; display: block; margin-bottom: 4px;">常用科目 (半形逗號分隔)：</label>
                <input type="text" id="manageCommonSubjects" class="form-control" value="${(this.data.commonSubjects || []).join(',')}" placeholder="項目間請用半形逗號 , 分隔">
              </div>
              <div>
                <label style="font-size: 0.82rem; font-weight: bold; display: block; margin-bottom: 4px;">常用教室 (半形逗號分隔)：</label>
                <input type="text" id="manageCommonLocations" class="form-control" value="${(this.data.commonLocations || []).join(',')}" placeholder="項目間請用半形逗號 , 分隔">
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                💡 修改後點擊下方的「儲存學期課表」，清單即會同步更新。
              </div>
            </div>
          </details>
        </div>
      </form>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '💾 儲存學期課表';
    confirmBtn.className = 'btn btn-primary';

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const className = document.getElementById('cellClassName').value.trim();
      const subject = document.getElementById('cellSubject').value.trim();
      const location = document.getElementById('cellLocation').value.trim();

      // 讀取更新的常用清單
      const subInput = document.getElementById('manageCommonSubjects')?.value.trim();
      const locInput = document.getElementById('manageCommonLocations')?.value.trim();

      if (subInput !== undefined) {
        this.data.commonSubjects = subInput.split(',').map(s => s.trim()).filter(s => s !== '');
      }
      if (locInput !== undefined) {
        this.data.commonLocations = locInput.split(',').map(s => s.trim()).filter(s => s !== '');
      }

      if (!className) {
        delete this.data.grid[cellKey];
      } else {
        this.data.grid[cellKey] = {
          className,
          subject,
          location,
          substitute: cell.substitute || '',
          substituteNote: cell.substituteNote || '',
          substituteWeekId: cell.substituteWeekId || ''
        };
      }

      this.saveData();
      closeModal();
    };
  },

  // 開啟節次時間調整彈窗
  openPeriodTimesModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `⚙️ 設定各節次上課時間`;

    const periods = this.data.periods || [];

    modalBody.innerHTML = `
      <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 10px;">
        您可以修改各節次名稱與上下課精確時間（時間將用於左下角下一節課自動提醒！）：
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
        ${periods.map((p, idx) => `
          <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-secondary); padding: 8px; border-radius: 6px;">
            <input type="text" class="form-control period-name-input" data-idx="${idx}" value="${p.name}" style="width: 90px;">
            <input type="time" class="form-control period-start-input" data-idx="${idx}" value="${p.startTime}">
            <span>至</span>
            <input type="time" class="form-control period-end-input" data-idx="${idx}" value="${p.endTime}">
          </div>
        `).join('')}
      </div>
    `;

    backdrop.classList.remove('hidden');

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const nameInputs = document.querySelectorAll('.period-name-input');
      const startInputs = document.querySelectorAll('.period-start-input');
      const endInputs = document.querySelectorAll('.period-end-input');

      nameInputs.forEach((input, idx) => {
        if (periods[idx]) {
          periods[idx].name = input.value.trim() || `第 ${idx + 1} 節`;
          periods[idx].startTime = startInputs[idx].value;
          periods[idx].endTime = endInputs[idx].value;
        }
      });

      this.data.periods = periods;
      this.saveData();
      closeModal();
    };
  }
};
