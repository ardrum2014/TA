/**
 * 茶憩課堂 (Cozy Teacher Hub) - 主程式進入點
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化頁籤切換
  initTabs();

  // 2. 初始化主題切換 (暗色/亮色)
  initTheme();

  // 3. 初始化全站雲端備份
  initCloudBackup();

  // 4. 初始化側邊欄時鐘
  initSidebarClock();

  // 4. 全域班級選單事件連動
  initGlobalClassSelector();

  // 5. 初始化 10 大功能模組
  if (typeof DashboardModule !== 'undefined') {
    DashboardModule.init();
    DashboardModule.render();
  }
  RosterModule.init();
  ScheduleModule.init();
  WheelModule.init();
  SeatingModule.init();
  GroupsModule.init();
  PointsModule.init();
  ProgressModule.init();
  if (typeof TimetableModule !== 'undefined') TimetableModule.init();
});

// 全域 App 輔助全域發射器
const App = {
  switchTab(targetTab) {
    const navItems = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.tab-panel');

    navItems.forEach(i => {
      if (i.dataset.tab === targetTab) i.classList.add('active');
      else i.classList.remove('active');
    });
    panels.forEach(p => p.classList.remove('active'));

    const panel = document.getElementById(targetTab);
    if (panel) panel.classList.add('active');

    if (targetTab === 'dashboard' && typeof DashboardModule !== 'undefined') {
      DashboardModule.render();
    } else if (targetTab === 'progress' && typeof ProgressModule !== 'undefined') {
      if (typeof ProgressModule.collapseAll === 'function') {
        ProgressModule.collapseAll();
      }
      ProgressModule.render();
    } else if (targetTab === 'timetable' && typeof TimetableModule !== 'undefined') {
      TimetableModule.renderGrid();
      TimetableModule.updateSidebarWidget();
    } else if (targetTab === 'seating' && typeof SeatingModule !== 'undefined') {
      SeatingModule.render();
    } else if (targetTab === 'groups' && typeof GroupsModule !== 'undefined') {
      GroupsModule.render();
    } else if (targetTab === 'points' && typeof PointsModule !== 'undefined') {
      PointsModule.render();
    } else if (targetTab === 'roster' && typeof RosterModule !== 'undefined') {
      RosterModule.renderRosterTable();
    }

    document.getElementById('sidebar')?.classList.remove('show');
  },

  clearAllDataWithTripleGuard() {
    const confirm1 = confirm(
      "⚠️【第 1/3 關確認 - 刪除全站本機資料警告】\n\n" +
      "您確定要「一鍵抹除全站所有本機資料」嗎？\n\n" +
      "📌 此動作將會清空：\n" +
      " 1. 所有班級名冊與學生資料\n" +
      " 2. 班級座位表與排座限制設定\n" +
      " 3. 隨機分組名冊與組長指派\n" +
      " 4. 個人加分與小組競賽排行榜\n" +
      " 5. 課程進度、章節與作業繳交紀錄\n" +
      " 6. 教師個人週課表與代課調課備註\n\n" +
      "點擊「確定」將進入第 2 關驗證，點擊「取消」終止操作。"
    );
    if (!confirm1) return;

    const confirm2 = confirm(
      "🚨【第 2/3 關確認 - 資料無法復原警告】\n\n" +
      "請特別注意：一旦清空，所有本機儲存資料將【永久無法復原】！\n\n" +
      "💡 建議您：如果尚未備份，請先點選側邊欄的「備份全站」下載 .json 檔案備份。\n\n" +
      "若您已經備份或確定不需要這些資料，請點擊「確定」進入最終確認關卡。"
    );
    if (!confirm2) return;

    const finalInput = prompt(
      "🛑【第 3/3 關最終確認 - 輸入防護驗證】\n\n" +
      "為防止誤觸，請在下方輸入框中填入：『清除所有資料』\n" +
      "（請精準輸入這 6 個字，系統才會正式執行全站重置清空）"
    );

    if (finalInput !== '清除所有資料') {
      alert('❌ 輸入不符，操作已取消。您的全站資料安全保留，未做任何修改。');
      return;
    }

    localStorage.clear();
    alert('🗑️ 全站本機資料已成功徹底抹除清空！系統即將重新載入預設初始狀態。');
    location.reload();
  }
};

// 頁籤導覽
function initTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      App.switchTab(btn.dataset.tab);
    });
  });

  // 手機版側邊欄切換
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('show');
  });

  // 全域音效開關
  document.getElementById('quickSoundBtn')?.addEventListener('click', (e) => {
    AudioEngine.muted = !AudioEngine.muted;
    const icon = e.currentTarget.querySelector('i');
    if (icon) {
      icon.className = AudioEngine.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    }
  });
}

// 全站資料一鍵備份與匯入還原
function initCloudBackup() {
  // 備份全站至 JSON 檔
  document.getElementById('cloudBackupAllBtn')?.addEventListener('click', () => {
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      classes: StorageManager.get(StorageManager.KEYS.CLASSES, {}),
      activeClass: StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, ''),
      schedule: StorageManager.get(StorageManager.KEYS.SCHEDULE, []),
      groups: StorageManager.get(StorageManager.KEYS.GROUPS, {}),
      points: StorageManager.get(StorageManager.KEYS.POINTS, {}),
      homework: StorageManager.get(StorageManager.KEYS.HOMEWORK, {}),
      progress: StorageManager.get(StorageManager.KEYS.PROGRESS, {}),
      timetable: StorageManager.get(StorageManager.KEYS.TIMETABLE, {})
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    const timestamp = StorageManager.getFormattedTimestamp();
    dlAnchorElem.setAttribute("download", `${timestamp}_南寧咖啡館_全站資料備份.json`);
    dlAnchorElem.click();

    setTimeout(() => {
      if (confirm('已成功為您生成並下載【南寧咖啡館全站資料備份.json】！\n\n是否立即開啟 Google 雲端硬碟進行一鍵拖放存檔？')) {
        window.open('https://drive.google.com/drive/my-drive', '_blank');
      }
    }, 400);
  });

  // 匯入還原全站 JSON 備份檔
  document.getElementById('cloudRestoreInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        if (!backupData || typeof backupData !== 'object') {
          return alert('備份檔案格式不正確！');
        }

        if (confirm(`確定要將【${file.name}】全站備份檔還原至本機嗎？`)) {
          if (backupData.classes) StorageManager.set(StorageManager.KEYS.CLASSES, backupData.classes);
          if (backupData.activeClass) StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, backupData.activeClass);
          if (backupData.schedule) StorageManager.set(StorageManager.KEYS.SCHEDULE, backupData.schedule);
          if (backupData.groups) StorageManager.set(StorageManager.KEYS.GROUPS, backupData.groups);
          if (backupData.points) StorageManager.set(StorageManager.KEYS.POINTS, backupData.points);
          if (backupData.homework) StorageManager.set(StorageManager.KEYS.HOMEWORK, backupData.homework);
          if (backupData.progress) StorageManager.set(StorageManager.KEYS.PROGRESS, backupData.progress);
          if (backupData.timetable) StorageManager.set(StorageManager.KEYS.TIMETABLE, backupData.timetable);

          alert('🎉 全站資料已成功還原！網頁將自動重新載入。');
          window.location.reload();
        }
      } catch (err) {
        alert('還原失敗：無法解析該 JSON 備份檔案。');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// 主題切換 (Cozy Light <-> Cozy Dark)
function initTheme() {
  const btn = document.getElementById('themeToggleBtn');
  const savedTheme = StorageManager.get(StorageManager.KEYS.THEME, 'light');

  if (savedTheme === 'dark') {
    document.body.classList.add('theme-cozy-dark');
    if (btn) btn.querySelector('span').textContent = '暖亮模式';
  }

  btn?.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('theme-cozy-dark');
    StorageManager.set(StorageManager.KEYS.THEME, isDark ? 'dark' : 'light');
    if (btn) {
      btn.querySelector('span').textContent = isDark ? '暖亮模式' : '暖暗模式';
      btn.querySelector('i').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  });
}

// 側邊欄即時時鐘
function initSidebarClock() {
  const clockEl = document.getElementById('sidebarClock');
  const dateEl = document.getElementById('sidebarDate');

  const update = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = now.toTimeString().split(' ')[0];

    if (dateEl) dateEl.textContent = dateStr;
    if (clockEl) clockEl.textContent = timeStr;
  };
  update();
  setInterval(update, 1000);
}

// 全域班級選單變更
function initGlobalClassSelector() {
  const select = document.getElementById('globalClassSelect');
  select?.addEventListener('change', (e) => {
    changeActiveClassWithGuard(e.target.value, select);
  });
}

// 切換班級全域防護機制 (若有進行中活動跳出確認提醒)
function changeActiveClassWithGuard(newClass, selectElementToRevert = null) {
  const currentClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
  if (newClass === currentClass) return;

  let isRunning = false;
  let runningFeatureName = '';

  if (typeof WheelModule !== 'undefined' && WheelModule.isSpinning) {
    isRunning = true;
    runningFeatureName = '幸運輪盤抽籤';
  } else if (typeof ScheduleModule !== 'undefined' && ScheduleModule.isRunning) {
    isRunning = true;
    runningFeatureName = '課堂提醒與計時器';
  }

  if (isRunning) {
    const confirmSwitch = confirm(`⚠️ 【${runningFeatureName}】目前正在進行中！\n\n切換班級將會中斷目前的運作並重置狀態，確定要將班級切換至「${newClass}」嗎？`);
    if (!confirmSwitch) {
      if (selectElementToRevert) {
        selectElementToRevert.value = currentClass;
      }
      return;
    }

    if (typeof WheelModule !== 'undefined' && WheelModule.isSpinning) {
      WheelModule.isSpinning = false;
      WheelModule.hideWinnerOverlay();
    }
    if (typeof ScheduleModule !== 'undefined' && ScheduleModule.isRunning) {
      ScheduleModule.pauseTimer();
    }
  }

  StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, newClass);

  const globalSelect = document.getElementById('globalClassSelect');
  const rosterSelect = document.getElementById('rosterClassSelect');
  if (globalSelect) globalSelect.value = newClass;
  if (rosterSelect) rosterSelect.value = newClass;

  window.dispatchEvent(new CustomEvent('rosterUpdated', { detail: { className: newClass } }));
}
