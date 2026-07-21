/**
 * 分組工具模組 (支援 🔒 唯讀預覽模式、✏️ 編輯模式/💾 儲存變更、同組拉動排序、跨組拖放對換、單一組長維護、手動調整名單)
 */
const GroupsModule = {
  groupsMap: {}, // className -> list of { name, score, members }
  unassignedMap: {}, // className -> list of unassigned students
  groups: [],
  unassigned: [],
  selectedMember: null, // { groupIdx, memberIdx, isUnassigned }
  draggedMemberInfo: null, // { groupIdx, memberIdx, isUnassigned }
  isEditing: false, // 預設為 🔒 唯讀預覽模式 (防止誤觸移動組員)

  init() {
    this.groupsMap = StorageManager.get(StorageManager.KEYS.GROUPS, {});
    this.unassignedMap = StorageManager.get('cozy_teacher_unassigned_groups', {});
    this.bindEvents();
    this.loadActiveGroups();

    window.addEventListener('rosterUpdated', () => {
      this.loadActiveGroups();
    });
  },

  loadActiveGroups() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.groups = this.groupsMap[activeClass] || [];
    this.unassigned = this.unassignedMap[activeClass] || [];
    this.sanitizeGroupLeaders();
    this.renderGroups();
  },

  saveActiveGroups() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.sanitizeGroupLeaders();
    this.groupsMap[activeClass] = this.groups;
    this.unassignedMap[activeClass] = this.unassigned;
    StorageManager.set(StorageManager.KEYS.GROUPS, this.groupsMap);
    StorageManager.set('cozy_teacher_unassigned_groups', this.unassignedMap);
    this.renderGroups();
  },

  // 整理與淨化小組組長邏輯 (確保每組最多只有一位組長；若有組員但無組長則預設第一位為組長)
  sanitizeGroupLeaders() {
    this.groups.forEach(group => {
      if (!group.members || group.members.length === 0) return;

      const leaders = group.members.filter(m => m.isLeader);

      if (leaders.length > 1) {
        // 多位組長（如拖放混入）：保留第一位組長，其餘自動歸為成員
        let foundLeader = false;
        group.members.forEach(m => {
          if (m.isLeader) {
            if (!foundLeader) {
              foundLeader = true;
            } else {
              m.isLeader = false;
            }
          }
        });
      } else if (leaders.length === 0) {
        // 無組長：自動設第一位 (index 0) 為預設組長
        group.members[0].isLeader = true;
      }
    });

    // 清理未分配區學生的 isLeader 標籤
    this.unassigned.forEach(m => {
      m.isLeader = false;
    });
  },

  bindEvents() {
    // ✏️ 切換編輯模式 / 🔒 鎖定唯讀模式
    document.getElementById('toggleGroupEditBtn')?.addEventListener('click', () => {
      this.toggleEditMode();
    });

    // 💾 儲存分組設定
    document.getElementById('saveGroupEditBtn')?.addEventListener('click', () => {
      this.saveEditMode();
    });

    document.getElementById('groupModeSelect')?.addEventListener('change', (e) => {
      const label = document.getElementById('groupCountLabel');
      if (label) {
        label.textContent = (e.target.value === 'numGroups') ? '目標總組數：' : '每組人數：';
      }
    });

    // 自動生成隨機分組
    document.getElementById('generateGroupsBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可進行自動隨機分組。');
      }
      this.generateGroups();
    });

    // 一鍵預設各組第一位為組長
    document.getElementById('resetLeadersBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」解鎖。');
      }
      this.groups.forEach(g => {
        g.members.forEach((m, idx) => {
          m.isLeader = (idx === 0);
        });
      });
      this.saveActiveGroups();
      alert('已成功將各組排在第 1 位的學生確認為該組組長 👑！');
    });

    // 手動新增小組
    document.getElementById('addGroupManualBtn')?.addEventListener('click', () => {
      if (!this.isEditing) {
        return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」即可新增小組。');
      }
      this.addNewGroup();
    });

    // 匯出分組與課堂評分 Excel 表單
    document.getElementById('exportGroupsExcelBtn')?.addEventListener('click', () => {
      this.exportExcel();
    });

    // 同步至加分榜
    document.getElementById('groupsSyncToPointsBtn')?.addEventListener('click', () => {
      if (this.groups.length === 0) return alert('請先建立或生成分組！');
      PointsModule.setTeamGroups(this.groups);
      alert('已成功將分組結果同步至「分組加分榜」！');
      document.querySelector('.nav-item[data-tab="points"]')?.click();
      document.getElementById('viewTeamPointsBtn')?.click();
    });
  },

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    const toggleBtn = document.getElementById('toggleGroupEditBtn');
    const saveBtn = document.getElementById('saveGroupEditBtn');
    const bannerText = document.getElementById('groupModeText');
    const bannerIcon = document.getElementById('groupModeIcon');

    if (this.isEditing) {
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-lock"></i> 🔒 鎖定唯讀';
      if (saveBtn) saveBtn.classList.remove('hidden');
      if (bannerText) bannerText.textContent = '目前為「✏️ 編輯模式」（同組可自由拖拉排序、點擊「成員/組長 👑」變更組長，完成後請點擊「💾 儲存分組設定」）';
      if (bannerIcon) bannerIcon.className = 'fa-solid fa-pen';
    } else {
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pen"></i> ✏️ 編輯模式';
      if (saveBtn) saveBtn.classList.add('hidden');
      if (bannerText) bannerText.textContent = '目前為「🔒 唯讀預覽模式」（防止課堂誤觸移動組員，點擊右上角「✏️ 編輯模式」進行調整/隨機分組）';
      if (bannerIcon) bannerIcon.className = 'fa-solid fa-lock';
      this.selectedMember = null;
    }
    this.renderGroups();
  },

  saveEditMode() {
    this.saveActiveGroups();
    this.isEditing = false;
    this.selectedMember = null;

    const toggleBtn = document.getElementById('toggleGroupEditBtn');
    const saveBtn = document.getElementById('saveGroupEditBtn');
    const bannerText = document.getElementById('groupModeText');
    const bannerIcon = document.getElementById('groupModeIcon');

    if (toggleBtn) toggleBtn.innerHTML = '<i class="fa-solid fa-pen"></i> ✏️ 編輯模式';
    if (saveBtn) saveBtn.classList.add('hidden');
    if (bannerText) bannerText.textContent = '目前為「🔒 唯讀預覽模式」（防止課堂誤觸移動組員，點擊右上角「✏️ 編輯模式」進行調整/隨機分組）';
    if (bannerIcon) bannerIcon.className = 'fa-solid fa-lock';

    if (typeof confetti === 'function') {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    }
    alert('💾 分組設定已成功儲存！已自動切換回 🔒 唯讀防誤觸模式。');
    this.renderGroups();
  },

  // 匯出分組與課堂評分 Excel 表單
  exportExcel() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    if (!this.groups || this.groups.length === 0) {
      return alert('目前尚未進行分組，請先點擊「✏️ 編輯模式」再進行分組！');
    }

    const exportRows = [];

    this.groups.forEach((grp, grpIdx) => {
      const groupName = grp.name || `第 ${grpIdx + 1} 組`;
      if (grp.members && grp.members.length > 0) {
        grp.members.forEach((st, memIdx) => {
          const isLeader = st.isLeader || (grp.leaderId && grp.leaderId === st.id) || memIdx === 0;
          exportRows.push({
            '班級': activeClass,
            '組別': groupName,
            '座號': st.number || (memIdx + 1),
            '姓名': st.name || '',
            '組內身份': isLeader ? '⭐ 組長' : '組員',
            '性別/備註': st.note || '',
            '課堂評分/成績': ''
          });
        });
      }
    });

    if (this.unassigned && this.unassigned.length > 0) {
      this.unassigned.forEach((st, memIdx) => {
        exportRows.push({
          '班級': activeClass,
          '組別': '（未分組）',
          '座號': st.number || (memIdx + 1),
          '姓名': st.name || '',
          '組內身份': '',
          '性別/備註': st.note || '',
          '課堂評分/成績': ''
        });
      });
    }

    if (exportRows.length === 0) {
      return alert('分組名單中尚無任何學生資料！');
    }

    const timestamp = StorageManager.getFormattedTimestamp();
    StorageManager.exportExcel(exportRows, `${timestamp}_${activeClass}_學生分組評分表.xlsx`);
  },

  // 自動隨機分組
  generateGroups() {
    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) return alert('請先在名條管理中建立學生名錄！');

    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const mode = document.getElementById('groupModeSelect').value;
    const targetVal = parseInt(document.getElementById('groupTargetNum').value, 10) || 4;

    let numGroups = targetVal;
    if (mode === 'perGroup') {
      numGroups = Math.ceil(students.length / targetVal);
    }

    this.groups = Array.from({ length: numGroups }, (_, i) => ({
      name: `第 ${i + 1} 組`,
      members: []
    }));
    this.unassigned = [];

    shuffled.forEach((st, idx) => {
      const gIdx = idx % numGroups;
      this.groups[gIdx].members.push({
        ...st,
        isLeader: this.groups[gIdx].members.length === 0
      });
    });

    this.selectedMember = null;
    this.saveActiveGroups();
  },

  // 手動新增一組
  addNewGroup() {
    const nextNum = this.groups.length + 1;
    this.groups.push({
      name: `第 ${nextNum} 組`,
      members: []
    });
    this.saveActiveGroups();
  },

  // 重新命名小組
  renameGroup(gIdx) {
    if (!this.isEditing) return;
    const group = this.groups[gIdx];
    if (!group) return;
    const newName = prompt(`修改組別名稱：`, group.name);
    if (newName && newName.trim()) {
      group.name = newName.trim();
      this.saveActiveGroups();
    }
  },

  // 刪除小組
  deleteGroup(gIdx) {
    if (!this.isEditing) return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」解鎖。');
    const group = this.groups[gIdx];
    if (!group) return;
    if (confirm(`確定要刪除「${group.name}」嗎？組內學生將移至未分配區。`)) {
      this.unassigned.push(...group.members);
      this.groups.splice(gIdx, 1);
      this.selectedMember = null;
      this.saveActiveGroups();
    }
  },

  // 切換/指定組長 (單一組長原則：點擊該生即切換為本組唯一組長)
  toggleLeader(gIdx, mIdx) {
    if (!this.isEditing) return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」解鎖。');
    const group = this.groups[gIdx];
    if (!group || !group.members[mIdx]) return;

    const targetMember = group.members[mIdx];
    const isCurrentlyLeader = targetMember.isLeader;

    // 先將同組所有成員皆重置為非組長
    group.members.forEach(m => {
      m.isLeader = false;
    });

    // 若原本不是組長 -> 指定該生為本組唯一組長；若原本是組長 -> 取消其組長身份
    if (!isCurrentlyLeader) {
      targetMember.isLeader = true;
    }

    this.saveActiveGroups();
  },

  // 手動加入學生至指定組別
  addMemberToGroup(gIdx) {
    if (!this.isEditing) return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」解鎖。');
    const name = prompt('請輸入要新增至本組的學生姓名：');
    if (!name || !name.trim()) return;

    this.groups[gIdx].members.push({
      id: Date.now().toString(),
      number: this.groups[gIdx].members.length + 1,
      name: name.trim(),
      isLeader: this.groups[gIdx].members.length === 0
    });

    this.saveActiveGroups();
  },

  // 從組別中移除學生
  removeMember(gIdx, mIdx) {
    if (!this.isEditing) return alert('目前為 🔒 唯讀模式！請先點擊右上角「✏️ 編輯模式」解鎖。');
    const st = this.groups[gIdx].members.splice(mIdx, 1)[0];
    if (st) {
      st.isLeader = false;
      this.unassigned.push(st);
    }
    this.saveActiveGroups();
  },

  // 點擊學生卡片 (選擇或移動/對換)
  handleMemberClick(gIdx, mIdx, isUnassigned = false) {
    if (!this.isEditing) return;

    if (!this.selectedMember) {
      this.selectedMember = { gIdx, mIdx, isUnassigned };
      this.renderGroups();
      return;
    }

    if (
      this.selectedMember.gIdx === gIdx &&
      this.selectedMember.mIdx === mIdx &&
      this.selectedMember.isUnassigned === isUnassigned
    ) {
      this.selectedMember = null;
      this.renderGroups();
      return;
    }

    this.moveOrSwapMembers(this.selectedMember, { gIdx, mIdx, isUnassigned });
    this.selectedMember = null;
    this.saveActiveGroups();
  },

  // 點擊組別空白處或標頭 (將選取的學生直接移入此組)
  handleGroupClick(targetGIdx) {
    if (!this.isEditing || !this.selectedMember) return;

    const source = this.selectedMember;
    if (source.gIdx === targetGIdx && !source.isUnassigned) {
      this.selectedMember = null;
      this.renderGroups();
      return;
    }

    let st;
    if (source.isUnassigned) {
      st = this.unassigned.splice(source.mIdx, 1)[0];
    } else {
      st = this.groups[source.gIdx].members.splice(source.mIdx, 1)[0];
    }

    if (st) {
      this.groups[targetGIdx].members.push(st);
    }

    this.selectedMember = null;
    this.saveActiveGroups();
  },

  // 移動或對換學生
  moveOrSwapMembers(src, dest) {
    let srcSt, destSt;

    if (src.isUnassigned) {
      srcSt = this.unassigned[src.mIdx];
    } else {
      srcSt = this.groups[src.gIdx].members[src.mIdx];
    }

    if (dest.isUnassigned) {
      destSt = this.unassigned[dest.mIdx];
    } else {
      destSt = this.groups[dest.gIdx].members[dest.mIdx];
    }

    if (src.isUnassigned) {
      this.unassigned[src.mIdx] = destSt;
    } else {
      this.groups[src.gIdx].members[src.mIdx] = destSt;
    }

    if (dest.isUnassigned) {
      this.unassigned[dest.mIdx] = srcSt;
    } else {
      this.groups[dest.gIdx].members[dest.mIdx] = srcSt;
    }
  },

  // 拖動處理 (Drag & Drop)
  handleDragStart(e, gIdx, mIdx, isUnassigned = false) {
    if (!this.isEditing) return;
    this.draggedMemberInfo = { gIdx, mIdx, isUnassigned };
    e.dataTransfer.effectAllowed = 'move';
  },

  handleDragOver(e, gIdx) {
    if (!this.isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = document.getElementById(`groupCard_${gIdx}`);
    if (card) card.classList.add('drag-over');
  },

  handleDragLeave(gIdx) {
    const card = document.getElementById(`groupCard_${gIdx}`);
    if (card) card.classList.remove('drag-over');
  },

  // 拖曳至具體學生卡片上 (支援同組內自由拉動排序與跨組插入)
  handleMemberDragOver(e, gIdx, mIdx) {
    if (!this.isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const el = document.getElementById(`memberItem_${gIdx}_${mIdx}`);
    if (el) el.classList.add('drag-over');
  },

  handleMemberDragLeave(gIdx, mIdx) {
    const el = document.getElementById(`memberItem_${gIdx}_${mIdx}`);
    if (el) el.classList.remove('drag-over');
  },

  handleMemberDrop(e, targetGIdx, targetMIdx) {
    if (!this.isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    this.handleMemberDragLeave(targetGIdx, targetMIdx);

    if (!this.draggedMemberInfo) return;
    const src = this.draggedMemberInfo;

    // 同一組內拉動排序
    if (src.gIdx === targetGIdx && !src.isUnassigned) {
      if (src.mIdx === targetMIdx) return;

      const members = this.groups[targetGIdx].members;
      const [movedSt] = members.splice(src.mIdx, 1);
      members.splice(targetMIdx, 0, movedSt);

      this.draggedMemberInfo = null;
      this.saveActiveGroups();
      return;
    }

    // 跨組移入特定位置
    let st;
    if (src.isUnassigned) {
      st = this.unassigned.splice(src.mIdx, 1)[0];
    } else {
      st = this.groups[src.gIdx].members.splice(src.mIdx, 1)[0];
    }

    if (st) {
      this.groups[targetGIdx].members.splice(targetMIdx, 0, st);
    }

    this.draggedMemberInfo = null;
    this.saveActiveGroups();
  },

  handleDrop(e, targetGIdx) {
    if (!this.isEditing) return;
    e.preventDefault();
    this.handleDragLeave(targetGIdx);

    if (!this.draggedMemberInfo) return;
    const src = this.draggedMemberInfo;

    if (src.gIdx === targetGIdx && !src.isUnassigned) return;

    let st;
    if (src.isUnassigned) {
      st = this.unassigned.splice(src.mIdx, 1)[0];
    } else {
      st = this.groups[src.gIdx].members.splice(src.mIdx, 1)[0];
    }

    if (st) {
      this.groups[targetGIdx].members.push(st);
    }

    this.draggedMemberInfo = null;
    this.selectedMember = null;
    this.saveActiveGroups();
  },

  // 渲染所有小組卡片與未分配區域
  renderGroups() {
    const container = document.getElementById('groupsDisplayArea');
    if (!container) return;

    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');

    if (this.groups.length === 0 && this.unassigned.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted padding-20" style="grid-column: 1 / -1;">
          💡 【${activeClass}】目前尚未進行分組。請點擊右上角「✏️ 編輯模式」開關後，即可開始自動隨機分組！
        </div>
      `;
      return;
    }

    let html = '';

    // 若有未分配學生的暫存區
    if (this.unassigned.length > 0) {
      html += `
        <div class="unassigned-container col-span-full">
          <div class="unassigned-title">
            <i class="fa-solid fa-user-clock"></i> 待分配學生區 (${this.unassigned.length}人)：
          </div>
          <div class="groups-container">
            ${this.unassigned.map((st, mIdx) => {
              const isSelected = this.selectedMember &&
                this.selectedMember.isUnassigned &&
                this.selectedMember.mIdx === mIdx;
              return `
                <div class="group-member-item ${isSelected ? 'selected-member' : ''} ${!this.isEditing ? 'locked' : ''}"
                     id="memberItem_-1_${mIdx}"
                     draggable="${this.isEditing}"
                     ${this.isEditing ? `
                       ondragstart="GroupsModule.handleDragStart(event, -1, ${mIdx}, true)"
                       onclick="GroupsModule.handleMemberClick(-1, ${mIdx}, true)"
                     ` : 'title="目前為 🔒 唯讀模式（點擊右上角「✏️ 編輯模式」進行調整）"'} >
                  <div class="member-info">
                    <span>#${st.number || '?'} <strong>${st.name}</strong></span>
                  </div>
                  ${this.isEditing ? '<span class="text-muted" style="font-size:0.8rem;">點擊移入組別</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // 各小組卡片
    html += this.groups.map((group, gIdx) => {
      return `
        <div class="group-card" id="groupCard_${gIdx}"
             ${this.isEditing ? `
               ondragover="GroupsModule.handleDragOver(event, ${gIdx})"
               ondragleave="GroupsModule.handleDragLeave(${gIdx})"
               ondrop="GroupsModule.handleDrop(event, ${gIdx})"
             ` : ''} >
          
          <div class="group-card-header">
            <div class="group-title-box">
              <span class="group-title" ${this.isEditing ? `title="點擊可修改組名" onclick="GroupsModule.renameGroup(${gIdx})"` : ''}>
                ${group.name} (${group.members.length}人) ${this.isEditing ? '<i class="fa-solid fa-pen-to-square" style="font-size:0.8rem; opacity:0.6;"></i>' : ''}
              </span>
            </div>
            ${this.isEditing ? `
              <div class="group-actions">
                <button class="btn btn-sm btn-outline" title="新增成員至本組" onclick="GroupsModule.addMemberToGroup(${gIdx})">
                  <i class="fa-solid fa-user-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" title="刪除此組" onclick="GroupsModule.deleteGroup(${gIdx})">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            ` : ''}
          </div>

          <div class="group-member-list" ${this.isEditing ? `onclick="GroupsModule.handleGroupClick(${gIdx})"` : ''}>
            ${group.members.length === 0 ? `
              <div class="text-center text-muted" style="padding:20px; font-size:0.9rem;">
                （空組別）${this.isEditing ? '<br>可將學生拖放至此處或點擊移入' : ''}
              </div>
            ` : group.members.map((st, mIdx) => {
              const isSelected = this.selectedMember &&
                !this.selectedMember.isUnassigned &&
                this.selectedMember.gIdx === gIdx &&
                this.selectedMember.mIdx === mIdx;

              return `
                <div class="group-member-item ${isSelected ? 'selected-member' : ''} ${!this.isEditing ? 'locked' : ''}"
                     id="memberItem_${gIdx}_${mIdx}"
                     draggable="${this.isEditing}"
                     ${this.isEditing ? `
                       ondragstart="GroupsModule.handleDragStart(event, ${gIdx}, ${mIdx}, false)"
                       ondragover="GroupsModule.handleMemberDragOver(event, ${gIdx}, ${mIdx})"
                       ondragleave="GroupsModule.handleMemberDragLeave(${gIdx}, ${mIdx})"
                       ondrop="GroupsModule.handleMemberDrop(event, ${gIdx}, ${mIdx})"
                       onclick="event.stopPropagation(); GroupsModule.handleMemberClick(${gIdx}, ${mIdx}, false)"
                     ` : 'title="目前為 🔒 唯讀防誤觸模式"'}>
                  
                  <div class="member-info">
                    <span>#${st.number || ''} <strong>${st.name}</strong></span>
                  </div>

                  <div class="member-controls">
                    <span class="status-tag ${st.isLeader ? 'active' : 'pending'}"
                          style="${this.isEditing ? 'cursor:pointer;' : ''}"
                          ${this.isEditing ? `title="點擊設定為本組唯一組長 (或點擊取消)" onclick="event.stopPropagation(); GroupsModule.toggleLeader(${gIdx}, ${mIdx})"` : ''}>
                      ${st.isLeader ? '組長 👑' : '成員'}
                    </span>
                    ${this.isEditing ? `
                      <button class="btn btn-sm btn-outline-danger" style="padding:2px 6px;"
                              title="從本組移出"
                              onclick="event.stopPropagation(); GroupsModule.removeMember(${gIdx}, ${mIdx})">
                        &times;
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }
};
