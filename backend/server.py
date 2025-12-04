import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import datetime
import urllib.parse as urlparse
import urllib3
from bs4 import BeautifulSoup

# 關閉 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)

GLOBAL_SESSIONS = {} 

# ================= CONFIG =================
SCHOOL_LOGIN_URL = "https://signin.fcu.edu.tw/clockin/login.aspx"
BASE_HOST = "https://signin.fcu.edu.tw"

APP_POST_HEADERS = {
    'Host': 'signin.fcu.edu.tw',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-A156E Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36',
    'Origin': 'null',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'X-Requested-With': 'com.fcuapp.app',   
    'Sec-Fetch-Site': 'none',             
    'Sec-Fetch-Mode': 'navigate',          
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
}

APP_GET_HEADERS = APP_POST_HEADERS.copy()
if 'Content-Type' in APP_GET_HEADERS: del APP_GET_HEADERS['Content-Type']
if 'Origin' in APP_GET_HEADERS: del APP_GET_HEADERS['Origin']

# 取得台灣時間 (用於跟學校紀錄比對)
def get_taiwan_time():
    return datetime.datetime.utcnow() + datetime.timedelta(hours=8)

# [精準解析] 根據您提供的 HTML 結構抓取最新時間
def _parse_latest_time_from_html(html_content):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        found_times = []
        
        # ---------------------------------------------------
        # 1. 檢查上方表格 (id="GridViewRec") - 通常放今日紀錄
        # ---------------------------------------------------
        table_today = soup.find('table', id='GridViewRec')
        if table_today:
            # 跳過標題列 (index 0)，從 index 1 開始
            rows = table_today.find_all('tr')
            for row in rows[1:]:
                cells = row.find_all('td')
                # 確保這一行有資料，而不是 "今日查無記錄" (它只有一個 td 且 colspan=3)
                if len(cells) >= 3:
                    # 時間在第3欄 (index 2)
                    time_str = cells[2].text.strip()
                    try:
                        dt = datetime.datetime.strptime(time_str, '%Y/%m/%d %H:%M:%S')
                        found_times.append(dt)
                    except ValueError:
                        pass # 格式不對就跳過

        # ---------------------------------------------------
        # 2. 檢查下方表格 (id="MonthlyRecordRec") - 歷史紀錄
        # ---------------------------------------------------
        table_history = soup.find('table', id='MonthlyRecordRec')
        if table_history:
            rows = table_history.find_all('tr')
            # 我們只需要檢查第一筆資料 (rows[1])，因為它是最新的
            if len(rows) > 1:
                first_data_row = rows[1]
                cells = first_data_row.find_all('td')
                if len(cells) >= 3:
                    time_str = cells[2].text.strip() # 第3欄
                    try:
                        dt = datetime.datetime.strptime(time_str, '%Y/%m/%d %H:%M:%S')
                        found_times.append(dt)
                    except ValueError:
                        pass

        # ---------------------------------------------------
        # 3. 回傳找到的最新時間
        # ---------------------------------------------------
        if found_times:
            return max(found_times) # 回傳當中最新的時間
            
        return None

    except Exception as e:
        print(f"解析 HTML 發生錯誤: {e}")
        return None

def _perform_login_checkin(user_id: str, password: str, qr_data: str) -> requests.Session | None:
    s = requests.Session()
    real_major = ''
    real_minor = ''
    real_uuid = '' 

    if qr_data:
        if "http" not in qr_data and len(qr_data) > 50:
            real_uuid = qr_data
        else:
            try:
                parsed = urlparse.urlparse(qr_data)
                params = urlparse.parse_qs(parsed.query)
                real_major = params.get('major', [''])[0]
                real_minor = params.get('minor', [''])[0]
            except:
                pass

    try:
        s.get(SCHOOL_LOGIN_URL, headers=APP_GET_HEADERS, timeout=5, verify=False)
        payload_str = f"username={user_id}&password={password}&appversion=qr&uuid={real_uuid}&major={real_major}&minor={real_minor}&page=cls"
        
        response = s.post(SCHOOL_LOGIN_URL, headers=APP_POST_HEADERS, data=payload_str, allow_redirects=False, timeout=8, verify=False)
        
        if response.status_code == 302:
            redirect_path = response.headers.get('Location')
            # 如果是單純登入模式
            if not qr_data: 
                return s 
            
            # 打卡模式：順著轉址走，完成流程
            target_url = BASE_HOST + redirect_path if redirect_path.startswith('/') else redirect_path
            s.get(target_url, headers=APP_GET_HEADERS, verify=False)
            
            return s
            
        return None
    except:
        return None

