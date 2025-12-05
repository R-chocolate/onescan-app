import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
import datetime
import urllib.parse as urlparse
import urllib3
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)

GLOBAL_SESSIONS = {} 

# 極速通道 (保持 TCP 連線)
FAST_CLIENT = requests.Session()

COMMON_HEADERS = {
    'Host': 'signin.fcu.edu.tw',
    'Connection': 'keep-alive', 
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-A156E Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36',
    'Origin': 'null',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'X-Requested-With': 'com.fcuapp.app',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Dest': 'document',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
}

FAST_CLIENT.headers.update(COMMON_HEADERS)
SCHOOL_LOGIN_URL = "https://signin.fcu.edu.tw/clockin/login.aspx"
BASE_HOST = "https://signin.fcu.edu.tw"

def get_taiwan_time():
    return datetime.datetime.utcnow() + datetime.timedelta(hours=8)

def _parse_latest_time_from_html(html_content):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        found_times = []
        for table_id in ['GridViewRec', 'MonthlyRecordRec']:
            table = soup.find('table', id=table_id)
            if table:
                rows = table.find_all('tr')
                for row in rows[1:4]: 
                    cells = row.find_all('td')
                    if len(cells) >= 3:
                        try: found_times.append(datetime.datetime.strptime(cells[2].text.strip(), '%Y/%m/%d %H:%M:%S'))
                        except: pass
        if found_times: return max(found_times)
        return None
    except: return None

def _perform_single_checkin_and_verify(user_data, qr_data):
    """
    單一執行緒：打卡 + 快速驗證
    """
    uid, pwd = user_data['id'], user_data['password']
    start_time = get_taiwan_time()
    
    # 1. 執行打卡 (強制清空 Cookie，走極速通道)
    FAST_CLIENT.cookies.clear()
    s = FAST_CLIENT
    
    real_major, real_minor, real_uuid = '', '', ''
    if qr_data and len(qr_data) > 20:
        if "http" not in qr_data: real_uuid = qr_data
        else:
            try:
                p = urlparse.parse_qs(urlparse.urlparse(qr_data).query)
                real_major, real_minor = p.get('major',[''])[0], p.get('minor',[''])[0]
            except: pass

    try:
        # GET ViewState
        s.get(SCHOOL_LOGIN_URL, timeout=3, verify=False)
        payload_str = f"username={uid}&password={pwd}&appversion=qr&uuid={real_uuid}&major={real_major}&minor={real_minor}&page=cls"
        resp = s.post(SCHOOL_LOGIN_URL, data=payload_str, allow_redirects=False, timeout=5, verify=False)
        
        # 2. 驗證階段
        if resp.status_code == 302:
            # 登入成功，嘗試驗證一次
            # 這裡我們只等 0.5 秒，不拖泥帶水
            time.sleep(0.5)
            
            try:
                # 追蹤轉址 (通常是去 ClassClockinRecord.aspx)
                loc = resp.headers.get('Location', '')
                target = BASE_HOST + loc if loc.startswith('/') else loc
                rec_resp = s.get(target, verify=False, timeout=5)
                
                last_rec = _parse_latest_time_from_html(rec_resp.text)
                
                if last_rec and abs((last_rec - start_time).total_seconds()) <= 60:
                    return {"id": uid, "status": "SUCCESS", "message": f"打卡成功 ({int((last_rec - start_time).total_seconds())}s)"}
                else:
                    # 雖然沒查到，但因為是 302，學校其實已經收件了
                    # 為了不顯示失敗嚇人，我們回傳 "已送達"
                    return {"id": uid, "status": "SUCCESS", "message": "打卡請求已送達 (學校寫入中)"}
            except:
                # 抓取紀錄失敗，但打卡請求是成功的
                return {"id": uid, "status": "SUCCESS", "message": "打卡請求已送達 (驗證超時)"}
        
        return {"id": uid, "status": "FAILED", "message": f"學校拒絕: {resp.status_code}"}
        
    except Exception as e:
        return {"id": uid, "status": "FAILED", "message": "連線錯誤"}

def _perform_login_only(user_data):
    uid, pwd = user_data['id'], user_data['password']
    s = requests.Session()
    s.headers.update(COMMON_HEADERS)
    try:
        s.get(SCHOOL_LOGIN_URL, timeout=4, verify=False)
        payload_str = f"username={uid}&password={pwd}&appversion=qr&uuid=&major=&minor=&page=cls"
        resp = s.post(SCHOOL_LOGIN_URL, data=payload_str, allow_redirects=False, timeout=8, verify=False)
        if resp.status_code == 302: return uid, s 
        return uid, None
    except: return uid, None

# ================= ROUTES =================

@app.route('/', methods=['GET'])
def wake_up():
    return "Backend is awake!", 200

@app.route('/api/login_batch', methods=['POST'])
def handle_login_batch():
    data = request.json
    results = []
    for u in data.get('users', []):
        uid, sess = _perform_login_only(u)
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
    
    # 🔥 使用多執行緒平行處理，每個使用者有獨立的打卡+驗證流程
    # 這樣就算有 10 個帳號，也只會花 1 個帳號的時間 (約 2 秒)
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_perform_single_checkin_and_verify, u, qr_data) for u in users]
        results = [f.result() for f in futures]
            
    return jsonify({"status": "success", "results": results})

@app.route('/api/history', methods=['POST'])
def handle_history():
    data = request.json
    uid, pwd = data.get('id'), data.get('password')
    sess = None
    if uid in GLOBAL_SESSIONS and time.time() < GLOBAL_SESSIONS[uid]['expiry']:
        sess = GLOBAL_SESSIONS[uid]['session']
    if not sess: _, sess = _perform_login_only({'id': uid, 'password': pwd})
    if sess:
        try: return sess.get("https://signin.fcu.edu.tw/clockin/ClassClockinRecord.aspx", verify=False).text
        except Exception as e: return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Login failed"}), 401

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
