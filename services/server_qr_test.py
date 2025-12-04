import requests
import json

API_URL = "http://localhost:5000/api/checkin_batch"

USERS = [
    {"id": "D1321250", "password": "@Rrethan78987"},
    {"id": "D1311656", "password": "fcweichen8817"} 
]

# 🔥 把你讀出來的那串 JWT 貼在這裡
JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjbHNfaWQiOiJDRTA3MTIxIiwic3ViX2lkIjoiNTk2MDciLCJzY3JfZHVwIjoiMDAxIiwieW1zX3llYXIiOjExNCwieW1zX3NtZXN0ZXIiOjEsInBlcmlvZCI6NiwidGltZXN0YW1wIjoiMjAyNS0xMi0wMlQxMzoxNTowMC44MjYiLCJleHAiOjE3NjQ2NTM3MDEuMH0.ZntuKsJTxTY7dYV8_oKb_giaQnFgGmMB39rGURTpRYk"

def test_checkin():
    print(f"🚀 正在發送 JWT 打卡請求...")
    
    payload = {
        "users": USERS,
        "qr_data": JWT_TOKEN 
    }

    try:
        response = requests.post(API_URL, json=payload)
        print("\n--- 後端回應 ---")
        print(json.dumps(response.json(), indent=4, ensure_ascii=False))

    except Exception as e:
        print(f"💥 錯誤: {e}")

if __name__ == "__main__":
    test_checkin()