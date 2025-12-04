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

# 解析 HTML 抓取最新時間
def _parse_latest_time_from_html(html_content):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        found_times = []
        
        # 1. 檢查上方表格 (今日紀錄)
        table_today = soup.find('table', id='GridViewRec')
        if table_today:
            rows = table_today.find_all('tr')
            for row in rows[1:]:
                cells = row.find_all('td')
                if len(cells) >= 3:
                    time_str = cells[2].text.strip()
                    try:
                        dt = datetime.datetime.strptime(time_str, '%Y/%m/%d %H:%M:%S')
                        found_times.append(dt)
                    except ValueError:
                        pass

        # 2. 檢查下方表格 (歷史紀錄) - 以防上方沒顯示
        table_history = soup.find('table', id='MonthlyRecordRec')
        if table_history:
            rows = table_history.find_all('tr')
            if len(rows) > 1:
                first_data_row = rows[1]
                cells = first_data_row.find_all('td')
                if len(cells) >= 3:
                    time_str = cells[2].text.strip()
                    try:
                        dt = datetime.datetime.strptime(time_str, '%Y/%m/%d %H:%M:%S')
                        found_times.append(dt)
                    except ValueError:
                        pass

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
            if not qr_data: 
                return s 
            
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

# [重點] 這裡就是修改過的地方，加入了重試機制 (Retry Logic)
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
        
        # 1. 紀錄發送請求的時間 (基準點)
        request_start_time = get_taiwan_time()
        
        # 2. 執行打卡 (這一動作必須快，符合 QR Code 時效)
        sess = _perform_login_checkin(uid, pwd, qr_data)
        
        if sess:
            # 3. 驗證階段：加入重試機制
            checkin_success = False
            final_message = ""
            latest_record_time = None
            
            # 設定三次檢查：分別在 0.5秒, 2秒, 5秒 後檢查
            # 這樣就算學校資料庫延遲 3 秒，我們也能在第 3 次抓到
            delays = [0.5, 1.5, 3.0] 
            
            for wait in delays:
                try:
                    time.sleep(wait)
                    # 抓取紀錄頁面
                    rec_resp = sess.get(RECORD_URL, headers=APP_GET_HEADERS, verify=False, timeout=10)
                    latest_record_time = _parse_latest_time_from_html(rec_resp.text)
                    
                    if latest_record_time:
                        # 計算時間差
                        time_diff = (latest_record_time - request_start_time).total_seconds()
                        
                        # 這裡放寬到 30 秒，容許學校主機的時間誤差
                        # 注意：這裡比對的是「紀錄時間」與「請求時間」，與 QR Code 的 8 秒時效無關
                        if abs(time_diff) <= 60:
                            checkin_success = True
                            final_message = f"打卡成功 (時間差 {int(time_diff)}秒)"
                            break # 成功抓到新紀錄，跳出迴圈
                        else:
                            print(f"[{uid}] 抓到舊資料 ({latest_record_time})，差異 {int(time_diff)}秒，重試中...")
                except Exception as e:
                    print(f"[{uid}] 驗證過程發生錯誤: {e}")
            
            if checkin_success:
                GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
                results.append({"id": uid, "status": "SUCCESS", "message": final_message})
            else:
                msg = f"打卡請求已發送，但驗證失敗 (最新紀錄: {latest_record_time})" if latest_record_time else "打卡請求已發送，但查無紀錄"
                results.append({"id": uid, "status": "FAILED", "message": msg})
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