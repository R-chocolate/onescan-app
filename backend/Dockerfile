# 使用 Python 3.10 輕量版
FROM python:3.10-slim

# 設定時區為台灣 (重要！不然你的 Log 時間會錯)
ENV TZ=Asia/Taipei
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 設定工作目錄
WORKDIR /app

# 複製並安裝套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製程式碼
COPY . .

# 設定環境變數 (GCP 會自動注入 PORT，這裡預設 8080)
ENV PORT=8080

# 啟動指令 (注意 server:app 的 server 是你的檔名，如果你改名 main.py 就要變 main:app)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 server:app