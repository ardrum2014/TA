const RosterModule = {
  isEditing: false,
  tempStudents: null,

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
        const students = StorageManager.getActiveClassStudents();
        const studentIds = new Set(students.map(s => s.id));

        let classes = StorageManager.get(StorageManager.KEYS.CLASSES, {});
        if (Array.isArray(classes) || typeof classes !== 'object' || classes === null) {
          classes = {};
        }
        delete classes[activeClass];
        StorageManager.set(StorageManager.KEYS.CLASSES, classes);

        const points = StorageManager.get(StorageManager.KEYS.POINTS, {});
        studentIds.forEach(id => delete points[id]);
        StorageManager.set(StorageManager.KEYS.POINTS, points);

        // 刪除該班級的分組
        const groupsMap = StorageManager.get(StorageManager.KEYS.GROUPS, {});
        delete groupsMap[activeClass];
        StorageManager.set(StorageManager.KEYS.GROUPS, groupsMap);

        // 刪除該班級的待分配小組暫存區
        const unassignedMap = StorageManager.get('cozy_teacher_unassigned_groups', {});
        delete unassignedMap[activeClass];
        StorageManager.set('cozy_teacher_unassigned_groups', unassignedMap);

        const homeworks = StorageManager.get(StorageManager.KEYS.HOMEWORK, []);
        homeworks.forEach(hw => {
          if (hw.records) {
            studentIds.forEach(id => delete hw.records[id]);
          }
        });
        StorageManager.set(StorageManager.KEYS.HOMEWORK, homeworks);

        const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
        if (progressMap && typeof progressMap === 'object') {
          delete progressMap[activeClass];
          StorageManager.set(StorageManager.KEYS.PROGRESS, progressMap);
        }

        // 刪除該班級的座位表
        const seatingMap = StorageManager.get(StorageManager.KEYS.SEATING, {});
        delete seatingMap[activeClass];
        StorageManager.set(StorageManager.KEYS.SEATING, seatingMap);

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
      
      let students;
      if (this.isEditing) {
        this.syncInputsToData();
        students = this.tempStudents || [];
      } else {
        students = StorageManager.getActiveClassStudents();
      }

      const nextNumber = students.length > 0 ? Math.max(...students.map(s => s.number || 0)) + 1 : 1;
      const number = prompt('請輸入學生座號：', nextNumber) || nextNumber;
      const note = prompt('請輸入學生學號：') || '';
      const cadre = prompt('請輸入學生擔任幹部（例如：班長，可留空）：') || '';
      const remarks = prompt('請輸入備註（可留空）：') || '';

      students.push({
        id: Date.now().toString(),
        number: parseInt(number, 10) || nextNumber,
        name: name.trim(),
        note: note.trim(),
        cadre: cadre.trim(),
        remarks: remarks.trim()
      });

      if (this.isEditing) {
        this.tempStudents = students;
        this.renderRosterTable();
      } else {
        this.saveActiveStudents(students);
      }
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
        { '座號': 1, '姓名': '張小明', '學號': '114001', '幹部': '班長', '備註': '午餐抬箱手' },
        { '座號': 2, '姓名': '李小華', '學號': '114002', '幹部': '副班長', '備註': '收各科作業' },
        { '座號': 3, '姓名': '王大同', '學號': '114003', '幹部': '風紀股長', '備註': '登記秩序' }
      ];
      const timestamp = StorageManager.getFormattedTimestamp();
      StorageManager.exportExcel(sampleData, `${timestamp}_單班學生名條範例檔.xlsx`);
    });
  },

  saveActiveStudents(students) {
    let classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    if (Array.isArray(classes) || typeof classes !== 'object' || classes === null) {
      classes = {};
    }
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
    let classes = StorageManager.get(StorageManager.KEYS.CLASSES, StorageManager.getDefaultClasses());
    if (Array.isArray(classes) || typeof classes !== 'object' || classes === null) {
      classes = {};
    }
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

  toggleEdit() {
    this.isEditing = !this.isEditing;
    const btn = document.getElementById('toggleRosterEditBtn');
    if (btn) {
      if (this.isEditing) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 💾 儲存修改';
        btn.className = 'btn btn-sm btn-success';
      } else {
        this.saveCurrentEdits();
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> ✏️ 編輯學生資料與排序';
        btn.className = 'btn btn-sm btn-secondary';
      }
    }
    this.renderRosterTable();
  },

  saveCurrentEdits() {
    const tbody = document.getElementById('rosterTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-student-id]');
    const updatedStudents = [];

    rows.forEach((row, idx) => {
      const id = row.getAttribute('data-student-id');
      const nameInput = row.querySelector('.edit-student-name');
      const noteInput = row.querySelector('.edit-student-note');
      const cadreInput = row.querySelector('.edit-student-cadre');
      const remarksInput = row.querySelector('.edit-student-remarks');

      if (id && nameInput) {
        updatedStudents.push({
          id: id,
          number: idx + 1, // 自動依排序重編座號
          name: nameInput.value.trim() || '學生',
          note: noteInput ? noteInput.value.trim() : '',
          cadre: cadreInput ? cadreInput.value.trim() : '',
          remarks: remarksInput ? remarksInput.value.trim() : ''
        });
      }
    });

    this.saveActiveStudents(updatedStudents);
    // 廣播 rosterUpdated 事件以同步座位表、加分板與幸運輪盤等模組！
    window.dispatchEvent(new Event('rosterUpdated'));
    alert('💾 學生名冊資料與排序已成功儲存並同步！');
  },

  exportExcel() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) {
      alert('目前該班級尚無學生資料，無法匯出！');
      return;
    }

    const includePoints = confirm('❓ 是否需要在匯出的學生名條中，【同時整合匯出個人加分與小組競賽成績】？');

    let exportData;
    if (includePoints) {
      // 讀取分數與分組資料
      const individualScores = StorageManager.get(StorageManager.KEYS.POINTS, {});
      const teamGroups = StorageManager.get(StorageManager.KEYS.GROUPS, []);

      // 建立學生與所屬小組對照表
      const studentTeamMap = {};
      if (teamGroups && teamGroups.length > 0) {
        teamGroups.forEach(grp => {
          const teamName = grp.name || '未命名小組';
          const teamScore = grp.score || 0;
          if (grp.members && Array.isArray(grp.members)) {
            grp.members.forEach((m, idx) => {
              studentTeamMap[m.id] = {
                teamName: teamName,
                teamScore: teamScore,
                isLeader: m.isLeader || (grp.leaderId && grp.leaderId === m.id) || idx === 0
              };
            });
          }
        });
      }

      exportData = students.map(st => {
        const personalScore = individualScores[st.id] || 0;
        const teamInfo = studentTeamMap[st.id] || { teamName: '（未分組）', teamScore: 0, isLeader: false };
        const teamScore = teamInfo.teamScore;
        const totalScore = personalScore + teamScore;

        return {
          '座號': st.number,
          '姓名': st.name,
          '學號': st.note || '',
          '幹部': st.cadre || '',
          '個人得分': personalScore,
          '所屬組別': teamInfo.teamName,
          '小組得分': teamScore,
          '總累計得分': totalScore,
          '備註': (teamInfo.isLeader ? '⭐組長 ' : '') + (st.remarks || '')
        };
      });
    } else {
      exportData = students.map(st => ({
        '座號': st.number,
        '姓名': st.name,
        '學號': st.note || '',
        '幹部': st.cadre || '',
        '備註': st.remarks || ''
      }));
    }

    const timestamp = StorageManager.getFormattedTimestamp();
    const fileName = `${timestamp}_${activeClass}_學生名條${includePoints ? '_含成績整合表' : ''}.xlsx`;

    try {
      StorageManager.exportExcel(exportData, fileName);
    } catch (err) {
      alert('匯出 Excel 失敗：' + (err.message || err));
      console.error(err);
    }
  },

  syncInputsToData() {
    const tbody = document.getElementById('rosterTableBody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr[data-student-id]');
    this.tempStudents = [];
    rows.forEach((row, idx) => {
      const id = row.getAttribute('data-student-id');
      const nameInput = row.querySelector('.edit-student-name');
      const noteInput = row.querySelector('.edit-student-note');
      const cadreInput = row.querySelector('.edit-student-cadre');
      const remarksInput = row.querySelector('.edit-student-remarks');
      this.tempStudents.push({
        id: id,
        number: idx + 1,
        name: nameInput ? nameInput.value.trim() : '',
        note: noteInput ? noteInput.value.trim() : '',
        cadre: cadreInput ? cadreInput.value.trim() : '',
        remarks: remarksInput ? remarksInput.value.trim() : ''
      });
    });
  },

  moveUp(index) {
    this.syncInputsToData();
    if (index > 0) {
      const temp = this.tempStudents[index];
      this.tempStudents[index] = this.tempStudents[index - 1];
      this.tempStudents[index - 1] = temp;
      
      // 更新排序座號
      this.tempStudents.forEach((st, idx) => { st.number = idx + 1; });
      this.renderRosterTable();
    }
  },

  moveDown(index) {
    this.syncInputsToData();
    if (index < this.tempStudents.length - 1) {
      const temp = this.tempStudents[index];
      this.tempStudents[index] = this.tempStudents[index + 1];
      this.tempStudents[index + 1] = temp;
      
      // 更新排序座號
      this.tempStudents.forEach((st, idx) => { st.number = idx + 1; });
      this.renderRosterTable();
    }
  },

  bindDragEvents(tbody) {
    let draggedRow = null;

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('dragstart', (e) => {
        draggedRow = tr;
        e.dataTransfer.effectAllowed = 'move';
        tr.style.opacity = '0.5';
        e.dataTransfer.setData('text/plain', tr.getAttribute('data-student-id') || '');
      });

      tr.addEventListener('dragend', () => {
        tr.style.opacity = '1';
        draggedRow = null;
        this.syncInputsToData();
        this.renderRosterTable();
      });

      tr.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('tr');
        if (target && target !== draggedRow && target.parentNode === tbody) {
          const rect = target.getBoundingClientRect();
          const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
          tbody.insertBefore(draggedRow, next ? target.nextSibling : target);
        }
      });
    });
  },

  renderRosterTable() {
    const tbody = document.getElementById('rosterTableBody');
    if (!tbody) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    
    // 如果在編輯模式下且有暫存資料，就使用暫存資料；否則讀取最即時的本機資料
    const students = this.isEditing && this.tempStudents ? this.tempStudents : StorageManager.getActiveClassStudents();

    if (!this.isEditing) {
      this.tempStudents = null;
    }

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">目前【${activeClass}】尚無學生資料，請點擊匯入 Excel 或手動新增學生。</td></tr>`;
      return;
    }

    if (this.isEditing) {
      tbody.innerHTML = students.map((st, idx) => `
        <tr data-student-id="${st.id}" draggable="true" style="cursor: move;">
          <td style="vertical-align: middle;">
            <i class="fa-solid fa-grip-vertical" style="color: var(--text-muted); margin-right: 8px; cursor: grab;" title="拖曳以排序"></i>
            <input type="number" class="edit-student-number form-control" value="${st.number}" style="width: 55px; display: inline-block; padding: 4px; font-weight: bold; text-align: center;" readonly>
          </td>
          <td style="vertical-align: middle;">
            <input type="text" class="edit-student-name form-control" value="${st.name}" style="width: 110px; font-weight: bold; padding: 4px;">
          </td>
          <td style="vertical-align: middle;">
            <input type="text" class="edit-student-note form-control" value="${st.note || ''}" style="width: 100px; padding: 4px;" placeholder="學號">
          </td>
          <td style="vertical-align: middle;">
            <input type="text" class="edit-student-cadre form-control" value="${st.cadre || ''}" style="width: 100px; padding: 4px;" placeholder="幹部">
          </td>
          <td style="vertical-align: middle;">
            <input type="text" class="edit-student-remarks form-control" value="${st.remarks || ''}" style="width: 130px; padding: 4px;" placeholder="備註">
          </td>
          <td style="vertical-align: middle;">
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn btn-sm btn-outline-secondary" onclick="RosterModule.moveUp(${idx})" title="向上移動" type="button">
                <i class="fa-solid fa-arrow-up"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary" onclick="RosterModule.moveDown(${idx})" title="向下移動" type="button">
                <i class="fa-solid fa-arrow-down"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="RosterModule.deleteStudent('${st.id}')" type="button">
                <i class="fa-solid fa-trash"></i> 刪除
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      this.bindDragEvents(tbody);
    } else {
      tbody.innerHTML = students.map(st => `
        <tr data-student-id="${st.id}">
          <td>${st.number}</td>
          <td><strong>${st.name}</strong></td>
          <td><span class="student-tag">${st.note || '-'}</span></td>
          <td><span class="student-tag" style="background-color: rgba(76, 140, 82, 0.1); color: var(--color-leaf-green); font-weight: 500;">${st.cadre || '-'}</span></td>
          <td><span class="student-tag" style="background-color: rgba(217, 119, 6, 0.08);">${st.remarks || '-'}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 0.8rem; margin-right: 4px;" title="檢視個人綜合戰報" onclick="RosterModule.showStudentProfileModal('${st.id}')">
              🪪 戰報
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="RosterModule.deleteStudent('${st.id}')">
              <i class="fa-solid fa-trash"></i> 刪除
            </button>
          </td>
        </tr>
      `).join('');
    }
  },

  deleteStudent(id) {
    if (confirm('確定要刪除該位學生及其成績紀錄嗎？')) {
      // 1. 清理該學生個人加分紀錄
      const points = StorageManager.get(StorageManager.KEYS.POINTS, {});
      delete points[id];
      StorageManager.set(StorageManager.KEYS.POINTS, points);

      // 2. 移除學生
      if (this.isEditing) {
        this.syncInputsToData();
        this.tempStudents = this.tempStudents.filter(s => s.id !== id);
        // 重新排序座號
        this.tempStudents.forEach((s, idx) => { s.number = idx + 1; });
        this.renderRosterTable();
      } else {
        const students = StorageManager.getActiveClassStudents().filter(s => s.id !== id);
        this.saveActiveStudents(students);
      }
    }
  },

  showStudentProfileModal(studentId) {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '501班');
    const students = StorageManager.getActiveClassStudents();
    const st = students.find(s => s.id === studentId);
    if (!st) return;

    // 1. 撈取個人點數
    const pointsData = StorageManager.get(StorageManager.KEYS.POINTS, {});
    const classPoints = pointsData[activeClass] || {};
    const personalPoints = classPoints.students ? (classPoints.students[st.id] || 0) : 0;

    // 2. 撈取座位表座標
    let seatPosStr = '未安排座位';
    const seatingData = StorageManager.get(StorageManager.KEYS.SEATING, {});
    const classSeating = seatingData[activeClass];
    if (classSeating && classSeating.grid) {
      for (const [key, student] of Object.entries(classSeating.grid)) {
        if (student && student.id === st.id) {
          const [r, c] = key.split('_');
          seatPosStr = `第 ${r} 行 / 第 ${c} 列`;
          break;
        }
      }
    }

    // 3. 撈取小組資訊
    let groupStr = '未分組';
    const groupsData = StorageManager.get(StorageManager.KEYS.GROUPS, {});
    const classGroups = groupsData[activeClass] || [];
    classGroups.forEach(grp => {
      if ((grp.members || []).some(m => m.id === st.id)) {
        const isLeader = grp.leaderId === st.id;
        groupStr = `${grp.name} ${isLeader ? '(👑 組長)' : ''}`;
      }
    });

    // 4. 撈取欠繳/待訂正作業
    const progressMap = StorageManager.get(StorageManager.KEYS.PROGRESS, {});
    const subjects = progressMap[activeClass] || [];
    const missingItems = [];

    subjects.forEach(sub => {
      (sub.chapters || []).forEach(ch => {
        (ch.homeworks || []).forEach(hw => {
          const status = hw.records[st.id] || 'missing';
          if (status === 'missing' || status === 'correcting') {
            missingItems.push({
              subjectTitle: sub.title.replace(/📐|📖|🧪|🎨/g, '').trim(),
              chapterName: ch.name,
              hwTitle: hw.title,
              status: status === 'missing' ? '未繳 ❌' : '待訂正 🟡'
            });
          }
        });
      });
    });

    // 5. 渲染彈窗
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    const backdrop = document.getElementById('modalBackdrop');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!backdrop || !modalBody) return;

    modalTitle.textContent = `🪪 【${activeClass}】#${st.number} ${st.name} 學生綜合戰報`;

    const reportText = `📢 【${activeClass}】座號 #${st.number} ${st.name} 個人學習戰報：\n` +
      `----------------------------------\n` +
      `・學號：${st.學號 || st.note || '-'}\n` +
      `・幹部/職務：${st.幹部 || st.cadre || '無'}\n` +
      `・座位位置：${seatPosStr}\n` +
      `・所屬小組：${groupStr}\n` +
      `・累計獲獎點數：${personalPoints} 分\n` +
      `----------------------------------\n` +
      `欠繳/待訂正作業明細 (${missingItems.length} 件)：\n` +
      (missingItems.length === 0 ? '  🎉 所有作業皆已繳交完畢！\n' : missingItems.map(m => `  👉 ${m.subjectTitle}：${m.chapterName} - ${m.hwTitle} (${m.status})`).join('\n')) +
      `\n----------------------------------\n` +
      `發送時間：${StorageManager.getFormattedTimestamp()}`;

    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
          <div><b>座號：</b> #${st.number}</div>
          <div><b>姓名：</b> ${st.name}</div>
          <div><b>學號：</b> ${st.學號 || st.note || '-'}</div>
          <div><b>幹部：</b> ${st.幹部 || st.cadre || '無'}</div>
          <div><b>座位：</b> ${seatPosStr}</div>
          <div><b>小組：</b> ${groupStr}</div>
          <div><b>累計點數：</b> <b style="color:var(--color-terracotta);">${personalPoints} 分</b></div>
        </div>

        <div style="font-weight: bold; color: var(--color-espresso);">
          ⚠️ 欠繳與待訂正作業紀錄 (${missingItems.length} 件)：
        </div>
        <div style="max-height: 160px; overflow-y: auto; padding: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.88rem;">
          ${missingItems.length === 0 ? `
            <div style="color: var(--color-leaf-green); font-weight: bold;">🎉 太棒了！該生目前所有作業皆已收齊繳交！</div>
          ` : missingItems.map(m => `
            <div style="margin-bottom: 4px; color: var(--text-main);">
              👉 <b>${m.subjectTitle}</b>：${m.chapterName} - ${m.hwTitle} <span style="color: #d9534f; font-weight: bold;">(${m.status})</span>
            </div>
          `).join('')}
        </div>

        <div style="text-align: right; margin-top: 6px;">
          <button class="btn btn-accent" id="copyStudentProfileReportBtn"><i class="fa-solid fa-copy"></i> 複製學生綜合學習報告</button>
        </div>
      </div>
    `;

    backdrop.style.display = 'flex';
    confirmBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'inline-block';

    const copyBtn = document.getElementById('copyStudentProfileReportBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(reportText).then(() => {
          alert(`🎉 已成功複製【${st.name}】的綜合學習報告至剪貼簿！`);
        }).catch(() => {
          alert(reportText);
        });
      };
    }
  }
};

window.showStudentProfileModal = (stId) => RosterModule.showStudentProfileModal(stId);
