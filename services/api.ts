// --- 這是完整正確的 src/services/api.ts ---

import { CheckinRecord } from '../types';

// 定義後端回傳的通用格式
interface ApiResponse {
  results: {
    id: string;
    status: 'SUCCESS' | 'FAILED';
    message: string;
  }[];
}

// ----------------------------------------------------------------
// 1. 批量登入 (這是您可能不小心刪掉的部分)
// ----------------------------------------------------------------
export const apiLoginBatch = async (
  baseUrl: string, 
  users: { id: string; password?: string }[]
): Promise<ApiResponse> => {
  // 注意：這裡是用 fetch 發送請求
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
// 2. 批量打卡 (這是您可能不小心刪掉的部分)
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
// 3. 取得歷史紀錄 (這是新加的部分)
// ----------------------------------------------------------------

// 輔助函式：解析 HTML
const parseHistoryHtml = (htmlString: string): CheckinRecord[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const records: CheckinRecord[] = [];

  // 解析今日紀錄
  const todayTable = doc.getElementById('GridViewRec');
  if (todayTable) {
    const rows = todayTable.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        const text = cells[0].textContent?.trim() || '';
        if (!text.includes('今日查無記錄')) {
          records.push({
            courseName: text,
            section: cells[1].textContent?.trim() || '',
            time: cells[2].textContent?.trim() || '',
            isToday: true
          });
        }
      }
    }
  }

  // 解析歷史紀錄
  const historyTable = doc.getElementById('MonthlyRecordRec');
  if (historyTable) {
    const rows = historyTable.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length >= 3) {
        records.push({
          courseName: cells[0].textContent?.trim() || '',
          section: cells[1].textContent?.trim() || '',
          time: cells[2].textContent?.trim() || '',
          isToday: false
        });
      }
    }
  }

  return records;
};

// 主要函式：取得紀錄
export const apiGetHistory = async (
  baseUrl: string, 
  user: { id: string; password?: string }
): Promise<CheckinRecord[]> => {
  try {
    const response = await fetch(`${baseUrl}/api/history`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        password: user.password,
        targetUrl: 'https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx'
      })
    });

    if (!response.ok) throw new Error('Network response was not ok');

    // 直接讀取 HTML
    const html = await response.text();
    return parseHistoryHtml(html);

  } catch (error) {
    console.error("Fetch history failed", error);
    return [];
  }
};