# ================= ROUTES =================

@app.route('/api/login_batch', methods=['POST'])
def handle_login_batch():
    data = request.json
    users = data.get('users', [])
    results = []
    for u in users:
        sess = _perform_login_checkin(u['id'], u['password'], "")
        if sess:
            GLOBAL_SESSIONS[u['id']] = {'session': sess, 'expiry': time.time() + 1800}
            results.append({"id": u['id'], "status": "SUCCESS", "message": "登入成功"})
        else:
            results.append({"id": u['id'], "status": "FAILED", "message": "登入失敗"})
    return jsonify({"status": "success", "results": results})

@app.route('/api/checkin_batch', methods=['POST'])
def handle_checkin_batch():
    data = request.json
    qr_data = data.get('qr_data', '') 
    users = data.get('users', [])
    results = []
    
    RECORD_URL = "https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx"
    
    for u in users:
        uid = u['id']
        pwd = u['password']
        
        # 1. 紀錄【發送請求前】的時間 (台灣時間)
        request_start_time = get_taiwan_time()
        
        # 2. 執行打卡
        sess = _perform_login_checkin(uid, pwd, qr_data)
        
        if sess:
            # 3. 打卡請求結束，立刻抓取歷史紀錄驗證
            try:
                # 稍微等待 0.5 秒讓學校資料庫寫入 (保險起見)
                time.sleep(0.5) 
                
                rec_resp = sess.get(RECORD_URL, headers=APP_GET_HEADERS, verify=False, timeout=10)
                
                # 4. 解析 HTML 找出最新時間
                latest_record_time = _parse_latest_time_from_html(rec_resp.text)
                
                if latest_record_time:
                    # 5. [核心邏輯] 比對時間差
                    # 計算 (最新紀錄時間 - 發送請求時間)
                    time_diff = (latest_record_time - request_start_time).total_seconds()
                    
                    print(f"[{uid}] RequestTime: {request_start_time}, RecordTime: {latest_record_time}, Diff: {time_diff}s")

                    # 判定標準：
                    # 只要兩者相差在 30秒 (或 -30秒) 內，都視為同一筆操作
                    # (有些系統時間可能會稍微快一點或慢一點，取絕對值最保險)
                    if abs(time_diff) <= 15:
                        GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
                        results.append({"id": uid, "status": "SUCCESS", "message": f"打卡成功 (時間差 {int(time_diff)}秒)"})
                    else:
                        # 雖然有紀錄，但時間對不上 (可能是抓到早上的舊紀錄)
                        results.append({"id": uid, "status": "FAILED", "message": f"打卡未成功 (最新紀錄為 {latest_record_time})"})
                else:
                    # 頁面抓到了但沒解析到任何時間 (可能是沒紀錄)
                    results.append({"id": uid, "status": "FAILED", "message": "未查詢到任何打卡紀錄"})
                    
            except Exception as e:
                print(f"Checkin Verification Error: {e}")
                results.append({"id": uid, "status": "FAILED", "message": "打卡請求完成但驗證出錯"})
        else:
            results.append({"id": uid, "status": "FAILED", "message": "打卡登入失敗"})
            
    return jsonify({"status": "success", "results": results})

@app.route('/api/history', methods=['POST'])
def handle_history():
    data = request.json
    user_id = data.get('id')
    password = data.get('password')
    target_url = data.get('targetUrl', 'https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx')

    session = None
    session_data = GLOBAL_SESSIONS.get(user_id)
    if session_data and time.time() < session_data['expiry']:
        session = session_data['session']
    
    if not session:
        session = _perform_login_checkin(user_id, password, "")
    
    if session:
        try:
            resp = session.get(target_url, headers=APP_GET_HEADERS, verify=False)
            return resp.text
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Login failed"}), 401

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)