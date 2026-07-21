/**
 * 個人與分組競賽加分榜模組
 */
const PointsModule = {
  individualScores: {}, // studentId -> score
  teamGroups: [], // list of groups with teamScore

  init() {
    this.individualScores = StorageManager.get(StorageManager.KEYS.POINTS, {});
    this.teamGroups = StorageManager.get(StorageManager.KEYS.GROUPS, []);
    this.bindEvents();
    this.render();

    window.addEventListener('rosterUpdated', () => this.render());
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
      if (confirm('確定要將所有個人與分組點數歸零嗎？')) {
        this.individualScores = {};
        this.teamGroups.forEach(g => g.score = 0);
        StorageManager.set(StorageManager.KEYS.POINTS, this.individualScores);
        StorageManager.set(StorageManager.KEYS.GROUPS, this.teamGroups);
        this.render();
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
        '身份/備註': (teamInfo.isLeader ? '⭐ 組長 ' : '') + (st.note || '')
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
    text += `座號\t姓名\t組別\t個人得分\t小組得分\n`;
    students.forEach(st => {
      const pScore = this.individualScores[st.id] || 0;
      const tInfo = studentTeamMap[st.id] || { teamName: '-', teamScore: 0 };
      const tScore = tInfo.teamScore;
      text += `${st.number}\t${st.name}\t${tInfo.teamName}\t${pScore}分\t${tScore}分\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert(`🎉 已成功將【${activeClass}】加分榜總表文字複製至剪貼簿！\n\n${text}`);
    }).catch(() => {
      alert(`加分榜總表文字如下：\n\n${text}`);
    });
  },

  setTeamGroups(groups) {
    this.teamGroups = groups.map(g => ({ ...g, score: g.score || 0 }));
    StorageManager.set(StorageManager.KEYS.GROUPS, this.teamGroups);
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
      StorageManager.set(StorageManager.KEYS.GROUPS, this.teamGroups);
      AudioEngine.playPointSound();
      this.render();
    }
  },

  render() {
    this.renderIndividual();
    this.renderTeam();
  },

  renderIndividual() {
    const container = document.getElementById('studentPointsGrid');
    if (!container) return;

    const students = StorageManager.getActiveClassStudents();
    if (students.length === 0) {
      container.innerHTML = `<div class="text-center text-muted">請先在名條管理中建立學生名冊。</div>`;
      return;
    }

    container.innerHTML = students.map(st => {
      const score = this.individualScores[st.id] || 0;
      return `
        <div class="student-point-card">
          <div class="student-point-name">#${st.number} ${st.name}</div>
          <div class="student-point-score">${score > 0 ? '+' + score : score}</div>
          <div class="point-btn-group">
            <button class="btn btn-sm btn-outline-danger" onclick="PointsModule.changeStudentPoint('${st.id}', -1)">-1</button>
            <button class="btn btn-sm btn-accent" onclick="PointsModule.changeStudentPoint('${st.id}', 1)">+1</button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTeam() {
    const container = document.getElementById('teamPointsGrid');
    if (!container) return;

    if (this.teamGroups.length === 0) {
      container.innerHTML = `<div class="text-center text-muted">尚未建立分組，請至「隨機分組」點擊「同步至分組加分榜」。</div>`;
      return;
    }

    container.innerHTML = this.teamGroups.map((g, idx) => `
      <div class="team-point-card">
        <h3>${g.name}</h3>
        <div class="team-point-score">${g.score || 0}</div>
        <div class="point-btn-group">
          <button class="btn btn-lg btn-outline-danger" onclick="PointsModule.changeTeamPoint(${idx}, -1)">-1</button>
          <button class="btn btn-lg btn-accent" onclick="PointsModule.changeTeamPoint(${idx}, 1)">+1分</button>
        </div>
      </div>
    `).join('');
  }
};
