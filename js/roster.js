const RosterModule = {
  init() {
    this.renderClassSelect();
    this.renderRosterTable();
    this.bindEvents();

    window.addEventListener('rosterUpdated', () => {
      this.refreshAll();
    });
  },

  bindEvents() {
    // 班級管理頁面下拉選單切換
    document.getElementById('rosterClassSelect')?.addEventListener('change', (e) => {
      const selectedClass = e.target.value;
      if (typeof changeActiveClassWithGuard === 'function') {
        changeActiveClassWithGuard(selectedClass, e.target);
      } else {
        StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, selectedClass);
        this.refreshAll();
      }
    });

    // 新增班級
    document.getElementById('createNewClassBtn')?.addEventListener('click', () => {
      const input = document.getElementById('rosterClassNameInput');
      const className = input.value.trim();
      if (!className) return alert('請輸入班級名稱！');
      
      const classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
      if (!classes[className]) {
        classes[className] = [];
        StorageManager.set(StorageManager.KEYS.CLASSES, classes);
      }
      StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, className);
      input.value = '';
      this.refreshAll();
    });

    // 刪除當前班級
    document.getElementById('deleteCurrentClassBtn')?.addEventListener('click', () => {
      const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
      if (confirm(`確定要刪除「${activeClass}」班級及其所有學生名單、成績紀錄、作業與分組嗎？`)) {
        // 1. 取得當前班級學生 ID
        const students = StorageManager.getActiveClassStudents();
        const studentIds = new Set(students.map(s => s.id));

        // 2. 刪除班級名單
        const classes = StorageManager.get(StorageManager.KEYS.CLASSES, {});
        delete classes[activeClass];
        StorageManager.set(StorageManager.KEYS.CLASSES, classes);

        // 3. 清理個人加分紀錄
        const points = StorageManager.get(StorageManager.KEYS.POINTS, {});
        studentIds.forEach(id => delete points[id]);
        StorageManager.set(StorageManager.KEYS.POINTS, points);

        // 4. 清理分組與競賽榜
        StorageManager.set(StorageManager.KEYS.GROUPS, []);

        // 5. 清理作業追蹤紀錄
        const homeworks = StorageManager.get(StorageManager.KEYS.HOMEWORK, []);
        homeworks.forEach(hw => {
          if (hw.records) {
            studentIds.forEach(id => delete hw.records[id]);
          }
        });
        StorageManager.set(StorageManager.KEYS.HOMEWORK, homeworks);

        // 5.5 清理該班級之課程進度對照
        const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
        if (progressMap && typeof progressMap === 'object') {
          delete progressMap[activeClass];
          StorageManager.set(StorageManager.KEYS.PROGRESS, progressMap);
        }

        // 6. 清理座位表
        StorageManager.set(StorageManager.KEYS.SEATING, []);

        // 7. 切換至剩餘班級或重置為預設值
        const remainingKeys = Object.keys(classes);
        if (remainingKeys.length > 0) {
          StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, remainingKeys[0]);
        } else {
          StorageManager.set(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
          StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, '501班');
        }

        alert(`已成功刪除「${activeClass}」及其所有成績、作業與連動資料！`);
        window.location.reload();
      }
    });

    // 手動新增學生
    document.getElementById('addStudentManualBtn')?.addEventListener('click', () => {
      const name = prompt('請輸入學生姓名：');
      if (!name) return;
      const number = prompt('請輸入學生座號：') || '1';
      const note = prompt('請輸入性別/備註：') || '';

      const students = StorageManager.getActiveClassStudents();
      students.push({
        id: Date.now().toString(),
        number: parseInt(number, 10),
        name: name.trim(),
        note: note.trim()
      });
      this.saveActiveStudents(students);
    });

    // Excel 匯入 (同時支援公假系統多班級、多頁籤 Sheet 與單班名條)
    document.getElementById('rosterExcelInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const parseFn = StorageManager.parseMultiClassExcelFile || StorageManager.parseExcelFile;
        if (typeof parseFn !== 'function') {
          return alert('解析組件未更新，請按 Ctrl+F5 強制重新整理網頁！');
        }

        const classResultMap = await parseFn.call(StorageManager, file);
        const classNames = Object.keys(classResultMap);

        if (classNames.length === 0) {
          return alert('匯入失敗：未在 Excel 檔案中解析出有效的學生名冊！');
        }

        const classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
        let totalCount = 0;
        const summary = [];

        classNames.forEach(cls => {
          classes[cls] = classResultMap[cls];
          const count = classResultMap[cls].length;
          totalCount += count;
          summary.push(`• ${cls}: ${count} 位學生`);
        });

        StorageManager.set(StorageManager.KEYS.CLASSES, classes);
        // 自動切換至第一個匯入的班級
        StorageManager.set(StorageManager.KEYS.ACTIVE_CLASS, classNames[0]);
        this.refreshAll();

        alert(`🎉 成功同時匯入 ${classNames.length} 個班級（共 ${totalCount} 位學生名冊）！\n\n${summary.join('\n')}`);
      } catch (err) {
        alert(`匯入 Excel 失敗：${err.message || err}`);
        console.error(err);
      }
      e.target.value = '';
    });

    // 下載多班級 / 公假系統 Excel 範例檔 (完全對齊南寧高中公假系統格式)
    document.getElementById('downloadMultiRosterSampleBtn')?.addEventListener('click', () => {
      const sampleData = [
        { '學號': '411004', '班級': '401', '座號': '01', '姓名': '朱冠嘉' },
        { '學號': '411005', '班級': '401', '座號': '02', '姓名': '吳廷富' },
        { '學號': '411014', '班級': '401', '座號': '03', '姓名': '林定緯' },
        { '學號': '411017', '班級': '401', '座號': '04', '姓名': '林楷歲' },
        { '學號': '411035', '班級': '401', '座號': '05', '姓名': '陳彥均' },
        { '學號': '411038', '班級': '401', '座號': '06', '姓名': '陳敬允' },
        { '學號': '411041', '班級': '401', '座號': '07', '姓名': '曾亮勛' },
        { '學號': '411042', '班級': '401', '座號': '08', '姓名': '曾祥閔' },
        { '學號': '411046', '班級': '402', '座號': '01', '姓名': '黃彥勝' },
        { '學號': '411047', '班級': '402', '座號': '02', '姓名': '黃翊豪' }
      ];
      const timestamp = StorageManager.getFormattedTimestamp();
      StorageManager.exportExcel(sampleData, `${timestamp}_南寧公假系統名冊格式範例.xlsx`);
    });

    // 下載單班名條範例檔
    document.getElementById('downloadRosterSampleBtn')?.addEventListener('click', () => {
      const sampleData = [
        { '座號': 1, '姓名': '張小明', '性別': '男', '備註': '風紀股長' },
        { '座號': 2, '姓名': '李小華', '性別': '女', '備註': '學藝股長' },
        { '座號': 3, '姓名': '王大同', '性別': '男', '備註': '體育股長' }
      ];
      const timestamp = StorageManager.getFormattedTimestamp();
      StorageManager.exportExcel(sampleData, `${timestamp}_單班學生名條範例檔.xlsx`);
    });
  },

  saveActiveStudents(students) {
    const classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    classes[activeClass] = students;
    StorageManager.set(StorageManager.KEYS.CLASSES, classes);
    this.refreshAll();
  },

  refreshAll() {
    this.renderClassSelect();
    this.renderRosterTable();
  },

  renderClassSelect() {
    const classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    
    // 依班級名稱與數字自然排序 (例如: 401班, 402班, 410班, 501班)
    const sortedClassNames = Object.keys(classes).sort((a, b) => 
      a.localeCompare(b, 'zh-TW', { numeric: true, sensitivity: 'base' })
    );

    // 1. 全域側邊欄班級選單
    const globalSelect = document.getElementById('globalClassSelect');
    if (globalSelect) {
      globalSelect.innerHTML = '';
      sortedClassNames.forEach(clsName => {
        const option = document.createElement('option');
        option.value = clsName;
        option.textContent = clsName;
        if (clsName === activeClass) option.selected = true;
        globalSelect.appendChild(option);
      });
      globalSelect.value = activeClass;
    }

    // 2. 班級管理頁面內的班級下拉選單
    const rosterSelect = document.getElementById('rosterClassSelect');
    if (rosterSelect) {
      rosterSelect.innerHTML = '';
      sortedClassNames.forEach(clsName => {
        const option = document.createElement('option');
        option.value = clsName;
        option.textContent = clsName;
        if (clsName === activeClass) option.selected = true;
        rosterSelect.appendChild(option);
      });
      rosterSelect.value = activeClass;
    }
  },

  renderRosterTable() {
    const tbody = document.getElementById('rosterTableBody');
    if (!tbody) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">目前【${activeClass}】尚無學生資料，請點擊匯入 Excel 或手動新增學生。</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(st => `
      <tr>
        <td>${st.number}</td>
        <td><strong>${st.name}</strong></td>
        <td><span class="student-tag">${st.note || '-'}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-danger" onclick="RosterModule.deleteStudent('${st.id}')">
            <i class="fa-solid fa-trash"></i> 刪除
          </button>
        </td>
      </tr>
    `).join('');
  },

  deleteStudent(id) {
    if (confirm('確定要刪除該位學生及其成績紀錄嗎？')) {
      // 1. 清理該學生個人加分紀錄
      const points = StorageManager.get(StorageManager.KEYS.POINTS, {});
      delete points[id];
      StorageManager.set(StorageManager.KEYS.POINTS, points);

      // 2. 移除學生
      const students = StorageManager.getActiveClassStudents().filter(s => s.id !== id);
      this.saveActiveStudents(students);
    }
  }
};
