import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import datetime
import urllib.parse as urlparse
import urllib3
import re # 引入正則表達式來檢查網頁文字

# 關閉 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
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

AJAX_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-A156E Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Referer': 'https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx',
}

def _check_session_valid(user_id: str) -> bool:
    session_data = GLOBAL_SESSIONS.get(user_id)
    if not session_data: return False
    if datetime.datetime.now().timestamp() > session_data['expiry']:
        del GLOBAL_SESSIONS[user_id]
        return False
    try:
        s = session_data['session']
        response = s.get(TIME_CHECK_URL, headers=AJAX_HEADERS, timeout=3, verify=False)
        return response.status_code == 200
    except:
        return False

def _perform_login_checkin(user_id: str, password: str, qr_data: str) -> requests.Session | None:
    s = requests.Session()

    # 判斷動作類型
    action_name = "打卡" if qr_data else "登入"

    real_major = ''
    real_minor = ''
    real_uuid = '' 

    if qr_data:
        if "http" not in qr_data and len(qr_data) > 50:
            print(f"[{user_id}] 偵測到 JWT Token")
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
        # Step 1: 獲取 Cookie
        s.get(SCHOOL_LOGIN_URL, headers=APP_GET_HEADERS, timeout=5, verify=False)
        
        # Step 2: 組裝 Payload
        payload_str = (
            f"username={user_id}"
            f"&password={password}"
            f"&appversion=qr"
            f"&uuid={real_uuid}"
            f"&major={real_major}"
            f"&minor={real_minor}"
            f"&page=cls"
        )

        # Step 3: 發送 POST
        print(f"[{user_id}] 正在發送 {action_name} 請求...")
        
        response = s.post(
            SCHOOL_LOGIN_URL, 
            headers=APP_POST_HEADERS, 
            data=payload_str, 
            allow_redirects=False, 
            timeout=8,
            verify=False 
        )
        
        # 🔥 Step 4: 依照截圖進行嚴格判斷 🔥
        if response.status_code == 302:
            redirect_path = response.headers.get('Location')
            
            # 如果是「純登入」模式，只要 302 就當作成功
            if not qr_data:
                print(f"✅ [{user_id}] 登入驗證成功！ (302 Redirect)")
                return s
            
            # --- 打卡模式：追蹤結果頁面 ---
            print(f"[{user_id}] 伺服器接受請求，正在檢查結果頁面關鍵字...")
            
            target_url = BASE_HOST + redirect_path if redirect_path.startswith('/') else redirect_path
            result_page = s.get(target_url, headers=APP_GET_HEADERS, verify=False)
            page_content = result_page.text

            # 🛑 判斷邏輯更新 (根據你的截圖) 🛑
            
            # 1. 優先檢查成功關鍵字
            if "登錄成功" in page_content or "打卡成功" in page_content:
                # 這裡還可以進一步抓取課程名稱 (選做)
                print(f"✅ [{user_id}] 打卡確認成功！(偵測到'登錄成功')")
                return s
            
            # 2. 檢查具體失敗原因 (讓前端顯示更清楚)
            elif "QRCode錯誤" in page_content:
                print(f"⚠️ [{user_id}] 打卡失敗：QRCode錯誤 (過期或無效)")
                return None
            elif "非點名時間" in page_content:
                print(f"⚠️ [{user_id}] 打卡失敗：非點名時間")
                return None
            elif "無效" in page_content:
                print(f"⚠️ [{user_id}] 打卡失敗：代碼無效")
                return None
            else:
                # 3. 如果沒看到成功，也沒看到已知失敗，為了安全起見，判定為失敗
                print(f"⚠️ [{user_id}] 打卡失敗：未見成功訊息 (可能是未知錯誤)")
                # 可以把這時候的 HTML 印出來除錯
                # print(page_content[:500]) 
                return None
            
        elif response.status_code == 200:
            print(f"❌ [{user_id}] {action_name}失敗 (Status 200, 帳密錯誤或被擋)")
            return None
        else:
            print(f"❌ [{user_id}] 失敗: Status {response.status_code}")
            return None

    except Exception as e:
        print(f"💥 [{user_id}] 連線錯誤: {e}")
        return None

# API 路由
@app.route('/api/login_batch', methods=['POST'])
def handle_login_batch():
    data = request.json
    users = data.get('users', [])
    results = []
    for u in users:
        uid = u['id']
        pwd = u['password']
        # 登入時不帶 QR
        sess = _perform_login_checkin(uid, pwd, "")
        if sess:
            GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
            results.append({"id": uid, "status": "SUCCESS", "message": "登入成功"})
        else:
            results.append({"id": uid, "status": "FAILED", "message": "登入失敗"})
    return jsonify({"status": "success", "results": results})

@app.route('/api/checkin_batch', methods=['POST'])
def handle_checkin_batch():
    data = request.json
    qr_data = data.get('qr_data', '')
    users = data.get('users', [])
    results = []
    
    for u in users:
        uid = u['id']
        pwd = u['password']
        
        # 打卡時帶 QR，會觸發嚴格檢查
        sess = _perform_login_checkin(uid, pwd, qr_data)
        
        if sess:
            GLOBAL_SESSIONS[uid] = {'session': sess, 'expiry': time.time() + 1800}
            results.append({"id": uid, "status": "SUCCESS", "message": "打卡成功"})
        else:
            # 這裡的失敗可能是過期，也可能是其他原因
            results.append({"id": uid, "status": "FAILED", "message": "打卡失敗(過期/無效)"})
            
    return jsonify({"status": "success", "results": results})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 學校打卡後端 (嚴格驗證版) 已啟動，監聽 Port: {port}")
    app.run(host='0.0.0.0', port=port, debug=True)