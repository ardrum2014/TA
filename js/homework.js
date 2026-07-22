/**
 * 作業與習作繳交追蹤模組 (支援獨立班級作業紀錄)
 */
const HomeworkModule = {
  homeworkMap: {}, // className -> array of { id, title, records }
  homeworks: [],
  activeHwId: null,

  STATUS_LABELS: {
    missing: '未繳 ❌',
    submitted: '已繳 🟢',
    correcting: '待訂正 🟡',
    late: '補繳 🔵'
  },
  STATUS_NEXT: {
    missing: 'submitted',
    submitted: 'correcting',
    correcting: 'late',
    late: 'missing'
  },

  init() {
    this.homeworkMap = StorageManager.get(StorageManager.KEYS.HOMEWORK, {});
    if (Array.isArray(this.homeworkMap) || typeof this.homeworkMap !== 'object' || this.homeworkMap === null) {
      this.homeworkMap = {};
    }
    this.bindEvents();
    this.loadActiveHomeworks();

    window.addEventListener('rosterUpdated', () => this.loadActiveHomeworks());
  },

  loadActiveHomeworks() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.homeworkMap = StorageManager.get(StorageManager.KEYS.HOMEWORK, {});
    if (Array.isArray(this.homeworkMap) || typeof this.homeworkMap !== 'object' || this.homeworkMap === null) {
      this.homeworkMap = {};
    }
    this.homeworks = this.homeworkMap[activeClass] || [];
    this.activeHwId = this.homeworks.length > 0 ? this.homeworks[0].id : null;
    this.renderHomeworkSelect();
    this.renderTable();
  },

  saveActiveHomeworks() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.homeworkMap = StorageManager.get(StorageManager.KEYS.HOMEWORK, {});
    if (Array.isArray(this.homeworkMap) || typeof this.homeworkMap !== 'object' || this.homeworkMap === null) {
      this.homeworkMap = {};
    }
    this.homeworkMap[activeClass] = this.homeworks;
    StorageManager.set(StorageManager.KEYS.HOMEWORK, this.homeworkMap);
    this.renderHomeworkSelect();
    this.renderTable();
  },

  bindEvents() {
    document.getElementById('addHomeworkBtn')?.addEventListener('click', () => {
      const title = prompt('請輸入作業名稱（例如：國語第一課習作）：');
      if (!title) return;

      const newHw = {
        id: Date.now().toString(),
        title: title.trim(),
        records: {}
      };

      this.homeworks.push(newHw);
      this.activeHwId = newHw.id;
      this.saveActiveHomeworks();
    });

    document.getElementById('activeHomeworkSelect')?.addEventListener('change', (e) => {
      this.activeHwId = e.target.value;
      this.renderTable();
    });

    document.getElementById('deleteHomeworkBtn')?.addEventListener('click', () => {
      if (!this.activeHwId) return;
      if (confirm('確定要刪除此項作業紀錄嗎？')) {
        this.homeworks = this.homeworks.filter(h => h.id !== this.activeHwId);
        this.activeHwId = this.homeworks.length > 0 ? this.homeworks[0].id : null;
        this.saveActiveHomeworks();
      }
    });

    // 匯出作業繳交 Excel 表單
    document.getElementById('exportHomeworkExcelBtn')?.addEventListener('click', () => {
      this.exportExcel();
    });

    // 複製未繳名單
    document.getElementById('exportMissingHwBtn')?.addEventListener('click', () => {
      const activeHw = this.homeworks.find(h => h.id === this.activeHwId);
      if (!activeHw) return alert('請先選擇一項作業！');

      const students = StorageManager.getActiveClassStudents();
      const missingList = students.filter(st => {
        const status = activeHw.records[st.id] || 'missing';
        return status === 'missing' || status === 'correcting';
      });

      if (missingList.length === 0) {
        alert(`🎉 太棒了！【${activeHw.title}】全班皆已繳交完成！`);
        return;
      }

      const text = `📌【${activeHw.title}】尚未繳交/待訂正名單：\n` +
        missingList.map(st => `座號 ${st.number} ${st.name}`).join('\n');

      navigator.clipboard.writeText(text).then(() => {
        alert(`已成功複製未繳學生名單至剪貼簿！\n\n${text}`);
      }).catch(err => {
        alert(`複製失敗，未繳名冊如下：\n\n${text}`);
      });
    });
  },

  // 匯出作業繳交狀態 Excel 表單
  exportExcel() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    const activeHw = this.homeworks.find(h => h.id === this.activeHwId);
    if (!activeHw) return alert('請先選擇或建立一項作業！');

    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) return alert('目前班級中尚無學生資料！');

    const rows = students.map(st => {
      const statusKey = activeHw.records[st.id] || 'missing';
      const statusLabel = this.STATUS_LABELS[statusKey] || '未繳 ❌';

      return {
        '班級': activeClass,
        '座號': st.number,
        '姓名': st.name,
        '作業項目': activeHw.title,
        '繳交狀態': statusLabel,
        '學生備註': st.note || ''
      };
    });

    const timestamp = StorageManager.getFormattedTimestamp();
    StorageManager.exportExcel(rows, `${timestamp}_${activeClass}_${activeHw.title}_作業繳交紀錄.xlsx`);
  },

  toggleStatus(stId) {
    const activeHw = this.homeworks.find(h => h.id === this.activeHwId);
    if (!activeHw) return;

    const currentStatus = activeHw.records[stId] || 'missing';
    const nextStatus = this.STATUS_NEXT[currentStatus];
    activeHw.records[stId] = nextStatus;

    this.saveActiveHomeworks();
  },

  renderHomeworkSelect() {
    const select = document.getElementById('activeHomeworkSelect');
    if (!select) return;

    select.innerHTML = '<option value="">(請選擇或建立作業)</option>';
    this.homeworks.forEach(hw => {
      const option = document.createElement('option');
      option.value = hw.id;
      option.textContent = hw.title;
      if (hw.id === this.activeHwId) option.selected = true;
      select.appendChild(option);
    });
  },

  renderTable() {
    const tbody = document.getElementById('homeworkTableBody');
    if (!tbody) return;

    const activeHw = this.homeworks.find(h => h.id === this.activeHwId);
    if (!activeHw) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">請先選擇或建立作業項目。</td></tr>`;
      return;
    }

    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">請先建立學生名錄。</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(st => {
      const status = activeHw.records[st.id] || 'missing';
      return `
        <tr>
          <td>${st.number}</td>
          <td><strong>${st.name}</strong></td>
          <td>
            <span class="hw-status-badge ${status}" onclick="HomeworkModule.toggleStatus('${st.id}')">
              ${this.STATUS_LABELS[status]}
            </span>
          </td>
          <td><span class="text-muted">點擊標籤切換狀態</span></td>
        </tr>
      `;
    }).join('');
  }
};
