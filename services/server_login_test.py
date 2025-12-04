import requests
import json

# 這是你本機伺服器的網址 (對應 server.py 的 API)
API_URL = "http://localhost:5000/api/login_batch"

# 請填入你的真實帳號密碼來測試
# 注意：這只是測試腳本，不會上傳給別人
TEST_USER = [
    {"id":"D1321250", "password": "@Rrethan78987"},
    {"id":"D1311656", "password":"fcweichen8817"} 
]

def test_login():
    print(f"🚀 正在發送請求到 {API_URL} ...")
    
    try:
        # 模擬前端發送 JSON 資料
        response = requests.post(API_URL, json={"users": TEST_USER})
        
        # 顯示結果
        print("\n--- 伺服器回應結果 ---")
        print(json.dumps(response.json(), indent=4, ensure_ascii=False))
        
        if response.status_code == 200:
            result = response.json()
            # 檢查 results 列表裡面的 status
            if result['results'][0]['status'] == 'SUCCESS':
                print("\n✅ 恭喜！測試成功！你的 Python 程式成功登入學校系統了！")
            else:
                print("\n❌ 測試失敗：學校伺服器拒絕登入 (可能是帳密錯誤或被擋)")
        else:
            print(f"\n❌ 伺服器發生錯誤: {response.status_code}")

    except Exception as e:
        print(f"\n💥 連線失敗: {e}")
        print("請檢查你的 server.py 有沒有在另一個視窗執行中？")

if __name__ == "__main__":
    test_login()