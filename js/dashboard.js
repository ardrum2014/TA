/**
 * 今日班務與任務時間提醒綜合儀表板模組 (Dashboard Module - Milestone v6.30)
 */
const DashboardModule = {
  tasks: [],
  selectedSummaryClass: 'CURRENT', // 'CURRENT' | 'ALL' | specific class name

  clockTimerId: null,

  init() {
    this.loadTasks();
    this.bindEvents();
    this.startClockTimer();
  },

  startClockTimer() {
    if (this.clockTimerId) {
      clearInterval(this.clockTimerId);
    }
    this.tickClock();
    this.clockTimerId = setInterval(() => {
      this.tickClock();
    }, 1000);
  },

  tickClock() {
    const clockEl = document.getElementById('dashboardClockDisplay');
    if (clockEl) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      clockEl.textContent = `⏰ ${hh}:${min}:${ss}`;
    }
  },

  loadTasks() {
    const todayStr = new Date().toISOString().slice(0, 10);
    this.tasks = StorageManager.get('cozy_teacher_tasks', [
      { id: 't1', title: '📢 16:00 前收齊家長簽章回條', date: todayStr, time: '16:00', done: false, priority: 'high' },
      { id: 't2', title: '📝 檢查數學作業第一章習作', date: '2026-07-25', time: '12:30', done: false, priority: 'normal' }
    ]);
  },

  saveTasks() {
    StorageManager.set('cozy_teacher_tasks', this.tasks);
  },

  bindEvents() {
    // 時間自動重繪與狀態更新
  },

  render() {
    const container = document.getElementById('dashboard');
    if (!container) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const allClassesMap = StorageManager.get(StorageManager.KEYS.CLASSES, {});
    const classList = Object.keys(allClassesMap);

    if (this.selectedSummaryClass === 'CURRENT') {
      this.selectedSummaryClass = activeClass;
    }

    const students = StorageManager.getActiveClassStudents();

    // 1. 計算獨立日期、時間與課節資訊
    const timeInfo = this.getIndependentDateTimeInfo();

    // 2. 統計欠繳數據 (依選取班級或全校)
    const summaryTarget = this.selectedSummaryClass || activeClass;
    const missingStats = this.calculateMissingStats(summaryTarget);

    container.innerHTML = `
      <div class="panel-header" style="margin-bottom: 16px;">
        <h2><i class="fa-solid fa-mug-hot"></i> ☕ 今日班務與任務指揮中心</h2>
      </div>

      <!-- 頂部重點卡片 grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 20px;">
        
        <!-- 今日日期與實時時間 (同排大字體卡片) -->
        <div class="card" style="padding: 16px; border-left: 5px solid var(--color-leaf-green); background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">
              <i class="fa-solid fa-clock"></i> 今日課程狀態
            </span>
            <span class="badge badge-success" style="font-size: 0.78rem;">${timeInfo.rocDateStr}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin-top: 4px;">
            <span style="font-size: 1.4rem; font-weight: bold; color: var(--color-espresso);">
              📅 ${timeInfo.fullDateStr}
            </span>
            <span id="dashboardClockDisplay" style="font-size: 1.6rem; font-weight: bold; color: #2a9d8f; font-family: monospace;">
              ⏰ ${timeInfo.timeStr}
            </span>
          </div>
        </div>

        <!-- 課節進度與假日關懷卡片 -->
        <div class="card" style="padding: 16px; border-left: 5px solid ${timeInfo.isWeekend ? 'var(--color-terracotta)' : '#ff9f1c'}; background: var(--bg-card);">
          <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold; margin-bottom: 6px;">
            <i class="fa-solid ${timeInfo.isWeekend ? 'fa-couch' : 'fa-chalkboard-user'}"></i> ${timeInfo.isWeekend ? '☕ 假日溫馨關懷' : '📚 課節進度與即時提醒'}
          </div>
          ${timeInfo.isWeekend ? `
            <div style="font-size: 1.1rem; font-weight: bold; color: var(--color-espresso); margin-bottom: 4px;">
              ☕ 假日休息時間
            </div>
            <div style="font-size: 0.9rem; color: #d97706; font-weight: bold; line-height: 1.5; margin-top: 6px;">
              ${timeInfo.careMessage}
            </div>
          ` : `
            <div style="font-size: 1.05rem; font-weight: bold; color: var(--color-espresso);">
              ${timeInfo.currentPeriodText}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 4px;">
              👉 下一節：<b>${timeInfo.nextPeriodText}</b>
            </div>
            ${timeInfo.careMessage ? `
              <div style="font-size: 0.82rem; color: var(--color-leaf-green); margin-top: 6px; font-weight: bold;">
                ${timeInfo.careMessage}
              </div>
            ` : ''}
          `}
        </div>

        <!-- 欄位 4：班級欠交概況與選單 (Missing Homework Summary with Class Selector) -->
        <div class="card" style="padding: 16px; border-left: 5px solid var(--color-terracotta); background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">
              <i class="fa-solid fa-users"></i> 班級動態概況
            </span>
            <select id="dashboardClassSummarySelect" class="form-select inline-select" style="font-size: 0.8rem; padding: 2px 6px;" onchange="DashboardModule.changeSummaryClass(this.value)">
              <option value="ALL" ${summaryTarget === 'ALL' ? 'selected' : ''}>全校所有班級 (合計)</option>
              ${classList.map(c => `<option value="${c}" ${c === summaryTarget ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div style="font-size: 1.05rem; font-weight: bold; color: var(--color-espresso); margin-top: 4px;">
            欠交待補累計：<span style="color: #d9534f;">${missingStats.totalMissingCount} 人次</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span style="font-size: 0.82rem; color: var(--text-main);">
              ⚠️ 缺交大戶 (≥3件)：<b style="color: #d9534f;">${missingStats.warningStudentCount} 人</b>
            </span>
            <button class="btn btn-sm btn-outline-accent" style="padding: 2px 8px; font-size: 0.78rem;" onclick="DashboardModule.showMissingSummaryModal('${summaryTarget}')">
              <i class="fa-solid fa-magnifying-glass"></i> 瀏覽摘要
            </button>
          </div>
        </div>

      </div>

      <!-- 極速快捷工具發射台 -->
      <div class="card margin-bottom" style="padding: 16px; background: var(--bg-card);">
        <h4 style="margin-top: 0; margin-bottom: 12px; font-size: 1rem; color: var(--color-espresso);">
          <i class="fa-solid fa-bolt" style="color: var(--color-sun-yellow);"></i> 極速快捷工具發射台
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <button class="btn btn-outline" onclick="App.switchTab('progress'); setTimeout(() => ProgressModule.showConsolidatedMissingModal(), 100);">
            <i class="fa-solid fa-file-lines" style="color: var(--color-terracotta);"></i> 📋 一鍵產生全科催繳單
          </button>
          <button class="btn btn-outline" onclick="App.switchTab('progress'); setTimeout(() => ProgressModule.showDashboardModal(), 100);">
            <i class="fa-solid fa-chart-pie" style="color: #ff9f1c;"></i> ⚠️ 繳交狀況分析儀表板
          </button>
          <button class="btn btn-outline" onclick="App.switchTab('wheel');">
            <i class="fa-solid fa-dharmachakra" style="color: var(--color-leaf-green);"></i> 🎡 幸運輪盤抽籤
          </button>
          <button class="btn btn-outline" onclick="App.switchTab('schedule');">
            <i class="fa-solid fa-stopwatch" style="color: #2a9d8f;"></i> ⏱️ 課堂計時器
          </button>
          <button class="btn btn-outline" onclick="App.switchTab('points');">
            <i class="fa-solid fa-star" style="color: var(--color-sun-yellow);"></i> ⭐ 課堂加分榜
          </button>
        </div>
      </div>

      <!-- 任務時間提醒卡片區 (包含日期與時效性檢查) -->
      <div class="card" style="padding: 18px; background: var(--bg-card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h4 style="margin: 0; font-size: 1.05rem; color: var(--color-espresso);">
            <i class="fa-solid fa-bell" style="color: var(--color-terracotta);"></i> 🔔 班務與任務時間提醒清單 (含日期與時效檢核)
          </h4>
          <button class="btn btn-sm btn-accent" onclick="DashboardModule.showAddTaskModal()">
            <i class="fa-solid fa-plus"></i> 新增提醒任務
          </button>
        </div>

        <div id="dashboardTaskList" style="display: flex; flex-direction: column; gap: 10px;">
          ${this.tasks.length === 0 ? `
            <div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">
              目前尚無待辦提醒任務，點擊上方「+ 新增提醒任務」建立吧！
            </div>
          ` : this.tasks.map(task => {
            const isOverdue = this.checkIsOverdue(task);
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid ${isOverdue && !task.done ? '#d9534f' : 'var(--border-color)'};">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; text-decoration: ${task.done ? 'line-through' : 'none'}; opacity: ${task.done ? 0.6 : 1};">
                  <input type="checkbox" ${task.done ? 'checked' : ''} onchange="DashboardModule.toggleTaskDone('${task.id}')">
                  <div>
                    <div style="font-weight: bold; font-size: 0.98rem; color: var(--text-main);">${task.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                      📅 預訂日期：<b>${task.date || '未設定'}</b> ⏰ 提醒時間：<b>${task.time || '未設定'}</b>
                    </div>
                  </div>
                </label>
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${isOverdue && !task.done ? `
                    <span class="badge" style="background-color: #d9534f; color: white; font-size: 0.8rem; padding: 4px 8px;">
                      <i class="fa-solid fa-triangle-exclamation"></i> ⚠️ 已逾期
                    </span>
                  ` : `
                    <span class="badge ${task.done ? 'badge-secondary' : 'badge-warning'}" style="font-size: 0.8rem;">
                      <i class="fa-regular fa-clock"></i> ${task.time || '未指定'}
                    </span>
                  `}
                  <button type="button" style="border: none; background: transparent; color: #d9534f; cursor: pointer; font-size: 1.1rem; padding: 0 4px;" title="刪除任務" onclick="DashboardModule.deleteTask('${task.id}')">
                    &times;
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  getIndependentDateTimeInfo() {
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dayStr = dayNames[dayOfWeek];

    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    const fullDateStr = `${yyyy}/${mm}/${dd} (${dayStr.replace('星期', '週')})`;
    const rocDateStr = `民國 ${rocYear} 年 ${mm} 月 ${dd} 日`;
    const timeStr = `${hh}:${min}:${ss}`;

    let currentPeriodText = `自由準備時間`;
    let nextPeriodText = '準備課堂教學';
    let careMessage = '';

    if (isWeekend) {
      currentPeriodText = '☕ 假日時光 (無需上課)';
      nextPeriodText = '下週一課堂教學';
      careMessage = '❤️ 今天是溫馨假日，不用上課！請老師好好休息放鬆，充飽電再出發！';
    } else {
      const timetableData = (typeof TimetableModule !== 'undefined' && TimetableModule.data) 
        ? TimetableModule.data 
        : StorageManager.get(StorageManager.KEYS.TIMETABLE, StorageManager.getDefaultTimetable());

      const periods = (timetableData && timetableData.periods) ? timetableData.periods : [];
      const grid = (timetableData && timetableData.grid) ? timetableData.grid : {};
      const hm = `${hh}:${min}`;

      const currentP = periods.find(p => hm >= p.startTime && hm <= p.endTime);
      if (currentP) {
        const cellKey = `${dayOfWeek}_${currentP.period}`;
        const cell = grid[cellKey];
        let classSubjectText = '';
        if (cell && cell.className && cell.className !== '空堂' && cell.className !== '無課') {
          classSubjectText = ` [${cell.className} ${cell.subject || ''}]`;
        }

        currentPeriodText = `🔔 現在是：第 ${currentP.period} 節 (${currentP.name} ${currentP.startTime}~${currentP.endTime})${classSubjectText}`;
        
        const nextIdx = periods.indexOf(currentP) + 1;
        if (nextIdx < periods.length) {
          nextPeriodText = `第 ${periods[nextIdx].period} 節 (${periods[nextIdx].name} ${periods[nextIdx].startTime})`;
        } else {
          nextPeriodText = '今日課程已全部結束 🎉';
        }
        careMessage = '💪 教學順利，老師辛苦了！';
      } else {
        const firstP = periods[0];
        const lastP = periods[periods.length - 1];

        if (firstP && hm < firstP.startTime) {
          currentPeriodText = '🌅 早自習與課前準備時間';
          nextPeriodText = `第 1 節 (${firstP.name} ${firstP.startTime})`;
          careMessage = '🌅 早安！準備迎向充實美好的教學新一天，老師加油！';
        } else if (lastP && hm > lastP.endTime) {
          currentPeriodText = '🎉 今日課程已圓滿結束';
          nextPeriodText = '明日課堂教學';
          careMessage = '🎉 今日課業與班務已順利完成，老師辛苦了！請好好休息～❤️';
        } else {
          const nextP = periods.find(p => p.startTime > hm);
          currentPeriodText = '☕ 課間休息時間';
          nextPeriodText = nextP ? `第 ${nextP.period} 節 (${nextP.name} ${nextP.startTime})` : '課堂準備中';
          careMessage = '☕ 趁課間喝杯茶小憩一下吧！';
        }
      }
    }

    return { fullDateStr, rocDateStr, timeStr, isWeekend, currentPeriodText, nextPeriodText, careMessage };
  },

  changeSummaryClass(className) {
    this.selectedSummaryClass = className;
    this.render();
  },

  calculateMissingStats(targetClass) {
    const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
    const classesMap = StorageManager.get(StorageManager.KEYS.CLASSES, {});

    let targetClasses = [];
    if (targetClass === 'ALL') {
      targetClasses = Object.keys(classesMap);
    } else {
      targetClasses = [targetClass];
    }

    let totalMissingCount = 0;
    const warningMap = {};

    targetClasses.forEach(cls => {
      const subjects = progressMap[cls] || [];
      const students = classesMap[cls] || [];

      subjects.forEach(sub => {
        (sub.chapters || []).forEach(ch => {
          (ch.homeworks || []).forEach(hw => {
            students.forEach(st => {
              const status = hw.records[st.id] || 'missing';
              if (status === 'missing' || status === 'correcting') {
                totalMissingCount++;
                const key = `${cls}_${st.id}`;
                warningMap[key] = (warningMap[key] || 0) + 1;
              }
            });
          });
        });
      });
    });

    const warningStudentCount = Object.values(warningMap).filter(count => count >= 3).length;
    return { totalMissingCount, warningStudentCount };
  },

  showMissingSummaryModal(targetClass) {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
    const classesMap = StorageManager.get(StorageManager.KEYS.CLASSES, {});

    let targetClasses = targetClass === 'ALL' ? Object.keys(classesMap) : [targetClass];
    let summaryHtml = '';
    let reportTextLines = [];

    reportTextLines.push(`📢 【${targetClass === 'ALL' ? '全校所有班級' : targetClass}】未繳交作業對照摘要：`);
    reportTextLines.push(`----------------------------------`);

    targetClasses.forEach(cls => {
      const subjects = progressMap[cls] || [];
      const students = classesMap[cls] || [];
      let clsMissingItems = [];

      students.forEach(st => {
        subjects.forEach(sub => {
          (sub.chapters || []).forEach(ch => {
            (ch.homeworks || []).forEach(hw => {
              const status = hw.records[st.id] || 'missing';
              if (status === 'missing' || status === 'correcting') {
                clsMissingItems.push({
                  stName: st.name,
                  stNum: st.number,
                  subTitle: sub.title.replace(/📐|📖|🧪|🎨/g, '').trim(),
                  hwTitle: hw.title,
                  status: status === 'missing' ? '未繳 ❌' : '待訂正 🟡'
                });
              }
            });
          });
        });
      });

      if (clsMissingItems.length > 0) {
        reportTextLines.push(`🏫 【${cls}】(未繳待補 ${clsMissingItems.length} 件)：`);
        summaryHtml += `<div style="margin-bottom:12px; padding:10px; background:var(--bg-secondary); border-radius:6px;">
          <h4 style="margin:0 0 6px 0; color:var(--color-espresso);">🏫 【${cls}】(未繳待補 ${clsMissingItems.length} 件)</h4>
        `;
        clsMissingItems.forEach(item => {
          reportTextLines.push(`  - #${item.stNum} ${item.stName} 👉 ${item.subTitle}: ${item.hwTitle} (${item.status})`);
          summaryHtml += `<div style="font-size:0.88rem; margin-bottom:3px;">
            • <b>#${item.stNum} ${item.stName}</b> - ${item.subTitle}: ${item.hwTitle} <span style="color:#d9534f; font-weight:bold;">(${item.status})</span>
          </div>`;
        });
        summaryHtml += `</div>`;
      }
    });

    if (summaryHtml === '') {
      summaryHtml = `<div style="text-center; padding:20px; color:var(--color-leaf-green); font-weight:bold;">🎉 太棒了！選擇的班級目前沒有任何未繳交或待訂正的作業！</div>`;
      reportTextLines.push(`🎉 所有作業皆已全數交齊！`);
    }

    modalTitle.textContent = `🔍 【${targetClass === 'ALL' ? '全校所有班級' : targetClass}】未繳交作業瀏覽摘要`;
    modalBody.innerHTML = `
      <div style="max-height:340px; overflow-y:auto; font-size:0.95rem; line-height:1.5;">
        ${summaryHtml}
      </div>
      <div style="margin-top:12px; text-align:right;">
        <button class="btn btn-accent" id="copyMissingSummaryBtn"><i class="fa-solid fa-copy"></i> 複製此摘要報告</button>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '確定';
    confirmBtn.className = 'btn btn-primary';

    const copyBtn = document.getElementById('copyMissingSummaryBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(reportTextLines.join('\n')).then(() => {
          alert('🎉 已成功將未繳交摘要複製至剪貼簿！');
        });
      };
    }

    const closeModal = () => { backdrop.classList.add('hidden'); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = closeModal;
  },

  checkIsOverdue(task) {
    if (!task || !task.date || !task.time || task.done) return false;
    const now = new Date();
    const taskDateTime = new Date(`${task.date}T${task.time}:00`);
    return now > taskDateTime;
  },

  showAddTaskModal() {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    modalTitle.textContent = `🔔 新增班務與任務提醒 (含日期與時效)`;
    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem;">
        <div>
          <label style="font-weight: bold; display: block; margin-bottom: 4px;">任務提醒內容：</label>
          <input type="text" id="taskTitleInput" class="form-control" placeholder="例如：16:00 前收齊請假單" style="width:100%;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">📅 預訂日期：</label>
            <input type="date" id="taskDateInput" class="form-control" value="${todayStr}" style="width:100%;">
          </div>
          <div>
            <label style="font-weight: bold; display: block; margin-bottom: 4px;">⏰ 提醒時間：</label>
            <input type="time" id="taskTimeInput" class="form-control" value="16:00" style="width:100%;">
          </div>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '確定新增';
    confirmBtn.className = 'btn btn-accent';

    const closeModal = () => { backdrop.classList.add('hidden'); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const title = document.getElementById('taskTitleInput').value.trim();
      const date = document.getElementById('taskDateInput').value;
      const time = document.getElementById('taskTimeInput').value;

      if (!title) return alert('請輸入任務提醒內容！');

      this.tasks.push({
        id: Date.now().toString(),
        title,
        date: date || todayStr,
        time: time || '16:00',
        done: false,
        priority: 'normal'
      });

      this.saveTasks();
      closeModal();
      this.render();
    };
  },

  promptAddTask() {
    this.showAddTaskModal();
  },

  toggleTaskDone(taskId) {
    const t = this.tasks.find(x => x.id === taskId);
    if (t) {
      t.done = !t.done;
      this.saveTasks();
      this.render();
    }
  },

  deleteTask(taskId) {
    this.tasks = this.tasks.filter(x => x.id !== taskId);
    this.saveTasks();
    this.render();
  }
};
