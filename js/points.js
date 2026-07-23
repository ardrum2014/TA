/**
 * 個人與分組競賽加分榜模組 (支援班級切換、分組競賽與個人加分同步連動)
 */
const PointsModule = {
  individualScores: {}, // studentId -> score
  groupsMap: {}, // className -> list of groups
  teamGroups: [], // list of groups for the active class

  init() {
    this.loadActiveGroupsAndScores();
    this.bindEvents();
    this.render();

    window.addEventListener('rosterUpdated', () => {
      this.loadActiveGroupsAndScores();
      this.render();
    });
  },

  loadActiveGroupsAndScores() {
    this.individualScores = StorageManager.get(StorageManager.KEYS.POINTS, {});
    if (Array.isArray(this.individualScores) || typeof this.individualScores !== 'object' || this.individualScores === null) {
      this.individualScores = {};
    }
    this.groupsMap = StorageManager.get(StorageManager.KEYS.GROUPS, {});
    if (Array.isArray(this.groupsMap) || typeof this.groupsMap !== 'object' || this.groupsMap === null) {
      this.groupsMap = {};
    }
    
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.teamGroups = this.groupsMap[activeClass] || [];
  },

  saveTeamScores() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.groupsMap = StorageManager.get(StorageManager.KEYS.GROUPS, {});
    if (Array.isArray(this.groupsMap) || typeof this.groupsMap !== 'object' || this.groupsMap === null) {
      this.groupsMap = {};
    }
    this.groupsMap[activeClass] = this.teamGroups;
    StorageManager.set(StorageManager.KEYS.GROUPS, this.groupsMap);
  },

  bindEvents() {
    document.getElementById('viewIndividualPointsBtn')?.addEventListener('click', (e) => {
      e.target.classList.add('active');
      document.getElementById('viewTeamPointsBtn').classList.remove('active');
      document.getElementById('individualPointsPanel').classList.remove('hidden');
      document.getElementById('teamPointsPanel').classList.add('hidden');
    });

    document.getElementById('viewTeamPointsBtn')?.addEventListener('click', (e) => {
      e.target.classList.add('active');
      document.getElementById('viewIndividualPointsBtn').classList.remove('active');
      document.getElementById('teamPointsPanel').classList.remove('hidden');
      document.getElementById('individualPointsPanel').classList.add('hidden');
    });

    // 匯出加分 Excel 檔
    document.getElementById('exportPointsExcelBtn')?.addEventListener('click', () => {
      this.exportExcel();
    });

    // ☁️ 傳送至 Google 雲端硬碟
    document.getElementById('saveToCloudBtn')?.addEventListener('click', () => {
      this.saveToCloudDrive();
    });

    // 複製加分結果文字
    document.getElementById('copyPointsTextBtn')?.addEventListener('click', () => {
      this.copyPointsText();
    });

    document.getElementById('resetPointsBtn')?.addEventListener('click', () => {
      const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
      
      if (confirm(`❓ 您是否要將【當前班級（${activeClass}）】的個人與分組點數歸零？\n\n（注意：這只會重設目前選擇的班級，其他班級不受影響）`)) {
        // 1. 僅歸零當前班級
        const activeStudents = StorageManager.getActiveClassStudents();
        activeStudents.forEach(st => {
          delete this.individualScores[st.id]; // 從個人得分中刪除當前班級學生的分數
        });
        this.teamGroups.forEach(g => g.score = 0); // 歸零當前班級的小組分數
        
        StorageManager.set(StorageManager.KEYS.POINTS, this.individualScores);
        this.saveTeamScores();
        this.render();
        alert(`已成功歸零【${activeClass}】的個人與分組分數！`);
      } else {
        // 如果按取消，詢問是否要歸零「所有班級」
        if (confirm(`❓ 那麼，您是否要將【所有班級】的個人與分組點數「全部清空歸零」？\n\n（警告：這將會清除系統中所有班級的歷史成績，且無法還原！）`)) {
          // 2. 歸零全數班級數據
          this.individualScores = {}; // 清空所有個人分數
          
          // 歸零所有班級的小組分數
          this.groupsMap = StorageManager.get(StorageManager.KEYS.GROUPS, {});
          if (typeof this.groupsMap === 'object' && this.groupsMap !== null) {
            for (let cls in this.groupsMap) {
              if (Array.isArray(this.groupsMap[cls])) {
                this.groupsMap[cls].forEach(g => g.score = 0);
              }
            }
          }
          this.teamGroups.forEach(g => g.score = 0); // 歸零當前班級快取
          
          StorageManager.set(StorageManager.KEYS.POINTS, this.individualScores);
          StorageManager.set(StorageManager.KEYS.GROUPS, this.groupsMap);
          this.render();
          alert('已成功歸零【全數班級】的所有個人與分組分數！');
        }
      }
    });
  },

  // 匯出單頁整合 Excel (合併個人得分、小組得分與總得分)
  exportExcel() {
    const students = StorageManager.getActiveClassStudents();
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');

    // 建立學生與所屬小組對照表
    const studentTeamMap = {};
    if (this.teamGroups && this.teamGroups.length > 0) {
      this.teamGroups.forEach(grp => {
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

    const mergedData = students.map(st => {
      const personalScore = this.individualScores[st.id] || 0;
      const teamInfo = studentTeamMap[st.id] || { teamName: '（未分組）', teamScore: 0, isLeader: false };
      const teamScore = teamInfo.teamScore;

      return {
        '班級': activeClass,
        '座號': st.number,
        '姓名': st.name,
        '所屬組別': teamInfo.teamName,
        '個人得分': personalScore,
        '小組得分': teamScore,
        '總累計得分': personalScore + teamScore,
        '身份/備註': (teamInfo.isLeader ? '⭐組長 ' : '') + (st.remarks || st.note || '')
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(wb, ws, '課堂加分榜總表');

    const timestamp = StorageManager.getFormattedTimestamp();
    XLSX.writeFile(wb, `${timestamp}_${activeClass}_課堂加分榜總表.xlsx`);
  },

  // 傳送至 Google 雲端硬碟
  saveToCloudDrive() {
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');
    this.exportExcel();
    setTimeout(() => {
      if (confirm(`已為您下載【${activeClass}_課堂加分榜總表.xlsx】！\n\n是否立即為您開啟 Google 雲端硬碟進行一鍵上傳/拖放？`)) {
        window.open('https://drive.google.com/drive/my-drive', '_blank');
      }
    }, 400);
  },

  // 複製排行榜文字
  copyPointsText() {
    const students = StorageManager.getActiveClassStudents();
    const activeClass = StorageManager.get(StorageManager.KEYS.ACTIVE_CLASS, '401班');

    const studentTeamMap = {};
    if (this.teamGroups && this.teamGroups.length > 0) {
      this.teamGroups.forEach(grp => {
        const teamName = grp.name || '未命名小組';
        const teamScore = grp.score || 0;
        if (grp.members && Array.isArray(grp.members)) {
          grp.members.forEach(m => {
            studentTeamMap[m.id] = { teamName, teamScore };
          });
        }
      });
    }

    let text = `🏆【${activeClass} 課堂加分榜總表】\n\n`;
    text += `座號\t姓名\t組別\t個人得分\t小組得分\t總得分\n`;
    students.forEach(st => {
      const pScore = this.individualScores[st.id] || 0;
      const tInfo = studentTeamMap[st.id] || { teamName: '-', teamScore: 0 };
      const tScore = tInfo.teamScore;
      text += `${st.number}\t${st.name}\t${tInfo.teamName}\t${pScore}分\t${tScore}分\t${pScore + tScore}分\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert(`🎉 已成功將【${activeClass}】加分榜總表文字複製至剪貼簿！\n\n${text}`);
    }).catch(() => {
      alert(`加分榜總表文字如下：\n\n${text}`);
    });
  },

  setTeamGroups(groups) {
    this.teamGroups = groups.map(g => ({ ...g, score: g.score || 0 }));
    this.saveTeamScores();
    this.render();
  },

  changeStudentPoint(stId, delta) {
    this.individualScores[stId] = (this.individualScores[stId] || 0) + delta;
    StorageManager.set(StorageManager.KEYS.POINTS, this.individualScores);
    AudioEngine.playPointSound();
    this.render();
  },

  changeTeamPoint(idx, delta) {
    if (this.teamGroups[idx]) {
      this.teamGroups[idx].score = (this.teamGroups[idx].score || 0) + delta;
      this.saveTeamScores();
      AudioEngine.playPointSound();
      this.render();
    }
  },

  sortMode: 'default', // 'default' | 'rank'

  toggleSortMode(mode) {
    this.sortMode = mode;
    this.render();
  },

  render() {
    this.renderIndividual();
    this.renderTeam();
  },

  renderIndividual() {
    const container = document.getElementById('studentPointsGrid');
    if (!container) return;

    let students = StorageManager.getActiveClassStudents().map(st => ({
      ...st,
      score: this.individualScores[st.id] || 0
    }));

    if (students.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 20px;">請先在名條管理中建立學生名冊。</div>`;
      return;
    }

    // 計算名次資訊 (最高分起算)
    const rankedStudents = [...students].sort((a, b) => b.score - a.score || a.number - b.number);
    const rankMap = {};
    let currentRank = 1;
    rankedStudents.forEach((st, idx) => {
      if (idx > 0 && st.score < rankedStudents[idx - 1].score) {
        currentRank = idx + 1;
      }
      rankMap[st.id] = currentRank;
    });

    if (this.sortMode === 'rank') {
      students = rankedStudents;
    }

    const getRankBadge = (rank, score) => {
      if (score === 0) return `<span class="badge badge-secondary" style="font-size:0.75rem;">無加分</span>`;
      if (rank === 1) return `<span class="badge" style="background:#ffd700; color:#4a3e3d; font-weight:bold; font-size:0.8rem;"><i class="fa-solid fa-crown"></i> 🥇 第 1 名</span>`;
      if (rank === 2) return `<span class="badge" style="background:#c0c0c0; color:#222; font-weight:bold; font-size:0.8rem;">🥈 第 2 名</span>`;
      if (rank === 3) return `<span class="badge" style="background:#cd7f32; color:#fff; font-weight:bold; font-size:0.8rem;">🥉 第 3 名</span>`;
      return `<span class="badge badge-outline" style="font-size:0.78rem;">第 ${rank} 名</span>`;
    };

    let html = `
      <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: var(--bg-secondary); padding: 8px 14px; border-radius: 8px;">
        <span style="font-size: 0.9rem; font-weight: bold; color: var(--color-espresso);">
          <i class="fa-solid fa-ranking-star"></i> 個人分數排序模式：
        </span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm ${this.sortMode === 'default' ? 'btn-primary' : 'btn-outline'}" onclick="PointsModule.toggleSortMode('default')">🔢 依座號順序</button>
          <button class="btn btn-sm ${this.sortMode === 'rank' ? 'btn-primary' : 'btn-outline'}" onclick="PointsModule.toggleSortMode('rank')">🏆 依得分名次排行榜</button>
        </div>
      </div>
    `;

    html += students.map(st => {
      const score = st.score;
      const rank = rankMap[st.id];
      const isTop3 = score > 0 && rank <= 3;

      return `
        <div class="student-point-card" style="${isTop3 ? 'border: 2px solid var(--color-amber); background: var(--bg-card);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:4px;">
            <div class="student-point-name">#${st.number} ${st.name}</div>
            ${getRankBadge(rank, score)}
          </div>
          <div class="student-point-score">${score > 0 ? '+' + score : score}</div>
          <div class="point-btn-group">
            <button class="btn btn-sm btn-outline-danger" onclick="PointsModule.changeStudentPoint('${st.id}', -1)">-1</button>
            <button class="btn btn-sm btn-accent" onclick="PointsModule.changeStudentPoint('${st.id}', 1)">+1</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  renderTeam() {
    const container = document.getElementById('teamPointsGrid');
    if (!container) return;

    if (this.teamGroups.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 20px;">尚未建立分組，請至「隨機分組」點擊「同步至分組加分榜」。</div>`;
      return;
    }

    let groups = this.teamGroups.map((g, idx) => ({ ...g, originalIdx: idx }));

    // 計算組別名次
    const rankedGroups = [...groups].sort((a, b) => (b.score || 0) - (a.score || 0));
    const rankMap = {};
    let currentRank = 1;
    rankedGroups.forEach((g, idx) => {
      if (idx > 0 && (g.score || 0) < (rankedGroups[idx - 1].score || 0)) {
        currentRank = idx + 1;
      }
      rankMap[g.originalIdx] = currentRank;
    });

    if (this.sortMode === 'rank') {
      groups = rankedGroups;
    }

    const getTeamRankBadge = (rank, score) => {
      if (!score || score === 0) return `<span class="badge badge-secondary" style="font-size:0.75rem;">無加分</span>`;
      if (rank === 1) return `<span class="badge" style="background:#ffd700; color:#4a3e3d; font-weight:bold; font-size:0.8rem;"><i class="fa-solid fa-crown"></i> 🥇 第 1 名</span>`;
      if (rank === 2) return `<span class="badge" style="background:#c0c0c0; color:#222; font-weight:bold; font-size:0.8rem;">🥈 第 2 名</span>`;
      if (rank === 3) return `<span class="badge" style="background:#cd7f32; color:#fff; font-weight:bold; font-size:0.8rem;">🥉 第 3 名</span>`;
      return `<span class="badge badge-outline" style="font-size:0.78rem;">第 ${rank} 名</span>`;
    };

    let html = `
      <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: var(--bg-secondary); padding: 8px 14px; border-radius: 8px;">
        <span style="font-size: 0.9rem; font-weight: bold; color: var(--color-espresso);">
          <i class="fa-solid fa-ranking-star"></i> 小組得分排序模式：
        </span>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm ${this.sortMode === 'default' ? 'btn-primary' : 'btn-outline'}" onclick="PointsModule.toggleSortMode('default')">🔢 依預設組別順序</button>
          <button class="btn btn-sm ${this.sortMode === 'rank' ? 'btn-primary' : 'btn-outline'}" onclick="PointsModule.toggleSortMode('rank')">🏆 依得分名次排行榜</button>
        </div>
      </div>
    `;

    html += groups.map(g => {
      const rank = rankMap[g.originalIdx];
      const isTop3 = g.score > 0 && rank <= 3;
      return `
        <div class="team-point-card" style="${isTop3 ? 'border: 2px solid var(--color-amber); background: var(--bg-card);' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:4px;">
            <h3 style="margin:0;">${g.name}</h3>
            ${getTeamRankBadge(rank, g.score)}
          </div>
          <div class="team-point-score">${g.score || 0}</div>
          <div class="point-btn-group">
            <button class="btn btn-lg btn-outline-danger" onclick="PointsModule.changeTeamPoint(${g.originalIdx}, -1)">-1</button>
            <button class="btn btn-lg btn-accent" onclick="PointsModule.changeTeamPoint(${g.originalIdx}, 1)">+1分</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }
};
