import { CheckinRecord } from '../types';

// 定義後端回傳的通用格式 (根據您的 App.tsx 推斷)
interface ApiResponse {
  results: {
    id: string;
    status: 'SUCCESS' | 'FAILED';
    message: string;
  }[];
}

// ----------------------------------------------------------------
// 1. 批量登入 (修復原本缺失的函式)
// ----------------------------------------------------------------
export const apiLoginBatch = async (
  baseUrl: string, 
  users: { id: string; password?: string }[]
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }
  
  return response.json();
};

// ----------------------------------------------------------------
// 2. 批量打卡 (修復原本缺失的函式)
// ----------------------------------------------------------------
export const apiCheckinBatch = async (
  baseUrl: string, 
  qrcode: string, 
  users: { id: string; password?: string }[]
): Promise<ApiResponse> => {
  const response = await fetch(`${baseUrl}/api/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrcode, users }),
  });

  if (!response.ok) {
    throw new Error(`Checkin failed: ${response.statusText}`);
  }

  return response.json();
};

// ----------------------------------------------------------------
// 3. 取得歷史紀錄 (新增的功能)
// ----------------------------------------------------------------

// 輔助函式：解析 HTML 字串
const parseHistoryHtml = (htmlString: string): CheckinRecord[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const records: CheckinRecord[] = [];

  // (A) 解析今日紀錄 (Table ID: GridViewRec)
  const todayTable = doc.getElementById('GridViewRec');
  if (todayTable) {
    const rows = todayTable.querySelectorAll('tr');
    // 跳過第一列 (Header)
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      // 確保欄位足夠且不是 "查無記錄"
      if (cells.length >= 3) {
        const text = cells[0].textContent?.trim() || '';
        if (!text.includes('今日查無記錄')) {
          records.push({
            courseName: text,
            section: cells[1].textContent?.trim() || '',
            time: cells[2].textContent?.trim() || '', // 登錄時間
            isToday: true
          });
        }
      }
    }
  }

  // (B) 解析歷史紀錄 (Table ID: MonthlyRecordRec)
  const historyTable = doc.getElementById('MonthlyRecordRec');
  if (historyTable) {
    const rows = historyTable.querySelectorAll('tr');
    // 跳過第一列 (Header)
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        records.push({
          courseName: cells[0].textContent?.trim() || '',
          section: cells[1].textContent?.trim() || '',
          time: cells[2].textContent?.trim() || '',
          isToday: false // 標記為歷史
        });
      }
    }
  }

  return records;
};

// 主要函式：呼叫 API 並處理回應
export const apiGetHistory = async (
  baseUrl: string, 
  user: { id: string; password?: string }
): Promise<CheckinRecord[]> => {
  try {
    // 注意：这里的 endpoint 要對應您後端 proxy 的路徑
    // 因為直接呼叫學校網址會有 CORS 問題
    const response = await fetch(`${baseUrl}/api/history`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        password: user.password,
        // 如果您的後端是通用 Proxy，可能需要傳這個參數
        targetUrl: 'https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx'
      })
    });

    if (!response.ok) throw new Error('Network response was not ok');

    // --- 自動判斷回傳的是 HTML 還是 JSON ---
    const contentType = response.headers.get("content-type");
    let html = "";
    
    if (contentType && contentType.includes("application/json")) {
        // 如果後端回傳 JSON (例如: { "html": "<!DOCTYPE...", "status": 200 })
        const data = await response.json();
        // 嘗試從常見的欄位名稱抓取 HTML
        html = data.html || data.body || data.data || ""; 
    } else {
        // 如果後端直接回傳 HTML 文字
        html = await response.text();
    }

    // 呼叫解析器
    return parseHistoryHtml(html);

  } catch (error) {
    console.error("Fetch history failed", error);
    // 發生錯誤時回傳空陣列，避免 APP 崩潰
    return [];
  }
};