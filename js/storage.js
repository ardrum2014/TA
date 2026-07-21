/**
 * LocalStorage 本機資料持久化與資料庫管理員
 */
const StorageManager = {
  KEYS: {
    CLASSES: 'cozy_teacher_classes',
    ACTIVE_CLASS: 'cozy_teacher_active_class',
    SCHEDULE: 'cozy_teacher_schedule',
    GROUPS: 'cozy_teacher_groups',
    POINTS: 'cozy_teacher_points',
    HOMEWORK: 'cozy_teacher_homework',
    PROGRESS: 'cozy_teacher_progress',
    SEATING: 'cozy_teacher_seating',
    THEME: 'cozy_teacher_theme',
    TIMETABLE: 'cozy_teacher_timetable'
  },

  // 預設教師個人課表 (標準中學8節課次與預設課表結構)
  getDefaultTimetable() {
    return {
      periods: [
        { period: 1, name: '第一節', startTime: '08:10', endTime: '09:00' },
        { period: 2, name: '第二節', startTime: '09:10', endTime: '10:00' },
        { period: 3, name: '第三節', startTime: '10:10', endTime: '11:00' },
        { period: 4, name: '第四節', startTime: '11:10', endTime: '12:00' },
        { period: 5, name: '第五節', startTime: '13:10', endTime: '14:00' },
        { period: 6, name: '第六節', startTime: '14:10', endTime: '15:00' },
        { period: 7, name: '第七節', startTime: '15:10', endTime: '16:00' },
        { period: 8, name: '第八節', startTime: '16:10', endTime: '17:00' }
      ],
      grid: {
        "1_1": { className: "501班", subject: "生活科技", location: "生科教室", substitute: "", substituteNote: "" },
        "1_2": { className: "501班", subject: "生活科技", location: "生科教室", substitute: "", substituteNote: "" },
        "1_3": { className: "401班", subject: "資訊科技", location: "電腦教室", substitute: "", substituteNote: "" },
        "2_1": { className: "402班", subject: "生活科技", location: "生科教室", substitute: "", substituteNote: "" },
        "2_2": { className: "402班", subject: "生活科技", location: "生科教室", substitute: "", substituteNote: "" },
        "3_5": { className: "501班", subject: "班會與導師時間", location: "501教室", substitute: "", substituteNote: "" },
        "4_3": { className: "401班", subject: "生活科技", location: "生科教室", substitute: "由張老師代課", substituteNote: "教務處公假代課" },
        "5_1": { className: "501班", subject: "生活科技", location: "生科教室", substitute: "", substituteNote: "" }
      }
    };
  },

  // 取得民國紀年格式檔名時間戳 (格式如: 115.07.21.1110)
  getFormattedTimestamp() {
    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${rocYear}.${mm}.${dd}.${hh}${min}`;
  },

  // 取得儲存資料
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`StorageManager Error reading ${key}:`, e);
      return defaultValue;
    }
  },

  // 寫入儲存資料
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`StorageManager Error writing ${key}:`, e);
    }
  },

  // 預設示範班級與學生資料
  getDefaultClasses() {
    return {
      '501班': [
        { id: '1', number: 1, name: '張小明', note: '男' },
        { id: '2', number: 2, name: '李小華', note: '女' },
        { id: '3', number: 3, name: '王大同', note: '男' },
        { id: '4', number: 4, name: '陳雅婷', note: '女' },
        { id: '5', number: 5, name: '林志豪', note: '男' },
        { id: '6', number: 6, name: '黃美玲', note: '女' },
        { id: '7', number: 7, name: '吳家豪', note: '男' },
        { id: '8', number: 8, name: '蔡欣怡', note: '女' },
        { id: '9', number: 9, name: '許建宏', note: '男' },
        { id: '10', number: 10, name: '鄭淑芬', note: '女' }
      ]
    };
  },

  // 取得當前班級學生名單
  getActiveClassStudents() {
    const classes = this.get(this.KEYS.CLASSES, this.getDefaultClasses());
    const activeClassName = this.get(this.KEYS.ACTIVE_CLASS, '501班');
    return classes[activeClassName] || [];
  },

  // 萬能智慧型 Excel / CSV / HTML 名冊解析器 (完美相容南寧高中公假系統、.xlsx, .xls, .csv 與全校多班級)
  parseMultiClassExcelFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === 'undefined') {
        return reject(new Error('XLSX 解析庫未載入，請重新整理網頁！'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          let workbook = null;
          const classResultMap = {}; // className -> Array of { id, number, name, note }
          const activeClassFallback = this.get(this.KEYS.ACTIVE_CLASS, '401班');

          // 1. 嘗試 ArrayBuffer, BinaryString, Text 多重格式相容性讀取
          try {
            const arr = new Uint8Array(data);
            workbook = XLSX.read(arr, { type: 'array', cellDates: true, raw: false });
          } catch (e1) {
            try {
              workbook = XLSX.read(data, { type: 'binary', cellDates: true });
            } catch (e2) {
              try {
                const str = new TextDecoder('utf-8').decode(data);
                workbook = XLSX.read(str, { type: 'string' });
              } catch (e3) {
                console.warn('XLSX.read failed, trying plain text fallback...');
              }
            }
          }

          if (workbook && workbook.SheetNames && workbook.SheetNames.length > 0) {
            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              if (!worksheet) return;

              // 使用 2D Matrix (header: 1) 直接讀取，能避開任何標頭欄位比對失效
              const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
              if (!matrix || matrix.length === 0) return;

              let nameIdx = -1, classIdx = -1, numberIdx = -1, noteIdx = -1;
              let startRow = 0;

              // 搜尋表頭列
              for (let r = 0; r < Math.min(10, matrix.length); r++) {
                const row = matrix[r];
                if (!Array.isArray(row)) continue;

                row.forEach((cell, c) => {
                  const cellStr = cell !== undefined && cell !== null ? cell.toString().trim().replace(/[\s\uFEFF\xA0]+/g, '').toLowerCase() : '';
                  if (['姓名', '學生姓名', 'name', '學生'].includes(cellStr)) nameIdx = c;
                  if (['班級', '班別', '年班', '年級', 'class'].includes(cellStr)) classIdx = c;
                  if (['座號', '號碼', '號', 'no', 'no.'].includes(cellStr)) numberIdx = c;
                  if (['學號', '性別', '備註', '性別/備註'].includes(cellStr)) noteIdx = c;
                });

                if (nameIdx !== -1) {
                  startRow = r + 1;
                  break;
                }
              }

              // 若未找到標題列，依據南寧公假系統對齊：Col 0(學號), Col 1(班級), Col 2(座號), Col 3(姓名)
              if (nameIdx === -1) {
                noteIdx = 0; classIdx = 1; numberIdx = 2; nameIdx = 3;
                const firstRowStr = matrix[0] ? JSON.stringify(matrix[0]) : '';
                startRow = (firstRowStr.includes('學號') || firstRowStr.includes('姓名')) ? 1 : 0;
              }

              for (let r = startRow; r < matrix.length; r++) {
                const row = matrix[r];
                if (!Array.isArray(row)) continue;

                const name = row[nameIdx] !== undefined && row[nameIdx] !== null ? row[nameIdx].toString().trim() : '';
                if (!name || name === '姓名' || name === '學生姓名') continue;

                let rawClass = row[classIdx] !== undefined && row[classIdx] !== null ? row[classIdx].toString().trim() : '';
                let rawNumber = row[numberIdx] !== undefined && row[numberIdx] !== null ? row[numberIdx].toString().trim() : '';
                let note = row[noteIdx] !== undefined && row[noteIdx] !== null ? row[noteIdx].toString().trim() : '';

                let className = rawClass || (sheetName && !['Sheet1', '工作表1', 'Table1'].includes(sheetName) ? sheetName : activeClassFallback);
                if (!className.endsWith('班') && !isNaN(parseInt(className, 10))) {
                  className = className + '班';
                }

                let number = parseInt(rawNumber, 10);
                if (isNaN(number)) number = r;

                if (!classResultMap[className]) classResultMap[className] = [];

                classResultMap[className].push({
                  id: (Date.now() + Math.random() * 1000000).toString(),
                  number: number,
                  name: name,
                  note: note
                });
              }
            });
          }

          // 2. 如果方法 1 無結果，執行 HTML/CSV 文字剖析備援 (防公假系統導出 HTML 檔名改成 xlsx)
          if (Object.keys(classResultMap).length === 0) {
            let text = '';
            try { text = new TextDecoder('utf-8').decode(data); } catch(err) { text = ''; }

            if (text && (text.includes('<tr') || text.includes(',') || text.includes('\t'))) {
              if (text.includes('<tr')) {
                const doc = new DOMParser().parseFromString(text, 'text/html');
                const rows = doc.querySelectorAll('tr');

                rows.forEach((tr, r) => {
                  const tds = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim());
                  if (tds.length >= 3) {
                    if (tds.includes('姓名') || tds.includes('學號')) return;
                    const name = tds[3] || tds[2] || '';
                    if (!name) return;
                    const rawClass = tds[1] || '401';
                    const rawNum = tds[2] || '1';
                    const note = tds[0] || '';

                    let className = rawClass.endsWith('班') ? rawClass : rawClass + '班';
                    if (!classResultMap[className]) classResultMap[className] = [];
                    classResultMap[className].push({
                      id: (Date.now() + Math.random() * 1000000).toString(),
                      number: parseInt(rawNum, 10) || (r + 1),
                      name: name,
                      note: note
                    });
                  }
                });
              }
            }
          }

          if (Object.keys(classResultMap).length === 0) {
            return reject(new Error('未能從檔案中成功找到學生姓名資料，請確認檔案是否有內容。'));
          }

          resolve(classResultMap);
        } catch (err) {
          console.error('parseMultiClassExcelFile error:', err);
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  // 舊相容函式
  parseExcelFile(file) {
    return this.parseMultiClassExcelFile(file);
  },

  // 產生並下載 Excel 檔
  exportExcel(data, fileName = 'download.xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, fileName);
  }
};
