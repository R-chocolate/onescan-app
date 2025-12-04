import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import datetime
import urllib.parse as urlparse
import urllib3

# 關閉 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
# 啟用 CORS，允許所有來源連線
CORS(app)

GLOBAL_SESSIONS = {} 

# ================= CONFIG =================
SCHOOL_LOGIN_URL = "https://signin.fcu.edu.tw/clockin/login.aspx"
TIME_CHECK_URL = "https://signin.fcu.edu.tw/clockin/TimeService.svc/servertime"
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

# 執行登入或打卡的共用函式
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
        # Step 1: Get Cookie
        s.get(SCHOOL_LOGIN_URL, headers=APP_GET_HEADERS, timeout=5, verify=False)
        
        # Step 2: Payload
        payload_str = (
            f"username={user_id}&password={password}&appversion=qr"
            f"&uuid={real_uuid}&major={real_major}&minor={real_minor}&page=cls"
        )

        # Step 3: POST
        response = s.post(
            SCHOOL_LOGIN_URL, 
            headers=APP_POST_HEADERS, 
            data=payload_str, 
            allow_redirects=False, 
            timeout=8,
            verify=False 
        )
        
        # Step 4: 判斷結果
        if response.status_code == 302:
            redirect_path = response.headers.get('Location')
            
            # 純登入模式 (或是為了抓紀錄而登入)
            if not qr_data:
                return s
            
            # 打卡模式：檢查結果頁
            target_url = BASE_HOST + redirect_path if redirect_path.startswith('/') else redirect_path
            result_page = s.get(target_url, headers=APP_GET_HEADERS, verify=False)
            page_content = result_page.text

            if "登錄成功" in page_content or "打卡成功" in page_content:
                return s
            elif "QRCode錯誤" in page_content:
                print(f"⚠️ [{user_id}] QRCode錯誤")
                return None
            elif "非點名時間" in page_content:
                print(f"⚠️ [{user_id}] 非點名時間")
                return None
            else:
                return None
            
        elif response.status_code == 200:
            print(f"❌ [{user_id}] 帳密錯誤")
            return None
        else:
            return None

    except Exception as e:
        print(f"💥 [{user_id}] Exception: {e}")
        return None

# ================= ROUTES =================

# 1. 批量登入 (保持原名 login_batch，確保舊功能正常)
@app.route('/api/login_batch', methods=['POST'])
def handle_login_batch():
    data = request.json
    users = data.get('users', [])
    results = []
    for u in users:
        uid = u['id']
        pwd = u['password']
        sess = _perform_login_checkin(uid, pwd, "")
        if sess:
            GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
            results.append({"id": uid, "status": "SUCCESS", "message": "登入成功"})
        else:
            results.append({"id": uid, "status": "FAILED", "message": "登入失敗"})
    return jsonify({"status": "success", "results": results})

# 2. 批量打卡 (保持原名 checkin_batch，確保舊功能正常)
@app.route('/api/checkin_batch', methods=['POST'])
def handle_checkin_batch():
    data = request.json
    # [關鍵] 這裡保持讀取 qr_data，配合您前端的送法
    qr_data = data.get('qr_data', '') 
    users = data.get('users', [])
    results = []
    
    for u in users:
        uid = u['id']
        pwd = u['password']
        sess = _perform_login_checkin(uid, pwd, qr_data)
        
        if sess:
            GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
            results.append({"id": uid, "status": "SUCCESS", "message": "打卡成功"})
        else:
            results.append({"id": uid, "status": "FAILED", "message": "打卡失敗(過期/無效)"})
            
    return jsonify({"status": "success", "results": results})

# 3. [新增] 歷史紀錄路由 (前端呼叫 /api/history)
# 這就是您目前缺少的關鍵部分！
@app.route('/api/history', methods=['POST'])
def handle_history():
    data = request.json
    user_id = data.get('id')
    password = data.get('password')
    # 學校的紀錄頁面網址
    target_url = data.get('targetUrl', 'https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx')

    print(f"[{user_id}] 正在抓取歷史紀錄...")

    # 先嘗試用快取的 Session (加速)
    session = None
    session_data = GLOBAL_SESSIONS.get(user_id)
    if session_data and time.time() < session_data['expiry']:
        session = session_data['session']
    
    # 如果沒有快取，重新登入
    if not session:
        session = _perform_login_checkin(user_id, password, "")
    
    if session:
        try:
            # 使用 Session 抓取目標網頁
            resp = session.get(target_url, headers=APP_GET_HEADERS, verify=False)
            # 回傳 HTML 原始碼給前端解析
            return resp.text
        except Exception as e:
            print(f"Error fetching history: {e}")
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "Login failed"}), 401

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)