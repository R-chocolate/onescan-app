import { CheckinRecord } from '../types';

// 定義後端回傳的通用格式
interface ApiResponse {
  status: string; // 您原本的後端回傳的是 "status": "success"
  results: {
    id: string;
    status: 'SUCCESS' | 'FAILED';
    message: string;
  }[];
}

// 1. 批量登入 (改回配合您的 login_batch)
export const apiLoginBatch = async (
  baseUrl: string, 
  users: { id: string; password?: string }[]
): Promise<ApiResponse> => {
  // [修正] 路徑改回 login_batch
  const response = await fetch(`${baseUrl}/api/login_batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }
  
  return response.json();
};

// 2. 批量打卡 (改回配合您的 checkin_batch)
export const apiCheckinBatch = async (
  baseUrl: string, 
  qrcode: string, 
  users: { id: string; password?: string }[]
): Promise<ApiResponse> => {
  // [修正] 路徑改回 checkin_batch
  const response = await fetch(`${baseUrl}/api/checkin_batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // [修正] 參數名稱改回 qr_data
    body: JSON.stringify({ 
        qr_data: qrcode, 
        users 
    }),
  });

  if (!response.ok) {
    throw new Error(`Checkin failed: ${response.statusText}`);
  }

  return response.json();
};

// 3. 取得歷史紀錄
// ⚠️ 注意：因為您現在不想動後端，所以您的後端目前「沒有」這個 /api/history 的功能
// 這個函式呼叫會失敗 (404)，這是正常的。
// 等之後您有空更新後端 main.py，這個功能就會自動生效。
const parseHistoryHtml = (htmlString: string): CheckinRecord[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const records: CheckinRecord[] = [];
  
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
    const html = await response.text();
    return parseHistoryHtml(html);
  } catch (error) {
    console.warn("Fetch history failed (Backend route likely missing)");
    return [];
  }
};