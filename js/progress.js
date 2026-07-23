/**
 * 課程進度與作業追蹤整合模組 (支援科目章節管理、章節作業綁定、一鍵指派多班級、離線 Excel 匯入/匯出與學生繳交狀態點擊切換)
 */
const ProgressModule = {
  progressMap: {}, // className -> array of { id, title, chapters: [{ id, name, done, homeworks: [{ id, title, records: {} }] }] }
  activeHwContext: null, // { subId, cId, hwId } 目前選取的作業項目上下文
  expandedSubjects: {}, // subId -> boolean (true 代表展開，false/undefined 代表收合)
  heatmapState: {}, // key: `${subId}_${cId}_${hwId}` -> boolean (true 代表熱點圖展開)

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
    this.collapseAll();
    this.progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, this.getDefaultSubjectsMap());
    if (!this.progressMap || typeof this.progressMap !== 'object' || Array.isArray(this.progressMap)) {
      this.progressMap = this.getDefaultSubjectsMap();
      StorageManager.set(StorageManager.KEYS.PROGRESS, this.progressMap);
    }
    this.bindEvents();
    this.render();

    window.addEventListener('rosterUpdated', () => this.render());
  },

  getDefaultSubjectsMap() {
    return {
      '501班': [
        {
          id: 'sub1',
          title: '📖 國語 (五年級上學期)',
          chapters: [
            {
              id: 'c1',
              name: '第一課 蘋果樹的秘密',
              done: true,
              homeworks: [
                { id: 'hw1_1', title: '第一課 習作', records: {} },
                { id: 'hw1_2', title: '第一課 學習單', records: {} }
              ]
            },
            {
              id: 'c2',
              name: '第二課 湖畔晨景',
              done: true,
              homeworks: [
                { id: 'hw2_1', title: '第二課 習作', records: {} }
              ]
            },
            { id: 'c3', name: '第三課 森林裡的管弦樂隊', done: false, homeworks: [] }
          ]
        },
        {
          id: 'sub2',
          title: '📐 數學 (五年級上學期)',
          chapters: [
            {
              id: 'm1',
              name: '單元一 多位數與因數分解',
              done: true,
              homeworks: [
                { id: 'mhw1', title: '單元一 練習本', records: {} }
              ]
            },
            { id: 'm2', name: '單元二 異分母分數加減法', done: false, homeworks: [] }
          ]
        }
      ]
    };
  },

  getActiveSubjects() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    this.progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, this.getDefaultSubjectsMap());
    if (!this.progressMap || typeof this.progressMap !== 'object' || Array.isArray(this.progressMap)) {
      this.progressMap = this.getDefaultSubjectsMap();
    }
    if (!this.progressMap[activeClass] || !Array.isArray(this.progressMap[activeClass]) || this.progressMap[activeClass].length === 0) {
      this.progressMap[activeClass] = [
        {
          id: 'sub_' + Date.now() + '_1',
          title: `📖 國語 (${activeClass})`,
          chapters: [
            {
              id: 'c1_' + Date.now(),
              name: '第一課 課文導讀與習作',
              done: false,
              homeworks: [
                { id: 'hw1_' + Date.now(), title: '第一課 習作', records: {} }
              ]
            },
            { id: 'c2_' + Date.now(), name: '第二課 課文朗讀與習作', done: false, homeworks: [] }
          ]
        },
        {
          id: 'sub_' + Date.now() + '_2',
          title: `📐 數學 (${activeClass})`,
          chapters: [
            {
              id: 'm1_' + Date.now(),
              name: '單元一 數的計算與應用',
              done: false,
              homeworks: [
                { id: 'mhw1_' + Date.now(), title: '單元一 練習本', records: {} }
              ]
            }
          ]
        }
      ];
      StorageManager.set(StorageManager.KEYS.PROGRESS, this.progressMap);
    }
    return this.progressMap[activeClass];
  },

  saveActiveSubjects(subjects) {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    this.progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, this.getDefaultSubjectsMap());
    if (!this.progressMap || typeof this.progressMap !== 'object' || Array.isArray(this.progressMap)) {
      this.progressMap = this.getDefaultSubjectsMap();
    }
    this.progressMap[activeClass] = subjects;
    StorageManager.set(StorageManager.KEYS.PROGRESS, this.progressMap);
    this.render();
  },

  addSubject() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const title = prompt(`請輸入【${activeClass}】的新增科目/單元名稱：`);
    if (!title || !title.trim()) return;

    const subjects = this.getActiveSubjects();
    subjects.push({
      id: Date.now().toString(),
      title: title.trim(),
      chapters: []
    });

    this.saveActiveSubjects(subjects);
  },

  downloadSample() {
    const sampleData = [
      { '科目': '生活科技', '章節': '第一章 電與控制', '作業名稱': '學習單 1-1', '指派班級': '401班, 402班' },
      { '科目': '生活科技', '章節': '第一章 電與控制', '作業名稱': '第一章 習作', '指派班級': '401班, 402班' },
      { '科目': '生活科技', '章節': '第二章 機電整合', '作業名稱': '實作報告', '指派班級': '401班, 402班' },
      { '科目': '國語', '章節': '第一課 蘋果樹的秘密', '作業名稱': '第一課 習作', '指派班級': '401班' },
      { '科目': '數學', '章節': '單元一 多位數與因數分解', '作業名稱': '單元一 練習本', '指派班級': '401班, 402班, 501班' }
    ];
    const timestamp = StorageManager.getFormattedTimestamp();
    StorageManager.exportExcel(sampleData, `${timestamp}_課程進度與作業匯入範例檔.xlsx`);
  },

  bindEvents() {
    // 匯入進度與作業 Excel 檔案變更事件
    document.getElementById('progressExcelInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
        const worksheetRows = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const arr = new Uint8Array(ev.target.result);
              const wb = XLSX.read(arr, { type: 'array' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
              resolve(json);
            } catch (err) { reject(err); }
          };
          reader.readAsArrayBuffer(file);
        });

        if (!worksheetRows || worksheetRows.length === 0) return alert('匯入的 Excel 檔案為空！');

        let importedSubjectCount = 0;
        let importedChapterCount = 0;
        let importedHwCount = 0;

        worksheetRows.forEach(row => {
          const subjectTitle = (row['科目'] || row['Subject'] || row['單元'] || '').toString().trim();
          const chapterName = (row['章節'] || row['Chapter'] || row['課次'] || '').toString().trim();
          const hwTitle = (row['作業名稱'] || row['作業項目'] || row['Homework'] || '').toString().trim();
          let targetClassesStr = (row['指派班級'] || row['班級'] || '').toString().trim();

          if (!subjectTitle) return;

          let targetClassList = [];
          if (targetClassesStr) {
            targetClassList = targetClassesStr.split(/[,，、;；\s]+/).map(c => c.trim()).filter(c => c.length > 0);
          }
          if (targetClassList.length === 0) {
            targetClassList = [activeClass];
          }

          targetClassList.forEach(cls => {
            let className = cls.endsWith('班') ? cls : cls + '班';
            if (!this.progressMap[className]) {
              this.progressMap[className] = [];
            }

            const subjects = this.progressMap[className];
            let sub = subjects.find(s => s.title === subjectTitle);
            if (!sub) {
              sub = {
                id: (Date.now() + Math.random() * 10000).toString(),
                title: subjectTitle,
                chapters: []
              };
              subjects.push(sub);
              importedSubjectCount++;
            }

            if (chapterName) {
              let ch = sub.chapters.find(c => c.name === chapterName);
              if (!ch) {
                ch = {
                  id: (Date.now() + Math.random() * 100000).toString(),
                  name: chapterName,
                  done: false,
                  homeworks: []
                };
                sub.chapters.push(ch);
                importedChapterCount++;
              }

              if (hwTitle) {
                if (!ch.homeworks) ch.homeworks = [];
                const existingHw = ch.homeworks.find(h => h.title === hwTitle);
                if (!existingHw) {
                  ch.homeworks.push({
                    id: (Date.now() + Math.random() * 1000000).toString(),
                    title: hwTitle,
                    records: {}
                  });
                  importedHwCount++;
                }
              }
            }
          });
        });

        StorageManager.set(StorageManager.KEYS.PROGRESS, this.progressMap);
        this.render();

        alert(`🎉 成功匯入課程進度與作業！共建立 ${importedSubjectCount} 個科目、${importedChapterCount} 個章節、${importedHwCount} 個作業項目！`);
      } catch (err) {
        alert(`匯入課程進度與作業失敗：${err.message || err}`);
        console.error(err);
      }
      e.target.value = '';
    });
  },

  // 一鍵指派/複製科目與作業至多個班級
  assignToClasses(subId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;

    const classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    const classNames = Object.keys(classes).sort((a, b) => a.localeCompare(b, 'zh-TW', { numeric: true }));
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');

    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});

    modalTitle.textContent = `📢 指派【${sub.title}】至多個班級`;

    modalBody.innerHTML = `
      <div style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 12px;">
        請勾選要指派與同步複製<b>「${sub.title}」</b>（共 ${sub.chapters.length} 個章節）的目標班級：
      </div>
      <div style="margin-bottom: 10px;">
        <button type="button" class="btn btn-sm btn-outline" id="selectAllClassesBtn">全選所有班級</button>
        <button type="button" class="btn btn-sm btn-outline" id="deselectAllClassesBtn">全不選</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 10px; max-height: 240px; overflow-y: auto; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
        ${classNames.map(cls => {
          const isAlreadyAssigned = progressMap[cls] && progressMap[cls].some(s => s.title === sub.title);
          const isCurrentClass = (cls === activeClass);
          const shouldBeChecked = isAlreadyAssigned || isCurrentClass;

          return `
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
              <input type="checkbox" class="assign-class-checkbox" value="${cls}" ${shouldBeChecked ? 'checked' : ''}>
              <span style="${isAlreadyAssigned ? 'color: var(--color-leaf-green); font-weight: bold;' : ''}">
                ${cls} ${isAlreadyAssigned ? '<span style="font-size:0.75rem; opacity:0.8; font-weight:normal;">(已指派)</span>' : ''}
              </span>
            </label>
          `;
        }).join('')}
      </div>
    `;

    backdrop.classList.remove('hidden');

    document.getElementById('selectAllClassesBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.assign-class-checkbox').forEach(cb => cb.checked = true);
    });

    document.getElementById('deselectAllClassesBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.assign-class-checkbox').forEach(cb => cb.checked = false);
    });

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const selectedClasses = Array.from(document.querySelectorAll('.assign-class-checkbox:checked')).map(cb => cb.value);

      if (selectedClasses.length === 0) {
        alert('請至少勾選一個目標班級！');
        return;
      }

      selectedClasses.forEach(clsName => {
        if (!this.progressMap[clsName]) {
          this.progressMap[clsName] = [];
        }

        const targetSubjects = this.progressMap[clsName];
        let targetSub = targetSubjects.find(s => s.title === sub.title);

        if (!targetSub) {
          targetSub = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            title: sub.title,
            chapters: sub.chapters.map(c => ({
              id: Date.now().toString() + Math.random().toString().slice(2, 6),
              name: c.name,
              done: false,
              homeworks: (c.homeworks || []).map(h => ({
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                title: h.title,
                records: {}
              }))
            }))
          };
          targetSubjects.push(targetSub);
        } else {
          sub.chapters.forEach(c => {
            let targetCh = targetSub.chapters.find(tc => tc.name === c.name);
            if (!targetCh) {
              targetCh = {
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                name: c.name,
                done: false,
                homeworks: []
              };
              targetSub.chapters.push(targetCh);
            }
            if (!targetCh.homeworks) targetCh.homeworks = [];
            (c.homeworks || []).forEach(h => {
              if (!targetCh.homeworks.some(th => th.title === h.title)) {
                targetCh.homeworks.push({
                  id: Date.now().toString() + Math.random().toString().slice(2, 6),
                  title: h.title,
                  records: {}
                });
              }
            });
          });
        }
      });

      StorageManager.set(StorageManager.KEYS.PROGRESS, this.progressMap);
      closeModal();
      this.render();

      alert(`🎉 已成功將【${sub.title}】科目與所有作業指派至 ${selectedClasses.length} 個班級（${selectedClasses.join(', ')}）！`);
    };
  },

  // 匯出某科目的進度與作業繳交總表 Excel
  exportSubjectExcel(subId) {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;

    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) return alert('目前班級中尚無學生資料！');

    const rows = [];

    students.forEach(st => {
      if (sub.chapters.length === 0) {
        rows.push({
          '班級': activeClass,
          '座號': st.number,
          '姓名': st.name,
          '科目': sub.title,
          '章節': '（暫無章節）',
          '作業項目': '（暫無作業）',
          '繳交狀態': '-',
          '學生備註': st.note || ''
        });
      } else {
        sub.chapters.forEach(ch => {
          const hwList = ch.homeworks || [];
          if (hwList.length === 0) {
            rows.push({
              '班級': activeClass,
              '座號': st.number,
              '姓名': st.name,
              '科目': sub.title,
              '章節': ch.name + (ch.done ? ' (已完成)' : ' (進行中)'),
              '作業項目': '（無單獨作業）',
              '繳交狀態': ch.done ? '完成 🟢' : '進行中 🟡',
              '學生備註': st.note || ''
            });
          } else {
            hwList.forEach(hw => {
              const statusKey = hw.records[st.id] || 'missing';
              const statusLabel = this.STATUS_LABELS[statusKey] || '未繳 ❌';
              rows.push({
                '班級': activeClass,
                '座號': st.number,
                '姓名': st.name,
                '科目': sub.title,
                '章節': ch.name,
                '作業項目': hw.title,
                '繳交狀態': statusLabel,
                '學生備註': st.note || ''
              });
            });
          }
        });
      }
    });

    const timestamp = StorageManager.getFormattedTimestamp();
    StorageManager.exportExcel(rows, `${timestamp}_${activeClass}_${sub.title}_課程與作業追蹤.xlsx`);
  },

  deleteSubject(subId) {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;

    if (confirm(`確定要刪除【${activeClass}】的「${sub.title}」科目及其所有章節與作業嗎？`)) {
      if (this.activeHwContext && this.activeHwContext.subId === subId) {
        this.activeHwContext = null;
      }
      const newSubjects = subjects.filter(s => s.id !== subId);
      this.saveActiveSubjects(newSubjects);
    }
  },

  renameSubject(subId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const newTitle = prompt('修改科目名稱：', sub.title);
    if (newTitle && newTitle.trim()) {
      sub.title = newTitle.trim();
      this.saveActiveSubjects(subjects);
    }
  },

  addChapter(subId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const name = prompt(`請輸入【${sub.title}】的新增章節名稱：`);
    if (!name || !name.trim()) return;

    sub.chapters.push({
      id: Date.now().toString(),
      name: name.trim(),
      done: false,
      homeworks: []
    });

    this.saveActiveSubjects(subjects);
  },

  deleteChapter(subId, cId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;

    if (this.activeHwContext && this.activeHwContext.cId === cId) {
      this.activeHwContext = null;
    }
    sub.chapters = sub.chapters.filter(c => c.id !== cId);
    this.saveActiveSubjects(subjects);
  },

  toggleChapter(subId, cId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (ch) {
      ch.done = !ch.done;
      this.saveActiveSubjects(subjects);
    }
  },

  // 為特定章節新增作業
  addHomeworkToChapter(subId, cId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch) return;

    const title = prompt(`請輸入【${ch.name}】的新增作業名稱（例如：第一章習作）：`);
    if (!title || !title.trim()) return;

    if (!ch.homeworks) ch.homeworks = [];
    const newHw = {
      id: Date.now().toString(),
      title: title.trim(),
      records: {}
    };
    ch.homeworks.push(newHw);

    this.activeHwContext = { subId, cId, hwId: newHw.id };
    this.saveActiveSubjects(subjects);
  },

  // 刪除章節下的特定作業
  deleteHomeworkFromChapter(subId, cId, hwId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;

    if (confirm('確定要刪除這項作業及其所有繳交紀錄嗎？')) {
      if (this.activeHwContext && this.activeHwContext.hwId === hwId) {
        this.activeHwContext = null;
      }
      ch.homeworks = ch.homeworks.filter(h => h.id !== hwId);
      this.saveActiveSubjects(subjects);
    }
  },

  // 點擊作業項目開啟【學生作業繳交檢核彈窗】 (螢幕中央彈出)
  openHomeworkModal(subId, cId, hwId, savedScrollTop = 0) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;
    const hw = ch.homeworks.find(h => h.id === hwId);
    if (!hw) return;

    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const students = StorageManager.getActiveClassStudents();

    const submittedCount = students.filter(st => {
      const s = hw.records[st.id] || 'missing';
      return s === 'submitted';
    }).length;

    const totalStudents = students.length;
    const percent = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

    modalTitle.textContent = `📌 【${sub.title} - ${hw.title}】作業繳交檢核表 (${activeClass})`;

    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
          <div>
            <div style="font-weight: bold; color: var(--color-terracotta); font-size: 1.05rem;">
              章節：${ch.name}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
              全班繳交進度：<strong style="color: var(--color-leaf-green);">${submittedCount} / ${totalStudents} 人已繳</strong> (${percent}%)
            </div>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-accent" onclick="ProgressModule.copyMissingList('${subId}', '${cId}', '${hwId}')">
              📋 複製未繳名單
            </button>
            <button class="btn btn-sm btn-chip" onclick="ProgressModule.markAllHwStatus('${subId}', '${cId}', '${hwId}', 'submitted')">
              ✅ 全班標示已繳
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="ProgressModule.markAllHwStatus('${subId}', '${cId}', '${hwId}', 'missing')">
              ❌ 全班重置未繳
            </button>
          </div>
        </div>

        <div id="homeworkModalScrollContainer" style="max-height: 55vh; overflow-y: auto; padding-right: 4px;">
          <table class="table table-hover" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead>
              <tr style="background: var(--bg-secondary); position: sticky; top: 0; z-index: 1;">
                <th style="width: 10%; padding: 8px;">座號</th>
                <th style="width: 20%; padding: 8px;">學生姓名</th>
                <th style="width: 35%; padding: 8px;">繳交狀態 (點擊切換)</th>
                <th style="width: 35%; padding: 8px;">學生資訊</th>
              </tr>
            </thead>
            <tbody>
              ${students.length === 0 ? `
                <tr><td colspan="4" class="text-center text-muted" style="padding:15px;">目前班級尚無學生資料！</td></tr>
              ` : students.map(st => {
                const statusKey = hw.records[st.id] || 'missing';
                const statusLabel = this.STATUS_LABELS[statusKey] || '未繳 ❌';
                let btnClass = 'btn-outline-danger';
                if (statusKey === 'submitted') btnClass = 'btn-success';
                if (statusKey === 'correcting') btnClass = 'btn-warning';
                if (statusKey === 'late') btnClass = 'btn-info';

                const details = [];
                if (st.note) details.push(`學號:${st.note}`);
                if (st.cadre) details.push(`幹部:${st.cadre}`);
                if (st.remarks) details.push(`備註:${st.remarks}`);
                const detailStr = details.length > 0 ? details.join(' | ') : '-';

                return `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 8px; vertical-align: middle; font-weight: bold;">#${st.number}</td>
                    <td style="padding: 8px; vertical-align: middle; font-weight: 500;">${st.name}</td>
                    <td style="padding: 8px; vertical-align: middle;">
                      <button class="btn btn-sm ${btnClass}" style="width: 100%; max-width: 150px; font-weight: bold;" onclick="ProgressModule.toggleStudentModalHwStatus('${subId}', '${cId}', '${hwId}', '${st.id}')">
                        ${statusLabel}
                      </button>
                    </td>
                    <td style="padding: 8px; vertical-align: middle; font-size: 0.85rem; color: var(--text-muted); text-align: left;">${detailStr}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '關閉';
    confirmBtn.className = 'btn btn-primary';

    // 還原滾動位置
    if (savedScrollTop > 0) {
      const container = document.getElementById('homeworkModalScrollContainer');
      if (container) {
        container.scrollTop = savedScrollTop;
      }
    }

    const closeModal = () => {
      backdrop.classList.add('hidden');
      this.render(); // 關閉時刷卡片人數
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = closeModal;
  },

  // 彈窗內點擊切換學生繳交狀態
  toggleStudentModalHwStatus(subId, cId, hwId, studentId) {
    const scrollContainer = document.getElementById('homeworkModalScrollContainer');
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    this.toggleStudentHwStatus(subId, cId, hwId, studentId);
    this.openHomeworkModal(subId, cId, hwId, savedScrollTop);
  },

  // 批量標示全班狀態 (全班已繳 / 全班未繳)
  markAllHwStatus(subId, cId, hwId, targetStatus) {
    const scrollContainer = document.getElementById('homeworkModalScrollContainer');
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;
    const hw = ch.homeworks.find(h => h.id === hwId);
    if (!hw) return;

    const students = StorageManager.getActiveClassStudents();
    students.forEach(st => {
      hw.records[st.id] = targetStatus;
    });

    this.saveActiveSubjects(subjects);
    this.openHomeworkModal(subId, cId, hwId, savedScrollTop);
  },

  // 點擊切換學生繳交狀態
  toggleStudentHwStatus(subId, cId, hwId, studentId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;
    const hw = ch.homeworks.find(h => h.id === hwId);
    if (!hw) return;

    const currentStatus = hw.records[studentId] || 'missing';
    const nextStatus = this.STATUS_NEXT[currentStatus];
    hw.records[studentId] = nextStatus;

    this.saveActiveSubjects(subjects);
  },

  // 複製未繳名單至剪貼簿
  copyMissingList(subId, cId, hwId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;
    const hw = ch.homeworks.find(h => h.id === hwId);
    if (!hw) return;

    const students = StorageManager.getActiveClassStudents();
    const missingList = students.filter(st => {
      const status = hw.records[st.id] || 'missing';
      return status === 'missing' || status === 'correcting';
    });

    if (missingList.length === 0) {
      alert(`🎉 太棒了！【${sub.title} - ${hw.title}】全班皆已繳交完成！`);
      return;
    }

    const text = `📌【${sub.title} - ${ch.name} - ${hw.title}】未繳/待訂正名單：\n` +
      missingList.map(st => `座號 ${st.number} ${st.name}`).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      alert(`已成功複製未繳學生名單至剪貼簿！\n\n${text}`);
    }).catch(() => {
      alert(`未繳名單如下：\n\n${text}`);
    });
  },

  // 取得科目折疊收合狀態 (預設為收合，改為記憶體狀態)
  collapseAll() {
    this.expandedSubjects = {};
    this.heatmapState = {};
  },

  // 切換科目的折疊狀態
  toggleCollapse(subId) {
    if (!this.expandedSubjects) {
      this.expandedSubjects = {};
    }
    this.expandedSubjects[subId] = !this.expandedSubjects[subId];
    this.render();
  },

  // 切換座號熱點圖折疊狀態（預設為收合）
  toggleHeatmap(subId, cId, hwId) {
    if (!this.heatmapState) {
      this.heatmapState = {};
    }
    const key = `${subId}_${cId}_${hwId}`;
    this.heatmapState[key] = !this.heatmapState[key];
    this.render();
  },

  // 渲染座號熱點圖 HTML
  renderHeatmapHTML(sub, ch, hw, students) {
    const heatmapHtml = students.map(st => {
      const statusKey = hw.records[st.id] || 'missing';
      let color = '#d9534f'; // red (missing)
      if (statusKey === 'submitted') color = '#2ec4b6'; // green
      if (statusKey === 'correcting') color = '#ff9f1c'; // yellow/orange
      if (statusKey === 'late') color = '#3a86c8'; // blue

      return `
        <div 
          style="width:24px; height:24px; line-height:22px; text-align:center; border-radius:4px; background:${color}; color:#fff; font-size:0.72rem; font-weight:bold; cursor:pointer; user-select:none;"
          title="${st.name} (${this.STATUS_LABELS[statusKey]})"
          onclick="ProgressModule.toggleStudentHeatmapStatus('${sub.id}', '${ch.id}', '${hw.id}', '${st.id}')"
        >
          ${st.number}
        </div>
      `;
    }).join('');

    return `
      <div style="margin-top: 4px; padding: 8px 10px; background: rgba(0,0,0,0.02); border: 1px dashed var(--border-color); border-radius: 6px; max-width: 500px;">
        <div style="font-size:0.78rem; font-weight:bold; color:var(--text-muted); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
          <span>📊 座號繳交熱點圖 (點選座號快速切換)：</span>
          <span style="font-size:0.7rem; font-weight:normal;">🔴未繳 🟢已繳 🟡待改 🔵補繳</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${heatmapHtml}
        </div>
      </div>
    `;
  },

  // 熱點圖點選座號快速切換
  toggleStudentHeatmapStatus(subId, cId, hwId, studentId) {
    this.toggleStudentHwStatus(subId, cId, hwId, studentId);
    this.render();
  },

  // 章節無損重新命名
  renameChapter(subId, cId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch) return;

    const newName = prompt('修改章節名稱：', ch.name);
    if (newName && newName.trim()) {
      ch.name = newName.trim();
      this.saveActiveSubjects(subjects);
      this.render();
    }
  },

  // 作業無損重新命名
  renameHomework(subId, cId, hwId) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    const ch = sub.chapters.find(c => c.id === cId);
    if (!ch || !ch.homeworks) return;
    const hw = ch.homeworks.find(h => h.id === hwId);
    if (!hw) return;

    const newTitle = prompt('修改作業名稱：', hw.title);
    if (newTitle && newTitle.trim()) {
      hw.title = newTitle.trim();
      this.saveActiveSubjects(subjects);
      this.render();
    }
  },

  // 跨學科一鍵催繳單 (支援切換選擇班級)
  showConsolidatedMissingModal(targetClass = null) {
    const defaultClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const selectedClass = targetClass || defaultClass;

    const classesMap = StorageManager.get(StorageManager.KEYS.CLASSES, {});
    let classList = Object.keys(classesMap);
    if (classList.length === 0) classList = [selectedClass];

    const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
    const subjects = progressMap[selectedClass] || [];
    const students = classesMap[selectedClass] || [];

    const missingMap = {}; // studentId -> array of { subjectTitle, chapterName, hwTitle, status }
    let totalMissing = 0;

    subjects.forEach(sub => {
      (sub.chapters || []).forEach(ch => {
        (ch.homeworks || []).forEach(hw => {
          students.forEach(st => {
            const status = hw.records[st.id] || 'missing';
            if (status === 'missing' || status === 'correcting') {
              if (!missingMap[st.id]) {
                missingMap[st.id] = [];
              }
              missingMap[st.id].push({
                subjectTitle: sub.title.replace(/📐|📖|🧪|🎨/g, '').trim(),
                chapterName: ch.name,
                hwTitle: hw.title,
                status: this.STATUS_LABELS[status]
              });
              totalMissing++;
            }
          });
        });
      });
    });

    const reportLines = [];
    reportLines.push(`📢 【${selectedClass}】今日作業未繳交/待訂正彙整名冊：`);
    reportLines.push(`----------------------------------`);

    let studentCount = 0;
    students.forEach(st => {
      const items = missingMap[st.id];
      if (items && items.length > 0) {
        studentCount++;
        reportLines.push(`- #${st.number} ${st.name}：`);
        items.forEach(item => {
          reportLines.push(`  👉 ${item.subjectTitle}：${item.chapterName} - ${item.hwTitle} (${item.status})`);
        });
      }
    });

    reportLines.push(`----------------------------------`);
    if (studentCount === 0) {
      reportLines.push(`🎉 太棒了！目前全班所有學科作業皆已繳交完畢！`);
    } else {
      reportLines.push(`以上共計 ${studentCount} 位同學尚未收齊。請家長協助督促指導，感謝！`);
    }

    const reportText = reportLines.join('\n');

    // Show in modal
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `📋 【${selectedClass}】跨學科催繳聯絡簿文字`;
    modalBody.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <div style="font-size: 0.95rem; color: var(--text-main);">
          已為您自動彙整全學科欠交明細，您可以就地編輯修改後複製：
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <label style="font-size: 0.85rem; font-weight: bold; color: var(--color-espresso);">🏫 選擇催繳班級：</label>
          <select id="consolidatedClassSelect" class="form-select inline-select" style="font-size: 0.85rem; padding: 2px 8px;" onchange="ProgressModule.showConsolidatedMissingModal(this.value)">
            ${classList.map(c => `<option value="${c}" ${c === selectedClass ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <textarea id="missingHwReportTextarea" style="width: 100%; height: 260px; font-family: monospace; font-size: 0.9rem; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-main); resize: vertical; box-sizing: border-box;">${reportText}</textarea>
      <div style="margin-top: 10px; text-align: right;">
        <button class="btn btn-accent" id="copyReportTextareaBtn"><i class="fa-solid fa-copy"></i> 複製此名單</button>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '關閉';
    confirmBtn.className = 'btn btn-primary';

    const copyBtn = document.getElementById('copyReportTextareaBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const textarea = document.getElementById('missingHwReportTextarea');
        navigator.clipboard.writeText(textarea.value).then(() => {
          alert(`已成功複製【${selectedClass}】催繳名單至剪貼簿！`);
        }).catch(() => {
          alert('複製失敗，請手動選取文字複製。');
        });
      };
    }

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = closeModal;
  },

  // 快速套用範本選擇彈窗
  showTemplateSelectionModal(subId) {
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `📋 快速套用課程作業範本`;
    modalBody.innerHTML = `
      <div style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 12px;">
        套用範本將自動生成整學期的章節與作業結構。請選擇適合的學科結構：
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: var(--bg-card);">
          <input type="radio" name="tplRadio" value="language" checked>
          <div>
            <strong style="color: var(--color-espresso);">📖 語文科經典範本 (14課)</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">自動生成第一課至第十四課，每課含【課本練習】、【習作登記】作業</div>
          </div>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: var(--bg-card);">
          <input type="radio" name="tplRadio" value="math">
          <div>
            <strong style="color: var(--color-espresso);">📐 數學科單元範本 (10單元)</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">自動生成單元一至單元十，每單元含【課堂練習】、【習作登記】、【單元測驗】作業</div>
          </div>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: var(--bg-card);">
          <input type="radio" name="tplRadio" value="technology">
          <div>
            <strong style="color: var(--color-espresso);">🧪 科技/藝能科實作範本 (6單元)</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">自動生成單元一至單元六，每單元含【學習單】、【實作報告】作業</div>
          </div>
        </label>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '確定套用';
    confirmBtn.className = 'btn btn-accent';

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = () => {
      const selected = document.querySelector('input[name="tplRadio"]:checked').value;
      closeModal();
      this.applyTemplate(subId, selected);
    };
  },

  // 寫入範本結構生成邏輯
  applyTemplate(subId, templateType) {
    const subjects = this.getActiveSubjects();
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;

    if (sub.chapters.length > 0) {
      if (!confirm('⚠️ 警告：套用範本將會清空此科目目前的全部章節與作業紀錄！確定要繼續嗎？')) {
        return;
      }
    }

    sub.chapters = [];
    let chapterCount = 0;
    let chapterPrefix = '課';
    let hwTitles = [];

    if (templateType === 'language') {
      chapterCount = 14;
      chapterPrefix = '課';
      hwTitles = ['課本練習', '習作登記'];
    } else if (templateType === 'math') {
      chapterCount = 10;
      chapterPrefix = '單元';
      hwTitles = ['課堂練習', '習作登記', '單元測驗'];
    } else if (templateType === 'technology') {
      chapterCount = 6;
      chapterPrefix = '單元';
      hwTitles = ['學習單', '實作報告'];
    }

    const now = Date.now();
    for (let i = 1; i <= chapterCount; i++) {
      const cId = `tpl_c_${now}_${i}`;
      const name = `${chapterPrefix}${this.toChineseNumber(i)}`;
      const homeworks = hwTitles.map((title, hIdx) => ({
        id: `tpl_h_${now}_${i}_${hIdx}`,
        title: title,
        records: {}
      }));

      sub.chapters.push({
        id: cId,
        name: name,
        done: false,
        homeworks: homeworks
      });
    }

    this.saveActiveSubjects(subjects);
    this.render();
    alert(`🎉 已成功套用範本！已自動建立 ${chapterCount} 個章節，每章含 ${hwTitles.length} 項作業。`);
  },

  // 輔助將數字轉換為中文
  toChineseNumber(n) {
    const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
    return chineseNums[n] || n.toString();
  },

  // 欠交排行榜與預警儀表板
  showDashboardModal() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const subjects = this.getActiveSubjects();
    const students = StorageManager.getActiveClassStudents();

    if (students.length === 0) {
      return alert('目前班級中尚無學生資料！');
    }

    // 1. Calculate missing homework counts per student
    const studentMissingCounts = {}; // studentId -> count
    students.forEach(st => {
      studentMissingCounts[st.id] = 0;
    });

    subjects.forEach(sub => {
      sub.chapters.forEach(ch => {
        (ch.homeworks || []).forEach(hw => {
          students.forEach(st => {
            const status = hw.records[st.id] || 'missing';
            if (status === 'missing' || status === 'correcting') {
              studentMissingCounts[st.id] = (studentMissingCounts[st.id] || 0) + 1;
            }
          });
        });
      });
    });

    // Sort students by missing counts descending
    const sortedStudents = students.map(st => ({
      ...st,
      missingCount: studentMissingCounts[st.id] || 0
    })).sort((a, b) => b.missingCount - a.missingCount);

    const topMissingHtml = sortedStudents.slice(0, 5).map(st => {
      let badgeColor = 'var(--text-muted)';
      if (st.missingCount >= 5) badgeColor = 'var(--color-terracotta)';
      else if (st.missingCount >= 3) badgeColor = 'var(--color-amber)';
      else if (st.missingCount > 0) badgeColor = 'var(--color-leaf-green)';

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:0.92rem;">
          <span><strong>#${st.number} ${st.name}</strong></span>
          <span style="font-weight:bold; color:${badgeColor};">${st.missingCount} 件缺交/待改</span>
        </div>
      `;
    }).join('');

    // 2. Calculate subject completion rates
    const subjectProgressHtml = subjects.map(sub => {
      const total = sub.chapters.length;
      const doneCount = sub.chapters.filter(c => c.done).length;
      const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      return `
        <div style="margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; margin-bottom:4px; color:var(--text-main);">
            <span>${sub.title}</span>
            <span>${percent}% (${doneCount}/${total} 章節)</span>
          </div>
          <div style="height:8px; background:var(--bg-secondary); border-radius:4px; overflow:hidden;">
            <div style="width:${percent}%; height:100%; background:var(--color-leaf-green); border-radius:4px;"></div>
          </div>
        </div>
      `;
    }).join('');

    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `⚠️ 【${activeClass}】作業繳交與課程進度儀表板`;
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 600px;">
        <!-- Left: Missing Top Students -->
        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
          <h4 style="margin: 0 0 10px 0; color: var(--color-espresso); font-size: 0.95rem; border-bottom: 2px solid var(--color-terracotta); padding-bottom: 4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> 欠交作業大戶排行 (前五名)
          </h4>
          <div>
            ${topMissingHtml || '<div class="text-center text-muted" style="padding:20px;">無任何欠交紀錄，全班優秀！</div>'}
          </div>
        </div>

        <!-- Right: Subject Progress Summary -->
        <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
          <h4 style="margin: 0 0 10px 0; color: var(--color-espresso); font-size: 0.95rem; border-bottom: 2px solid var(--color-leaf-green); padding-bottom: 4px;">
            <i class="fa-solid fa-chart-line"></i> 各學科章節授課進度率
          </h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${subjectProgressHtml || '<div class="text-center text-muted" style="padding:20px;">尚未建立科目。</div>'}
          </div>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    confirmBtn.textContent = '關閉';
    confirmBtn.className = 'btn btn-primary';

    const closeModal = () => {
      backdrop.classList.add('hidden');
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = closeModal;
  },

  // 處理標題列整區點擊（防護按鈕點擊）
  handleHeaderClick(event, subId) {
    const target = event.target;
    // 如果點擊到按鈕、按鈕內部圖示、或互動輸入元素，則不觸發折疊
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    this.toggleCollapse(subId);
  },

  render() {
    const grid = document.getElementById('progressGridArea');
    if (!grid) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const subjects = this.getActiveSubjects();

    if (subjects.length === 0) {
      grid.innerHTML = `
        <div class="text-center text-muted padding-20" style="grid-column: 1 / -1;">
          💡 【${activeClass}】尚未新增任何課程進度與作業。請點擊右上角「新增科目/單元」或「📥 匯入進度與作業 Excel」。
        </div>
      `;
      return;
    }

    let html = subjects.map(sub => {
      const total = sub.chapters.length;
      const doneCount = sub.chapters.filter(c => c.done).length;
      const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      const isExpanded = !!this.expandedSubjects[sub.id];
      const isCollapsed = !isExpanded;

      return `
        <div class="progress-card margin-bottom">
          <div class="card-header" style="cursor: pointer;" onclick="ProgressModule.handleHeaderClick(event, '${sub.id}')">
            <h3 class="subject-title">
              <span>${sub.title}</span>
              <button type="button" class="btn btn-sm btn-chip" style="font-size: 0.75rem; padding: 2px 6px; display: inline-flex; align-items: center; gap: 4px; border-color: var(--border-color); color: var(--text-muted); background: var(--bg-card); cursor: pointer;" onclick="ProgressModule.renameSubject('${sub.id}')" title="修改科目名稱">
                <i class="fa-solid fa-pen-to-square"></i> 編輯
              </button>
            </h3>
            <div class="card-header-actions">
              <button class="btn btn-sm btn-secondary" title="匯出此科目的課程進度與作業繳交總表 Excel" onclick="ProgressModule.exportSubjectExcel('${sub.id}')">
                <i class="fa-solid fa-file-excel"></i> 匯出此科 Excel
              </button>
              <button class="btn btn-sm btn-accent" title="指派與複製此科目與作業至多個班級" onclick="ProgressModule.assignToClasses('${sub.id}')">
                <i class="fa-solid fa-share-nodes"></i> 🚀 指派班級
              </button>
              <button class="btn btn-sm btn-outline" title="快速套用章節與作業範本" onclick="ProgressModule.showTemplateSelectionModal('${sub.id}')" ${isCollapsed ? 'style="display:none;"' : ''}>
                <i class="fa-solid fa-paste"></i> 套用範本
              </button>
              <button class="btn btn-sm btn-outline" title="新增章節" onclick="ProgressModule.addChapter('${sub.id}')" ${isCollapsed ? 'style="display:none;"' : ''}>
                <i class="fa-solid fa-plus"></i> 新增章節
              </button>
              <button class="btn btn-sm btn-outline" title="展開/收合此科目" onclick="ProgressModule.toggleCollapse('${sub.id}')">
                <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i> ${isCollapsed ? '展開' : '收合'}
              </button>
              <button class="btn btn-sm btn-outline-danger" title="刪除此科目" onclick="ProgressModule.deleteSubject('${sub.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <div class="progress-card-body" style="${isCollapsed ? 'display: none;' : ''}">
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 6px;">
              整體完成進度：<strong>${percent}%</strong> (${doneCount}/${total} 章節已完成)
            </div>
            <div class="progress-bar-container" style="height:10px; background:var(--bg-secondary); border-radius:5px; overflow:hidden; margin-bottom:16px;">
              <div class="progress-bar-fill" style="width: ${percent}%; height:100%; background:var(--color-leaf-green); transition: width 0.3s ease;"></div>
            </div>

            <div class="chapter-list" style="display:flex; flex-direction:column; gap:10px;">
              ${sub.chapters.length === 0 ? `
                <div class="text-muted text-center" style="padding:12px; font-size:0.85rem;">
                  （暫無章節，點擊右上角的「新增章節」按鈕）
                </div>
              ` : sub.chapters.map(ch => {
                const hwList = ch.homeworks || [];
                const students = StorageManager.getActiveClassStudents();
                const totalStudents = students.length || 1;

                return `
                  <div class="chapter-box" style="padding:12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-primary);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <label style="display:flex; align-items:center; gap:8px; font-weight:bold; cursor:pointer; font-size:1rem;">
                        <input type="checkbox" ${ch.done ? 'checked' : ''} onchange="ProgressModule.toggleChapter('${sub.id}', '${ch.id}')">
                        <span class="${ch.done ? 'text-muted' : ''}" style="${ch.done ? 'text-decoration:line-through;' : ''}">${ch.name}</span>
                      </label>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" style="font-size:0.8rem; padding:2px 8px;" title="修改章節名稱" onclick="ProgressModule.renameChapter('${sub.id}', '${ch.id}')">
                          <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="font-size:0.8rem; padding:2px 8px;" title="為此章節新增作業" onclick="ProgressModule.addHomeworkToChapter('${sub.id}', '${ch.id}')">
                          <i class="fa-solid fa-plus"></i> 新增作業
                        </button>
                        <button class="btn btn-sm btn-outline-danger" style="padding:2px 6px; font-size:0.75rem;" title="刪除此章節" onclick="ProgressModule.deleteChapter('${sub.id}', '${ch.id}')">
                          &times;
                        </button>
                      </div>
                    </div>

                     <!-- 本章節下的作業項目 Pills -->
                     <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
                       ${hwList.length === 0 ? `
                         <span class="text-muted" style="font-size:0.8rem; font-style:italic;">(無作業，點擊右側「+ 新增作業」)</span>
                       ` : hwList.map(hw => {
                         const submittedCount = students.filter(st => {
                           const s = hw.records[st.id] || 'missing';
                           return s === 'submitted';
                         }).length;

                         const key = `${sub.id}_${ch.id}_${hw.id}`;
                         const isHeatmapVisible = this.heatmapState && !!this.heatmapState[key];

                         return `
                           <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:4px;">
                             <div style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:16px; border:1.5px solid var(--color-leaf-green); background:var(--bg-card); font-size:0.85rem; width:fit-content;">
                               <span style="cursor:pointer; font-weight:bold; color:var(--text-main);" onclick="ProgressModule.openHomeworkModal('${sub.id}', '${ch.id}', '${hw.id}')" title="點擊於彈窗中點選學生繳交狀態">
                                 📝 ${hw.title} <span style="font-size:0.75rem; color:var(--color-terracotta); font-weight:bold;">(${submittedCount}/${totalStudents}人已繳)</span>
                               </span>
                               <button type="button" style="border:none; background:transparent; color:var(--text-muted); cursor:pointer; font-size:0.8rem; padding:0 2px;" title="修改作業名稱" onclick="ProgressModule.renameHomework('${sub.id}', '${ch.id}', '${hw.id}')">
                                 <i class="fa-solid fa-pen" style="font-size:0.7rem;"></i>
                               </button>
                               <button type="button" style="border:none; background:transparent; color:var(--color-leaf-green); cursor:pointer; font-size:0.8rem; padding:0 2px;" title="展開/收合座號登記熱點圖" onclick="ProgressModule.toggleHeatmap('${sub.id}', '${ch.id}', '${hw.id}')">
                                 <i class="fa-solid ${isHeatmapVisible ? 'fa-table-cells' : 'fa-border-all'}" style="font-size:0.7rem;"></i>
                               </button>
                               <button type="button" style="border:none; background:transparent; color:#d9534f; cursor:pointer; font-weight:bold; font-size:0.85rem; padding:0 2px; margin-left: 10px; border-left: 1px solid var(--border-color); padding-left: 8px;" title="刪除此作業" onclick="ProgressModule.deleteHomeworkFromChapter('${sub.id}', '${ch.id}', '${hw.id}')">
                                 &times;
                               </button>
                             </div>
                             ${isHeatmapVisible ? this.renderHeatmapHTML(sub, ch, hw, students) : ''}
                           </div>
                         `;
                       }).join('')}
                     </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html;
  }
};
