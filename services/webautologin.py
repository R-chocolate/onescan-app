import requests
from bs4 import BeautifulSoup
import urllib3
import time
import random  # 引入隨機模組，讓延遲時間不固定

# 關閉 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# 1. 核心登入功能 (不用動)
# ==========================================
def login_fcu(username, password):
    """
    單一使用者登入函式
    """
    LOGIN_URL = "https://myfcu.fcu.edu.tw/main/InfoMyFcuLogin.aspx"
    
    # 這裡的 Headers 保持乾淨，登入時會自動加上 AJAX 標頭
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": LOGIN_URL,
        "X-MicrosoftAjax": "Delta=true",
        "X-Requested-With": "XMLHttpRequest",
    }

    session = requests.Session()

    try:
        # Step 1: GET (拿參數)
        init_headers = HEADERS.copy()
        del init_headers["X-MicrosoftAjax"]
        del init_headers["X-Requested-With"]
        del init_headers["Content-Type"]
        
        try:
            response = session.get(LOGIN_URL, headers=init_headers, verify=False, timeout=10)
        except requests.exceptions.Timeout:
            print(f"❌ [{username}] 連線逾時")
            return None

        if response.status_code != 200:
            print(f"❌ [{username}] 連線失敗 ({response.status_code})")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        
        try:
            viewstate = soup.find('input', {'name': '__VIEWSTATE'})['value']
            viewstate_gen = soup.find('input', {'name': '__VIEWSTATEGENERATOR'})['value']
            event_val = soup.find('input', {'name': '__EVENTVALIDATION'})['value']
            csrf_token = ""
            csrf_input = soup.find('input', {'name': 'csrf_token'})
            if csrf_input: csrf_token = csrf_input['value']
        except:
            print(f"❌ [{username}] 解析頁面失敗 (可能被 WAF 擋了)")
            return None

        # Step 2: POST (送帳密)
        payload = {
            'ScriptManager1': 'UpdatePanel1|OKButton',
            '__LASTFOCUS': '', '__EVENTTARGET': '', '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewstate, '__VIEWSTATEGENERATOR': viewstate_gen,
            '__SCROLLPOSITIONX': '0', '__SCROLLPOSITIONY': '0',
            '__EVENTVALIDATION': event_val,
            'txtUserName': username,
            'txtPassword': password,
            'csrf_token': csrf_token,
            '__ASYNCPOST': 'true',
            'OKButton': 'login'
        }

        login_response = session.post(LOGIN_URL, data=payload, headers=HEADERS, verify=False)
        
        if "pageRedirect" in login_response.text:
            print(f"✅ [{username}] 登入成功！")
            return session
        else:
            print(f"❌ [{username}] 登入失敗 (密碼錯誤或驗證失敗)")
            return None

    except Exception as e:
        print(f"💥 [{username}] 系統錯誤: {e}")
        return None

# 2. 主程式 (多人處理邏輯)

if __name__ == "__main__":

    
    USER_LIST = [
        {"id": "D1321250", "pwd": "@Rrethan78987"}, 
        {"id": "D1111111", "pwd": "同學A的密碼"},
        {"id": "D2222222", "pwd": "同學B的密碼"}, 
    ]

    # --- 字典來存「活著」的 Session ---
    # 結構: { "學號": Session物件 }
    ACTIVE_SESSIONS = {}

    print(f"🚀 開始執行批次登入，共有 {len(USER_LIST)} 個帳號...\n")

    # --- 迴圈執行登入 ---
    for user in USER_LIST:
        u_id = user["id"]
        u_pwd = user["pwd"]

       
        sess = login_fcu(u_id, u_pwd)

        if sess:
            # 如果成功，存入字典
            ACTIVE_SESSIONS[u_id] = sess
        
        # 🔥【關鍵防禦機制】：隨機延遲 1~3 秒
        # 這是為了騙過學校防火牆，不要讓它覺得你是機器人連續攻擊
        delay = random.uniform(1, 3) 
        print(f"⏳ 休息 {delay:.2f} 秒，準備下一個...")
        time.sleep(delay)

    # --- 總結與後續應用 ---
    print("\n" + "="*30)
    print(f"📊 執行結束！")
    print(f"嘗試人數: {len(USER_LIST)}")
    print(f"成功人數: {len(ACTIVE_SESSIONS)}")
    print("="*30)

    # 這裡示範怎麼使用存下來的 Session
    if len(ACTIVE_SESSIONS) > 0:
        print("\n 準備進入下一步 (例如: 掃QR Code)...")
        
        # 假設你掃到了一個 QR Code Token
        QR_TOKEN = "https://fcu.edu/checkin?code=XYZ123"

        # 遍歷所有成功的 Session 去執行動作
        for student_id, session in ACTIVE_SESSIONS.items():
            print(f" 正在幫 {student_id} 簽到中...")
            # 這裡之後會放你的簽到 POST 請求
            # session.post(CHECKIN_URL, data={...})